/**
 * Shown while the workspace chunk loads or the store is still opening the
 * database. It mimics the real layout so nothing jumps when it resolves.
 */
export default function LayersLoading() {
  return (
    <div className="canvas-field min-h-dvh">
      <div className="px-4 pb-5 pt-8 md:px-7 md:pt-11">
        <div className="h-7 w-40 animate-pulse rounded-md bg-surface-2" />
        <div className="mt-3 h-3 w-64 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="grid gap-3 px-4 md:grid-cols-2 md:px-7 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="h-[168px] animate-pulse rounded-card border border-line bg-surface-2/70"
            style={{ animationDelay: `${index * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
