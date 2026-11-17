// Uses the existing managed GitHub secret; prints only scoped verification.
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const ref = process.env.SUPABASE_PROJECT_REF?.trim();
if (!token || ref !== "zklufiemgvtrofhdmecm") throw new Error("Expected existing Marketing OS project configuration.");
const endpoint = `https://api.supabase.com/v1/projects/${ref}`;
async function request(init = {}) {
  const response = await fetch(endpoint, { ...init, signal: AbortSignal.timeout(20000), headers: {
    Authorization: `Bearer ${token}`, "Content-Type": "application/json",
  } });
  if (!response.ok) throw new Error(`Project settings request failed (${response.status}).`);
  return response.json();
}
const before = await request();
if (before.id !== ref || before.organization_id !== "uottulobzmlxijkrskgj") throw new Error("Unexpected project target.");
if (before.name !== "marketing-os") await request({ method: "PATCH", body: JSON.stringify({ name: "marketing-os" }) });
const after = await request();
if (after.id !== before.id || after.name !== "marketing-os" || after.organization_id !== before.organization_id) throw new Error("Project rename readback did not match.");
console.log(JSON.stringify({ verified: true, name: after.name, sameProject: true, sameOrganization: true }));
