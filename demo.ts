/**
 * The bundled example content.
 *
 * Kept as plain data (not store logic) so it is trivially reviewable, and so
 * "Try an example" is obviously a seed rather than a hidden fake dataset. The
 * store tags everything it builds from this with `metadata.demo`, which the UI
 * renders as a "Sample" chip and uses to offer a one-click removal.
 *
 * Layout is spatial on purpose: three columns of thinking (left), execution
 * (middle) and references (right).
 */

import type { CardKind } from "@/lib/types";

export const DEMO_LAYER = {
  name: "Company Launch",
  description: "Everything needed to ship, in one place.",
  icon: "rocket",
  accent: "indigo",
} as const;

export type DemoCard = {
  kind: CardKind;
  title: string;
  x: number;
  y: number;
  width?: number;
  data?: Record<string, unknown>;
};

export const DEMO_CARDS: DemoCard[] = [
  {
    kind: "note",
    title: "Website",
    x: -360,
    y: -216,
    width: 340,
    data: {
      body: "Landing page copy, pricing table, and the waitlist form. The hero should answer \u201cwhat is this\u201d in one sentence.",
    },
  },
  {
    kind: "note",
    title: "Pricing",
    x: 40,
    y: -264,
    width: 320,
    data: {
      body: "Free: 1 layer.\nPro: $12/mo — unlimited layers, file attachments.\nTeams: later.\n\nDecide before the landing page ships.",
    },
  },
  {
    kind: "note",
    title: "Ideas",
    x: 420,
    y: -180,
    width: 280,
    data: {
      body: "Launch video as a Layer tour instead of a demo account. Record once, reuse forever.",
    },
  },
  { kind: "task", title: "Landing page copy", x: 40, y: 24, width: 320, data: { done: true } },
  { kind: "task", title: "Set up payment gateway", x: 40, y: 144, width: 320, data: { done: false, priority: "high" } },
  { kind: "task", title: "Record 90-second demo", x: 40, y: 264, width: 320, data: { done: false } },
  { kind: "task", title: "Draft launch post", x: 40, y: 384, width: 320, data: { done: false } },
  {
    kind: "link",
    title: "Competitor teardown",
    x: 420,
    y: 60,
    width: 300,
    data: {
      url: "https://www.producthunt.com",
      description: "How launch pages in this space explain themselves.",
    },
  },
  {
    kind: "link",
    title: "Design reference",
    x: 420,
    y: 252,
    width: 300,
    data: { url: "https://linear.app/method", description: "Calm, dense, keyboard-first." },
  },
  {
    kind: "note",
    title: "Launch checklist",
    x: -360,
    y: 72,
    width: 340,
    data: {
      body: "1. Pricing decided\n2. Waitlist email written\n3. Demo recorded\n4. Support inbox live\n5. Analytics (own, no vendor)\n6. Post to two communities",
    },
  },
  {
    kind: "note",
    title: "Research",
    x: -360,
    y: 348,
    width: 340,
    data: {
      body: "Interviewed six founders about launches. Recurring theme: the work lives across seven apps and nobody can find the latest decision.",
    },
  },
];
