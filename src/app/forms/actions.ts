"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createForm,
  duplicateForm,
  parseAllowedDomains,
  updateForm,
  type ManagedFormInput,
} from "@/lib/data/formManagement";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithMessage(path: string, message: string): never {
  redirect(`${path}?form_status=${encodeURIComponent(message)}`);
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
