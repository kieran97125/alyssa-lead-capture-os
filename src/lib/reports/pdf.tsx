import "server-only";

import path from "node:path";
import React, { type ReactNode } from "react";
import {
  Document,
  Font,
  Image,
  Line,
  Page,
  Polyline,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  count,
  dateTimeHkt,
  deltaLabel,
  money,
  percentage,
  reportTheme,
  shortDate,
  type ReportTheme,
} from "@/lib/reports/presentationUtils";
import type {
  ReportBreakdownRow,
  ReportNarrativeItem,
  ReportSnapshot,
} from "@/lib/reports/types";

const assetPath = (...parts: string[]) => path.join(process.cwd(), "public", ...parts);
const REPORT_PAGE_SIZE: [number, number] = [960, 540];

Font.register({
  family: "Noto Sans TC",
  fonts: [
    { src: assetPath("report-assets", "fonts", "NotoSansTC-Regular.ttf"), fontWeight: 400 },
    { src: assetPath("report-assets", "fonts", "NotoSansTC-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingHorizontal: 52,
    paddingBottom: 42,
    backgroundColor: "#FFFFFF",
    fontFamily: "Noto Sans TC",
    color: "#321428",
  },
  header: { marginBottom: 22 },
  kicker: { fontSize: 8, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" },
  title: { fontSize: 26, fontWeight: 700, marginTop: 5, lineHeight: 1.16 },
  subtitle: { fontSize: 9.5, color: "#6D4A5C", marginTop: 7, lineHeight: 1.45 },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 52,
    right: 52,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#8F7884",
  },
  cardRow: { display: "flex", flexDirection: "row", gap: 10 },
  metricCard: { flexGrow: 1, borderRadius: 10, padding: 14, borderWidth: 1 },
  metricLabel: { fontSize: 8, fontWeight: 700 },
  metricValue: { fontSize: 22, fontWeight: 700, marginTop: 7 },
  metricNote: { fontSize: 7.5, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 10 },
  tableHeader: { display: "flex", flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8 },
  tableRow: { display: "flex", flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 0.6 },
  th: { fontSize: 7, fontWeight: 700 },
  td: { fontSize: 7.5 },
});

function reportLogo(snapshot: ReportSnapshot) {
  const brand = snapshot.selection.brands.length === 1 ? snapshot.selection.brands[0] : null;
  if (brand?.logoKey === "ineffable") {
    return assetPath("report-assets", "brands", "ineffable-beauty.png");
  }
  if (brand?.logoKey === "gos") {
    return assetPath("report-assets", "brands", "gos-beauty.png");
  }
  return assetPath("icons", "growth-os-512.png");
}

function Footer({ snapshot }: { snapshot: ReportSnapshot }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{snapshot.reportId} · {snapshot.metricContractVersion}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function ReportPage({
  snapshot,
  theme,
  kicker,
  title,
  subtitle,
  children,
}: {
  snapshot: ReportSnapshot;
  theme: ReportTheme;
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Page size={REPORT_PAGE_SIZE} style={[styles.page, { color: theme.text }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.accent }]}>{kicker}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
      </View>
      {children}
      <Footer snapshot={snapshot} />
    </Page>
  );
}

function MetricCard({ label, value, note, theme }: { label: string; value: string; note: string; theme: ReportTheme }) {
  return (
    <View style={[styles.metricCard, { borderColor: theme.line, backgroundColor: theme.accentSoft }]}>
      <Text style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.dark }]}>{value}</Text>
      <Text style={[styles.metricNote, { color: theme.muted }]}>{note}</Text>
    </View>
  );
}

function ComparisonNote({ current, previous, lowerIsBetter, theme }: { current: number | null; previous: number | null; lowerIsBetter?: boolean; theme: ReportTheme }) {
  const label = deltaLabel(current, previous);
  const delta = previous !== null && previous !== 0 && current !== null ? (current - previous) / Math.abs(previous) : null;
  const good = delta !== null && (lowerIsBetter ? delta <= 0 : delta >= 0);
  return <Text style={{ fontSize: 8, color: delta === null ? theme.muted : good ? theme.good : theme.warning }}>{label} vs 上月同期</Text>;
}

