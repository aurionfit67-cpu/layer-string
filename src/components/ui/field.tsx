import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "quiet-field h-9 w-full px-2.5 text-[13px] text-ink placeholder:text-faint",
        className,
      )}
      {...props}
    />
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Grow with content up to maxPx, then scroll. */
  autoGrow?: boolean;
  maxPx?: number;
};

/**
 * Auto-growing textarea. `field-sizing: content` does this in CSS where
 * supported; the measured fallback keeps Firefox and older Safari identical
 * instead of shipping a card whose text hides below its own edge.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoGrow = true, maxPx = 1200, onChange, ...props },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const grow = () => {
    const node = innerRef.current;
    if (!node || !autoGrow) return;
    if ("fieldSizing" in node.style) {
      // Native content sizing (Chromium 123+) already handles this; measuring
      // on top of it would fight the browser on every keystroke.
      return;
    }
    node.style.height = "auto";
    node.style.height = `${Math.min(maxPx, Math.max(24, node.scrollHeight))}px`;
  };

  useEffect(() => {
    grow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value, props.defaultValue]);

  return (
    <textarea
      {...props}
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = node;
      }}
      onChange={(event) => {
        grow();
        onChange?.(event);
      }}
      rows={1}
      className={cn(
        "w-full resize-none overflow-hidden bg-transparent text-[13px] leading-[1.55] text-ink",
        "outline-none placeholder:text-faint",
        className,
      )}
    />
  );
});

export type FieldProps = {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({ label, hint, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="eyebrow">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-faint">{hint}</p> : null}
    </div>
  );
}
