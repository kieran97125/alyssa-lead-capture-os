"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_LABEL_LENGTH = 80;
const MAX_BODY_LENGTH = 1200;

type QuickReplyRow = {
  id: string;
  setting_scope: string | null;
  brand_id: string | null;
  brand_slug: string | null;
  config_group: string;
  config_key: string;
  label: string;
  value_json: Record<string, unknown> | null;
  enabled: boolean;
  locked: boolean;
};

export async function updateQuickReplyAction(configKey: string, formData: FormData) {
  const safeConfigKey = safeText(configKey, 120);
  const label = safeText(formData.get("label"), MAX_LABEL_LENGTH);
  const body = safeText(formData.get("body"), MAX_BODY_LENGTH);

  let status: "settings_success" | "settings_error" = "settings_success";
  let message = "quick_reply_saved";

  try {
    if (!safeConfigKey) {
      throw new Error("missing_config_key");
    }

    if (!label) {
      throw new Error("label_required");
    }

    if (!body) {
      throw new Error("body_required");
    }

    const supabase = createSupabaseAdminClient();
    const { data: existing, error: readError } = await supabase
      .from("crm_app_settings")
      .select(
        "id, setting_scope, brand_id, brand_slug, config_group, config_key, label, value_json, enabled, locked"
      )
      .eq("setting_scope", "global")
      .eq("config_group", "quick_replies")
      .eq("config_key", safeConfigKey)
      .eq("enabled", true)
      .eq("locked", false)
      .maybeSingle();

    if (readError) throw readError;
    if (!existing) {
      throw new Error("quick_reply_not_editable");
    }

    const row = existing as QuickReplyRow;
    const nextValueJson = {
      ...(isPlainObject(row.value_json) ? row.value_json : {}),
      body,
    };

    const { error: updateError } = await supabase
      .from("crm_app_settings")
      .update({
        label,
        value_json: nextValueJson,
        updated_by: "admin_ui",
      })
      .eq("id", row.id)
      .eq("setting_scope", row.setting_scope ?? "global")
      .eq("config_group", "quick_replies")
      .eq("config_key", row.config_key)
      .eq("enabled", true)
      .eq("locked", false);

    if (updateError) throw updateError;

    revalidatePath("/crm/settings");
    revalidatePath("/crm");
  } catch (error) {
    console.warn("crm_settings_quick_reply_update_failed", safeError(error));
    status = "settings_error";
    message = settingsErrorCode(error);
  }

  redirect(`/crm/settings?section=ai&${status}=${encodeURIComponent(message)}`);
}

function safeText(value: FormDataEntryValue | string | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function settingsErrorCode(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message === "label_required" ||
      error.message === "body_required" ||
      error.message === "quick_reply_not_editable"
    ) {
      return error.message;
    }
  }

  return "quick_reply_save_failed";
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: "Unknown error",
  };
}
