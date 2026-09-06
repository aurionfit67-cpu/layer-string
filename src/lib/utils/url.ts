const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Returns a URL that is safe to render as an href, or null.
 *
 * Only http(s)/mailto/tel survive: javascript:, data:, file:, blob: and every
 * other scheme is refused here rather than at render time, so no component can
 * forget to check. One convenience is deliberate: a bare "example.com" is read
 * as a website, because that is what people paste. Anything starting with a
 * slash or backslash is a *path*, not a site, and is refused — otherwise the URL
 * parser happily turns "/notes" into a host called "notes", and "//host" or
 * "\\host" into a cross-origin link the user never typed a scheme for.
 */
export function safeExternalUrl(input: string | undefined | null): string | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw || raw.length > 2048 || /\s/.test(raw)) return null;
  if (raw.startsWith("/") || raw.startsWith("\\")) return null;
  let url: URL;
  try {
    // Accept "example.com" as a convenience; a scheme is required for the rest.
    const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw) ? raw : `https://${raw}`;
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!SAFE_PROTOCOLS.has(url.protocol)) return null;
  // A scheme was synthesised above, so an empty host is always malformed.
  // (localhost/127.0.0.1 stay allowed: LAYER runs on developer machines too.)
  if ((url.protocol === "http:" || url.protocol === "https:") && !url.hostname) return null;
  return url.toString();
}

export function isValidUrl(input: string | undefined | null): boolean {
  return safeExternalUrl(input) !== null;
}

export function urlLabel(input: string): string {
  const safe = safeExternalUrl(input);
  if (!safe) return input ?? "";
  try {
    const url = new URL(safe);
    return url.hostname.replace(/^www\./, "") + (url.pathname === "/" ? "" : url.pathname);
  } catch {
    return safe;
  }
}

export function urlHost(input: string): string {
  const safe = safeExternalUrl(input);
  if (!safe) return "";
  try {
    return new URL(safe).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isExternal(input: string): boolean {
  const safe = safeExternalUrl(input);
  if (!safe) return false;
  try {
    const url = new URL(safe);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
