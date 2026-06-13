import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { getDefaultEmbedCode, getEmbedScriptUrl } from "@/lib/data/appUrl";

export default function FormConfigPage() {
  const embedCode = getDefaultEmbedCode(
    alyssaDefaultForm.publicFormToken,
    alyssaDefaultForm.id
  );
  const scriptUrl = getEmbedScriptUrl();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
          表格設定
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#321428]">
          {alyssaDefaultForm.formName}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
          呢個畫面用作 Wix embed 設定同日後 Supabase 正式表格設定的交接參考。
          技術值保持英文，方便開發、部署同 CRM 對接。
        </p>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-[#fff6f0] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            Config state
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5a2348]">
            目前顯示本機 seed config，方便核對 production-ready embed path。
            Supabase 連接後，呢個畫面應該讀取正式 `forms`、`brands`、
            `treatments`、`packages` 同 `branches` 設定。
          </p>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
            <h2 className="text-xl font-bold text-[#321428]">營運設定</h2>
            <dl className="mt-5 grid gap-3">
              {[
                ["狀態", alyssaDefaultForm.status],
                ["表格 Token", alyssaDefaultForm.publicFormToken],
                ["允許嵌入網域", alyssaDefaultForm.allowedDomains.join(", ")],
                ["預設療程 ID", alyssaDefaultForm.defaultTreatmentId],
                ["預設套餐 ID", alyssaDefaultForm.defaultPackageId],
                ["預設分店 ID", alyssaDefaultForm.defaultBranchId],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#fff6f0] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                        {label}
                      </dt>
                      <dd className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
                        {value}
                      </dd>
                    </div>
                    <CopyButton value={value} />
                  </div>
                </div>
              ))}
            </dl>
          </section>

          <div className="space-y-5">
            <EmbedCodeCard
              code={embedCode}
              title="Wix 嵌入碼"
              description="將呢段 code 放入 Wix 頁面需要顯示登記表格的位置。"
            />
            <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
              <h2 className="text-xl font-bold text-[#321428]">Script endpoint</h2>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-[#fff6f0] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="break-all text-sm font-semibold text-[#5a2348]">{scriptUrl}</p>
                <CopyButton value={scriptUrl} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/embed-preview"
                  className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white"
                >
                  測試 Parent Embed
                </Link>
                <Link
                  href={`/embed/${alyssaDefaultForm.publicFormToken}`}
                  className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                >
                  直接打開 iframe
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
