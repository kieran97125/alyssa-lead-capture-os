"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createForm,
  parseAllowedDomains,
  type ManagedFormInput,
} from "@/lib/data/formManagement";
import { createLandingPageDraft } from "@/lib/data/landingPageStore";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithMessage(path: string, key: string, message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

function parseBaseFormInput(formData: FormData): ManagedFormInput | string {
  const campaignName = readString(formData, "campaignName");
  const formName = readString(formData, "formName") || `${campaignName} 表格`;
  const parsedDomains = parseAllowedDomains(
    readString(formData, "allowedDomains")
  );

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

export async function createCampaignAction(formData: FormData) {
  const outputType = readString(formData, "outputType") || "wix_form";
  const parsedForm = parseBaseFormInput(formData);

  if (typeof parsedForm === "string") {
    redirectWithMessage("/campaigns/new", "campaign_status", parsedForm);
  }

  const formResult = await createForm(parsedForm);
  revalidatePath("/forms");

  if (!formResult.ok || !formResult.form) {
    redirectWithMessage("/campaigns/new", "campaign_status", formResult.message);
  }

  if (outputType === "landing_page") {
    const campaignName = readString(formData, "campaignName");
    const pageTitle = readString(formData, "pageTitle") || campaignName;
    const heroTitle = readString(formData, "heroTitle") || pageTitle;
    const heroSubtitle =
      readString(formData, "heroSubtitle") ||
      "適合用作廣告測試及預約收集，系統會同時記錄來源資料，方便之後跟進成效。";
    const offerBadge = readString(formData, "offerBadge") || "限時體驗優惠";
    const ctaText = readString(formData, "ctaText") || "立即預約體驗";

    const pageResult = await createLandingPageDraft({
      title: pageTitle,
      brandId: parsedForm.brandId,
      treatmentId: parsedForm.defaultTreatmentId,
      packageId: parsedForm.defaultPackageId,
      branchId: parsedForm.defaultBranchId,
      formId: formResult.form.id,
      heroTitle,
      heroSubtitle,
      offerBadge,
      ctaText,
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

  redirectWithMessage(
    `/forms/${formResult.form.id}`,
    "form_status",
    "Wix 登記表格已建立，可以複製嵌入碼放入 Wix。"
  );
}
