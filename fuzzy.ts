/**
 * Tiny, dependency-free matchers for the command palette and search.
 *
 * Two flavours are needed: substring (search: users type words they remember)
 * and subsequence (palette: users type initials like "nl" for "New Layer").
 */

export function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export type Match = { start: number; end: number };

/** All substring hits for each term; empty terms return no ranges. */
export function substringMatches(query: string, text: string): Match[] {
  const haystack = normalize(text);
  const terms = normalize(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0 || haystack.length === 0) return [];
  const ranges: Match[] = [];
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const start = haystack.indexOf(term, from);
      if (start < 0) break;
      ranges.push({ start, end: start + term.length });
      from = start + term.length;
      if (ranges.length > 40) return ranges;
    }
  }
  return mergeRanges(ranges);
}

function mergeRanges(ranges: Match[]): Match[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Match[] = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else out.push({ ...range });
  }
  return out;
}

/** Subsequence score: 0 when it does not match, higher when it matches tightly. */
export function subsequenceScore(query: string, text: string): number {
  const needle = normalize(query).replace(/\s+/g, "");
  const haystack = normalize(text);
  if (!needle) return 1;
  if (haystack.includes(needle)) return 1_000 - haystack.indexOf(needle) * 4;
  let score = 0;
  let cursor = -1;
  let gapPenalty = 0;
  for (const character of needle) {
    const found = haystack.indexOf(character, cursor + 1);
    if (found < 0) return 0;
    if (cursor >= 0 && found > cursor + 1) gapPenalty += (found - cursor - 1) * 2;
    if (found === 0 || haystack[cursor] === " ") score += 12; // word start bonus
    cursor = found;
  }
  return Math.max(1, 200 - gapPenalty - cursor + score);
}

/** Terms must all be present; proximity and position decide the score. */
export function termScore(query: string, text: string, weight = 1): number {
  const terms = normalize(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) return 0;
  const haystack = normalize(text);
  let score = 0;
  let last = -1;
  for (const term of terms) {
    const at = haystack.indexOf(term);
    if (at < 0) return 0;
    score += 60 - Math.min(50, at);
    if (at === 0) score += 30;
    if (last >= 0 && Math.abs(at - last) < term.length + 12) score += 15;
    last = at;
  }
  return score * weight;
}

export function splitHighlighted(text: string, matches: Match[]): Array<{ text: string; hit: boolean }> {
  if (matches.length === 0) return [{ text, hit: false }];
  const parts: Array<{ text: string; hit: boolean }> = [];
  let index = 0;
  for (const match of matches) {
    if (match.start > index) parts.push({ text: text.slice(index, match.start), hit: false });
    parts.push({ text: text.slice(match.start, match.end), hit: true });
    index = match.end;
  }
  if (index < text.length) parts.push({ text: text.slice(index), hit: false });
  return parts;
}
