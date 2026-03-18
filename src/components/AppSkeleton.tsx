function SkeletonChart() {
  return (
    <article
      className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-3"
      aria-hidden="true"
    >
      <div className="grid gap-2 mb-3">
        <div className="skeleton h-3.5 w-[36%]" />
        <div className="skeleton h-3 w-[52%]" />
      </div>
      <div className="skeleton w-full min-h-[280px] border border-[var(--color-chart-shell-border)] rounded-[10px]" />
    </article>
  );
}

export function AppSkeleton() {
  return (
    <>
      {/* Stats strip skeleton — matches compact strip layout */}
      <section
        className="border-b border-[var(--color-surface-2)] pb-4"
        aria-label="Loading summary statistics"
        aria-hidden="true"
      >
        {/* Primary row */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          {/* Hero number */}
          <div className="flex flex-col gap-1.5">
            <div className="skeleton h-2.5 w-28" />
            <div className="skeleton h-9 w-36" />
          </div>
          {/* Secondary metrics */}
          <div className="flex flex-col gap-1.5">
            <div className="skeleton h-2.5 w-24" />
            <div className="skeleton h-6 w-20" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="skeleton h-2.5 w-24" />
            <div className="skeleton h-6 w-20" />
          </div>
          {/* Freshness */}
          <div className="ml-auto">
            <div className="skeleton h-2.5 w-20" />
          </div>
        </div>
        {/* Archival row */}
        <div className="flex items-center gap-x-5 mt-2.5">
          <div className="flex flex-col gap-1">
            <div className="skeleton h-2 w-16" />
            <div className="skeleton h-4 w-20" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="skeleton h-2 w-16" />
            <div className="skeleton h-4 w-20" />
          </div>
        </div>
      </section>

      <section
        className="border border-[var(--color-surface-2)] rounded-xl bg-[var(--color-surface-1)] p-3 flex flex-wrap justify-between items-center gap-3 min-h-16"
        aria-label="Loading controls"
        aria-hidden="true"
      >
        <div className="inline-flex items-center gap-2">
          <div className="skeleton w-[76px] h-8 rounded-full" />
          <div className="skeleton w-[76px] h-8 rounded-full" />
        </div>
        <div className="inline-flex items-center gap-2">
          <div className="skeleton w-[76px] h-8 rounded-full" />
          <div className="skeleton w-[76px] h-8 rounded-full" />
          <div className="skeleton w-[76px] h-8 rounded-full" />
          <div className="skeleton w-[76px] h-8 rounded-full" />
        </div>
      </section>

      <section className="grid gap-4" aria-label="Loading charts">
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
      </section>
    </>
  );
}
