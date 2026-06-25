export default function PoliticiansLoading() {
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-3 py-5 sm:px-5 lg:px-7">
      <div className="terminal-card space-y-3 p-6">
        <div className="h-4 w-40 rounded bg-muted shimmer" />
        <div className="h-9 w-64 rounded bg-muted shimmer" />
        <div className="h-4 w-full max-w-xl rounded bg-muted shimmer" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="terminal-card h-64 shimmer" />
        ))}
      </div>
    </main>
  );
}
