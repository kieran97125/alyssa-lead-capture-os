import { getBrandLaunchDefaults } from "@/lib/data/brandDefaults";

export const REGISTRATION_EMAIL_MAX_LENGTH = 254;
export const REQUIRED_EMAIL_MESSAGE = "請填寫電郵地址。";
export const INVALID_EMAIL_MESSAGE = "請輸入有效的電郵地址，例如 name@example.com。";

export function requiresRegistrationEmail(brandSlug: string | null | undefined) {
  return getBrandLaunchDefaults(brandSlug)?.brandSlug === "gos-beauty";
}

export function isValidRegistrationEmail(email: string) {
  return email.length <= REGISTRATION_EMAIL_MAX_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
