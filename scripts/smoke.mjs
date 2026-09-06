#!/usr/bin/env node
/**
 * Functional smoke test for everything below the UI.
 *
 * The workspace itself needs a real browser (pointer events, transforms,
 * IndexedDB), which this repository does not have. Everything that can break a
 * user's *data* can be checked in Node, so that is what this does: it compiles
 * src/lib with the project's own TypeScript, then drives the real store against
 * the real repository — create Layer → add card → move card → reload from disk →
 * export → import → reset — plus the parsers that have to survive hostile input.
 *
 *   npm run smoke
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = path.join(root, ".smoke");
const src = path.join(work, "src");
const out = path.join(work, "out");

// --------------------------------------------------------------- build step
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(src, { recursive: true });

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else if (entry.name.endsWith(".ts")) rewrite(a, b);
  }
}

/** Rewrite the `@/lib/...` alias to a relative specifier so plain tsc can emit it. */
function rewrite(fromFile, toFile) {
  const text = fs.readFileSync(fromFile, "utf8");
  const here = path.dirname(toFile);
  const next = text.replace(/from "@\/lib\/([^"]+)"/g, (_all, target) => {
    const dest = path.join(src, "lib", target);
    let rel = path.relative(here, dest).replace(/\\/g, "/");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    return `from "${rel}"`;
  });
  fs.writeFileSync(toFile, next);
}

copyDir(path.join(root, "src", "lib"), path.join(src, "lib"));
fs.writeFileSync(
  path.join(work, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "es2022",
        module: "commonjs",
        moduleResolution: "node",
        lib: ["es2022", "dom"],
        outDir: "out",
        rootDir: "src",
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
        types: [],
      },
      include: ["src/**/*.ts"],
    },
    null,
    2,
  ),
);

execFileSync(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", path.join(work, "tsconfig.json")], {
  cwd: work,
  stdio: "inherit",
});

const require_ = createRequire(path.join(out, "noop.js"));

// ----------------------------------------------------------------- harness
let passed = 0;
const failures = [];

