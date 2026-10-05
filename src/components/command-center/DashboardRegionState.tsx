import { Skeleton } from "@/components/ui/skeleton";
import { SystemButton } from "@/components/system/SystemButton";

export function DashboardRegionState({
  title,
  failed = false,
  retryHref = "/dashboard",
}: {
  title: string;
  failed?: boolean;
  retryHref?: string;
}) {
  return (
    <section
      className="command-surface command-section mb-5"
      aria-label={title}
      aria-busy={!failed}
      data-dashboard-state={failed ? "unavailable" : "loading"}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-system-foreground">{title}</h2>
          <p className="mt-2 text-sm text-system-muted-foreground" role="status">
            {failed
              ? "暫時未能讀取數據，請稍後再試。其他功能仍可使用。"
              : "正在讀取最新數據… 你可以先使用其他功能。"}
          </p>
        </div>
        {failed ? (
          <SystemButton density="compact" variant="outline" nativeButton={false} render={<a href={retryHref} />}>
            重新載入
          </SystemButton>
        ) : null}
      </header>
      {failed ? null : (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20" />)}
        </div>
      )}
    </section>
  );
}
