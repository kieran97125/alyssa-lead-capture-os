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
    defaultBranchId: readString(formData, "defaultBranchId"),
    branchIds: readStringArray(formData, "branchIds"),
    allowedDomains: parsedDomains.domains,
    status: "active",
  };

  return { input, error: null };
}

export async function createFormAction(formData: FormData) {
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
  const result = await duplicateForm(formId);
  revalidatePath("/forms");

  if (!result.ok || !result.form) {
    redirectWithMessage(`/forms/${formId}`, result.message);
  }

  redirectWithMessage(`/forms/${result.form.id}`, result.message);
}

export async function archiveFormAction(formData: FormData) {
  const formId = readString(formData, "formId");
  const confirmed = readString(formData, "confirmArchive") === "yes";
  const returnTo = safeReturnTo(readString(formData, "returnTo"), "/forms?archive=active");

  if (!confirmed) {
    redirectWithMessage(returnTo, "Archive not applied. Tick the confirmation checkbox first.");
  }

  const result = await archiveForm(formId);
  revalidatePath("/forms");
  revalidatePath(`/forms/${formId}`);
  redirectWithMessage(returnTo, result.message);
}

export async function deleteFormAction(formData: FormData) {
  const formId = readString(formData, "formId");
  const confirmed = readString(formData, "confirmDelete") === "yes";
  const returnTo = safeReturnTo(readString(formData, "returnTo"), "/forms?archive=active");

  if (!confirmed) {
    redirectWithMessage(returnTo, "Delete not applied. Tick the permanent delete confirmation first.");
  }

  const result = await deleteFormSafely(formId);
  revalidatePath("/forms");
  redirectWithMessage(returnTo, result.message);
}
