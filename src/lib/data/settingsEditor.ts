import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { getConfigurationData } from "@/lib/data/configuration";

export type SettingsMutationResult = {
  ok: boolean;
  message: string;
};

export type BrandInput = {
  id?: string;
  name: string;
  slug: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  whatsappNumber: string;
  defaultThankYouUrl: string;
};

export type TreatmentInput = {
  id?: string;
  brandId: string;
  name: string;
  slug: string;
  description: string;
};

export type PackageInput = {
  id?: string;
  treatmentId: string;
  name: string;
  originalPrice: number | null;
  promoPrice: number | null;
  currency: string;
  paymentRequired: boolean;
};

export type BranchInput = {
  id?: string;
  brandId: string;
  name: string;
  slug: string;
  address: string;
  openingHours: string;
};

const blockedDeleteMessage =
  "這項資料已被表格、Campaign 或登記紀錄使用，暫時不能刪除。";

export async function listBrands() {
  return (await getConfigurationData()).brands;
}

export async function listTreatments() {
  return (await getConfigurationData()).treatments;
}

export async function listPackages() {
  return (await getConfigurationData()).packages;
}

export async function listBranches() {
  return (await getConfigurationData()).branches;
}

function unavailable(): SettingsMutationResult {
  return {
    ok: false,
    message: "正式資料暫時未能更新，請稍後再試。",
  };
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "item";
}

function clean(value: string | undefined | null, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function nullableText(value: string) {
  const cleaned = clean(value);
  return cleaned || null;
}

function validateHexColor(value: string) {
  const cleaned = clean(value, 20);
  return /^#[0-9a-f]{6}$/i.test(cleaned) ? cleaned : null;
}

function parseOpeningHours(value: string) {
  const cleaned = clean(value, 2000);
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    return { note: cleaned };
  }
}

async function ensureSupabase() {
  if (!hasSupabaseAdminEnv()) return null;
  return createSupabaseAdminClient();
}

async function countReferences(
  table: string,
  column: string,
  value: string | undefined | null
) {
  if (!value) return 0;
  const supabase = await ensureSupabase();
  if (!supabase) return 1;

  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (error) {
    console.warn("settings_reference_count_failed", {
      table,
      column,
      code: error.code,
      message: error.message,
    });
    return 1;
  }

  return count ?? 0;
}

async function hasReferences(
  checks: Array<{ table: string; column: string; value: string }>
) {
  const counts = await Promise.all(
    checks.map((check) => countReferences(check.table, check.column, check.value))
  );
  return counts.some((count) => count > 0);
}

async function slugExists(
  table: "brands" | "treatments" | "branches",
  slug: string,
  id?: string,
  brandId?: string
) {
  const supabase = await ensureSupabase();
  if (!supabase) return false;

  let query = supabase.from(table).select("id").eq("slug", slug).limit(1);
  if (brandId && (table === "treatments" || table === "branches")) {
    query = query.eq("brand_id", brandId);
  }
  if (id) query = query.neq("id", id);

  const { data, error } = await query;
  if (error) {
    console.warn("settings_slug_check_failed", {
      table,
      code: error.code,
      message: error.message,
    });
    return true;
  }

  return Boolean(data?.length);
}

export async function createBrand(input: BrandInput): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();

  const name = clean(input.name, 160);
  const slug = slugify(input.slug || name);
  if (!name) return { ok: false, message: "請輸入品牌名稱。" };
  if (await slugExists("brands", slug)) {
    return { ok: false, message: "品牌代號已經存在，請使用另一個代號。" };
  }

  const { error } = await supabase.from("brands").insert({
    name,
    slug,
    logo_url: nullableText(input.logoUrl),
    primary_color: validateHexColor(input.primaryColor),
    secondary_color: validateHexColor(input.secondaryColor),
    whatsapp_number: nullableText(input.whatsappNumber),
    default_thank_you_url: nullableText(input.defaultThankYouUrl),
  });

  if (error) {
    console.warn("brand_create_failed", error);
    return { ok: false, message: "品牌未能新增，請檢查資料後再試。" };
  }

  return { ok: true, message: "品牌已新增。" };
}

export async function updateBrand(input: BrandInput): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();

  const id = clean(input.id, 80);
  const name = clean(input.name, 160);
  const slug = slugify(input.slug || name);
  if (!id) return { ok: false, message: "找不到要更新的品牌。" };
  if (!name) return { ok: false, message: "請輸入品牌名稱。" };
  if (await slugExists("brands", slug, id)) {
    return { ok: false, message: "品牌代號已經存在，請使用另一個代號。" };
  }

  const { error } = await supabase
    .from("brands")
    .update({
      name,
      slug,
      logo_url: nullableText(input.logoUrl),
      primary_color: validateHexColor(input.primaryColor),
      secondary_color: validateHexColor(input.secondaryColor),
      whatsapp_number: nullableText(input.whatsappNumber),
      default_thank_you_url: nullableText(input.defaultThankYouUrl),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.warn("brand_update_failed", error);
    return { ok: false, message: "品牌未能更新，請稍後再試。" };
  }

  return { ok: true, message: "品牌已更新。" };
}

