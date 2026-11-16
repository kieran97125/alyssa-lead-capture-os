import { randomUUID } from "crypto";
import { z } from "zod";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { getBranch, getBrand, getConfigurationData, getPackage, getTreatment, type ConfigurationData, type FormSetting } from "@/lib/data/configuration";
import { buildBrandSuccessRedirectUrl, getBrandLaunchDefaults, getOfferValueForRedirect, getTreatmentSlugForRedirect, isValidBrandSuccessRedirectUrl } from "@/lib/data/brandDefaults";
import { getPublicBaseUrl } from "@/lib/data/appUrl";
import { managedFormSchema, normalizePlacementUrl, type ManagedFormPlacementKind } from "@/lib/acquisition/managedFormSchema";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export type ManagedFormInput = {
  formName: string; brandId: string; defaultTreatmentId: string; defaultPackageId: string;
  packageSelectionMode: "fixed" | "customer_choice"; packageIds: string[];
  defaultBranchId: string; branchIds: string[]; allowedDomains: string[]; status?: string;
  placementKind?: ManagedFormPlacementKind; placementUrl?: string | null;
  expectedRevision?: number; requestId?: string;
};
export type ManagedFormRpcPayload = {
  form_name: string; brand_id: string; token_base: string;
  default_treatment_id: string; default_package_id: string; default_branch_id: string;
  package_selection_mode: "fixed" | "customer_choice"; package_ids: string[]; branch_ids: string[];
  allowed_domains: string[]; conversion_mode: "form_submit_pixel" | "thank_you_redirect";
  success_redirect_url: string | null; placement_kind: ManagedFormPlacementKind; placement_url: string | null;
};
export type FormMutationResult = { ok: boolean; message: string; form?: FormSetting; replayed?: boolean };
export type ManagedFormMutationOptions = { expectedRevision?: number; requestId?: string };
const unavailableMessage = "暫時未能讀取表格設定，請稍後再試。";
const revisionMessage = "設定已更新，請重新載入頁面再操作。";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "campaign";
}
export function buildPublicFormTokenBase(formName: string, brandSlug: string) {
  const brandPrefix = slugify(brandSlug).replace(/^alyssa-ineffable-beauty$/, "ineffable-beauty").replace(/^alyssa-ineffable$/, "ineffable");
  let formSlug = slugify(formName);
  for (const prefix of [brandPrefix, brandPrefix === "ineffable-beauty" ? "ineffable" : ""].filter(Boolean)) {
    if (formSlug === prefix) formSlug = "";
    if (formSlug.startsWith(`${prefix}-`)) formSlug = formSlug.slice(prefix.length + 1);
  }
  return `${brandPrefix}-${formSlug.replace(/-form$/, "") || "campaign"}-form`;
}
function normalizeOrigin(value: string) {
  const text = value.trim();
  if (!text) return null;
  const full = /^https?:\/\//i.test(text) ? text : /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(text) ? `http://${text}` : `https://${text}`;
  const normalized = normalizePlacementUrl(full);
  if (!normalized) return null;
  const url = new URL(normalized);
  return url.hostname.includes(".") || url.hostname === "localhost" ? url.origin : null;
}
export function parseAllowedDomains(value: string) {
  const origins = value.split(/[\n,]+/).map(item => item.trim()).filter(Boolean).map(normalizeOrigin);
  if (origins.some(item => !item) || origins.length > 50) return { ok: false as const, domains: [] as string[], message: "請輸入有效網站網址，每行一個，最多 50 個。" };
  return { ok: true as const, domains: [...new Set(origins.filter((item): item is string => Boolean(item)))] };
}

function findForm(config: ConfigurationData, formId: string) {
  return config.forms.find(item => item.id === formId || item.publicFormToken === formId || (formId === alyssaDefaultForm.id && item.publicFormToken === alyssaDefaultForm.publicFormToken)) ?? null;
}
export async function listForms() { return (await getConfigurationData({ strict: true })).forms; }
export async function getFormByIdOrSlug(formId: string) {
  const config = await getConfigurationData({ strict: true });
  return { form: findForm(config, formId), config };
}

