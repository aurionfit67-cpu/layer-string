"use client";

import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type FileDropProps = {
  kind: "image" | "file";
  /** Called with the picked File; the caller decides whether to attach or replace. */
  onFile: (file: File) => unknown;
  children: ReactNode;
  className?: string;
  label: string;
  multiple?: boolean;
};

/**
 * Inline picker: a real button plus a hidden input. Clicking, Enter and Space all
 * open the OS dialog; there is no portal, no global event bus, and the input is
 * cleared after every pick so choosing the same file twice still fires.
 */
export function FileDrop({ kind, onFile, children, className, label, multiple }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <button
        type="button"
        data-no-drag
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        className={cn(className)}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={kind === "image" ? "image/*" : "*/*"}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = event.target.files;
          const picked = files ? Array.from(files) : [];
          event.target.value = "";
          for (const file of picked) void onFile(file);
        }}
      />
    </>
  );
}
