import { z } from "zod";

/** Anonymous browser telemetry cannot assert CRM, appointment or payment outcomes. */
export const publicTelemetryEventTypes = [
  "page_view",
  "parent_attribution_captured",
  "form_iframe_loaded",
  "attribution_payload_received",
  "form_view",
  "form_start",
  "form_submit_attempt",
  "form_submit_failed",
  "whatsapp_clicked",
] as const;

export const PUBLIC_EVENT_BODY_LIMIT_BYTES = 16_384;
const EVENT_PAYLOAD_LIMIT_BYTES = 8_192;

type PublicEventRow = {
  lead_id: null;
  contact_id: null;
  source_snapshot_id: null;
  visitor_id: string | null;
  session_id: string | null;
  event_type: typeof publicTelemetryEventTypes[number];
  event_payload_json: Record<string, unknown>;
  page_url: string | null;
  referrer: string | null;
};

type PublicEventValidation =
  | { ok: true; row: PublicEventRow }
  | { ok: false; error: string; status: 400 | 413 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalTextSchema(maxLength: number) {
  return z.string().max(maxLength).refine(value => !/[\u0000-\u001f\u007f]/.test(value))
    .nullish().transform(value => value?.trim() || null);
}

const publicEventTypeSchema = z.string().trim().max(80).pipe(z.enum(publicTelemetryEventTypes));
const publicEventSchema = z.object({
  event_type: publicEventTypeSchema,
  visitor_id: optionalTextSchema(120),
  session_id: optionalTextSchema(120),
  page_url: optionalTextSchema(2_000),
  referrer: optionalTextSchema(2_000),
  event_payload_json: z.record(z.string(), z.unknown()).nullish()
    .transform(value => value ?? {}).refine(value => isBoundedJson(value)),
});

function isBoundedJson(value: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 2_048;
  if (Array.isArray(value)) return value.length <= 50 && value.every(item => isBoundedJson(item, depth + 1));
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 50 && entries.every(([key, item]) =>
    key.length <= 120 && !["__proto__", "constructor", "prototype"].includes(key) && isBoundedJson(item, depth + 1)
  );
}

export function validatePublicEvent(payload: unknown): PublicEventValidation {
  if (!isRecord(payload)) return { ok: false, error: "invalid_event_payload", status: 400 };
  const eventType = publicEventTypeSchema.safeParse(payload.event_type);
  if (!eventType.success) return { ok: false, error: "invalid_event_type", status: 400 };

  // Existing browser callers do not send database references. Such references
  // need a server-issued proof/receipt before a public event may be linked.
  if ([payload.lead_id, payload.contact_id, payload.source_snapshot_id].some(value => value !== undefined && value !== null && value !== "")) {
    return { ok: false, error: "untrusted_event_reference", status: 400 };
  }

  const parsed = publicEventSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "invalid_event_payload", status: 400 };
  const eventPayload = parsed.data.event_payload_json;
  if (new TextEncoder().encode(JSON.stringify(eventPayload)).byteLength > EVENT_PAYLOAD_LIMIT_BYTES) {
    return { ok: false, error: "event_payload_too_large", status: 413 };
  }

  return {
    ok: true,
    row: {
      lead_id: null,
      contact_id: null,
      source_snapshot_id: null,
      visitor_id: parsed.data.visitor_id,
      session_id: parsed.data.session_id,
      event_type: parsed.data.event_type,
      // Mark browser claims explicitly; successful persisted registrations and
      // operational outcomes continue to be written by trusted server routes.
      event_payload_json: { ...eventPayload, event_origin: "public_browser_telemetry" },
      page_url: parsed.data.page_url,
      referrer: parsed.data.referrer,
    },
  };
}

/** Count streamed bytes as well as Content-Length, which the sender can omit. */
export async function readPublicEventRequest(request: Request): Promise<PublicEventValidation> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > PUBLIC_EVENT_BODY_LIMIT_BYTES) {
    return { ok: false, error: "event_payload_too_large", status: 413 };
  }
  if (!request.body) return { ok: false, error: "invalid_event_payload", status: 400 };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > PUBLIC_EVENT_BODY_LIMIT_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, error: "event_payload_too_large", status: 413 };
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return validatePublicEvent(JSON.parse(body));
  } catch {
    return { ok: false, error: "invalid_event_payload", status: 400 };
  } finally {
    reader.releaseLock();
  }
}
