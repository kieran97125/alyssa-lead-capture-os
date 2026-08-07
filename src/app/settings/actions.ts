"use server";

import { revalidatePath, revalidateTag } from "next/cache";
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
import { getConfigurationData } from "@/lib/data/configuration";
import { PUBLIC_FORM_CONFIG_CACHE_TAG } from "@/lib/data/publicFormConfig";
import {
  canAccessInternalBrand,
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";

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
  const [pathAndQuery, hash] = path.split("#", 2);
  const separator = pathAndQuery.includes("?") ? "&" : "?";
  redirect(
    `${pathAndQuery}${separator}settings_status=${status}&message=${encodeURIComponent(
      result.message
    )}${hash ? `#${hash}` : ""}`
  );
}

function readReturnPath(formData: FormData, fallback: string) {
  const path = readString(formData, "returnPath");
  return path.startsWith("/settings") ? path : fallback;
}

function revalidateSettings(...paths: string[]) {
  new Set(["/settings", ...paths]).forEach((path) => revalidatePath(path));
  revalidateTag(PUBLIC_FORM_CONFIG_CACHE_TAG, { expire: 0 });
}

async function ensureSettingsAction(
  path: string,
  options: { brandId?: string; masterOnly?: boolean } = {}
) {
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  const moduleAccess = await requireModuleAccess("settings");
  if (!moduleAccess.allowed) {
    redirectBack(path, {
      ok: false,
      message: "你未獲授權使用系統設定。",
    });
  }
  if (
    (options.masterOnly && session.access.accessLevel !== "master") ||
    (options.brandId &&
      !canAccessInternalBrand(session.access, options.brandId))
  ) {
    redirectBack(path, {
      ok: false,
      message: "你未獲授權修改呢個品牌嘅設定。",
    });
  }
  return session.access;
}

