import {
  KeyRound,
  MailCheck,
  RotateCw,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  createWorkspaceMemberAction,
  resendWorkspaceInviteAction,
  revokeWorkspaceMemberAction,
} from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { getCommandCenterSnapshot } from "@/lib/marketing/commandCenter";
import {
  getSupabasePublicAuthConfig,
  isWorkspaceAuthSmtpVerified,
  isWorkspaceEmailAuthRequired,
} from "@/lib/supabase/authConfig";

export const dynamic = "force-dynamic";

const roles = [
  ["admin", "Admin"],
  ["manager", "Manager"],
  ["marketer", "Marketer"],
  ["cs", "Customer Service"],
  ["designer", "Designer"],
  ["viewer", "Viewer"],
] as const;

const modules = [
  ["dashboard", "主頁總覽"],
  ["kpis", "品牌 KPI"],
  ["calendar", "營銷日曆"],
  ["launchhub", "LaunchHub"],
  ["leads", "Leads"],
  ["crm", "CRM"],
  ["performance", "療程成效"],
  ["data_sources", "資料來源"],
  ["settings", "設定"],
  ["system_audit", "System Audit"],
] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    command_status?: string | string[];
    message?: string | string[];
  }>;
}) {
  const [snapshot, query] = await Promise.all([
    getCommandCenterSnapshot(),
    searchParams,
  ]);
  const message = firstParam(query?.message);
  const status = firstParam(query?.command_status);
  const emailAuthReady = getSupabasePublicAuthConfig().ready;
  const smtpVerified = isWorkspaceAuthSmtpVerified();
  const emailAuthRequired = isWorkspaceEmailAuthRequired();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">Access Control</p>
              <h1 className="command-page-title">成員及權限</h1>
              <p className="command-page-subtitle">
                Workspace Role 決定預設能力，再用品牌及模組權限收窄範圍。Master
                Account 永遠保留全部品牌同控制權。
              </p>
            </div>
            <a href="#invite-member" className="command-primary-button">
              <UserPlus size={16} />
              邀請成員
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
          <div className="auth-transition-notice">
            {emailAuthRequired ? <MailCheck size={18} /> : <KeyRound size={18} />}
            <div>
              <strong>
                {emailAuthRequired
                  ? "受邀公司電郵登入已啟用"
                  : "公司電郵登入安全切換中"}
              </strong>
              <p>
                {emailAuthRequired
                  ? "未列入呢頁嘅電郵無法建立帳戶；邀請連結只可使用一次，登入後按角色、品牌及模組權限執行。"
                  : "先向 Owner 公司電郵寄一次測試邀請並完成登入；驗收成功後先關閉共用 Password，避免切換時鎖死正式系統。"}
              </p>
            </div>
          </div>
          {!smtpVerified ? (
            <div className="auth-transition-notice is-warning">
              <MailCheck size={18} />
              <div>
                <strong>邀請電郵尚未啟用</strong>
                <p>
                  要先完成 Supabase Auth Custom SMTP 寄送驗證；未驗證前邀請掣會鎖住，
                  避免儲存咗權限但員工收唔到登入連結。
                </p>
              </div>
            </div>
          ) : null}

          <section className="command-surface member-registry">
            <header>
              <div>
                <p>Workspace members</p>
                <h2>成員列表</h2>
              </div>
              <span>{snapshot.members.length} 位</span>
            </header>
            <div className="member-table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>成員</th>
                    <th>Workspace Role</th>
                    <th>品牌</th>
                    <th>模組</th>
                    <th>狀態</th>
                    <th>邀請／操作</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="member-identity">
                          <span>{initials(member.fullName || member.email)}</span>
                          <div>
                            <strong>{member.fullName || "未命名"}</strong>
                            <small>{member.email}</small>
                          </div>
                          {member.isMaster ? (
                            <em>
                              <ShieldCheck size={12} />
                              Master
                            </em>
                          ) : null}
                        </div>
                      </td>
                      <td>{member.role}</td>
                      <td>
                        {member.isMaster
                          ? "全部品牌"
                          : member.brandIds.length > 0
                            ? `${member.brandIds.length} 個品牌`
                            : "未授權"}
                      </td>
                      <td>
                        {member.isMaster
                          ? "全部模組"
                          : Object.values(member.modulePermissions).filter(Boolean)
                              .length || "使用 Role 預設"}
                      </td>
                      <td>
                        <span className={`member-status member-status-${member.status}`}>
                          {member.status}
                        </span>
                      </td>
                      <td>
                        <div className="member-action-stack">
                          <small>
                            {member.lastSignInAt
                              ? `上次登入 ${formatMemberTime(member.lastSignInAt)}`
                              : member.inviteSentAt
                                ? `已寄出 ${formatMemberTime(member.inviteSentAt)}`
                                : "尚未寄出"}
                          </small>
                          <div>
                            <form action={resendWorkspaceInviteAction}>
                              <input
                                type="hidden"
                                name="memberId"
                                value={member.id}
                              />
                              <SubmitButton
                                className="member-action-button"
                                pendingLabel="寄送中…"
                                disabled={!smtpVerified}
                              >
                                <RotateCw size={12} />
                                重發
                              </SubmitButton>
                            </form>
                            {!member.isMaster ? (
                              <form action={revokeWorkspaceMemberAction}>
                                <input
                                  type="hidden"
                                  name="memberId"
                                  value={member.id}
                                />
                                <ConfirmSubmitButton
                                  className="member-action-button is-danger"
                                  pendingLabel="撤回中…"
                                  confirmMessage={`確定撤回 ${member.email} 嘅所有工作區權限？`}
                                >
                                  <UserMinus size={12} />
                                  撤回
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="invite-member"
            className="command-surface invite-member-section"
          >
            <header>
              <div>
                <p>Member setup</p>
                <h2>新增成員權限</h2>
                <span>
                  儲存角色、品牌及模組權限後會即時寄出一次性安全連結。
                  Production 寄信需要 Supabase Auth Custom SMTP。
                </span>
              </div>
              <UsersRound size={24} />
            </header>

            <form action={createWorkspaceMemberAction}>
              <div className="member-basic-grid">
                <label>
                  <span>姓名</span>
                  <input name="fullName" placeholder="成員姓名" />
                </label>
                <label>
                  <span>公司電郵</span>
                  <input
                    type="email"
                    name="email"
                    placeholder="name@alyssa.hk"
                    required
                  />
                </label>
                <label>
                  <span>Workspace Role</span>
                  <select name="role" defaultValue="viewer">
                    {roles.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="member-permission-fieldset">
                <legend>可使用品牌</legend>
                <div>
                  {snapshot.brands.map((brand) => (
                    <label key={brand.id}>
                      <input type="checkbox" name="brandIds" value={brand.id} />
                      <i style={{ background: brand.color }} />
                      <span>{brand.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="member-permission-fieldset">
                <legend>可使用模組</legend>
                <div>
                  {modules.map(([value, label]) => (
                    <label key={value}>
                      <input type="checkbox" name="moduleKeys" value={value} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <footer>
                <p>
                  權限更改會寫入 Audit Log；Master Account
                  不可由一般成員設定覆蓋。
                </p>
                <SubmitButton
                  className="command-primary-button"
                  disabled={
                    !snapshot.schemaReady || !emailAuthReady || !smtpVerified
                  }
                  pendingLabel="建立並寄送…"
                >
                  <UserPlus size={15} />
                  建立權限並寄出邀請
                </SubmitButton>
              </footer>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function initials(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function formatMemberTime(value: string) {
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
