import { loginAction } from "@/app/login/actions";
import { loginErrorMessage } from "@/lib/security/internalAccess";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const query = await searchParams;
  const hasError = query?.error === "1";
  const nextPath = typeof query?.next === "string" ? query.next : "/dashboard";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,#fff1f7_0,#fff9f3_34%,#f6f2ff_100%)] px-5 py-10 text-[#321428]">
      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#9a5d76]">
            LaunchHub
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-bold leading-tight md:text-6xl">
            Campaign Launch OS
          </h1>
          <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#6d4a5c]">
            內部團隊登入入口
          </p>
        </div>

        <form
          action={loginAction}
          className="rounded-[32px] border border-[#ead9cf] bg-white/90 p-6 shadow-[0_30px_90px_rgba(90,35,72,0.14)] md:p-8"
        >
          <input type="hidden" name="next" value={nextPath} />
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a5d76]">
            Internal Login
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#321428]">
            登入 LaunchHub
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#6d4a5c]">
            請使用內部帳戶登入，系統會按角色顯示可使用功能。
          </p>

          {hasError && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {loginErrorMessage}
            </p>
          )}

          <label className="mt-6 block">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              Username
            </span>
            <input
              name="username"
              autoComplete="username"
              required
              className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
            />
          </label>

          <label className="mt-4 block">
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

          <button
            type="submit"
            className="mt-6 w-full rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_36px_rgba(228,111,100,0.24)] transition hover:-translate-y-0.5 hover:bg-[#d85f55]"
          >
            登入
          </button>

          <p className="mt-4 text-center text-xs font-semibold leading-5 text-[#9a5d76]">
            如忘記密碼，請聯絡 Owner 更新內部帳戶。
          </p>
        </form>
      </section>
    </main>
  );
}
