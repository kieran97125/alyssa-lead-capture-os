import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  accessModules,
  canAccessModule,
  getCurrentAccessContext,
  getModuleLabel,
  getRoleLabel,
  getVisibleModulesForRole,
  roleAccess,
  roleDescriptions,
  teamRoles,
} from "@/lib/security/teamAccess";

export default function TeamAccessSettingsPage() {
  const currentAccess = getCurrentAccessContext();
  const visibleModules = getVisibleModulesForRole(currentAccess.role);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            團隊權限
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            團隊權限 / 登入系統預留
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            這頁用來規劃日後登入系統：每位成員有自己的登入、角色權限、可使用功能，
            以及可查看的品牌範圍。
          </p>
          <SettingsNav />
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <InfoCard
            title="目前內部保護"
            body="早期公開網址會先保留簡單保護，正式使用前再加入每位成員自己的登入。"
          />
          <InfoCard
            title="日後登入系統"
            body="下一階段用正式團隊登入連接角色、狀態同品牌存取權限。"
          />
          <InfoCard
            title="可與日後 CRM 共用"
            body="未來 WhatsApp CRM app 可重用同一套團隊角色和品牌存取模型。"
          />
        </section>

        <MotionReveal delay={0.1}>
        <section className="alyssa-premium-card mt-6 min-w-0 p-5">
          <h2 className="text-xl font-bold text-[#321428]">目前查看權限</h2>
          <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
            目前仍未接入每位成員自己的登入。日後會由正式團隊登入、角色和品牌存取權限決定。
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCell label="保護方式" value="暫時內部保護" />
            <InfoCell label="目前角色" value={getRoleLabel(currentAccess.role)} />
            <InfoCell
              label="可查看品牌"
              value={
                currentAccess.brandAccess.scope === "all"
                  ? "All brands"
                  : currentAccess.brandAccess.brandIds.join(", ")
              }
            />
          </div>
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              可使用功能
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleModules.map((module) => (
                <span
                  key={module.key}
                  className="rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#5a2348]"
                >
                  {module.label}
                </span>
              ))}
            </div>
          </div>
        </section>
        </MotionReveal>

        <MotionReveal delay={0.14}>
        <section className="alyssa-premium-card mt-6 min-w-0 p-5">
          <h2 className="text-xl font-bold text-[#321428]">角色模型</h2>
          <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
            以下係權限方向，唔代表已有真實用戶或完整登入系統。
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {teamRoles.map((role) => (
              <article key={role} className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
                <h3 className="text-lg font-bold text-[#321428]">{role}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                  {roleDescriptions[role]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roleAccess[role].map((module) => (
                    <span
                      key={module}
                      className="rounded-full bg-white/78 px-3 py-1 text-xs font-bold text-[#5a2348]"
                    >
                      {getModuleLabel(module)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
        </MotionReveal>

        <MotionReveal delay={0.18}>
        <section className="alyssa-premium-card mt-6 min-w-0 p-5">
          <h2 className="text-xl font-bold text-[#321428]">角色可使用功能</h2>
          <div className="mt-4 max-w-full overflow-x-auto">
            <table className="alyssa-table min-w-[900px] text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
                  <th className="border-b border-[#ead9cf] px-3 py-3">角色</th>
                  {accessModules.map((module) => (
                    <th
                      key={module.key}
                      className="border-b border-[#ead9cf] px-3 py-3"
                    >
                      {module.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamRoles.map((role) => (
                  <tr key={role} className="text-[#5a2348]">
                    <td className="border-b border-[#f1e3dc] px-3 py-3 font-bold">
                      {role}
                    </td>
                    {accessModules.map((module) => (
                      <td
                        key={module.key}
                        className="border-b border-[#f1e3dc] px-3 py-3"
                      >
                        {canAccessModule(role, module.key) ? "可用" : "預留"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </MotionReveal>

        <MotionReveal delay={0.22}>
        <section className="alyssa-premium-card mt-6 min-w-0 p-5">
          <h2 className="text-xl font-bold text-[#321428]">可查看品牌</h2>
          <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
            當正式團隊登入接入後，內部資料頁應按可查看品牌範圍過濾。這裡先展示權限規則，
            暫時不隱藏主要頁面。
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {[
              ["Leads", "只顯示使用者可查看品牌的 Leads。"],
              ["Performance", "只計算可存取品牌的成效數據。"],
              ["Forms", "只顯示可查看品牌的表格設定。"],
              ["Landing Pages", "只顯示可查看品牌的 Landing Pages。"],
            ].map(([title, body]) => (
              <div key={title} className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
                <h3 className="font-bold text-[#321428]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
              </div>
            ))}
          </div>
        </section>
        </MotionReveal>
      </div>
    </main>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <MotionReveal>
    <div className="alyssa-premium-card min-w-0 p-5">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
    </div>
    </MotionReveal>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
        {value}
      </p>
    </div>
  );
}
