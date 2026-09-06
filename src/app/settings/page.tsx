"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { FatalStorage } from "@/components/layout/fatal-storage";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Combo } from "@/components/ui/combo";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { useLayerState } from "@/lib/state/provider";
import { commitImport, exportWorkspace, inspectBackup, resetWorkspace } from "@/lib/state/data";
import type { ImportPlan } from "@/lib/storage/transfer";
import { EXPORT_FILENAME } from "@/lib/storage/transfer";
import type { Settings, ThemeSetting } from "@/lib/types";
import { SHORTCUTS, SHORTCUT_SCOPES, type ShortcutScope } from "@/lib/utils/shortcuts";
import { formatBytes } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const VERSION = process.env.NEXT_PUBLIC_LAYER_VERSION ?? "0.1.0";

/**
 * Settings in LAYER is mostly a data page: because the product is local-first,
 * "where is my stuff and how do I get it out" is the single most important
 * question a user can ask. Everything here reads and writes real state.
 */
export default function SettingsPage() {
  const { state, store } = useLayerState();
  const [usage, setUsage] = useState<number | null>(null);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refreshUsage = useCallback(async () => {
    const repository = store.getRepository();
    if (!repository) return null;
    return repository.estimateUsageBytes();
  }, [store]);

  // The estimate is an async read of an external system (IndexedDB), so it is
  // written back from the continuation instead of a second effect.
  useEffect(() => {
    let active = true;
    void refreshUsage().then((bytes) => {
      if (active) setUsage(bytes === null ? null : bytes);
    });
    return () => {
      active = false;
    };
  }, [refreshUsage, state.layers.length, state.cardOrder.length]);

  if (state.status === "error") return <FatalStorage message={state.fatalError} />;

  const settings = state.settings;
  const patch = (next: Partial<Settings>) => store.updateSettings(next);
  const cardCount = state.cardOrder.filter((id) => state.cards[id]).length;

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setPlanError(null);
    setPlan(null);
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error("That file is larger than the 64 MB import limit.");
      const text = await file.text();
      setPlan(await inspectBackup(text));
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "That file could not be read as a LAYER backup.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <TopBar crumb="Settings" />

      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 pb-20 pt-8 md:px-7 md:pt-11">
        <h1 className="text-[clamp(22px,3.2vw,30px)] font-semibold leading-tight tracking-[-0.028em] text-ink">
          Settings
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Five groups, all of them about this browser. There is no account to configure.
        </p>

        <Section title="Appearance" description="Light, dark, or whatever the system is doing.">
          <Row label="Theme">
            <Segmented
              label="Theme"
              value={settings.theme}
              onChange={(value: ThemeSetting) => patch({ theme: value })}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </Row>
          <Row label="Motion" hint="Reduced mode collapses every transition, including the workspace ones.">
            <Segmented
              label="Motion"
              value={settings.motion}
              onChange={(value) => patch({ motion: value })}
              options={[
                { value: "system", label: "System" },
                { value: "full", label: "Full" },
                { value: "reduced", label: "Reduced" },
              ]}
            />
          </Row>
        </Section>

        <Section title="Workspace" description="How cards sit on the canvas.">
          <Row label="Snap to grid">
            <Switch
              checked={settings.snapToGrid}
              onChange={(checked) => patch({ snapToGrid: checked })}
              label="Snap cards to the grid while dragging"
              description="Hold Alt while dragging to place one freely."
            />
          </Row>
          <Row label="Grid size">
            <Segmented
              label="Grid size"
              value={String(settings.gridSize)}
              onChange={(value) => patch({ gridSize: Number(value) })}
              options={[
                { value: "16", label: "16" },
                { value: "24", label: "24" },
                { value: "32", label: "32" },
                { value: "48", label: "48" },
              ]}
            />
          </Row>
          <Row label="Card timestamps">
            <Switch
              checked={settings.showCardMeta}
              onChange={(checked) => patch({ showCardMeta: checked })}
              label="Show when a card last changed"
              description="Appears in a card header on hover."
            />
          </Row>
          <Row label="Example content">
            {store.hasDemoLayer() ? (
              <Chip tone="neutral">An example Layer is in your list</Chip>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    store.updateSettings({ onboarded: true });
                    void (async () => {
                      const layer = await store.seedDemoLayer();
                      if (layer) store.openLayer(layer.id);
                    })();
                  }}
                >
                  Create example Layer
                </Button>
                <span className="ml-2 text-[11.5px] text-faint">One real Layer, clearly labelled as a sample.</span>
              </>
            )}
          </Row>
        </Section>

        <Section
          title="Data"
          description={
            state.storage.kind === "indexeddb"
              ? "Stored in IndexedDB on this device. Nothing leaves the browser."
              : `Currently using the ${state.storage.kind} fallback — export before closing this tab.`
          }
        >
          <div className="grid gap-2 rounded-[10px] border border-line bg-surface-2 p-3 sm:grid-cols-4">
            <Stat label="Layers" value={String(state.layers.length)} />
            <Stat label="Cards" value={String(cardCount)} />
            <Stat label="Store" value={state.storage.kind} />
            <Stat label="Approx. size" value={usage === null ? "unknown" : formatBytes(usage)} />
          </div>

          <Row label="Export" hint={`Writes ${EXPORT_FILENAME}: layers, cards, positions, settings and — if you keep it on — the stored images and files.`}>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[12px] text-muted">
                <input
                  type="checkbox"
                  checked={includeMedia}
                  onChange={(event) => setIncludeMedia(event.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                include attachments
              </label>
              <Button variant="primary" size="sm" onClick={() => void exportWorkspace(store, includeMedia)}>
                Export data
              </Button>
            </div>
          </Row>

          <Row label="Import" hint="A backup is validated record by record; anything unreadable is skipped and reported, never trusted.">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={reading} onClick={() => fileRef.current?.click()}>
                {reading ? "Reading…" : "Choose a backup"}
              </Button>
              {state.importedSummary ? (
                <span className="text-[11.5px] text-faint">Last import: {state.importedSummary}</span>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void onPickFile(event.target.files?.[0])}
            />
            {planError ? (
              <p role="alert" className="mt-2 rounded-[8px] border border-[color-mix(in_srgb,var(--danger)_40%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-2.5 py-2 text-[12px] text-danger">
                {planError}
              </p>
            ) : null}
          </Row>

          <Row label="Reset" hint="Deletes every Layer and card in this browser. Export first if you want them back.">
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
              Reset local data
            </Button>
          </Row>
        </Section>

        <Section title="Keyboard" description="Everything here is implemented; nothing here is decorative.">
          <ul className="grid gap-0">
            {(["everywhere", "workspace", "card"] as ShortcutScope[]).map((scope) => (
              <li key={scope} className="py-1.5">
                <p className="eyebrow mb-1">{SHORTCUT_SCOPES[scope]}</p>
                <ul className="grid gap-0.5">
                  {SHORTCUTS.filter((shortcut) => shortcut.scope === scope).map((shortcut) => (
                    <li
                      key={`${shortcut.scope}-${shortcut.keys.join("-")}`}
                      className="flex items-center justify-between gap-4 rounded-md px-1 py-1 text-[12.5px] text-muted hover:bg-surface-2"
                    >
                      <span>{shortcut.label}</span>
                      <Combo keys={shortcut.keys} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="About LAYER" description="A goal-centric workspace for everything you're doing.">
          <dl className="grid gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
            <Item term="Version" detail={VERSION} />
            <Item term="Licence" detail="MIT" />
            <Item term="Data" detail="This browser only — no server, no telemetry, no keys" />
            <Item term="Storage" detail="IndexedDB, with a localStorage fallback" />
            <Item term="Stack" detail="Next.js, React, TypeScript, Tailwind" />
            <Item term="AI" detail="Not wired up. Layer context is modelled so it can be, later." />
          </dl>
        </Section>
      </main>

      <ImportDialog
        plan={plan}
        onClose={() => setPlan(null)}
        onRun={async (mode) => {
          if (!plan) return;
          setPlan(null);
          try {
            await commitImport(store, plan, mode);
            await refreshUsage();
          } catch (error) {
            store.notify(error instanceof Error ? error.message : "Import failed.", { tone: "danger", duration: 9_000 });
          }
        }}
        currentLayers={state.layers.length}
        currentCards={cardCount}
      />

      <Confirm
        open={confirmReset}
        tone="danger"
        title="Reset local data?"
        confirmLabel="Delete everything in this browser"
        body={
          <span>
            {state.layers.length} {state.layers.length === 1 ? "Layer" : "Layers"} and {cardCount}{" "}
            {cardCount === 1 ? "card" : "cards"} will be removed from IndexedDB, including any stored images and
            files. This cannot be undone from inside LAYER.
          </span>
        }
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          void (async () => {
            await resetWorkspace(store);
            await refreshUsage();
          })();
        }}
      />
    </div>
  );
}

function ImportDialog({
  plan,
  onClose,
  onRun,
  currentLayers,
  currentCards,
}: {
  plan: ImportPlan | null;
  onClose: () => void;
  onRun: (mode: "merge" | "replace") => void;
  currentLayers: number;
  currentCards: number;
}) {
  if (!plan) return null;
  const titleId = "import-preview";
  return (
    <Modal open onClose={onClose} titleId={titleId} className="w-[min(94vw,520px)]">
      <ModalHeader
        id={titleId}
        title="Backup checked"
        description={plan.exportedAt ? `Exported ${new Date(plan.exportedAt).toLocaleString()}` : "Exported on an older build"}
      />
      <ModalBody className="grid gap-3">
        <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-line bg-surface-2 p-3 sm:grid-cols-4">
          <Stat label="Layers" value={String(plan.layers.length)} />
          <Stat label="Cards" value={String(plan.cards.length)} />
          <Stat label="Attachments" value={String(plan.media.length)} />
          <Stat label="Skipped" value={String(plan.skippedRecords)} />
        </div>
        {plan.warnings.length > 0 ? (
          <ul className="grid gap-1 rounded-[10px] border border-[color-mix(in_srgb,var(--warning)_38%,var(--line))] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-2.5 text-[12px] text-muted">
            {plan.warnings.slice(0, 6).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-2">
          <Choice
            title="Merge into what I have"
            body={`Adds or updates ${plan.layers.length} ${plan.layers.length === 1 ? "Layer" : "Layers"}. Your current ${currentLayers} ${currentLayers === 1 ? "Layer" : "Layers"} and ${currentCards} cards stay.`}
            onClick={() => onRun("merge")}
            primary
          />
          <Choice
            title="Replace everything"
            body="Deletes what is here now, then restores the backup exactly as exported — positions included."
            onClick={() => onRun("replace")}
            danger={currentLayers > 0}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function Choice({
  title,
  body,
  onClick,
  primary,
  danger,
}: {
  title: string;
  body: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[10px] border p-3 text-left transition-colors",
        danger
          ? "border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] hover:bg-[color-mix(in_srgb,var(--danger)_7%,transparent)]"
          : "border-line hover:bg-surface-2",
        primary ? "bg-surface" : "bg-surface-2/60",
      )}
    >
      <span className="block text-[13px] font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-[12px] leading-snug text-muted">{body}</span>
    </button>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 border-t border-line/70 pt-5 first:mt-8">
      <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {description ? <p className="mt-1 text-[12.5px] leading-snug text-muted">{description}</p> : null}
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-2 rounded-[10px] border border-line bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {hint ? <p className="mt-0.5 max-w-[54ch] text-[11.5px] leading-snug text-faint">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-[13px] text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function Item({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="grid">
      <dt className="eyebrow">{term}</dt>
      <dd className="mt-0.5 text-muted">{detail}</dd>
    </div>
  );
}
