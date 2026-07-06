import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_PREFIX = "waenc:v1";

export function getWhatsAppCredentialKeyStatus() {
  const rawKey = process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY?.trim() || "";

  return {
    configured: Boolean(rawKey),
    requiredEnvVar: "WHATSAPP_CREDENTIAL_ENCRYPTION_KEY",
  };
}

function getKey() {
  const rawKey = process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY?.trim() || "";
  if (!rawKey) return null;

  return createHash("sha256").update(rawKey).digest();
}

export function encryptWhatsAppSecret(value: string) {
  const key = getKey();
  if (!key) {
    throw new Error("whatsapp_encryption_key_missing");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptWhatsAppSecret(value: string | null | undefined) {
  if (!value) return null;
  const key = getKey();
  if (!key) return null;

  const [prefix, version, ivValue, tagValue, encryptedValue] = value.split(":");
  if (`${prefix}:${version}` !== ENCRYPTION_PREFIX) return null;
  if (!ivValue || !tagValue || !encryptedValue) return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
