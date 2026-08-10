import {
  Ban,
  CheckCircle2,
  ChevronDown,
  CirclePause,
  KeyRound,
  MailCheck,
  PencilLine,
  RotateCw,
  Save,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  createWorkspaceMemberAction,
  resendWorkspaceInviteAction,
  revokeWorkspaceMemberAction,
  setWorkspaceMemberStatusAction,
  updateWorkspaceMemberAccessAction,
} from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import {
  getCommandCenterSnapshot,
  type CommandCenterSnapshot,
  type WorkspaceMember,
} from "@/lib/marketing/commandCenter";
import {
  getWorkspaceRoleDefaultModules,
  normalizeWorkspaceRole,
} from "@/lib/security/workspacePermissions";
import {
  getSupabasePublicAuthConfig,
  isWorkspaceEmailAuthRequired,
} from "@/lib/supabase/authConfig";

export const dynamic = "force-dynamic";

const roles = [
  ["admin", "管理員"],
  ["manager", "經理"],
  ["marketer", "市場營銷"],
  ["cs", "客戶服務"],
  ["designer", "設計"],
  ["viewer", "只讀"],
] as const;

const modules = [
  ["dashboard", "Dashboard"],
  ["kpis", "品牌 KPI"],
  ["calendar", "營銷日曆"],
  ["launchhub", "建立 Wix Form"],
  ["leads", "Leads"],
  ["lead_audit", "Lead 變更監察"],
  ["crm", "CRM"],
  ["performance", "療程成效及同期對比"],
  ["data_sources", "資料來源"],
  ["settings", "設定"],
  ["system_audit", "系統狀態"],
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
    getCommandCenterSnapshot({ includeMembers: true }),
    searchParams,
  ]);
  const message = firstParam(query?.message);
  const status = firstParam(query?.command_status);
  const emailAuthReady = getSupabasePublicAuthConfig().ready;
  const emailAuthRequired = isWorkspaceEmailAuthRequired();
  const activeMembers = snapshot.members.filter(
    (member) => member.status === "active"
  );
  const invitedMembers = snapshot.members.filter(
    (member) => member.status === "invited"
  );
  const suspendedMembers = snapshot.members.filter(
    (member) => member.status === "suspended"
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">帳戶管理</p>
              <h1 className="command-page-title">成員及權限</h1>
              <p className="command-page-subtitle">
                邀請團隊成員，並設定角色、品牌同功能權限。
              </p>
            </div>
            <a href="#invite-member" className="command-primary-button">
              <UserPlus size={16} />
              邀請新成員
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

          <section className="member-summary-grid" aria-label="帳戶狀態摘要">
            <article>
              <CheckCircle2 size={17} />
              <span>已啟用帳戶</span>
              <strong>{activeMembers.length}</strong>
            </article>
            <article>
              <MailCheck size={17} />
              <span>待接受邀請</span>
              <strong>{invitedMembers.length}</strong>
            </article>
            <article>
              <CirclePause size={17} />
              <span>已暫停帳戶</span>
              <strong>{suspendedMembers.length}</strong>
            </article>
          </section>

          <div className="auth-transition-notice">
            {emailAuthRequired ? <MailCheck size={18} /> : <KeyRound size={18} />}
            <div>
              <strong>安全登入連結由呢一頁寄出</strong>
              <p>
                收件人會直接開啟 app.beautytrialhk.com；完成首次身份確認後，帳戶會自動轉為「已啟用」。
              </p>
            </div>
          </div>
          {!emailAuthReady ? (
            <div className="auth-transition-notice is-warning">
              <Ban size={18} />
              <div>
                <strong>身份驗證連接未完成</strong>
                <p>
                  成員及權限仍可查看，但暫時未能建立帳戶或寄送登入連結。
                </p>
              </div>
            </div>
          ) : null}

          <MemberSection
            eyebrow="帳戶狀態"
            title="已啟用帳戶"
            description="包括系統擁有人及已完成首次身份確認嘅帳戶。"
            members={activeMembers}
            snapshot={snapshot}
            emptyMessage="暫時未有已啟用成員帳戶。"
          />

          <MemberSection
            eyebrow="等待確認"
            title="待接受邀請"
            description="已建立權限、但成員未完成首次安全連結確認。"
            members={invitedMembers}
            snapshot={snapshot}
            emptyMessage="暫時冇待接受邀請。"
          />

          {suspendedMembers.length > 0 ? (
            <MemberSection
              eyebrow="已停用"
              title="已暫停帳戶"
              description="帳戶暫時不能登入；系統擁有人可重新啟用。"
              members={suspendedMembers}
              snapshot={snapshot}
              emptyMessage=""
            />
          ) : null}

          <section
            id="invite-member"
            className="command-surface invite-member-section"
          >
            <header>
              <div>
                <p>新增成員</p>
                <h2>邀請新成員並分配權限</h2>
                <span>
                  提交後會先儲存品牌及功能權限，再寄出安全登入連結。
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
                  <span>角色</span>
                  <select name="role" defaultValue="viewer">
                    {roles.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <PermissionFields snapshot={snapshot} />

              <footer>
                <p>
                  如冇逐項選功能，系統會套用該角色嘅預設權限。
                </p>
                <SubmitButton
                  className="command-primary-button"
                  disabled={!snapshot.schemaReady || !emailAuthReady}
                  pendingLabel="建立權限並寄送…"
                >
                  <UserPlus size={15} />
                  建立帳戶並寄出邀請
                </SubmitButton>
              </footer>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function MemberSection({
  eyebrow,
  title,
  description,
  members,
  snapshot,
  emptyMessage,
}: {
  eyebrow: string;
  title: string;
  description: string;
  members: WorkspaceMember[];
  snapshot: CommandCenterSnapshot;
  emptyMessage: string;
}) {
  return (
    <section className="command-surface member-registry">
      <header>
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
          <span>{description}</span>
        </div>
        <span>{members.length} 位</span>
      </header>
      {members.length > 0 ? (
        <div className="member-card-list">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} snapshot={snapshot} />
          ))}
        </div>
      ) : (
        <p className="member-empty-state">{emptyMessage}</p>
      )}
    </section>
  );
}

