export default function TradeDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-3 py-5 sm:px-5 lg:px-7">
      <div className="h-8 w-32 rounded bg-muted shimmer" />
      <div className="terminal-card space-y-4 p-6">
        <div className="h-5 w-44 rounded bg-muted shimmer" />
        <div className="h-10 w-full max-w-2xl rounded bg-muted shimmer" />
        <div className="h-16 w-full rounded bg-muted shimmer" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="terminal-card h-72 shimmer" />
        <div className="terminal-card h-72 shimmer" />
      </div>
    </main>
  );
}
