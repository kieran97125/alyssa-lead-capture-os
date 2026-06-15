import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import type { ReactNode } from "react";
import {
  createTreatmentAction,
  deleteTreatmentAction,
  updateTreatmentAction,
} from "@/app/settings/actions";
import {
  getBrand,
  getConfigurationData,
  getLinkedForms,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function TreatmentSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    settings_status?: string | string[];
    message?: string | string[];
  }>;
}) {
  const [config, query] = await Promise.all([
    getConfigurationData(),
    searchParams,
  ]);
  const message = typeof query?.message === "string" ? query.message : null;
  const status =
    query?.settings_status === "success" ? "success" : query?.settings_status;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Settings
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">療程資料</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            管理表格和 Landing Page 可選用的療程。
          </p>
          <SettingsNav />
        </section>

        {message && <StatusMessage tone={status}>{message}</StatusMessage>}

        <section className="mt-6 rounded-[28px] border border-[#ead9cf] bg-white/86 p-5 shadow-[0_18px_50px_rgba(90,35,72,0.08)]">
          <h2 className="text-xl font-bold text-[#321428]">新增療程</h2>
          <form action={createTreatmentAction} className="mt-4 grid gap-4 lg:grid-cols-4">
            <SelectInput label="品牌" name="brandId" options={config.brands.map((brand) => ({ value: brand.id, label: brand.name }))} />
            <TextInput label="療程名稱" name="name" />
            <TextInput label="療程代號" name="slug" placeholder="medical-beauty-trial" />
            <div className="flex items-end">
              <button className="w-full rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]">
                新增
              </button>
            </div>
            <TextArea label="療程介紹" name="description" />
          </form>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          {config.treatments.map((treatment) => {
            const brand = getBrand(config, treatment.brandId);
            const linkedPackages = config.packages.filter(
              (item) => item.treatmentId === treatment.id
            );
            const linkedForms = getLinkedForms(
              config,
              (form) => form.defaultTreatmentId === treatment.id
            );

            return (
              <article key={treatment.id} className="alyssa-premium-card min-w-0 p-5">
                <div className="flex flex-wrap gap-2">
                  <StatusPill>{brand?.name ?? "未設定品牌"}</StatusPill>
                  <StatusPill>套餐 {linkedPackages.length}</StatusPill>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-[#321428]">
                  {treatment.name}
                </h2>
                <p className="mt-1 break-words font-mono text-sm text-[#7b5a6a]">
                  {treatment.slug}
                </p>

                <form action={updateTreatmentAction} className="mt-5 grid gap-4">
                  <input type="hidden" name="id" value={treatment.id} />
                  <div className="grid gap-4 md:grid-cols-3">
                    <SelectInput
                      label="品牌"
                      name="brandId"
                      defaultValue={treatment.brandId}
                      options={config.brands.map((item) => ({ value: item.id, label: item.name }))}
                    />
                    <TextInput label="療程名稱" name="name" defaultValue={treatment.name} />
                    <TextInput label="療程代號" name="slug" defaultValue={treatment.slug} />
                  </div>
                  <TextArea
                    label="療程介紹"
                    name="description"
                    defaultValue={treatment.description ?? ""}
                  />
                  <button className="w-fit rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
                    儲存
                  </button>
                </form>

                <div className="mt-5 rounded-[20px] bg-[#fff6f0] p-4">
                  <p className="text-sm font-bold text-[#321428]">
                    已連接：{linkedForms.length} 張表格、{linkedPackages.length} 個套餐
                  </p>
                  <form action={deleteTreatmentAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <input type="hidden" name="id" value={treatment.id} />
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#6d4a5c]">
                      <input type="checkbox" name="confirmDelete" />
                      確認刪除這個療程
                    </label>
                    <button className="rounded-full border border-[#d9b66f] bg-white px-5 py-2 text-sm font-bold text-[#5a2348]">
                      刪除
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
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
    <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
      isSuccess
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-[#d9b66f] bg-[#fff6f0] text-[#5a2348]"
    }`}>
      {children}
    </div>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
      {children}
    </span>
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
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
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
    <label className="block min-w-0 md:col-span-4">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        {label}
      </span>
      <textarea
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}

function SelectInput({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        {label}
      </span>
      <select
        name={name}
        required
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
