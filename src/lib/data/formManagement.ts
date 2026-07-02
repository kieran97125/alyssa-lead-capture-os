import { randomBytes } from "crypto";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import {
  getBranch,
  getBrand,
  getConfigurationData,
  getFormBranchSettings,
  getPackage,
  getTreatment,
  type ConfigurationData,
  type FormSetting,
} from "@/lib/data/configuration";
import {
  buildBrandSuccessRedirectUrl,
  getBrandLaunchDefaults,
  getOfferValueForRedirect,
  getTreatmentSlugForRedirect,
  isValidBrandSuccessRedirectUrl,
} from "@/lib/data/brandDefaults";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export type ManagedFormInput = {
  formName: string;
  brandId: string;
  defaultTreatmentId: string;
  defaultPackageId: string;
  defaultBranchId: string;
  branchIds: string[];
  allowedDomains: string[];
  status: string;
};

export type FormMutationResult = {
  ok: boolean;
  message: string;
  form?: FormSetting;
};

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);

  return slug || "campaign";
}

function shortId() {
  return randomBytes(3).toString("hex");
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildPublicFormTokenBase(formName: string, brandSlug: string) {
  const selectedBrandSlug = slugify(brandSlug)
    .replace(/^alyssa-ineffable-beauty$/, "ineffable-beauty")
    .replace(/^alyssa-ineffable$/, "ineffable");
  const brandPrefix = selectedBrandSlug || slugify(formName);
  const alternateBrandPrefix =
    brandPrefix === "ineffable-beauty" ? "ineffable" : "";
  let formSlug = slugify(formName);

  [brandPrefix, alternateBrandPrefix]
    .filter(Boolean)
    .forEach((prefix) => {
      if (formSlug === prefix) formSlug = "";
      if (formSlug.startsWith(`${prefix}-`)) {
        formSlug = formSlug.slice(prefix.length + 1);
      }
    });

  formSlug = formSlug.replace(/-form$/, "");

  const descriptor = formSlug || "campaign";
  const base = `${brandPrefix}-${descriptor}-form`;

  return base
    .replace(/^alyssa-ineffable-beauty-/, "ineffable-beauty-")
    .replace(/^alyssa-ineffable-/, "ineffable-");
}

function normalizeOrigin(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (cleaned === "localhost" || cleaned === "127.0.0.1") return cleaned;
  if (/^(localhost|127\.0\.0\.1):\d+$/.test(cleaned)) {
    return `http://${cleaned}`;
  }

  try {
    return new URL(cleaned).origin;
  } catch {
    try {
      return new URL(`https://${cleaned}`).origin;
    } catch {
      return null;
    }
  }
}

function resolveBrandFormConversionDefaults({
  brandSlug,
  treatment,
  selectedPackage,
  existingSuccessRedirectUrl,
}: {
  brandSlug: string;
  treatment: ReturnType<typeof getTreatment>;
  selectedPackage: ReturnType<typeof getPackage>;
  existingSuccessRedirectUrl?: string | null;
}) {
  const defaults = getBrandLaunchDefaults(brandSlug);
  if (!defaults) {
    return {
      conversionMode: "form_submit_pixel" as const,
      successRedirectUrl: existingSuccessRedirectUrl || null,
    };
  }

  if (
    existingSuccessRedirectUrl &&
    isValidBrandSuccessRedirectUrl(brandSlug, existingSuccessRedirectUrl)
  ) {
    return {
      conversionMode: defaults.defaultConversionMode,
      successRedirectUrl: existingSuccessRedirectUrl,
    };
  }

  const generatedUrl = buildBrandSuccessRedirectUrl({
    brandSlug,
    treatmentSlug: getTreatmentSlugForRedirect(treatment),
    value: getOfferValueForRedirect(selectedPackage),
  });

  return {
    conversionMode: defaults.defaultConversionMode,
    successRedirectUrl: generatedUrl || null,
  };
}

export function parseAllowedDomains(value: string) {
  const items = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const origins = items.map(normalizeOrigin);

  if (origins.some((item) => !item)) {
    return {
      ok: false as const,
      domains: [],
      message: "Allowed domains 請使用有效網址，例如 https://example.com",
    };
  }

  return {
    ok: true as const,
    domains: Array.from(new Set(origins.filter((item): item is string => Boolean(item)))),
  };
}

function asForm(row: Record<string, unknown>): FormSetting {
  return {
    id: String(row.id ?? ""),
    publicFormToken: String(row.public_form_token ?? ""),
    brandId: String(row.brand_id ?? ""),
    formName: String(row.form_name ?? "Untitled form"),
    status: String(row.status ?? "active"),
    allowedDomains: Array.isArray(row.allowed_domains)
      ? row.allowed_domains.filter((item): item is string => typeof item === "string")
      : [],
    defaultTreatmentId:
      typeof row.default_treatment_id === "string" ? row.default_treatment_id : null,
    defaultPackageId:
      typeof row.default_package_id === "string" ? row.default_package_id : null,
    defaultBranchId:
      typeof row.default_branch_id === "string" ? row.default_branch_id : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function uniqueBranchIds(branchIds: string[]) {
  return Array.from(new Set(branchIds.map((item) => item.trim()).filter(Boolean)));
}

async function createUniqueToken(formName: string, brandSlug: string) {
  const base = buildPublicFormTokenBase(formName, brandSlug);

  if (!hasSupabaseAdminEnv()) {
    return `${base}-${shortId()}`;
  }

  const supabase = createSupabaseAdminClient();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const token = `${base}-${shortId()}`;
    const { data, error } = await supabase
      .from("forms")
      .select("id")
      .eq("public_form_token", token)
      .maybeSingle();

    if (!error && !data) return token;
  }

  return `${base}-${Date.now().toString(36)}-${shortId()}`;
}

function validateInput(config: ConfigurationData, input: ManagedFormInput) {
  const formName = input.formName.trim();
  const treatment = getTreatment(config, input.defaultTreatmentId);
  const selectedPackage = getPackage(config, input.defaultPackageId);
  const branchIds = uniqueBranchIds(
    input.branchIds.length > 0 ? input.branchIds : [input.defaultBranchId]
  );
  const defaultBranchId =
    input.defaultBranchId && branchIds.includes(input.defaultBranchId)
      ? input.defaultBranchId
      : branchIds[0] || "";
  const branches = branchIds.map((branchId) => getBranch(config, branchId));

  if (!formName) return { ok: false as const, message: "請輸入表格名稱。" };
  if (!input.brandId) return { ok: false as const, message: "請選擇品牌。" };
  if (!treatment) return { ok: false as const, message: "請選擇療程。" };
  if (!selectedPackage) return { ok: false as const, message: "請選擇套餐。" };
  if (branchIds.length === 0 || branches.some((branch) => !branch)) {
    return { ok: false as const, message: "請選擇至少一間分店。" };
  }
  if (treatment.brandId !== input.brandId) {
    return { ok: false as const, message: "療程與品牌不相符。" };
  }
  if (selectedPackage.treatmentId !== treatment.id) {
    return { ok: false as const, message: "套餐與療程不相符。" };
  }
  if (branches.some((branch) => branch && branch.brandId !== input.brandId)) {
    return { ok: false as const, message: "分店與品牌不相符。" };
  }

  return {
    ok: true as const,
    input: {
      ...input,
      formName,
      status: "active",
      defaultBranchId,
      branchIds,
    },
  };
}

async function syncFormBranches(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  formId: string,
  branchIds: string[],
  defaultBranchId: string
) {
  const branchRows = uniqueBranchIds(branchIds).map((branchId, index) => ({
    form_id: formId,
    branch_id: branchId,
    is_default: branchId === defaultBranchId,
    is_active: true,
    display_order: index,
  }));

  if (branchRows.length === 0) return { ok: true };

  const deleteResult = await supabase
    .from("form_branches")
    .delete()
    .eq("form_id", formId);

  if (deleteResult.error) {
    console.warn("form_branches_delete_failed", {
      code: deleteResult.error.code,
      message: deleteResult.error.message,
      form_id: formId,
    });
    return { ok: false };
  }

  const insertResult = await supabase.from("form_branches").insert(branchRows);

  if (insertResult.error) {
    console.warn("form_branches_insert_failed", {
      code: insertResult.error.code,
      message: insertResult.error.message,
      form_id: formId,
    });
    return { ok: false };
  }

  return { ok: true };
}

function branchSyncMessage(message: string, synced: boolean) {
  return synced
    ? message
    : `${message}（多分店設定未能寫入，請確認 form_branches migration 已套用。）`;
}

export async function listForms() {
  const config = await getConfigurationData();
  return config.forms;
}

export async function getFormByIdOrSlug(formId: string) {
  const config = await getConfigurationData();
  const form =
    config.forms.find(
      (item) =>
        item.id === formId ||
        item.publicFormToken === formId ||
        (formId === alyssaDefaultForm.id &&
          item.publicFormToken === alyssaDefaultForm.publicFormToken)
    ) ?? null;

  return { form, config };
}

export async function createForm(
  input: ManagedFormInput
): Promise<FormMutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "正式資料庫未連接，暫時未能新增表格。" };
  }

  const config = await getConfigurationData();
  const validation = validateInput(config, input);
  if (!validation.ok) return { ok: false, message: validation.message };
  const brand = getBrand(config, validation.input.brandId);
  if (!brand) return { ok: false, message: "請選擇有效品牌。" };
  const conversionDefaults = resolveBrandFormConversionDefaults({
    brandSlug: brand.slug,
    treatment: getTreatment(config, validation.input.defaultTreatmentId),
    selectedPackage: getPackage(config, validation.input.defaultPackageId),
  });

  const supabase = createSupabaseAdminClient();
  const token = await createUniqueToken(validation.input.formName, brand.slug);
  const { data, error } = await supabase
    .from("forms")
    .insert({
      public_form_token: token,
      brand_id: validation.input.brandId,
      form_name: validation.input.formName,
      status: validation.input.status,
      allowed_domains: validation.input.allowedDomains,
      default_treatment_id: validation.input.defaultTreatmentId,
      default_package_id: validation.input.defaultPackageId,
      default_branch_id: validation.input.defaultBranchId,
      conversion_mode: conversionDefaults.conversionMode,
      success_redirect_url: conversionDefaults.successRedirectUrl,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("form_create_failed", error);
    return { ok: false, message: "新增表格失敗，請稍後再試。" };
  }

  const branchSync = await syncFormBranches(
    supabase,
    data.id,
    validation.input.branchIds,
    validation.input.defaultBranchId
  );

  return {
    ok: true,
    message: branchSyncMessage("表格已建立。", branchSync.ok),
    form: asForm(data),
  };
}

