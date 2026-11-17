"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canProvisionCustomers, getCurrentPlatformOperator } from "@/lib/security/platformAccess";

const input = z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/), name: z.string().trim().min(1).max(120) });
export async function createWorkspaceAction(form: FormData) {
  const access = await getCurrentPlatformOperator();
  if (!access || !canProvisionCustomers(access)) redirect("/login?next=%2Fplatform&error=platform_required");
  const values = input.safeParse({ slug: form.get("slug"), name: form.get("name") });
  if (!values.success) redirect("/platform?status=invalid");
  const result = await createSupabaseAdminClient().rpc("provision_marketing_workspace", {
    p_operator_id: access.id, p_slug: values.data.slug, p_display_name: values.data.name,
  });
  if (result.error || typeof result.data !== "string") redirect("/platform?status=unavailable");
  redirect("/platform?status=created");
}
