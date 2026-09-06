"use client";

import { Button } from "@/components/ui/button";

/**
 * Last line of defence — it replaces <html>, so it has to carry its own styles.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#101116",
          color: "#f2f2ef",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ff8f87" }}>
            LAYER failed to start
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
            The app could not render
          </h1>
          <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#a3a5ae" }}>
            Nothing was lost — your Layers are stored in this browser. Reloading usually clears it.
          </p>
          <pre
            style={{
              margin: "16px 0 0",
              padding: 12,
              maxHeight: 144,
              overflow: "auto",
              fontSize: 11.5,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              border: "1px solid #26272e",
              borderRadius: 10,
              background: "#15161c",
              color: "#a3a5ae",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {error.message || "Unknown error"}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <Button variant="primary" size="sm" onClick={reset}>
              Try again
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
