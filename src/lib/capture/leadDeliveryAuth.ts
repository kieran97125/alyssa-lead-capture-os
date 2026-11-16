import { createHmac, timingSafeEqual } from "node:crypto";

export const LEAD_DELIVERY_WORKER_PATH = "/api/cron/lead-deliveries";
export const LEAD_DELIVERY_TIMESTAMP_HEADER = "x-lead-delivery-timestamp";
export const LEAD_DELIVERY_SIGNATURE_HEADER = "x-lead-delivery-signature";

export function leadDeliverySigningMessage(timestamp: string) {
  return `GET\n${LEAD_DELIVERY_WORKER_PATH}\n${timestamp}`;
}

export function verifyLeadDeliverySignature(input: {
  method: string; path: string; timestamp: string | null;
  signature: string | null; secret: string | undefined; nowMs?: number;
}) {
  const secret = input.secret ?? "";
  if (secret.length < 32 || secret !== secret.trim() || /[\r\n]/.test(secret)
      || input.method !== "GET" || input.path !== LEAD_DELIVERY_WORKER_PATH
      || !input.timestamp || !/^[1-9][0-9]{8,11}$/.test(input.timestamp)
      || !input.signature || !/^[a-f0-9]{64}$/.test(input.signature)) return false;
  const issuedAt = Number(input.timestamp);
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const age = now - issuedAt;
  if (!Number.isSafeInteger(issuedAt) || !Number.isFinite(now) || age > 60 || age < -15) return false;
  const expected = createHmac("sha256", secret).update(leadDeliverySigningMessage(input.timestamp)).digest();
  const supplied = Buffer.from(input.signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
