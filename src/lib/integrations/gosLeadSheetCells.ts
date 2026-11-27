// Native cell types keep date validation, calendar ordering and leading phone digits intact.
export function gosLeadSheetCells(headers: string[], values: string[], allowEmptyPhone = false) {
  return headers.map((rawHeader, index) => {
    const header = rawHeader.trim().toLowerCase();
    const value = values[index] ?? "";
    const appointment = header === "預約日期" || header === "確認到店日期";
    if (appointment || header === "created at" || header === "最後更新日期") {
      const format = { numberFormat: { type: "DATE", pattern: appointment ? "dd/mm/yyyy" : "yyyy-mm-dd" } };
      if (!value) return { userEnteredFormat: format };
      const timestamp = Date.parse(value + "T00:00:00Z");
      if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
        throw new Error("Invalid lead sheet calendar date");
      }
      const serial = (timestamp - Date.UTC(1899, 11, 30)) / 86400000;
      return { userEnteredValue: { numberValue: serial }, userEnteredFormat: format };
    }
    if (header === "預約時間") {
      const format = { numberFormat: { type: "TIME", pattern: "hh:mm" } };
      if (!value) return { userEnteredFormat: format };
      const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
      if (!match) throw new Error("Invalid lead sheet appointment time");
      const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
      return { userEnteredValue: { numberValue: seconds / 86400 }, userEnteredFormat: format };
    }
    if (header === "電話") {
      if (!value && allowEmptyPhone) return {};
      const digits = value.replace(/\D/g, "");
      if (!/^\d{8,15}$/.test(digits)) throw new Error("Invalid lead sheet phone");
      return { userEnteredValue: { stringValue: digits }, userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" } } };
    }
    return value ? { userEnteredValue: { stringValue: value } } : {};
  });
}