function MemberCard({
  member,
  snapshot,
}: {
  member: WorkspaceMember;
  snapshot: CommandCenterSnapshot;
}) {
  const allowedModules =
    Object.keys(member.modulePermissions).length > 0
      ? Object.entries(member.modulePermissions)
          .filter(([, allowed]) => allowed)
          .map(([key]) => key)
      : getWorkspaceRoleDefaultModules(normalizeWorkspaceRole(member.role));
  const brandNames = member.isMaster
    ? ["全部品牌"]
    : snapshot.brands
        .filter((brand) => member.brandIds.includes(brand.id))
        .map((brand) => brand.name);
  const roleLabel =
    roles.find(([value]) => value === member.role)?.[1] || member.role;

  return (
    <article className="member-card">
      <div className="member-card-main">
        <div className="member-identity">
          <span>{initials(member.fullName || member.email)}</span>
          <div>
            <strong>{member.fullName || "未命名"}</strong>
            <small>{member.email}</small>
          </div>
          {member.isMaster ? (
            <em>
              <ShieldCheck size={12} />
              系統擁有人
            </em>
          ) : null}
        </div>
        <div className="member-card-meta">
          <span>
            <small>角色</small>
            <strong>{member.isMaster ? "系統擁有人" : roleLabel}</strong>
          </span>
          <span>
            <small>品牌</small>
            <strong>{brandNames.length > 0 ? brandNames.join("、") : "未授權"}</strong>
          </span>
          <span>
            <small>功能</small>
            <strong>
              {member.isMaster ? "全部功能" : `${allowedModules.length} 個模組`}
            </strong>
          </span>
          <span>
            <small>狀態</small>
            <strong>
              <i className={`member-status member-status-${member.status}`}>
                {memberStatusLabel(member.status)}
              </i>
            </strong>
          </span>
        </div>
      </div>

      <div className="member-delivery-line">
        <span>{memberActivityLabel(member)}</span>
        <span>{memberDeliveryLabel(member)}</span>
      </div>

      {!member.isMaster ? (
        <>
          <details className="member-access-editor">
            <summary>
              <span>
                <PencilLine size={14} />
                更改權限
              </span>
              <ChevronDown size={15} />
            </summary>
            <form action={updateWorkspaceMemberAccessAction}>
              <input type="hidden" name="memberId" value={member.id} />
              <div className="member-basic-grid">
                <label>
                  <span>姓名</span>
                  <input
                    name="fullName"
                    defaultValue={member.fullName || ""}
                    placeholder="成員姓名"
                  />
                </label>
                <label>
                  <span>公司電郵</span>
                  <input value={member.email} readOnly aria-readonly="true" />
                </label>
                <label>
                  <span>角色</span>
                  <select name="role" defaultValue={member.role}>
                    {roles.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <PermissionFields
                snapshot={snapshot}
                selectedBrandIds={member.brandIds}
                selectedModuleKeys={allowedModules}
              />
              <footer>
                <p>
                  儲存後即時生效，毋須重新建立帳戶。
                </p>
                <SubmitButton
                  className="command-primary-button"
                  pendingLabel="儲存權限…"
                >
                  <Save size={14} />
                  儲存權限
                </SubmitButton>
              </footer>
            </form>
          </details>

          <div className="member-card-actions">
            {member.status === "active" || member.status === "invited" ? (
              <form action={resendWorkspaceInviteAction}>
                <input type="hidden" name="memberId" value={member.id} />
                <SubmitButton
                  className="member-action-button"
                  pendingLabel="寄送中…"
                >
                  <RotateCw size={12} />
                  {member.status === "active" ? "寄出新登入連結" : "重發邀請"}
                </SubmitButton>
              </form>
            ) : null}
            <form action={setWorkspaceMemberStatusAction}>
              <input type="hidden" name="memberId" value={member.id} />
              <input
                type="hidden"
                name="status"
                value={member.status === "suspended" ? "active" : "suspended"}
              />
              <ConfirmSubmitButton
                className="member-action-button"
                pendingLabel={
                  member.status === "suspended" ? "重新啟用中…" : "暫停中…"
                }
                confirmMessage={
                  member.status === "suspended"
                    ? `確定重新啟用 ${member.email}？`
                    : `確定暫停 ${member.email}？現有登入會被拒絕。`
                }
              >
                {member.status === "suspended" ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <CirclePause size={12} />
                )}
                {member.status === "suspended" ? "重新啟用" : "暫停帳戶"}
              </ConfirmSubmitButton>
            </form>
            <form action={revokeWorkspaceMemberAction}>
              <input type="hidden" name="memberId" value={member.id} />
              <ConfirmSubmitButton
                className="member-action-button is-danger"
                pendingLabel="移除中…"
                confirmMessage={`確定永久移除 ${member.email} 嘅工作區權限？`}
              >
                <UserMinus size={12} />
                移除帳戶
              </ConfirmSubmitButton>
            </form>
          </div>
        </>
      ) : (
        <p className="member-master-lock">
          <ShieldCheck size={13} />
          系統擁有人永久保留全部控制權，不能停用或移除。
        </p>
      )}
    </article>
  );
}

