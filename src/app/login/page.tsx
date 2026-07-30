import { MailCheck, ShieldCheck } from "lucide-react";
import {
  loginAction,
  requestEmailLoginAction,
} from "@/app/login/actions";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import {
  getAdminPasswordGateWarning,
  isAdminPasswordGateEnabled,
} from "@/lib/security/internalAccess";
import {
  getSupabasePublicAuthConfig,
  isBreakGlassPasswordEnabled,
  isWorkspaceEmailAuthRequired,
  safeInternalNextPath,
} from "@/lib/supabase/authConfig";

export const dynamic = "force-dynamic";

function safeNextPath(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return safeInternalNextPath(raw);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    next?: string | string[];
    error?: string | string[];
    email_status?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const next = safeNextPath(query?.next);
  const error = Array.isArray(query?.error) ? query?.error[0] : query?.error;
  const emailStatus = Array.isArray(query?.email_status)
    ? query?.email_status[0]
    : query?.email_status;
  const warning = getAdminPasswordGateWarning();
  const gateEnabled = isAdminPasswordGateEnabled();
  const emailAuthReady = getSupabasePublicAuthConfig().ready;
  const emailAuthRequired = isWorkspaceEmailAuthRequired();
  const showPasswordFallback =
    gateEnabled && isBreakGlassPasswordEnabled();

  return (
    <main
      data-testid="login-screen"
      className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,#fff1f7_0,#fff9f3_34%,#f8e8e2_100%)] px-5 py-10 text-[#321428]"
    >
      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-5xl place-items-center">
        <div className="w-full max-w-xl rounded-[32px] border border-[#ead9cf] bg-white/90 p-8 shadow-[0_30px_90px_rgba(90,35,72,0.14)]">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#9a5d76]">
              Alyssa Growth OS
            </p>
            <h1 className="mt-3 text-3xl font-bold text-[#321428]">
              公司電郵登入
            </h1>
            <p className="mt-4 text-sm font-semibold leading-6 text-[#6d4a5c]">
              只限已由 Owner 邀請嘅成員。輸入受邀公司電郵，我哋會寄出一次性安全登入連結。
            </p>
          </div>

          {warning && showPasswordFallback && (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              {warning}
            </p>
          )}

          {emailStatus === "sent" ? (
            <div className="mt-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
              <MailCheck className="mt-0.5 shrink-0" size={18} />
              <div>
                <strong className="text-sm">請檢查公司電郵</strong>
                <p className="mt-1 text-xs font-semibold leading-5">
                  如電郵已獲邀請，幾分鐘內會收到一次性連結；為保障私隱，未受邀地址亦會顯示相同訊息。
                </p>
              </div>
            </div>
          ) : null}

          {error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error === "invalid_password"
                ? "Password 不正確，請再試一次。"
                : error === "master_required"
                  ? "你目前角色無權進入呢個管理頁面。"
                  : error === "permission_denied"
                    ? "你目前角色未獲授權使用呢個模組。"
                    : error === "not_invited"
                      ? "此公司電郵未受邀、已停用，或者邀請尚未完成。"
                      : error === "email_send_failed"
                        ? "暫時未能寄出登入電郵，請稍後重試或請 Owner 重發邀請。"
                        : error === "email_required"
                          ? "系統已轉用受邀公司電郵登入。"
                          : "電郵登入設定尚未完成。"}
            </p>
          )}

          <form action={requestEmailLoginAction} className="mt-6 grid gap-4">
            <input type="hidden" name="next" value={next} />
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                Company email
              </span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="name@alyssa.hk"
                required
                disabled={!emailAuthReady}
                className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#c9828e] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <SubmitButton
              className="rounded-full bg-[#5a2348] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_36px_rgba(90,35,72,0.22)] transition hover:-translate-y-0.5 hover:bg-[#471b39] disabled:cursor-wait disabled:opacity-70"
              pendingLabel="寄送安全連結…"
              disabled={!emailAuthReady}
            >
              寄出登入連結
            </SubmitButton>
          </form>

          {showPasswordFallback ? (
            <details className="mt-6 rounded-2xl border border-[#ead9cf] bg-[#fff9f3]">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-bold text-[#5a2348]">
                <ShieldCheck size={16} />
                {emailAuthRequired ? "緊急管理員登入" : "切換期間管理員登入"}
              </summary>
              <form
                action={loginAction}
                className="grid gap-4 border-t border-[#ead9cf] p-4"
              >
                <input type="hidden" name="next" value={next} />
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                    Password
                  </span>
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#c9828e]"
                  />
                </label>
                <SubmitButton
                  className="rounded-full border border-[#ead9cf] bg-white px-6 py-3 text-sm font-bold text-[#5a2348] disabled:cursor-wait disabled:opacity-70"
                  pendingLabel="驗證中…"
                >
                  管理員登入
                </SubmitButton>
              </form>
            </details>
          ) : null}
        </div>
      </section>
    </main>
  );
}
