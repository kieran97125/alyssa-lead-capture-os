import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { getDefaultEmbedCode } from "@/lib/data/appUrl";

export default function HomePage() {
  const embedCode = getDefaultEmbedCode(
    alyssaDefaultForm.publicFormToken,
    alyssaDefaultForm.id
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Campaign Launch OS
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-[#321428] md:text-6xl">
            LaunchHub
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#6d4a5c]">
            用於建立 Wix 登記表格、廣告 Landing Page、Leads 收集及來源追蹤。Alyssa、Ineffable、Skin Light 等可作為品牌資料使用。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95f55]"
            >
              查看 Dashboard
            </Link>
            <Link
              href="/embed-preview"
              className="rounded-full border border-[#d9b66f] bg-white/70 px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              預覽表格
            </Link>
          </div>
        </div>
        <div className="space-y-5">
          <EmbedCodeCard
            code={embedCode}
            description="把這段嵌入碼放入 Wix 或 campaign page，即可使用指定品牌表格收集 Leads。"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Wix 登記表格",
              "Landing Page",
              "Leads 收集",
              "來源追蹤",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-[#fff6f0] p-4 text-sm font-semibold text-[#5a2348]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}