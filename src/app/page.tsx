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
            來源追蹤核心
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-[#321428] md:text-6xl">
            Alyssa Lead Capture OS
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#6d4a5c]">
            為 Alyssa 建立可嵌入 Wix 的登記表格、Parent Page 來源追蹤、
            CTWA-ready source snapshot、lead event，以及日後 CRM 回寫預約 /
            付款結果的同一套基礎。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95f55]"
            >
              開啟成效儀表板
            </Link>
            <Link
              href="/embed-preview"
              className="rounded-full border border-[#d9b66f] bg-white/70 px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              測試嵌入預覽
            </Link>
          </div>
        </div>
        <div className="space-y-5">
          <EmbedCodeCard
            code={embedCode}
            description="根據本機或正式環境自動顯示可用的 Wix 嵌入 script URL。"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Parent Page UTM 擷取",
              "Source snapshot 保存",
              "Lead event timeline",
              "CRM 結果回寫",
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-[#fff6f0] p-4 text-sm font-semibold text-[#5a2348]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
