/** Selected-row identity actions. Only the native registrar can allocate IDs. */
function openOmniIdentityTools() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(oaIdentityPanelHtml_()).setTitle('補回 Lead ID／Appointment ID'));
}

function oaIdentitySelection_(ss) {
  const range = ss.getActiveRange(), list = ss.getActiveRangeList();
  if (!range || range.getNumRows() !== 1 || (list && list.getRanges().length !== 1) ||
      range.getRow() < 2 || !OMNI_ACCOUNT_TABS.includes(range.getSheet().getName())) {
    throw new Error('請喺 Account 分頁揀一行客戶紀錄。');
  }
  const sheet = range.getSheet(), row = range.getRow(), account = sheet.getName();
  const meta = oa2Meta_(sheet, false), columns = getOmniColumns_(sheet);
  const values = sheet.getRange(row, 1, 1, meta + OA2.ACCOUNT_HEADERS.length - 1).getValues()[0];
  const record = oa2Record_(values, row, sheet, columns, meta, account);
  if (!record.meaningful) throw new Error(account + ' 第 ' + row + ' 行未有 Lead 資料。');
  const tag = oa2Hash_(JSON.stringify([sheet.getSheetId(), row, values.slice(0, meta - 1)]));
  return {sheet, record, view: {tag, account, row, lead: !!record.leadId, appointment: !!record.appointmentId,
    booked: oa2Status_(record.status) === 'booked', leadCell: columnLetter_(meta) + row,
    appointmentCell: columnLetter_(meta + 1) + row}};
}

function getOmniIdentitySelection() {
  return oaIdentitySelection_(oa2Spreadsheet_()).view;
}

function oaSelectedIdentityReview_(r, registry, queue) {
  const appointments = Object.values(registry.appointments);
  if (r.leadId && !r.appointmentId && appointments.filter(a => a.leadId === r.leadId).length > 1)
    return '呢個 Lead 有多筆歷史預約，請核對原本嘅 Appointment ID。';
  if (r.leadId || r.appointmentId || r.pendingSnapshot) return '';
  if (r.customerKey && (appointments.some(a => a.customerKey === r.customerKey && a.account === r.account) ||
      queue.some(q => q.customerKey === r.customerKey && q.account === r.account)))
    return '同一客戶已有預約，請核對原有 ID，再連返正確紀錄。';
  return '';
}

function oaSelectedArrival_(ss, r) {
  if (!r.leadId || !r.appointmentId || r.pendingSnapshot) return 0;
  const names = OMNI_ACCOUNT_TABS.concat([OA2.LEDGER, OA2.ARRIVAL]);
  const ranges = names.map((name, i) => "'" + name + "'!" + (i === names.length - 1 ? '7:7' : '1:1'));
  const read = ranges => Sheets.Spreadsheets.Values.batchGet(ss.getId(), {
    ranges, valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER'
  }).valueRanges.map(v => v.values || []);
  const headers = read(ranges);
  const fields = names.map((name, i) => i < OMNI_ACCOUNT_TABS.length ? ['Omni Lead ID', 'Appointment ID'] :
    name === OA2.LEDGER ? ['Appointment ID','Lead ID','Account','Customer Key','Queue Entry ID'] :
    ['Appointment ID','Omni Lead ID','Account','穩定客戶識別（內部）','到店紀錄ID（內部）','Record Origin']);
  const indices = fields.map((labels, i) => labels.map(label => {
    const header = headers[i][0] || [], index = header.indexOf(label);
    if (index < 0 || index !== header.lastIndexOf(label)) throw new Error('Identity lookup header mismatch');
    return index;
  }));
  const starts = indices.map(cols => Math.min(...cols));
  const data = read(names.map((name, i) => "'" + name + "'!" + columnLetter_(starts[i] + 1) +
    (name === OA2.ARRIVAL ? OA2.FIRST_ROW : 2) + ':' + columnLetter_(Math.max(...indices[i]) + 1)));
  const rows = data.map((values, i) => values.map(row => indices[i].map(col => row[col - starts[i]])));
  const owners = [];
  OMNI_ACCOUNT_TABS.forEach((account, index) => rows[index].forEach(([lead, appt], j) => {
    if (lead === r.leadId || appt === r.appointmentId) owners.push({account, row:j+2, lead, appt});
  }));
  if (owners.length !== 1 || owners[0].account !== r.account || owners[0].row !== r.row ||
      owners[0].lead !== r.leadId || owners[0].appt !== r.appointmentId) return 0;
  const registry = rows[OMNI_ACCOUNT_TABS.length].filter(a => a[0] === r.appointmentId);
  if (registry.length !== 1) return 0;
  const [,lead,account,key,entry] = registry[0];
  if (lead !== r.leadId || account !== r.account || key !== r.customerKey || !entry) return 0;
  const queue = rows[names.length - 1].map((v, i) => ({v, row: OA2.FIRST_ROW + i}))
    .filter(q => q.v[0] === r.appointmentId || q.v[4] === entry);
  if (queue.length !== 1) return 0;
  const q = queue[0], [appt, owner, source, customer, queueId, origin] = q.v;
  if (appt === r.appointmentId && owner === lead && origin === 'allocating' && (!queueId || queueId === entry)) return -1;
  return appt === r.appointmentId && owner === lead && source === account && customer === key &&
    queueId === entry && origin === 'managed' ? q.row : 0;
}

