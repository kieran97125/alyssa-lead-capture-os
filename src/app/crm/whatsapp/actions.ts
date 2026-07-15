"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adminSessionCookieName,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";
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

function readString(formData: FormData, key: string, maxLength = 1000) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function requireAdmin() {
  const cookieStore = await cookies();
  return verifySignedAdminSession(
    cookieStore.get(adminSessionCookieName)?.value
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
    .select("lead_id")
    .eq("id", conversationId)
    .maybeSingle();
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
  await supabase
    .from("whatsapp_conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  revalidatePath("/crm/whatsapp");
  redirect(`/crm/whatsapp?success=${encodeURIComponent(`conversation_${status}`)}`);
}
