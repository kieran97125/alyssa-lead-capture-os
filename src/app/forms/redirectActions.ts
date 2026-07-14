"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormOperations } from "@/lib/data/brandOperations";
import { getFormByIdOrSlug } from "@/lib/data/formManagement";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

function redirectWithMessage(path: string, message: string): never {
  const params = new URLSearchParams();
  params.set("form_status", message);
  redirect(`${path}?${params.toString()}`);
}

export async function syncGeneratedSuccessRedirectAction(formData: FormData) {
  const formId = String(formData.get("formId") ?? "").trim();
  const path = `/forms/${formId}`;

  if (!formId) {
    redirectWithMessage("/forms", "找不到需要更新的表格。");
  }

  if (!hasSupabaseAdminEnv()) {
    redirectWithMessage(path, "正式資料庫未連接，未能同步 Success Redirect。");
  }

  const { form, config } = await getFormByIdOrSlug(formId);
  if (!form) {
    redirectWithMessage(path, "找不到表格。");
  }

  const ops = getFormOperations(config, form);
  const generatedUrl = ops.generatedSuccessRedirectUrl?.trim() || "";

  if (!generatedUrl) {
    redirectWithMessage(
      path,
      "未能根據品牌、Treatment Slug 及套餐價值生成 Redirect，現有表格設定沒有變更。"
    );
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("forms")
    .update({
      success_redirect_url: generatedUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", form.id);

  if (error) {
    console.warn("form_generated_redirect_sync_failed", {
      code: error.code,
      message: error.message,
      form_id: form.id,
    });
    redirectWithMessage(path, "同步 Success Redirect 失敗，現有表格設定沒有變更。");
  }

  revalidatePath("/forms");
  revalidatePath(path);
  redirectWithMessage(
    path,
    "Success Redirect 已按目前 Treatment Slug 重新生成。已貼到 Wix 的舊 Embed Code 不會自動更新，請重新複製 Embed。"
  );
}
