"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { getConfigurationData } from "@/lib/data/configuration";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function requireAdmin() {
  if (!hasSupabaseAdminEnv()) throw new Error("Supabase admin environment is not configured.");
  return createSupabaseAdminClient();
}

function done(message: string) {
  revalidatePath("/crm/operations");
  redirect(`/crm/operations?success=${encodeURIComponent(message)}`);
}

function fail(message: string): never {
  redirect(`/crm/operations?error=${encodeURIComponent(message)}`);
}

async function requireBrandSlugAccess(brandSlug: string) {
  const moduleAccess = await requireModuleAccess("crm");
  if (!moduleAccess.allowed) fail("你未獲授權使用 CRM Operations。");
  const config = await getConfigurationData();
  if (!config.brands.some((brand) => brand.slug === brandSlug)) {
    fail("你未獲授權管理呢個品牌。");
  }
}

export async function createTagAction(formData: FormData) {
  const brandSlug = text(formData, "brand_slug") || "ineffable";
  await requireBrandSlugAccess(brandSlug);
  const label = text(formData, "label");
  const tagKey = text(formData, "tag_key") || label.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "_");
  if (!label || !tagKey) fail("Tag 名稱不完整。");
  const supabase = requireAdmin();
  const { error } = await supabase.from("crm_tags").upsert({
    brand_slug: brandSlug,
    tag_key: tagKey,
    label,
    color_key: text(formData, "color_key") || "slate",
    description: text(formData, "description") || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "brand_slug,tag_key" });
  if (error) fail(error.message);
  done("Tag 已儲存。");
}

export async function createAutomationRuleAction(formData: FormData) {
  const brandSlug = text(formData, "brand_slug") || "ineffable";
  await requireBrandSlugAccess(brandSlug);
  const ruleName = text(formData, "rule_name");
  const triggerKey = text(formData, "trigger_key");
  if (!ruleName || !triggerKey) fail("Rule 名稱及 Trigger 必須填寫。");
  const supabase = requireAdmin();
  const conditions = text(formData, "conditions_json") || "{}";
  const actions = text(formData, "actions_json") || "[]";
  let conditionsJson: unknown;
  let actionsJson: unknown;
  try {
    conditionsJson = JSON.parse(conditions);
    actionsJson = JSON.parse(actions);
  } catch {
    fail("Conditions / Actions 必須是有效 JSON。");
  }
  const { error } = await supabase.from("crm_automation_rules").insert({
    brand_slug: brandSlug,
    rule_name: ruleName,
    trigger_key: triggerKey,
    conditions_json: conditionsJson,
    actions_json: actionsJson,
    mode: "simulation",
    enabled: true,
    created_by: "crm-admin",
  });
  if (error) fail(error.message);
  done("Automation rule 已建立為 Simulation Mode。");
}

export async function createPaymentRecordAction(formData: FormData) {
  const brandSlug = text(formData, "brand_slug") || "ineffable";
  await requireBrandSlugAccess(brandSlug);
  const amountText = text(formData, "amount");
  const amount = amountText ? Number(amountText) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) fail("付款金額不正確。");
  const supabase = requireAdmin();
  const { error } = await supabase.from("crm_payment_records").insert({
    brand_slug: brandSlug,
    source_lead_id: text(formData, "source_lead_id") || null,
    payment_required: text(formData, "payment_required") === "true",
    payment_type: text(formData, "payment_type") || "manual",
    amount,
    currency: "HKD",
    status: text(formData, "status") || "not_requested",
    method: text(formData, "method") || null,
    external_reference: text(formData, "external_reference") || null,
    due_at: text(formData, "due_at") || null,
    note: text(formData, "note") || null,
  });
  if (error) fail(error.message);
  done("付款記錄已建立。");
}

export async function updatePaymentStatusAction(formData: FormData) {
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !status) fail("付款記錄資料不完整。");
  const lookupClient = requireAdmin();
  const { data: payment } = await lookupClient
    .from("crm_payment_records")
    .select("brand_slug")
    .eq("id", id)
    .maybeSingle();
  if (!payment?.brand_slug) fail("搵唔到付款記錄。");
  await requireBrandSlugAccess(String(payment.brand_slug));
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { status, updated_at: now };
  if (status === "paid") payload.paid_at = now;
  if (status === "proof_submitted") payload.customer_submitted_at = now;
  if (status === "verifying") payload.cs_verified_at = now;
  const supabase = requireAdmin();
  const { error } = await supabase.from("crm_payment_records").update(payload).eq("id", id);
  if (error) fail(error.message);
  done("付款狀態已更新。");
}

export async function updateTemplateMappingAction(formData: FormData) {
  const id = text(formData, "id");
  const approvalStatus = text(formData, "approval_status");
  if (!id || !approvalStatus) fail("Template mapping 資料不完整。");
  const lookupClient = requireAdmin();
  const { data: mapping } = await lookupClient
    .from("crm_template_mappings")
    .select("brand_slug")
    .eq("id", id)
    .maybeSingle();
  if (!mapping?.brand_slug) fail("搵唔到 Template mapping。");
  await requireBrandSlugAccess(String(mapping.brand_slug));
  const supabase = requireAdmin();
  const { error } = await supabase.from("crm_template_mappings").update({
    approval_status: approvalStatus,
    enabled: text(formData, "enabled") !== "false",
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) fail(error.message);
  done("Template mapping 已更新。");
}