function applyOmniIdentityAction(action, tag) {
  if (!['lead', 'appointment', 'arrival'].includes(action)) throw new Error('請重新選擇功能。');
  const ss = oa2Spreadsheet_(), lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return {busy: true, error: '試算表正在處理其他編輯，請稍後再撳。'};
  let where = '';
  try {
    const selected = oaIdentitySelection_(ss), r = selected.record, v = selected.view;
    where = v.account + '!' + (action === 'lead' ? v.leadCell : v.appointmentCell);
    if (tag !== v.tag) return {error: where + ' 選取位置或資料已變，請重新讀取所選行。'};
    if (action === 'appointment' && !v.booked && !r.appointmentId)
      return {error: where + ' 請先核對 C 欄跟進狀態；標記「已預約」後先可以登記預約。'};
    // A timed-out allocation can leave both source IDs before the queue payload is committed.
    const existingArrival = oaSelectedArrival_(ss, r);
    const needsRepair = action !== 'arrival' && (existingArrival === -1 || !!r.pendingSnapshot || !v.lead ||
      (!v.appointment && (action === 'appointment' || v.booked)));
    if (needsRepair) {
      oa2HistoryStart_(ss.getSheetByName(OA2.HISTORY));
      const queue = oa3ManualQueueSnapshot_(ss.getSheetByName(OA2.ARRIVAL));
      const review = oaSelectedIdentityReview_(r, oa2ReadRegistry_(ss), queue);
      if (review) return {error: where + ' ' + review};
      if (!r.leadId && !r.appointmentId && !r.pendingSnapshot && r.customerKey && v.booked) {
        const journal = ss.getSheetByName(OA2.HISTORY);
        if (journal.getLastRow() > 1 && journal.getRange(2, 6, journal.getLastRow() - 1, 2)
          .createTextFinder(JSON.stringify(r.customerKey)).useRegularExpression(false).matchCase(true).findNext())
          return {error: where + ' 呢個客戶喺預約歷程有紀錄，請核對原有 ID。'};
      }
      const result = oa2PrioritizeSourceIdentities_(ss, lock, {accountNames: [r.account], startAccountIndex: OMNI_ACCOUNT_TABS.indexOf(r.account),
        firstRow: r.row, lastRow: r.row, maxAccounts: 1, maxIdentityBatch: 1, manualRequested: true, bookingMutation: false, deferDisplay: true,
        recoverPendingAllocations: !!r.appointmentId && queue.some(q => q.appointmentId === r.appointmentId && q.origin === 'allocating'),
        expectedSource: (snap, candidate) => candidate.row === r.row && snap.sheet.getSheetId() === selected.sheet.getSheetId() &&
          oa2Hash_(JSON.stringify([snap.sheet.getSheetId(), candidate.row, snap.values[candidate.row - 2].slice(0, snap.meta - 1)])) === tag});
      if (result.reviewReasons.includes('selection_changed')) return {error: where + ' 來源行已變，請重新讀取所選行。'};
      if (result.blocked || result.review || result.accountFailures.length)
        return {error: where + ' ' + oa2IdentityReviewMessage_(result.reviewReasons[0]) + '。'};
    }
    const after = oaIdentitySelection_(ss);
    if (after.view.tag !== tag) return {error: where + ' 選取位置或資料已變，請重新讀取所選行。'};
    const ready = after.view.lead && (!after.view.booked || after.view.appointment);
    const arrivalRow = needsRepair ? oaSelectedArrival_(ss, after.record) : existingArrival;
    if (action === 'arrival' || after.view.appointment || after.view.booked) {
      if (arrivalRow <= 0) return {error: where + ' 未能唯一配對來源、預約登記同到店紀錄，請核對 Z、AA 及原有到店紀錄。'};
    }
    if (!ready) return {error: where + ' 身份登記未完成，請核對來源行。'};
    if (action === 'arrival') {
      const arrival = ss.getSheetByName(OA2.ARRIVAL), layout = oa2QueueLayout_(arrival, false);
      const check = oa2QueueRange_(arrival, layout, arrivalRow, 20, 1, 5).getValues()[0];
      if (check[0] !== after.record.appointmentId || check[4] !== after.record.leadId)
        return {error: where + ' 到店紀錄位置已變，請再核對。'};
      ss.setActiveSheet(arrival);
      arrival.getRange(arrivalRow, 3).activate();
    }
    return {view: after.view, arrivalRow, message: where + (arrivalRow ? ' 已核實配對到「到店紀錄」第 ' + arrivalRow + ' 行。' : ' 已有 Omni Lead ID。')};
  } catch (e) {
    if (!where) throw e;
    const reason = /checkpoint cursor exceeds journal/.test(String(e)) ? '預約歷程有缺口，請先核對歷程版本。' : '未能完成核對，請重新讀取所選行再試。';
    return {error: where + ' ' + reason};
  } finally { lock.releaseLock(); }
}

