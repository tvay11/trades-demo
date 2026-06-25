export default function LoadingDatasets() {
  return (
    <main className="min-h-[calc(100dvh-44px)] px-3 py-4 sm:px-5 lg:px-7">
      <div className="mx-auto grid w-full max-w-[1500px] gap-4">
        <div className="h-44 rounded border border-border bg-muted" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="h-40 rounded border border-border bg-muted" />
          ))}
        </div>
      </div>
    </main>
  );
}
