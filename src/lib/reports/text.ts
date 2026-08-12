import type {
  ReportBreakdownRow,
  ReportMetrics,
  ReportSnapshot,
} from "@/lib/reports/types";

function integer(value: number) {
  return Math.round(value).toLocaleString("zh-HK");
}

function money(value: number | null) {
  if (value === null) return "未有廣告費資料";
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency: "HKD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("zh-HK", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function metricLines(metrics: ReportMetrics) {
  return [
    `Lead：${integer(metrics.leads)}`,
    `Book：${integer(metrics.bookings)}`,
    `Book Rate：${percent(metrics.bookRate)}`,
    `Show：${integer(metrics.shows)}`,
    `Show-up Rate：${percent(metrics.showUpRate)}`,
    `Lead → Show：${percent(metrics.leadToShowRate)}`,
    `No Show：${integer(metrics.noShows)}`,
    `待到店：${integer(metrics.pendingShows)}`,
    `Spend：${money(metrics.spend)}`,
    `CPL：${money(metrics.cpl)}`,
    `CPBook：${money(metrics.costPerBooking)}`,
    `CPShow：${money(metrics.costPerShow)}`,
  ];
}

function ratioChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return "—";
  const change = (current - previous) / Math.abs(previous);
  const label = percent(Math.abs(change));
  return change > 0 ? `↑ ${label}` : change < 0 ? `↓ ${label}` : "→ 0%";
}

function comparisonLines(snapshot: ReportSnapshot) {
  if (!snapshot.comparison) return [];
  const current = snapshot.current.totals;
  const previous = snapshot.comparison.totals;
  return [
    `比較期間：${snapshot.comparison.label}`,
    `Lead：${integer(previous.leads)} → ${integer(current.leads)}（${ratioChange(current.leads, previous.leads)}）`,
    `Book：${integer(previous.bookings)} → ${integer(current.bookings)}（${ratioChange(current.bookings, previous.bookings)}）`,
    `Show：${integer(previous.shows)} → ${integer(current.shows)}（${ratioChange(current.shows, previous.shows)}）`,
    `Spend：${money(previous.spend)} → ${money(current.spend)}（${ratioChange(current.spend, previous.spend)}）`,
    `CPL：${money(previous.cpl)} → ${money(current.cpl)}（${ratioChange(current.cpl, previous.cpl)}）`,
    `CPBook：${money(previous.costPerBooking)} → ${money(current.costPerBooking)}（${ratioChange(current.costPerBooking, previous.costPerBooking)}）`,
    `CPShow：${money(previous.costPerShow)} → ${money(current.costPerShow)}（${ratioChange(current.costPerShow, previous.costPerShow)}）`,
  ];
}

function breakdownLines(title: string, rows: ReportBreakdownRow[]) {
  if (rows.length === 0) return [];
  const lines = [`## ${title}`];
  rows.forEach((row, index) => {
    lines.push(
      "",
      `${index + 1}. ${row.label}${row.detail ? `｜${row.detail}` : ""}`,
      ...metricLines(row.metrics).map((line) => `   ${line}`)
    );
  });
  return lines;
}

export function renderReportText(snapshot: ReportSnapshot) {
  const lines: string[] = [
    `# ${snapshot.title}`,
    "",
    `報告編號：${snapshot.reportId}`,
    `報告期間：${snapshot.current.label}`,
    `品牌範圍：${snapshot.selection.brandLabel}`,
    `生成時間：${snapshot.generatedAt}`,
    "",
    "## Dashboard 摘要",
    ...metricLines(snapshot.current.totals),
  ];

  if (snapshot.comparison) {
    lines.push("", "## 上月同期比較", ...comparisonLines(snapshot));
  }

  if (snapshot.selection.breakdowns.includes("brand")) {
    lines.push("", ...breakdownLines("按品牌拆分", snapshot.brandRows));
  }
  if (snapshot.selection.breakdowns.includes("treatment")) {
    lines.push("", ...breakdownLines("按療程拆分", snapshot.treatmentRows));
  }

  if (snapshot.spendMix.length > 0) {
    lines.push("", "## 廣告費組合");
    snapshot.spendMix
      .filter((row) => row.amount > 0)
      .forEach((row) => {
        lines.push(`${row.label}：${money(row.amount)}${row.share === null ? "" : `（${percent(row.share)}）`}`);
      });
  }

  if (snapshot.insights.length > 0) {
    lines.push("", "## 重點觀察");
    snapshot.insights.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title}`, `   ${item.detail}`);
    });
  }

  if (snapshot.actions.length > 0) {
    lines.push("", "## 建議行動");
    snapshot.actions.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title}`, `   ${item.detail}`);
    });
  }

  lines.push(
    "",
    "## 數據完整度",
    `狀態：${snapshot.dataQuality.status}`,
    `Lead Source：${snapshot.dataQuality.sourceName}（${snapshot.dataQuality.sourceStatus}）`,
    `Spend Coverage：${snapshot.dataQuality.spendCompleteBrandDays}/${snapshot.dataQuality.spendExpectedBrandDays} 個品牌日`,
    `Lead Fact Rows：${snapshot.dataQuality.factRows}`,
    `Spend Rows：${snapshot.dataQuality.spendRows}`
  );

  if (snapshot.dataQuality.warnings.length > 0) {
    lines.push("", "注意：");
    snapshot.dataQuality.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  lines.push(
    "",
    `Metric Contract：${snapshot.metricContractVersion}`,
    `Snapshot ID：${snapshot.snapshotId}`,
    "",
    "— Growth OS"
  );

  return `${lines.join("\n")}\n`;
}
