import {
  createPackageAction,
  deletePackageAction,
  updatePackageAction,
} from "@/app/settings/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsBrandPicker } from "@/components/alyssa/SettingsBrandPicker";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import { SettingsTreatmentPicker } from "@/components/alyssa/SettingsTreatmentPicker";
import {
  getConfigurationData,
  getTreatment,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function money(value: number | string | null, currency: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
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
    brand?: string | string[];
    treatment?: string | string[];
    settings_status?: string | string[];
    message?: string | string[];
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
  const selectedTreatmentParam = firstParam(query?.treatment);
  const selectedTreatment =
    visibleTreatments.find(
      (treatment) =>
        treatment.id === selectedTreatmentParam ||
        treatment.slug === selectedTreatmentParam
    ) ?? null;
  const visibleTreatmentIds = new Set(visibleTreatments.map((item) => item.id));
  const visiblePackages = config.packages.filter(
    (item) =>
      visibleTreatmentIds.has(item.treatmentId) &&
      (!selectedTreatment || item.treatmentId === selectedTreatment.id)
  );
  const message = firstParam(query?.message);
  const status = firstParam(query?.settings_status);
  const treatmentOptions = visibleTreatments.map((treatment) => ({
    value: treatment.id,
    label: treatment.name,
  }));
  const returnPath = `/settings/packages?brand=${selectedBrand?.slug || ""}${
    selectedTreatment ? `&treatment=${selectedTreatment.slug}` : ""
  }`;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/88 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="alyssa-kicker">Settings</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Offer／項目及價錢
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                同一療程可管理多個計劃組別及價錢；每個項目一行，展開先編輯。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingsBrandPicker
                brands={config.brands}
                selectedBrandId={selectedBrand?.id}
                basePath="/settings/packages"
              />
              <SettingsTreatmentPicker
                treatments={visibleTreatments}
                selectedTreatmentId={selectedTreatment?.id}
                brandSlug={selectedBrand?.slug || ""}
                basePath="/settings/packages"
              />
            </div>
          </div>
          <SettingsNav />
        </header>

        {message && <StatusMessage tone={status}>{message}</StatusMessage>}

        <details className="mt-6 rounded-[22px] border border-[#ead9cf] bg-white/92">
          <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-[#5a2348]">
            ＋ 新增 Offer／價錢項目
          </summary>
          <form
            action={createPackageAction}
            className="grid gap-4 border-t border-[#f1e3dc] p-5 lg:grid-cols-4"
          >
            <input type="hidden" name="returnPath" value={returnPath} />
            <SelectInput
              label="連接療程"
              name="treatmentId"
              defaultValue={selectedTreatment?.id}
              options={treatmentOptions}
            />
            <TextInput
              label="計劃組別"
              name="groupName"
              placeholder="例如：兩年激脫計劃"
              required={false}
            />
            <TextInput
              label="項目名稱"
              name="name"
              placeholder="例如：MEDIUM"
            />
            <NumberInput
              label="排序"
              name="displayOrder"
              defaultValue="0"
              step="1"
            />
            <NumberInput label="原價" name="originalPrice" />
            <NumberInput label="優惠價" name="promoPrice" />
            <TextInput
              label="貨幣"
              name="currency"
              defaultValue="HKD"
            />
            <SelectInput
              label="狀態"
              name="status"
              defaultValue="active"
              options={[
                { value: "active", label: "啟用" },
                { value: "inactive", label: "停用" },
              ]}
            />
            <label className="flex items-end gap-2 pb-3 text-sm font-bold text-[#5a2348]">
              <input type="checkbox" name="paymentRequired" />
              需要付款
            </label>
            <div className="lg:col-span-4">
              <button className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white">
                建立項目
              </button>
            </div>
          </form>
        </details>

        <section
          aria-label="Offer 及價錢列表"
          className="mt-5 overflow-hidden rounded-[24px] border border-[#ead9cf] bg-white/92 shadow-[0_18px_50px_rgba(90,35,72,0.06)]"
          data-testid="package-management-list"
        >
          <div className="hidden grid-cols-[minmax(150px,0.9fr)_minmax(150px,0.9fr)_minmax(190px,1.1fr)_100px_100px_90px_80px_60px] gap-4 bg-[#fff6f0] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76] lg:grid">
            <span>計劃組別</span>
            <span>項目</span>
            <span>療程</span>
            <span>原價</span>
            <span>優惠價</span>
            <span>狀態</span>
            <span>表格</span>
            <span />
          </div>

          {visiblePackages.map((item) => {
            const treatment = getTreatment(config, item.treatmentId);
            const linkedForms = config.forms.filter(
              (form) =>
                form.defaultPackageId === item.id ||
                config.formPackages.some(
                  (setting) =>
                    setting.formId === form.id &&
                    setting.packageId === item.id &&
                    setting.isActive
                )
            );

            return (
              <details
                key={item.id}
                className="group border-t border-[#f1e3dc] first:border-t-0 lg:first:border-t"
              >
                <summary className="grid cursor-pointer gap-2 px-5 py-4 transition hover:bg-[#fff9f3] lg:grid-cols-[minmax(150px,0.9fr)_minmax(150px,0.9fr)_minmax(190px,1.1fr)_100px_100px_90px_80px_60px] lg:items-center lg:gap-4">
                  <span className="font-bold text-[#5a2348]">
                    {item.groupName || "未分類"}
                  </span>
                  <span className="font-bold text-[#321428]">{item.name}</span>
                  <span className="text-sm font-semibold text-[#6d4a5c]">
                    {treatment?.name ?? "未設定療程"}
                  </span>
                  <RowValue
                    label="原價"
                    value={money(item.originalPrice, item.currency)}
                  />
                  <RowValue
                    label="優惠價"
                    value={money(item.promoPrice, item.currency)}
                    strong
                  />
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                      item.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.status === "active" ? "啟用" : "停用"}
                  </span>
                  <RowValue label="表格" value={String(linkedForms.length)} />
                  <span className="text-sm font-bold text-[#5a2348]">
                    編輯
                  </span>
                </summary>

                <div className="border-t border-[#f1e3dc] bg-[#fffdfb] p-5">
                  <form
                    action={updatePackageAction}
                    className="grid gap-4 lg:grid-cols-4"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="hidden"
                      name="returnPath"
                      value={returnPath}
                    />
                    <SelectInput
                      label="連接療程"
                      name="treatmentId"
                      defaultValue={item.treatmentId}
                      options={treatmentOptions}
                    />
                    <TextInput
                      label="計劃組別"
                      name="groupName"
                      defaultValue={item.groupName ?? ""}
                      required={false}
                    />
                    <TextInput
                      label="項目名稱"
                      name="name"
                      defaultValue={item.name}
                    />
                    <NumberInput
                      label="排序"
                      name="displayOrder"
                      defaultValue={String(item.displayOrder)}
                      step="1"
                    />
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
                    <TextInput
                      label="貨幣"
                      name="currency"
                      defaultValue={item.currency}
                    />
                    <SelectInput
                      label="狀態"
                      name="status"
                      defaultValue={item.status}
                      options={[
                        { value: "active", label: "啟用" },
                        { value: "inactive", label: "停用" },
                      ]}
                    />
                    <label className="flex items-end gap-2 pb-3 text-sm font-bold text-[#5a2348]">
                      <input
                        type="checkbox"
                        name="paymentRequired"
                        defaultChecked={item.paymentRequired}
                      />
                      需要付款
                    </label>
                    <div className="flex items-end lg:col-span-3">
                      <button className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
                        儲存
                      </button>
                    </div>
                  </form>

                  <p className="mt-4 text-xs font-semibold leading-5 text-[#7b5a6a]">
                    已連接表格：
                    {linkedForms.length > 0
                      ? linkedForms.map((form) => form.formName).join("、")
                      : "未連接"}
                  </p>

                  <details className="mt-4 border-t border-[#f1e3dc] pt-4">
                    <summary className="w-fit cursor-pointer text-xs font-bold text-[#8a2732]">
                      刪除項目
                    </summary>
                    <form
                      action={deletePackageAction}
                      className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"
                    >
                      <input type="hidden" name="id" value={item.id} />
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

          {visiblePackages.length === 0 && (
            <p className="px-5 py-10 text-center text-sm font-semibold text-[#7b5a6a]">
              呢個篩選未有 Offer／價錢項目。展開上方新增。
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function RowValue({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <span
      className={`text-sm ${strong ? "font-bold text-[#321428]" : "font-semibold text-[#6d4a5c]"}`}
    >
      <span className="mr-2 text-xs text-[#9a5d76] lg:hidden">{label}</span>
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
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none focus:border-[#e46f64]"
      />
    </label>
  );
}

function NumberInput({
  label,
  name,
  defaultValue = "",
  step = "0.01",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  step?: string;
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
        step={step}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none focus:border-[#e46f64]"
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
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none focus:border-[#e46f64]"
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