export async function updateForm(
  formId: string,
  input: ManagedFormInput
): Promise<FormMutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "正式資料庫未連接，暫時未能儲存表格設定。" };
  }

  const config = await getConfigurationData();
  const validation = validateInput(config, input);
  if (!validation.ok) return { ok: false, message: validation.message };

  const { form } = await getFormByIdOrSlug(formId);
  if (!form) return { ok: false, message: "找不到表格。" };
  const updateBrand = getBrand(config, validation.input.brandId);
  if (!updateBrand) return { ok: false, message: "請選擇有效品牌。" };
  const conversionDefaults = resolveBrandFormConversionDefaults({
    brandSlug: updateBrand.slug,
    treatment: getTreatment(config, validation.input.defaultTreatmentId),
    selectedPackage: getPackage(config, validation.input.defaultPackageId),
    existingSuccessRedirectUrl: form.successRedirectUrl,
  });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("forms")
    .update({
      brand_id: validation.input.brandId,
      form_name: validation.input.formName,
      status: validation.input.status,
      allowed_domains: validation.input.allowedDomains,
      default_treatment_id: validation.input.defaultTreatmentId,
      default_package_id: validation.input.defaultPackageId,
      default_branch_id: validation.input.defaultBranchId,
      conversion_mode: conversionDefaults.conversionMode,
      success_redirect_url: conversionDefaults.successRedirectUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", form.id)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("form_update_failed", error);
    return { ok: false, message: "儲存表格設定失敗，請稍後再試。" };
  }

  const branchSync = await syncFormBranches(
    supabase,
    form.id,
    validation.input.branchIds,
    validation.input.defaultBranchId
  );

  return {
    ok: true,
    message: branchSyncMessage("表格設定已儲存。", branchSync.ok),
    form: asForm(data),
  };
}

