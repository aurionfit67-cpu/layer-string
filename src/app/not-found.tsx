import Link from "next/link";

export default function NotFound() {
  return (
    <main className="canvas-field grid min-h-dvh place-items-center px-6 py-16">
      <div className="max-w-[460px]">
        <p className="eyebrow text-faint">404</p>
        <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink">
          There is nothing on this canvas
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          The route you asked for does not exist. LAYER has three screens: home, your Layers, and settings.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/"
            className="rounded-[10px] bg-ink px-3.5 py-2 text-[13px] font-medium text-canvas transition-opacity hover:opacity-90"
          >
            Go home
          </Link>
          <Link
            href="/layers"
            className="rounded-[10px] border border-line-strong px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
          >
            All Layers
          </Link>
          <Link
            href="/settings"
            className="rounded-[10px] px-3.5 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Settings
          </Link>
        </div>
      </div>
    </main>
  );
}
