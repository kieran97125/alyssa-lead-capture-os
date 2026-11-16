"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { archiveForm, createForm, deleteFormSafely, duplicateForm, parseAllowedDomains, restoreForm, updateForm, type ManagedFormInput } from "@/lib/data/formManagement";
import { managedFormSchema } from "@/lib/acquisition/managedFormSchema";
import { PUBLIC_FORM_CONFIG_CACHE_TAG } from "@/lib/data/publicFormConfig";
import { requireModuleAccess, verifyCurrentInternalAccess } from "@/lib/security/internalAccessServer";

type ActionFailure = { ok: false; message: string; fieldErrors?: Record<string, string> };
function readString(data: FormData, key: string) { return String(data.get(key) ?? "").trim(); }
function readArray(data: FormData, key: string) { return data.getAll(key).map(value => String(value).trim()).filter(Boolean); }
function readRevision(data: FormData) { const value = readString(data, "expectedRevision"); return value ? Number(value) : undefined; }
function redirectWithMessage(path: string, message: string): never {
  const url = new URL(path, "https://internal.invalid");
  url.searchParams.set("form_status", message);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}
function safeReturnTo(value: string, fallback: string) {
  try {
    const url = new URL(value, "https://internal.invalid");
    if (url.origin === "https://internal.invalid" && (url.pathname === "/forms" || url.pathname.startsWith("/forms/") || url.pathname === "/campaigns")) return `${url.pathname}${url.search}`;
  } catch {}
  return fallback;
}
async function requireAdmin(path: string) {
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) redirect(`/login?next=${encodeURIComponent(path)}`);
  const access = await requireModuleAccess("forms");
  if (!access.allowed) redirect(`/login?next=${encodeURIComponent(path)}&error=permission_denied`);
}
function revalidateForms(formId?: string) {
  revalidatePath("/forms"); revalidatePath("/campaigns");
  if (formId) revalidatePath(`/forms/${formId}`);
  revalidateTag(PUBLIC_FORM_CONFIG_CACHE_TAG, { expire: 0 });
}
function parseFormInput(data: FormData): { input: ManagedFormInput } | ActionFailure {
  const parsed = managedFormSchema.safeParse({
    formName: readString(data, "formName"), brandId: readString(data, "brandId"), defaultTreatmentId: readString(data, "defaultTreatmentId"),
    defaultPackageId: readString(data, "defaultPackageId"), packageSelectionMode: readString(data, "packageSelectionMode") || "fixed", packageIds: readArray(data, "packageIds"),
    defaultBranchId: readString(data, "defaultBranchId"), branchIds: readArray(data, "branchIds"), allowedDomains: readString(data, "allowedDomains"),
    placementKind: readString(data, "placementKind") || "unspecified", placementUrl: readString(data, "placementUrl"), expectedRevision: readRevision(data), requestId: readString(data, "requestId") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) { const key = String(issue.path[0] ?? "form"); fieldErrors[key] ??= issue.message; }
    return { ok: false, message: parsed.error.issues[0]?.message ?? "請檢查資料。", fieldErrors };
  }
  const domains = parseAllowedDomains(parsed.data.allowedDomains);
  if (!domains.ok) return { ok: false, message: domains.message, fieldErrors: { allowedDomains: domains.message } };
  return { input: { ...parsed.data, allowedDomains: domains.domains } };
}
export async function createFormAction(data: FormData): Promise<ActionFailure | void> {
  await requireAdmin("/forms/new");
  const parsed = parseFormInput(data);
  if (!("input" in parsed)) return parsed;
  if (!parsed.input.requestId) return { ok: false, message: "操作資料不完整，請重新載入。" };
  const result = await createForm(parsed.input);
  if (!result.ok || !result.form) return { ok: false, message: result.message };
  revalidateForms(result.form.id);
  redirectWithMessage(`/forms/${result.form.id}`, result.message);
}
export async function updateFormAction(data: FormData): Promise<ActionFailure | void> {
  const formId = readString(data, "formId");
  await requireAdmin(`/forms/${formId}`);
  const parsed = parseFormInput(data);
  if (!("input" in parsed)) return parsed;
  const result = await updateForm(formId, parsed.input);
  if (!result.ok) return { ok: false, message: result.message };
  revalidateForms(formId);
  redirectWithMessage(`/forms/${formId}`, result.message);
}
export async function duplicateFormAction(data: FormData) {
  const formId = readString(data, "formId");
  await requireAdmin(`/forms/${formId}`);
  const requestId = readString(data, "requestId");
  if (!requestId) redirectWithMessage(`/forms/${formId}`, "操作資料不完整，請重新載入。");
  const result = await duplicateForm(formId, { expectedRevision: readRevision(data), requestId });
  if (!result.ok || !result.form) redirectWithMessage(`/forms/${formId}`, result.message);
  revalidateForms(result.form.id);
  redirectWithMessage(`/forms/${result.form.id}`, result.message);
}
export async function archiveFormAction(data: FormData) {
  const formId = readString(data, "formId");
  await requireAdmin(`/forms/${formId}`);
  const returnTo = safeReturnTo(readString(data, "returnTo"), "/campaigns?tab=forms");
  if (readString(data, "confirmArchive") !== "yes") redirectWithMessage(returnTo, "請先確認封存表格。");
  const result = await archiveForm(formId, { expectedRevision: readRevision(data) });
  if (result.ok) revalidateForms(formId);
  redirectWithMessage(returnTo, result.message);
}
export async function restoreFormAction(data: FormData) {
  const formId = readString(data, "formId");
  await requireAdmin(`/forms/${formId}`);
  const result = await restoreForm(formId, { expectedRevision: readRevision(data) });
  if (result.ok) revalidateForms(formId);
  redirectWithMessage(safeReturnTo(readString(data, "returnTo"), "/campaigns?tab=forms"), result.message);
}
export async function deleteFormAction(data: FormData) {
  const formId = readString(data, "formId");
  await requireAdmin(`/forms/${formId}`);
  const returnTo = safeReturnTo(readString(data, "returnTo"), "/campaigns?tab=forms");
  if (readString(data, "confirmDelete") !== "yes") redirectWithMessage(returnTo, "請先確認永久刪除表格。");
  const result = await deleteFormSafely(formId, { expectedRevision: readRevision(data) });
  if (result.ok) revalidateForms(formId);
  redirectWithMessage(returnTo, result.message);
}