function preparePayload(config: ConfigurationData, input: ManagedFormInput, existing?: FormSetting): { ok: true; payload: ManagedFormRpcPayload } | { ok: false; message: string } {
  const parsed = managedFormSchema.safeParse({ ...input, allowedDomains: input.allowedDomains.join("\n"), placementKind: input.placementKind ?? existing?.placementKind ?? "unspecified", placementUrl: input.placementUrl ?? existing?.placementUrl ?? "" });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "請檢查表格設定。" };
  const values = parsed.data;
  const brand = getBrand(config, values.brandId);
  const treatment = getTreatment(config, values.defaultTreatmentId);
  const selectedPackage = getPackage(config, values.defaultPackageId);
  const packageIds = values.packageSelectionMode === "fixed" ? [values.defaultPackageId] : [...new Set([...values.packageIds, values.defaultPackageId])];
  const branchIds = [...new Set([...values.branchIds, values.defaultBranchId])];
  if (!brand) return { ok: false, message: "請選擇可管理的品牌。" };
  if (existing && brand.id !== existing.brandId) return { ok: false, message: "表格的品牌不能更改，請為另一品牌新增表格。" };
  if (!treatment || treatment.brandId !== brand.id || treatment.status !== "active") return { ok: false, message: "請選擇此品牌的有效療程。" };
  if (!selectedPackage || selectedPackage.treatmentId !== treatment.id || packageIds.some(id => {
    const item = getPackage(config, id);
    const itemTreatment = item ? getTreatment(config, item.treatmentId) : null;
    return !item || item.status !== "active" || !itemTreatment || itemTreatment.status !== "active" || itemTreatment.brandId !== brand.id;
  })) return { ok: false, message: "請選擇此品牌的有效優惠，預設優惠須屬於所選療程。" };
  if (branchIds.some(id => { const branch = getBranch(config, id); return !branch || branch.brandId !== brand.id || branch.status !== "active"; })) return { ok: false, message: "請選擇此品牌的有效分店。" };
  const parsedDomains = parseAllowedDomains(values.allowedDomains);
  if (!parsedDomains.ok) return { ok: false, message: parsedDomains.message };
  const placementUrl = values.placementUrl ? normalizePlacementUrl(values.placementUrl) : null;
  const domains = new Set(parsedDomains.domains);
  if (placementUrl) domains.add(new URL(placementUrl).origin);
  if (values.placementKind === "landing_page" || values.placementKind === "both") {
    const publicOrigin = normalizeOrigin(getPublicBaseUrl());
    if (!publicOrigin || publicOrigin.includes("YOUR_PRODUCTION_DOMAIN".toLowerCase())) return { ok: false, message: "登記頁網址未設定好，請聯絡管理員。" };
    domains.add(publicOrigin);
  }
  if ((values.placementKind === "wix" || values.placementKind === "both") && !domains.size) return { ok: false, message: "請填寫準備放置表格的網站網址。" };
  if (domains.size > 50) return { ok: false, message: "網站網址最多 50 個。" };
  const defaults = getBrandLaunchDefaults(brand.slug);
  const existingRedirect = existing?.successRedirectUrl;
  let successRedirectUrl = existingRedirect || null;
  if (defaults) {
    const generated = buildBrandSuccessRedirectUrl({ brandSlug: brand.slug, treatmentSlug: getTreatmentSlugForRedirect(treatment), value: getOfferValueForRedirect(selectedPackage) });
    if (generated && existingRedirect && isValidBrandSuccessRedirectUrl(brand.slug, existingRedirect)) {
      const current = new URL(existingRedirect);
      const derived = new URL(generated);
      for (const key of ["submitted", "treatment", "value"]) {
        const value = derived.searchParams.get(key);
        if (value === null) current.searchParams.delete(key); else current.searchParams.set(key, value);
      }
      successRedirectUrl = current.toString();
    } else successRedirectUrl = generated || null;
  }
  return { ok: true, payload: {
    form_name: values.formName, brand_id: brand.id, token_base: buildPublicFormTokenBase(values.formName, brand.slug),
    default_treatment_id: treatment.id, default_package_id: values.defaultPackageId, default_branch_id: values.defaultBranchId,
    package_selection_mode: values.packageSelectionMode, package_ids: packageIds, branch_ids: branchIds,
    allowed_domains: [...domains].sort(), conversion_mode: defaults?.defaultConversionMode ?? "form_submit_pixel",
    success_redirect_url: successRedirectUrl, placement_kind: values.placementKind, placement_url: placementUrl,
  } };
}
/** Authoritative scoped preparation shared with transactional form + page creation. */
export async function prepareManagedFormPayload(input: ManagedFormInput): Promise<{ ok: true; payload: ManagedFormRpcPayload } | { ok: false; message: string }> {
  try { return preparePayload(await getConfigurationData({ strict: true }), input); }
  catch { return { ok: false, message: unavailableMessage }; }
}

