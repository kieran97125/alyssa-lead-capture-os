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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!hasSupabaseAdminEnv()) {
    if (token !== alyssaDefaultForm.publicFormToken) {
      return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      form: alyssaDefaultForm,
      brand: alyssaBrand,
      treatments: alyssaTreatments,
      packages: alyssaPackages,
      branches: alyssaBranches,
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
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 404 });
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

  return NextResponse.json({
    ok: true,
    form,
    brand,
    treatments: treatments ?? [],
    packages: packages ?? [],
    branches: branches ?? [],
  });
}
