import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  accessModules,
  roleAccess,
  roleDescriptions,
  teamRoles,
  type AccessModule,
} from "@/lib/security/teamAccess";

export default function TeamAccessSettingsPage() {
  return (
    <main className="alyssa-shell">
      <AppNav showInternalWarning />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            團隊權限
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            團隊權限 / 登入系統預留
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            Basic Auth 目前只係早期 public URL 外層保護。長遠應以 Supabase Auth
            建立每位成員獨立登入、角色權限、品牌權限，同未來 CRM 共用的 access model。
          </p>
          <SettingsNav />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <InfoCard
            title="Temporary outer gate"
            body="Basic Auth 繼續保留，用於 Vercel preview / early internal URL protection。"
          />
          <InfoCard
            title="Team login direction"
            body="下一階段用 Supabase Auth profiles 連接角色、狀態同品牌存取權限。"
          />
          <InfoCard
            title="Shared with future CRM"
            body="未來 WhatsApp CRM app 可重用同一套 profiles、role、brand access model。"
          />
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#321428]">角色模型</h2>
          <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
            以下係權限方向，唔代表已有真實用戶或完整 login system。
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {teamRoles.map((role) => (
              <article key={role} className="rounded-2xl bg-[#fff6f0] p-4">
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
                      {moduleLabel(module)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#321428]">Module access matrix</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[900px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
                  <th className="border-b border-[#ead9cf] px-3 py-3">Role</th>
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
                        {roleAccess[role].includes(module.key) ? "可用" : "預留"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function moduleLabel(module: AccessModule) {
  return accessModules.find((item) => item.key === module)?.label ?? module;
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
    </div>
  );
}
