"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createForm,
  getFormByIdOrSlug,
  parseAllowedDomains,
  type ManagedFormInput,
} from "@/lib/data/formManagement";
import { createLandingPageDraft } from "@/lib/data/landingPageStore";

type CampaignMode = "new_landing_page" | "wix_form" | "existing_form_landing_page";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithMessage(path: string, key: string, message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

function getCampaignMode(formData: FormData): CampaignMode {
  const mode = readString(formData, "campaignMode");
  if (mode === "wix_form" || mode === "existing_form_landing_page") return mode;
  return "new_landing_page";
}

function parseNewFormInput(formData: FormData): ManagedFormInput | string {
  const campaignName = readString(formData, "campaignName");
  const formName = readString(formData, "formName") || `${campaignName} 表格`;
  const parsedDomains = parseAllowedDomains(readString(formData, "allowedDomains"));

  if (!campaignName) return "請輸入 Campaign 名稱。";
  if (!parsedDomains.ok) return parsedDomains.message;

  return {
    formName,
    brandId: readString(formData, "brandId"),
    defaultTreatmentId: readString(formData, "defaultTreatmentId"),
    defaultPackageId: readString(formData, "defaultPackageId"),
    defaultBranchId: readString(formData, "defaultBranchId"),
    allowedDomains: parsedDomains.domains,
    status: "active",
  };
}

async function createDraftForForm({
  formId,
  formData,
  fallbackName,
}: {
  formId: string;
  formData: FormData;
  fallbackName: string;
}) {
  const pageTitle = readString(formData, "pageTitle") || fallbackName;
  const heroTitle = readString(formData, "heroTitle") || pageTitle;
  const heroSubtitle =
    readString(formData, "heroSubtitle") ||
    "適合用作廣告測試及預約收集，系統會同時記錄來源資料，方便之後跟進成效。";
  const offerBadge = readString(formData, "offerBadge") || "限時體驗優惠";
  const ctaText = readString(formData, "ctaText") || "立即預約體驗";

  const { form } = await getFormByIdOrSlug(formId);
  if (!form) {
    return {
      ok: false,
      pageId: null as string | null,
      message: "找不到要連接的登記表格，請重新選擇。",
    };
  }

  return createLandingPageDraft({
    title: pageTitle,
    brandId: form.brandId,
    treatmentId: form.defaultTreatmentId ?? "",
    packageId: form.defaultPackageId ?? "",
    branchId: form.defaultBranchId ?? "",
    formId: form.id,
    heroTitle,
    heroSubtitle,
    offerBadge,
    ctaText,
  });
}

export async function createCampaignAction(formData: FormData) {
  const mode = getCampaignMode(formData);
  const campaignName = readString(formData, "campaignName");

  if (!campaignName) {
    redirectWithMessage("/campaigns/new", "campaign_status", "請輸入 Campaign 名稱。");
  }

  if (mode === "existing_form_landing_page") {
    const existingFormId = readString(formData, "existingFormId");
    if (!existingFormId) {
      redirectWithMessage(
        "/campaigns/new",
        "campaign_status",
        "請選擇要連接的登記表格。"
      );
    }

    const pageResult = await createDraftForForm({
      formId: existingFormId,
      formData,
      fallbackName: campaignName,
    });

    revalidatePath("/landing-pages");

    if (pageResult.ok && pageResult.pageId) {
      redirectWithMessage(
        `/landing-pages/${pageResult.pageId}`,
        "builder_status",
        "Landing Page 草稿已建立，並已連接選定表格。"
      );
    }

    redirectWithMessage(
      "/campaigns/new",
      "campaign_status",
      pageResult.message || "Landing Page 暫時未能建立，請稍後再試。"
    );
  }

  const parsedForm = parseNewFormInput(formData);

  if (typeof parsedForm === "string") {
    redirectWithMessage("/campaigns/new", "campaign_status", parsedForm);
  }

  const formResult = await createForm(parsedForm);
  revalidatePath("/forms");

  if (!formResult.ok || !formResult.form) {
    redirectWithMessage("/campaigns/new", "campaign_status", formResult.message);
  }

  if (mode === "wix_form") {
    redirectWithMessage(
      `/forms/${formResult.form.id}`,
      "form_status",
      "Wix 登記表格已建立，可以複製嵌入碼放入 Wix。"
    );
  }

  const pageResult = await createDraftForForm({
    formId: formResult.form.id,
    formData,
    fallbackName: campaignName,
  });

  revalidatePath("/landing-pages");

  if (pageResult.ok && pageResult.pageId) {
    redirectWithMessage(
      `/landing-pages/${pageResult.pageId}`,
      "builder_status",
      "Campaign 已建立，Landing Page 草稿已連接新表格。"
    );
  }

  redirectWithMessage(
    `/forms/${formResult.form.id}`,
    "form_status",
    pageResult.message ||
      "表格已建立，但 Landing Page 草稿未能建立。請稍後再試。"
  );
}
