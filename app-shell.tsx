"use client";

import type { ReactNode } from "react";

import { StorageBanner } from "./storage-banner";
import { Toast } from "./toast";
import { Hotkeys } from "./hotkeys";
import { CommandPalette } from "@/components/overlays/command-palette";
import { LayerDialog } from "@/components/overlays/layer-dialog";
import { SearchDialog } from "@/components/overlays/search-dialog";
import { ShortcutsDialog } from "@/components/overlays/shortcuts-dialog";
import { useThemeController } from "@/hooks/use-theme";
import { StoreProvider } from "@/lib/state/provider";

/**
 * The chrome every screen shares: theme application, keyboard bindings, the two
 * overlays (palette, search) plus the create/edit dialog, and honest feedback
 * about where the data is actually being kept.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <Chrome>{children}</Chrome>
    </StoreProvider>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  useThemeController();
  return (
    <>
      <Hotkeys />
      <StorageBanner />
      {children}
      <Toast />
      <CommandPalette />
      <SearchDialog />
      <ShortcutsDialog />
      <LayerDialog />
    </>
  );
}
