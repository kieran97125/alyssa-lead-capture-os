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
import { blockedActionMessage } from "@/lib/security/internalAccess";
import { requireActionAccess } from "@/lib/security/internalAccessServer";

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
  const access = await requireActionAccess("create_form");
  if (!access.allowed) redirectWithMessage("/forms/new", blockedActionMessage);

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
  const access = await requireActionAccess("edit_form");
  if (!access.allowed) redirectWithMessage(path, blockedActionMessage);

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
  const access = await requireActionAccess("create_form");
  if (!access.allowed) redirectWithMessage(`/forms/${formId}`, blockedActionMessage);

  const result = await duplicateForm(formId);
  revalidatePath("/forms");

  if (!result.ok || !result.form) {
    redirectWithMessage(`/forms/${formId}`, result.message);
  }

  redirectWithMessage(`/forms/${result.form.id}`, result.message);
}
