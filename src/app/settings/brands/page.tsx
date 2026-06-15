import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  createBrandAction,
  deleteBrandAction,
  updateBrandAction,
} from "@/app/settings/actions";
import { getConfigurationData, getLinkedForms } from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function BrandSettingsPage({
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
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">品牌資料</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            管理 Campaign、表格和 Landing Page 可選用的品牌。
          </p>
          <SettingsNav />
        </section>

        {message && <StatusMessage tone={status}>{message}</StatusMessage>}

        <section className="mt-6 rounded-[28px] border border-[#ead9cf] bg-white/86 p-5 shadow-[0_18px_50px_rgba(90,35,72,0.08)]">
          <h2 className="text-xl font-bold text-[#321428]">新增品牌</h2>
          <form action={createBrandAction} className="mt-4 grid gap-4 lg:grid-cols-4">
            <TextInput label="品牌名稱" name="name" placeholder="Alyssa" />
            <TextInput label="品牌代號" name="slug" placeholder="alyssa" />
            <TextInput label="WhatsApp 電話" name="whatsappNumber" placeholder="+852..." required={false} />
            <TextInput label="Thank You Page" name="defaultThankYouUrl" placeholder="/thank-you" required={false} />
            <TextInput label="Logo URL" name="logoUrl" required={false} />
            <TextInput label="主色" name="primaryColor" placeholder="#5a2348" required={false} />
            <TextInput label="副色" name="secondaryColor" placeholder="#c9828e" required={false} />
            <div className="flex items-end">
              <button className="w-full rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]">
                新增
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 grid gap-5">
          {config.brands.map((brand) => {
            const linkedForms = getLinkedForms(
              config,
              (form) => form.brandId === brand.id
            );

            return (
              <article key={brand.id} className="alyssa-premium-card min-w-0 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-[#321428]">{brand.name}</h2>
                    <p className="mt-1 break-words font-mono text-sm text-[#7b5a6a]">
                      {brand.slug}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ColorPill label="主色" value={brand.primaryColor} />
                    <ColorPill label="副色" value={brand.secondaryColor} />
                  </div>
                </div>

                <form action={updateBrandAction} className="mt-5 grid gap-4 lg:grid-cols-4">
                  <input type="hidden" name="id" value={brand.id} />
                  <TextInput label="品牌名稱" name="name" defaultValue={brand.name} />
                  <TextInput label="品牌代號" name="slug" defaultValue={brand.slug} />
                  <TextInput
                    label="WhatsApp 電話"
                    name="whatsappNumber"
                    defaultValue={brand.whatsappNumber ?? ""}
                    required={false}
                  />
                  <TextInput
                    label="Thank You Page"
                    name="defaultThankYouUrl"
                    defaultValue={brand.defaultThankYouUrl ?? ""}
                    required={false}
                  />
                  <TextInput label="Logo URL" name="logoUrl" required={false} />
                  <TextInput
                    label="主色"
                    name="primaryColor"
                    defaultValue={brand.primaryColor ?? ""}
                    required={false}
                  />
                  <TextInput
                    label="副色"
                    name="secondaryColor"
                    defaultValue={brand.secondaryColor ?? ""}
                    required={false}
                  />
                  <div className="flex items-end">
                    <button className="w-full rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
                      儲存
                    </button>
                  </div>
                </form>

                <div className="mt-5 rounded-[20px] bg-[#fff6f0] p-4">
                  <p className="text-sm font-bold text-[#321428]">
                    已連接表格：{linkedForms.length > 0 ? linkedForms.map((form) => form.formName).join(", ") : "未連接"}
                  </p>
                  <form action={deleteBrandAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <input type="hidden" name="id" value={brand.id} />
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#6d4a5c]">
                      <input type="checkbox" name="confirmDelete" />
                      確認刪除這個品牌
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

function TextInput({
  label,
  name,
  defaultValue = "",
  placeholder,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}

function ColorPill({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
      <span
        className="h-3 w-3 rounded-full border border-[#ead9cf]"
        style={{ backgroundColor: value ?? "#fff" }}
      />
      {label}: {value ?? "未設定"}
    </span>
  );
}
