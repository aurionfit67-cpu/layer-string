import { cn } from "@/lib/utils/cn";

/**
 * Keyboard hint that is correct on both platforms without waiting for a mount
 * effect: the pre-paint script in the root layout stamps data-platform on <html>,
 * and CSS picks the glyph. The full spelling is always available to screen
 * readers, since "⌘" and "Ctrl" are ambiguous to read aloud.
 */
export function Combo({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((key) => (
        <kbd key={key} className="kbd">
          {key === "Mod" ? <span className="kbd-mod" aria-hidden /> : key}
        </kbd>
      ))}
      <span className="sr-only">{keys.map(spelledKey).join(" then ")}</span>
    </span>
  );
}

function spelledKey(key: string): string {
  switch (key) {
    case "Mod":
      return "Command or Control";
    case "Shift":
      return "Shift";
    case "Esc":
      return "Escape";
    case "Arrows":
      return "arrow keys";
    case "Delete":
      return "Delete";
    case "+":
      return "plus";
    case "-":
      return "minus";
    default:
      return key;
  }
}
