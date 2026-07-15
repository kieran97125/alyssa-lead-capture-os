import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(repoRoot, "src/lib/crm/whatsappInbox.ts");
const source = await readFile(target, "utf8");

const original = `  const payload =
    input.direction === "inbound"
      ? {
          ...common,
          unread_count: Math.max(0, Number(existing?.unread_count || 0)) + 1,
          last_inbound_at: messageAt,
          service_window_expires_at: getWhatsAppServiceWindowExpiry(messageAt),
        }
      : {
          ...common,
          unread_count: Math.max(0, Number(existing?.unread_count || 0)),
          last_outbound_at: messageAt,
        };`;

const replacement = `  const payload = {
    ...common,
    unread_count:
      input.direction === "inbound"
        ? Math.max(0, Number(existing?.unread_count || 0)) + 1
        : Math.max(0, Number(existing?.unread_count || 0)),
    last_inbound_at:
      input.direction === "inbound" ? messageAt : existing?.last_inbound_at || null,
    last_outbound_at:
      input.direction === "outbound" ? messageAt : existing?.last_outbound_at || null,
    service_window_expires_at:
      input.direction === "inbound"
        ? getWhatsAppServiceWindowExpiry(messageAt)
        : existing?.service_window_expires_at || null,
  };`;

if (source.includes(replacement)) {
  console.log("WhatsApp Phase 2B payload already prepared.");
  process.exit(0);
}

if (!source.includes(original)) {
  throw new Error(
    "WhatsApp Phase 2B payload source changed; refusing to apply an unverified build patch."
  );
}

await writeFile(target, source.replace(original, replacement), "utf8");
console.log("Prepared WhatsApp Phase 2B conversation payload for build.");
