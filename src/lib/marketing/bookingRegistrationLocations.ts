import { LEAD_ACCOUNTS } from "@/lib/marketing/leadAccountScope";
import { LeadSheetSyncError } from "@/lib/marketing/leadSheetSyncDiagnostics";

const MAX_LOCATIONS = 8;
const accountTabs = LEAD_ACCOUNTS.map(account => account.sheetTab);
export const registrationSourceTabs = [...accountTabs, "歷史 CS Leads"];

export type BookingRegistrationLocation = {
  masterRow: number;
  source?: { tab: string; row: number };
};

export class BookingRegistrationError extends LeadSheetSyncError {
  readonly locations: BookingRegistrationLocation[];

  constructor(masterRows: number[]) {
    super("bridge_registration_pending", { pendingSourceIds: masterRows.length });
    this.locations = masterRows.slice(0, MAX_LOCATIONS).map(masterRow => ({ masterRow }));
  }
}

export function bookingRegistrationMessage(total: number, locations: readonly BookingRegistrationLocation[]) {
  const cells = locations.slice(0, MAX_LOCATIONS).flatMap(({ masterRow, source }) => {
    if (!Number.isSafeInteger(masterRow) || masterRow < 2 || masterRow > 30_000) return [];
    if (source && accountTabs.includes(source.tab) && Number.isSafeInteger(source.row) && source.row >= 2 && source.row <= 10_000_000) {
      return [source.tab + "!C" + source.row];
    }
    return ["lead!C" + masterRow + "（總表）"];
  });
  if (!cells.length || !Number.isSafeInteger(total) || total < cells.length) return "預約身份登記未完成，未發布新數據。";
  const extra = total > cells.length ? "，另有 " + (total - cells.length) + " 行" : "";
  return "預約身份登記未完成，共 " + total + " 行。請核對 " + cells.join("、") + extra + " 嘅跟進狀態及系統身份登記。未發布新數據。";
}

// Match the physical Account payload against the already-validated master row.
// The Sheet truncates the first two dates to days and fills a blank Account
// from the physical tab. Keep customer cells only in memory while comparing.
function sourceDay(value: unknown) {
  if (typeof value === "number") return Math.floor(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const day = Date.parse(value.slice(0, 10) + "T00:00:00Z");
    if (Number.isFinite(day)) return day / 86_400_000 + 25_569;
  }
  return value ?? "";
}

function payload(row: unknown[], defaultAccount = "") {
  return JSON.stringify(Array.from({ length: 25 }, (_, i) => {
    if (i < 2) return sourceDay(row[i]);
    if (i === 20) return row[i] || defaultAccount;
    return row[i] ?? "";
  }));
}

export function locateBookingSources(
  locations: BookingRegistrationLocation[], original: { headers: unknown[]; rows: unknown[][] },
  currentMaster: unknown[][][], sources: unknown[][][],
) {
  if (currentMaster.length !== locations.length || sources.length !== registrationSourceTabs.length) return;
  const required = original.headers.slice(0, 25);
  if (required.length !== 25 || required[2] !== "跟進狀態" || required[20] !== "Account") return;
  const keys = locations.map(({ masterRow }, i) => {
    const row = original.rows[masterRow - 2];
    const current = currentMaster[i]?.[0];
    return row && current && payload(row) === payload(current) ? payload(row) : null;
  });
  const wanted = new Set(keys);
  const seen = new Map<string, BookingRegistrationLocation["source"]>();
  for (const [i, table] of sources.entries()) {
    const tab = registrationSourceTabs[i];
    const header = table[0] || [];
    if (!required.every((h, col) => h === header[col])) return;
    const history = tab === "歷史 CS Leads";
    const id = header.indexOf("Omni Lead ID");
    const appointment = header.indexOf("Appointment ID");
    if (!history && (id < 0 || appointment < 0)) return;
    for (let r = 1; r < table.length; r++) {
      const row = table[r];
      if (!row[1]) continue;
      const key = payload(row, history ? "" : tab);
      if (!wanted.has(key)) continue;
      // An indistinguishable history row, duplicate, or now-registered record
      // cannot identify a physical repair location. Keep the master reference.
      const blank = (value: unknown) => value === "" || value === null || value === undefined;
      const unique = !seen.has(key) && !history && blank(row[id]) && blank(row[appointment]);
      seen.set(key, unique ? { tab, row: r + 1 } : undefined);
    }
  }
  for (const [i, key] of keys.entries()) if (key) locations[i].source = seen.get(key);
}
