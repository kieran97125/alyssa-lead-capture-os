const navigationRows = ["總覽", "客戶營運", "成效報表", "建立與設定"];

export function SystemPageLoading() {
  return (
    <main
      className="system-page-loading"
      aria-label="頁面載入中"
      aria-busy="true"
      role="status"
    >
      <aside className="system-loading-sidebar" aria-hidden="true">
        <div className="system-loading-brand">
          <span className="system-loading-mark">GO</span>
          <span className="system-loading-brand-copy">
            <span className="system-skeleton-line is-short" />
            <span className="system-skeleton-line is-medium" />
          </span>
        </div>
        <div className="system-loading-navigation">
          {navigationRows.map((label) => (
            <div key={label}>
              <span className="system-loading-group-label">{label}</span>
              <span className="system-skeleton-nav-row" />
              <span className="system-skeleton-nav-row" />
            </div>
          ))}
        </div>
      </aside>

      <section className="system-loading-content">
        <span className="system-loading-live-copy">正在載入最新數據…</span>
        <header className="system-loading-header" aria-hidden="true">
          <div>
            <span className="system-skeleton-line is-short" />
            <span className="system-skeleton-line is-title" />
            <span className="system-skeleton-line is-copy" />
          </div>
          <span className="system-skeleton-button" />
        </header>

        <div className="system-loading-filter" aria-hidden="true">
          <span className="system-skeleton-control" />
          <span className="system-skeleton-control" />
          <span className="system-skeleton-control" />
          <span className="system-skeleton-button" />
        </div>

        <div className="system-loading-card-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="system-loading-card" key={index}>
              <span className="system-skeleton-line is-short" />
              <span className="system-skeleton-line is-value" />
              <span className="system-skeleton-line is-medium" />
            </div>
          ))}
        </div>

        <div className="system-loading-panel" aria-hidden="true">
          <span className="system-skeleton-line is-medium" />
          <span className="system-skeleton-chart" />
        </div>
      </section>
    </main>
  );
}
