"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useAppState, useStore } from "@/lib/state/provider";
import type { ThemeSetting } from "@/lib/types";

export const THEME_STORAGE_KEY = "layer-theme";

export type ResolvedTheme = "light" | "dark";

/**
 * Applies the theme preference to <html> and mirrors the resolved value into
 * localStorage so the inline script in the root layout can paint the correct
 * theme before first frame (no flash, no server knowledge of user data).
 */
export function useThemeController(): void {
  const theme = useAppState((state) => state.settings.theme);
  const motion = useAppState((state) => state.settings.motion);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const resolved: ResolvedTheme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolved === "dark");
      root.style.colorScheme = resolved;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, resolved);
      } catch {
        /* private mode: cosmetic only */
      }
    };

    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const reduced = motion === "reduced" || (motion === "system" && media.matches);
      root.dataset.motion = reduced ? "reduced" : "full";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [motion]);
}

function subscribeThemeClass(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function readThemeClass(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme(): {
  setting: ThemeSetting;
  resolved: ResolvedTheme;
  setTheme: (theme: ThemeSetting) => void;
  cycle: () => void;
} {
  const store = useStore();
  const setting = useAppState((state) => state.settings.theme);
  // Read the class the controller (and the pre-paint script) already put on <html>,
  // so every consumer agrees on one source of truth for "what is showing".
  const resolved = useSyncExternalStore(subscribeThemeClass, readThemeClass, () => "light" as ResolvedTheme);

  const setTheme = useCallback((next: ThemeSetting) => store.updateSettings({ theme: next }), [store]);
  const cycle = useCallback(() => {
    const order: ThemeSetting[] = ["light", "dark", "system"];
    const index = order.indexOf(setting);
    store.updateSettings({ theme: order[(index + 1) % order.length] ?? "system" });
  }, [setting, store]);

  return { setting, resolved, setTheme, cycle };
}
