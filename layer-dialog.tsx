"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useAppState, useStore } from "@/lib/state/provider";
import { ACCENTS, LAYER_ICONS, LAYER_ICON_KEYS, type AccentKey, type LayerIconKey } from "@/lib/workspace/icons";
import { cn } from "@/lib/utils/cn";
import { MAX_DESCRIPTION, MAX_NAME } from "@/lib/utils/format";

/**
 * Creating a Layer is the one place LAYER asks for information up front — name,
 * icon, accent — because those three decide how the Layer is recognised in a
 * grid of them. Everything after this happens on the canvas, not in a dialog.
 */
export function LayerDialog() {
  const dialog = useAppState((state) => state.layerDialog);
  // Unmounting on close discards the draft, and remounting re-reads the Layer, so
  // the form's initial state always comes from its props — no effect has to keep a
  // copy of it in sync.
  return dialog ? <LayerForm key={dialog.mode === "edit" ? `edit-${dialog.layerId}` : "create"} dialog={dialog} /> : null;
}

type Dialog = { mode: "create" } | { mode: "edit"; layerId: string };

function LayerForm({ dialog }: { dialog: Dialog }) {
  const store = useStore();
  const router = useRouter();
  const layerCount = useAppState((state) => state.layers.length);
  const editing = dialog.mode === "edit" ? store.layerById(dialog.layerId) : undefined;

  const [name, setName] = useState(() => editing?.name ?? "");
  const [description, setDescription] = useState(() => editing?.description ?? "");
  const [icon, setIcon] = useState<LayerIconKey>(() => {
    const candidate = editing?.icon as LayerIconKey | undefined;
    if (candidate && candidate in LAYER_ICONS) return candidate;
    return LAYER_ICON_KEYS[layerCount % LAYER_ICON_KEYS.length] ?? "target";
  });
  const [accent, setAccent] = useState<AccentKey>(
    () => (editing?.accent as AccentKey | undefined) ?? ACCENTS[layerCount % ACCENTS.length] ?? "indigo",
  );
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      nameRef.current?.focus();
      store.notify("Give the Layer a name — it can be changed any time.", { tone: "warning" });
      return;
    }
    if (dialog.mode === "edit") {
      store.updateLayer(dialog.layerId, { name: trimmed, description: description.trim(), icon, accent });
      store.setLayerDialog(null);
      store.notify("Layer updated", { tone: "success" });
      return;
    }
    void (async () => {
      const layer = await store.createLayer({
        name: trimmed,
        description: description.trim(),
        icon,
        accent,
        metadata: { source: "manual" },
      });
      store.openLayer(layer.id);
      store.setLayerDialog(null);
      router.push(`/layers/${layer.id}`);
    })();
  };

  const titleId = "layer-dialog-title";

  return (
    <Modal
      open
      onClose={() => store.setLayerDialog(null)}
      titleId={titleId}
      className="w-[min(94vw,520px)]"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex min-h-0 flex-col"
        data-accent={accent}
      >
        <ModalHeader
          id={titleId}
          title={dialog.mode === "edit" ? "Layer details" : "New Layer"}
          description={
            dialog.mode === "edit" ? undefined : "One thing you are doing. Everything it needs goes inside."
          }
        />
        <ModalBody className="grid gap-4">
          <Field label="Name" htmlFor="layer-name">
            <Input
              id="layer-name"
              ref={nameRef}
              value={name}
              maxLength={MAX_NAME}
              placeholder="Company Launch, Exam Preparation, Website Project…"
              onChange={(event) => setName(event.target.value)}
              className="text-[14px]"
            />
          </Field>

          <Field label="Description" htmlFor="layer-description" hint="Optional. It shows under the title in the workspace.">
            <Input
              id="layer-description"
              value={description}
              maxLength={MAX_DESCRIPTION}
              placeholder="What this Layer is for"
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <div className="grid gap-2">
            <p className="eyebrow" id="layer-icon-label">
              Icon
            </p>
            <div role="radiogroup" aria-labelledby="layer-icon-label" className="flex flex-wrap gap-1.5">
              {LAYER_ICON_KEYS.map((key) => {
                const Icon = LAYER_ICONS[key];
                const active = key === icon;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={key}
                    onClick={() => setIcon(key)}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-[10px] border transition-all duration-150",
                      active
                        ? "accent-soft border-transparent shadow-[0_0_0_2px_color-mix(in_srgb,rgb(var(--accent-rgb))_28%,transparent)]"
                        : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
                    )}
                  >
                    <Icon size={16} strokeWidth={active ? 2.1 : 1.8} aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <p className="eyebrow" id="layer-accent-label">
              Accent
            </p>
            <div role="radiogroup" aria-labelledby="layer-accent-label" className="flex flex-wrap gap-2">
              {ACCENTS.map((key) => {
                const active = key === accent;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`Accent ${key}`}
                    onClick={() => setAccent(key)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform duration-150",
                      active ? "scale-110 border-ink/70" : "border-transparent hover:scale-105",
                    )}
                    style={{ background: `rgb(var(--a-${key}))` }}
                  />
                );
              })}
            </div>
          </div>

          {dialog.mode === "edit" ? (
            <p className="text-[11.5px] text-faint">
              Changes apply immediately. Deleting a Layer lives in the Layer menu, not here.
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => store.setLayerDialog(null)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {dialog.mode === "edit" ? "Apply" : "Create Layer"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
