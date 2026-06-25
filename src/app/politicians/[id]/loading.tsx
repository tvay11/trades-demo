export default function PoliticianDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-3 py-5 sm:px-5 lg:px-7">
      <div className="h-8 w-40 rounded bg-muted shimmer" />
      <div className="terminal-card h-56 shimmer" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="terminal-card h-32 shimmer" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.75fr)]">
        <div className="terminal-card h-96 shimmer" />
        <div className="terminal-card h-96 shimmer" />
      </div>
    </main>
  );
}
