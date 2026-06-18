import { loginAction } from "@/app/login/actions";
import {
  getAdminPasswordGateWarning,
  isAdminPasswordGateEnabled,
} from "@/lib/security/internalAccess";

export const dynamic = "force-dynamic";

function safeNextPath(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/login") || raw.startsWith("/logout")) return "/dashboard";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const query = await searchParams;
  const next = safeNextPath(query?.next);
  const error = Array.isArray(query?.error) ? query?.error[0] : query?.error;
  const warning = getAdminPasswordGateWarning();
  const gateEnabled = isAdminPasswordGateEnabled();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,#fff1f7_0,#fff9f3_34%,#f6f2ff_100%)] px-5 py-10 text-[#321428]">
      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-5xl place-items-center">
        <div className="w-full max-w-xl rounded-[32px] border border-[#ead9cf] bg-white/90 p-8 shadow-[0_30px_90px_rgba(90,35,72,0.14)]">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#9a5d76]">
              LaunchHub
            </p>
            <h1 className="mt-3 text-3xl font-bold text-[#321428]">
              Admin Password
            </h1>
            <p className="mt-4 text-sm font-semibold leading-6 text-[#6d4a5c]">
              請輸入 LaunchHub admin password 繼續。
            </p>
          </div>

          {warning && (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              {warning}
            </p>
          )}

          {error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error === "invalid_password"
                ? "Password 不正確，請再試一次。"
                : "Admin password gate 尚未正確設定。"}
            </p>
          )}

          <form action={loginAction} className="mt-6 grid gap-4">
            <input type="hidden" name="next" value={next} />
            {gateEnabled && (
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                  Password
                </span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
                />
              </label>
            )}
            <button
              type="submit"
              className="rounded-full bg-[#e46f64] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_36px_rgba(228,111,100,0.24)] transition hover:-translate-y-0.5 hover:bg-[#d85f55]"
            >
              {gateEnabled ? "Unlock Admin" : "Continue to Admin"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