const formRowSchema = z.object({
  id: z.uuid(), public_form_token: z.string().min(1), brand_id: z.uuid(), form_name: z.string(), status: z.string(),
  revision: z.number().int().positive(), allowed_domains: z.array(z.string()),
  default_treatment_id: z.string().nullable(), default_package_id: z.string().nullable(), default_branch_id: z.string().nullable(),
  package_selection_mode: z.enum(["fixed", "customer_choice"]), placement_kind: z.enum(["unspecified", "wix", "landing_page", "both"]),
  placement_url: z.string().nullable(), conversion_mode: z.enum(["form_submit_pixel", "thank_you_redirect"]).nullable().optional(),
  success_redirect_url: z.string().nullable().optional(), created_at: z.string().optional(), updated_at: z.string().optional(),
});
function asForm(row: z.infer<typeof formRowSchema>): FormSetting {
  return { id: row.id, publicFormToken: row.public_form_token, brandId: row.brand_id, formName: row.form_name,
    status: row.status, revision: row.revision, allowedDomains: row.allowed_domains,
    defaultTreatmentId: row.default_treatment_id, defaultPackageId: row.default_package_id, defaultBranchId: row.default_branch_id,
    packageSelectionMode: row.package_selection_mode, placementKind: row.placement_kind, placementUrl: row.placement_url,
    conversionMode: row.conversion_mode, successRedirectUrl: row.success_redirect_url, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mutationError(error: { message?: string; code?: string }) {
  if (error.message?.includes("revision_conflict") || error.code === "40001") return revisionMessage;
  if (error.message?.includes("request_conflict")) return "此操作的資料已改變，請重新提交。";
  if (error.message?.includes("brand_immutable")) return "表格的品牌不能更改，請為另一品牌新增表格。";
  if (error.message?.includes("in_use") || error.code === "23503") return "此表格已有登記或連接登記頁，請使用封存。";
  if (error.message?.includes("selection_invalid")) return "療程、優惠或分店已變更，請重新選擇。";
  return "未能儲存設定，請稍後再試。";
}
async function mutate(operation: string, formId: string | null, expectedRevision: number | undefined, requestId: string | undefined, payload: ManagedFormRpcPayload | Record<string, never>, message: string): Promise<FormMutationResult> {
  if (!hasSupabaseAdminEnv()) return { ok: false, message: "正式資料庫未連接，暫時未能修改表格。" };
  if (operation !== "create" && (!Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 1)) return { ok: false, message: revisionMessage };
  if (requestId !== undefined && !z.uuid().safeParse(requestId).success) return { ok: false, message: "操作資料不完整，請重新載入。" };
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("mutate_managed_form_v1", { p_operation: operation, p_form_id: formId, p_expected_revision: expectedRevision ?? null, p_request_id: requestId ?? null, p_payload: payload });
    if (error) return { ok: false, message: mutationError(error) };
    const result = z.object({ form: formRowSchema, replayed: z.boolean() }).safeParse(data);
    if (!result.success) return { ok: false, message: "設定未能確認，請重新載入後檢查。" };
    return { ok: true, message, form: asForm(result.data.form), replayed: result.data.replayed };
  } catch { return { ok: false, message: "未能儲存設定，請稍後再試。" }; }
}
export async function createForm(input: ManagedFormInput): Promise<FormMutationResult> {
  const prepared = await prepareManagedFormPayload(input);
  return prepared.ok ? mutate("create", null, undefined, input.requestId ?? randomUUID(), prepared.payload, "表格已建立。") : prepared;
}
export async function updateForm(formId: string, input: ManagedFormInput): Promise<FormMutationResult> {
  try {
    const { config, form } = await getFormByIdOrSlug(formId);
    if (!form) return { ok: false, message: "找不到可管理的表格。" };
    const prepared = preparePayload(config, input, form);
    return prepared.ok ? mutate("update", form.id, input.expectedRevision, undefined, prepared.payload, "表格設定已儲存。") : prepared;
  } catch { return { ok: false, message: unavailableMessage }; }
}
async function lifecycle(operation: "duplicate" | "archive" | "restore" | "delete", formId: string, options: ManagedFormMutationOptions = {}): Promise<FormMutationResult> {
  try {
    const { form } = await getFormByIdOrSlug(formId);
    if (!form) return { ok: false, message: "找不到可管理的表格。" };
    const messages = { duplicate: "表格已複製。", archive: "表格已封存，會停止接收新登記。", restore: "表格已恢復，可以接收登記。", delete: "未使用的表格已永久刪除。" };
    return mutate(operation, form.id, options.expectedRevision, operation === "duplicate" ? options.requestId ?? randomUUID() : undefined, {}, messages[operation]);
  } catch { return { ok: false, message: unavailableMessage }; }
}
export async function duplicateForm(formId: string, options?: ManagedFormMutationOptions) { return lifecycle("duplicate", formId, options); }
export async function archiveForm(formId: string, options?: ManagedFormMutationOptions) { return lifecycle("archive", formId, options); }
export async function restoreForm(formId: string, options?: ManagedFormMutationOptions) { return lifecycle("restore", formId, options); }
export async function deleteFormSafely(formId: string, options?: ManagedFormMutationOptions) { return lifecycle("delete", formId, options); }
