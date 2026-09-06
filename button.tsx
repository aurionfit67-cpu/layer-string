import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "iconSm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent border-transparent hover:brightness-[1.06] active:brightness-95 shadow-[0_1px_2px_rgb(var(--shadow-color)/12%)]",
  secondary: "bg-surface text-ink border-line hover:bg-surface-2 hover:border-line-strong",
  ghost: "bg-transparent text-muted border-transparent hover:bg-surface-2 hover:text-ink",
  quiet: "bg-surface-2 text-ink border-transparent hover:bg-surface-3",
  danger: "bg-transparent text-danger border-transparent hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-[10px]",
  lg: "h-11 px-5 text-[14px] gap-2 rounded-xl",
  icon: "h-9 w-9 justify-center rounded-[10px]",
  iconSm: "h-7 w-7 justify-center rounded-lg",
};

const BASE = cn(
  "inline-flex select-none items-center whitespace-nowrap border font-medium",
  "transition-[background-color,color,border-color,filter,transform] duration-150 ease-out",
  "active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-45",
);

type Shared = { variant?: ButtonVariant; size?: ButtonSize; className?: string; children?: ReactNode };

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Shared & {
    /**
     * Renders an internal link with button styling instead of a `<button>`.
     * `<a>` cannot contain a `<button>`, so navigating actions are this prop —
     * never a Button wrapped in a Link.
     */
    href?: string;
  };

/**
 * The only button in the product, so hover/active/focus stay consistent whether
 * the thing activates a command or goes somewhere.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", href, children, ...props },
  ref,
) {
  const styles = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if (href) {
    return (
      <Link href={href} className={styles} {...(props as Record<string, unknown>)}>
        {children}
      </Link>
    );
  }

  return (
    <button ref={ref} type={type} className={styles} {...props}>
      {children}
    </button>
  );
});
