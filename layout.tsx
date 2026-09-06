import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/layout/app-shell";

import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const VERSION = process.env.NEXT_PUBLIC_LAYER_VERSION ?? "0.1.0";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "LAYER — open what you’re doing",
    template: "%s · LAYER",
  },
  description:
    "A goal-centric workspace. One goal, one Layer: notes, tasks, links and files laid out on a canvas you can think inside. Local-first — no account, no server.",
  applicationName: "LAYER",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LAYER",
    statusBarStyle: "black-translucent",
  },
  other: {
    "color-scheme": "light dark",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#101116" },
  ],
};

/**
 * Runs before the first paint so the correct theme is on screen immediately —
 * reading localStorage here is the only way to avoid the flash, and it is the
 * one place in the app allowed to touch it directly (the store treats
 * IndexedDB as the source of truth). It also decides which modifier glyphs the
 * shortcut hints should draw, which must be known before hydration to avoid a
 * second layout. The string is static: no user data is interpolated into it.
 */
const BOOT_SCRIPT = `try{var d=document.documentElement;var s=localStorage.getItem("layer-theme");var m=window.matchMedia("(prefers-color-scheme: dark)");var dark=s==="dark"||(s!=="light"&&m.matches);d.classList.toggle("dark",dark);d.style.colorScheme=dark?"dark":"light";d.dataset.platform=/mac|iphone|ipad/i.test(navigator.userAgent)?"mac":"win";}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-version={VERSION}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="bg-canvas text-ink antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
