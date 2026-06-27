import Link from "next/link";
import type { ReactNode } from "react";

type CrmSidebarKey =
  | "inbox"
  | "bookings"
  | "reports"
  | "settings";

const sidebarItems: Array<{
  key: CrmSidebarKey;
  label: string;
  href: string;
}> = [
  { key: "inbox", label: "工作台", href: "/crm" },
  { key: "bookings", label: "預約", href: "/crm?tab=bookings" },
];

const adminItems: Array<{
  key: CrmSidebarKey;
  label: string;
  href: string;
}> = [
  { key: "reports", label: "Marketing Reports", href: "/crm?tab=reports" },
  { key: "settings", label: "Settings", href: "/crm/settings" },
];

export function CrmShell({
  children,
  active = "inbox",
}: {
  children: ReactNode;
  active?: CrmSidebarKey;
}) {
  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#1f2933]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[208px] shrink-0 border-r border-[#dfe4ea] bg-[#111827] text-white lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
              LeadOps
            </p>
            <h1 className="mt-1 text-base font-bold">CRM</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2.5 py-3">
            {sidebarItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold transition ${
                  item.key === active
                    ? "bg-white text-[#111827]"
                    : "text-[#d1d5db] hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/10 p-2.5">
            <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6b7280]">
              Admin / Marketing
            </p>
            <div className="grid gap-1 pb-2">
              {adminItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
                    item.key === active
                      ? "bg-white text-[#111827]"
                      : "text-[#9ca3af] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <Link
              href="/dashboard"
              className="block rounded-lg px-3 py-2 text-[12px] font-semibold text-[#d1d5db] transition hover:bg-white/10 hover:text-white"
            >
              Back to LaunchHub
            </Link>
          </div>
        </aside>

        <aside className="flex w-[64px] shrink-0 flex-col items-center border-r border-[#dfe4ea] bg-[#111827] py-3 text-white lg:hidden">
          <Link
            href="/crm"
            className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[12px] font-black text-[#111827]"
            title="CRM Inbox"
          >
            C
          </Link>
          <div className="mt-4 grid gap-2">
            {[
              { label: "工", href: "/crm", key: "inbox" },
              { label: "約", href: "/crm?tab=bookings", key: "bookings" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`grid h-8 w-8 place-items-center rounded-lg text-[10px] font-bold ${
                  item.key === active ? "bg-white text-[#111827]" : "bg-white/8 text-[#9ca3af]"
                }`}
                title={item.label === "工" ? "工作台" : "預約"}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}
