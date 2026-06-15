import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  createPackageAction,
  deletePackageAction,
  updatePackageAction,
} from "@/app/settings/actions";
import {
  getConfigurationData,
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function money(value: number | string | null, currency: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "未設定";
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function valueText(value: number | string | null) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function PackageSettingsPage({
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
  const treatmentOptions = config.treatments.map((treatment) => ({
    value: treatment.id,
    label: `${treatment.name} (${config.brands.find((brand) => brand.id === treatment.brandId)?.name ?? "品牌"})`,
  }));

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Settings
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">套餐價錢</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            管理登記表格和 Campaign 使用的套餐、優惠價和付款要求。
          </p>
          <SettingsNav />
        </section>

        {message && <StatusMessage tone={status}>{message}</StatusMessage>}

        <section className="mt-6 rounded-[28px] border border-[#ead9cf] bg-white/86 p-5 shadow-[0_18px_50px_rgba(90,35,72,0.08)]">
          <h2 className="text-xl font-bold text-[#321428]">新增套餐</h2>
          <form action={createPackageAction} className="mt-4 grid gap-4 lg:grid-cols-6">
            <SelectInput label="連接療程" name="treatmentId" options={treatmentOptions} />
            <TextInput label="套餐名稱" name="name" />
            <NumberInput label="原價" name="originalPrice" />
            <NumberInput label="優惠價" name="promoPrice" />
            <TextInput label="貨幣" name="currency" defaultValue="HKD" />
            <label className="flex items-end gap-2 pb-3 text-sm font-bold text-[#5a2348]">
              <input type="checkbox" name="paymentRequired" />
              需要付款
            </label>
            <div className="lg:col-span-6">
              <button className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]">
                新增
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          {config.packages.map((item) => {
            const treatment = getTreatment(config, item.treatmentId);
            const linkedForms = config.forms.filter(
              (form) => form.defaultPackageId === item.id
            );

            return (
              <article key={item.id} className="alyssa-premium-card min-w-0 p-5">
                <div className="flex flex-wrap gap-2">
                  <StatusPill>{item.paymentRequired ? "需要付款" : "只預約"}</StatusPill>
                  <StatusPill>{money(item.promoPrice, item.currency)}</StatusPill>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-[#321428]">{item.name}</h2>
                <p className="mt-2 text-sm font-semibold text-[#7b5a6a]">
                  {treatment?.name ?? "未設定療程"} · {packagePriceLabel(item)}
                </p>

                <form action={updatePackageAction} className="mt-5 grid gap-4 lg:grid-cols-2">
                  <input type="hidden" name="id" value={item.id} />
                  <SelectInput
                    label="連接療程"
                    name="treatmentId"
                    defaultValue={item.treatmentId}
                    options={treatmentOptions}
                  />
                  <TextInput label="套餐名稱" name="name" defaultValue={item.name} />
                  <NumberInput
                    label="原價"
                    name="originalPrice"
                    defaultValue={valueText(item.originalPrice)}
                  />
                  <NumberInput
                    label="優惠價"
                    name="promoPrice"
                    defaultValue={valueText(item.promoPrice)}
                  />
                  <TextInput label="貨幣" name="currency" defaultValue={item.currency} />
                  <label className="flex items-end gap-2 pb-3 text-sm font-bold text-[#5a2348]">
                    <input
                      type="checkbox"
                      name="paymentRequired"
                      defaultChecked={item.paymentRequired}
                    />
                    需要付款
                  </label>
                  <div className="lg:col-span-2">
                    <button className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
                      儲存
                    </button>
                  </div>
                </form>

                <div className="mt-5 rounded-[20px] bg-[#fff6f0] p-4">
                  <p className="text-sm font-bold text-[#321428]">
                    已連接表格：{linkedForms.length > 0 ? linkedForms.map((form) => form.formName).join(", ") : "未連接"}
                  </p>
                  <form action={deletePackageAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <input type="hidden" name="id" value={item.id} />
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#6d4a5c]">
                      <input type="checkbox" name="confirmDelete" />
                      確認刪除這個套餐
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

function StatusPill({ children }: { children: string }) {
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
      <input
        name={name}
        required
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}

function NumberInput({
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
      <input
        name={name}
        type="number"
        min="0"
        step="0.01"
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
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
