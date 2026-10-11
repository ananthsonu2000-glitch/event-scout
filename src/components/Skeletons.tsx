const bar = "animate-pulse rounded bg-slate-200/80";

export function CardSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-lg bg-white shadow-card">
      <span className="w-1 shrink-0 bg-slate-200" />
      <div className="flex-1 space-y-3 p-4">
        <div className="flex gap-2">
          <div className={`${bar} h-5 w-16`} />
          <div className={`${bar} h-5 w-28`} />
        </div>
        <div className={`${bar} h-5 w-3/4`} />
        <div className={`${bar} h-4 w-1/2`} />
        <div className={`${bar} h-4 w-full`} />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading events">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card space-y-3 p-4">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} h-8 w-12`} />
            <div className={`${bar} h-3 w-28`} />
          </div>
        ))}
      </div>
      <div className="card h-28 animate-pulse bg-slate-100" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