export async function deleteBrandSafely(
  id: string,
  confirmed: boolean
): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();
  const brandId = clean(id, 80);
  if (!confirmed) return { ok: false, message: "請先勾選確認刪除。" };

  const referenced = await hasReferences([
    { table: "forms", column: "brand_id", value: brandId },
    { table: "treatments", column: "brand_id", value: brandId },
    { table: "branches", column: "brand_id", value: brandId },
    { table: "leads", column: "brand_id", value: brandId },
    { table: "bookings", column: "brand_id", value: brandId },
    { table: "landing_pages", column: "brand_id", value: brandId },
  ]);
  if (referenced) return { ok: false, message: blockedDeleteMessage };

  const { error } = await supabase.from("brands").delete().eq("id", brandId);
  if (error) {
    console.warn("brand_delete_failed", error);
    return { ok: false, message: "品牌未能刪除，請稍後再試。" };
  }

  return { ok: true, message: "品牌已刪除。" };
}

export async function createTreatment(
  input: TreatmentInput
): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();

  const brandId = clean(input.brandId, 80);
  const name = clean(input.name, 160);
  const slug = slugify(input.slug || name);
  if (!brandId) return { ok: false, message: "請選擇品牌。" };
  if (!name) return { ok: false, message: "請輸入療程名稱。" };
  if (await slugExists("treatments", slug, undefined, brandId)) {
    return { ok: false, message: "同一品牌已有相同療程代號。" };
  }

  const { error } = await supabase.from("treatments").insert({
    brand_id: brandId,
    name,
    slug,
    description: nullableText(input.description),
    status: "active",
  });

  if (error) {
    console.warn("treatment_create_failed", error);
    return { ok: false, message: "療程未能新增，請檢查資料後再試。" };
  }

  return { ok: true, message: "療程已新增。" };
}

export async function updateTreatment(
  input: TreatmentInput
): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();

  const id = clean(input.id, 80);
  const brandId = clean(input.brandId, 80);
  const name = clean(input.name, 160);
  const slug = slugify(input.slug || name);
  if (!id) return { ok: false, message: "找不到要更新的療程。" };
  if (!brandId) return { ok: false, message: "請選擇品牌。" };
  if (!name) return { ok: false, message: "請輸入療程名稱。" };
  if (await slugExists("treatments", slug, id, brandId)) {
    return { ok: false, message: "同一品牌已有相同療程代號。" };
  }

  const { error } = await supabase
    .from("treatments")
    .update({
      brand_id: brandId,
      name,
      slug,
      description: nullableText(input.description),
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.warn("treatment_update_failed", error);
    return { ok: false, message: "療程未能更新，請稍後再試。" };
  }

  return { ok: true, message: "療程已更新。" };
}

export async function deleteTreatmentSafely(
  id: string,
  confirmed: boolean
): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();
  const treatmentId = clean(id, 80);
  if (!confirmed) return { ok: false, message: "請先勾選確認刪除。" };

  const referenced = await hasReferences([
    { table: "forms", column: "default_treatment_id", value: treatmentId },
    { table: "packages", column: "treatment_id", value: treatmentId },
    { table: "leads", column: "treatment_id", value: treatmentId },
    { table: "bookings", column: "treatment_id", value: treatmentId },
    { table: "landing_pages", column: "treatment_id", value: treatmentId },
  ]);
  if (referenced) return { ok: false, message: blockedDeleteMessage };

  const { error } = await supabase.from("treatments").delete().eq("id", treatmentId);
  if (error) {
    console.warn("treatment_delete_failed", error);
    return { ok: false, message: "療程未能刪除，請稍後再試。" };
  }

  return { ok: true, message: "療程已刪除。" };
}

export async function createPackage(
  input: PackageInput
): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();

  const treatmentId = clean(input.treatmentId, 80);
  const name = clean(input.name, 160);
  const currency = clean(input.currency || "HKD", 10).toUpperCase();
  if (!treatmentId) return { ok: false, message: "請選擇療程。" };
  if (!name) return { ok: false, message: "請輸入套餐名稱。" };
  if (input.originalPrice !== null && input.originalPrice < 0) {
    return { ok: false, message: "原價不可少於 0。" };
  }
  if (input.promoPrice !== null && input.promoPrice < 0) {
    return { ok: false, message: "優惠價不可少於 0。" };
  }

  const { error } = await supabase.from("packages").insert({
    treatment_id: treatmentId,
    name,
    original_price: input.originalPrice,
    promo_price: input.promoPrice,
    currency,
    payment_required: input.paymentRequired,
    status: "active",
  });

  if (error) {
    console.warn("package_create_failed", error);
    return { ok: false, message: "套餐未能新增，請檢查資料後再試。" };
  }

  return { ok: true, message: "套餐已新增。" };
}

