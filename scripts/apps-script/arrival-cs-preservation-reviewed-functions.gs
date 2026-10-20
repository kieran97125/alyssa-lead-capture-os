/** Reviewed replacement-function snapshot; replace matching bound definitions.
 * Do not add this file alongside existing definitions in a live Apps Script project.
 * No installer, trigger creation, permission change or production data appears here.
 */
function oa2CsText_(value) {
  return typeof value === 'string' ? value.replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ') : '';
}
function oa2CsId_(value) {
  const id = oa2CsText_(value);
  return id && !/^[#=]/.test(id) ? id : '';
}
function oa2CsAccount_(value) {
  return oa2CsText_(value);
}
/** A recognized Account tab owns its records even when its redundant Account cell is empty.
 * Nonempty mismatches and malformed values remain rejected. History never uses
 * this fallback; its row-level Account is still mandatory.
 */
function oa2CsCustomerKey_(source) {
  const fields = [source.phone, source.email, source.social];
  if (fields.some(v => v !== null && v !== undefined && v !== '' &&
      !['string','number'].includes(typeof v))) return '';
  const texts = fields.map(v => String(v == null ? '' : v).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim());
  if (texts.some(v => /^[#=]/.test(v))) return '';
  const digits = texts[0].replace(/\D/g,''), account = oa2CsAccount_(source.account);
  if (!account) return '';
  return digits.length >= 8 ? account + '|p:' + digits.slice(-8) :
    texts[1] ? account + '|e:' + texts[1].toLowerCase() :
    texts[2] ? account + '|i:' + texts[2].toLowerCase() : '';
}
function oa2CsDisplay_(value) {
  if (value === '' || value === null || value === undefined) return OA2_CS.EMPTY;
  if (typeof value !== 'string') return OA2_CS.REVIEW;
  const name = oa2CsText_(value);
  if (!name) return OA2_CS.EMPTY;
  // A formula error or executable value must never become a colleague's name.
  return /^[#=]/.test(name) ? OA2_CS.REVIEW : name;
}
function oa2CsIndexBy_(rows, key) {
  const index = new Map();
  rows.forEach(row => { const id = oa2CsId_(row[key]); if (!id) return; const matches = index.get(id) || []; matches.push(row); index.set(id, matches); });
  return index;
}
function oa2CsOnly_(index, id) {
  const matches = index.get(oa2CsId_(id));
  return matches && matches.length === 1 ? matches[0] : null;
}

/** Pure: accepts normalized records from the bounded, header-resolved adapter. */
function oa2BuildQueueCsIndex_(input) {
  return {
    sources: oa2CsIndexBy_(input.sources, 'id'),
    sourceIds: oa2CsIndexBy_(input.sourceIds, 'id'),
    aliases: oa2CsIndexBy_(input.aliases, 'queueId'),
    appointments: oa2CsIndexBy_(input.appointments, 'id'),
    registryQueueIds: oa2CsIndexBy_(input.appointments, 'queueId'),
    queueIds: oa2CsIndexBy_(input.queue, 'entryId'),
    queueAppointments: oa2CsIndexBy_(input.queue, 'appointmentId'),
  };
}
/** Pure: no row-number, name, phone-tail or nearest-match fallback. */
function oa2EvaluateQueueCs_(queue, index) {
  const fail = reason => ({value: OA2_CS.REVIEW, reason});
  if (queue.blank) return {value:'', reason:'blank_queue'};
  const account = oa2CsAccount_(queue.account), appointment = oa2CsOnly_(index.appointments, queue.appointmentId);
  if (!appointment || !oa2CsId_(queue.entryId) || !oa2CsId_(queue.leadId) || !account ||
      !oa2CsOnly_(index.registryQueueIds, queue.entryId) || !oa2CsOnly_(index.queueIds, queue.entryId) ||
      !oa2CsOnly_(index.queueAppointments, queue.appointmentId)) return fail('missing_or_ambiguous_binding');
  if (oa2CsId_(appointment.queueId) !== oa2CsId_(queue.entryId) ||
      oa2CsId_(appointment.leadId) !== oa2CsId_(queue.leadId) ||
      oa2CsAccount_(appointment.account) !== account) return fail('registry_queue_mismatch');
  if (!['managed','legacy_show'].includes(queue.origin)) return fail('unfinished_or_unknown_origin');
  const legacy = appointment.provenance === 'legacy_show';
  if (legacy !== (queue.origin === 'legacy_show')) return fail('origin_provenance_mismatch');
  let sourceId = oa2CsId_(appointment.leadId), alias = null;
  if (legacy) {
    alias = oa2CsOnly_(index.aliases, appointment.queueId);
    if (!alias || !oa2CsId_(alias.sourceId)) return fail('invalid_or_ambiguous_alias');
    sourceId = oa2CsId_(alias.sourceId);
  }
  const source = oa2CsOnly_(index.sources, sourceId);
  if (!source || !oa2CsOnly_(index.sourceIds, sourceId) || oa2CsAccount_(source.account) !== account) return fail('missing_ambiguous_or_mismatched_source');
  if (alias) {
    const frozen = oa2Date_(alias.created), created = oa2Date_(source.created), key = oa2CsCustomerKey_(source);
    if (!frozen || frozen !== created || !key || key !== oa2CsId_(appointment.customerKey) ||
        key !== oa2CsId_(queue.customerKey)) return fail('stale_or_mismatched_legacy_identity');
  }
  const value = oa2CsDisplay_(source.cs);
  return {value, reason:value === OA2_CS.REVIEW ? 'invalid_cs_value' : value === OA2_CS.EMPTY ? 'verified_blank_cs' : 'verified_cs'};
}

function oa2CsQueueFingerprint_(queue) {
  return JSON.stringify(queue.map(q => [q.row, q.blank, q.appointmentId, q.entryId,
    q.leadId, q.account, q.origin, q.customerKey]));
}
function oa2CsInScope_(queue, index, options) {
  if (queue.blank) return false;
  const appointment = oa2CsOnly_(index.appointments, queue.appointmentId);
  let sourceId = appointment && oa2CsId_(appointment.leadId);
  if (appointment && appointment.provenance === 'legacy_show') {
    const alias = oa2CsOnly_(index.aliases, appointment.queueId);
    sourceId = alias && oa2CsId_(alias.sourceId);
  }
  if (sourceId && sourceId.indexOf('history:') === 0) return !!options.includeHistory;
  return options.accountNames.includes(oa2CsAccount_(queue.account));
}

/**
 * Existing timer: {accountNames:[selectedAccount], includeHistory:index===0,
 * documentLock:lock}. Existing CS-only edit: one Account, includeHistory:false.
 * History CS-only edit: accountNames:[], includeHistory:true, without waiting.
 * Initial migration alone may pass all six Accounts plus includeHistory:true.
 * Historical queue entries are included independently of queue operation filters.
 */
function oa2RefreshQueueCs_(ss, options) {
  options = options || {};
  if (!options.documentLock || !options.documentLock.hasLock()) throw new Error('CS projection requires the existing document lock.');
  if (!Array.isArray(options.accountNames) || (!options.accountNames.length && options.includeHistory !== true) ||
      options.accountNames.some(name => !OMNI_ACCOUNT_TABS.includes(name)) ||
      new Set(options.accountNames).size !== options.accountNames.length) throw new Error('CS projection requires explicit unique Account scope.');
  if (options.accountNames.length > 1 && options.initialRefresh !== true) throw new Error('All-Account CS refresh is reserved for explicit initial migration.');
  const sheet = ss.getSheetByName(OA2.ARRIVAL);
  if (!sheet) throw new Error('CS projection: arrival sheet missing.');
  const headers = oa2Header_(sheet, OA2.HEADER_ROW), matches = headers.filter(header => header === OA2_CS.HEADER);
  if (!matches.length) return {refreshed:0, skipped:'cs_column_not_installed'};
  if (matches.length !== 1 || headers[OA2_CS.COLUMN - 1] !== OA2_CS.HEADER) throw new Error('CS projection: CS header is not uniquely installed in B.');
  const capture = oa2CsCapture_(ss, options), queue = oa2CsQueue_(ss);
  if (!queue.length) return {refreshed:0, changed:0};
  const before = sheet.getRange(OA2.FIRST_ROW, OA2_CS.COLUMN, queue.length, 1).getValues();
  const index = oa2BuildQueueCsIndex_(Object.assign({}, capture, {queue})), output = before.map(row => row.slice());
  const summary = {refreshed:0, changed:0, named:0, unfilled:0, review:0, preserved:0, dryRun:!!options.dryRun};
  queue.forEach((q,i) => {
    if (!oa2CsInScope_(q, index, options)) return;
    // A colleague-owned CS entry is persistent appointment data, not a live source projection.
    // Automatic synchronization may populate an empty cell but never reassign an occupied one.
    if (before[i][0] !== '' && before[i][0] !== null && before[i][0] !== undefined) { summary.preserved++; return; }
    const result = oa2EvaluateQueueCs_(q, index); output[i][0] = result.value; summary.refreshed++;
    if (result.value === OA2_CS.EMPTY) summary.unfilled++;
    else if (result.value === OA2_CS.REVIEW) summary.review++;
    else if (result.value) summary.named++;
    if (before[i][0] !== result.value) summary.changed++;
  });
  if (options.dryRun || !summary.changed) return summary;
  // Cooperative writers use the same lock. Sheets user edits can still happen;
  // reject all observable source/alias/registry and queue changes before writing.
  const fresh = oa2CsCapture_(ss, options);
  if (fresh.fingerprint !== capture.fingerprint) throw new Error('CS projection sources or identity guards changed; safe retry required.');
  if (oa2CsQueueFingerprint_(oa2CsQueue_(ss)) !== oa2CsQueueFingerprint_(queue)) throw new Error('CS projection queue binding changed; safe retry required.');
  const freshHeaders = oa2Header_(sheet, OA2.HEADER_ROW);
  if (JSON.stringify(freshHeaders) !== JSON.stringify(headers)) throw new Error('CS projection queue layout changed; safe retry required.');
  const range = sheet.getRange(OA2.FIRST_ROW, OA2_CS.COLUMN, queue.length, 1);
  if (JSON.stringify(range.getValues()) !== JSON.stringify(before)) throw new Error('CS projection output changed; safe retry required.');
  const changedRows=output.flatMap((values,i)=>before[i][0]!==values[0]?[{row:OA2.FIRST_ROW+i,values}]:[]);
  oa2RowGroups_(changedRows).forEach(group=>{
    const target=sheet.getRange(group[0].row,OA2_CS.COLUMN,group.length,1),freshValues=target.getValues();
    group.forEach((item,i)=>{if(JSON.stringify(freshValues[i])!==JSON.stringify(before[item.row-OA2.FIRST_ROW]))throw new Error('CS entry changed during blank-cell allocation; preserving colleague input.');});
    target.setValues(group.map(item=>item.values));
  });
  return summary;
}


/** CS failure cannot turn an already completed booking into an apparent failure.
 * The warning contains no customer identifiers and makes a stale refresh explicit.
 */
/** No Spreadsheet reads until the existing migration receipt proves installation.
 * Document properties are scoped to this bound workbook. The projection still
 * validates its live header and all source/binding guards after activation.
 * A partial migration, rollback or unreadable receipt never starts a projection.
 */