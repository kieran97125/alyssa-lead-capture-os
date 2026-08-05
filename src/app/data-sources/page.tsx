import {
  Braces,
  CheckCircle2,
  DatabaseZap,
  ExternalLink,
  FileSpreadsheet,
  History,
  Link2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  createDataSourceAction,
  deleteDataSourceAction,
  syncDataSourceAction,
} from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { DeleteDataSourceButton } from "@/components/command-center/DeleteDataSourceButton";
import {
  getGoogleSheetsOAuthStatus,
  getMissingGoogleSheetsOAuthConfiguration,
} from "@/lib/integrations/googleSheetsOAuth";
import {
  getCommandCenterSnapshot,
  type MarketingDataSource,
  type MarketingReportingWorkbook,
} from "@/lib/marketing/commandCenter";
import { canonicalGoogleSpreadsheetUrl } from "@/lib/marketing/monthlyReportingWorkbooks";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";

const providerLabels: Record<string, string> = {
  launchhub: "建立 Wix Form",
  crm: "CRM",
  google_sheets: "Google Sheets",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  manual_csv: "CSV Import",
  n8n: "n8n Workflow",
  internal_ledger: "系統帳簿",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  connected: "已連接",
  syncing: "同步中",
  warning: "需檢查",
  error: "錯誤",
  paused: "已暫停",
};

const syncModeLabels: Record<string, string> = {
  manual: "手動重新整理",
  scheduled: "自動排程",
  native: "原生連接",
  webhook: "Webhook",
};

const metricLabels: Record<string, string> = {
  spend: "廣告費",
  leads: "Lead",
  bookings: "Book",
  shows: "Show",
  no_shows: "No Show",
  pending_shows: "待到店",
  treatment_performance: "療程成效",
};

