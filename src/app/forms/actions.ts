"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveForm,
  createForm,
  deleteFormSafely,
  duplicateForm,
  parseAllowedDomains,
  updateForm,
  type ManagedFormInput,
} from "@/lib/data/formManagement";
import {
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readStringArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function redirectWithMessage(path: string, message: string): never {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("form_status", message);
  redirect(`${pathname}?${params.toString()}`);
}

function safeReturnTo(value: string, fallback: string) {
  if (value.startsWith("/forms") && !value.startsWith("//")) return value;
  return fallback;
}

async function requireAdmin(path: string) {
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  const moduleAccess = await requireModuleAccess("forms");
  if (!moduleAccess.allowed) {
    redirect(`/login?next=${encodeURIComponent(path)}&error=permission_denied`);
  }
}

function parseFormInput(formData: FormData) {
  const parsedDomains = parseAllowedDomains(readString(formData, "allowedDomains"));

  if (!parsedDomains.ok) {
    return { input: null, error: parsedDomains.message };
  }

  const input: ManagedFormInput = {
    formName: readString(formData, "formName"),
    brandId: readString(formData, "brandId"),
    defaultTreatmentId: readString(formData, "defaultTreatmentId"),
    defaultPackageId: readString(formData, "defaultPackageId"),
    packageSelectionMode:
      readString(formData, "packageSelectionMode") === "customer_choice"
        ? "customer_choice"
        : "fixed",
    packageIds: readStringArray(formData, "packageIds"),
    defaultBranchId: readString(formData, "defaultBranchId"),
    branchIds: readStringArray(formData, "branchIds"),
    allowedDomains: parsedDomains.domains,
    status: "active",
  };

  return { input, error: null };
}

export async function createFormAction(formData: FormData) {
  await requireAdmin("/forms/new");
  const parsed = parseFormInput(formData);
  if (!parsed.input) {
    redirectWithMessage("/forms/new", parsed.error ?? "資料未能儲存。");
  }

  const result = await createForm(parsed.input);
  revalidatePath("/forms");

  if (!result.ok || !result.form) {
    redirectWithMessage("/forms/new", result.message);
  }

  redirectWithMessage(`/forms/${result.form.id}`, result.message);
}

export async function updateFormAction(formData: FormData) {
  const formId = readString(formData, "formId");
  await requireAdmin(`/forms/${formId}`);
  const parsed = parseFormInput(formData);
  const path = `/forms/${formId}`;

  if (!parsed.input) {
    redirectWithMessage(path, parsed.error ?? "資料未能儲存。");
  }

  const result = await updateForm(formId, parsed.input);
  revalidatePath("/forms");
  revalidatePath(path);

  redirectWithMessage(path, result.message);
}

export async function duplicateFormAction(formData: FormData) {
  const formId = readString(formData, "formId");
  await requireAdmin(`/forms/${formId}`);
  const result = await duplicateForm(formId);
  revalidatePath("/forms");

  if (!result.ok || !result.form) {
    redirectWithMessage(`/forms/${formId}`, result.message);
  }

  redirectWithMessage(`/forms/${result.form.id}`, result.message);
}

export async function archiveFormAction(formData: FormData) {
  const formId = readString(formData, "formId");
  await requireAdmin(`/forms/${formId}`);
  const confirmed = readString(formData, "confirmArchive") === "yes";
  const returnTo = safeReturnTo(readString(formData, "returnTo"), "/forms?archive=active");

  if (!confirmed) {
    redirectWithMessage(returnTo, "尚未封存；請先勾選封存確認。");
  }

  const result = await archiveForm(formId);
  revalidatePath("/forms");
  revalidatePath(`/forms/${formId}`);
  redirectWithMessage(returnTo, result.message);
}

export async function deleteFormAction(formData: FormData) {
  const formId = readString(formData, "formId");
  await requireAdmin(`/forms/${formId}`);
  const confirmed = readString(formData, "confirmDelete") === "yes";
  const returnTo = safeReturnTo(readString(formData, "returnTo"), "/forms?archive=active");

  if (!confirmed) {
    redirectWithMessage(returnTo, "尚未刪除；請先勾選永久刪除確認。");
  }

  const result = await deleteFormSafely(formId);
  revalidatePath("/forms");
  redirectWithMessage(returnTo, result.message);
}
