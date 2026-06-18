"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBranch,
  createBrand,
  createPackage,
  createTreatment,
  deleteBranchSafely,
  deleteBrandSafely,
  deletePackageSafely,
  deleteTreatmentSafely,
  updateBranch,
  updateBrand,
  updatePackage,
  updateTreatment,
  type BranchInput,
  type BrandInput,
  type PackageInput,
  type SettingsMutationResult,
  type TreatmentInput,
} from "@/lib/data/settingsEditor";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readNumber(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function redirectBack(path: string, result: SettingsMutationResult): never {
  const status = result.ok ? "success" : "error";
  redirect(
    `${path}?settings_status=${status}&message=${encodeURIComponent(
      result.message
    )}`
  );
}

function revalidateSettings() {
  [
    "/settings",
    "/settings/brands",
    "/settings/treatments",
    "/settings/packages",
    "/settings/branches",
    "/campaigns/new",
    "/forms",
    "/forms/new",
    "/landing-pages",
  ].forEach((path) => revalidatePath(path));
}

function ensureSettingsAction(_path: string) {
  void _path;
  return;
}

function brandInput(formData: FormData): BrandInput {
  return {
    id: readString(formData, "id"),
    name: readString(formData, "name"),
    slug: readString(formData, "slug"),
    logoUrl: readString(formData, "logoUrl"),
    primaryColor: readString(formData, "primaryColor"),
    secondaryColor: readString(formData, "secondaryColor"),
    whatsappNumber: readString(formData, "whatsappNumber"),
    defaultThankYouUrl: readString(formData, "defaultThankYouUrl"),
  };
}

function treatmentInput(formData: FormData): TreatmentInput {
  return {
    id: readString(formData, "id"),
    brandId: readString(formData, "brandId"),
    name: readString(formData, "name"),
    slug: readString(formData, "slug"),
    description: readString(formData, "description"),
  };
}

function packageInput(formData: FormData): PackageInput | SettingsMutationResult {
  const originalPrice = readNumber(formData, "originalPrice");
  const promoPrice = readNumber(formData, "promoPrice");
  if (Number.isNaN(originalPrice) || Number.isNaN(promoPrice)) {
    return { ok: false, message: "價錢必須是數字。" };
  }

  return {
    id: readString(formData, "id"),
    treatmentId: readString(formData, "treatmentId"),
    name: readString(formData, "name"),
    originalPrice,
    promoPrice,
    currency: readString(formData, "currency") || "HKD",
    paymentRequired: readBoolean(formData, "paymentRequired"),
  };
}

function branchInput(formData: FormData): BranchInput {
  return {
    id: readString(formData, "id"),
    brandId: readString(formData, "brandId"),
    name: readString(formData, "name"),
    slug: readString(formData, "slug"),
    address: readString(formData, "address"),
    openingHours: readString(formData, "openingHours"),
  };
}

export async function createBrandAction(formData: FormData) {
  await ensureSettingsAction("/settings/brands");
  const result = await createBrand(brandInput(formData));
  revalidateSettings();
  redirectBack("/settings/brands", result);
}

export async function updateBrandAction(formData: FormData) {
  await ensureSettingsAction("/settings/brands");
  const result = await updateBrand(brandInput(formData));
  revalidateSettings();
  redirectBack("/settings/brands", result);
}

export async function deleteBrandAction(formData: FormData) {
  await ensureSettingsAction("/settings/brands");
  const result = await deleteBrandSafely(
    readString(formData, "id"),
    readBoolean(formData, "confirmDelete")
  );
  revalidateSettings();
  redirectBack("/settings/brands", result);
}

export async function createTreatmentAction(formData: FormData) {
  await ensureSettingsAction("/settings/treatments");
  const result = await createTreatment(treatmentInput(formData));
  revalidateSettings();
  redirectBack("/settings/treatments", result);
}

export async function updateTreatmentAction(formData: FormData) {
  await ensureSettingsAction("/settings/treatments");
  const result = await updateTreatment(treatmentInput(formData));
  revalidateSettings();
  redirectBack("/settings/treatments", result);
}

export async function deleteTreatmentAction(formData: FormData) {
  await ensureSettingsAction("/settings/treatments");
  const result = await deleteTreatmentSafely(
    readString(formData, "id"),
    readBoolean(formData, "confirmDelete")
  );
  revalidateSettings();
  redirectBack("/settings/treatments", result);
}

export async function createPackageAction(formData: FormData) {
  await ensureSettingsAction("/settings/packages");
  const input = packageInput(formData);
  const result = "treatmentId" in input ? await createPackage(input) : input;
  revalidateSettings();
  redirectBack("/settings/packages", result);
}

export async function updatePackageAction(formData: FormData) {
  await ensureSettingsAction("/settings/packages");
  const input = packageInput(formData);
  const result = "treatmentId" in input ? await updatePackage(input) : input;
  revalidateSettings();
  redirectBack("/settings/packages", result);
}

export async function deletePackageAction(formData: FormData) {
  await ensureSettingsAction("/settings/packages");
  const result = await deletePackageSafely(
    readString(formData, "id"),
    readBoolean(formData, "confirmDelete")
  );
  revalidateSettings();
  redirectBack("/settings/packages", result);
}

export async function createBranchAction(formData: FormData) {
  await ensureSettingsAction("/settings/branches");
  const result = await createBranch(branchInput(formData));
  revalidateSettings();
  redirectBack("/settings/branches", result);
}

export async function updateBranchAction(formData: FormData) {
  await ensureSettingsAction("/settings/branches");
  const result = await updateBranch(branchInput(formData));
  revalidateSettings();
  redirectBack("/settings/branches", result);
}

export async function deleteBranchAction(formData: FormData) {
  await ensureSettingsAction("/settings/branches");
  const result = await deleteBranchSafely(
    readString(formData, "id"),
    readBoolean(formData, "confirmDelete")
  );
  revalidateSettings();
  redirectBack("/settings/branches", result);
}