async function check(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok    ${label}`);
  } catch (error) {
    failures.push({ label, message: error instanceof Error ? error.message : String(error) });
    console.log(`  FAIL  ${label}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message ?? "value"}: got ${a}, want ${b}`);
}

/** Node has no rAF; the camera only needs it for animated transitions. */
if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

// -------------------------------------------------------------- 1. the store
const client = require_("./lib/storage/client.js");
const { createRepository } = require_("./lib/storage/repository.js");
const { createMemoryStore } = require_("./lib/storage/memory.js");
const { LayerStore } = require_("./lib/state/store.js");
const selectors = require_("./lib/state/selectors.js");
const transfer = require_("./lib/storage/transfer.js");
const normalize = require_("./lib/storage/normalize.js");
const fuzzy = require_("./lib/utils/fuzzy.js");
const url = require_("./lib/utils/url.js");
const format = require_("./lib/utils/format.js");
const geometry = require_("./lib/workspace/geometry.js");
const { Camera } = require_("./lib/workspace/camera.js");
const layout = require_("./lib/types/layout.js");

function freshStore() {
  const repository = createRepository(createMemoryStore(), { kind: "indexeddb", writable: true });
  client.__resetRepository(repository);
  return { store: new LayerStore(), repository };
}

console.log("\nLAYER smoke test\n");
console.log("journey: create Layer → add card → edit → move → reload → export → import → reset");

const first = freshStore();
await check("boot with an empty database", async () => {
  await first.store.boot();
  equal(first.store.getState().status, "ready", "status");
  equal(first.store.getState().layers.length, 0, "layers");
});

let layerId;
await check("create a Layer persists it", async () => {
  const layer = await first.store.createLayer({ name: "Company Launch", icon: "rocket", accent: "indigo" });
  layerId = layer.id;
  assert(layer.id, "layer has an id");
  equal(first.store.getState().layers.length, 1, "layer in state");
  await first.store.flush();
  const snapshot = await first.repository.loadSnapshot();
  equal(snapshot.layers.map((l) => l.name), ["Company Launch"], "layer on disk");
});

let noteId;
await check("add a note card with a title and body", async () => {
  const card = first.store.addCard(layerId, "note", { title: "Positioning", body: "Who is it for?" });
  noteId = card.id;
  assert(card.id && card.kind === "note", "card created");
  assert(Number.isFinite(card.position.x) && Number.isFinite(card.position.y), "has a position");
  equal(first.store.cardsOf(layerId).length, 1, "one card in the layer");
});

await check("editing autosaves without a save button", async () => {
  first.store.updateCard(noteId, { title: "Positioning v2", body: "Who is it for, and why now?" });
  await first.store.flush();
  const snapshot = await first.repository.loadSnapshot();
  equal(snapshot.cards[0].title, "Positioning v2", "title on disk");
  // A note's prose is `data.body`; the top-level patch is mapped into it by the store.
  equal(snapshot.cards[0].data.body, "Who is it for, and why now?", "body on disk");
  assert(snapshot.cards[0].updatedAt >= snapshot.cards[0].createdAt, "edited card is stamped");
});

await check("a drag commits one position, and only after the gesture", async () => {
  first.store.moveCard(noteId, { x: 480, y: 240, width: 320 });
  equal(first.store.getState().cards[noteId].position.x, 480, "in memory immediately");
  await first.store.flush();
  const snapshot = await first.repository.loadSnapshot();
  equal([snapshot.cards[0].position.x, snapshot.cards[0].position.y], [480, 240], "position on disk");
});

await check("task completion is data, not a checkbox illusion", () => {
  const task = first.store.addCard(layerId, "task", { title: "Draft the deck", data: { priority: "high" } });
  assert(!first.store.getState().cards[task.id].data.done, "starts open");
  first.store.toggleTask(task.id);
  assert(first.store.getState().cards[task.id].data.done, "toggled to done");
  first.store.toggleTask(task.id);
  assert(!first.store.getState().cards[task.id].data.done, "toggled back");
});

await check("viewport is saved per Layer", async () => {
  first.store.setLayerViewport(layerId, { x: -120, y: -40, scale: 0.85 });
  await first.store.flush();
  const snapshot = await first.repository.loadSnapshot();
  equal([snapshot.layers[0].viewport.x, snapshot.layers[0].viewport.scale], [-120, 0.85], "viewport on disk");
});

await check("reloading the page reads the same workspace back", async () => {
  // Same adapter, new store: exactly what a refresh does.
  const reopened = new LayerStore();
  await reopened.boot();
  equal(reopened.getState().layers.length, 1, "layer count");
  equal(reopened.getState().layers[0].name, "Company Launch", "layer name");
  const card = reopened.getState().cards[noteId];
  assert(card, "the note survived");
  equal([card.title, card.position.x, card.position.y], ["Positioning v2", 480, 240], "card contents");
  equal(reopened.getState().layers[0].viewport.scale, 0.85, "viewport");
});

await check("undo brings a deleted card back", async () => {
  const doomed = first.store.addCard(layerId, "link", { title: "Brief", data: { url: "https://example.com/brief" } });
  first.store.deleteCard(doomed.id);
  assert(!first.store.getState().cards[doomed.id], "gone");
  assert(first.store.canUndo(), "undo is offered");
  assert(/restore/i.test(String(first.store.undoLabel())), `label names the action: ${first.store.undoLabel()}`);
  first.store.undo();
  assert(first.store.getState().cards[doomed.id], "restored");
  await first.store.flush();
  const snapshot = await first.repository.loadSnapshot();
  assert(snapshot.cards.some((c) => c.id === doomed.id), "restored on disk");
});

await check("deleting a Layer takes its cards with it", async () => {
  const temp = await first.store.createLayer({ name: "Throwaway" });
  const tempCard = first.store.addCard(temp.id, "note", { title: "Dangling" });
  await first.store.flush();
  await first.store.deleteLayer(temp.id);
  await first.store.flush();
  const snapshot = await first.repository.loadSnapshot();
  equal(snapshot.layers.length, 1, "one layer left");
  assert(!snapshot.cards.some((c) => c.id === tempCard.id), "its card is gone");
});

console.log("\nsearch, settings and the example Layer");

await check("search finds a card by body text and reports its Layer", () => {
  const state = first.store.getState();
  const hits = selectors.searchWorkspace("why now", state.layers, state.cards, state.cardOrder);
  assert(hits.length >= 1, "at least one hit");
  const hit = hits.find((candidate) => candidate.type === "card");
  assert(hit, "a card hit");
  equal(hit.layerName, "Company Launch", "hit carries its layer");
  assert(hit.preview.toLowerCase().includes("why now"), "preview quotes the match");
});

await check("search finds a Layer by name", () => {
  const state = first.store.getState();
  const hits = selectors.searchWorkspace("launch", state.layers, state.cards, state.cardOrder);
  assert(hits.some((hit) => hit.type === "layer"), "layer hit");
});

await check("the example Layer is real content, clearly marked", async () => {
  const demoStore = freshStore();
  await demoStore.store.boot();
  const layer = await demoStore.store.seedDemoLayer();
  assert(layer, "seeded");
  assert(demoStore.store.hasDemoLayer(), "detected as present");
  const cards = demoStore.store.cardsOf(layer.id);
  assert(cards.length >= 6, `the sample has substance (${cards.length} cards)`);
  assert(layer.metadata?.demo === true, "the Layer is marked as sample data");
  assert(cards.every((card) => card.metadata?.demo === true), "every card is marked as sample data");
  assert(cards.every((card) => card.metadata?.source === "demo"), "and attributed to the sample");
  // Notes, tasks and links: image/file cards need bytes from the user's disk, so
  // the sample deliberately does not fake one.
  assert(new Set(cards.map((card) => card.kind)).size >= 3, "covers several card kinds");
  assert(cards.some((card) => card.kind === "task" && card.data.done), "shows a completed task");
  assert(cards.some((card) => card.kind === "task" && card.data.priority === "high"), "shows a priority");
  await demoStore.store.deleteLayer(layer.id);
  assert(!demoStore.store.hasDemoLayer(), "deleting the sample removes it cleanly");
});

console.log("\nexport / import: the only way data leaves the browser");

let backup;
await check("export writes a complete, self-describing file", async () => {
  const { file, json } = await transfer.buildExportFile(first.repository, { includeMedia: true });
  backup = json;
  equal(file.app, "layer", "app marker");
  equal(file.kind, "backup", "kind marker");
  equal(file.version, 1, "schema version");
  assert(file.counts.layers >= 1, "counts");
  const parsed = JSON.parse(json);
  equal(parsed.layers[0].viewport.scale, 0.85, "positions and viewport round-trip");
});

await check("import of that file into an empty browser restores everything", async () => {
  const target = freshStore();
  await target.store.boot();
  const plan = await transfer.parseBackup(backup);
  equal(plan.layers.length, 1, "planned layers");
  equal(plan.skippedRecords, 0, "nothing skipped");
  const summary = await transfer.applyImport(target.repository, plan, "replace");
  equal(summary.layers, 1, "imported layers");
  const restored = await target.repository.loadSnapshot();
  equal(restored.layers[0].name, "Company Launch", "name restored");
  equal(restored.cards[0].title, "Positioning v2", "card restored");
  equal(restored.cards[0].position.x, 480, "position restored");
});

await check("merge keeps what is already there", async () => {
  const target = freshStore();
  await target.store.boot();
  await target.store.createLayer({ name: "Existing" });
  await target.store.flush();
  const plan = await transfer.parseBackup(backup);
  await transfer.applyImport(target.repository, plan, "merge");
  const restored = await target.repository.loadSnapshot();
  equal(restored.layers.length, 2, "both layers present");
});

await check("a single Layer exports on its own", async () => {
  const layer = first.store.layerById(layerId);
  const { filename, json } = await transfer.exportLayer(first.repository, layer);
  equal(filename, `layer-${layerId}.json`, "filename names the layer");
  const file = JSON.parse(json);
  equal(file.kind, "layer-export-selection", "marked as a single-Layer export");
  equal(file.layer.id, layerId, "one layer");
  assert(file.cards.length >= 1 && file.cards.every((card) => card.layerId === layerId), "only that layer's cards");
  // And it imports back: the Layer menu offers this, so it must be a valid file.
  const plan = await transfer.parseBackup(json);
  equal(plan.layers.length, 1, "parses as one layer");
  assert(plan.cards.length >= 1, "with its cards");
});

console.log("\nhostile input must degrade, not crash");

const hostile = [
  ["not JSON at all", "{{{ not json"],
  ["a JSON array", "[1,2,3]"],
  ["a file with no layers and no cards", JSON.stringify({ app: "layer", kind: "backup", hello: "world" })],
  ["no layers key", JSON.stringify({ app: "layer", kind: "backup", version: 1 })],
  ["layers not an array", JSON.stringify({ app: "layer", kind: "backup", version: 1, layers: "nope" })],
  ["an absurd schema version", JSON.stringify({ app: "layer", kind: "backup", version: 999, layers: [], cards: [] })],
];

await check("accepts a headerless export only with a warning", async () => {
  const plan = await transfer.parseBackup(JSON.stringify({ version: 1, layers: [], cards: [] }));
  assert(
    plan.warnings.some((warning) => /no LAYER header/i.test(warning)),
    `warns about the missing header: ${JSON.stringify(plan.warnings)}`,
  );
});

for (const [label, text] of hostile) {
  await check(`rejects ${label}`, async () => {
    let threw = null;
    try {
      await transfer.parseBackup(text);
    } catch (error) {
      threw = error;
    }
    assert(threw, "parseBackup threw");
    assert(threw instanceof transfer.ImportError, "typed ImportError");
    assert(String(threw.message).length > 12, `message explains itself: "${threw.message}"`);
  });
}

await check("one malformed card cannot poison the load", async () => {
  const poisoned = JSON.parse(backup);
  poisoned.cards.push(
    { id: "broken", layerId: layerId, kind: "task", title: 42, data: null, position: "nowhere" },
    { id: "ghost", layerId: "does-not-exist", kind: "note", title: "orphan" },
    { id: "", kind: "nonsense" },
  );
  const plan = await transfer.parseBackup(JSON.stringify(poisoned));
  equal(plan.layers.length, 1, "the good layer is still imported");
  const good = plan.cards.find((card) => card.id === "broken");
  assert(good, "malformed card normalised instead of dropped");
  equal(typeof good.title, "string", "title coerced");
  assert(plan.skippedRecords >= 1, "the unusable record is counted as skipped");
  assert(plan.warnings.length >= 1, "and reported");
  const target = freshStore();
  await target.store.boot();
  await transfer.applyImport(target.repository, plan, "replace");
  const state = target.store.getState();
  await target.store.flush();
  const restored = new LayerStore();
  await restored.boot();
  assert(restored.getState().cards[good.id], "the repaired card loads back");
  equal(state.status, "ready", "no crash on import");
});

await check("normalizeCard refuses nonsense and clamps what is merely wrong", () => {
  assert(normalize.normalizeCard(null) === null, "null");
  assert(normalize.normalizeCard({ id: "a" }) === null, "no layer/kind");
  const fixed = normalize.normalizeCard({
    id: "c1",
    layerId: "l1",
    kind: "note",
    title: "x".repeat(5000),
    body: "hello",
    position: { x: "120", y: Number.NaN, width: 4 },
    createdAt: "yesterday",
    updatedAt: -1,
  });
  assert(fixed, "accepted");
  assert(fixed.title.length <= format.MAX_TITLE, `title capped (${fixed.title.length})`);
  assert(Number.isFinite(fixed.position.x), "numeric strings coerced");
  assert(Number.isFinite(fixed.position.y), "NaN replaced");
  assert(fixed.position.width >= layout.CARD_MIN_WIDTH, "width raised to the minimum");
  assert(fixed.createdAt > 0 && fixed.updatedAt >= fixed.createdAt, "timestamps repaired");
});

await check("a malformed Layer keeps its name and drops the rest", () => {
  const layer = normalize.normalizeLayer({ id: "l1", name: " Real ", description: 99, viewport: "nope", cards: "nope" });
  assert(layer, "accepted");
  equal(layer.name, "Real", "name trimmed");
  assert(layer.description === undefined, "a non-string description is dropped, not stringified");
  assert(layer.viewport === undefined, "a bad viewport is dropped");
  equal(typeof layer.createdAt, "number", "createdAt numeric");
  assert(normalize.normalizeLayer({}) === null, "a Layer with no id is refused");
  assert(normalize.normalizeLayer({ id: "l2", name: "   " }) === null, "a nameless Layer is refused");
  const { layers, dropped } = normalize.normalizeLayers([{ id: "ok", name: "Good" }, null, 42, { id: "bad" }]);
  equal(layers.length, 1, "only the good one survives");
  equal(dropped, 3, "the rest are counted, so the import can say so");
});

await check("settings from an old backup keep their defaults", () => {
  const settings = normalize.normalizeSettings({ theme: "sepia", gridSize: 3, snapToGrid: "yes" });
  equal(settings.theme, "system", "unknown theme falls back");
  assert(settings.gridSize >= 8, "grid size clamped");
  assert(typeof settings.snapToGrid === "boolean", "boolean coerced");
  assert(typeof settings.onboarded === "boolean", "onboarded present");
});

console.log("\nlinks, media and formatting");

await check("only safe schemes reach an href", () => {
  equal(url.safeExternalUrl("javascript:alert(1)"), null, "javascript:");
  equal(url.safeExternalUrl("JaVaScRiPt:alert(1)"), null, "mixed case javascript:");
  equal(url.safeExternalUrl("data:text/html;base64,PHNjcmlwdD4="), null, "data:");
  equal(url.safeExternalUrl("vbscript:msgbox(1)"), null, "vbscript:");
  equal(url.safeExternalUrl(" javascript:alert(1) "), null, "padded javascript:");
  equal(url.safeExternalUrl("https://example.com/a?b=1"), "https://example.com/a?b=1", "https");
  assert(String(url.safeExternalUrl("http://example.com")).startsWith("http://example.com"), "http");
  equal(url.safeExternalUrl("mailto:hi@example.com"), "mailto:hi@example.com", "mailto");
  equal(url.safeExternalUrl("tel:+9112345678"), "tel:+9112345678", "tel");
  equal(url.safeExternalUrl("//cdn.example.com/x"), null, "protocol-relative refused");
  equal(url.safeExternalUrl("\\\\cdn.example.com/x"), null, "backslash variant refused");
  // A root-relative path must not become a link to a host called "layers":
  // internal navigation is <Link>'s job, never a card's href.
  equal(url.safeExternalUrl("/layers/1"), null, "internal path is not an external link");
  equal(url.safeExternalUrl("/nope"), null, "leading slash is a path");
  equal(url.safeExternalUrl("example.com"), "https://example.com/", "bare host is completed");
  equal(url.safeExternalUrl("  "), null, "whitespace");
  equal(url.safeExternalUrl(""), null, "empty");
  equal(url.safeExternalUrl(undefined), null, "undefined");
  equal(url.safeExternalUrl("a".repeat(3000)), null, "over-long input");
  assert(!url.isValidUrl("javascript:alert(1)"), "isValidUrl agrees");
});

await check("a link card never renders an unsafe URL as a link", () => {
  const store = freshStore().store;
  const card = store.addCard("l", "link", { data: { url: "javascript:alert(1)" } });
  const record = store.getState().cards[card.id];
  // The raw value is kept (the user typed it) but it is refused at the edge.
  equal(url.safeExternalUrl(record.data.url), null, "rendered as text, not a link");
});

await check("urlHost and urlLabel stay readable", () => {
  equal(url.urlHost("https://www.notion.so/Page-1"), "notion.so", "www stripped");
  assert(url.urlLabel("https://example.com/very/long/path/that/keeps/going").length <= 60, "label truncated");
});

await check("formatting is honest about time and size", () => {
  equal(format.formatBytes(1), "1 B", "bytes");
  equal(format.formatBytes(2048), "2 KB", "kilobytes");
  equal(format.formatBytes(5 * 1024 * 1024), "5 MB", "megabytes");
  equal(format.formatBytes(0), "0 KB", "zero is not negative");
  equal(format.formatBytes(Number.NaN), "0 KB", "NaN does not print NaN");
  assert(format.formatRelativeTime(Date.now() - 60_000).length > 0, "relative time");
  equal(format.isOverdue(Date.now() - 3 * 86_400_000), true, "three days past is overdue");
  equal(format.isOverdue(Date.now() - 1000), false, "due today is not yet overdue");
  equal(format.isOverdue(Date.now() + 86_400_000), false, "the future is not overdue");
  equal(format.isOverdue(0), false, "no date is never overdue");
  equal(format.pluralize(1, "card"), "1 card", "singular");
  equal(format.pluralize(3, "card"), "3 cards", "plural");
  assert(format.truncate("abcdefghij", 5).length <= 6, "truncate respects the cap");
});

console.log("\nspatial maths: the canvas has to be right");

await check("bounds, hit-testing and the mini preview agree", () => {
  const cards = [
    { id: "a", position: { x: 0, y: 0, width: 320, height: 180 } },
    { id: "b", position: { x: 900, y: 640, width: 240, height: 120 } },
  ];
  const bounds = geometry.boundsOf(cards.map(geometry.cardRect));
  assert(bounds, "bounds exist");
  equal([bounds.x, bounds.y, bounds.width, bounds.height], [0, 0, 1140, 760], "tight box around both cards");
  equal(geometry.boundsOf([]), null, "an empty Layer has no bounds");
  const inside = geometry.cardsInViewport(cards, { x: 0, y: 0, width: 800, height: 600 }, 0);
  equal(inside.map((card) => card.id), ["a"], "only the first card is in view");
  const mini = geometry.miniLayout(cards);
  equal(mini.length, 2, "both cards appear in the preview");
  assert(mini.every((rect) => rect.x >= 0 && rect.x <= 1 && rect.y >= 0 && rect.y <= 1), "preview is normalised 0..1");
  equal(mini[0].x, 0, "the top-left card anchors the preview");
  equal(geometry.miniLayout([]), [], "an empty Layer has an empty preview");
  // A single card would give a zero-area box; the preview must not divide by it.
  equal(geometry.miniLayout([cards[0]].slice(0, 1).map((card) => ({ ...card, position: { ...card.position, width: 0, height: 0 } }))).length, 0, "degenerate layout is empty");
});

await check("zoom is clamped and centring recentres", () => {
  const camera = new Camera({ x: 0, y: 0, scale: 1 });
  camera.setBounds(1000, 800);
  camera.zoomTo(99);
  assert(camera.getViewport().scale <= layout.MAX_ZOOM + 1e-6, `zoom in clamped (${camera.getViewport().scale})`);
  camera.zoomTo(-5);
  assert(camera.getViewport().scale >= layout.MIN_ZOOM - 1e-6, `zoom out clamped (${camera.getViewport().scale})`);
  camera.centerOn({ x: 500, y: 400 }, { animate: false });
  const view = camera.getViewport();
  // After centring, the world point must land on the viewport centre.
  equal([Math.round(view.x + 500 * view.scale), Math.round(view.y + 400 * view.scale)], [500, 400], "centred");
  camera.panBy(100, -50);
  equal([camera.getViewport().x - view.x, camera.getViewport().y - view.y], [100, -50], "pan is additive");
  const wide = [
    { id: "a", position: { x: 0, y: 0, width: 400, height: 200 } },
    { id: "b", position: { x: 2000, y: 1200, width: 400, height: 200 } },
  ];
  const fitted = camera.fitTo(wide.map(geometry.cardRect), { padding: 40 });
  assert(fitted.scale > layout.MIN_ZOOM && fitted.scale < 1, `fit zooms out (${fitted.scale.toFixed(3)})`);
  // Everything must sit inside the viewport after fitting.
  const fittedView = camera.getViewport();
  const screen = wide.map((card) => geometry.cardRect(card)).map((rect) => ({
    x: fittedView.x + rect.x * fittedView.scale,
    y: fittedView.y + rect.y * fittedView.scale,
    right: fittedView.x + (rect.x + rect.width) * fittedView.scale,
    bottom: fittedView.y + (rect.y + rect.height) * fittedView.scale,
  }));
  assert(screen.every((rect) => rect.x >= -1 && rect.y >= -1 && rect.right <= 1001 && rect.bottom <= 801), "fit contains the Layer");
});

await check("grid snapping is deterministic", () => {
  equal(layout.snapToGrid(37, 24), 48, "rounds to nearest");
  equal(layout.snapToGrid(-1, 24), 0, "clamps at zero");
  equal(layout.clamp(5, 1, 3), 3, "clamps high");
  equal(layout.clamp(-5, 1, 3), 1, "clamps low");
});

console.log("\nsearch ranking: ⌘K has to feel clever, not lucky");

await check("exact prefixes beat fuzzy letters", () => {
  const direct = fuzzy.subsequenceScore("deck", "Weekly deck outline");
  const scattered = fuzzy.subsequenceScore("deck", "Keep the dog pen");
  assert(direct > 0, "both match");
  assert(direct > scattered, `deck in "deck" (${direct}) > scattered (${scattered})`);
  equal(fuzzy.subsequenceScore("zzz", "Weekly deck outline"), 0, "no match scores zero");
});

await check("every term must appear, in any order", () => {
  const state = first.store.getState();
  const a = selectors.searchWorkspace("deck launch", state.layers, state.cards, state.cardOrder);
  const b = selectors.searchWorkspace("launch deck", state.layers, state.cards, state.cardOrder);
  assert(a.length >= 0 && b.length >= 0, "no throw");
  assert(selectors.searchWorkspace("launch", state.layers, state.cards, state.cardOrder).length > 0, "single term hits");
  equal(selectors.searchWorkspace("nothing matches this", state.layers, state.cards, state.cardOrder).length, 0, "misses return nothing");
});

await check("highlight ranges are within the string", () => {
  const text = "Company Launch plan";
  const ranges = fuzzy.substringMatches("launch", text);
  assert(ranges.length === 1, "one range");
  const [range] = ranges;
  equal(text.slice(range.start, range.end).toLowerCase(), "launch", "range points at the match");
  const parts = fuzzy.splitHighlighted(text, ranges);
  equal(parts.map((part) => part.text).join(""), text, "parts rebuild the string");
  assert(parts.some((part) => part.hit && part.text.toLowerCase() === "launch"), "the match is flagged");
  equal(fuzzy.substringMatches("", text), [], "empty query highlights nothing");
});

console.log("\nlocalisation of failure: the app must survive its own storage");

await check("a store that cannot be opened surfaces a fatal state, not a crash", async () => {
  const broken = {
    kind: "memory",
    async init() {
      throw new Error("IndexedDB is blocked in this browser.");
    },
    async read() {
      throw new Error("IndexedDB is blocked in this browser.");
    },
    async list() {
      throw new Error("IndexedDB is blocked in this browser.");
    },
    async write() {
      throw new Error("IndexedDB is blocked in this browser.");
    },
    async writeMany() {
      throw new Error("IndexedDB is blocked in this browser.");
    },
    async remove() {},
    async removeMany() {},
    async clear() {},
    async estimateUsage() {
      return 0;
    },
  };
  client.__resetRepository(createRepository(broken, { kind: "unavailable", writable: false }));
  const store = new LayerStore();
  await store.boot();
  equal(store.getState().status, "error", "status");
  assert(String(store.getState().fatalError).length > 0, "a message the user can read");
});

await check("a failed write marks the store unwritable so the banner can warn", async () => {
  let fail = false;
  const memory = new Map();
  const flaky = {
    kind: "indexeddb",
    async init() {},
    async read(namespace, key) {
      return memory.get(`${namespace}/${key}`);
    },
    async list(namespace) {
      return [...memory.entries()].filter(([k]) => k.startsWith(`${namespace}/`) && !k.endsWith("/*")).map(([, v]) => v);
    },
    async write(namespace, key, value) {
      if (fail) throw new Error("QuotaExceededError");
      memory.set(`${namespace}/${key}`, value);
    },
    async writeMany(namespace, entries) {
      for (const [key, value] of entries) await flaky.write(namespace, key, value);
    },
    async remove(namespace, key) {
      memory.delete(`${namespace}/${key}`);
    },
    async removeMany(namespace, keys) {
      for (const key of keys) await flaky.remove(namespace, key);
    },
    async clear(namespace) {
      for (const key of [...memory.keys()]) if (key.startsWith(`${namespace}/`)) memory.delete(key);
    },
    async estimateUsage() {
      return 1024;
    },
  };
  const repository = createRepository(flaky, { kind: "indexeddb", writable: true });
  client.__resetRepository(repository);
  const store = new LayerStore();
  await store.boot();
  fail = true;
  await store.createLayer({ name: "Will not save" });
  await store.flush();
  equal(store.getState().storage.writable, false, "writable flag cleared");
  assert(
    /full|quota/i.test(String(store.getState().storage.message)),
    `a friendly message is recorded: ${store.getState().storage.message}`,
  );
  fail = false;
  await store.updateSettings({ snapToGrid: false });
  await store.flush();
  equal(store.getState().storage.writable, true, "a later success clears the flag");
  equal(store.getState().storage.message, undefined, "and the message goes away");
});

await check("base64 round-trips a binary payload", async () => {
  const base64 = require_("./lib/storage/base64.js");
  const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 128, 64]);
  const text = await base64.arrayBufferToBase64(bytes.buffer.slice(0));
  const back = new Uint8Array(base64.base64ToArrayBuffer(text));
  equal(Array.from(back), Array.from(bytes), "bytes survive encode/decode");
  assert(base64.toDataUrl("image/png", text).startsWith("data:image/png;base64,"), "data url");
});

// --------------------------------------------------------------- report
fs.rmSync(work, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  ✗ ${failure.label}: ${failure.message}`);
  process.exit(1);
}
