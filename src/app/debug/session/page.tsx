import { headers } from "next/headers";
import { cookies } from "next/headers";
import { AppNav } from "@/components/alyssa/AppNav";
import { getAdminBaseUrl, getPublicBaseUrl } from "@/lib/data/appUrl";
import {
  adminSessionCookieName,
  getAdminPasswordGateWarning,
  isAdminPasswordGateEnabled,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";

export const dynamic = "force-dynamic";

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
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "unknown";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const cookieValue = cookieStore.get(adminSessionCookieName)?.value;
  const session = await verifySignedAdminSession(cookieValue);
  const warning = getAdminPasswordGateWarning();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <header>
          <p className="alyssa-kicker">Internal Debug</p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            Session Status
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            This page shows admin password gate status only and does not print
            cookies, passwords, secrets, or session values.
          </p>
        </header>

        <dl className="mt-6 grid gap-3">
          <Row
            label="Admin password gate enabled"
            value={String(isAdminPasswordGateEnabled())}
          />
          <Row label="Cookie exists" value={String(Boolean(cookieValue))} />
          <Row label="Session verifies" value={String(session.ok)} />
          <Row label="Current host" value={`${protocol}://${host}`} />
          <Row label="Current pathname" value="/debug/session" />
          <Row label="Admin base URL" value={getAdminBaseUrl()} />
          <Row label="Public base URL" value={getPublicBaseUrl()} />
          <Row label="Configuration warning" value={warning || "none"} />
        </dl>
      </div>
    </main>
  );
}