export async function duplicateForm(formId: string): Promise<FormMutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "正式資料庫未連接，暫時未能複製表格。" };
  }

  const { form, config } = await getFormByIdOrSlug(formId);
  if (!form) return { ok: false, message: "找不到表格。" };
  const brand = getBrand(config, form.brandId);
  if (!brand) return { ok: false, message: "請選擇有效品牌。" };
  const conversionDefaults = resolveBrandFormConversionDefaults({
    brandSlug: brand.slug,
    treatment: getTreatment(config, form.defaultTreatmentId),
    selectedPackage: getPackage(config, form.defaultPackageId),
    existingSuccessRedirectUrl: form.successRedirectUrl,
  });

  const supabase = createSupabaseAdminClient();
  const name = `${form.formName} Copy`;
  const token = await createUniqueToken(name, brand.slug);
  const { data, error } = await supabase
    .from("forms")
    .insert({
      public_form_token: token,
      brand_id: form.brandId,
      form_name: name,
      status: "active",
      allowed_domains: form.allowedDomains,
      default_treatment_id: form.defaultTreatmentId,
      default_package_id: form.defaultPackageId,
      default_branch_id: form.defaultBranchId,
      conversion_mode: conversionDefaults.conversionMode,
      success_redirect_url: conversionDefaults.successRedirectUrl,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("form_duplicate_failed", error);
    return { ok: false, message: "複製表格失敗，請稍後再試。" };
  }

  const sourceBranchSettings = getFormBranchSettings(config, form);
  const branchIds =
    sourceBranchSettings.length > 0
      ? sourceBranchSettings.map((item) => item.branchId)
      : form.defaultBranchId
        ? [form.defaultBranchId]
        : [];
  const branchSync = await syncFormBranches(
    supabase,
    data.id,
    branchIds,
    form.defaultBranchId || branchIds[0] || ""
  );

  return {
    ok: true,
    message: branchSyncMessage("Form duplicated.", branchSync.ok),
    form: asForm(data),
  };
}

