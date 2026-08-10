import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import {
  archiveFormAction,
  deleteFormAction,
  duplicateFormAction,
} from "@/app/forms/actions";
import { getFormOperations } from "@/lib/data/brandOperations";
import {
  getConfigurationData,
  type FormSetting,
} from "@/lib/data/configuration";
import {
  isArchivedStatus,
  isLegacyFormCandidate,
  legacyReasonLabel,
  matchesArchiveView,
  parseArchiveView,
  type ArchiveView,
} from "@/lib/data/legacyCleanup";

export const dynamic = "force-dynamic";

type FormsSearchParams = {
  brand?: string | string[];
  treatment?: string | string[];
  branch?: string | string[];
  status?: string | string[];
  archive?: string | string[];
  q?: string | string[];
  form_status?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function formMatchesSearch(form: FormSetting, search: string) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return (
    form.formName.toLowerCase().includes(needle) ||
    form.publicFormToken.toLowerCase().includes(needle) ||
    form.id.toLowerCase().includes(needle)
  );
}

function archiveViewLabel(view: ArchiveView) {
  if (view === "archived") return "已封存／舊版本";
  if (view === "all") return "全部";
  return "使用中";
}

function formStatusLabel(status: string, isLegacy: boolean) {
  if (isArchivedStatus(status)) return "已封存";
  if (isLegacy) return "待整理舊版本";
  return status || "使用中";
}

function buildFormsHref(
  view: ArchiveView,
  params: {
    brand: string;
    treatment: string;
    branch: string;
    status: string;
    search: string;
  }
) {
  const searchParams = new URLSearchParams();
  searchParams.set("archive", view);
  if (params.brand) searchParams.set("brand", params.brand);
  if (params.treatment) searchParams.set("treatment", params.treatment);
  if (params.branch) searchParams.set("branch", params.branch);
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("q", params.search);
  return `/forms?${searchParams.toString()}`;
}