function brandInput(formData: FormData): BrandInput {
  const input = {
    id: readString(formData, "id"),
    name: readString(formData, "name"),
    slug: readString(formData, "slug"),
    logoUrl: readString(formData, "logoUrl"),
    primaryColor: readString(formData, "primaryColor"),
    secondaryColor: readString(formData, "secondaryColor"),
    whatsappNumber: readString(formData, "whatsappNumber"),
    defaultThankYouUrl: readString(formData, "defaultThankYouUrl"),
    legalPageUrl: readString(formData, "legalPageUrl"),
    legalLinkLabel: readString(formData, "legalLinkLabel"),
    privacyUrl: readString(formData, "privacyUrl"),
    disclaimerUrl: readString(formData, "disclaimerUrl"),
    operatorName: readString(formData, "operatorName"),
    metaPixelId: readString(formData, "metaPixelId"),
    metaPixelPageViewOnEmbed: readBoolean(
      formData,
      "metaPixelPageViewOnEmbed"
    ),
  };
  const normalizedSlug = input.slug.toLowerCase();
  if (
    normalizedSlug === "ineffable" ||
    normalizedSlug === "ineffable-beauty"
  ) {
    return {
      ...input,
      logoUrl: "",
      primaryColor: "#69C7E8",
      secondaryColor: "#DFF4FB",
    };
  }
  return input;
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
  const displayOrder = readNumber(formData, "displayOrder") ?? 0;
  if (
    Number.isNaN(originalPrice) ||
    Number.isNaN(promoPrice) ||
    Number.isNaN(displayOrder)
  ) {
    return { ok: false, message: "價錢及排序必須是數字。" };
  }

  return {
    id: readString(formData, "id"),
    treatmentId: readString(formData, "treatmentId"),
    name: readString(formData, "name"),
    groupName: readString(formData, "groupName"),
    originalPrice,
    promoPrice,
    currency: readString(formData, "currency") || "HKD",
    paymentRequired: readBoolean(formData, "paymentRequired"),
    status: readString(formData, "status") === "inactive" ? "inactive" : "active",
    displayOrder,
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
  await ensureSettingsAction("/settings/brands", { masterOnly: true });
  const result = await createBrand(brandInput(formData));
  revalidateSettings("/settings/brands", "/campaigns/new", "/forms");
  redirectBack(readReturnPath(formData, "/settings/brands"), result);
}

export async function updateBrandAction(formData: FormData) {
  const input = brandInput(formData);
  await ensureSettingsAction("/settings/brands", { brandId: input.id });
  const result = await updateBrand(input);
  revalidateSettings("/settings/brands", "/campaigns/new", "/forms");
  redirectBack(readReturnPath(formData, "/settings/brands"), result);
}

export async function deleteBrandAction(formData: FormData) {
  await ensureSettingsAction("/settings/brands", { masterOnly: true });
  const result = await deleteBrandSafely(
    readString(formData, "id"),
    readBoolean(formData, "confirmDelete")
  );
  revalidateSettings("/settings/brands", "/campaigns/new", "/forms");
  redirectBack("/settings/brands", result);
}

export async function createTreatmentAction(formData: FormData) {
  const input = treatmentInput(formData);
  await ensureSettingsAction("/settings/treatments", {
    brandId: input.brandId,
  });
  const result = await createTreatment(input);
  revalidateSettings("/settings/treatments", "/campaigns/new", "/forms");
  redirectBack(
    readReturnPath(formData, "/settings/treatments"),
    result
  );
}

export async function updateTreatmentAction(formData: FormData) {
  const input = treatmentInput(formData);
  await ensureSettingsAction("/settings/treatments", {
    brandId: input.brandId,
  });
  const config = await getConfigurationData();
  if (!config.treatments.some((item) => item.id === input.id)) {
    redirectBack("/settings/treatments", {
      ok: false,
      message: "你未獲授權修改呢個療程。",
    });
  }
  const result = await updateTreatment(input);
  revalidateSettings("/settings/treatments", "/campaigns/new", "/forms");
  redirectBack(
    readReturnPath(formData, "/settings/treatments"),
    result
  );
}

export async function deleteTreatmentAction(formData: FormData) {
  await ensureSettingsAction("/settings/treatments");
  const treatmentId = readString(formData, "id");
  const config = await getConfigurationData();
  if (!config.treatments.some((item) => item.id === treatmentId)) {
    redirectBack("/settings/treatments", {
      ok: false,
      message: "你未獲授權刪除呢個療程。",
    });
  }
  const result = await deleteTreatmentSafely(
    treatmentId,
    readBoolean(formData, "confirmDelete")
  );
  revalidateSettings("/settings/treatments", "/campaigns/new", "/forms");
  redirectBack(
    readReturnPath(formData, "/settings/treatments"),
    result
  );
}

export async function createPackageAction(formData: FormData) {
  await ensureSettingsAction("/settings/packages");
  const input = packageInput(formData);
  if ("treatmentId" in input) {
    const config = await getConfigurationData();
    if (!config.treatments.some((item) => item.id === input.treatmentId)) {
      redirectBack("/settings/packages", {
        ok: false,
        message: "你未獲授權為呢個療程新增項目。",
      });
    }
  }
  const result = "treatmentId" in input ? await createPackage(input) : input;
  revalidateSettings("/settings/packages", "/campaigns/new", "/forms");
  redirectBack(readReturnPath(formData, "/settings/packages"), result);
}

export async function updatePackageAction(formData: FormData) {
  await ensureSettingsAction("/settings/packages");
  const input = packageInput(formData);
  if ("treatmentId" in input) {
    const config = await getConfigurationData();
    if (
      !config.packages.some((item) => item.id === input.id) ||
      !config.treatments.some((item) => item.id === input.treatmentId)
    ) {
      redirectBack("/settings/packages", {
        ok: false,
        message: "你未獲授權修改呢個療程嘅項目。",
      });
    }
  }
  const result = "treatmentId" in input ? await updatePackage(input) : input;
  revalidateSettings("/settings/packages", "/campaigns/new", "/forms");
  redirectBack(readReturnPath(formData, "/settings/packages"), result);
}

export async function deletePackageAction(formData: FormData) {
  await ensureSettingsAction("/settings/packages");
  const packageId = readString(formData, "id");
  const config = await getConfigurationData();
  if (!config.packages.some((item) => item.id === packageId)) {
    redirectBack("/settings/packages", {
      ok: false,
      message: "你未獲授權刪除呢個項目。",
    });
  }
  const result = await deletePackageSafely(
    packageId,
    readBoolean(formData, "confirmDelete")
  );
  revalidateSettings("/settings/packages", "/campaigns/new", "/forms");
  redirectBack(readReturnPath(formData, "/settings/packages"), result);
}

export async function createBranchAction(formData: FormData) {
  const input = branchInput(formData);
  await ensureSettingsAction("/settings/branches", {
    brandId: input.brandId,
  });
  const result = await createBranch(input);
  revalidateSettings("/settings/branches", "/forms");
  redirectBack("/settings/branches", result);
}

export async function updateBranchAction(formData: FormData) {
  const input = branchInput(formData);
  await ensureSettingsAction("/settings/branches", {
    brandId: input.brandId,
  });
  const config = await getConfigurationData();
  if (!config.branches.some((item) => item.id === input.id)) {
    redirectBack("/settings/branches", {
      ok: false,
      message: "你未獲授權修改呢間分店。",
    });
  }
  const result = await updateBranch(input);
  revalidateSettings("/settings/branches", "/forms");
  redirectBack("/settings/branches", result);
}

export async function deleteBranchAction(formData: FormData) {
  await ensureSettingsAction("/settings/branches");
  const branchId = readString(formData, "id");
  const config = await getConfigurationData();
  if (!config.branches.some((item) => item.id === branchId)) {
    redirectBack("/settings/branches", {
      ok: false,
      message: "你未獲授權刪除呢間分店。",
    });
  }
  const result = await deleteBranchSafely(
    branchId,
    readBoolean(formData, "confirmDelete")
  );
  revalidateSettings("/settings/branches", "/forms");
  redirectBack("/settings/branches", result);
}