type PersistedFormIdentity = {
  id: string;
  public_form_token: string;
};

type CountCheckResult = {
  ok: boolean;
  count: number;
  label: string;
  errorMessage?: string;
};

function getFormIdentityFilter(form: FormSetting) {
  if (uuidPattern.test(form.id)) {
    return { column: "id", value: form.id };
  }

  return { column: "public_form_token", value: form.publicFormToken };
}

async function getPersistedFormIdentity(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  form: FormSetting
) {
  const identity = getFormIdentityFilter(form);
  const { data, error } = await supabase
    .from("forms")
    .select("id,public_form_token")
    .eq(identity.column, identity.value)
    .maybeSingle<PersistedFormIdentity>();

  if (error) {
    console.warn("form_identity_lookup_failed", {
      code: error.code,
      message: error.message,
      form_id: form.id,
      form_token: form.publicFormToken,
    });
    return null;
  }

  return data ?? null;
}

async function countDependency(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  column: string,
  value: string | null | undefined,
  label: string
): Promise<CountCheckResult> {
  if (!value) return { ok: true, count: 0, label };

  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (error) {
    console.warn("form_dependency_count_failed", {
      table,
      column,
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      count: 0,
      label,
      errorMessage: error.message,
    };
  }

  return { ok: true, count: count ?? 0, label };
}

export async function archiveForm(formId: string): Promise<FormMutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return {
      ok: false,
      message: "Form archive is unavailable because the admin database client is not configured.",
    };
  }

  const { form } = await getFormByIdOrSlug(formId);
  if (!form) return { ok: false, message: "Form not found." };

  const supabase = createSupabaseAdminClient();
  const persisted = await getPersistedFormIdentity(supabase, form);
  if (!persisted) {
    return {
      ok: false,
      message: "Form could not be matched to a database record. No change was made.",
    };
  }

  const { data, error } = await supabase
    .from("forms")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", persisted.id)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("form_archive_failed", {
      code: error?.code,
      message: error?.message,
      form_id: persisted.id,
    });
    return { ok: false, message: "Form archive failed. No change was made." };
  }

  return {
    ok: true,
    message: "Form archived. Existing leads remain viewable, and the form is hidden from the default active list.",
    form: asForm(data),
  };
}

export async function deleteFormSafely(formId: string): Promise<FormMutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return {
      ok: false,
      message: "Form delete is unavailable because the admin database client is not configured.",
    };
  }

  const { form } = await getFormByIdOrSlug(formId);
  if (!form) return { ok: false, message: "Form not found." };

  const supabase = createSupabaseAdminClient();
  const persisted = await getPersistedFormIdentity(supabase, form);
  if (!persisted) {
    return {
      ok: false,
      message: "Form could not be matched to a database record. Use archive instead.",
    };
  }

  const checks = await Promise.all([
    countDependency(supabase, "leads", "form_id", persisted.id, "lead records"),
    countDependency(
      supabase,
      "landing_pages",
      "form_id",
      persisted.id,
      "linked landing pages"
    ),
  ]);
  const blockers = checks.flatMap((check) => {
    if (!check.ok) return [`${check.label} could not be verified`];
    if (check.count > 0) return [`${check.count} ${check.label}`];
    return [];
  });

  if (blockers.length > 0) {
    return {
      ok: false,
      message: `Safe delete blocked because this form has dependencies: ${blockers.join(
        ", "
      )}. Archive it instead.`,
    };
  }

  const branchDelete = await supabase
    .from("form_branches")
    .delete()
    .eq("form_id", persisted.id);

  if (branchDelete.error && branchDelete.error.code !== "42P01") {
    console.warn("form_branch_delete_failed", {
      code: branchDelete.error.code,
      message: branchDelete.error.message,
      form_id: persisted.id,
    });
    return {
      ok: false,
      message: "Safe delete blocked because form branch links could not be cleared. Archive it instead.",
    };
  }

  const { error } = await supabase.from("forms").delete().eq("id", persisted.id);
  if (error) {
    console.warn("form_safe_delete_failed", {
      code: error.code,
      message: error.message,
      form_id: persisted.id,
    });
    return {
      ok: false,
      message: "Safe delete failed. No further action was taken.",
    };
  }

  return {
    ok: true,
    message: "Form permanently deleted. No linked leads or landing pages were found.",
  };
}
