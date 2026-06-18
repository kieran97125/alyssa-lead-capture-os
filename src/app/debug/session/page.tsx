import { cookies, headers } from "next/headers";
import { AppNav } from "@/components/alyssa/AppNav";
import { getAdminBaseUrl, getPublicBaseUrl } from "@/lib/data/appUrl";
import {
  canAccessModule,
  getInternalAuthCookieDomain,
  getRoleLabel,
  getVisibleModulesForRole,
  internalSessionCookieName,
  internalSessionMaxAgeSeconds,
  isInternalAuthDisabled,
  verifySignedInternalSession,
  type InternalModule,
} from "@/lib/security/internalAccess";

export const dynamic = "force-dynamic";

const checkedModules: InternalModule[] = [
  "dashboard",
  "landing_pages",
  "settings",
];

function yesNo(value: boolean) {
  return value ? "true" : "false";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 md:grid-cols-[220px_1fr]">
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </dt>
      <dd className="break-words text-sm font-semibold leading-6 text-[#321428]">
        {value}
      </dd>
    </div>
  );
}

export default async function DebugSessionPage() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const sessionCookie = cookieStore.get(internalSessionCookieName);
  const session = await verifySignedInternalSession(sessionCookie?.value);
  const authDisabled = isInternalAuthDisabled();
  const effectiveRole = authDisabled ? "owner" : session?.role;
  const cookieDomainConfigured = Boolean(getInternalAuthCookieDomain());
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "unknown";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const visibleModules = effectiveRole
    ? getVisibleModulesForRole(effectiveRole).join(", ")
    : "";

  const accessRows = checkedModules.map((module) => ({
    module,
    allowed: effectiveRole ? canAccessModule(effectiveRole, module) : false,
  }));

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <header>
          <p className="alyssa-kicker">Internal Debug</p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            Session Debug
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            只顯示非敏感登入狀態；不會顯示 cookie value、密碼或 secret。
          </p>
        </header>

        <dl className="mt-6 grid gap-3">
          <Row label="Current host" value={`${protocol}://${host}`} />
          <Row label="Current pathname" value="/debug/session" />
          <Row
            label="Session cookie exists"
            value={yesNo(Boolean(sessionCookie?.value))}
          />
          <Row label="Auth disabled" value={yesNo(authDisabled)} />
          <Row label="Session verifies" value={yesNo(Boolean(session))} />
          <Row
            label="Username"
            value={authDisabled ? "auth-disabled" : session?.username ?? ""}
          />
          <Row
            label="Role"
            value={effectiveRole ? `${effectiveRole} (${getRoleLabel(effectiveRole)})` : ""}
          />
          <Row label="Allowed modules" value={visibleModules} />
          {accessRows.map((row) => (
            <Row
              key={row.module}
              label={`Can access ${row.module}`}
              value={yesNo(row.allowed)}
            />
          ))}
          <Row
            label="Cookie settings summary"
            value={`httpOnly=true; secure=${process.env.NODE_ENV === "production"}; sameSite=lax; path=/; maxAge=${internalSessionMaxAgeSeconds}s`}
          />
          <Row
            label="Cookie domain configured"
            value={yesNo(cookieDomainConfigured)}
          />
          <Row label="Cookie path expected" value="/" />
          <Row label="Admin base URL" value={getAdminBaseUrl()} />
          <Row label="Public base URL" value={getPublicBaseUrl()} />
        </dl>
      </div>
    </main>
  );
}