export default async function FormsPage({
  searchParams,
}: {
  searchParams?: Promise<FormsSearchParams>;
}) {
  const config = await getConfigurationData();
  const query = await searchParams;
  const selectedBrand = firstParam(query?.brand);
  const selectedTreatment = firstParam(query?.treatment);
  const selectedBranch = firstParam(query?.branch);
  const selectedStatus = firstParam(query?.status);
  const selectedArchive = parseArchiveView(firstParam(query?.archive));
  const search = firstParam(query?.q).trim();
  const message = firstParam(query?.form_status);
  const brand =
    config.brands.find((item) => item.slug === selectedBrand || item.id === selectedBrand) ??
    null;
  const filteredForms = config.forms.filter((form) => {
    const ops = getFormOperations(config, form);
    const isLegacy = isLegacyFormCandidate(form);
    if (!matchesArchiveView(selectedArchive, { status: form.status, isLegacy })) {
      return false;
    }
    if (brand && form.brandId !== brand.id) return false;
    if (selectedTreatment && form.defaultTreatmentId !== selectedTreatment) {
      return false;
    }
    if (
      selectedBranch &&
      !ops.branches.some((branch) => branch.id === selectedBranch)
    ) {
      return false;
    }
    if (selectedStatus && form.status !== selectedStatus) return false;
    return formMatchesSearch(form, search);
  });
  const archivedCount = config.forms.filter((form) =>
    matchesArchiveView("archived", {
      status: form.status,
      isLegacy: isLegacyFormCandidate(form),
    })
  ).length;
  const activeCount = config.forms.length - archivedCount;
  const currentListPath = buildFormsHref(selectedArchive, {
    brand: selectedBrand,
    treatment: selectedTreatment,
    branch: selectedBranch,
    status: selectedStatus,
    search,
  });

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">表格管理</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Wix 登記表格
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                按品牌、療程、分店管理可嵌入 Wix 的登記表格，避免 Alyssa 同 Ineffable 設定混用。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/forms/new${brand ? `?brand=${brand.slug}` : ""}`}
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
              >
                建立 Wix Form
              </Link>
            </div>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[28px] border border-[#ead9cf] bg-white/86 p-5">
          <div className="mb-4">
            <div>
              <p className="text-sm font-bold text-[#321428]">
                顯示：{archiveViewLabel(selectedArchive)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#7b5a6a]">
                {activeCount} 使用中 · {archivedCount} 已封存／舊版本
              </p>
            </div>
          </div>
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-[0.85fr_1fr_1fr_1fr_1fr_1.2fr_auto]"
            method="get"
          >
            <FilterSelect
              label="顯示"
              name="archive"
              value={selectedArchive}
              options={[
                { value: "active", label: `使用中 (${activeCount})` },
                {
                  value: "archived",
                  label: `已封存／舊版本 (${archivedCount})`,
                },
                { value: "all", label: `全部 (${config.forms.length})` },
              ]}
              includeAll={false}
            />
            <FilterSelect
              label="品牌"
              name="brand"
              value={brand?.slug || ""}
              options={config.brands.map((item) => ({
                value: item.slug,
                label: item.name,
              }))}
            />
            <FilterSelect
              label="療程"
              name="treatment"
              value={selectedTreatment}
              options={config.treatments
                .filter((item) => !brand || item.brandId === brand.id)
                .map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              label="分店"
              name="branch"
              value={selectedBranch}
              options={config.branches
                .filter((item) => !brand || item.brandId === brand.id)
                .map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              label="狀態"
              name="status"
              value={selectedStatus}
              options={Array.from(new Set(config.forms.map((form) => form.status))).map(
                (status) => ({ value: status, label: status || "可使用" })
              )}
            />
            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                Search
              </span>
              <input
                name="q"
                defaultValue={search}
                placeholder="表格名稱／識別碼"
                className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none focus:border-[#e46f64] focus:bg-white"
              />
            </label>
            <SubmitButton
              pendingLabel="篩選中…"
              className="self-end rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
            >
              Filter
            </SubmitButton>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#ead9cf] bg-white/90 shadow-[0_24px_70px_rgba(90,35,72,0.08)]">
          <div className="max-w-full overflow-x-auto">
            <table
              className="min-w-[980px] text-left text-sm"
              data-testid="form-management-list"
            >
              <thead className="bg-[#fff6f0] text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
                <tr>
                  {[
                    "表格名稱",
                    "品牌",
                    "療程／Campaign 優惠",
                    "分店",
                    "狀態／更新時間",
                    "操作",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredForms.map((form) => {
                  const ops = getFormOperations(config, form);
                  const isLegacy = isLegacyFormCandidate(form);
                  const status = formStatusLabel(form.status, isLegacy);
                  const legacyReason = legacyReasonLabel(isLegacy);
                  return (
                    <tr
                      key={form.id}
                      className="align-top transition hover:bg-[#fff9f3]"
                    >
                      <td className="border-t border-[#f1e3dc] px-4 py-4">
                        <Link
                          href={`/forms/${form.id}`}
                          className="font-bold text-[#321428] underline-offset-4 hover:underline"
                        >
                          {form.formName}
                        </Link>
                        <p className="mt-1 text-xs font-semibold text-[#7b5a6a]">
                          This form belongs to {ops.brand?.name || "未設定品牌"}
                        </p>
                        <p className="mt-2 max-w-[250px] break-all font-mono text-[11px] font-semibold text-[#9a5d76]">
                          {form.publicFormToken}
                        </p>
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4 font-semibold text-[#5a2348]">
                        {ops.brand?.name || "未設定"}
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4">
                        <p className="font-semibold text-[#5a2348]">
                          {ops.treatment?.name || "未設定療程"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#321428]">
                          {ops.packageLabel}
                        </p>
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4 font-semibold text-[#5a2348]">
                        {ops.branchLabel}
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {status}
                        </span>
                        {legacyReason && (
                          <p className="mt-2 text-xs font-semibold text-[#9a5d76]">
                            {legacyReason}
                          </p>
                        )}
                        <p className="mt-2 text-xs font-semibold text-[#7b5a6a]">
                          {form.updatedAt || form.createdAt || "-"}
                        </p>
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4">
                        <div className="flex min-w-[170px] flex-wrap items-start gap-2">
                          <Link
                            href={`/forms/${form.id}`}
                            className="rounded-full bg-[#5a2348] px-3 py-1.5 text-xs font-bold text-white"
                          >
                            編輯
                          </Link>
                          <details>
                            <summary className="cursor-pointer rounded-full border border-[#ead9cf] bg-white px-3 py-1.5 text-xs font-bold text-[#5a2348]">
                              更多
                            </summary>
                            <div className="mt-2 grid w-72 gap-2 rounded-2xl border border-[#ead9cf] bg-white p-3 shadow-[0_18px_42px_rgba(90,35,72,0.12)]">
                              <CopyButton
                                value={ops.embedCode}
                                label="複製 Wix 嵌入碼"
                              />
                              <Link
                                href={`/embed/${form.publicFormToken}`}
                                className="rounded-full border border-[#ead9cf] bg-white px-3 py-1.5 text-center text-xs font-bold text-[#5a2348]"
                              >
                                預覽表格
                              </Link>
                              <Link
                                href={`/leads?form=${form.publicFormToken}`}
                                className="rounded-full border border-[#ead9cf] bg-white px-3 py-1.5 text-center text-xs font-bold text-[#5a2348]"
                              >
                                查看 Leads
                              </Link>
                              <form action={duplicateFormAction}>
                                <input
                                  type="hidden"
                                  name="formId"
                                  value={form.id}
                                />
                                <SubmitButton
                                  className="w-full rounded-full border border-[#ead9cf] bg-white px-3 py-1.5 text-xs font-bold text-[#5a2348]"
                                  pendingLabel="複製中…"
                                >
                                  複製表格
                                </SubmitButton>
                              </form>
                              <p className="text-xs font-semibold leading-5 text-[#7b5a6a]">
                                封存後會移出使用中列表；只有冇連接 Leads 或廣告頁嘅表格先可以永久刪除。
                              </p>
                              <form action={archiveFormAction} className="mt-3 grid gap-2">
                                <input type="hidden" name="formId" value={form.id} />
                                <input type="hidden" name="returnTo" value={currentListPath} />
                                <label className="flex items-center gap-2 text-xs font-bold text-[#5a2348]">
                                  <input
                                    type="checkbox"
                                    name="confirmArchive"
                                    value="yes"
                                    className="h-4 w-4"
                                  />
                                  確認封存
                                </label>
                                <SubmitButton
                                  className="rounded-full bg-[#5a2348] px-3 py-1.5 text-xs font-bold text-white"
                                  pendingLabel="封存中…"
                                >
                                  封存
                                </SubmitButton>
                              </form>
                              <form
                                action={deleteFormAction}
                                className="mt-3 grid gap-2 border-t border-[#f1e3dc] pt-3"
                              >
                                <input type="hidden" name="formId" value={form.id} />
                                <input type="hidden" name="returnTo" value={currentListPath} />
                                <label className="flex items-center gap-2 text-xs font-bold text-[#8a2732]">
                                  <input
                                    type="checkbox"
                                    name="confirmDelete"
                                    value="yes"
                                    className="h-4 w-4"
                                  />
                                  確認永久刪除
                                </label>
                                <SubmitButton
                                  className="rounded-full border border-[#e7b8b8] bg-[#fff5f5] px-3 py-1.5 text-xs font-bold text-[#8a2732]"
                                  pendingLabel="刪除中…"
                                >
                                  永久刪除
                                </SubmitButton>
                              </form>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredForms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-[#7b5a6a]">
                      找不到符合條件的表格。請切換品牌或建立新的 Wix Form。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
  includeAll = true,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  includeAll?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none focus:border-[#e46f64] focus:bg-white"
      >
        {includeAll && <option value="">全部</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
