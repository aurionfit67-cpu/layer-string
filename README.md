# LAYER

**A goal-centric workspace for everything you're doing.**

Most tools are organised around *sources* — a doc, a board, a chat, a bookmark folder. When you sit down to
actually do something, you pay for that: ten tabs open, half of them irrelevant. LAYER organises around the
**goal** instead. A *Layer* is one thing you are doing — "Company Launch", "Exam Preparation", "the video I keep
meaning to make" — and inside it you lay out the notes, tasks, links, images and files that goal needs, on a
canvas you can pan, zoom and think inside. Nothing else is on screen.

It is **local-first**: your Layers live in your browser's IndexedDB. There is no account, no server round-trip,
no API key, no telemetry. It runs offline after first load, and it deploys as a plain static-ish Next.js app.

```bash
npm install && npm run dev     # → http://localhost:3000
```

---

## Table of contents

- [What's in the MVP](#whats-in-the-mvp)
- [Running it](#running-it)
- [Deploying](#deploying)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Persistence, and how to swap in a backend](#persistence-and-how-to-swap-in-a-backend)
- [How the canvas stays fast](#how-the-canvas-stays-fast)
- [Safety and privacy](#safety-and-privacy)
- [Accessibility and keyboard](#accessibility-and-keyboard)
- [Testing](#testing)
- [Repository layout](#repository-layout)
- [Roadmap](#roadmap)
- [Licence](#licence)

---

## What's in the MVP

**Layers**
- Create, rename, describe, re-icon, re-colour, duplicate, delete (with a confirm that names the card count).
- Each Layer remembers its own camera — pan, zoom and view mode come back exactly as you left them.
- First-run onboarding offers two real actions: **Create your first Layer** or **Try an example** (the example is
  a normal, fully editable Layer tagged as sample data, deletable in one action).

**Cards** — five kinds, one shared frame
| Kind | What it is | Editing |
| --- | --- | --- |
| Note | Prose (≤ 20 000 chars). Rendered as text, never HTML. | autosaving textarea, auto-growing |
| Task | Done flag, due date, priority | checkbox on the card; date/priority in its menu |
| Link | A URL, with host and title derived from it | validated at render; unsafe schemes never become an `href` |
| Image | A real file, stored as a blob in IndexedDB | drop it or pick one; replace, open, alt text |
| File | Anything else, with size and caption | drop or pick, replace, download the original |

**The workspace**
- Drag anywhere; cards snap to the grid unless you hold <kbd>Alt</kbd>. Drag is imperative (DOM writes only) and
  commits **once**, on release — nothing is written to IndexedDB mid-gesture.
- Pan with empty canvas, wheel/trackpad, or two fingers; pinch to zoom on touch.
- Zoom `+` / `-`, 100% `0`, fit `1`; a live zoom badge; a "frame this card" action from search and the palette.
- Resize card width by dragging the bottom-right corner; the model clamps to 220–640 px.
- Every per-card action lives in one menu — edit, duplicate, bring to front, copy link, set due date, delete.
  Each is undoable with <kbd>⌘</kbd><kbd>Z</kbd>, and the toast after a delete carries Undo too.
- **List view** is a first-class mode, not a mobile afterthought: the same cards and the same editing, stacked.
  A Layer whose view has never been chosen opens as a list on coarse pointers and as a canvas everywhere else;
  once you pick one (header menu or <kbd>V</kbd>) that choice is saved on the Layer.

**Finding things**
- <kbd>⌘K</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> command palette: commands *and* fuzzy results in one box. Type `>`
  for commands only.
- <kbd>⌘⇧F</kbd> search across Layer names, descriptions, card titles, bodies, URLs, image alt text and file
  names, with matched ranges highlighted and a jump-that-frames-the-card.
- Filtering the Layer grid by name/description/title on `/layers`.

**Everyday correctness**
- Autosave everywhere; there is no save button and no dirty state.
- Toast with **Undo** after destructive actions; a polite live region for screen readers.
- If IndexedDB refuses a write (quota, private mode, corrupt DB), a banner says so and offers *Retry* — and a
  successful later write clears it automatically. LAYER never claims a save it did not get.
- Dark / light / system theme with no first-paint flash; reduced-motion honoured app-wide.
- Export `layer-backup.json` (optionally with attachments), validated import with a preview, merge or replace, and
  a reset that says exactly what it will delete.

### What is deliberately not here

Auth, teams, comments, sharing, payments, a cloud database, notifications, an AI feature, analytics, integrations.
Not because they're unwanted — because they need an account and a server, which is the thing this MVP refuses.
The seams for them are named in the [roadmap](#roadmap).

---

## Running it

Requirements: **Node 20+** (Node 22 is fine) and npm.

```bash
npm install
npm run dev        # http://localhost:3000 — turbopack dev server
```

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with fast refresh. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `noUnusedLocals`). |
| `npm run lint` | ESLint (Next core-web-vitals + TS + the React compiler rules). |
| `npm run check` | typecheck → lint → build. This is the gate. |
| `npm run smoke` | 41 functional checks of the data layer in Node — see [Testing](#testing). |

No environment variables are required. `.env.example` documents two optional, cosmetic, build-time values.

**Try this order** (it is the whole product in 60 seconds): create a Layer → press <kbd>N</kbd> for a note, type,
click away → <kbd>⌘⇧F</kbd> and search a word you typed → <kbd>1</kbd> to fit → drag a card, refresh the page →
Settings → Export → Settings → Reset → import the file you just exported.

---

## Deploying

### Vercel (one command)

```bash
npm i -g vercel
vercel        # link, then: vercel --prod
```

Or push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new) — framework detection, install
and build settings are all defaults, because `next build` is the build command and there is nothing to configure.
**No environment variables, no secrets, no server credentials.**

Routes are: `/`, `/layers`, `/settings` (prerendered static) and `/layers/[id]` (server-rendered on demand — it
takes a runtime parameter). That's the whole footprint.

### Static hosting / GitHub Pages

`/layers/[id]` is a dynamic route, so `output: "export"` is not used. If you must host on GitHub Pages or a plain
file server, either:

1. point a catch-all rewrite at `/index.html` (`{ "rewrites": [{ "source": "/:path*", "destination": "/index.html" }] }`)
   and set `basePath`/`assetPrefix` to the repo name, or
2. drop the deep link and keep home + settings, which are already static.

The app itself needs no server at runtime: everything after the first document is a client-side call to
IndexedDB.

### After deploying

Open the URL, do the 60-second tour above, then reload. If the reload comes back with your cards where you left
them, the deployment is working. Data is per-browser and per-origin — clearing site data clears the workspace
(export first).

---

## Architecture

```
┌── routes (src/app) ────────────────────────────────────────────────┐
│ /            hero + My Layers grid + first-run onboarding          │
│ /layers      the list, filterable and sortable                     │
│ /layers/[id] <LayerWorkspace> — the product                        │
│ /settings    appearance · workspace · data (export/import/reset)   │
└───────────────┬────────────────────────────────────────────────────┘
                │ useAppState(selector) / useStore()
┌───────────────▼────────────────────────────────────────────────────┐
│ src/lib/state/store.ts   one LayerStore per tab                      │
│   · synchronous in-memory mutation → immediate UI                  │
│   · dirty sets + 400 ms debounce → one batched write               │
│   · undo stack, toasts, overlay routing, media requests, demo seed  │
├────────────────────────────────────────────────────────────────────┤
│ src/lib/state/{selectors,demo,data}.ts   derived reads + journeys   │
└───────────────┬────────────────────────────────────────────────────┘
                │ Repository interface only
┌───────────────▼────────────────────────────────────────────────────┐
│ src/lib/storage/                                                   │
│   repository.ts   snapshots, media GC, write queue, usage, flush    │
│   normalize.ts    lenient readers: repair or drop, never throw      │
│   transfer.ts     export file, import plan, validation, merge/replace│
│   indexeddb.ts · localstorage.ts · memory.ts   ← NamespacedStore ×3  │
└────────────────────────────────────────────────────────────────────┘

┌── components/workspace ────────────────────────────────────────────┐
│ workspace-canvas.tsx  owns the Camera and every pointer gesture;    │
│                       exposes WorkspaceApi through context           │
│ card-shell.tsx        placement, drag handle, resize, menu, focus    │
│ card-view.tsx         memoised, wrapped in a per-card ErrorBoundary  │
│ cards/*               five small bodies — the only type-specific UI  │
└────────────────────────────────────────────────────────────────────┘
```

Three rules hold the whole thing together:

1. **The store owns data, the canvas owns the view.** Card positions live in the model; the camera never does.
   Measured heights live in a `Map` inside the canvas, never in React state — they are derived, not data.
2. **Nothing renders because of a gesture.** During a drag the canvas mutates the DOM node directly; on release it
   calls `store.moveCard()` exactly once. That single commit triggers one React pass and one debounced write.
3. **The UI only knows `Repository`.** No component imports `idb`, no component knows whether storage is
   IndexedDB, localStorage or memory. `lib/storage/client.ts` decides that once, in one place.

---

## Data model

Defined in `src/lib/types/*`. Every field below is real; nothing is written that isn't read somewhere.

```ts
Layer {
  id: string;                    // "lyr_" + crypto.randomUUID()
  name: string;                  // ≤ MAX_NAME (120), trimmed
  description?: string;          // ≤ MAX_DESCRIPTION (280)
  icon?: string;                 // named key: "rocket" | "cap" | "target" | … (12 of them)
  accent?: string;               // named key: "slate" | "indigo" | "teal" | "amber" | "rose" | "violet" | "mint" | "clay"
  viewport?: { x; y; scale; mode: "canvas" | "list" };   // the camera, per Layer
  createdAt: number; updatedAt: number; lastOpenedAt?: number;
  metadata: { source?: "manual" | "demo" | "import"; demo?: boolean; [k: string]: unknown };
}

CardPosition { x: number; y: number; width?: number; height?: number; z?: number }

Card = NoteCard | TaskCard | LinkCard | ImageCard | FileCard   // discriminated on `kind`
BaseCard {                                   // every variant adds `kind` and `data`
  id: string;                                // "crd_" + crypto.randomUUID()
  layerId: string;
  title: string;                             // ≤ MAX_TITLE (160)
  position: CardPosition;
  createdAt: number; updatedAt: number;
  metadata: CardMetadata;                    // { source?; demo?; [k]: unknown }
}

NoteCard.data  { body: string }
TaskCard.data  { done: boolean; dueAt: number /* 0 = none */; priority: "none" | "low" | "high" }
LinkCard.data  { url: string; description: string }
ImageCard.data { mediaId; name; mime; size; width; height; alt }
FileCard.data  { mediaId; name; mime; size; caption }

WorkspaceState = Layer["viewport"]            // stored on the Layer, not per-card
Settings {
  theme: "light" | "dark" | "system";
  motion: "system" | "full" | "reduced";
  snapToGrid: boolean; gridSize: number; showCardMeta: boolean;
  onboarded: boolean; version: number;   // SCHEMA_VERSION, currently 1
}
```

Two naming notes, because they're both intentional:

- The spec called the discriminator **`type`**; it is implemented as **`kind`**, because `type` is a reserved word
  in some tooling and reads worse in `isCardKind(kind)`. Renaming it would be a schema change (see
  `SCHEMA_VERSION`), so it is documented rather than churned.
- Media is **not** inlined in the card. Image and file cards hold a `mediaId` pointing at a record in the
  `media` namespace, so a card stays small enough to keep in memory and to index for search.
  `repository.ts` garbage-collects orphaned blobs on delete, on import-replace and on reset.

Demo content uses `stableId(seed)` instead of a random UUID, which is why "Try an example" is idempotent:
seeding twice re-uses one Layer rather than stacking copies, and deleting it is a single action.

Timestamps are epoch milliseconds (not ISO strings) because they are compared and sorted constantly; `dueAt: 0`
means "no date" so the field never has to be optional in the UI.

---

## Persistence, and how to swap in a backend

`lib/storage/types.ts` is the whole contract:

```ts
type NamespacedStore = {
  kind: StorageInfo["kind"];   // "indexeddb" | "localstorage" | "unavailable"
  init(): Promise<void>;
  read<T>(namespace, key): Promise<T | undefined>;
  list<T>(namespace): Promise<T[]>;
  write(namespace, key, value): Promise<void>;
  writeMany(namespace, entries): Promise<void>;
  remove(namespace, key): Promise<void>;
  removeMany(namespace, keys): Promise<void>;
  clear(namespace): Promise<void>;
  estimateUsage(): Promise<number | null>;
  close?(): void;
};
```

Adapters: `indexeddb.ts` — one `records` object store keyed `"<namespace>:<id>"` across the four namespaces
(`layers`, `cards`, `media`, `kv`), real transactions, and structured clone, so image bytes go in as an
`ArrayBuffer` instead of inflated base64. `localstorage.ts` — JSON per key, used when IndexedDB is blocked.
`memory.ts` — volatile, used when both are refused and by the smoke test; it reports its kind as `unavailable`,
which is what the banner reads.
`createRepository(store, info)` builds the domain-shaped API the application consumes — `info`, `ready()`,
`loadSnapshot()`, `saveLayer`, `deleteLayer` (cascades that Layer's cards *and* their media), `saveCards`,
`deleteCards`, `saveSettings`, `saveFlag` / `loadFlag`, `putMedia`, `getMedia`, `deleteMedia`, `replaceAll`,
`mergeInto`, `wipe`, `estimateUsageBytes`, plus `flush()`, which the returned type adds — and it owns the two
behaviours the UI depends on: normalising everything on read, and marking `info.writable` false when a write
fails (then clearing it when one later succeeds).
when one succeeds).

**To put a database behind this**, you do not touch `src/components` or `src/lib/state/store.ts`. Two options:

1. Write a fourth `NamespacedStore` (a REST or Supabase client, keyed by namespace) and add it to
   `chooseStore()` in `client.ts`. You get sync for free, at the granularity the app already uses.
2. Implement `Repository` directly (`lib/storage/types.ts`) with row-level RLS and an `onSnapshot` subscription,
   then `mergeInto` becomes the conflict-free import path. Realtime then means "call `applySnapshot` when rows
   change" — the store already has that method for exactly this reason.

Account/identity would live in `Layer.metadata` and `Card.metadata` (`{ ownerId, sharing }`), which are already
open records that survive export, import and normalisation. Cross-device sync needs one more thing that isn't here
yet: a `deletedAt` tombstone per record, so deletes propagate. Card `id`s are minted once and never reused, so
`updatedAt`-wins is enough to start with.

---

## How the canvas stays fast

- One transformed `<div>` ("world") holds every card; the camera writes `translate3d(...)` + `scale()` to it in a
  single frame, plus two CSS custom properties for the dot grid so parallax costs no JS.
- Wheel and touch handlers are **non-passive** and `preventDefault` themselves; the gesture state lives in refs on
  `document`, not in React state, so panning at 120 Hz re-renders nothing.
- Card heights are measured by one `ResizeObserver` per card and reported imperatively; heights feed "fit",
  hit-testing and the grid preview but never the model.
- Viewport persistence is debounced 320 ms *after the camera settles*, so panning doesn't write per frame, and a
  Layer's saved camera is not clobbered by a half-finished gesture.
- `useAppState(selector)` re-renders on a store change, and `CardView` is memoised on its `Card` object, so an
  edit to one card doesn't re-render the other forty. Search and the palette run over in-memory records only.
- Off-screen cards are cheap: they're absolutely positioned in one composited layer, and only what's in the
  Every card mounts once and stays mounted: they are absolutely positioned inside one composited layer, so an
  off-screen card costs layout, not layout *and* paint. `geometry.cardsInViewport` is the seam a real culling
  pass would use; at the sizes LAYER aims for (tens of cards, not thousands) unmounting on scroll would trade a
  little memory for jank.
Those are structural choices, not a benchmark — no profiling run is claimed here. What can be stated exactly is
what the code does *not* do between pointer-down and pointer-up of a drag: no React render, no store write, no
IndexedDB call. After release there is one `set()` and at most one debounced write batch.

---

## Safety and privacy

- **No secrets, ever.** Nothing reads a server-side env var; there is no API route at all. `NEXT_PUBLIC_*` is
  used for two cosmetic strings (version, canonical origin) — see `.env.example`, which says why secrets can't go
  there.
- **URLs.** `lib/utils/url.ts` is the single gate: only `http:`, `https:`, `mailto:` and `tel:` survive; leading
  slashes are refused so a path can't become a host; `javascript:`/`data:`/`vbscript:` never reach an `href`.
  Every external anchor carries `rel="noopener noreferrer nofollow"` with `target="_blank"` (the image
  preview's own link uses `noopener noreferrer`), and the `rel` is written next to the `href` it protects.
- **Markup.** Titles, note bodies and file names are rendered as text — never as HTML and never through
  `dangerouslySetInnerHTML`. The only use of it in the repository is the root layout's theme script, whose string
  is a compile-time constant with nothing interpolated into it. Control and zero-width characters are stripped on
  write (`lib/utils/sanitize.ts`), and every string field is length-capped at the edge (`MAX_TITLE`, `MAX_BODY`, …).
  string field is length-capped at the edge (`MAX_TITLE`, `MAX_BODY`, `MAX_NAME`, …).
- **Import is untrusted input.** `parseBackup` size-checks, JSON-parses, requires the LAYER header (or warns that it
  inferred one), refuses a newer schema version, and normalises *every record* — bad ones are dropped and counted.
  The UI shows a preview (counts + warnings) before anything is written, and "replace" only after you confirm what
  it will delete.
- **Uploads.** Images and files become blobs in IndexedDB behind a size cap (25 MB / 32 MB) with an explicit
  "too large" path; images are decoded to read their intrinsic size and a failed decode still yields a usable card.
- **Storage honesty.** If a write fails you see it in the banner and in the toast. No optimistic "Saved".

---

## Accessibility and keyboard

- Everything reachable by keyboard: cards have a focusable drag handle (<kbd>↑↓←→</kbd> nudge,
  <kbd>Shift</kbd>+arrows for 1 px, <kbd>Enter</kbd> to edit, <kbd>Delete</kbd> to remove); the palette and search
  are roving-focus lists with `role="option"`; menus are real radio/listbox-ish menus with arrow navigation.
- Modals are native `<dialog>`: focus trap, `Escape`, backdrop click and restored focus come from the platform.
- One polite live region (`role="status"`) announces toasts and save failures, and a destructive confirmation
  renders as `role="alertdialog"` so it interrupts rather than waits its turn.
- The palette and search are `listbox`/`option` lists with roving focus; card and Layer menus are `menu`/`menuitem`
  with arrow, <kbd>Home</kbd> and <kbd>End</kbd> navigation; every segmented control is a real `radiogroup`.
- Visible focus on everything (`:focus-visible` rings tuned per surface); on coarse pointers the hover-only
  affordances (drag handle hints, resize grip, per-card menu) are replaced by always-visible ones, which is what
  the `precise` flag threaded through the workspace is for.
- `prefers-reduced-motion` is respected *and* user-overridable in Settings; when reduced, the camera settles
  instantly and card/menu/dialog transitions collapse.
- Labels are real `<label>`s or `aria-label`s; icons are `aria-hidden` and never the only signal (card kinds carry
  a text label, task states carry text as well as a checkbox).
- `⌘K` / `?` / `N` / `T` / `V` / `1` / `0` / `+` / `-` / `D` / <kbd>⌘Z</kbd> are the whole surface — see
  Settings → Keyboard, which renders the same list the code implements (`lib/utils/shortcuts.ts` is the single
  source of truth, so the help can't drift from the behaviour).

---

## Testing

```bash
npm run check     # typecheck + lint + production build   (must be clean: it is)
npm run smoke     # 41 functional checks of the data layer
```

`scripts/smoke.mjs` compiles `src/lib` with the project's own TypeScript and drives the **real store against the
real repository** (a memory adapter, so it's deterministic) in Node. It covers the journeys that must never break:

- create Layer → add note → edit (autosave) → move → **reload from disk** and read it back, positions included
- per-Layer viewport round-trip; task toggling; delete → undo → still on disk; deleting a Layer cascades its cards
- export → parse → import into an empty browser (replace) and into a populated one (merge); single-Layer export
- six hostile inputs rejected with a human-readable `ImportError`; a headerless-but-readable file accepted *with a
  warning*; one malformed card among good ones — repaired, counted, and never fatal
- normalisation: over-long titles capped, `NaN`/string coordinates repaired, widths clamped, timestamps repaired,
  nameless Layers refused
- `safeExternalUrl` refusing `javascript:`, `data:`, backslash and root-relative paths while completing `example.com`
- search: term coverage, ranking (exact before scattered), highlight ranges that rebuild the original string
- geometry: bounds, viewport hit-testing, the Layer preview's normalised layout, `fitTo` containing everything
- storage failure paths: an unusable store yields a fatal state, not a crash; a failed write sets the
  "not saving" flag and a later success clears it
- base64 round-trip for stored media

**What it cannot cover, and does not claim to:** anything needing a browser — real pointer drags, wheel/pinch
zoom, focus behaviour, IndexedDB quota prompts, visual layout. That's [manual, below](#manual-pass). Unit tests
for components are deliberately not included: this repo keeps its logic in `lib/`, where the smoke test can reach
it without pulling in a browser stack as a dependency.

### Manual pass (the journey the spec asks for)

Do it once after any change to `workspace-canvas.tsx`, `store.ts` or `transfer.ts`:

1. New Layer → add note → type → click away (no save button) → refresh → text is there.
2. Drag a card, note the position, refresh → same position. Hold <kbd>Alt</kbd> → off-grid placement survives.
3. Task: check it off, set a due date in its menu → overdue cards read red after the day ends.
4. Link: paste `example.com` → clickable. Paste `javascript:alert(1)` → shown as text, never a link.
5. Image: drop a PNG → it renders; drop a 500 MB file → refused with a clear message, card still usable.
6. <kbd>⌘⇧F</kbd> → search a word inside a note → jump → the camera centres on it and it flashes.
7. Settings → Export → download; Reset → gone; Import (merge) → everything back, positions included.
8. DevTools → Application → "Clear site data", then reload: empty list, no errors.
9. Private window / storage blocked: banner appears, app still works, nothing claims "saved".
10. Mobile (or DevTools touch emulation): a Layer you never switched opens in **list** mode, pinch zooms the
    canvas, the add bar collapses into one pill, and nothing depends on hover.

---

## Repository layout

```
next.config.ts        minimal: no telemetry-dependent options, no custom webpack
eslint.config.mjs     flat config: next/core-web-vitals + TS + React compiler rules
tsconfig.json         strict + noUncheckedIndexedAccess + noUnusedLocals, @/* → src/*
public/               manifest.webmanifest, PNG icons
scripts/smoke.mjs     the Node harness described above
src/app/              routes + globals.css (Tailwind v4 tokens, .dark overrides)
src/components/
  ui/                 button, field, modal(<dialog>), menu, segmented, switch, combo,
                      confirm, error-boundary, misc primitives — no app knowledge
  workspace/          canvas + camera + cards: the spatial half of the product
  cards/              one file per card kind, plus the file-drop and media-pick UI
  overlays/           command palette, search, shortcuts, Layer dialog
  layers/             Layer card (with a real spatial thumbnail) and the grid
  layout/             app shell, hotkeys, toasts, storage banner, top bar, footer
  sheets/             first-run onboarding
src/hooks/            theme, media query, media URL, dismiss, roster
src/lib/
  types/              Layer, Card union, layout, Settings  ← the contract everything obeys
  utils/              ids, format, url, clipboard, sanitize, fuzzy, shortcuts, cn
  storage/            adapters, repository, normalize, transfer, client
  workspace/          camera.ts, geometry.ts, icons.ts
  state/              store.ts (the only mutable model), selectors, demo, data, provider
```

Styling is Tailwind v4 with a small token layer in `globals.css` (`--canvas`, `--ink`, `--line`, eight accents,
two radii, three shadows). Dark mode is a `.dark` class on `<html>`, applied before first paint by an inline
script from `localStorage`. There is no UI kit dependency: `components/ui/*` is ~700 lines in ten files, sized to
what this app needs — a `<dialog>`, a menu, a segmented control, an auto-growing field — and nothing else.

---

## Roadmap

Ordered by what LAYER needs to stay honest, not by what demos best.

1. **Attachments in exports are optional and bulky.** A `layer-backup.json` with media is base64-heavy; a
   `.layerpkg` (zip with a `manifest.json`) would fix that without touching the model.
2. **Tombstones + a sync adapter.** `deletedAt` per record, a `NamespacedStore` over a REST/Supabase endpoint, and
   `updatedAt`-wins; the interface is already the right shape for it.
3. **Accounts.** A `userId` on `Layer.metadata`, RLS policies per user, and a "connect" flow in Settings. Nothing
   in the UI has to change.
4. **Collaboration.** Presence and CRDT positions would live in the canvas (positions are the only contested
   field), which is why camera and drag are already imperative rather than React state.
5. **AI on Layer context.** The prompt is `Layer + its cards`, which the store can already serialise
   (`exportSingleLayer`). What's missing is a provider and a place to put a result — deliberately not stubbed, so
   there is no half-built feature to pretend about.
6. **Integrations** (import from Notion/Trello/Marvel-of-the-week) belong in `transfer.ts` as additional parsers:
   the import pipeline already validates, normalises and reports per record.
7. Nice-to-haves with a clear home: card templates, a "today" Layer filter, per-card colours, multi-select and
   group-drag, thumbnails for PDFs, a `layer://` deep-link handler for the OS.

---

## Licence

MIT — see [LICENSE](./LICENSE).
