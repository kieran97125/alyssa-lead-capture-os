import {
  Braces,
  CheckCircle2,
  DatabaseZap,
  FileSpreadsheet,
  Link2,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  createDataSourceAction,
  syncDataSourceAction,
} from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import {
  getGoogleSheetsOAuthStatus,
  getMissingGoogleSheetsOAuthConfiguration,
} from "@/lib/integrations/googleSheetsOAuth";
import {
  getCommandCenterSnapshot,
  type MarketingDataSource,
} from "@/lib/marketing/commandCenter";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";

const providerLabels: Record<string, string> = {
  launchhub: "LaunchHub",
  crm: "CRM",
  google_sheets: "Google Sheets",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  manual_csv: "CSV Import",
  n8n: "n8n Workflow",
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

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">Connections</p>
              <h1 className="command-page-title">資料來源</h1>
              <p className="command-page-subtitle">
                管理每個品牌嘅 Google Sheet、廣告平台、LaunchHub、CRM 同 n8n
                接駁。一般設定只保存公開識別及欄位映射，Token／密碼必須留喺受保護憑證層。
              </p>
            </div>
            <a href="#add-source" className="command-primary-button">
              <Plus size={16} />
              新增資料來源
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
              Migration 尚未套用；資料來源表目前只供檢視，未能儲存。
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
                  ? "你目前以一般 Admin 登入；Google 帳戶授權只限 Master。請先重新登入 Master，避免撳掣後原地返回。"
                  : googleLeadWriteReady
                  ? "公司 Google 帳戶已連接；LaunchHub 會按 Sheet 實際 header 自動對位並直接寫入，毋須再更新 Apps Script Web App。"
                  : googleConnectionStatus.connected
                    ? "現有連接只具唯讀權限；請重新授權一次，升級後 LaunchHub 會直接寫入 Lead Sheet。"
                  : googleConnectionStatus.ready
                    ? "以擁有相關 Sheet 編輯權限嘅公司 Gmail 授權一次，毋須 Service Account、JSON Key 或 Apps Script Web App。"
                    : "OAuth Client 部署設定未完成；以下會列出真正欠缺項目，系統未曾驗證任何 Google 帳戶。"}
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
                    撳後會檢查連接設定並顯示實際欠缺項目；未準備好之前唔會開啟
                    Google。
                  </small>
                ) : null}
              </form>
            ) : (
              <a
                href="/logout"
                className="command-primary-button"
                aria-label="登出並以 Master 重新登入"
              >
                <Link2 size={15} />
                以 Master 重新登入
              </a>
            )}
          </section>

          <section className="source-summary-grid">
            <SourceSummary
              icon={DatabaseZap}
              label="已登記"
              value={snapshot.dataSources.length}
            />
            <SourceSummary
              icon={CheckCircle2}
              label="已連接"
              value={
                snapshot.dataSources.filter(
                  (source) => source.status === "connected"
                ).length
              }
            />
            <SourceSummary
              icon={TriangleAlert}
              label="需要處理"
              value={
                snapshot.dataSources.filter((source) =>
                  ["warning", "error"].includes(source.status)
                ).length
              }
            />
            <SourceSummary
              icon={RefreshCw}
              label="同步中"
              value={
                snapshot.dataSources.filter(
                  (source) => source.status === "syncing"
                ).length
              }
            />
          </section>

          <section className="command-surface source-registry">
            <header className="source-registry-header">
              <div>
                <p>Registry</p>
                <h2>現有資料來源</h2>
              </div>
              <span>{snapshot.dataSources.length} 個來源</span>
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
                  </tr>
                </thead>
                <tbody>
                  {snapshot.dataSources.length > 0 ? (
                    snapshot.dataSources.map((source) => (
                      <SourceRow
                        key={source.id}
                        source={source}
                        brandName={
                          snapshot.brands.find(
                            (brand) => brand.id === source.brandId
                          )?.name ?? "全 Workspace"
                        }
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="source-empty-row">
                          <DatabaseZap size={22} />
                          <strong>未有外部資料來源</strong>
                          <span>
                            LaunchHub 現有 Lead 資料仍會正常顯示；新增 Google Sheet
                            或廣告來源後先會開始預算同步。
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
                <p>New connection</p>
                <h2>新增資料來源設定</h2>
                <span>
                  Google Sheet ID 只係文件識別；登入憑證唔會放入呢張表。
                </span>
              </div>
              <ShieldCheck size={24} />
            </header>

            <form action={createDataSourceAction} className="add-source-form">
              <label>
                <span>品牌</span>
                <select name="brandId" defaultValue="">
                  <option value="">全 Workspace（多品牌）</option>
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
                  {Object.entries(providerLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Dataset Profile</span>
                <select name="dataset" defaultValue="daily_spend">
                  <option value="daily_spend">
                    每日廣告費（日期＋Spend）
                  </option>
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
                    <span>Header Row</span>
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
                    <span>Spend 日期欄</span>
                    <input name="dateColumn" defaultValue="A" />
                  </label>
                  <label>
                    <span>Spend 金額欄</span>
                    <input name="spendColumn" defaultValue="N" />
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
                  Dataset Profile 會自動決定指標責任。新來源先建立為
                  Draft；完成一次成功同步後先轉為「已連接」。
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
        {source.lastErrorSummary ? (
          <small className="source-error-summary">
            {source.lastErrorSummary}
          </small>
        ) : null}
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
