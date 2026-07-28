import type { PaceStatus } from "@/lib/marketing/pacing";

const statusColors: Record<PaceStatus, string> = {
  unconfigured: "#c8ccd6",
  healthy: "#655cf6",
  ahead: "#16a66a",
  watch: "#e6a429",
  behind: "#df5c5c",
  warning: "#ee912e",
  critical: "#d9464f",
  under: "#6f86d9",
};

export function PaceBar({
  progress,
  paceRatio,
  status,
  color,
  label,
}: {
  progress: number;
  paceRatio: number;
  status: PaceStatus;
  color?: string;
  label: string;
}) {
  const fill = Math.min(Math.max(progress, 0), 1) * 100;
  const marker = Math.min(Math.max(paceRatio, 0), 1) * 100;

  return (
    <div
      className="pace-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill)}
    >
      <span
        className="pace-bar-fill"
        style={{
          width: `${fill}%`,
          background: color || statusColors[status],
        }}
      />
      <span
        className="pace-bar-marker"
        style={{ left: `${marker}%` }}
        title={`時間進度 ${Math.round(marker)}%`}
      />
    </div>
  );
}

export function PaceStatusBadge({ status }: { status: PaceStatus }) {
  const labels: Record<PaceStatus, string> = {
    unconfigured: "未設定",
    healthy: "進度正常",
    ahead: "領先進度",
    watch: "接近進度",
    behind: "落後進度",
    warning: "使用偏快",
    critical: "超支警告",
    under: "投放偏慢",
  };

  return (
    <span className={`pace-status pace-status-${status}`}>{labels[status]}</span>
  );
}
