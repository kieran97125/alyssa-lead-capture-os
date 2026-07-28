import { KeyRound, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { createWorkspaceMemberAction } from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { getCommandCenterSnapshot } from "@/lib/marketing/commandCenter";

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
  ["data_sources", "資料來源"],
  ["settings", "設定"],
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
              新增成員
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
            <KeyRound size={18} />
            <div>
              <strong>目前仍使用共用 Admin Password</strong>
              <p>
                今次已建立真正成員／品牌／模組權限資料模型，但要到 Supabase Auth
                電郵登入切換後先逐人強制執行。切換前，共用 Admin Session 會當作 Master
                Account。
              </p>
            </div>
          </div>

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
                  目前會建立權限設定但不寄邀請；Supabase Auth rollout
                  後會接正式電郵登入。
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
                <button
                  type="submit"
                  className="command-primary-button"
                  disabled={!snapshot.schemaReady}
                >
                  <UserPlus size={15} />
                  建立成員設定
                </button>
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
