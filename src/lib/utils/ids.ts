let counter = 0;

/**
 * Collision-safe local id. Uses crypto.randomUUID when available and falls back
 * to a time+counter+random string so that a Layer still works in an insecure
 * context (http:// on a LAN, older browsers) where crypto.randomUUID is absent.
 */
export function createId(prefix?: string): string {
  const raw =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallbackId();
  return prefix ? `${prefix}_${raw}` : raw;
}

function fallbackId(): string {
  counter = (counter + 1) % 1_000_000;
  const random = Math.floor(Math.random() * 4_294_967_295).toString(36);
  return `${Date.now().toString(36)}${counter.toString(36)}${random}`;
}

/** Deterministic id for seeded/demo content so re-seeding is idempotent. */
export function stableId(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `${seed.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${hex}`;
}
