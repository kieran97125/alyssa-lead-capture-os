import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { syncGeneratedSuccessRedirectAction } from "@/app/forms/redirectActions";

export const dynamic = "force-dynamic";

export default function RedirectSyncPage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-4xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="alyssa-kicker">Safe Redirect Sync</p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            按 Treatment Slug 同步 Success Redirect
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#6d4a5c]">
            此工具只更新所選 Form 的 success_redirect_url。Form token、Form ID、提交 API、分店、Pixel value、Preview URL 及現有 Embed runtime 均不會改動。
          </p>
        </header>

        <section className="alyssa-premium-card mt-6 p-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            已貼到 Wix 的舊 Embed Code 不會自動更新。同步後請返回 Form Settings，重新複製最新 Embed Code；舊 Embed 仍會照常提交及使用原本寫死的 Redirect。
          </div>

          <form action={syncGeneratedSuccessRedirectAction} className="mt-6 grid gap-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                Form ID 或 Form Token
              </span>
              <input
                name="formId"
                required
                placeholder="58b1d8d4-e3fb-46c3-b80a-21ad010149ff"
                className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 font-mono text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
              />
            </label>

            <div className="rounded-2xl bg-[#fff6f0] p-4 text-sm font-semibold leading-6 text-[#6d4a5c]">
              Redirect 會由品牌 Thank You Page、目前 Treatment Slug 及套餐價值重新生成。例如：
              <span className="mt-2 block break-all font-mono text-xs text-[#5a2348]">
                https://www.ineffablebeautyhk.com/thank-you?submitted=1&amp;treatment=s-lite-leg-care&amp;value=588
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
              >
                安全同步 Redirect
              </button>
              <Link
                href="/forms"
                className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
              >
                返回 Forms
              </Link>
            </div>
          </form>
        </section>

        <section className="alyssa-premium-card mt-6 p-6">
          <p className="alyssa-kicker">Compatibility</p>
          <h2 className="mt-2 text-xl font-bold text-[#321428]">不會改動的項目</h2>
          <ul className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-[#6d4a5c] sm:grid-cols-2">
            <li>Form token / Form ID</li>
            <li>Lead submission flow</li>
            <li>Branch selection</li>
            <li>Pixel event value</li>
            <li>Preview URL</li>
            <li>已貼出的 Wix Embed Code</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
