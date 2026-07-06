"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  WHATSAPP_PROVIDER_META,
  saveWhatsAppConnection,
  sendWhatsAppTextMessage,
} from "@/lib/crm/whatsapp";

function readString(formData: FormData, key: string, maxLength = 5000) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function redirectBack(status: "success" | "error", message: string): never {
  redirect(
    `/crm/settings/whatsapp?settings_${status}=${encodeURIComponent(message)}`
  );
}

export async function saveWhatsAppConnectionAction(formData: FormData) {
  const result = await saveWhatsAppConnection({
    brandId: readString(formData, "brandId", 80),
    provider: readString(formData, "provider", 80) || WHATSAPP_PROVIDER_META,
    wabaId: readString(formData, "wabaId", 120),
    phoneNumberId: readString(formData, "phoneNumberId", 120),
    displayPhoneNumber: readString(formData, "displayPhoneNumber", 80),
    appId: readString(formData, "appId", 120),
    appSecret: readString(formData, "appSecret", 5000),
    accessToken: readString(formData, "accessToken", 5000),
    verifyToken: readString(formData, "verifyToken", 200),
    graphApiVersion: readString(formData, "graphApiVersion", 30),
    defaultSendMode: readString(formData, "defaultSendMode", 80),
  });

  revalidatePath("/crm/settings/whatsapp");
  redirectBack(result.ok ? "success" : "error", result.message);
}

export async function testWhatsAppSendAction(formData: FormData) {
  const result = await sendWhatsAppTextMessage({
    brandId: readString(formData, "brandId", 80),
    connectionId: readString(formData, "connectionId", 80) || null,
    toPhone: readString(formData, "testPhone", 80),
    body: readString(formData, "testMessage", 1000),
    markAsTest: true,
  });

  revalidatePath("/crm/settings/whatsapp");
  redirectBack(result.ok ? "success" : "error", result.message);
}