const workbookValidationLabels: Record<string, string> = {
  pending: "待驗證",
  valid: "格式已驗證",
  warning: "已接駁 · 有提示",
  error: "驗證失敗",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function DataSourcesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    command_status?: string | string[];
    message?: string | string[];
  }>;
}) {
  const [snapshot, query, googleConnectionStatus, access] = await Promise.all([
    getCommandCenterSnapshot(),
    searchParams,
    getGoogleSheetsOAuthStatus(),
    getCurrentInternalAccess(),
  ]);
  const message = firstParam(query?.message);
  const status = firstParam(query?.command_status);
  const canManageGoogleConnection = access.accessLevel === "master";
  const googleLeadWriteReady =
    googleConnectionStatus.connected && googleConnectionStatus.writeEnabled;
  const missingGoogleOAuthConfiguration =
    getMissingGoogleSheetsOAuthConfiguration(googleConnectionStatus);
  const standaloneSources = snapshot.dataSources.filter(
    (source) => !source.reportingWorkbookId
  );
  const workbookHistory = snapshot.reportingWorkbooks;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">資料連接</p>
              <h1 className="command-page-title">資料來源</h1>
              <p className="command-page-subtitle">
                管理 Lead Sheet、廣告費資料同各來源嘅同步狀態。
              </p>
            </div>
            <a href="/performance/daily" className="command-primary-button">
              <DatabaseZap size={16} />
              填寫每日廣告費
            </a>
          </header>

          {message ? (
            <p
              className={`command-status-message ${
                status === "error" ? "is-error" : "is-success"
              }`}
            >
              {message}
            </p>
          ) : null}
          {!snapshot.schemaReady ? (
            <p className="command-status-message">
              資料連接暫時只供查看，請聯絡系統管理員完成設定。
            </p>
          ) : null}

          <section
            className={`command-surface source-credential-banner ${
              googleLeadWriteReady ? "is-ready" : "is-warning"
            }`}
          >
            <span>
              {googleLeadWriteReady ? (
                <ShieldCheck size={20} />
              ) : (
                <LockKeyhole size={20} />
              )}
            </span>
            <div>
              <strong>
                Google Sheets 一鍵連接
                {googleLeadWriteReady
                  ? "已連接"
                  : googleConnectionStatus.connected
                    ? "需升級寫入權限"
                    : "尚未連接"}
              </strong>
              <p>
                {!canManageGoogleConnection
                  ? "你目前未有 Google 連接權限，請由系統擁有人處理。"
                  : googleLeadWriteReady
                  ? "公司 Google 帳戶已連接；只會同步 CS Lead Sheet 嘅 Lead／Book／Show 及寫入 Lead。廣告費唔再經 Google Sheet。"
                  : googleConnectionStatus.connected
                    ? "現有連接只具唯讀權限；重新連接後先可直接寫入 CS Lead Sheet。"
                  : googleConnectionStatus.ready
                    ? "請使用擁有相關 Sheet 編輯權限嘅公司 Google 帳戶連接。"
                    : "Google 連接尚未完成設定。"}
              </p>
              {canManageGoogleConnection &&
              missingGoogleOAuthConfiguration.length > 0 ? (
                <div
                  className="source-oauth-missing"
                  data-testid="google-oauth-missing-configuration"
                >
                  <strong>尚欠設定</strong>
                  <ul>
                    {missingGoogleOAuthConfiguration.map((item) => (
                      <li key={item.key}>{item.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {googleConnectionStatus.lastErrorSummary ? (
                <p className="mt-2 text-xs font-semibold text-[#a54b45]">
                  {googleConnectionStatus.lastErrorSummary}
                </p>
              ) : null}
            </div>
            {canManageGoogleConnection ? (
              <form
                action="/api/integrations/google-sheets/start"
                method="post"
              >
                <SubmitButton
                  className="command-primary-button"
                  pendingLabel="開啟 Google…"
                  aria-describedby={
                    missingGoogleOAuthConfiguration.length > 0 ||
                    !googleConnectionStatus.tableReady
                      ? "google-oauth-readiness-note"
                      : undefined
                  }
                >
                  <Link2 size={15} />
                  {!googleConnectionStatus.ready
                    ? "檢查連接設定"
                    : googleLeadWriteReady
                    ? "重新連接"
                    : googleConnectionStatus.connected
                      ? "升級連接"
                      : "連接 Google Sheets"}
                </SubmitButton>
                {missingGoogleOAuthConfiguration.length > 0 ||
                !googleConnectionStatus.tableReady ? (
                  <small id="google-oauth-readiness-note">
                    系統會先檢查連接狀態，設定完整後先會開啟 Google 授權。
                  </small>
                ) : null}
              </form>
            ) : (
              <a
                href="/logout"
                className="command-primary-button"
                aria-label="登出並以系統擁有人身份重新登入"
              >
                <Link2 size={15} />
                以系統擁有人身份登入
              </a>
            )}
          </section>

          <section
            id="monthly-workbook"
            className="command-surface monthly-workbook-section"
          >
            <header className="monthly-workbook-header">
              <div>
                <p>歷史對數</p>
                <h2>舊月份廣告費數據表</h2>
                <span>
                  舊月份 Sheet 只保留作對數；新廣告費請到「每日總覽」按類型填寫。
                </span>
              </div>
              <History size={24} />
            </header>

            <div className="monthly-workbook-history">
              <div className="monthly-workbook-history-heading">
                <div>
                  <History size={17} />
                  <div>
                    <strong>歷史數據表</strong>
                    <span>只供開啟數據表、核對品牌及查看最後成功時間</span>
                  </div>
                </div>
                <span>{workbookHistory.length} 個記錄</span>
              </div>
              {workbookHistory.length > 0 ? (
                <div className="monthly-workbook-history-list">
                  {workbookHistory.map((workbook) => (
                    <WorkbookRecord
                      key={workbook.id}
                      workbook={workbook}
                      dataSources={snapshot.dataSources}
                      brands={snapshot.brands}
                    />
                  ))}
                </div>
              ) : (
                <p className="monthly-workbook-history-empty">
                  未有舊月份 Sheet 記錄；廣告費會直接保存在系統帳簿。
                </p>
              )}
            </div>
          </section>

          <section className="source-summary-grid">
            <SourceSummary
              icon={History}
              label="舊月份 Link"
              value={snapshot.reportingWorkbooks.length}
            />
            <SourceSummary
              icon={CheckCircle2}
              label="系統 Spend 帳簿"
              value={
                standaloneSources.filter(
                  (source) => source.providerKey === "internal_ledger"
                ).length
              }
            />
            <SourceSummary
              icon={DatabaseZap}
              label="正式來源"
              value={standaloneSources.length}
            />
            <SourceSummary
              icon={TriangleAlert}
              label="需要處理"
              value={
                standaloneSources.filter((source) =>
                  ["warning", "error"].includes(source.status)
                ).length
              }
            />
          </section>

          <section className="command-surface source-registry">
            <header className="source-registry-header">
              <div>
                <h2>正式資料來源</h2>
              </div>
              <span>{standaloneSources.length} 個來源</span>
            </header>
            <div className="source-table-wrap">
              <table className="source-table">
                <thead>
                  <tr>
                    <th>來源</th>
                    <th>品牌</th>
                    <th>提供指標</th>
                    <th>同步方式</th>
                    <th>上次成功</th>
                    <th>狀態</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {standaloneSources.length > 0 ? (
                    standaloneSources.map((source) => (
                      <SourceRow
                        key={source.id}
                        source={source}
                        brandName={
                          snapshot.brands.find(
                            (brand) => brand.id === source.brandId
                          )?.name ?? "全部品牌"
                        }
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <div className="source-empty-row">
                          <DatabaseZap size={22} />
                          <strong>未有正式資料來源</strong>
                          <span>
                            請先完成 CS Lead Sheet 連接；廣告費會直接保存在系統帳簿。
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="add-source"
            className="command-surface add-source-section"
          >
            <header>
              <div>
                <p>新增連接</p>
                <h2>CS Lead Sheet 進階設定</h2>
                <span>
                  呢區只用作管理 Lead／Book／Show 嘅 CS Lead Sheet。廣告費唔接受再新增 Google Sheet 來源。
                </span>
              </div>
              <ShieldCheck size={24} />
            </header>

            <form action={createDataSourceAction} className="add-source-form">
              <label>
                <span>品牌</span>
                <select name="brandId" defaultValue="">
                  <option value="">全部品牌（跨品牌）</option>
                  {snapshot.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>來源類型</span>
                <select name="providerKey" defaultValue="google_sheets" required>
                  {Object.entries(providerLabels)
                    .filter(([key]) => key !== "internal_ledger")
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>資料格式</span>
                <select name="dataset" defaultValue="lead_funnel">
                  <option value="lead_funnel">
                    Lead Funnel（Lead／Book／Show／療程成效）
                  </option>
                </select>
              </label>
              <label>
                <span>顯示名稱</span>
                <input
                  name="displayName"
                  placeholder="例如：Alyssa Marketing KPI Sheet"
                  required
                />
              </label>
              <label>
                <span>Google Sheet ID</span>
                <input
                  name="sheetId"
                  placeholder="只貼 /spreadsheets/d/ 後面嗰段 ID"
                />
              </label>
              <label>
                <span>工作表名稱</span>
                <input
                  name="tabName"
                  placeholder="例如：Alyssa、IB 或 lead"
                />
              </label>
              <label>
                <span>帳戶標籤</span>
                <input
                  name="accountLabel"
                  placeholder="例如：Alyssa Meta Ads"
                />
              </label>

              <details className="source-mapping-details">
                <summary>進階欄位 Mapping</summary>
                <div className="source-mapping-grid">
                  <label>
                    <span>標題列</span>
                    <input
                      name="headerRow"
                      type="number"
                      min="1"
                      placeholder="Spend 預設 3；Funnel 預設 1"
                    />
                  </label>
                  <label>
                    <span>最多讀取行數</span>
                    <input
                      name="maxRows"
                      type="number"
                      min="1"
                      max="20000"
                      defaultValue="5000"
                    />
                  </label>
                  <label>
                    <span>Lead 表最後欄</span>
                    <input name="lastColumn" defaultValue="V" />
                  </label>
                </div>
                <p className="source-mapping-note">
                  Lead Funnel 會按 header 名稱自動對位，只讀成效所需欄位；調動欄位次序毋須重新設定。
                </p>
              </details>

              <footer>
                <p>
                  CS Lead Sheet 只負責 Funnel 指標。新來源先建立為 Draft；完成一次成功同步後先轉為「已連接」。
                </p>
                <SubmitButton
                  className="command-primary-button"
                  disabled={!snapshot.schemaReady}
                  pendingLabel="建立中…"
                >
                  <Link2 size={15} />
                  建立 Draft
                </SubmitButton>
              </footer>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function WorkbookRecord({
  workbook,
  dataSources,
  brands,
}: {
  workbook: MarketingReportingWorkbook;
  dataSources: MarketingDataSource[];
  brands: Array<{ id: string; name: string }>;
}) {
  const workbookSources = dataSources.filter(
    (source) => source.reportingWorkbookId === workbook.id
  );
  const brandLabels = Array.from(
    new Set(
      workbookSources.map(
        (source) =>
          brands.find((brand) => brand.id === source.brandId)?.name ??
          source.displayName
      )
    )
  );
  const spreadsheetUrl = canonicalGoogleSpreadsheetUrl(
    workbook.spreadsheetId
  );
  const lifecycleLabel = "已退役 · 歷史記錄";
  const statusTone = "is-muted";

  return (
    <article
      className={`monthly-workbook-record ${statusTone}`}
    >
      <div className="monthly-workbook-record-topline">
        <span>{formatReportingMonth(workbook.reportingMonth)}</span>
        <em>{lifecycleLabel}</em>
      </div>
      <h3>{workbook.title}</h3>
      {spreadsheetUrl ? (
        <a href={spreadsheetUrl} target="_blank" rel="noreferrer">
          <FileSpreadsheet size={14} />
          打開原始數據表
          <ExternalLink size={12} />
        </a>
      ) : null}
      <div className="monthly-workbook-brand-tags">
        {brandLabels.length > 0 ? (
          brandLabels.map((label) => <span key={label}>{label}</span>)
        ) : (
          <span>{workbook.linkedBrandCount} 個品牌來源</span>
        )}
      </div>
      <dl className="monthly-workbook-meta">
        <div>
          <dt>格式</dt>
          <dd>
            {workbookValidationLabels[workbook.validationStatus] ||
              workbook.validationStatus}
          </dd>
        </div>
        <div>
          <dt>最近成功</dt>
          <dd>{formatSyncTime(workbook.lastSuccessAt)}</dd>
        </div>
      </dl>
      {workbook.lastErrorSummary ? (
        <p className="monthly-workbook-error">{workbook.lastErrorSummary}</p>
      ) : null}
    </article>
  );
}

function SourceSummary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DatabaseZap;
  label: string;
  value: number;
}) {
  return (
    <article className="command-surface source-summary-card">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SourceRow({
  source,
  brandName,
}: {
  source: MarketingDataSource;
  brandName: string;
}) {
  const ProviderIcon =
    source.providerKey === "google_sheets"
      ? FileSpreadsheet
      : source.providerKey === "n8n"
        ? Braces
        : DatabaseZap;

  return (
    <tr>
      <td>
        <div className="source-name-cell">
          <span>
            <ProviderIcon size={16} />
          </span>
          <div>
            <strong>{source.displayName}</strong>
            <small>{providerLabels[source.providerKey] || source.providerKey}</small>
          </div>
        </div>
      </td>
      <td>{brandName}</td>
      <td>
        <div className="source-metric-tags">
          {source.providesMetrics.length > 0
            ? source.providesMetrics.map((metric) => (
                <span key={metric}>{metricLabels[metric] || metric}</span>
              ))
            : "未設定"}
        </div>
      </td>
      <td>{syncModeLabels[source.syncMode] || source.syncMode}</td>
      <td>{formatSyncTime(source.lastSuccessAt)}</td>
      <td>
        <span className={`source-status source-status-${source.status}`}>
          {statusLabels[source.status] || source.status}
        </span>
        {source.lastErrorSummary ? (
          <small className="source-error-summary">
            {source.lastErrorSummary}
          </small>
        ) : null}
      </td>
      <td className="source-action-cell">
        <div className="source-action-group">
          {source.providerKey === "google_sheets" ? (
            <form action={syncDataSourceAction} className="source-sync-form">
              <input type="hidden" name="dataSourceId" value={source.id} />
              <SubmitButton
                pendingLabel="同步中…"
                aria-label={`同步 ${source.displayName}`}
              >
                <RefreshCw size={13} />
                立即同步
              </SubmitButton>
            </form>
          ) : null}
          {source.providerKey !== "internal_ledger" &&
          !source.reportingWorkbookId ? (
            <DeleteDataSourceButton
              dataSourceId={source.id}
              displayName={source.displayName}
              action={deleteDataSourceAction}
            />
          ) : (
            <small className="source-protected-label">系統管理</small>
          )}
        </div>
      </td>
    </tr>
  );
}

function formatSyncTime(value: string | null) {
  if (!value) return "未同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatReportingMonth(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 7);
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "long",
  }).format(date);
}