function PermissionFields({
  snapshot,
  selectedBrandIds = [],
  selectedModuleKeys = [],
}: {
  snapshot: CommandCenterSnapshot;
  selectedBrandIds?: string[];
  selectedModuleKeys?: string[];
}) {
  return (
    <>
      <fieldset className="member-permission-fieldset">
        <legend>可使用品牌</legend>
        <div>
          {snapshot.brands.map((brand) => (
            <label key={brand.id}>
              <input
                type="checkbox"
                name="brandIds"
                value={brand.id}
                defaultChecked={selectedBrandIds.includes(brand.id)}
              />
              <i style={{ background: brand.color }} />
              <span>{brand.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="member-permission-fieldset">
        <legend>可使用功能</legend>
        <div>
          {modules.map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                name="moduleKeys"
                value={value}
                defaultChecked={selectedModuleKeys.includes(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
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

function memberStatusLabel(status: string) {
  if (status === "active") return "已啟用";
  if (status === "invited") return "待接受";
  if (status === "suspended") return "已暫停";
  return status;
}

function memberActivityLabel(member: WorkspaceMember) {
  if (member.lastSignInAt) {
    return `上次登入：${formatMemberTime(member.lastSignInAt)}`;
  }
  if (member.inviteAcceptedAt) {
    return `首次確認：${formatMemberTime(member.inviteAcceptedAt)}`;
  }
  if (member.inviteAttemptedAt) {
    return `上次寄送嘗試：${formatMemberTime(member.inviteAttemptedAt)}`;
  }
  return "未有登入紀錄";
}

function memberDeliveryLabel(member: WorkspaceMember) {
  if (member.inviteDeliveryStatus === "accepted") return "身份已確認";
  if (member.inviteDeliveryStatus === "submitted") {
    return "郵件服務已接受寄送";
  }
  if (member.inviteDeliveryStatus === "failed") return "上次寄送未成功";
  if (member.inviteDeliveryStatus === "suppressed") return "寄送已停止";
  return member.isMaster ? "系統擁有人" : "尚未寄送";
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
