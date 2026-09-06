export const MAX_TITLE = 160;
export const MAX_NAME = 120;
export const MAX_DESCRIPTION = 280;
export const MAX_BODY = 20_000;

/** "2 hours ago" style relative time, stable for a session. */
export function formatRelativeTime(input: number | undefined, now = Date.now()): string {
  if (typeof input !== "number" || !Number.isFinite(input)) return "never";
  const diff = Math.max(0, now - input);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < 45_000) return "just now";
  if (diff < hour) return `${Math.round(diff / minute)} min ago`;
  if (diff < day) {
    const h = Math.round(diff / hour);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  const days = Math.floor(diff / day);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 31) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: days > 320 ? "numeric" : undefined,
    }).format(new Date(input));
  } catch {
    return new Date(input).toDateString();
  }
}

export function formatTimeOfDay(input: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(input));
  } catch {
    return "";
  }
}

/** Short absolute day label, e.g. "Fri 12 Sep" or "Fri 12 Sep 2025". */
export function formatDay(ms: number, now = Date.now()): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: sameYear ? undefined : "numeric",
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

export function isOverdue(ms: number, now = Date.now()): boolean {
  if (!Number.isFinite(ms) || ms <= 0) return false;
  const day = 86_400_000;
  return Math.floor(ms / day) < Math.floor(now / day);
}

/** yyyy-mm-dd in *local* time, for `<input type="date">`. */
export function toInputDate(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  const rounded = value >= 100 || exponent === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[exponent] ?? "B"}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "Payment gateway research" + "payment" → "Payment gateway research" with match bounds. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