export async function updatePackage(
  input: PackageInput
): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();

  const id = clean(input.id, 80);
  const treatmentId = clean(input.treatmentId, 80);
  const name = clean(input.name, 160);
  const currency = clean(input.currency || "HKD", 10).toUpperCase();
  if (!id) return { ok: false, message: "找不到要更新的套餐。" };
  if (!treatmentId) return { ok: false, message: "請選擇療程。" };
  if (!name) return { ok: false, message: "請輸入套餐名稱。" };
  if (input.originalPrice !== null && input.originalPrice < 0) {
    return { ok: false, message: "原價不可少於 0。" };
  }
  if (input.promoPrice !== null && input.promoPrice < 0) {
    return { ok: false, message: "優惠價不可少於 0。" };
  }

  const { error } = await supabase
    .from("packages")
    .update({
      treatment_id: treatmentId,
      name,
      original_price: input.originalPrice,
      promo_price: input.promoPrice,
      currency,
      payment_required: input.paymentRequired,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.warn("package_update_failed", error);
    return { ok: false, message: "套餐未能更新，請稍後再試。" };
  }

  return { ok: true, message: "套餐已更新。" };
}

export async function deletePackageSafely(
  id: string,
  confirmed: boolean
): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();
  const packageId = clean(id, 80);
  if (!confirmed) return { ok: false, message: "請先勾選確認刪除。" };

  const referenced = await hasReferences([
    { table: "forms", column: "default_package_id", value: packageId },
    { table: "leads", column: "package_id", value: packageId },
    { table: "landing_pages", column: "package_id", value: packageId },
  ]);
  if (referenced) return { ok: false, message: blockedDeleteMessage };

  const { error } = await supabase.from("packages").delete().eq("id", packageId);
  if (error) {
    console.warn("package_delete_failed", error);
    return { ok: false, message: "套餐未能刪除，請稍後再試。" };
  }

  return { ok: true, message: "套餐已刪除。" };
}

export async function createBranch(input: BranchInput): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();

  const brandId = clean(input.brandId, 80);
  const name = clean(input.name, 160);
  const slug = slugify(input.slug || name);
  if (!brandId) return { ok: false, message: "請選擇品牌。" };
  if (!name) return { ok: false, message: "請輸入分店名稱。" };
  if (await slugExists("branches", slug, undefined, brandId)) {
    return { ok: false, message: "同一品牌已有相同分店代號。" };
  }

  const { error } = await supabase.from("branches").insert({
    brand_id: brandId,
    name,
    slug,
    address: nullableText(input.address),
    opening_hours: parseOpeningHours(input.openingHours),
    status: "active",
  });

  if (error) {
    console.warn("branch_create_failed", error);
    return { ok: false, message: "分店未能新增，請檢查資料後再試。" };
  }

  return { ok: true, message: "分店已新增。" };
}

export async function updateBranch(input: BranchInput): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();

  const id = clean(input.id, 80);
  const brandId = clean(input.brandId, 80);
  const name = clean(input.name, 160);
  const slug = slugify(input.slug || name);
  if (!id) return { ok: false, message: "找不到要更新的分店。" };
  if (!brandId) return { ok: false, message: "請選擇品牌。" };
  if (!name) return { ok: false, message: "請輸入分店名稱。" };
  if (await slugExists("branches", slug, id, brandId)) {
    return { ok: false, message: "同一品牌已有相同分店代號。" };
  }

  const { error } = await supabase
    .from("branches")
    .update({
      brand_id: brandId,
      name,
      slug,
      address: nullableText(input.address),
      opening_hours: parseOpeningHours(input.openingHours),
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.warn("branch_update_failed", error);
    return { ok: false, message: "分店未能更新，請稍後再試。" };
  }

  return { ok: true, message: "分店已更新。" };
}

export async function deleteBranchSafely(
  id: string,
  confirmed: boolean
): Promise<SettingsMutationResult> {
  const supabase = await ensureSupabase();
  if (!supabase) return unavailable();
  const branchId = clean(id, 80);
  if (!confirmed) return { ok: false, message: "請先勾選確認刪除。" };

  const referenced = await hasReferences([
    { table: "forms", column: "default_branch_id", value: branchId },
    { table: "leads", column: "branch_id", value: branchId },
    { table: "bookings", column: "branch_id", value: branchId },
    { table: "landing_pages", column: "branch_id", value: branchId },
  ]);
  if (referenced) return { ok: false, message: blockedDeleteMessage };

  const { error } = await supabase.from("branches").delete().eq("id", branchId);
  if (error) {
    console.warn("branch_delete_failed", error);
    return { ok: false, message: "分店未能刪除，請稍後再試。" };
  }

  return { ok: true, message: "分店已刪除。" };
}
