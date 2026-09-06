export type ThemeSetting = "system" | "light" | "dark";

export type Settings = {
  theme: ThemeSetting;
  /** Reduced-motion override; "system" follows prefers-reduced-motion. */
  motion: "system" | "reduced" | "full";
  snapToGrid: boolean;
  gridSize: number;
  showCardMeta: boolean;
  /** Set once the user has created or dismissed their first-run experience. */
  onboarded: boolean;
  version: number;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  motion: "system",
  snapToGrid: true,
  gridSize: 24,
  showCardMeta: true,
  onboarded: false,
  version: 1,
};

export type StorageKind = "indexeddb" | "localstorage" | "unavailable";

export type StorageInfo = {
  kind: StorageKind;
  /** Whether persistence writes are landing in the durable store. */
  writable: boolean;
  message?: string;
};

/** Shape of the JSON file produced by Settings → Export. */
export type ExportFile = {
  app: "layer";
  kind: "backup";
  version: 1;
  exportedAt: string;
  counts: {
    layers: number;
    cards: number;
    assets: number;
  };
  layers: unknown[];
  cards: unknown[];
  /** Optional base64 media. Media can be skipped for a small text-only backup. */
  assets?: Record<string, { mime: string; size: number; data: string }>;
  settings: Partial<Settings>;
};

export type ImportSummary = {
  mode: "merge" | "replace";
  layers: number;
  cards: number;
  assets: number;
  skipped: number;
  warnings: string[];
};
