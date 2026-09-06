import type { ResolvedTheme } from "@/hooks/use-theme";

/**
 * Sun / moon marks. Hand-drawn rather than pulled from the icon set so both
 * states share exactly one stroke weight and optical size.
 */
export function ThemeGlyph({ resolved, size = 14 }: { resolved: ResolvedTheme; size?: number }) {
  if (resolved === "dark") {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M13 9.6A5.4 5.4 0 1 1 6.4 3a4.4 4.4 0 0 0 6.6 6.6Z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="8" cy="8" r="3" />
      <path
        d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1"
        strokeLinecap="round"
      />
    </svg>
  );
}
