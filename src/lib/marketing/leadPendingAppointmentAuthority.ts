import { arrivalOutcomeAuthorityError } from "@/lib/marketing/leadArrivalOutcomeAuthority";
import type { LeadSheetLeadGroup, LeadPendingAppointment } from "@/lib/marketing/googleSheetsMetricParser";

export const PENDING_BRIDGE_HEADERS = ["Stable Source ID", "Metric Identity", "Current Master Source Row", "Verified Eligible Unique Source", "Current Appointment ID", "Exact Master Row Equality", "Metric Payload Eligible", "Source ID Unique"];
export const PENDING_REGISTRY_HEADERS = ["Appointment ID", "Lead ID", "Account", "Customer Key", "Phone Last8", "Name", "Brand", "Treatment", "Branch", "Created At", "Appointment Date", "Appointment Time", "Booking Registered At", "Registration Provenance", "State", "Outcome", "Arrival Date", "Outcome Recorded At", "Revision", "Previous Appointment ID", "Queue Entry ID", "Last Seen Status", "Last Seen Schedule", "First Seen At", "Updated At", "Last Generated Arrival Date", "Pending Queue Before"];
const validated = Symbol("validatedPendingAppointments");
type Binding = { identity: string; sourceId: string; pointer: string; eligible: boolean };
type Appointment = { leadId: string; account: string; state: string; outcome: string; date: string | null };
export type LeadPendingAppointmentAuthority = { [validated]: { bridge: Map<number, Binding>; registry: Map<string, Appointment> } };
const blank = (v: unknown) => v === undefined || v === null || v === "";
function text(v: unknown): string { if (blank(v)) return ""; if (typeof v !== "string" || /^#(?:REF!|N\/A|VALUE!|ERROR!|DIV\/0!|NAME\?|NUM!)/.test(v)) throw arrivalOutcomeAuthorityError(); return v; }
function day(v: unknown): string | null {
  if (blank(v)) return null;
  if (typeof v === "number" && Number.isInteger(v) && v >= 36526 && v <= 73415) return new Date(Date.UTC(1899,11,30) + v*86400000).toISOString().slice(0,10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "2000-01-01" && v <= "2100-12-31" && new Date(v+"T00:00:00Z").toISOString().slice(0,10) === v) return v;
  throw arrivalOutcomeAuthorityError();
}
function rows(values: unknown, headers: string[]): unknown[][] {
  if (!Array.isArray(values) || JSON.stringify(values[0]) !== JSON.stringify(headers) || !values.every(Array.isArray)) throw arrivalOutcomeAuthorityError();
  return values.slice(1).filter(r => !r.every(blank));
}
export function parseLeadPendingAppointmentAuthority(bridgeValues: unknown, registryValues: unknown): LeadPendingAppointmentAuthority {
  const bridge = new Map<number, Binding>(), registry = new Map<string, Appointment>(), sourceIds = new Set<string>();
  for (const r of rows(bridgeValues, PENDING_BRIDGE_HEADERS)) {
    if (r.length !== 8 || !Number.isSafeInteger(r[2]) || Number(r[2]) < 2 || bridge.has(Number(r[2])) || ![3,5,6,7].every(i => typeof r[i] === "boolean") || r[5] !== true || r[6] === true && (r[3] !== true || r[7] !== true)) throw arrivalOutcomeAuthorityError();
    const sourceId = text(r[0]), identity = text(r[1]), pointer = text(r[4]);
    if (r[6] && (!sourceId || sourceIds.has(sourceId))) throw arrivalOutcomeAuthorityError();
    if (r[6]) sourceIds.add(sourceId);
    bridge.set(Number(r[2]), { sourceId, identity, pointer, eligible: r[6] === true });
  }
  for (const r of rows(registryValues, PENDING_REGISTRY_HEADERS)) {
    const id=text(r[0]), leadId=text(r[1]), account=text(r[2]), state=text(r[14]), outcome=text(r[15]);
    if (r.length > 27 || !id || !leadId || !account || registry.has(id) || !["active","completed","canceled","reschedule_requested","superseded","unscheduled"].includes(state) || !["","Show","No Show"].includes(outcome)) throw arrivalOutcomeAuthorityError();
    registry.set(id, {leadId,account,state,outcome,date:day(r[10])});
  }
  return { [validated]: {bridge,registry} };
}
export function applyLeadPendingAppointmentAuthority(groups: LeadSheetLeadGroup[], authority: LeadPendingAppointmentAuthority, dimensions: ReadonlyMap<number, Pick<LeadPendingAppointment,"brandId"|"brandLabel"|"treatmentLabel">>): LeadSheetLeadGroup[] {
  const data=authority?.[validated]; if (!data) throw arrivalOutcomeAuthorityError();
  const accepted = new Set<number>();
  for (const g of groups) for (const row of g.rows) {
    const b=data.bridge.get(row.rowNumber), identity=g.accountLabel+"|"+g.key.slice(g.accountId.length+1).replace(/^phone:/,"p:").replace(/^row:/,"r:");
    if (!b?.eligible || b.identity !== identity || accepted.has(row.rowNumber)) throw arrivalOutcomeAuthorityError();
    accepted.add(row.rowNumber);
  }
  if ([...data.bridge].some(([n,b]) => b.eligible && !accepted.has(n))) throw arrivalOutcomeAuthorityError();
  return groups.map(g => {
    // Match the Sheet's current row: whole updated/created day, then later source row.
    const row=[...g.rows].sort((a,b)=>(b.lastUpdatedDate??b.createdDate??"9999-12-31").localeCompare(a.lastUpdatedDate??a.createdDate??"9999-12-31") || b.rowNumber-a.rowNumber)[0];
    const binding=data.bridge.get(row.rowNumber)!;
    const appointment=binding.pointer ? data.registry.get(binding.pointer) : undefined;
    if (binding.pointer && (!appointment || appointment.leadId !== binding.sourceId || appointment.account !== g.accountLabel)) throw arrivalOutcomeAuthorityError();
    const scheduled=appointment ? appointment.date : row.appointmentDate;
    const eligible=row.status === "booked" && (!appointment || appointment.state === "active" && appointment.outcome === "");
    const dims=dimensions.get(row.rowNumber); if (!dims) throw arrivalOutcomeAuthorityError();
    const appointmentStatus = appointment && ["canceled", "reschedule_requested"].includes(appointment.state)
      ? { ...dims, rowNumber: row.rowNumber, appointmentDate: appointment.date,
          status: appointment.state as "canceled" | "reschedule_requested" } : null;
    return { ...g, appointmentStatus, pendingRowNumber: eligible && scheduled ? row.rowNumber : null,
      pendingAppointment: eligible && scheduled ? {...dims,rowNumber:row.rowNumber,appointmentDate:scheduled} : null };
  });
}
