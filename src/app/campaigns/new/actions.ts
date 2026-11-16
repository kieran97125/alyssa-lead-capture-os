"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { managedFormSchema } from "@/lib/acquisition/managedFormSchema";
import { parseAllowedDomains, type ManagedFormInput } from "@/lib/data/formManagement";
import { createAcquisitionAssets } from "@/lib/data/landingPageStore";
import { PUBLIC_FORM_CONFIG_CACHE_TAG } from "@/lib/data/publicFormConfig";
import { requireModuleAccess, verifyCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import { z } from "zod";

type ActionFailure = { ok: false; message: string; fieldErrors?: Record<string, string> };
function readString(data: FormData, key: string) { return String(data.get(key) ?? "").trim(); }
function readArray(data: FormData, key: string) { return data.getAll(key).map(value => String(value).trim()).filter(Boolean); }
function redirectWithMessage(path: string, key: string, message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}
export async function createCampaignAction(data: FormData): Promise<ActionFailure | void> {
  const session = await verifyCurrentInternalAccess();
  const access = await requireModuleAccess("campaigns");
  if (!session.ok || !access.allowed) redirect("/login?next=/campaigns/new&error=permission_denied");
  const mode = readString(data, "campaignMode");
  if (!["wix_form", "new_landing_page", "existing_form_landing_page"].includes(mode)) return { ok: false, message: "請選擇建立方式。" };
  const requestId = readString(data, "requestId");
  if (!z.uuid().safeParse(requestId).success) return { ok: false, message: "操作資料不完整，請重新載入。" };
  const campaignName = readString(data, "campaignName");
  if (!campaignName) return { ok: false, message: "請輸入名稱。", fieldErrors: { formName: "請輸入名稱。" } };
  let form: ManagedFormInput | undefined;
  const brandId = readString(data, "brandId");
  if (mode !== "existing_form_landing_page") {
    const parsed = managedFormSchema.safeParse({
      formName: readString(data, "formName") || campaignName, brandId,
      defaultTreatmentId: readString(data, "defaultTreatmentId"), defaultPackageId: readString(data, "defaultPackageId"),
      packageSelectionMode: readString(data, "packageSelectionMode") || "fixed", packageIds: readArray(data, "packageIds"),
      defaultBranchId: readString(data, "defaultBranchId"), branchIds: readArray(data, "branchIds"),
      allowedDomains: readString(data, "allowedDomains"), placementKind: readString(data, "placementKind") || (mode === "wix_form" ? "wix" : "landing_page"),
      placementUrl: readString(data, "placementUrl"), requestId,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return { ok: false, message: parsed.error.issues[0]?.message ?? "請檢查資料。", fieldErrors };
    }
    const domains = parseAllowedDomains(parsed.data.allowedDomains);
    if (!domains.ok) return { ok: false, message: domains.message, fieldErrors: { allowedDomains: domains.message } };
    form = { ...parsed.data, allowedDomains: domains.domains };
  }
  const pageTitle = readString(data, "pageTitle") || campaignName;
  const page = mode === "wix_form" ? undefined : {
    title: pageTitle, heroTitle: readString(data, "heroTitle") || pageTitle,
    heroSubtitle: readString(data, "heroSubtitle") || "了解療程及體驗優惠，留下電話即可安排專人跟進。",
    offerBadge: readString(data, "offerBadge") || "限時體驗優惠", ctaText: readString(data, "ctaText") || "了解體驗優惠",
  };
  const result = await createAcquisitionAssets({ requestId, brandId, form,
    existingFormId: mode === "existing_form_landing_page" ? readString(data, "existingFormId") : undefined, page });
  if (!result.ok || !result.formId) return { ok: false, message: result.message };
  revalidatePath("/forms"); revalidatePath("/campaigns"); revalidatePath("/landing-pages");
  revalidateTag(PUBLIC_FORM_CONFIG_CACHE_TAG, { expire: 0 });
  if (result.pageId) redirectWithMessage(`/landing-pages/${result.pageId}`, "builder_status", "登記頁草稿已建立，已連接登記表格。");
  redirectWithMessage(`/forms/${result.formId}`, "form_status", "登記表格已建立，可以放入網站。" );
}
