export type SubmissionIdentity = { id: string; fingerprint: string };
export type SubmissionBusinessFields = {
  customer_name?: string; phone?: string; email?: string; treatment_id?: string;
  package_id?: string; branch_id?: string; appointment_date?: string;
  appointment_time?: string; payment_option?: string;
};
function storageKey(formToken: string) { return `launchhub:submission:${formToken}`; }

export async function getSubmissionIdentity(
  formToken: string, business: SubmissionBusinessFields, previous: SubmissionIdentity | null
): Promise<SubmissionIdentity> {
  const encoded = new TextEncoder().encode(JSON.stringify([
    formToken, business.customer_name ?? "", business.phone ?? "", business.email ?? "",
    business.treatment_id ?? "", business.package_id ?? "", business.branch_id ?? "",
    business.appointment_date ?? "", business.appointment_time ?? "", business.payment_option ?? "",
  ]));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (previous?.fingerprint === fingerprint) return previous;
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey(formToken)) || "null") as SubmissionIdentity | null;
    if (stored?.fingerprint === fingerprint && /^[a-f0-9-]{36}$/i.test(stored.id)) return stored;
  } catch { /* Storage can be unavailable; the caller keeps the identity in memory. */ }
  const identity = { id: crypto.randomUUID(), fingerprint };
  try { sessionStorage.setItem(storageKey(formToken), JSON.stringify(identity)); } catch { /* memory fallback */ }
  return identity;
}

export function clearSubmissionIdentity(formToken: string, identity: SubmissionIdentity | null) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey(formToken)) || "null") as SubmissionIdentity | null;
    if (stored?.id === identity?.id) sessionStorage.removeItem(storageKey(formToken));
  } catch { /* best effort: no customer business fields are persisted */ }
}
