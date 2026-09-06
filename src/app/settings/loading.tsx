export default function SettingsLoading() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-20 pt-11 md:px-7">
        <div className="h-7 w-32 animate-pulse rounded-md bg-surface-2" />
        <div className="mt-3 h-3 w-72 animate-pulse rounded bg-surface-2" />
        <div className="mt-9 grid gap-3">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-[10px] border border-line bg-surface-2/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
