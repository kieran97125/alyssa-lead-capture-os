import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import {
  alyssaBranches,
  alyssaBrand,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";
import { getDefaultEmbedCode, getEmbedScriptUrl } from "@/lib/data/appUrl";

const formState = [
  ["表格模式", "Form-only embed 已可用"],
  ["設定來源", "Seed / config-backed"],
  ["Landing page mode", "Foundation prepared"],
  ["日後設定層", "品牌 / 療程 / 套餐 / 分店 / templates"],
];

export default function FormsPage() {
  const embedCode = getDefaultEmbedCode(
    alyssaDefaultForm.publicFormToken,
    alyssaDefaultForm.id
  );
  const embedScriptUrl = getEmbedScriptUrl();
  const defaultTreatment = alyssaTreatments.find(
    (item) => item.id === alyssaDefaultForm.defaultTreatmentId
  );
  const defaultPackage = alyssaPackages.find(
    (item) => item.id === alyssaDefaultForm.defaultPackageId
  );
  const defaultBranch = alyssaBranches.find(
    (item) => item.id === alyssaDefaultForm.defaultBranchId
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
              表格管理
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              Alyssa 登記表格設定
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              這裡係表格設定 foundation：先管理 Wix embed 所需的表格 token、
              預設品牌、療程、套餐、分店同允許嵌入網域。日後加入 hero copy、
              圖片、內容 section 同 template 後，同一份表格設定可以延伸成簡單 campaign landing page。
            </p>
          </div>
          <Link
            href="/embed-preview"
            className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95f55]"
          >
            測試 Wix 預覽
          </Link>
        </div>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-[#fff6f0] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            設定定位
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {formState.map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/80 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                  {label}
                </p>
                <p className="mt-2 text-sm font-bold text-[#5a2348]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 grid gap-5 xl:grid-cols-[1fr_0.92fr]">
          <article className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                  主要登記表格
                </p>
                <h2 className="mt-3 text-2xl font-bold text-[#321428]">
                  {alyssaDefaultForm.formName}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                  呢個表格係現時 Wix form-only mode 的主要入口。品牌、療程、套餐、
                  價錢同分店目前由 seed/config 提供；完整 admin editing 會作為下一層
                  configuration system 建立，而唔會改動現有 submit flow。
                </p>
              </div>
              <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                Embed path ready
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoCell label="表格 Token" value={alyssaDefaultForm.publicFormToken} copy />
              <InfoCell label="品牌" value={alyssaBrand.name} />
              <InfoCell label="預設療程" value={defaultTreatment?.name ?? "未設定"} />
              <InfoCell label="預設套餐" value={defaultPackage?.name ?? "未設定"} />
              <InfoCell label="預設分店" value={defaultBranch?.name ?? "未設定"} />
              <InfoCell
                label="允許嵌入網域"
                value={alyssaDefaultForm.allowedDomains.join(", ")}
                copy
              />
              <InfoCell label="Public script" value={embedScriptUrl} copy wide />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/forms/${alyssaDefaultForm.id}`}
                className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
              >
                開啟設定
              </Link>
              <Link
                href={`/embed/${alyssaDefaultForm.publicFormToken}`}
                className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
              >
                直接打開 iframe
              </Link>
            </div>
          </article>

          <EmbedCodeCard
            code={embedCode}
            title="Wix 嵌入碼"
            description="將呢段 script 放入 Wix parent page，讓 UTM 同 click IDs 可以喺 iframe submit 前先被擷取。"
          />
        </section>
      </div>
    </main>
  );
}

function InfoCell({
  label,
  value,
  copy = false,
  wide = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-[#fff6f0] p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            {label}
          </dt>
          <dd className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
            {value}
          </dd>
        </div>
        {copy && <CopyButton value={value} />}
      </div>
    </div>
  );
}
