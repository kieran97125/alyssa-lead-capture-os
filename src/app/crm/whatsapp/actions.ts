"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAccessInternalBrand,
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  linkWhatsAppConversationToLead,
  markWhatsAppConversationRead,
  syncWhatsAppTemplates,
} from "@/lib/crm/whatsappInbox";
import { createCrmInteraction } from "@/lib/crm/store";
import type { InternalAccessContext } from "@/lib/security/internalAccess";

function readString(formData: FormData, key: string, maxLength = 1000) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function requireAdmin() {
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) return session;
  const moduleAccess = await requireModuleAccess("crm");
  return moduleAccess.allowed
    ? session
    : ({ ok: false, access: null } as const);
}

async function canUseBrandRecord(
  access: InternalAccessContext,
  table: "whatsapp_conversations" | "whatsapp_connections",
  id: string
) {
  if (!id || !hasSupabaseAdminEnv()) return false;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from(table)
    .select("brand_id")
    .eq("id", id)
    .maybeSingle();
  return Boolean(
    data?.brand_id &&
      canAccessInternalBrand(access, String(data.brand_id))
  );
}

function redirectConversation(
  conversationId: string,
  status: "success" | "error",
  message: string
): never {
  redirect(
    `/crm/whatsapp/${encodeURIComponent(conversationId)}?${status}=${encodeURIComponent(message)}`
  );
}

export async function markConversationReadAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session.ok) redirect("/login");
  const conversationId = readString(formData, "conversationId", 100);
  if (!(await canUseBrandRecord(session.access, "whatsapp_conversations", conversationId))) {
    redirectConversation(conversationId || "missing", "error", "permission_denied");
  }
  if (conversationId) await markWhatsAppConversationRead(conversationId);
  revalidatePath("/crm/whatsapp");
  revalidatePath(`/crm/whatsapp/${conversationId}`);
}

export async function linkConversationToLeadAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session.ok) redirect("/login");
  const conversationId = readString(formData, "conversationId", 100);
  const leadId = readString(formData, "leadId", 100);
  if (!conversationId || !leadId) {
    redirectConversation(conversationId || "missing", "error", "conversation_and_lead_required");
  }
  if (!(await canUseBrandRecord(session.access, "whatsapp_conversations", conversationId))) {
    redirectConversation(conversationId, "error", "permission_denied");
  }

  const result = await linkWhatsAppConversationToLead({
    conversationId,
    leadId,
    linkedBy: "admin",
  });
  revalidatePath("/crm/whatsapp");
  revalidatePath(`/crm/whatsapp/${conversationId}`);
  redirectConversation(conversationId, result.ok ? "success" : "error", result.message);
}

export async function syncWhatsAppTemplatesAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session.ok) redirect("/login");
  const connectionId = readString(formData, "connectionId", 100);
  if (!(await canUseBrandRecord(session.access, "whatsapp_connections", connectionId))) {
    redirect("/crm/whatsapp/templates?error=permission_denied");
  }
  const result = await syncWhatsAppTemplates(connectionId);
  revalidatePath("/crm/whatsapp");
  revalidatePath("/crm/whatsapp/templates");
  revalidatePath("/crm/settings/whatsapp");
  redirect(
    `/crm/whatsapp/templates?${result.ok ? "success" : "error"}=${encodeURIComponent(result.message)}`
  );
}

export async function addWhatsAppInternalNoteAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session.ok) redirect("/login");
  const conversationId = readString(formData, "conversationId", 100);
  const body = readString(formData, "body", 2000);
  if (!conversationId || !body || !hasSupabaseAdminEnv()) {
    redirectConversation(conversationId || "missing", "error", "note_required");
  }

  const supabase = createSupabaseAdminClient();
  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("lead_id,brand_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (
    !conversation?.brand_id ||
    !canAccessInternalBrand(session.access, String(conversation.brand_id))
  ) {
    redirectConversation(conversationId, "error", "permission_denied");
  }
  if (!conversation?.lead_id) {
    redirectConversation(conversationId, "error", "link_lead_before_note");
  }

  const { data: leadCase } = await supabase
    .from("crm_lead_cases")
    .select("id,contact_id")
    .eq("source_lead_id", conversation.lead_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!leadCase?.id || !leadCase.contact_id) {
    redirectConversation(conversationId, "error", "crm_case_not_found");
  }

  await createCrmInteraction({
    caseId: leadCase.id,
    contactId: leadCase.contact_id,
    interactionType: "internal_note",
    direction: "internal",
    body,
    author: "admin",
    sourceType: "whatsapp",
    metadata: { conversation_id: conversationId },
    operation: "whatsapp internal note failed",
  });

  revalidatePath(`/crm/whatsapp/${conversationId}`);
  redirectConversation(conversationId, "success", "internal_note_added");
}

export async function setConversationArchiveAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session.ok) redirect("/login");
  const conversationId = readString(formData, "conversationId", 100);
  const status = readString(formData, "status", 20) === "archived" ? "archived" : "active";
  if (!conversationId || !hasSupabaseAdminEnv()) {
    redirectConversation(conversationId || "missing", "error", "conversation_required");
  }
  const supabase = createSupabaseAdminClient();
  if (!(await canUseBrandRecord(session.access, "whatsapp_conversations", conversationId))) {
    redirectConversation(conversationId, "error", "permission_denied");
  }
  await supabase
    .from("whatsapp_conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  revalidatePath("/crm/whatsapp");
  redirect(`/crm/whatsapp?success=${encodeURIComponent(`conversation_${status}`)}`);
}
