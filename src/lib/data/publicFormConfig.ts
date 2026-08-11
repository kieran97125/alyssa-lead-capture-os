import "server-only";

import { unstable_cache } from "next/cache";
import {
  alyssaBranches,
  alyssaBrand,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

type PublicRecord = Record<string, unknown>;
type BranchRow = PublicRecord;

export const PUBLIC_FORM_CONFIG_CACHE_TAG = "public-form-config";

export type PublicFormConfigSuccess = {
  ok: true;
  form: PublicRecord;
  brand: PublicRecord | null;
  treatments: PublicRecord[];
  packages: PublicRecord[];
  branches: PublicRecord[];
  mode?: "local_seed";
};

export type PublicFormConfigFailure = {
  ok: false;
  error: "invalid_form" | "form_unavailable";
  message?: string;
};

export type PublicFormConfigResult = {
  body: PublicFormConfigSuccess | PublicFormConfigFailure;
  status: number;
};

function withDefaultBranchFlag(
  branch: BranchRow,
  isDefault: boolean
): BranchRow {
  return {
    ...branch,
    is_default: isDefault,
  };
}

function publicFormRecord(form: PublicRecord): PublicRecord {
  return {
    id: form.id,
    public_form_token: form.public_form_token,
    allowed_domains: form.allowed_domains,
    default_treatment_id: form.default_treatment_id,
    default_package_id: form.default_package_id,
    package_selection_mode: form.package_selection_mode,
    default_branch_id: form.default_branch_id,
    conversion_mode: form.conversion_mode,
    success_redirect_url: form.success_redirect_url,
  };
}

async function loadPublicFormConfig(
  token: string
): Promise<PublicFormConfigResult> {
  if (
    process.env.ALYSSA_E2E_FIXTURES === "1" ||
    !hasSupabaseAdminEnv()
  ) {
    if (token !== alyssaDefaultForm.publicFormToken) {
      return {
        body: { ok: false, error: "invalid_form" },
        status: 404,
      };
    }

    return {
      body: {
        ok: true,
        form: alyssaDefaultForm as unknown as PublicRecord,
        brand: alyssaBrand as unknown as PublicRecord,
        treatments: alyssaTreatments as unknown as PublicRecord[],
        packages: alyssaPackages as unknown as PublicRecord[],
        branches: alyssaBranches.map((branch) =>
          withDefaultBranchFlag(
            branch as unknown as BranchRow,
            branch.id === alyssaDefaultForm.defaultBranchId
          )
        ),
        mode: "local_seed",
      },
      status: 200,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select(
      "id,public_form_token,brand_id,status,allowed_domains,default_treatment_id,default_package_id,package_selection_mode,default_branch_id,conversion_mode,success_redirect_url"
    )
    .eq("public_form_token", token)
    .single();

  if (formError || !form) {
    return {
      body: { ok: false, error: "invalid_form" },
      status: 404,
    };
  }

  if (String(form.status ?? "").toLowerCase() !== "active") {
    return {
      body: {
        ok: false,
        error: "form_unavailable",
        message: "Form is unavailable.",
      },
      status: 410,
    };
  }

  const [{ data: brand }, { data: treatments }, { data: branches }] =
    await Promise.all([
      supabase
        .from("brands")
        .select(
          "id,name,slug,legal_page_url,legal_link_label,privacy_url,disclaimer_url,operator_name,meta_pixel_id"
        )
        .eq("id", form.brand_id)
        .single(),
      supabase
        .from("treatments")
        .select("id,name,description")
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("branches")
        .select("id,name,opening_hours")
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

  const treatmentIds = (treatments ?? []).map((item) => item.id);
  const [{ data: formPackages, error: formPackagesError }, formBranchesResult] =
    await Promise.all([
      supabase
        .from("form_packages")
        .select("package_id,is_default,is_active,display_order")
        .eq("form_id", form.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("form_branches")
        .select("branch_id,is_default,is_active,display_order")
        .eq("form_id", form.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);
  const selectedPackageIds =
    form.package_selection_mode === "customer_choice" &&
    !formPackagesError &&
    (formPackages ?? []).length > 0
      ? (formPackages ?? []).map((item) => item.package_id)
      : form.default_package_id
        ? [form.default_package_id]
        : [];
  const { data: packageRows } =
    treatmentIds.length > 0
      ? await supabase
          .from("packages")
          .select(
            "id,treatment_id,name,group_name,original_price,promo_price,currency,payment_required,display_order"
          )
          .in("treatment_id", treatmentIds)
          .in(
            "id",
            selectedPackageIds.length > 0 ? selectedPackageIds : ["__none__"]
          )
          .eq("status", "active")
          .order("created_at", { ascending: true })
      : { data: [] };
  const packageOrder = new Map(
    selectedPackageIds.map((packageId, index) => [packageId, index])
  );
  const packages = [...(packageRows ?? [])].sort(
    (a, b) =>
      (packageOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (packageOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
  const allowedTreatmentIds = new Set(
    packages.map((item) => item.treatment_id)
  );
  const publicTreatments =
    allowedTreatmentIds.size > 0
      ? (treatments ?? []).filter((item) => allowedTreatmentIds.has(item.id))
      : [];
  const { data: formBranches, error: formBranchesError } = formBranchesResult;
  const branchRows = (branches ?? []) as BranchRow[];
  const selectedBranchRows =
    !formBranchesError && (formBranches ?? []).length > 0
      ? (formBranches ?? [])
          .map((item) => {
            const row = item as PublicRecord;
            const branch = branchRows.find(
              (branchItem) => branchItem.id === row.branch_id
            );
            return branch
              ? withDefaultBranchFlag(branch, Boolean(row.is_default))
              : null;
          })
          .filter((item): item is BranchRow => Boolean(item))
      : form.default_branch_id
        ? branchRows
            .filter((branch) => branch.id === form.default_branch_id)
            .map((branch) => withDefaultBranchFlag(branch, true))
        : branchRows.map((branch, index) =>
            withDefaultBranchFlag(branch, index === 0)
          );

  if (formBranchesError) {
    console.warn("[LaunchHub] public_form_branches_read_failed", {
      form_token: token,
      code: formBranchesError.code,
      message: formBranchesError.message,
    });
  }
  if (formPackagesError) {
    console.warn("[LaunchHub] public_form_packages_read_failed", {
      form_token: token,
      code: formPackagesError.code,
      message: formPackagesError.message,
    });
  }

  return {
    body: {
      ok: true,
      form: publicFormRecord(form as PublicRecord),
      brand: (brand ?? null) as PublicRecord | null,
      treatments: publicTreatments as PublicRecord[],
      packages: packages as PublicRecord[],
      branches: selectedBranchRows,
    },
    status: 200,
  };
}

const getCachedPublicFormConfig = unstable_cache(
  loadPublicFormConfig,
  ["public-form-config-v2"],
  {
    revalidate: 60,
    tags: [PUBLIC_FORM_CONFIG_CACHE_TAG],
  }
);

export async function getPublicFormConfig(token: string) {
  return getCachedPublicFormConfig(token);
}
