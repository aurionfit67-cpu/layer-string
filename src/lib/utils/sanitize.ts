/**
 * Input hardening for user-authored strings.
 *
 * LAYER never uses dangerouslySetInnerHTML, so React's escaping is the primary
 * defence. This module adds a second, cheap layer: control characters are
 * stripped (they can smuggle terminal/zero-width tricks into exports) and
 * length is capped so one pathological paste can't bloat storage.
 */

// Deliberately a control-character class: it is the one place stripping is the
// whole point rather than a typo.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;

export function sanitizeText(value: unknown, maxLength = 20_000): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARS, "")
    .replace(ZERO_WIDTH, "")
    .slice(0, Math.max(0, maxLength))
    // Normalise Windows line endings so exported JSON is diff-friendly.
    .replace(/\r\n?/g, "\n");
}

export function sanitizeLine(value: unknown, maxLength = 280): string {
  return sanitizeText(value, maxLength).replace(/\s+/g, " ").trim();
}

export function sanitizeKey(value: unknown, maxLength = 64): string {
  return sanitizeLine(value, maxLength).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export function sanitizeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampNumber(value: unknown, min: number, max: number, fallback = min): number {
  const n = sanitizeNumber(value, fallback);
  return Math.min(max, Math.max(min, n));
}
