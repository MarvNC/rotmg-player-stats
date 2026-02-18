function SkeletonCard() {
  return (
    <article className="stat-card skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-line skeleton-line-label" />
      <div className="skeleton skeleton-line skeleton-line-value" />
      <div className="skeleton skeleton-line skeleton-line-meta" />
    </article>
  );
}

function SkeletonChart() {
  return (
    <article className="chart-shell skeleton-chart" aria-hidden="true">
      <div className="skeleton-chart-heading">
        <div className="skeleton skeleton-line skeleton-line-title" />
        <div className="skeleton skeleton-line skeleton-line-subtitle" />
      </div>
      <div className="skeleton skeleton-chart-canvas" />
    </article>
  );
}

export function AppSkeleton() {
  return (
    <>
      <section className="stats-grid" aria-label="Loading summary cards">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </section>

      <section className="panel controls-panel skeleton-controls" aria-label="Loading controls" aria-hidden="true">
        <div className="skeleton-controls-left">
          <div className="skeleton skeleton-pill" />
          <div className="skeleton skeleton-pill" />
        </div>
        <div className="skeleton-controls-right">
          <div className="skeleton skeleton-pill" />
          <div className="skeleton skeleton-pill" />
          <div className="skeleton skeleton-pill" />
          <div className="skeleton skeleton-pill" />
        </div>
      </section>

      <section className="charts-stack" aria-label="Loading charts">
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
      </section>
    </>
  );
}