function Funnel({ snapshot, theme }: { snapshot: ReportSnapshot; theme: ReportTheme }) {
  const totals = snapshot.current.totals;
  const max = Math.max(1, totals.leads);
  const rows = [
    ["Lead", totals.leads, theme.accent],
    ["Book", totals.bookings, theme.darkSoft],
    ["Show", totals.shows, theme.good],
  ] as const;
  return (
    <View style={{ width: "56%", gap: 15 }}>
      {rows.map(([label, value, color]) => (
        <View key={label}>
          <View style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
            <Text style={{ fontSize: 9, fontWeight: 700 }}>{label}</Text>
            <Text style={{ fontSize: 9, fontWeight: 700 }}>{count(value)}</Text>
          </View>
          <View style={{ height: 22, borderRadius: 6, backgroundColor: theme.accentSoft }}>
            <View style={{ width: `${Math.max(3, (value / max) * 100)}%`, height: 22, borderRadius: 6, backgroundColor: color }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function TrendChart({ snapshot, theme }: { snapshot: ReportSnapshot; theme: ReportTheme }) {
  const width = 820;
  const height = 230;
  const left = 42;
  const top = 18;
  const plotWidth = 748;
  const plotHeight = 165;
  const max = Math.max(1, ...snapshot.daily.flatMap((row) => [row.metrics.leads, row.metrics.bookings, row.metrics.shows]));
  const x = (index: number) => left + (snapshot.daily.length <= 1 ? plotWidth / 2 : (index / (snapshot.daily.length - 1)) * plotWidth);
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const series = [
    { key: "leads", label: "Lead", color: theme.accent, values: snapshot.daily.map((row) => row.metrics.leads) },
    { key: "bookings", label: "Book", color: theme.darkSoft, values: snapshot.daily.map((row) => row.metrics.bookings) },
    { key: "shows", label: "Show", color: theme.good, values: snapshot.daily.map((row) => row.metrics.shows) },
  ];
  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <Line key={ratio} x1={left} y1={top + ratio * plotHeight} x2={left + plotWidth} y2={top + ratio * plotHeight} stroke={theme.line} strokeWidth={0.7} />
        ))}
        {series.map((item) => (
          <Polyline key={item.key} points={item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} fill="none" stroke={item.color} strokeWidth={2.6} />
        ))}
      </Svg>
      <View style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", marginTop: -30, paddingHorizontal: 40 }}>
        {snapshot.daily.filter((_, index) => index === 0 || index === snapshot.daily.length - 1 || index % Math.max(1, Math.ceil(snapshot.daily.length / 6)) === 0).map((row) => (
          <Text key={row.date} style={{ fontSize: 7, color: theme.muted }}>{shortDate(row.date)}</Text>
        ))}
      </View>
      <View style={{ display: "flex", flexDirection: "row", gap: 18, marginTop: 12, marginLeft: 42 }}>
        {series.map((item) => (
          <View key={item.key} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 16, height: 3, backgroundColor: item.color }} />
            <Text style={{ fontSize: 8, color: theme.muted }}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function NarrativeCard({ item, theme }: { item: ReportNarrativeItem; theme: ReportTheme }) {
  const color = item.tone === "positive" ? theme.good : item.tone === "attention" ? theme.warning : theme.accent;
  return (
    <View style={{ borderLeftWidth: 4, borderLeftColor: color, backgroundColor: "#FAF8F9", borderRadius: 8, padding: 13, marginBottom: 9 }}>
      <Text style={{ fontSize: 10, fontWeight: 700, color: theme.dark }}>{item.title}</Text>
      <Text style={{ fontSize: 8, lineHeight: 1.45, color: theme.muted, marginTop: 4 }}>{item.detail}</Text>
    </View>
  );
}

function BreakdownTable({ rows, theme, treatment }: { rows: ReportBreakdownRow[]; theme: ReportTheme; treatment?: boolean }) {
  return (
    <View style={{ borderWidth: 1, borderColor: theme.line, borderRadius: 8, overflow: "hidden" }}>
      <View style={[styles.tableHeader, { backgroundColor: theme.dark, color: "#FFFFFF" }]}>
        <Text style={[styles.th, { width: "31%" }]}>{treatment ? "療程／品牌" : "品牌"}</Text>
        <Text style={[styles.th, { width: "11%", textAlign: "right" }]}>Lead</Text>
        <Text style={[styles.th, { width: "11%", textAlign: "right" }]}>Book</Text>
        <Text style={[styles.th, { width: "11%", textAlign: "right" }]}>Show</Text>
        <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>Book Rate</Text>
        <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>Show-up</Text>
        <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>{treatment ? "Spend" : "CPL"}</Text>
      </View>
      {rows.map((row, index) => (
        <View key={row.key} style={[styles.tableRow, { borderBottomColor: theme.line, backgroundColor: index % 2 ? "#FAF8F9" : "#FFFFFF" }]}>
          <View style={{ width: "31%" }}>
            <Text style={[styles.td, { fontWeight: 700 }]}>{row.label}</Text>
            <Text style={{ fontSize: 6.6, color: theme.muted, marginTop: 2 }}>{row.detail}</Text>
          </View>
          <Text style={[styles.td, { width: "11%", textAlign: "right" }]}>{count(row.metrics.leads)}</Text>
          <Text style={[styles.td, { width: "11%", textAlign: "right" }]}>{count(row.metrics.bookings)}</Text>
          <Text style={[styles.td, { width: "11%", textAlign: "right" }]}>{count(row.metrics.shows)}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{percentage(row.metrics.bookRate)}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{percentage(row.metrics.showUpRate)}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{treatment ? "未分配" : money(row.metrics.cpl, 2)}</Text>
        </View>
      ))}
    </View>
  );
}

function DailyTable({ rows, theme }: { rows: ReportSnapshot["daily"]; theme: ReportTheme }) {
  return (
    <View style={{ borderWidth: 1, borderColor: theme.line, borderRadius: 8, overflow: "hidden" }}>
      <View style={[styles.tableHeader, { backgroundColor: theme.dark, color: "#FFFFFF" }]}>
        {["日期", "Spend", "Lead", "Book", "Show", "No-show", "Pending", "CPL"].map((label, index) => (
          <Text key={label} style={[styles.th, { width: index === 0 ? "16%" : "12%", textAlign: index === 0 ? "left" : "right" }]}>{label}</Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={row.date} style={[styles.tableRow, { borderBottomColor: theme.line, backgroundColor: index % 2 ? "#FAF8F9" : "#FFFFFF" }]}>
          <Text style={[styles.td, { width: "16%" }]}>{row.date}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{money(row.metrics.spend)}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{count(row.metrics.leads)}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{count(row.metrics.bookings)}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{count(row.metrics.shows)}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{count(row.metrics.noShows)}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{count(row.metrics.pendingShows)}</Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>{money(row.metrics.cpl, 2)}</Text>
        </View>
      ))}
    </View>
  );
}

function chunks<T>(rows: T[], size: number) {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
}

function ReportPdfDocument({ snapshot }: { snapshot: ReportSnapshot }) {
  const theme = reportTheme(snapshot);
  const previous = snapshot.comparison?.totals ?? null;
  const metricCards = [
    ["廣告費", money(snapshot.current.totals.spend), "Daily Spend Ledger"],
    ["Lead", count(snapshot.current.totals.leads), "查詢日期歸屬"],
    ["Book", count(snapshot.current.totals.bookings), percentage(snapshot.current.totals.bookRate) + " Book Rate"],
    ["Show", count(snapshot.current.totals.shows), percentage(snapshot.current.totals.showUpRate) + " Show-up"],
  ];
  const brandPages = snapshot.selection.breakdowns.includes("brand") ? chunks(snapshot.brandRows, 10) : [];
  const treatmentPages = snapshot.selection.breakdowns.includes("treatment") ? chunks(snapshot.treatmentRows, 10) : [];
  const dailyPages = chunks(snapshot.daily, 14);

  return (
    <Document title={snapshot.title} author="Alyssa Growth OS" subject={`${snapshot.current.label} performance report`} keywords="Growth OS, marketing, performance">
      <Page size={REPORT_PAGE_SIZE} style={[styles.page, { padding: 0, backgroundColor: theme.coverLight ? "#FFF9F4" : theme.dark, color: theme.coverLight ? theme.dark : "#FFFFFF" }]}>
        <View style={{ width: 15, height: 540, backgroundColor: theme.accent, position: "absolute", left: 0, top: 0 }} />
        <View style={{ paddingLeft: 70, paddingRight: 60, paddingTop: 58 }}>
          <Text style={{ fontSize: 9, fontWeight: 700, color: theme.coverLight ? theme.accent : theme.accentSoft, letterSpacing: 2 }}>ALYSSA GROWTH OS · MANAGEMENT REPORT</Text>
          {/* @react-pdf Image does not expose the HTML alt attribute. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={reportLogo(snapshot)} style={{ width: snapshot.selection.brands[0]?.logoKey === "ineffable" ? 190 : 155, height: snapshot.selection.brands[0]?.logoKey === "ineffable" ? 112 : 80, objectFit: "contain", objectPosition: "left", marginTop: 38 }} />
          <Text style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.15, marginTop: 30, maxWidth: 710 }}>{snapshot.title}</Text>
          <Text style={{ fontSize: 15, marginTop: 16, color: theme.coverLight ? theme.muted : "#EFDCE5" }}>{snapshot.current.startDate} — {snapshot.current.endDate}</Text>
          <View style={{ display: "flex", flexDirection: "row", gap: 10, marginTop: 32 }}>
            <View style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20, backgroundColor: theme.coverLight ? theme.accentSoft : theme.darkSoft }}>
              <Text style={{ fontSize: 8, fontWeight: 700 }}>{snapshot.selection.brandLabel}</Text>
            </View>
            <View style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20, backgroundColor: theme.coverLight ? "#FFFFFF" : theme.darkSoft }}>
              <Text style={{ fontSize: 8, fontWeight: 700 }}>{snapshot.comparison ? "上月同期對比" : "不作同期對比"}</Text>
            </View>
          </View>
        </View>
        <View style={{ position: "absolute", bottom: 35, left: 70, right: 60, display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 7.5, color: theme.coverLight ? theme.muted : "#D8BCC9" }}>Snapshot {snapshot.snapshotId}</Text>
          <Text style={{ fontSize: 7.5, color: theme.coverLight ? theme.muted : "#D8BCC9" }}>{dateTimeHkt(snapshot.generatedAt)}</Text>
        </View>
      </Page>

      <ReportPage snapshot={snapshot} theme={theme} kicker="Executive overview" title="管理層一頁摘要" subtitle="所有數字來自同一份不可修改彙總快照；PDF 文字可搜尋。">
        <View style={styles.cardRow}>
          {metricCards.map(([label, value, note]) => <MetricCard key={label} label={label} value={value} note={note} theme={theme} />)}
        </View>
        <View style={{ display: "flex", flexDirection: "row", gap: 18, marginTop: 22 }}>
          <View style={{ width: "49%" }}>
            <Text style={[styles.sectionTitle, { color: theme.dark }]}>轉換效率</Text>
            {[
              ["Lead → Book", percentage(snapshot.current.totals.bookRate), snapshot.current.totals.bookRate, previous?.bookRate ?? null],
              ["Book → Show", percentage(snapshot.current.totals.showUpRate), snapshot.current.totals.showUpRate, previous?.showUpRate ?? null],
              ["Lead → Show", percentage(snapshot.current.totals.leadToShowRate), snapshot.current.totals.leadToShowRate, previous?.leadToShowRate ?? null],
            ].map(([label, value, current, prior]) => (
              <View key={String(label)} style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 0.7, borderBottomColor: theme.line }}>
                <Text style={{ fontSize: 9 }}>{String(label)}</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 13, fontWeight: 700 }}>{String(value)}</Text>
                  <ComparisonNote current={current as number | null} previous={prior as number | null} theme={theme} />
                </View>
              </View>
            ))}
          </View>
          <View style={{ width: "49%" }}>
            <Text style={[styles.sectionTitle, { color: theme.dark }]}>即時判讀</Text>
            {snapshot.insights.slice(0, 3).map((item) => <NarrativeCard key={item.title} item={item} theme={theme} />)}
          </View>
        </View>
      </ReportPage>

      <ReportPage snapshot={snapshot} theme={theme} kicker="Funnel" title="漏斗量與轉換" subtitle="Book、Show、No-show 及 Pending Show 來自 Lead Sheet 狀態彙總。">
        <View style={{ display: "flex", flexDirection: "row", gap: 42 }}>
          <Funnel snapshot={snapshot} theme={theme} />
          <View style={{ width: "39%", backgroundColor: "#FAF8F9", padding: 18, borderRadius: 10 }}>
            <Text style={[styles.sectionTitle, { color: theme.dark }]}>漏斗狀態</Text>
            {[
              ["已到店 Show", count(snapshot.current.totals.shows)],
              ["No-show", count(snapshot.current.totals.noShows)],
              ["待到店 Pending", count(snapshot.current.totals.pendingShows)],
              ["Lead → Show", percentage(snapshot.current.totals.leadToShowRate)],
            ].map(([label, value]) => (
              <View key={label} style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 0.7, borderBottomColor: theme.line }}>
                <Text style={{ fontSize: 8.5, color: theme.muted }}>{label}</Text>
                <Text style={{ fontSize: 11, fontWeight: 700 }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      </ReportPage>

      <ReportPage snapshot={snapshot} theme={theme} kicker="Daily trend" title="每日成效走勢" subtitle="同一日期軸顯示 Lead、Book、Show；圖表為向量線條。">
        <TrendChart snapshot={snapshot} theme={theme} />
      </ReportPage>

      <ReportPage snapshot={snapshot} theme={theme} kicker="Efficiency" title="成本效率與同期變化" subtitle={snapshot.comparison ? `比較窗口：${snapshot.comparison.label}` : "今次未有啟用同期比較。"}>
        <View style={{ display: "flex", flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          {[
            ["CPL", money(snapshot.current.totals.cpl, 2), snapshot.current.totals.cpl, previous?.cpl ?? null, true],
            ["CPA · Book", money(snapshot.current.totals.costPerBooking, 2), snapshot.current.totals.costPerBooking, previous?.costPerBooking ?? null, true],
            ["CPA · Show", money(snapshot.current.totals.costPerShow, 2), snapshot.current.totals.costPerShow, previous?.costPerShow ?? null, true],
            ["Lead", count(snapshot.current.totals.leads), snapshot.current.totals.leads, previous?.leads ?? null, false],
            ["Book", count(snapshot.current.totals.bookings), snapshot.current.totals.bookings, previous?.bookings ?? null, false],
            ["Show", count(snapshot.current.totals.shows), snapshot.current.totals.shows, previous?.shows ?? null, false],
          ].map(([label, value, current, prior, lower]) => (
            <View key={String(label)} style={{ width: "31.8%", minHeight: 118, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: theme.line, backgroundColor: "#FFFFFF" }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: theme.muted }}>{String(label)}</Text>
              <Text style={{ fontSize: 22, fontWeight: 700, color: theme.dark, marginTop: 8 }}>{String(value)}</Text>
              <View style={{ marginTop: 9 }}><ComparisonNote current={current as number | null} previous={prior as number | null} lowerIsBetter={Boolean(lower)} theme={theme} /></View>
            </View>
          ))}
        </View>
      </ReportPage>

      <ReportPage snapshot={snapshot} theme={theme} kicker="Media mix" title="廣告費渠道組合" subtitle="只採用 Daily Spend Ledger；舊資料未分類會獨立顯示。">
        {snapshot.spendMix.length === 0 ? (
          <View style={{ marginTop: 28, padding: 24, borderRadius: 10, backgroundColor: theme.accentSoft }}>
            <Text style={{ fontSize: 15, fontWeight: 700, color: theme.dark }}>未有廣告費資料</Text>
            <Text style={{ marginTop: 9, fontSize: 9, lineHeight: 1.6, color: theme.muted }}>揀選日期內未有 Daily Spend Ledger 記錄，因此本頁不顯示渠道金額或比例。</Text>
          </View>
        ) : (
          <View style={{ gap: 13, marginTop: 4 }}>
            {snapshot.spendMix.map((row) => (
            <View key={row.key}>
              <View style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                <Text style={{ fontSize: 9, fontWeight: 700 }}>{row.label}</Text>
                <Text style={{ fontSize: 9 }}>{money(row.amount, 2)} · {percentage(row.share)}</Text>
              </View>
              <View style={{ height: 18, borderRadius: 6, backgroundColor: theme.accentSoft }}>
                <View style={{ height: 18, width: `${Math.max(row.amount > 0 ? 2 : 0, (row.share ?? 0) * 100)}%`, borderRadius: 6, backgroundColor: row.key === "legacy_unclassified" ? theme.warning : theme.accent }} />
              </View>
            </View>
            ))}
          </View>
        )}
      </ReportPage>

      {brandPages.map((rows, index) => (
        <ReportPage key={`brand-${index}`} snapshot={snapshot} theme={theme} kicker="Breakdown · Brand" title={`按品牌拆分${brandPages.length > 1 ? ` (${index + 1}/${brandPages.length})` : ""}`} subtitle="品牌層可歸屬 Daily Spend，因此顯示 CPL。">
          <BreakdownTable rows={rows} theme={theme} />
        </ReportPage>
      ))}

      {treatmentPages.map((rows, index) => (
        <ReportPage key={`treatment-${index}`} snapshot={snapshot} theme={theme} kicker="Breakdown · Treatment" title={`按療程拆分${treatmentPages.length > 1 ? ` (${index + 1}/${treatmentPages.length})` : ""}`} subtitle="目前廣告費只記錄到品牌層；療程頁不估算或攤分 Spend／CPL。">
          <BreakdownTable rows={rows} theme={theme} treatment />
        </ReportPage>
      ))}

      <ReportPage snapshot={snapshot} theme={theme} kicker="Decision support" title="洞察與下一步" subtitle="規則式判讀由快照數字直接產生，不加入無來源推測。">
        <View style={{ display: "flex", flexDirection: "row", gap: 24 }}>
          <View style={{ width: "49%" }}>
            <Text style={[styles.sectionTitle, { color: theme.dark }]}>數據洞察</Text>
            {snapshot.insights.map((item) => <NarrativeCard key={item.title} item={item} theme={theme} />)}
          </View>
          <View style={{ width: "49%" }}>
            <Text style={[styles.sectionTitle, { color: theme.dark }]}>建議行動</Text>
            {snapshot.actions.map((item) => <NarrativeCard key={item.title} item={item} theme={theme} />)}
          </View>
        </View>
      </ReportPage>

      {dailyPages.map((rows, index) => (
        <ReportPage key={`daily-${index}`} snapshot={snapshot} theme={theme} kicker="Audit table" title={`每日數據核對${dailyPages.length > 1 ? ` (${index + 1}/${dailyPages.length})` : ""}`} subtitle="每行均可追溯到同一 report snapshot；不包含客戶姓名、電話或 CRM 備註。">
          <DailyTable rows={rows} theme={theme} />
        </ReportPage>
      ))}

      <ReportPage snapshot={snapshot} theme={theme} kicker="Data contract" title="數據品質與口徑" subtitle={`快照 SHA-256：${snapshot.snapshotSha256}`}>
        <View style={{ display: "flex", flexDirection: "row", gap: 22 }}>
          <View style={{ width: "45%", padding: 18, borderRadius: 10, backgroundColor: theme.accentSoft }}>
            <Text style={[styles.sectionTitle, { color: theme.dark }]}>本次品質狀態</Text>
            <Text style={{ fontSize: 22, fontWeight: 700, color: snapshot.dataQuality.status === "complete" ? theme.good : snapshot.dataQuality.status === "missing" ? theme.warning : theme.accent }}>{snapshot.dataQuality.status === "complete" ? "完整" : snapshot.dataQuality.status === "missing" ? "未有數據" : "部分完整"}</Text>
            <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 10 }}>Lead Sheet：{snapshot.dataQuality.sourceStatus}</Text>
            <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 5 }}>最後同步：{dateTimeHkt(snapshot.dataQuality.sourceLastSuccessAt)}</Text>
            <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 5 }}>Spend 完整品牌日：{snapshot.dataQuality.spendCompleteBrandDays}/{snapshot.dataQuality.spendExpectedBrandDays}</Text>
            <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 5 }}>彙總行：{count(snapshot.dataQuality.factRows)} · Spend 行：{count(snapshot.dataQuality.spendRows)}</Text>
          </View>
          <View style={{ width: "53%" }}>
            <Text style={[styles.sectionTitle, { color: theme.dark }]}>指標定義</Text>
            {[
              ["Book Rate", "Book ÷ Lead"],
              ["Show-up Rate", "Show ÷ Book"],
              ["CPL", "品牌層 Spend ÷ Lead"],
              ["CPA · Book / Show", "品牌層 Spend ÷ Book / Show"],
              ["療程 Spend", "未分配；不作推算"],
              ["同期", "上月相同日號窗口，月底按實際日數截短"],
            ].map(([label, detail]) => (
              <View key={label} style={{ display: "flex", flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.7, borderBottomColor: theme.line }}>
                <Text style={{ width: "34%", fontSize: 8, fontWeight: 700 }}>{label}</Text>
                <Text style={{ width: "66%", fontSize: 8, color: theme.muted }}>{detail}</Text>
              </View>
            ))}
            {snapshot.dataQuality.warnings.map((warning) => <Text key={warning} style={{ fontSize: 7.5, color: theme.warning, marginTop: 8 }}>• {warning}</Text>)}
          </View>
        </View>
      </ReportPage>
    </Document>
  );
}

export async function renderReportPdf(snapshot: ReportSnapshot) {
  return renderToBuffer(<ReportPdfDocument snapshot={snapshot} />);
}