function oaIdentityPanelHtml_() {
  return `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:20px 16px;color:#22342f;font:14px/1.55 system-ui,sans-serif}
  p{margin:8px 0 15px}button{font:inherit;cursor:pointer;border:1px solid #91aaa2;background:white;color:#174f40;border-radius:7px;padding:8px 12px;margin:4px 0}
  button:focus-visible{outline:3px solid #358774}button:disabled{cursor:default;opacity:.55}
  .card{border-top:1px solid #d6dfdb;padding:12px 0}.card button{display:block;width:100%;background:#175b47;color:white;border:none}
  small{display:block;color:#485c54}#status{white-space:pre-wrap}h3{margin:0;font-size:16px}</style></head><body>
  <h3 id="loc">所選行</h3><button id="refresh">讀取所選行</button>
  <div class="card"><strong>Omni Lead ID</strong><small id="leadState">—</small><button id="lead" disabled>補回 Omni Lead ID</button></div>
  <div class="card"><strong>Appointment ID</strong><small id="apptState">—</small><button id="appointment" disabled>補回 Appointment ID</button></div>
  <button id="arrival" disabled>開啟到店紀錄</button><p id="status" role="status" aria-live="polite"></p>
  <script>
  const el=id=>document.getElementById(id);let view=null;
  function busy(){['refresh','lead','appointment','arrival'].forEach(id=>el(id).disabled=true);}
  function render(v){view=v;el('refresh').disabled=false;if(!v)return;
    el('loc').textContent=v.account+' · 第 '+v.row+' 行';
    el('leadState').textContent=v.leadCell+' · '+(v.lead?'已有 ID':'待補');
    el('apptState').textContent=v.appointmentCell+' · '+(v.appointment?'已有 ID':v.booked?'待補':'未有已預約狀態');
    el('lead').disabled=false;el('appointment').disabled=!v.booked&&!v.appointment;el('arrival').disabled=!v.lead||!v.appointment;}
  function fail(e){busy();view=null;el('refresh').disabled=false;el('status').textContent=e.message||e;}
  function refresh(){busy();el('status').textContent='讀取中…';google.script.run.withFailureHandler(fail).withSuccessHandler(v=>{render(v);el('status').textContent='';}).getOmniIdentitySelection();}
  function apply(action,retry=true){if(!view)return;busy();el('status').textContent='正在核對 '+view.account+' 第 '+view.row+' 行…';
    google.script.run.withFailureHandler(fail).withSuccessHandler(r=>{if(r.busy){if(retry){el('status').textContent='等候其他編輯完成…';setTimeout(()=>apply(action,false),1500);}else{render(view);el('status').textContent=r.error;}return;}if(r.error){fail(r.error);return;}render(r.view);el('status').textContent=r.message;if(action==='arrival')google.script.host.close();}).applyOmniIdentityAction(action,view.tag);}
  el('refresh').onclick=refresh;['lead','appointment','arrival'].forEach(id=>el(id).onclick=()=>apply(id));refresh();
  </script></body></html>`;
}
