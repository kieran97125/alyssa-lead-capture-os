import Link from "next/link";
import {
  createTreatmentAction,
  deleteTreatmentAction,
  updateTreatmentAction,
} from "@/app/settings/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsBrandPicker } from "@/components/alyssa/SettingsBrandPicker";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  getConfigurationData,
  getLinkedForms,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function TreatmentSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    settings_status?: string | string[];
    message?: string | string[];
    brand?: string | string[];
  }>;
}) {
  const [config, query] = await Promise.all([
    getConfigurationData(),
    searchParams,
  ]);
  const selectedBrandParam = firstParam(query?.brand);
  const selectedBrand =
    config.brands.find(
      (brand) =>
        brand.slug === selectedBrandParam || brand.id === selectedBrandParam
    ) ??
    config.brands[0] ??
    null;
  const visibleTreatments = config.treatments.filter(
    (treatment) => treatment.brandId === selectedBrand?.id
  );
  const message = firstParam(query?.message);
  const status = firstParam(query?.settings_status);
  const returnPath = `/settings/treatments?brand=${selectedBrand?.slug || ""}`;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/88 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="alyssa-kicker">Settings</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                療程管理
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                每個療程一行；展開先編輯，日常查看唔再被大量表單佔滿。
              </p>
            </div>
            <SettingsBrandPicker
              brands={config.brands}
              selectedBrandId={selectedBrand?.id}
              basePath="/settings/treatments"
            />
          </div>
          <SettingsNav />
        </header>

        {message && <StatusMessage tone={status}>{message}</StatusMessage>}

        <details className="mt-6 rounded-[22px] border border-[#ead9cf] bg-white/92">
          <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-[#5a2348]">
            ＋ 新增療程
          </summary>
          <form
            action={createTreatmentAction}
            className="grid gap-4 border-t border-[#f1e3dc] p-5 lg:grid-cols-4"
          >
            <input type="hidden" name="returnPath" value={returnPath} />
            <input
              type="hidden"
              name="brandId"
              value={selectedBrand?.id || ""}
            />
            <TextInput label="療程名稱" name="name" />
            <TextInput
              label="療程代號"
              name="slug"
              placeholder="laser-hair-removal"
            />
            <TextArea label="療程介紹" name="description" />
            <div className="flex items-end">
              <button className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white">
                建立療程
              </button>
            </div>
          </form>
        </details>

        <section
          aria-label="療程列表"
          className="mt-5 overflow-hidden rounded-[24px] border border-[#ead9cf] bg-white/92 shadow-[0_18px_50px_rgba(90,35,72,0.06)]"
          data-testid="treatment-management-list"
        >
          <div className="hidden grid-cols-[minmax(220px,1.2fr)_minmax(170px,0.8fr)_110px_110px_90px_70px] gap-4 bg-[#fff6f0] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76] md:grid">
            <span>療程</span>
            <span>代號</span>
            <span>價錢項目</span>
            <span>表格</span>
            <span>狀態</span>
            <span />
          </div>
          {visibleTreatments.map((treatment) => {
            const linkedPackages = config.packages.filter(
              (item) => item.treatmentId === treatment.id
            );
            const linkedForms = getLinkedForms(
              config,
              (form) => form.defaultTreatmentId === treatment.id
            );

            return (
              <details
                key={treatment.id}
                className="group border-t border-[#f1e3dc] first:border-t-0 md:first:border-t"
              >
                <summary className="grid cursor-pointer gap-2 px-5 py-4 transition hover:bg-[#fff9f3] md:grid-cols-[minmax(220px,1.2fr)_minmax(170px,0.8fr)_110px_110px_90px_70px] md:items-center md:gap-4">
                  <span className="font-bold text-[#321428]">
                    {treatment.name}
                  </span>
                  <span className="break-words font-mono text-xs font-semibold text-[#7b5a6a]">
                    {treatment.slug}
                  </span>
                  <RowMetric label="價錢項目" value={linkedPackages.length} />
                  <RowMetric label="表格" value={linkedForms.length} />
                  <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {treatment.status === "active" ? "啟用" : treatment.status}
                  </span>
                  <span className="text-sm font-bold text-[#5a2348]">
                    編輯
                  </span>
                </summary>

                <div className="border-t border-[#f1e3dc] bg-[#fffdfb] p-5">
                  <form action={updateTreatmentAction} className="grid gap-4">
                    <input type="hidden" name="id" value={treatment.id} />
                    <input
                      type="hidden"
                      name="returnPath"
                      value={returnPath}
                    />
                    <input
                      type="hidden"
                      name="brandId"
                      value={treatment.brandId}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="療程名稱"
                        name="name"
                        defaultValue={treatment.name}
                      />
                      <TextInput
                        label="療程代號"
                        name="slug"
                        defaultValue={treatment.slug}
                      />
                    </div>
                    <TextArea
                      label="療程介紹"
                      name="description"
                      defaultValue={treatment.description ?? ""}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
                        儲存
                      </button>
                      <Link
                        href={`/settings/packages?brand=${selectedBrand?.slug || ""}&treatment=${treatment.slug}`}
                        className="text-sm font-bold text-[#5a2348] underline underline-offset-4"
                      >
                        管理此療程價錢
                      </Link>
                    </div>
                  </form>

                  <details className="mt-5 border-t border-[#f1e3dc] pt-4">
                    <summary className="w-fit cursor-pointer text-xs font-bold text-[#8a2732]">
                      刪除療程
                    </summary>
                    <form
                      action={deleteTreatmentAction}
                      className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"
                    >
                      <input type="hidden" name="id" value={treatment.id} />
                      <input
                        type="hidden"
                        name="returnPath"
                        value={returnPath}
                      />
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#6d4a5c]">
                        <input type="checkbox" name="confirmDelete" />
                        確認刪除
                      </label>
                      <button className="w-fit rounded-full border border-[#e7b8b8] bg-[#fff5f5] px-4 py-2 text-sm font-bold text-[#8a2732]">
                        安全刪除
                      </button>
                    </form>
                  </details>
                </div>
              </details>
            );
          })}
          {visibleTreatments.length === 0 && (
            <p className="px-5 py-10 text-center text-sm font-semibold text-[#7b5a6a]">
              此品牌未有療程。展開上方「新增療程」開始設定。
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function RowMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-sm font-bold text-[#5a2348]">
      <span className="mr-2 text-xs text-[#9a5d76] md:hidden">{label}</span>
      {value}
    </span>
  );
}

function StatusMessage({
  tone,
  children,
}: {
  tone: string | string[] | undefined;
  children: string;
}) {
  const isSuccess = tone === "success";
  return (
    <div
      className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-[#d9b66f] bg-[#fff6f0] text-[#5a2348]"
      }`}
    >
      {children}
    </div>
  );
}

function TextInput({
  label,
  name,
  defaultValue = "",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        required
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none focus:border-[#e46f64]"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        {label}
      </span>
      <textarea
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none focus:border-[#e46f64]"
      />
    </label>
  );
}
