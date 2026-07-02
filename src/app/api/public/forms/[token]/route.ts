import { NextRequest, NextResponse } from "next/server";
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

type BranchRow = Record<string, unknown>;

const PUBLIC_FORM_CONFIG_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function publicFormJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: PUBLIC_FORM_CONFIG_HEADERS,
  });
}

function withDefaultBranchFlag(
  branch: BranchRow,
  isDefault: boolean
): BranchRow {
  return {
    ...branch,
    is_default: isDefault,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!hasSupabaseAdminEnv()) {
    if (token !== alyssaDefaultForm.publicFormToken) {
      return publicFormJson({ ok: false, error: "invalid_form" }, 404);
    }

    return publicFormJson({
      ok: true,
      form: alyssaDefaultForm,
      brand: alyssaBrand,
      treatments: alyssaTreatments,
      packages: alyssaPackages,
      branches: alyssaBranches.map((branch) =>
        withDefaultBranchFlag(
          branch as unknown as BranchRow,
          branch.id === alyssaDefaultForm.defaultBranchId
        )
      ),
      mode: "local_seed",
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("public_form_token", token)
    .single();

  if (formError || !form) {
    return publicFormJson({ ok: false, error: "invalid_form" }, 404);
  }

  if (String(form.status ?? "").toLowerCase() !== "active") {
    return publicFormJson(
      { ok: false, error: "form_unavailable", message: "Form is unavailable." },
      410
    );
  }

  const [{ data: brand }, { data: treatments }, { data: branches }] =
    await Promise.all([
      supabase.from("brands").select("*").eq("id", form.brand_id).single(),
      supabase
        .from("treatments")
        .select("*")
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("branches")
        .select("*")
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

  const treatmentIds = (treatments ?? []).map((item) => item.id);
  const { data: packages } =
    treatmentIds.length > 0
      ? await supabase
          .from("packages")
          .select("*")
          .in("treatment_id", treatmentIds)
          .eq("status", "active")
          .order("created_at", { ascending: true })
      : { data: [] };
  const { data: formBranches, error: formBranchesError } = await supabase
    .from("form_branches")
    .select("branch_id,is_default,is_active,display_order")
    .eq("form_id", form.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  const branchRows = (branches ?? []) as BranchRow[];
  const selectedBranchRows =
    !formBranchesError && (formBranches ?? []).length > 0
      ? (formBranches ?? [])
          .map((item) => {
            const row = item as Record<string, unknown>;
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

  return publicFormJson({
    ok: true,
    form,
    brand,
    treatments: treatments ?? [],
    packages: packages ?? [],
    branches: selectedBranchRows,
  });
}
