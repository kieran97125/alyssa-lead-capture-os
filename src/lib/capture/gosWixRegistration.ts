import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { normalizePhone } from "@/lib/attribution/classify";
import { isValidRegistrationEmail } from "@/lib/capture/registrationEmail";
import { GOS_BRAND_ID } from "@/lib/data/systemBrands";
import { buildGoogleSheetsLeadPayload, formatHongKongDate } from "@/lib/integrations/googleSheetsLeadSync";

export function authenticGosWixWebhook(key: unknown, expectedDigest: string | undefined) {
  if (typeof key !== "string" || !/^[a-f0-9]{64}$/.test(key) || !expectedDigest || !/^[a-f0-9]{64}$/.test(expectedDigest)) return false;
  return timingSafeEqual(createHash("sha256").update(key).digest(), Buffer.from(expectedDigest, "hex"));
}

const text = (max: number) => z.string().trim().max(max).nullish();
const optionalDate = z.string().trim().max(64).nullish();
export const gosWixEvent = z.object({
  kind: z.enum(["form", "booking"]),
  eventId: z.uuid(),
  email: z.string().trim().refine(isValidRegistrationEmail),
  firstName: text(150), lastName: text(150), phone: text(80),
  label: z.string().trim().min(1).max(300),
  createdAt: optionalDate, startsAt: optionalDate,
  preferredDate: text(32), preferredTime: text(24), offer: text(300),
  initiator: z.enum(["USER","APP","SITE_MEMBER","VISITOR"]).optional(),
}).refine(event => event.kind !== "booking" || !!event.initiator, "Booking origin is required");

// Use the event's own email and a distinct, durable identity for each Wix
// submission or booking. Repeat submissions from one contact remain distinct.
export function gosWixSheetPayload(event: z.infer<typeof gosWixEvent>, leadKey: string) {
  const appointment = event.startsAt ? new Date(event.startsAt) : null;
  if (appointment && !Number.isFinite(appointment.valueOf())) throw new Error("invalid_appointment");
  const createdAt = event.createdAt ? new Date(event.createdAt) : new Date();
  if (!Number.isFinite(createdAt.valueOf())) throw new Error("invalid_creation_date");
  const preferredDate = event.preferredDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  const preferredTime = event.preferredTime?.match(/^(?:[01]\d|2[0-3]):[0-5]\d$/)?.[0] ?? null;
  const phone = normalizePhone(event.phone ?? "");
  const payload = buildGoogleSheetsLeadPayload({
    leadKey, brandId: GOS_BRAND_ID, brandName: "GOS Beauty", branchName: "荔枝角",
    customerName: [event.firstName, event.lastName].filter(Boolean).join(" "),
    phone: /^\+?\d{8,15}$/.test(phone) ? phone : "", email: event.email,
    formName: event.label, treatmentName: event.label, packageName: event.offer || "", price: "",
    createdAt, appointmentDate: appointment ? formatHongKongDate(appointment) : preferredDate,
    appointmentTime: appointment ? new Intl.DateTimeFormat("en-GB", {
      timeZone:"Asia/Hong_Kong",hour:"2-digit",minute:"2-digit",hourCycle:"h23",
    }).format(appointment) : preferredTime,
    pageUrl: null, touch: {},
  });
  payload.secret = "";
  return payload;
}
