export default function TradesLoading() {
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-3 py-5 sm:px-5 lg:px-7">
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-muted shimmer" />
        <div className="h-9 w-72 rounded bg-muted shimmer" />
        <div className="h-4 w-full max-w-xl rounded bg-muted shimmer" />
      </div>
      <div className="terminal-card space-y-3 p-4">
        <div className="h-10 rounded bg-muted shimmer" />
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-12 rounded bg-muted shimmer" />
        ))}
      </div>
    </main>
  );
}
