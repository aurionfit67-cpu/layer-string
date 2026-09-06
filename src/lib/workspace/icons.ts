import { createElement } from "react";

import {
  BookOpen,
  Briefcase,
  Calendar,
  Compass,
  FileText,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Link2,
  ListChecks,
  Music,
  NotebookPen,
  Rocket,
  Target,
  Video,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";

/**
 * Named icon + accent keys instead of free-form strings, so a Layer's icon can
 * be persisted as data (and re-created by a future cloud sync) rather than as a
 * component reference.
 */
export const LAYER_ICONS = {
  rocket: Rocket,
  cap: GraduationCap,
  flask: FlaskConical,
  video: Video,
  globe: Globe,
  bulb: Lightbulb,
  briefcase: Briefcase,
  calendar: Calendar,
  music: Music,
  book: BookOpen,
  compass: Compass,
  target: Target,
} as const;

export type LayerIconKey = keyof typeof LAYER_ICONS;

export const LAYER_ICON_KEYS = Object.keys(LAYER_ICONS) as LayerIconKey[];

export const ACCENTS = ["slate", "indigo", "teal", "amber", "rose", "violet", "mint", "clay"] as const;
export type AccentKey = (typeof ACCENTS)[number];

export function isAccentKey(value: unknown): value is AccentKey {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}

export const CARD_ICONS: Record<string, LucideIcon> = {
  note: NotebookPen,
  task: ListChecks,
  link: Link2,
  image: ImageIcon,
  file: FileText,
};

export function layerIcon(name: string | undefined): LucideIcon {
  if (!name) return Layers;
  return LAYER_ICONS[name as LayerIconKey] ?? Layers;
}

export function cardIcon(kind: string | undefined): LucideIcon {
  if (!kind) return Layers;
  return CARD_ICONS[kind] ?? Layers;
}

export type GlyphProps = { size?: number; strokeWidth?: number; className?: string };

/**
 * Icons as components, not as lookups assigned mid-render: the resolved glyph
 * stays referentially stable, callers cannot accidentally memo the wrong thing,
 * and aria-hidden is applied in one place for all of them.
 */
export function LayerIcon({ icon, ...props }: GlyphProps & { icon: string | undefined }) {
  return createElement(layerIcon(icon), { "aria-hidden": true, focusable: false, ...props });
}

export function CardIcon({ kind, ...props }: GlyphProps & { kind: string }) {
  return createElement(cardIcon(kind), { "aria-hidden": true, focusable: false, ...props });
}
