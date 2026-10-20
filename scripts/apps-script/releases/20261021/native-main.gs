/**
 * Alyssa Omni Account Lead Sheet — header-resolved automation v1.6
 *
 * Supports the legacy 24-column, CS-owner 25-column, and reordered lead.v6
 * operational layouts by resolving fields from row 1 on each execution.
 * Existing tab names, custom menus, trigger handlers, and event-ledger schema
 * are preserved. No installer rewrites lead headers, master formulas, dashboard
 * formulas, data validation, or conditional formatting.
 *
 * Rules:
 * - 同事只修改 Account 分頁；lead 係自動總表。
 * - 跟進狀態改動 -> 最後更新日期寫入當日日期。
 * - Created At 第一次建立 Lead 時寫入當日日期，之後不改。
 * - 確認到店日期保留同事輸入；改狀態不覆寫到店日期。
 * - Account 以分頁名稱寫入；療程 / 優惠按規則補療程項目及品牌。
 * - Book / Show / No Show 事件寫入 hidden _funnel_events（audit only）。
 * - 日期顯示 yyyy-mm-dd；預約時間保留 hh:mm。
 * - Sorting includes trailing provenance columns so metadata stays with its row.
 *
 * This bound automation is not an Apps Script webhook: it has no doPost handler.
 */

const OMNI_ACCOUNT_TABS = [
  'Alyssa Main',
  'Alyssa Medical',
  'Alyssa Aesthetics',
  'GOS Beauty',
  'Ineffable',
  'Skin Light',
];

const OMNI_MASTER_SHEET = 'lead';
const OMNI_TREATMENT_SHEET = '療程項目';
const OMNI_EVENT_SHEET = '_funnel_events';
// Retired audit-only producer. Existing timer invocations return before any service access.
// Preserve the historical ledger and archived producer code for explicit rollback.
const OMNI_LEGACY_EVENT_CAPTURE_ENABLED = false;
const OMNI_INSTALLABLE_EDIT_PROP = 'OMNI_ACCOUNT_INSTALLABLE_EDIT_ACTIVE';

const OMNI_HEADERS = [
  '最後更新日期','Created At','跟進狀態','CS同事名','品牌','預約日期','預約時間',
  '確認到店日期','客人姓名','電話','療程 / 優惠','療程項目','分店','Email',
  'Campaign / 廣告','最後跟進時間','CS Remark','Remark(後續跟進情況)','Status',
  'Show up','Account','IG/FB Username','Day 1','Day 2','Promotion'
];

const EVENT_HEADERS = [
  'Event ID','Event At','Event Date','Event Type','lead_key','Brand','Phone Last8',
  'Source Row','Status Before','Status After','Created At','Treatment','Source',
  'Campaign','Branch','Account'
];

const OMNI_FIELD_HEADERS = {
  LAST_UPDATED: '最後更新日期', CREATED_AT: 'Created At', STATUS: '跟進狀態',
  CS_OWNER: 'CS同事名', BRAND: '品牌', BRANCH: '分店', NAME: '客人姓名',
  PHONE: '電話', EMAIL: 'Email', OFFER: '療程 / 優惠', TREATMENT: '療程項目',
  APPOINTMENT_DATE: '預約日期', APPOINTMENT_TIME: '預約時間', SHOW_DATE: '確認到店日期',
  CAMPAIGN: 'Campaign / 廣告', LAST_FOLLOWUP: '最後跟進時間', CS_REMARK: 'CS Remark',
  FOLLOWUP_REMARK: 'Remark(後續跟進情況)', LEGACY_STATUS: 'Status', LEGACY_SHOW: 'Show up',
  ACCOUNT: 'Account', SOCIAL_USERNAME: 'IG/FB Username', DAY1: 'Day 1', DAY2: 'Day 2',
  PROMOTION: 'Promotion',
};

// Resolve once per tab/batch; never keep a cache across column migrations.
function getOmniColumns_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(clean_);
  const columns = {};
  const problems = [];
  Object.keys(OMNI_FIELD_HEADERS).forEach(key => {
    const label = OMNI_FIELD_HEADERS[key];
    const matches = [];
    headers.forEach((header, index) => { if (header === label) matches.push(index + 1); });
    // The original A:X layout predates CS owner. No automation writes that field.
    if (!matches.length && key === 'CS_OWNER') return;
    if (matches.length !== 1) problems.push(`${label}: ${matches.length ? '重複欄名' : '缺少欄名'}`);
    else columns[key] = matches[0];
  });
  if (problems.length) throw new Error(`${sheet.getName()} header contract 不符：${problems.join('；')}`);
  return columns;
}

function leadDataWidth_(columns) {
  return Math.max(...Object.keys(columns).map(key => columns[key]));
}

const DEFAULT_BRAND_BY_ACCOUNT = {
  'Alyssa Main': 'Alyssa',
  'Alyssa Medical': 'Alyssa Medical',
  'Alyssa Aesthetics': 'Alyssa Aesthetics',
  'GOS Beauty': 'GOS Beauty',
  'Ineffable': 'Ineffable Beauty',
  'Skin Light': 'Skin Light',
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CS 工具')
    .addItem('搜尋電話移到底部', 'searchOmniPhoneToBottom')
    .addItem('新建另一次預約（保留歷史）', 'createAnotherOmniAppointmentV2')
    .addItem('到店流程檢查（唯讀）', 'showOmniArrivalCheck')
    .addItem('手動同步已預約', 'syncAllBookedArrivals')
    .addToUi();
}

function showOmniArrivalCheck() {
  const result = verifyOmniArrivalV2();
  const state = result.enabled ? '已啟用' : '未啟用';
  const message = result.issues.length
    ? '到店流程：' + state + '\n待處理：\n' + result.issues.join('\n')
    : '到店流程：' + state + '\n檢查完成，未發現設定問題。';
  SpreadsheetApp.getUi().alert(message);
  return result;
}

/** CS search stays in the active Account tab and never creates an activity event. */
function searchOmniPhoneToBottom() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const originalSheet = ss.getActiveSheet();
  if (!originalSheet || !OMNI_ACCOUNT_TABS.includes(originalSheet.getName())) {
    ui.alert('請先開啟要更新的 Account 分頁，再搜尋電話。');
    return;
  }
  const originalId = originalSheet.getSheetId();
  // A prompt suspends the script and discards locks. Acquire only after it closes.
  const response = ui.prompt('搜尋電話移到底部',
    `只搜尋「${originalSheet.getName()}」。輸入電話或電話尾 8 位；同一電話的所有紀錄會按原有次序移到資料底部。`,
    ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const input = response.getResponseText().trim();
  const phone = last8_(input);
  if (!phone || !/^\+?[\d\s().-]+$/.test(input) || input.replace(/\D/g, '').length > 15) {
    ui.alert('請輸入有效電話，至少 8 位數字；可包含 +852、空格或連字號。');
    return;
  }
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) {
    ui.alert('目前有其他更新正在處理，請稍後再搜尋。');
    return;
  }
  let result;
  let error;
  try {
    const sheet = ss.getActiveSheet();
    if (!sheet || sheet.getSheetId() !== originalId) {
      throw new Error('搜尋期間已切換分頁，請在目標 Account 分頁重新搜尋。');
    }
    result = moveOmniPhoneRowsToBottom_(sheet, phone);
    if (result.count) {
      SpreadsheetApp.flush();
      sheet.getRange(result.firstRow, 1, result.count, sheet.getLastColumn()).activate();
      ss.toast(`已找到 ${result.count} 筆，位於第 ${result.firstRow}–${result.lastRow} 行。日期及狀態保留；如有篩選，請確認結果未被隱藏。`,
        result.moves ? '已移到資料底部' : '紀錄已在資料底部', 10);
    }
  } catch (caught) {
    error = String(caught.message || caught);
  } finally {
    lock.releaseLock();
  }
  // Never suspend execution with an alert while holding the document lock.
  if (error) ui.alert(`未能完成搜尋：${error}`);
  else if (!result.count) ui.alert('目前分頁找不到這個電話，資料未有改動。');
  return result;
}

function moveOmniPhoneRowsToBottom_(sheet, phone) {
  if (!OMNI_ACCOUNT_TABS.includes(sheet.getName())) throw new Error('只可操作 Account 分頁。');
  if (!/^\d{8}$/.test(phone)) throw new Error('電話尾 8 位格式不正確。');
  const columns = getOmniColumns_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { count: 0, moves: 0 };
  const matches = sheet.getRange(2, columns.PHONE, lastRow - 1, 1)
    .getDisplayValues().map(row => last8_(row[0]) === phone);
  const count = matches.filter(Boolean).length;
  if (!count) return { count: 0, moves: 0 };
  const firstRow = lastRow - count + 1;
  const result = { count, firstRow, lastRow, moves: 0 };
  if (matches.slice(matches.length - count).every(Boolean)) return result;

  // Structural moveRows rewrites external ranges (including the master/cache),
  // so use a native whole-record sort. Unique keys make both groups stable.
  // The temporary column is beyond ALL existing columns, including hidden data.
  const temporaryColumn = sheet.getMaxColumns() + 1;
  sheet.insertColumnsAfter(temporaryColumn - 1, 1);
  try {
    const keys = matches.map((match, index) => [index + (match ? matches.length : 0)]);
    sheet.getRange(2, temporaryColumn, matches.length, 1).setValues(keys);
    sheet.getRange(2, 1, matches.length, temporaryColumn)
      .sort([{ column: temporaryColumn, ascending: true }]);
    result.moves = 1;
  } finally {
    sheet.deleteColumn(temporaryColumn);
  }
  return result;
}

function installOmniLeadAutomation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Asia/Hong_Kong');

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onOmniLeadInstallableEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onOmniLeadInstallableEdit').forSpreadsheet(ss).onEdit().create();
  PropertiesService.getScriptProperties().setProperty(OMNI_INSTALLABLE_EDIT_PROP, '1');

  applyOmniDateFormats_(false);
  if (OMNI_LEGACY_EVENT_CAPTURE_ENABLED) ensureEventSheet_();
  const result = verifyOmniLeadSetup();
  SpreadsheetApp.getUi().alert(result.ok ? 'Account Lead 自動化已安裝。' : '已安裝，但檢查到問題，請睇 Execution log。');
  return result;
}

function onEdit(e) {
  if (PropertiesService.getScriptProperties().getProperty(OMNI_INSTALLABLE_EDIT_PROP) === '1') return;
  handleOmniLeadEdit_(e);
}

function onOmniLeadInstallableEdit(e) {
  handleOmniLeadEdit_(e);
}

// Log phase names and durations only: never log cell values, IDs or Account names.
// An Apps Script Spreadsheet call cannot be interrupted here; the start record
// identifies the outstanding provider call if execution is terminated later.
function omniEditStage_(trace, stage, action) {
  if (!trace) return action();
  const started = Date.now();
  console.log(JSON.stringify({handler:'omni_edit',stage,state:'start',elapsedMs:started-trace.started}));
  try {
    const result = action();
    console.log(JSON.stringify({handler:'omni_edit',stage,state:'complete',durationMs:Date.now()-started}));
    return result;
  } catch (error) {
    console.log(JSON.stringify({handler:'omni_edit',stage,state:'failed',durationMs:Date.now()-started,reason:omniCaptureTimeout_(error)?'spreadsheet_timeout':'operation_failed'}));
    throw error;
  }
}

function handleOmniLeadEdit_(e) {
  if (!e || !e.range) return;
  omniMarkStaffPriority_();
  const trace = {started:Date.now()};
  // Metadata-only preflight must not occupy the document lock during a slow
  // provider name lookup. Never read cells, resolve headers or write here.
  // Re-read the event sheet/name after admission below; preflight is not an
  // authoritative binding and cannot route a later renamed sheet's writes.
  const preflightSheet = omniEditStage_(trace,'event_sheet_preflight',()=>e.range.getSheet());
  const preflightName = omniEditStage_(trace,'event_sheet_name_preflight',()=>preflightSheet.getName());
  if (preflightName !== OA2.ARRIVAL && preflightName !== OA2_CS.HISTORY && !OMNI_ACCOUNT_TABS.includes(preflightName)) return;
  // A provider lookup may outlast the initial hint; refresh only for a managed sheet.
  omniMarkStaffPriority_();
  const lock = LockService.getDocumentLock();
  let admitted = false;
  try {
    // Admission precedes all business-cell/header reads and writes. Keep the existing
    // Account wait budget and explicit failure; never silently discard an edit.
    omniEditStage_(trace,'lock_admission',()=>lock.waitLock(30000));
    admitted = true;
    omniEditStage_(trace,'requested_account_recovery',()=>oa2RunRequestedAccountTransferRepair_(e.source));
    const sheet = omniEditStage_(trace,'event_sheet',()=>e.range.getSheet());
    const account = omniEditStage_(trace,'event_sheet_name',()=>sheet.getName());
    if (account !== OA2.ARRIVAL && account !== OA2_CS.HISTORY && !OMNI_ACCOUNT_TABS.includes(account)) return;
    if (omniEditStage_(trace,'stale_event_check',()=>omniArrivalV2StaleEdit_(e))) return;
    if (account === OA2_CS.HISTORY) {
      return omniEditStage_(trace,'arrival_cs_history',()=>oa2HistoryCsEdit_(e,sheet,lock));
    }
    if (account === OA2.ARRIVAL) {
      omniEditStage_(trace,'arrival_queue_edit',()=>omniArrivalV2QueueEdit_(e,{sheet,name:account,trace,lockHeld:true,documentLock:lock}));
      return;
    }
    if (e.range.getLastRow() < 2) return;
    const columns = omniEditStage_(trace,'account_headers',()=>getOmniColumns_(sheet));
    const firstRow = Math.max(2, e.range.getRow());
    const lastRow = e.range.getLastRow();
    const firstCol = e.range.getColumn();
    const lastCol = e.range.getLastColumn();
    let shouldResort = false;
    omniEditStage_(trace,'account_row_updates',()=>{
    shouldResort = omniUpdateEditedAccountRows_(e,sheet,account,columns,firstRow,lastRow,firstCol,lastCol);
    });
    omniEditStage_(trace,'arrival_account_edit',()=>omniArrivalV2AccountEdit_(e, firstRow, lastRow, firstCol, lastCol, sheet, trace, lock));
    // v2 keeps Account rows in place; queued edit events must not target a sorted row.
    if (shouldResort && !oa2Enabled_()) sortAccountSheet_(sheet, columns);
  } finally {
    if (admitted) lock.releaseLock();
    console.log(JSON.stringify({handler:'omni_edit',stage:'execution',state:'finished',admitted,durationMs:Date.now()-trace.started}));
  }
}


/** One bounded provider read per edited rectangle. Keep sparse field writes and
 * all existing lock, stale-event, source ownership and commit journal checks. */
function omniUpdateEditedAccountRows_(e,sheet,account,c,firstRow,lastRow,firstCol,lastCol) {
  const values=sheet.getRange(firstRow,1,lastRow-firstRow+1,leadDataWidth_(c)).getValues();
  const offerEdited=c.OFFER>=firstCol&&c.OFFER<=lastCol;
  const rules=offerEdited?getTreatmentRules_():null;
  let shouldResort=c.CREATED_AT>=firstCol&&c.CREATED_AT<=lastCol;
  values.forEach((row,index)=>{
    const number=firstRow+index;
    if(clean_(row[c.ACCOUNT-1])!==account){sheet.getRange(number,c.ACCOUNT).setValue(account);row[c.ACCOUNT-1]=account;}
    const defaultBrand=DEFAULT_BRAND_BY_ACCOUNT[account]||'';
    if(defaultBrand&&!clean_(row[c.BRAND-1])){sheet.getRange(number,c.BRAND).setValue(defaultBrand);row[c.BRAND-1]=defaultBrand;}
    if(!row[c.CREATED_AT-1]&&row.some((v,i)=>![c.ACCOUNT,c.LAST_UPDATED,c.CREATED_AT].includes(i+1)&&Boolean(clean_(v)))) {
      const created=today_();sheet.getRange(number,c.CREATED_AT).setValue(created).setNumberFormat('yyyy-mm-dd');
      if(!row[c.LAST_UPDATED-1])sheet.getRange(number,c.LAST_UPDATED).setValue(created).setNumberFormat('yyyy-mm-dd');
    }
    if(offerEdited)syncTreatmentForRow_(sheet,number,account,c,rules,row);
    if(c.STATUS>=firstCol&&c.STATUS<=lastCol) {
      const before=firstRow===lastRow&&e.range.getNumColumns()===1?clean_(e.oldValue):'';
      const after=clean_(row[c.STATUS-1]);
      if(after&&normalizeStatus_(before)!==normalizeStatus_(after)) {
        sheet.getRange(number,c.LAST_UPDATED).setValue(today_()).setNumberFormat('yyyy-mm-dd');shouldResort=true;
      }
    }
  });
  return shouldResort;
}

function ensureAccountAndCreatedDate_(sheet, row, account, columns) {
  const accountCell = sheet.getRange(row, columns.ACCOUNT);
  if (clean_(accountCell.getDisplayValue()) !== account) accountCell.setValue(account);

  const defaultBrand = DEFAULT_BRAND_BY_ACCOUNT[account] || '';
  const brandCell = sheet.getRange(row, columns.BRAND);
  if (defaultBrand && !clean_(brandCell.getDisplayValue())) brandCell.setValue(defaultBrand);

  const createdCell = sheet.getRange(row, columns.CREATED_AT);
  if (createdCell.getValue()) return;

  const rowValues = sheet.getRange(row, 1, 1, leadDataWidth_(columns)).getDisplayValues()[0];
  const meaningful = rowValues.some((value, index) => {
    const absoluteCol = index + 1;
    if ([columns.ACCOUNT, columns.LAST_UPDATED, columns.CREATED_AT].includes(absoluteCol)) return false;
    return Boolean(clean_(value));
  });
  if (meaningful) {
    const created = today_();
    createdCell.setValue(created).setNumberFormat('yyyy-mm-dd');
    const updatedCell = sheet.getRange(row, columns.LAST_UPDATED);
    if (!updatedCell.getValue()) {
      updatedCell.setValue(created).setNumberFormat('yyyy-mm-dd');
    }
  }
}

function syncAllAccountTreatments() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  OMNI_ACCOUNT_TABS.forEach(account => {
    const sheet = ss.getSheetByName(account);
    if (!sheet) return;
    const columns = getOmniColumns_(sheet);
    const rules = getTreatmentRules_();
    for (let row = 2; row <= sheet.getLastRow(); row++) {
      if (!clean_(sheet.getRange(row, columns.CREATED_AT).getDisplayValue())) continue;
      syncTreatmentForRow_(sheet, row, account, columns, rules);
    }
  });
  SpreadsheetApp.getUi().alert('已按 Account 重新同步療程項目。');
}

function syncTreatmentForRow_(sheet, row, account, columns, rules, cachedValues) {
  const offer = clean_(cachedValues ? cachedValues[columns.OFFER-1] : sheet.getRange(row, columns.OFFER).getDisplayValue());
  if (!offer) return;
  const text = [
    offer,
    clean_(cachedValues ? cachedValues[columns.TREATMENT-1] : sheet.getRange(row, columns.TREATMENT).getDisplayValue()),
    clean_(cachedValues ? cachedValues[columns.CAMPAIGN-1] : sheet.getRange(row, columns.CAMPAIGN).getDisplayValue()),
  ].filter(Boolean).join(' ').toLowerCase();

  const rule = (rules || getTreatmentRules_()).find(item =>
    item.enabled &&
    item.account === account &&
    item.keywords.some(keyword => text.includes(keyword.toLowerCase()))
  );
  if (!rule) return;

  const treatmentCell = sheet.getRange(row, columns.TREATMENT);
  if (!clean_(cachedValues ? cachedValues[columns.TREATMENT-1] : treatmentCell.getDisplayValue())) treatmentCell.setValue(rule.output);

  const brandCell = sheet.getRange(row, columns.BRAND);
  if (rule.brand && clean_(cachedValues ? cachedValues[columns.BRAND-1] : brandCell.getDisplayValue()) !== rule.brand) {
    brandCell.setValue(rule.brand);
  }
}

function getTreatmentRules_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(OMNI_TREATMENT_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1,1,sheet.getLastRow(),9).getDisplayValues();
  const headers = values[0].map(clean_);
  const col = Object.fromEntries(headers.map((h,i)=>[h,i]));
  // Rules tab historically calls these I/J; accept semantic labels for future edits.
  const keywordCol = ruleHeaderIndex_(headers, ['療程 / 優惠關鍵字','K欄關鍵字','J欄關鍵字','I欄關鍵字']);
  const outputCol = ruleHeaderIndex_(headers, ['療程項目輸出','L欄輸出','K欄輸出','J欄輸出']);
  return values.slice(1).map(row => ({
    enabled: ['TRUE','YES','Y','1','啟用'].includes(clean_(row[col['啟用']]).toUpperCase()),
    account: clean_(row[col['Account']]),
    brand: clean_(row[col['品牌']]),
    keywords: clean_(row[keywordCol]).split(/[|,\n，、]/).map(clean_).filter(Boolean),
    output: cleanMultiline_(row[outputCol]),
  })).filter(r => r.account && r.output && r.keywords.length);
}


function ruleHeaderIndex_(headers, aliases) {
  const matches = [];
  headers.forEach((header, index) => { if (aliases.includes(header)) matches.push(index); });
  if (matches.length !== 1) throw new Error(`療程項目規則欄名不符：${aliases[0]}`);
  return matches[0];
}

function sortAccountSheet_(sheet, columns) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  // Include hidden provenance columns to keep the complete lead record together.
  // Oldest -> newest keeps latest activity at the bottom.
  sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .sort([{ column: columns.LAST_UPDATED, ascending: true }]);
}

/******** Event ledger ********/

function ensureEventSheet_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(OMNI_EVENT_SHEET);
  if (!sheet) sheet = ss.insertSheet(OMNI_EVENT_SHEET);
  if (sheet.getMaxColumns() < EVENT_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), EVENT_HEADERS.length - sheet.getMaxColumns());
  }
  const current = sheet.getRange(1,1,1,EVENT_HEADERS.length).getDisplayValues()[0].map(clean_);
  if (current.every(v=>!v)) {
    sheet.getRange(1,1,1,EVENT_HEADERS.length).setValues([EVENT_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange('B:C').setNumberFormat('yyyy-mm-dd');
    sheet.getRange('K:K').setNumberFormat('yyyy-mm-dd');
  }
  else if (EVENT_HEADERS.some((h,i)=>current[i] !== h)) throw new Error('_funnel_events header contract 不符。');

  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

// Best-effort foreground admission hint only; never stores event values, identities or customer data.
// This is not a durable edit queue and does not replay a failed edit.
const OMNI_STAFF_PRIORITY = Object.freeze({PROP:'OMNI_STAFF_EDIT_SEEN_AT_V1',TTL_MS:60000});
function omniMarkStaffPriority_() {
  try{PropertiesService.getScriptProperties().setProperty(OMNI_STAFF_PRIORITY.PROP,String(Date.now()));}catch(ignored){}
}
function omniStaffPriorityActive_(properties) {
  try {
    const raw=(properties||PropertiesService.getScriptProperties()).getProperty(OMNI_STAFF_PRIORITY.PROP),stamp=Number(raw),now=Date.now();
    return raw!==null&&raw!==''&&isFinite(stamp)&&stamp>0&&stamp<=now&&now-stamp<OMNI_STAFF_PRIORITY.TTL_MS;
  }catch(ignored){return false;}
}
function omniStaffPriorityTimerSkip_() {
  const result={skipped:true,reason:'staff_priority'};
  try{console.log(JSON.stringify(Object.assign({handler:'omniArrivalV2Timer'},result)));}catch(ignored){}
  return result;
}

const OMNI_CAPTURE = Object.freeze({BATCH:200,CURSOR:'OMNI_CAPTURE_CURSOR_V1',BACKOFF:'OMNI_CAPTURE_RETRY_AFTER',BACKOFF_MS:300000});
function omniCaptureTimeout_(error) {return /service\s+spreadsheets?\s+timed?\s*out|spreadsheet\s+service[^\n]*timed?\s*out|service\s+timed?\s*out[^\n]*spreadsheets?|(?:「試算表」|試算表)\s*服務發生逾時情形/i.test(String(error.message||error));}
function omniCaptureResult_(result) {console.log(JSON.stringify(Object.assign({handler:'captureMissingLeadEvents'},result)));return result;}
function omniCaptureCursor_(props) {
  const raw=props.getProperty(OMNI_CAPTURE.CURSOR);
  if(!raw)return{version:1,accountIndex:0,accountName:OMNI_ACCOUNT_TABS[0],nextRow:2};
  let cursor;try{cursor=JSON.parse(raw);}catch(error){throw new Error('Invalid capture cursor; review required.');}
  if(!cursor||cursor.version!==1||!Number.isInteger(cursor.accountIndex)||cursor.accountIndex<0||cursor.accountIndex>=OMNI_ACCOUNT_TABS.length||cursor.accountName!==OMNI_ACCOUNT_TABS[cursor.accountIndex]||!Number.isInteger(cursor.nextRow)||cursor.nextRow<2)throw new Error('Invalid capture cursor scope; review required.');
  return cursor;
}
// Capture-only diagnostics: static phase names/durations, never row values,
// Account names, IDs or raw provider errors. Logging cannot change work outcome.
function omniCapturePhaseLog_(entry) {try{console.log(JSON.stringify(entry));}catch(ignored){}}
function omniCapturePhase_(trace,phase,run) {
  if(!trace)return run();
  const started=Date.now();
  omniCapturePhaseLog_({handler:'captureMissingLeadEvents',phase,state:'start',elapsedMs:started-trace.started});
  try {
    const result=run();
    omniCapturePhaseLog_({handler:'captureMissingLeadEvents',phase,state:'complete',durationMs:Date.now()-started});
    return result;
  }catch(error){
    omniCapturePhaseLog_({handler:'captureMissingLeadEvents',phase,state:'failed',durationMs:Date.now()-started,reason:omniCaptureTimeout_(error||'')?'spreadsheet_timeout':'operation_failed'});
    throw error;
  }
}
function captureMissingLeadEvents() {
  if (!OMNI_LEGACY_EVENT_CAPTURE_ENABLED) return {added:0,skipped:true,reason:'legacy_audit_retired'};
  if(omniStaffPriorityActive_())return omniCaptureResult_({added:0,skipped:true,reason:'staff_priority'});
  // Background admission happens before any Spreadsheet service access. Never queue a busy sweep.
  const trace={started:Date.now()},lock=LockService.getDocumentLock();if(!omniCapturePhase_(trace,'admission',()=>lock.tryLock(0)))return omniCaptureResult_({added:0,skipped:true,reason:'busy'});
  let props;
  try {
    props=PropertiesService.getScriptProperties();if(omniStaffPriorityActive_(props))return omniCaptureResult_({added:0,skipped:true,reason:'staff_priority'});const now=new Date().getTime(),retryAfter=Number(props.getProperty(OMNI_CAPTURE.BACKOFF)||0);
    if(now<retryAfter)return omniCaptureResult_({added:0,skipped:true,reason:'backoff',retryAfter});
    const cursor=omniCaptureCursor_(props),account=cursor.accountName;
    const source=omniCapturePhase_(trace,'source_lookup',()=>{const ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName(account);if(!sheet)throw new Error('Missing capture Account; cursor unchanged.');return{ss,sheet};});
    const ss=source.ss,sheet=source.sheet;
    const columns=omniCapturePhase_(trace,'source_headers',()=>getOmniColumns_(sheet)),width=leadDataWidth_(columns),lastRow=omniCapturePhase_(trace,'source_bounds',()=>sheet.getLastRow());
    const firstRow=cursor.nextRow>lastRow?2:cursor.nextRow,count=Math.max(0,Math.min(OMNI_CAPTURE.BATCH,lastRow-firstRow+1));
    const values=count?omniCapturePhase_(trace,'source_read',()=>sheet.getRange(firstRow,1,count,width).getValues()):[],append=[],pending=new Set();let context;
    values.forEach((row,index)=>{
      const record=rowRecord_(row,columns),identity=stableIdentity_(record,account);if(!identity)return;
      context=context||getOmniEventContext_(ss,trace);const key=identity+'|lead';if(context.index.has(key)||pending.has(key))return;
      append.push(buildEventRow_(record,account,firstRow+index,'lead',record.createdAt||today_(),'',clean_(record.status)));pending.add(key);
    });
    const verified=omniCapturePhase_(trace,'source_verify',()=>{const currentLastRow=sheet.getLastRow();return{currentLastRow,changed:currentLastRow<lastRow||JSON.stringify(getOmniColumns_(sheet))!==JSON.stringify(columns)||(count&&JSON.stringify(sheet.getRange(firstRow,1,count,width).getValues())!==JSON.stringify(values))};});
    const currentLastRow=verified.currentLastRow;
    if(verified.changed)return omniCaptureResult_({added:0,skipped:true,reason:'source_changed',account});
    const added=append.length?omniCapturePhase_(trace,'append',()=>appendOmniEventsWithIndex_(context,append)):0;
    const end=firstRow+count-1,completeAccount=count===0||end>=currentLastRow,nextIndex=completeAccount?(cursor.accountIndex+1)%OMNI_ACCOUNT_TABS.length:cursor.accountIndex;
    const next={version:1,accountIndex:nextIndex,accountName:OMNI_ACCOUNT_TABS[nextIndex],nextRow:completeAccount?2:end+1};
    // An ambiguous append or failed cursor write leaves the old batch eligible for deduplicated retry.
    omniCapturePhase_(trace,'cursor_write',()=>props.setProperty(OMNI_CAPTURE.CURSOR,JSON.stringify(next)));
    return omniCaptureResult_({added,skipped:false,account,scanned:count,firstRow,lastRow:end,completeAccount,next});
  }catch(error) {
    if(props&&omniCaptureTimeout_(error)) {
      try{props.setProperty(OMNI_CAPTURE.BACKOFF,String(new Date().getTime()+OMNI_CAPTURE.BACKOFF_MS));}catch(bookkeepingError){console.log('Capture backoff could not be saved: '+String(bookkeepingError.message||bookkeepingError));}
      console.log('Capture hit Spreadsheet service timeout; reconcile the saved append/cursor outcome before retry.');
    }
    throw error;
  }finally{lock.releaseLock();}
}

function captureStageEventForRow_(sheet, rowNumber, account, before, after, columns, sharedContext) {
  const context = sharedContext || getOmniEventContext_();
  const record = rowRecord_(sheet.getRange(rowNumber,1,1,leadDataWidth_(columns)).getValues()[0], columns);
  const identity = stableIdentity_(record, account);
  if (!identity) return 0;

  const existing = context.index;
  const events = [];
  if (!existing.has(`${identity}|lead`)) {
    events.push(buildEventRow_(record, account, rowNumber, 'lead', record.createdAt || today_(), '', after));
  }

  const type = statusEventType_(after);
  if (type && !existing.has(`${identity}|${type}`)) {
    events.push(buildEventRow_(record, account, rowNumber, type, today_(), before, after));
  }
  appendOmniEventsWithIndex_(context, events);
  return events.length;
}

function rowRecord_(row, columns) {
  return {
    createdAt: row[columns.CREATED_AT-1] || '',
    status: row[columns.STATUS-1] || '',
    brand: row[columns.BRAND-1] || '',
    branch: row[columns.BRANCH-1] || '',
    phone: row[columns.PHONE-1] || '',
    treatment: row[columns.TREATMENT-1] || row[columns.OFFER-1] || '',
    campaign: row[columns.CAMPAIGN-1] || '',
  };
}

function stableIdentity_(record, account) {
  const phone = last8_(record.phone);
  const created = dateText_(record.createdAt);
  const brand = clean_(record.brand);
  if (!phone || !created || !brand) return '';
  return `${account}|${brand}|${phone}|${created}`;
}

function internalLeadKey_(record, account) {
  const identity = stableIdentity_(record, account);
  return identity ? `omni:${identity}` : '';
}

function buildEventRow_(record, account, sourceRow, type, dateValue, before, after) {
  const identity = stableIdentity_(record, account);
  const eventId = deterministicId_(`${identity}|${type}`);
  const date = toDateOnly_(dateValue) || today_();
  return [
    eventId, date, date, type, internalLeadKey_(record, account),
    clean_(record.brand), last8_(record.phone), sourceRow,
    clean_(before), clean_(after), toDateOnly_(record.createdAt) || '',
    clean_(record.treatment), '', clean_(record.campaign), clean_(record.branch), account
  ];
}

function omniEventIndexKey_(row) {
  const account=clean_(row[15]),brand=clean_(row[5]),phone=last8_(row[6]),created=dateText_(row[10]),type=clean_(row[3]).toLowerCase();
  return account&&brand&&phone&&created&&type?`${account}|${brand}|${phone}|${created}|${type}`:'';
}
function getOmniEventContext_(spreadsheet,captureTrace) {
  const ledger=omniCapturePhase_(captureTrace,'ledger_headers',()=>ensureEventSheet_(spreadsheet)),lastRow=omniCapturePhase_(captureTrace,'ledger_bounds',()=>ledger.getLastRow()),index=omniCapturePhase_(captureTrace,'ledger_index',()=>getEventIndex_(ledger,lastRow));
  omniCapturePhase_(captureTrace,'ledger_verify',()=>{if(ledger.getLastRow()!==lastRow)throw new Error('Event ledger changed while reading index; retry required.');});
  return{ledger,index,lastRow};
}
function appendOmniEventsWithIndex_(context,rows) {
  if(!rows.length)return 0;
  if(context.ledger.getLastRow()!==context.lastRow)throw new Error('Event ledger changed during execution; retry with a fresh index.');
  const added=appendEvents_(context.ledger,rows);context.lastRow+=added;
  rows.forEach(row=>{const key=omniEventIndexKey_(row);if(key)context.index.add(key);});return added;
}
function getEventIndex_(sheet, knownLastRow) {
  const set = new Set();
  const lastRow=knownLastRow===undefined?sheet.getLastRow():knownLastRow;
  if (lastRow < 2) return set;
  // The de-duplication key uses D:P only. Keep the same key parser and
  // complete row coverage; A:C (event ID/dates) are not needed for this read.
  const rows = sheet.getRange(2,4,lastRow-1,EVENT_HEADERS.length-3).getValues();
  rows.forEach(row => {
    const key=omniEventIndexKey_(['','',''].concat(row));if(key)set.add(key);
  });
  return set;
}

function appendEvents_(sheet, rows) {
  if (!rows.length) return 0;
  const start = sheet.getLastRow() + 1;
  sheet.getRange(start,1,rows.length,EVENT_HEADERS.length).setValues(rows);
  sheet.getRange(start,2,rows.length,2).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(start,11,rows.length,1).setNumberFormat('yyyy-mm-dd');
  return rows.length;
}

function statusEventType_(value) {
  const s = normalizeStatus_(value);
  if (s === 'booked') return 'book';
  if (s === 'show') return 'show';
  if (s === 'no_show') return 'no_show';
  return '';
}

function normalizeStatus_(value) {
  const s = clean_(value).toLowerCase();
  if (['已預約','booked','confirmed'].includes(s)) return 'booked';
  if (['已到店','show','show up','已完成','完成療程'].includes(s)) return 'show';
  if (['no show','noshow','no-show','未到店'].includes(s)) return 'no_show';
  if (['待跟進','跟進狀態','lead','new lead','未預約'].includes(s)) return 'lead';
  return s;
}

function deterministicId_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  return 'fe_' + bytes.map(b => ((b + 256) % 256).toString(16).padStart(2,'0')).join('').slice(0,32);
}

/******** Formatting / verification ********/

function applyOmniDateFormats() {
  applyOmniDateFormats_(true);
}

function applyOmniDateFormats_(showAlert) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [OMNI_MASTER_SHEET, ...OMNI_ACCOUNT_TABS].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const columns = getOmniColumns_(sheet);
    const rows = Math.max(sheet.getMaxRows()-1,1);
    sheet.getRange(2,columns.LAST_UPDATED,rows,1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(2,columns.CREATED_AT,rows,1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(2,columns.APPOINTMENT_DATE,rows,1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(2,columns.SHOW_DATE,rows,1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(2,columns.LAST_FOLLOWUP,rows,1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(2,columns.APPOINTMENT_TIME,rows,1).setNumberFormat('hh:mm');
  });
  if (OMNI_LEGACY_EVENT_CAPTURE_ENABLED) ensureEventSheet_();
  if (showAlert) SpreadsheetApp.getUi().alert('日期格式已統一。');
}

function verifyOmniLeadSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const problems = [];
  if (ss.getSpreadsheetTimeZone() !== 'Asia/Hong_Kong') problems.push('Timezone 應為 Asia/Hong_Kong');

  [OMNI_MASTER_SHEET,...OMNI_ACCOUNT_TABS,OMNI_TREATMENT_SHEET,...(OMNI_LEGACY_EVENT_CAPTURE_ENABLED ? [OMNI_EVENT_SHEET] : [])].forEach(name => {
    if (!ss.getSheetByName(name)) problems.push(`缺少分頁：${name}`);
  });

  [OMNI_MASTER_SHEET,...OMNI_ACCOUNT_TABS].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    try {
      getOmniColumns_(sheet);
    } catch (error) {
      problems.push(String(error.message || error));
    }
  });

  const result = { ok: problems.length === 0, problems };
  console.log(JSON.stringify(result));
  return result;
}

function today_() {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Asia/Hong_Kong';
  const text = Utilities.formatDate(new Date(),tz,'yyyy-MM-dd');
  const [y,m,d] = text.split('-').map(Number);
  return new Date(y,m-1,d);
}

function toDateOnly_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(),value.getMonth(),value.getDate());
  }
  const raw = clean_(value);
  const m = raw.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (!m) return null;
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
}

function dateText_(value) {
  const d = toDateOnly_(value);
  return d ? Utilities.formatDate(d,'Asia/Hong_Kong','yyyy-MM-dd') : '';
}

function last8_(value) {
  const digits = clean_(value).replace(/\D/g,'');
  return digits.length >= 8 ? digits.slice(-8) : '';
}

function clean_(value) {
  return String(value ?? '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
}

function cleanMultiline_(value) {
  return String(value ?? '').replace(/\r\n/g,'\n').replace(/\r/g,'\n')
    .split('\n').map(line => line.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim())
    .filter(Boolean).join('\n').trim();
}

function columnLetter_(column) {
  let n = column, out = '';
  while (n > 0) {
    const r = (n-1)%26;
    out = String.fromCharCode(65+r) + out;
    n = Math.floor((n-1)/26);
  }
  return out;
}


/** Additive arrival workflow v2. Candidate only; no external service dependencies. */
const OA2 = Object.freeze({
  VERSION: '2.0.1', TZ: 'Asia/Hong_Kong', ARRIVAL: '到店紀錄', HEADER_ROW: 7, FIRST_ROW: 8,
  LEDGER: '_appointment_registry', HISTORY: '_appointment_history', BATCH: 200,
  PROP: 'OMNI_ARRIVAL_V2_ENABLED', CURSOR: 'OMNI_ARRIVAL_V2_CURSOR',
  ACCOUNT_HEADERS: ['Omni Lead ID','Appointment ID','Booking Registered At','到店結果','到店結果更新時間','Pending Appointment Snapshot'],
  QUEUE_HEADERS: ['Appointment ID','Schedule Revision','Queue State','Outcome Recorded At','Omni Lead ID','Booking Registered At','Record Origin'],
  LEDGER_HEADERS: ['Appointment ID','Lead ID','Account','Customer Key','Phone Last8','Name','Brand','Treatment','Branch','Created At','Appointment Date','Appointment Time','Booking Registered At','Registration Provenance','State','Outcome','Arrival Date','Outcome Recorded At','Revision','Previous Appointment ID','Queue Entry ID','Last Seen Status','Last Seen Schedule','First Seen At','Updated At','Last Generated Arrival Date','Pending Queue Before','Pending Arrival Date Override'],
  HISTORY_HEADERS: ['Change ID','Changed At','Appointment ID','Lead ID','Change Type','Before','After','Source'],
});
const OA2_FIELDS = ['id','leadId','account','customerKey','phone','name','brand','treatment','branch','createdAt','date','time','bookedAt','provenance','state','outcome','arrivalDate','outcomeAt','revision','previousId','queueId','lastStatus','lastSchedule','firstSeenAt','updatedAt','generatedArrivalDate','pendingQueueBefore','pendingArrivalOverride'];
function oa2Text_(v) { return String(v == null ? '' : v).trim(); }
function oa2Date_(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : Utilities.formatDate(value, OA2.TZ, 'yyyy-MM-dd');
  if (typeof value === 'number' && isFinite(value) && value >= 1 && value <= 100000) return new Date(Date.UTC(1899,11,30) + Math.floor(value)*86400000).toISOString().slice(0,10);
  const s = oa2Text_(value); let m;
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)) { const d=new Date(s); return isNaN(d.getTime())?'':Utilities.formatDate(d,OA2.TZ,'yyyy-MM-dd'); }
  if ((m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) return oa2ValidDate_(+m[1],+m[2],+m[3]);
  if ((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return oa2ValidDate_(+m[3],+m[2],+m[1]);
  return '';
}
function oa2ValidDate_(y,m,d) { const v=new Date(Date.UTC(y,m-1,d)); return y>=1900 && y<=2200 && v.getUTCFullYear()===y && v.getUTCMonth()===m-1 && v.getUTCDate()===d ? v.toISOString().slice(0,10):''; }
function oa2Time_(v) {
  if (v instanceof Date) return isNaN(v.getTime())?'':Utilities.formatDate(v,OA2.TZ,'HH:mm');
  if (typeof v==='number' && v>=0 && v<1) { const n=Math.round(v*1440)%1440; return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); }
  const m=oa2Text_(v).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/); return m && +m[1]<24 && +m[2]<60?m[1].padStart(2,'0')+':'+m[2]:'';
}
function oa2Status_(v) { const s=oa2Text_(v).toLowerCase(); return ['已預約','booked','confirmed'].includes(s)?'booked':['已到店','show','show up','已完成','完成療程'].includes(s)?'show':['no show','noshow','no-show','未到店'].includes(s)?'no_show':s; }
function oa2Outcome_(v) { const s=oa2Status_(v); return s==='show'?'Show':s==='no_show'?'No Show':['','待到店'].includes(oa2Text_(v))?'':null; }
function oa2Clone_(v) { return JSON.parse(JSON.stringify(v)); }
function oa2Hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>((b+256)%256).toString(16).padStart(2,'0')).join('').slice(0,32); }
function oa2Event_(ctx, appt, type, before, source) {
  const after = {date:appt.date,time:appt.time,state:appt.state,outcome:appt.outcome,arrivalDate:appt.arrivalDate,pendingArrivalOverride:appt.pendingArrivalOverride||'',revision:appt.revision};
  const b=JSON.stringify(before || {}), a=JSON.stringify(after);
  ctx.events.push(['ac_'+oa2Hash_(appt.id+'|'+appt.revision+'|'+type+'|'+b+'|'+a),ctx.now,appt.id,appt.leadId,type,b,a,source]);
}
function oa2StateView_(a) { return {date:a.date,time:a.time,state:a.state,outcome:a.outcome,arrivalDate:a.arrivalDate,pendingArrivalOverride:a.pendingArrivalOverride||'',revision:a.revision}; }
/** Pure deterministic transition. Its context is an in-memory snapshot, never the live spreadsheet. */
function oa2ReconcileRecord_(ctx, record, mode) {
  if (!record.meaningful) return null;
  if (!record.leadId) record.leadId=ctx.id('lead');
  const status=oa2Status_(record.status), date=oa2Date_(record.date), time=oa2Time_(record.time);
  const schedule=date+'|'+time;
  let appt=record.appointmentId ? ctx.appointments[record.appointmentId] : null;
  if(record.appointmentId && !appt) {ctx.errors.push('Unknown appointment ID on '+record.account+' row '+record.row);return null;}
  // Recover a partially committed registry write by durable Lead ID, never by source row.
  const recover=Object.keys(ctx.appointments).map(id=>ctx.appointments[id]).filter(a=>a.leadId===record.leadId && a.provenance!=='legacy_show').sort((a,b)=>String(a.firstSeenAt).localeCompare(String(b.firstSeenAt)));
  const newest=recover[recover.length-1];
  if(newest && (!appt || newest.previousId===appt.id)) { appt=newest; record.appointmentId=appt.id; }
  if (record.appointmentId && !appt) { ctx.errors.push('Unknown appointment ID on '+record.account+' row '+record.row); return null; }
  if (appt && appt.leadId!==record.leadId) { ctx.errors.push('Lead/appointment identity mismatch on '+record.account+' row '+record.row); return null; }
  if (appt && appt.account!==record.account) { ctx.errors.push('Appointment/account identity mismatch on '+record.account+' row '+record.row); return null; }
  // Timer discovers API-imported rows, but never invents registration time for pre-existing bookings.
  const genuineBooking = mode==='edit' && record.bookingMutation;
  const needsNew = status==='booked' && (record.forceNew || !appt || (appt.state==='canceled' && genuineBooking) || (appt.state==='completed' && (schedule!==appt.lastSchedule || (genuineBooking && appt.lastStatus!=='booked') || record.forceNew)));
  if (needsNew) {
    const previous=appt?appt.id:'';
    if(appt && !appt.outcome && !['canceled','superseded'].includes(appt.state)) { const before=oa2StateView_(appt); appt.state='superseded'; appt.revision++; appt.updatedAt=ctx.now; oa2Event_(ctx,appt,'superseded',before,mode); }
    appt={id:'appt_'+oa2Hash_(record.leadId+'|after:'+previous),leadId:record.leadId,account:record.account,customerKey:record.customerKey,phone:record.phone,name:record.name,brand:record.brand,treatment:record.treatment,branch:record.branch,createdAt:oa2Date_(record.createdAt),date,time,bookedAt:genuineBooking?ctx.now:'',provenance:genuineBooking?'observed_booking_edit':'legacy_registration_unknown',state:date?'active':'unscheduled',outcome:'',arrivalDate:'',outcomeAt:'',revision:1,previousId:previous,queueId:'',lastStatus:status,lastSchedule:schedule,firstSeenAt:ctx.now,updatedAt:ctx.now,generatedArrivalDate:'',pendingArrivalOverride:'scheduled'};
    ctx.appointments[appt.id]=appt; record.appointmentId=appt.id;
    oa2Event_(ctx,appt,'registered',null,mode);
  } else if (appt) {
    const before=oa2StateView_(appt); let type='';
    if (status!=='booked' && status!=='show' && status!=='no_show' && ['active','unscheduled','reschedule_requested'].includes(appt.state)) { appt.state='canceled'; appt.revision++; type='canceled'; }
    else if (['booked','show','no_show'].includes(status) && !appt.outcome && appt.provenance!=='legacy_show' && ['active','unscheduled','reschedule_requested'].includes(appt.state) && (date!==appt.date || time!==appt.time || appt.state==='unscheduled' && !!date)) { appt.date=date; appt.time=time; appt.state=date?'active':'unscheduled'; appt.revision++; type='rescheduled'; }
    if (type) { appt.updatedAt=ctx.now; oa2Event_(ctx,appt,type,before,mode); }
    appt.lastStatus=status; appt.lastSchedule=schedule;
  }
  if (appt) {
    // Descriptive corrections do not modify immutable booking registration or historical snapshots.
    record.appointmentId=appt.id; record.bookedAt=appt.bookedAt; record.outcome=appt.outcome || (appt.state==='canceled'?'取消':appt.state==='reschedule_requested'?'改期':''); record.outcomeAt=appt.outcomeAt;
  }
  return appt;
}
/** E is only a display default while pending. The registry's actual arrivalDate remains blank until Show. */
function oa2QueueArrivalDate_(a) {
  if(a.outcome==='Show')return a.arrivalDate;
  if(a.outcome || a.provenance==='legacy_show' || !['active','unscheduled','reschedule_requested'].includes(a.state))return '';
  const input=oa2Text_(a.pendingArrivalOverride);
  return input==='cleared'?'':oa2Date_(input)||a.date;
}
function oa2SetPendingArrivalDate_(ctx,id,value,source,automatic) {
  const a=ctx.appointments[id];if(!a)throw new Error('Unknown appointment ID');
  if(a.outcome || a.provenance==='legacy_show')throw new Error('Completed arrival evidence cannot receive a pending date default.');
  const date=oa2Date_(value);if(oa2Text_(value)&&!date)throw new Error('Invalid arrival date.');
  const input=automatic?'scheduled':date||'cleared';if(a.pendingArrivalOverride===input)return false;
  const before=oa2StateView_(a);a.pendingArrivalOverride=input;a.revision++;a.updatedAt=ctx.now;
  oa2Event_(ctx,a,automatic?'arrival_date_default_initialized':'pending_arrival_date_edited',before,source||'queue_edit');return true;
}
function oa2QueueState_(appt,today) {
  if (appt.state==='canceled') return '已取消';
  if (appt.state==='superseded') return '已另建預約（保留歷史）';
  if (appt.state==='reschedule_requested') return '改期：請更新Account預約日期時間';
  if (appt.outcome) return appt.outcome;
  if (!appt.date) return '待補預約日期';
  if (appt.date>today) return '已改期／未到期';
  return '待確認';
}
function oa2Due_(appt,today) { return ['active','unscheduled'].includes(appt.state) && !appt.outcome; }
/** Queue IDs are fixed strings, not row numbers; existing completed historical rows are never recreated. */
function oa2PlanQueue_(ctx,queueRows) {
  const byId={}; const duplicate=new Set();
  queueRows.forEach(q=> { if(q.appointmentId) { if(byId[q.appointmentId]) duplicate.add(q.appointmentId); else byId[q.appointmentId]=q; } });
  duplicate.forEach(id=>ctx.errors.push('Duplicate queue appointment ID '+id));
  const operations=[];
  Object.keys(ctx.appointments).forEach(id=> {
    const a=ctx.appointments[id], q=byId[id]; if(duplicate.has(id) || (ctx.retiredQueueAppointmentIds && ctx.retiredQueueAppointmentIds.has(id))) return;
    if(!a.outcome && a.provenance!=='legacy_show' && !a.pendingArrivalOverride && (q || oa2Due_(a,ctx.today)))oa2SetPendingArrivalDate_(ctx,a.id,'','queue_default_upgrade',true);
    if(q) { if(q.entryId!==a.queueId && !(q.origin==='allocating'&&!q.entryId)) {ctx.errors.push('Queue entry ID mismatch '+id);return;} if(q.origin==='allocating') { operations.push({kind:'append',appt:a,row:q.row,entryId:a.queueId,recovery:true,state:oa2QueueState_(a,ctx.today)}); } else if(q.origin!=='legacy_show') operations.push({kind:'refresh',appt:a,row:q.row,state:oa2QueueState_(a,ctx.today)}); }
    else if(a.queueId) { operations.push({kind:'append',appt:a,entryId:a.queueId,recovery:true,state:oa2QueueState_(a,ctx.today)}); }
    else if(oa2Due_(a,ctx.today)) { const entryId=ctx.id('arrival'); a.queueId=entryId; a.updatedAt=ctx.now; operations.push({kind:'append',appt:a,entryId,state:'待確認'}); oa2Event_(ctx,a,'queued',oa2StateView_(a),'sweep'); }
  });
  return operations;
}
function oa2SetOutcome_(ctx,apptId,value,arrivalDate,source) {
  const appt=ctx.appointments[apptId], outcome=oa2Outcome_(value);
  if(!appt) throw new Error('Unknown appointment ID; no outcome recorded.');
  if(outcome===null) throw new Error('Only Show / No Show / blank is supported.');
  const managed=appt.provenance!=='legacy_show',retainedShow=managed&&outcome==='Show'&&appt.outcome==='Show'&&appt.state==='completed';
  if(outcome && !retainedShow && (['canceled','superseded','reschedule_requested'].includes(appt.state) || !appt.date || appt.date>ctx.today) && managed) throw new Error('Canceled, unscheduled or future appointment cannot receive an outcome.');
  const supplied=oa2Date_(arrivalDate);
  if(!managed&&oa2Text_(arrivalDate)&&!supplied)throw new Error('Invalid arrival date.');
  // User policy: a new managed Show uses its verified appointment date. H stays
  // an internal projection; retained completed historical evidence is immutable.
  const date=outcome==='Show'?(managed?(retainedShow?appt.arrivalDate:appt.date):(supplied||(appt.outcome==='Show'?appt.arrivalDate:'')||'')):'';
  if(date && date>ctx.today) throw new Error('Arrival date cannot be in the future.');
  if(appt.outcome===outcome && appt.arrivalDate===date) return false;
  const before=oa2StateView_(appt);
  if(outcome==='Show'&&managed&&!retainedShow)appt.pendingArrivalOverride='scheduled';
  else if(outcome==='Show' && !appt.outcome && supplied!==oa2QueueArrivalDate_(appt))appt.pendingArrivalOverride=supplied;
  appt.revision++; appt.outcome=outcome; appt.arrivalDate=date; appt.outcomeAt=ctx.now; appt.updatedAt=ctx.now;
  appt.state=outcome?'completed':appt.date?'active':'unscheduled';
  appt.generatedArrivalDate=outcome==='Show' && appt.pendingArrivalOverride==='scheduled' && date===appt.date && appt.provenance!=='legacy_show'?date:'';
  oa2Event_(ctx,appt,outcome?'outcome_changed':'outcome_cleared',before,source||'queue_edit'); return true;
}
function oa2ImportLegacyShow_(ctx,q,record) {
  if(!q.entryId || !q.customerKey || oa2Outcome_(q.outcome)!=='Show') return null;
  const id='legacy_'+oa2Hash_(q.entryId);
  if(ctx.appointments[id]) return ctx.appointments[id];
  // No appointment/arrival/booking dates are guessed. Existing evidence is retained verbatim in A:S.
  const a={id,leadId:record?record.leadId:'legacy_'+oa2Hash_(q.entryId),account:q.account,customerKey:q.customerKey,phone:record?record.phone:(oa2Text_(q.customerKey).match(/\|p:(\d{8})$/)||[])[1]||'',name:record?record.name:'',brand:record?record.brand:'',treatment:q.treatment,branch:q.branch,createdAt:record?oa2Date_(record.createdAt):'',date:oa2Date_(q.date),time:oa2Time_(q.time),bookedAt:'',provenance:'legacy_show',state:'completed',outcome:'Show',arrivalDate:oa2Date_(q.arrivalDate),outcomeAt:'',revision:1,previousId:'',queueId:q.entryId,lastStatus:'show',lastSchedule:oa2Date_(q.date)+'|'+oa2Time_(q.time),firstSeenAt:ctx.now,updatedAt:ctx.now,generatedArrivalDate:''};
  ctx.appointments[id]=a; oa2Event_(ctx,a,'legacy_show_preserved',null,'migration'); return a;
}
/** Test oracle only. Native dashboard integration is separately reviewed.
 * Compatibility: one earliest retained lifetime stage date per person; repeat visits remain in registry detail.
 */
function oa2MetricPeople_(appointments,type,start,end) {
  const first={};
  Object.keys(appointments).forEach(id=>{const a=appointments[id];let day='';if(type==='book')day=oa2Date_(a.bookedAt);else if(type==='show'&&a.outcome==='Show')day=a.arrivalDate;else if(type==='no_show'&&a.outcome==='No Show')day=a.date;
    const digits=oa2Text_(a.phone).replace(/\D/g,''),key=digits.length>=8?a.account+'|'+digits.slice(-8):a.account+'|lead:'+(a.leadId||a.id||id);
    if(day&&(!first[key]||day<first[key]))first[key]=day;
  });return Object.keys(first).filter(key=>first[key]>=start&&first[key]<=end).length;
}

function oa2QueueAction_(ctx,apptId,action) {
  const a=ctx.appointments[apptId]; if(!a) throw new Error('Unknown appointment ID');
  const state=action==='取消'?'canceled':action==='改期'?'reschedule_requested':action==='待到店'?(a.date?'active':'unscheduled'):null;
  if(!state) throw new Error('Unsupported appointment action');
  // A managed cancellation is an explicit correction of the current outcome.
  // Imported historical evidence and rescheduling retain their existing guard.
  if(a.outcome && (action!=='取消' || a.provenance==='legacy_show')) throw new Error('Clear the outcome before canceling or rescheduling this appointment.');
  if(a.state===state && !a.outcome) return false;
  const before=oa2StateView_(a);
  if(a.outcome) {
    a.outcome=''; a.arrivalDate=''; a.generatedArrivalDate=''; a.outcomeAt=ctx.now;
  }
  a.revision++; a.state=state; a.updatedAt=ctx.now;
  // One revision and one audit transition retain the original completion in Before.
  oa2Event_(ctx,a,action==='取消'?'canceled':action==='改期'?'reschedule_requested':'pending_restored',before,'queue_edit'); return true;
}

/** Spreadsheet adapter. Public preview/verify functions NEVER create sheets, write cells or install triggers. */
function oa2Enabled_() { return PropertiesService.getScriptProperties().getProperty(OA2.PROP)==='1'; }
function oa2Spreadsheet_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function oa2Header_(sheet,row) { return sheet.getRange(row,1,1,Math.max(sheet.getLastColumn(),1)).getDisplayValues()[0].map(oa2Text_); }
function oa2ExactHeaders_(sheet,row,start,headers) {
  const h=oa2Header_(sheet,row); if(headers.some((v,i)=>h[start+i-1]!==v)) throw new Error(sheet.getName()+' header contract does not match.');
}
function oa2Meta_(sheet,allowMissing) {
  const h=oa2Header_(sheet,1), indices=OA2.ACCOUNT_HEADERS.map(x=>h.indexOf(x)+1);
  if(allowMissing && indices.every(x=>x===0)) return null;
  if(indices.some(x=>x===0) || indices.some((x,i)=>x!==indices[0]+i) || OA2.ACCOUNT_HEADERS.some(x=>h.filter(y=>y===x).length!==1)) throw new Error(sheet.getName()+' arrival metadata headers missing, duplicated or not contiguous.');
  return indices[0];
}
function oa2ReadRegistry_(ss) {
  const sh=ss.getSheetByName(OA2.LEDGER), result={appointments:{},rows:{},original:{}}; if(!sh) return result;
  oa2ExactHeaders_(sh,1,1,OA2.LEDGER_HEADERS);
  if(sh.getLastRow()<2) return result;
  sh.getRange(2,1,sh.getLastRow()-1,OA2_FIELDS.length).getValues().forEach((row,i)=>{
    const id=oa2Text_(row[0]); if(!id) return; if(result.appointments[id]) throw new Error('Duplicate appointment ID in registry.');
    // Sheets may coerce an ISO override in AB to DATE; keep day provenance canonical and retain sentinels.
    const a={}; OA2_FIELDS.forEach((f,j)=>a[f]=j===27?(oa2Date_(row[j])||oa2Text_(row[j])):[9,10,16,25].includes(j)?oa2Date_(row[j]):j===11?oa2Time_(row[j]):row[j] instanceof Date?row[j].toISOString():row[j]);
    a.revision=Number(a.revision)||1; result.appointments[id]=a; result.rows[id]=i+2; result.original[id]=JSON.stringify(a);
  }); return result;
}
/** Logical queue columns remain the original A:Z contract in all recovery code.
 * Only physical access changes: optional read-only CS同事名 is allowed at B.
 * Header validation is per operation; no cross-execution layout cache.
 */
const OA2_QUEUE_BASE_HEADERS = ['客人／預約','預約日期','時間','結果','到店日期','備註','檢查提示','Account','客人識別','電話末4','療程','分店','原預約日期（自動）','可追溯Book日期（自動）','Book日期來源（自動）','補充Book登記日期','穩定客戶識別（內部）','到店紀錄ID（內部）','客戶＋預約日期時間（內部）'];
function oa2QueueLayout_(sheet,allowMissing) {
  const headers=oa2Header_(sheet,OA2.HEADER_ROW),prefix=headers[0]==='品牌'&&headers[1]==='電話'?2:0;
  if((headers.includes('品牌')||headers.includes('電話'))&&!prefix)throw new Error('Arrival display prefix must be unique Brand/Phone columns.');
  const cs=headers.reduce((out,h,i)=>{if(h==='CS同事名')out.push(i+1);return out;},[]);
  if(cs.length>1||(cs.length===1&&cs[0]!==2+prefix))throw new Error('Arrival CS header must follow its governed layout.');
  const expected=OA2_QUEUE_BASE_HEADERS.concat(OA2.QUEUE_HEADERS),columns=expected.map((h,i)=>prefix+i+1+(i>0?cs.length:0)),metadata=OA2.QUEUE_HEADERS.map((h,i)=>oa2Text_(headers[columns[19+i]-1])),missing=metadata.every(v=>!v);
  expected.forEach((h,i)=>{if(i>=19&&allowMissing&&missing)return;if(headers[columns[i]-1]!==h||headers.filter(v=>v===h).length!==1)throw new Error('Arrival header contract missing, duplicated or moved: '+h);});
  return {columns,csColumn:cs[0]||0,width:columns[25],maxColumns:sheet.getMaxColumns(),metadataMissing:missing};
}
function oa2QueueCell_(layout,column,row) {return '$'+columnLetter_(layout.columns[column-1])+row;}
function oa2QueueRange_(sheet,layout,row,column,height,width) {
  const selected=layout.columns.slice(column-1,column-1+width);
  if(selected.length!==width)throw new Error('Invalid logical arrival range.');
  const first=selected[0],span=selected[selected.length-1]-first+1;
  const read=method=>{
    const available=Math.max(0,Math.min(span,layout.maxColumns-first+1));
    const values=available?sheet.getRange(row,first,height,available)[method]():Array.from({length:height},()=>[]);
    return values.map(values=>selected.map(col=>values[col-first]===undefined?'':values[col-first]));
  };
  const blocks=[];selected.forEach((physical,index)=>{const last=blocks[blocks.length-1];if(last&&physical===last.start+last.width)last.width++;else blocks.push({start:physical,index,width:1});});
  const range={
    getValues:()=>read('getValues'),getDisplayValues:()=>read('getDisplayValues'),
    setValues:values=>{
      if(values.length!==height||values.some(v=>!Array.isArray(v)||v.length!==width))throw new Error('Arrival payload dimensions do not match.');
      // Input block first, label last: an interrupted allocation must never look
      // like a labelled row whose scheduled arrival date was deliberately cleared.
      blocks.slice().reverse().forEach(block=>sheet.getRange(row,block.start,height,block.width).setValues(values.map(v=>v.slice(block.index,block.index+block.width))));
      return range;
    },
  };
  ['clearDataValidations','setNumberFormat','setDataValidation'].forEach(method=>range[method]=(...args)=>{blocks.forEach(block=>sheet.getRange(row,block.start,height,block.width)[method](...args));return range;});
  return range;
}
function oa2WriteQueueRowGroups_(sheet,layout,items,column,width) {
  oa2RowGroups_(items).forEach(group=>oa2QueueRange_(sheet,layout,group[0].row,column,group.length,width).setValues(group.map(item=>item.values)));
}
function oa2ReadQueue_(ss,allowMissing) {
  const sh=ss.getSheetByName(OA2.ARRIVAL);if(!sh)throw new Error('Missing arrival sheet.');
  const layout=oa2QueueLayout_(sh,allowMissing),count=Math.max(0,sh.getLastRow()-OA2.FIRST_ROW+1);if(!count)return [];
  const manual=oa2QueueManualColumns_(sh),all=sh.getRange(OA2.FIRST_ROW,1,count,sh.getLastColumn()).getValues();
  return all.map((full,i)=>{const v=layout.columns.map(c=>full[c-1]),manualEntered=manual.some(c=>oa2Text_(full[c])!=='');return {row:OA2.FIRST_ROW+i,raw:v,label:v[0],date:v[1],time:v[2],outcome:v[3],arrivalDate:v[4],remark:v[5],account:v[7],treatment:v[10],branch:v[11],customerKey:oa2Text_(v[16]),entryId:oa2Text_(v[17]),appointmentId:oa2Text_(v[19]),origin:oa2Text_(v[25]),manualEntered,blank:!manualEntered&&[0,1,2,3,4,5,15,16,19].every(j=>!oa2Text_(v[j]))};});
}
function oa2HistoryStart_(sheet) {
  const start=Math.max(2,Number(PropertiesService.getScriptProperties().getProperty('OA2_HISTORY_REPLAY_FROM')||2));
  if(start>sheet.getLastRow()+1)throw new Error('History checkpoint cursor exceeds journal; review history integrity.');return start;
}
function oa2AdvanceHistoryCursor_(ss,nextRow){if(!Number.isInteger(nextRow)||nextRow<2)throw new Error('Invalid applied history cursor.');PropertiesService.getScriptProperties().setProperty('OA2_HISTORY_REPLAY_FROM',String(nextRow));}
function oa2ReplayCheckpoints_(ss,registry) {
  const history=ss.getSheetByName(OA2.HISTORY);if(!history)return 2;const last=history.getLastRow();if(last<2)return 2;
  oa2ExactHeaders_(history,1,1,OA2.HISTORY_HEADERS);
  const start=oa2HistoryStart_(history);if(start>last)return last+1;
  history.getRange(start,1,last-start+1,OA2.HISTORY_HEADERS.length).getValues().forEach(row=>{
    if(row[4]!=='state_checkpoint')return;const a=JSON.parse(row[6]);if(!a.id||!a.leadId)throw new Error('Invalid appointment checkpoint.');
    const old=registry.appointments[a.id];
    if(!old || Number(a.revision)>Number(old.revision) || (Number(a.revision)===Number(old.revision)&&!old.queueId&&a.queueId))registry.appointments[a.id]=a;
  });return last+1;
}
function oa2CheckpointChanges_(ctx) {
  Object.keys(ctx.appointments).forEach(id=>{const a=ctx.appointments[id],after=JSON.stringify(a);if(ctx.original[id]===after)return;
    ctx.events.push(['cp_'+oa2Hash_(id+'|'+after),ctx.now,id,a.leadId,'state_checkpoint',ctx.original[id]||'{}',after,'commit_recovery']);
  });
}
function oa2Context_(ss,dryRun,trace) {
  const registry=omniEditStage_(trace,'registry_read',()=>oa2ReadRegistry_(ss)),historyNextRow=omniEditStage_(trace,'history_replay',()=>oa2ReplayCheckpoints_(ss,registry)); let seq=0; const now=new Date().toISOString();
  const ctx=Object.assign(registry,{historyNextRow,now,today:oa2Date_(new Date(now)),events:[],errors:[],id:kind=>dryRun?'preview_'+kind+'_'+(++seq):kind+'_'+Utilities.getUuid(),dryRun});omniEditStage_(trace,'source_anchor_replay',()=>oa2ReplayAllSourceAnchors_(ss,ctx));ctx.retiredQueueAppointmentIds=oa4RetiredAppointmentIds_();return ctx;
}
function oa2CustomerKey_(row,c,account) {
  const phone=last8_(row[c.PHONE-1]),email=clean_(row[c.EMAIL-1]).toLowerCase(),social=clean_(row[c.SOCIAL_USERNAME-1]).toLowerCase();
  return phone?account+'|p:'+phone:email?account+'|e:'+email:social?account+'|i:'+social:'';
}
/** Assignment/default fields alone never create a customer record. */
function oa2HasBusinessPayload_(row,c) {
  return Object.keys(c).some(k=>!['ACCOUNT','BRAND','CREATED_AT','LAST_UPDATED','STATUS','CS_OWNER'].includes(k) && clean_(row[c[k]-1]));
}
function oa2Record_(row,number,sheet,c,meta,cachedAccount) {
  const account=cachedAccount===undefined?sheet.getName():cachedAccount,phone=last8_(row[c.PHONE-1]);
  const meaningful=oa2HasBusinessPayload_(row,c);
  return {row:number,meaningful,account,phone,fullPhone:oa2Text_(row[c.PHONE-1]),customerKey:oa2CustomerKey_(row,c,account),name:clean_(row[c.NAME-1]),brand:clean_(row[c.BRAND-1]),treatment:clean_(row[c.TREATMENT-1]||row[c.OFFER-1]),branch:clean_(row[c.BRANCH-1]),createdAt:row[c.CREATED_AT-1],updatedAt:oa2Date_(row[c.LAST_UPDATED-1]),status:row[c.STATUS-1],date:row[c.APPOINTMENT_DATE-1],time:row[c.APPOINTMENT_TIME-1],confirmedAt:row[c.SHOW_DATE-1],email:clean_(row[c.EMAIL-1]).toLowerCase(),social:clean_(row[c.SOCIAL_USERNAME-1]).toLowerCase(),leadId:meta?oa2Text_(row[meta-1]):'',appointmentId:meta?oa2Text_(row[meta]):'',bookedAt:meta?row[meta+1]:'',outcome:meta?row[meta+2]:'',outcomeAt:meta?row[meta+3]:'',pendingSnapshot:meta?oa2Text_(row[meta+4]):''};
}
function oa2AccountSnapshot_(sheet,allowMissing) {
  const c=getOmniColumns_(sheet),meta=oa2Meta_(sheet,allowMissing),height=Math.max(0,sheet.getLastRow()-1),width=sheet.getLastColumn();
  const values=height?sheet.getRange(2,1,height,width).getValues():[];
  // Resolve the tab name once for this snapshot, never once per source row.
  // No cache is shared with another execution or a later snapshot.
  const account=values.length?sheet.getName():undefined;
  const records=values.map((row,i)=>oa2Record_(row,i+2,sheet,c,meta,account));
  // Match legacy current-person selection: latest updated date then later source row.
  // Phone-less rows stay separate, preserving the metric row-fallback contract.
  const current={}; records.forEach(r=>{if(!r.meaningful)return; const key=r.phone?r.account+'|'+r.phone:r.account+'|row:'+r.row; const prev=current[key]; if(!prev || r.updatedAt>=prev.updatedAt) current[key]=r;});
  const currentRows=new Set(Object.keys(current).map(k=>current[k].row));
  records.forEach(r=>r.isCurrent=currentRows.has(r.row));
  return {sheet,c,meta,values,records,width};
}
function oa2NativeDate_(s) { const day=oa2Date_(s); return day?new Date(day+'T00:00:00+08:00'):''; }
function oa2NativeTime_(s) { const t=oa2Time_(s); if(!t)return '';const p=t.split(':').map(Number);return(p[0]*60+p[1])/1440; }
function oa2LedgerRow_(a) { return OA2_FIELDS.map((f,i)=>[9,10,16,25].includes(i)?oa2NativeDate_(a[f]):i===11?oa2NativeTime_(a[f]):[12,17,23,24].includes(i) && a[f]?new Date(a[f]):a[f]==null?'':a[f]); }
function oa2WriteRegistry_(ss,ctx) {
  if(ctx.dryRun)throw new Error('Dry run cannot write registry.');
  const sh=ss.getSheetByName(OA2.LEDGER),changed=[],appended=[];
  Object.keys(ctx.appointments).forEach(id=>{const a=ctx.appointments[id];if(ctx.original[id]===JSON.stringify(a))return;if(ctx.rows[id])changed.push({row:ctx.rows[id],values:oa2LedgerRow_(a),id});else appended.push({id,values:oa2LedgerRow_(a)});});
  oa2WriteRowGroups_(sh,changed,1,OA2_FIELDS.length);
  changed.forEach(x=>ctx.original[x.id]=JSON.stringify(ctx.appointments[x.id]));
  if(appended.length){const start=sh.getLastRow()+1;oa2EnsureRows_(sh,start+appended.length-1);sh.getRange(start,1,appended.length,OA2_FIELDS.length).setValues(appended.map(x=>x.values));appended.forEach((x,i)=>{ctx.rows[x.id]=start+i;ctx.original[x.id]=JSON.stringify(ctx.appointments[x.id]);});}
}
function oa2WriteHistory_(ss,ctx) {
  const appliedNext=Math.max(2,Number(ctx.historyNextRow)||2);if(!ctx.events.length)return appliedNext; if(ctx.dryRun)throw new Error('Dry run cannot write history.');
  const sh=ss.getSheetByName(OA2.HISTORY),start=oa2HistoryStart_(sh),last=sh.getLastRow(),existing=new Set(last>=start?sh.getRange(start,1,last-start+1,1).getValues().map(r=>r[0]):[]),seen=new Set(),rows=ctx.events.filter(e=>{if(existing.has(e[0])||seen.has(e[0]))return false;seen.add(e[0]);return true;});
  if(rows.length){oa2EnsureRows_(sh,last+rows.length);sh.getRange(last+1,1,rows.length,OA2.HISTORY_HEADERS.length).setValues(rows);}
  // Advance only through the replayed snapshot and our contiguous applied append; unseen journal growth stays replayable.
  return last+1===appliedNext?last+rows.length+1:appliedNext;
}
function oa2EnsureRows_(sh,last) {if(sh.getMaxRows()<last)sh.insertRowsAfter(sh.getMaxRows(),last-sh.getMaxRows());}
function oa2WriteRowGroups_(sh,items,col,width) {
  const sorted=items.slice().sort((a,b)=>a.row-b.row); let group=[];
  function flush(){if(group.length){sh.getRange(group[0].row,col,group.length,width).setValues(group.map(x=>x.values));group=[];}}
  sorted.forEach(x=>{if(group.length && x.row!==group[group.length-1].row+1)flush();group.push(x);});flush();
}
function oa2AssertSourceUnchanged_(snap) {
  if(!snap.values.length)return;
  const now=snap.sheet.getRange(2,1,snap.values.length,snap.width).getValues();
  if(JSON.stringify(now)!==JSON.stringify(snap.values))throw new Error('Source changed during processing; safe retry required.');
}
function oa2ReplayAnchor_(ctx,anchor,leadId,account) {
  if(anchor.leadId!==leadId||anchor.account!==account||!anchor.appointments)throw new Error('Source recovery anchor identity mismatch.');
  anchor.appointments.forEach(a=>{if(a.leadId!==leadId||a.account!==account||!a.id)throw new Error('Invalid source appointment anchor.');const old=ctx.appointments[a.id];if(!old||Number(a.revision)>Number(old.revision)||(Number(a.revision)===Number(old.revision)&&!old.queueId&&a.queueId))ctx.appointments[a.id]=a;});
  const seen=new Set(ctx.events.map(e=>e[0]));(anchor.events||[]).forEach(e=>{if(!seen.has(e[0])){ctx.events.push(e);seen.add(e[0]);}});
}
function oa2ReplayAllSourceAnchors_(ss,ctx) {
  // Only the one sparse pending column is scanned across Accounts, before ANY queue outcome processing.
  OMNI_ACCOUNT_TABS.forEach(name=>{const sh=ss.getSheetByName(name);if(!sh||sh.getLastRow()<2)return;const meta=oa2Meta_(sh,true);if(!meta)return;
    const pending=sh.getRange(2,meta+5,sh.getLastRow()-1,1).getValues().map((v,i)=>({row:i+2,json:oa2Text_(v[0])})).filter(v=>v.json);
    oa2RowGroups_(pending).forEach(group=>{const ids=sh.getRange(group[0].row,meta,group.length,1).getValues();group.forEach((p,i)=>oa2ReplayAnchor_(ctx,JSON.parse(p.json),oa2Text_(ids[i][0]),name));});
  });
}
function oa2ReplaySourceAnchors_(ctx,snap) {
  snap.records.forEach(r=>{if(!r.pendingSnapshot)return;const anchor=JSON.parse(r.pendingSnapshot);oa2ReplayAnchor_(ctx,anchor,r.leadId,r.account);r.appointmentId=anchor.currentAppointmentId;const current=ctx.appointments[r.appointmentId];if(current)r.bookedAt=current.bookedAt;});
}
function oa2WriteSourceAnchors_(snap,ctx) {
  if(!snap.values.length)return;const values=snap.values.map(row=>row.slice(snap.meta-1,snap.meta+5));let changed=false;
  snap.records.forEach(r=>{if(!r.meaningful||(snap.deferredRows&&snap.deferredRows.has(r.row)))return;const index=r.row-2;if(values[index][0]!==r.leadId){values[index][0]=r.leadId;changed=true;}
    const appointments=Object.keys(ctx.appointments).map(id=>ctx.appointments[id]).filter(a=>a.leadId===r.leadId&&ctx.original[a.id]!==JSON.stringify(a));
    if(appointments.length){values[index][5]=JSON.stringify({leadId:r.leadId,account:r.account,currentAppointmentId:r.appointmentId,appointments,events:ctx.events.filter(e=>e[3]===r.leadId)});changed=true;}
  });
  if(!changed)return;
  const changedRows=values.map((row,i)=>({row:i+2,values:row})).filter(x=>JSON.stringify(x.values)!==JSON.stringify(snap.values[x.row-2].slice(snap.meta-1,snap.meta+5)));
  if(!changedRows.length)return;
  oa2AssertSourceUnchanged_(snap);
  // Each changed row's ID and complete recovery intent remain one atomic
  // six-cell write. All anchor groups finish before history/registry writes.
  // If a later group fails, earlier persisted anchors remain replayable.
  oa2RowGroups_(changedRows).forEach(group=>{
    const start=group[0].row,current=snap.sheet.getRange(start,1,group.length,snap.width).getValues();
    group.forEach((x,i)=>{if(JSON.stringify(current[i])!==JSON.stringify(snap.values[x.row-2]))throw new Error('Account rows changed or sorted during anchor processing; preserving them for stable-ID retry.');});
    snap.sheet.getRange(start,snap.meta,group.length,6).setValues(group.map(x=>x.values));
  });
  snap.anchoredValues=values;
}
function oa2WriteAccountMeta_(snap) {
  if(!snap.meta)throw new Error('Run explicit setup before writing metadata.');
  const changed=snap.records.filter(r=>r.meaningful&&!(snap.deferredRows&&snap.deferredRows.has(r.row))).map(r=>({row:r.row,values:[r.leadId,r.appointmentId,r.bookedAt?new Date(r.bookedAt):'',r.outcome==='Show'?'已到店':r.outcome,r.outcomeAt?new Date(r.outcomeAt):'','']})).filter(x=>JSON.stringify(x.values)!==JSON.stringify((snap.anchoredValues?snap.anchoredValues[x.row-2]:snap.values[x.row-2].slice(snap.meta-1,snap.meta+5))));
  oa2RowGroups_(changed).forEach(g=>{const start=g[0].row,current=snap.sheet.getRange(start,1,g.length,snap.width).getValues();g.forEach((x,i)=>{const expected=snap.values[x.row-2].slice();if(snap.anchoredValues)snap.anchoredValues[x.row-2].forEach((v,j)=>expected[snap.meta-1+j]=v);if(JSON.stringify(current[i])!==JSON.stringify(expected))throw new Error('Account rows changed or sorted during processing; preserving them for stable-ID retry.');});snap.sheet.getRange(start,snap.meta,g.length,6).setValues(g.map(x=>x.values));});
}
function oa2QueueLabel_(a,record) {
  const bound=record&&record.account===a.account&&record.leadId===a.leadId;
  const key=oa2Text_(a.customerKey),email=key.indexOf(a.account+'|e:')===0?key.slice(a.account.length+3):bound&&record.email,social=key.indexOf(a.account+'|i:')===0?key.slice(a.account.length+3):bound&&record.social;
  const fullPhone=bound?oa2Text_(record.fullPhone):'',phone=oa2Text_(a.phone),verifiedPhone=/^\d{8}$/.test(phone)&&key===a.account+'|p:'+phone;
  const name=bound?oa2Text_(record.name):oa2Text_(a.name);
  return a.account+' · '+(fullPhone?'電話 '+fullPhone:verifiedPhone?'電話尾8 '+phone:email?'Email '+email:social?'IG/FB '+social:name?'客人 '+name:'未填聯絡資料');
}

function oa2QueueMetadata_(a,origin,ctx) {return[a.id,a.revision,oa2QueueState_(a,ctx.today),a.outcomeAt?new Date(a.outcomeAt):'',a.leadId,a.bookedAt?new Date(a.bookedAt):'',origin||'managed'];}
function oa2QueueStatus_(a) {return a.outcome==='Show'?'已到店':a.outcome || (a.state==='canceled'?'取消':a.state==='reschedule_requested'?'改期':'待到店');}
function oa2QueueInputState_(q){return JSON.stringify([oa2Date_(q.date),oa2Time_(q.time),oa2Text_(q.outcome),oa2Date_(q.arrivalDate)]);}
/** Compare calendar/time meaning across native Date and numeric time readbacks; invalid inputs still differ. */
function oa2QueueInputMatches_(q,a) {
  const desired={date:a.date,time:a.time,outcome:oa2QueueStatus_(a),arrivalDate:oa2QueueArrivalDate_(a)};
  return oa2QueueInputState_(q)===oa2QueueInputState_(desired) && [q.date,q.arrivalDate].every(v=>!oa2Text_(v)||!!oa2Date_(v)) && (!oa2Text_(q.time)||!!oa2Time_(q.time));
}
/** Durable ownership preflight shared by interactive and background outcome paths.
 * Generated Account labels may still show a verified appointment's former owner
 * after a journaled transfer. Reconstruct the same customer suffix under that
 * governed Account rather than requiring the projection to be current already.
 */
function oa2PreflightQueueOwnership_(ctx,queue) {
  queue.forEach(q=>{
    if(!q.appointmentId)return;
    const a=ctx.appointments[q.appointmentId];if(!a){ctx.errors.push('Unknown queue appointment ID '+q.appointmentId);return;}
    if(a.provenance==='legacy_show'){if(q.origin!=='legacy_show')ctx.errors.push('Queue origin/provenance mismatch '+a.id);return;}
    const raw=q.raw||[],allocating=q.origin==='allocating'&&raw.slice(0,6).every(v=>!oa2Text_(v));
    if(allocating){if(oa2Text_(raw[19])!==a.id||oa2Text_(raw[23])!==a.leadId||oa2Text_(raw[25])!=='allocating'||q.entryId&&q.entryId!==a.queueId)ctx.errors.push('Partial queue allocation ownership mismatch '+a.id);return;}
    const prefix=a.account+'|',suffix=oa2Text_(a.customerKey).indexOf(prefix)===0?oa2Text_(a.customerKey).slice(a.account.length):'',sameLocation=q.account===a.account&&q.customerKey===a.customerKey,retainedLocation=OMNI_ACCOUNT_TABS.includes(q.account)&&!!suffix&&q.customerKey===q.account+suffix;
    if(q.origin!=='managed'||q.entryId!==a.queueId||oa2Text_(raw[17])!==a.queueId||oa2Text_(raw[19])!==a.id||oa2Text_(raw[23])!==a.leadId||oa2Text_(raw[25])!=='managed'||oa2Text_(raw[7])!==q.account||oa2Text_(raw[16])!==q.customerKey||(!sameLocation&&!retainedLocation))ctx.errors.push('Managed queue ownership mismatch '+a.id);
  });
}
function oa2AbsorbQueueInputs_(ctx,queue) {
  oa2PreflightQueueOwnership_(ctx,queue);if(ctx.errors.length)return;
  queue.forEach(q=>{
    if(!q.appointmentId)return;
    if(q.origin==='allocating' && q.raw.slice(0,6).every(v=>!oa2Text_(v)))return;
    const a=ctx.appointments[q.appointmentId];if(!a){ctx.errors.push('Unknown queue appointment ID '+q.appointmentId);return;}
    if(q.entryId!==a.queueId && !(q.origin==='allocating'&&!q.entryId)){ctx.errors.push('Queue identity mismatch '+q.appointmentId);return;}
    // A persisted before-image distinguishes an unfinished script refresh from a new staff edit.
    if(a.pendingQueueBefore && a.pendingQueueBefore===oa2QueueInputState_(q))return;
    const actual=oa2Text_(q.outcome),expected=oa2QueueStatus_(a),display=oa2QueueArrivalDate_(a);
    // A pending input changes only its display provenance, never actual arrival evidence or outcome time.
    if(!a.outcome && a.provenance!=='legacy_show' && (oa2Outcome_(actual)==='' || actual==='改期') && (oa2Date_(q.arrivalDate)!==display || (oa2Text_(q.arrivalDate)&&!oa2Date_(q.arrivalDate)))) {
      try {if(a.pendingArrivalOverride || oa2Text_(q.arrivalDate))oa2SetPendingArrivalDate_(ctx,a.id,q.arrivalDate,'queue_reconciliation',false);}
      catch(e){ctx.errors.push('Arrival row '+q.row+': '+e.message);}
    }
    if(actual!==expected || (a.outcome && oa2Date_(q.arrivalDate)!==a.arrivalDate)) {
      try {if(['取消','改期'].includes(actual) || (actual==='待到店' && ['canceled','reschedule_requested'].includes(a.state)))oa2QueueAction_(ctx,a.id,actual);else oa2SetOutcome_(ctx,a.id,actual,q.arrivalDate,'queue_reconciliation');}
      catch(e){ctx.errors.push('Arrival row '+q.row+': '+e.message);}
    }
    if(q.origin==='managed' && (oa2Date_(q.date)!==a.date || oa2Time_(q.time)!==a.time))ctx.errors.push('Arrival row '+q.row+': schedule changed outside Account; review rather than overwrite.');
  });
}
function oa2AllocateQueue_(ss,ctx,queue,ops) {
  const slots=queue.filter(q=>q.blank),adds=ops.filter(o=>o.kind==='append'),used=new Set(),reserved=new Set(),preferred=new Map(),owners={};let next=Math.max(OA2.FIRST_ROW,ss.getSheetByName(OA2.ARRIVAL).getLastRow()+1);
  // A persisted queue ID has one appointment owner, including unfinished prior commits.
  Object.keys(ctx.appointments).forEach(id=>{const a=ctx.appointments[id];if(!a.queueId)return;if(owners[a.queueId]&&owners[a.queueId]!==id)throw new Error('Duplicate queue entry ownership '+a.queueId);owners[a.queueId]=id;});
  // Reserve every existing recovery slot before any newly queued appointment takes a blank slot.
  adds.forEach(op=>{
    const matches=queue.filter(q=>q.entryId===op.appt.queueId);
    if(matches.length>1)throw new Error('Duplicate queue entry ID '+op.appt.queueId);
    const q=op.row?queue.find(q=>q.row===op.row):matches[0];
    if(!q)return;
    if((q.appointmentId&&q.appointmentId!==op.appt.id)||(!op.row&&!q.blank))throw new Error('Queue recovery slot is occupied '+op.appt.queueId);
    if(reserved.has(q.row))throw new Error('Duplicate queue row ownership '+q.row);
    preferred.set(op,q);reserved.add(q.row);
  });
  adds.forEach(op=>{
    let q=preferred.get(op);
    if(!q&&!op.recovery)q=slots.find(x=>!used.has(x.row)&&!reserved.has(x.row));
    if(q){used.add(q.row);op.row=q.row;op.entryId=q.entryId||op.entryId;op.prior=q;}
    else {op.row=next++;op.entryId=op.appt.queueId||op.entryId||ctx.id('arrival');op.prior=null;}
    op.appt.queueId=op.entryId;
  });
}
function oa2RowGroups_(items) {
  const sorted=items.slice().sort((a,b)=>a.row-b.row),groups=[];sorted.forEach(x=>{const g=groups[groups.length-1];if(g&&x.row===g[g.length-1].row+1)g.push(x);else groups.push([x]);});return groups;
}
function oa2AssertQueueBinding_(raw,a,origin) {
  if(oa2Text_(raw[17])!==a.queueId || oa2Text_(raw[19])!==a.id || oa2Text_(raw[25])!==origin)throw new Error('Arrival rows changed or sorted during processing; preserving stable-ID bindings for retry.');
}
function oa2WriteQueue_(ss,ctx,queue,operations,records) {
  if(ctx.dryRun)throw new Error('Dry run cannot write queue.');if(!operations.length)return;const sh=ss.getSheetByName(OA2.ARRIVAL),layout=oa2QueueLayout_(sh,false),recordById={};(records||[]).forEach(r=>recordById[r.leadId]=r);
  const adds=operations.filter(o=>o.kind==='append'),metadata=[],refresh=[],schedules=[],payload=[],descriptions=[],identities=[],associations=[],checks=[],relocations=[];
  if(adds.length)oa2EnsureRows_(sh,Math.max(...adds.map(o=>o.row)));
  // Fresh full-row snapshots cover only affected contiguous rows; all input/binding guards remain.
  const fresh={};oa2RowGroups_(operations.map(op=>({row:op.row}))).forEach(g=>{const first=g[0].row,values=oa2QueueRange_(sh,layout,first,1,g.length,26).getValues();values.forEach((raw,i)=>fresh[first+i]=raw);});
  operations.forEach(op=>{
    const a=op.appt,q=queue.find(x=>x.row===op.row),current=fresh[op.row]||[];
    if(op.kind==='append') {
      const owned=oa2Text_(current[19])===a.id&&oa2Text_(current[25])==='allocating';
      if(!owned && oa2QueueRowHasManualData_(sh,op.row))throw new Error('Arrival slot contains staff-entered source or money; preserving it.');
      if(!owned&&[0,1,2,3,4,5,15,16,19].some(j=>oa2Text_(current[j])))throw new Error('Arrival slot was edited concurrently; preserving staff input.');
      const r=recordById[a.leadId];if(owned && oa2Text_(current[0]) && oa2Text_(current[0])!==oa2QueueLabel_(a,r))throw new Error('Partially allocated arrival identity changed; preserving it for review.');payload.push({row:op.row,values:[oa2QueueLabel_(a,r),oa2NativeDate_(a.date),oa2NativeTime_(a.time),oa2QueueStatus_(a),oa2NativeDate_(oa2QueueArrivalDate_(a)),owned?current[5]:'']});
      descriptions.push({row:op.row,values:[a.account,a.name,oa2Text_(a.phone).slice(-4),a.treatment,a.branch,oa2NativeDate_(a.date),a.bookedAt?oa2NativeDate_(a.bookedAt):'',a.bookedAt?'正式登記時間（自動）':'舊預約：登記日期待核對']});
      identities.push({row:op.row,values:[a.customerKey,a.queueId]});
      associations.push({row:op.row,values:['=IF('+oa2QueueCell_(layout,1,op.row)+'="","",'+oa2QueueCell_(layout,17,op.row)+'&"|"&IF('+oa2QueueCell_(layout,2,op.row)+'="","待填日期",TEXT('+oa2QueueCell_(layout,2,op.row)+',"yyyy-mm-dd"))&"|"&IF('+oa2QueueCell_(layout,3,op.row)+'="","未填時間",TEXT('+oa2QueueCell_(layout,3,op.row)+',"hh:mm")))']});
      checks.push({row:op.row,values:[oa2QueueCheckFormula_(layout,op.row)]});
    }else if(op.kind==='schedule_only'&&q&&q.origin==='managed') {
      oa2AssertQueueBinding_(current,a,q.origin);
      const r=recordById[a.leadId];
      if(!r||r.appointmentId!==a.id||r.leadId!==a.leadId||r.account!==a.account||r.customerKey!==a.customerKey||!r.phone||String(r.phone)!==String(a.phone)||oa2Text_(current[23])!==a.leadId||oa2Text_(current[7])!==a.account||oa2Text_(current[16])!==a.customerKey)throw new Error('Schedule recovery requires verified source and queue ownership.');
      if(JSON.stringify(current.slice(1,5))!==JSON.stringify(q.raw.slice(1,5)))throw new Error('Arrival input changed during schedule recovery; preserving staff input.');
      schedules.push({row:op.row,values:[oa2NativeDate_(a.date),oa2NativeTime_(a.time)]});
    }else if(q&&q.origin!=='legacy_show') {
      oa2AssertQueueBinding_(current,a,q.origin);
      const r=recordById[a.leadId],verifiedSource=!!(r && r.account===a.account && r.appointmentId===a.id && r.leadId===a.leadId && r.customerKey===a.customerKey && r.phone && String(r.phone)===String(a.phone));
      if(verifiedSource && (q.account!==a.account || q.customerKey!==a.customerKey || oa2Text_(current[0])!==oa2QueueLabel_(a,r))) {
        if(!r || r.account!==a.account || r.appointmentId!==a.id || r.leadId!==a.leadId || r.customerKey!==a.customerKey || !r.phone || String(r.phone)!==String(a.phone))throw new Error('Account projection requires verified current source ownership.');
        if(oa2Text_(current[23])!==a.leadId || oa2Text_(current[7])!==q.account || oa2Text_(current[16])!==q.customerKey || q.customerKey!==q.account+'|p:'+String(a.phone))throw new Error('Arrival Account identity changed during relocation; preserving it.');
        relocations.push({row:op.row,appt:a,origin:q.origin,account:q.account,customerKey:q.customerKey,oldLabel:current[0],label:oa2QueueLabel_(a,r)});
      }
      const values=[oa2NativeDate_(a.date),oa2NativeTime_(a.time),oa2QueueStatus_(a),oa2NativeDate_(oa2QueueArrivalDate_(a))];
      if(!oa2QueueInputMatches_(q,a)) {
        if(JSON.stringify(current.slice(1,5))!==JSON.stringify(q.raw.slice(1,5)))throw new Error('Arrival outcome changed during processing; preserving staff input for retry.');
        refresh.push({row:op.row,values});
      }
    }
    const meta=oa2QueueMetadata_(a,q&&q.origin==='legacy_show'?'legacy_show':'managed',ctx);if(op.kind==='schedule_only')meta[2]=op.state;
    metadata.push({row:op.row,expectedOrigin:op.kind==='append'?'allocating':q.origin,values:meta});
  });
  // Write-ahead owner marker first; incomplete payloads remain safely identifiable on retry.
  oa2WriteQueueRowGroups_(sh,layout,adds.map(o=>({row:o.row,values:oa2QueueMetadata_(o.appt,'allocating',ctx)})),20,7);
  oa2WriteQueueRowGroups_(sh,layout,identities,17,2);
  oa2RowGroups_(payload).forEach(g=>{const first=g[0].row,now=oa2QueueRange_(sh,layout,first,1,g.length,6).getValues();g.forEach((x,i)=>{if(JSON.stringify(now[i])!==JSON.stringify(fresh[x.row].slice(0,6)))throw new Error('Staff edited arrival inputs during allocation; preserving them for retry.');});oa2QueueRange_(sh,layout,first,1,g.length,6).setValues(g.map(x=>x.values));});oa2WriteQueueRowGroups_(sh,layout,descriptions,8,8);oa2WriteQueueRowGroups_(sh,layout,associations,19,1);oa2WriteQueueRowGroups_(sh,layout,checks,7,1);
  const validation=adds.length?SpreadsheetApp.newDataValidation().requireValueInList(['待到店','已到店','No Show','取消','改期'],true).setAllowInvalid(false).build():null;
  oa2RowGroups_(adds).forEach(g=>{const row=g[0].row,n=g.length;oa2QueueRange_(sh,layout,row,1,n,1).clearDataValidations();oa2QueueRange_(sh,layout,row,2,n,1).setNumberFormat('yyyy-mm-dd');oa2QueueRange_(sh,layout,row,3,n,1).setNumberFormat('hh:mm');oa2QueueRange_(sh,layout,row,5,n,1).setNumberFormat('yyyy-mm-dd');oa2QueueRange_(sh,layout,row,4,n,1).setDataValidation(validation);});
  // Re-read each contiguous refresh immediately before its one grouped write.
  oa2RowGroups_(refresh).forEach(g=>{const first=g[0].row,now=oa2QueueRange_(sh,layout,first,1,g.length,26).getValues();g.forEach((x,i)=>{const q=queue.find(q=>q.row===x.row);oa2AssertQueueBinding_(now[i],ctx.appointments[q.appointmentId],q.origin);if(JSON.stringify(now[i].slice(1,5))!==JSON.stringify(q.raw.slice(1,5)))throw new Error('Arrival outcome changed during processing; preserving staff input for retry.');});oa2QueueRange_(sh,layout,first,2,g.length,4).setValues(g.map(x=>x.values));});
  // A deferred result remains staff input. Only its verified schedule and state
  // hint change; actual arrival, outcome, colleague and revenue cells are retained.
  oa2RowGroups_(schedules).forEach(g=>{const first=g[0].row,now=oa2QueueRange_(sh,layout,first,1,g.length,26).getValues();g.forEach((x,i)=>{const q=queue.find(q=>q.row===x.row),a=ctx.appointments[q.appointmentId];oa2AssertQueueBinding_(now[i],a,q.origin);if(oa2Text_(now[i][23])!==a.leadId||oa2Text_(now[i][7])!==a.account||oa2Text_(now[i][16])!==a.customerKey||JSON.stringify(now[i].slice(1,5))!==JSON.stringify(q.raw.slice(1,5)))throw new Error('Arrival input or ownership changed before schedule write; preserving staff input.');});oa2QueueRange_(sh,layout,first,2,g.length,2).setValues(g.map(x=>x.values));});
  // Generated Account identity only: colleague, outcome and money columns are untouched.
  relocations.forEach(change=>{
    const now=oa2QueueRange_(sh,layout,change.row,1,1,26).getValues()[0];
    oa2AssertQueueBinding_(now,change.appt,change.origin);
    if(oa2Text_(now[23])!==change.appt.leadId || oa2Text_(now[7])!==change.account || oa2Text_(now[16])!==change.customerKey)throw new Error('Arrival identity changed before Account write; retry safely.');
    const first=layout.columns[7],last=layout.columns[16];
    if(last-first!==9)throw new Error('Account identity block is not contiguous.');
    const block=sh.getRange(change.row,first,1,10),values=block.getValues()[0],formulas=block.getFormulas()[0];
    const payload=values.map((value,i)=>formulas[i]||value);payload[0]=change.appt.account;payload[9]=change.appt.customerKey;
    // Account and customer key change together in one native write; preserve any intervening formulas.
    if(change.account!==change.appt.account || change.customerKey!==change.appt.customerKey)block.setValues([payload]);
    const labelCell=oa2QueueRange_(sh,layout,change.row,1,1,1);
    if(JSON.stringify(labelCell.getValues()[0][0])!==JSON.stringify(change.oldLabel))throw new Error('Arrival display identity changed before write; retry safely.');
    labelCell.setValues([[change.label]]);
  });
  oa2RowGroups_(metadata).forEach(g=>{const now=oa2QueueRange_(sh,layout,g[0].row,1,g.length,26).getValues();g.forEach((x,i)=>oa2AssertQueueBinding_(now[i],ctx.appointments[x.values[0]],x.expectedOrigin));oa2QueueRange_(sh,layout,g[0].row,20,g.length,7).setValues(g.map(x=>x.values));});
}
function oa2FilterQueueOps_(ctx,queue,ops,records) {
  const sourceByLead={};(records||[]).forEach(r=>sourceByLead[r.leadId]=r);
  return ops.filter(op=>{if(op.kind==='append')return true;const q=queue.find(q=>q.row===op.row);if(!q)return true;
    const a=op.appt,meta=oa2QueueMetadata_(a,q.origin,ctx);
    const r=sourceByLead[a.leadId],verified=records===undefined || !!(r && r.account===a.account && r.appointmentId===a.id && r.customerKey===a.customerKey && r.phone && String(r.phone)===String(a.phone));
    return (verified && (q.account!==a.account || q.customerKey!==a.customerKey)) || !!a.pendingQueueBefore || !oa2QueueInputMatches_(q,a)||JSON.stringify(meta)!==JSON.stringify(q.raw.slice(19,26));
  });
}
function oa2Commit_(ss,ctx,queue,ops,snaps,projectionRecords) {
  if(ctx.errors.length)throw new Error(ctx.errors.join('\n'));if(ctx.dryRun)throw new Error('Attempt to commit a dry run.');
  oa2QueueLayout_(ss.getSheetByName(OA2.ARRIVAL),false); // Validate before source anchors, history or registry writes.
  (snaps||[]).forEach(oa2AssertSourceUnchanged_);
  oa2AllocateQueue_(ss,ctx,queue,ops);
  ops.forEach(op=>{const q=queue.find(q=>q.row===op.row);if(!op.appt.pendingQueueBefore)op.appt.pendingQueueBefore=q?oa2QueueInputState_(q):'new';});
  // The first mutation anchors each source record and its full intended appointment in one metadata write.
  (snaps||[]).forEach(s=>oa2WriteSourceAnchors_(s,ctx));
  // Registry identity is persisted before remaining account pointers or queue cells.
  oa2CheckpointChanges_(ctx);const nextHistoryRow=oa2WriteHistory_(ss,ctx);oa2WriteRegistry_(ss,ctx);
  (snaps||[]).forEach(oa2WriteAccountMeta_);
  oa2WriteQueue_(ss,ctx,queue,ops,projectionRecords||(snaps||[]).reduce((out,s)=>out.concat(s.records),[]));
  // A completed queue update clears its recovery before-image. Interrupted updates retain it.
  ops.forEach(op=>op.appt.pendingQueueBefore='');
  oa2WriteRegistry_(ss,ctx);oa2AdvanceHistoryCursor_(ss,nextHistoryRow);
}
/** Worker recovery isolates owned schedule/outcome evidence conflicts without discarding durable registry/journal recovery.
 * Identity ambiguity remains fatal. Stage each appointment transition before accepting it, so a
 * schedule/date error cannot leak a partial outcome or revision into an otherwise valid commit.
 */
function oa2ShouldDeferQueueOutcome_(ctx,q,a) {
  if(q.origin!=='managed'||q.entryId!==a.queueId||!q.raw||oa2Text_(q.raw[23])!==a.leadId||a.provenance==='legacy_show')return false;
  const outcome=oa2Outcome_(q.outcome);
  if(!outcome)return false;
  if(outcome==='Show'&&a.outcome==='Show'&&a.state==='completed')return false;
  return ['canceled','superseded','reschedule_requested'].includes(a.state)||!a.date||a.date>ctx.today;
}
function oa2AbsorbWorkerQueueInputs_(ctx,queue) {
  const seen=new Set(),deferred=new Set();
  queue.forEach(q=>{
    if(!q.appointmentId)return;
    if(seen.has(q.appointmentId))ctx.errors.push('Duplicate queue appointment ID '+q.appointmentId);
    seen.add(q.appointmentId);
    const a=ctx.appointments[q.appointmentId];
    if(!a)ctx.errors.push('Unknown queue appointment ID '+q.appointmentId);
    else if(q.entryId!==a.queueId && !(q.origin==='allocating'&&!q.entryId))ctx.errors.push('Queue identity mismatch '+q.appointmentId);
  });
  oa2PreflightQueueOwnership_(ctx,queue);if(ctx.errors.length)return deferred;
  queue.forEach(q=>{
    if(!q.appointmentId)return;
    const id=q.appointmentId,a=ctx.appointments[id];
    const recoveringBefore=a.pendingQueueBefore&&a.pendingQueueBefore===oa2QueueInputState_(q);
    if(q.origin==='managed'&&!recoveringBefore&&(oa2Date_(q.date)!==a.date||oa2Time_(q.time)!==a.time)){deferred.add(id);return;}
    // An exactly owned row with incomplete outcome evidence needs local review.
    // Keep its registry, source and queue unchanged while unrelated records commit.
    if(oa2ShouldDeferQueueOutcome_(ctx,q,a)){deferred.add(id);return;}
    const staged=Object.assign({},ctx,{appointments:{},events:[],errors:[]});
    staged.appointments[id]=oa2Clone_(ctx.appointments[id]);
    oa2AbsorbQueueInputs_(staged,[q]);
    if(staged.errors.length){ctx.errors.push(...staged.errors);return;}
    ctx.appointments[id]=staged.appointments[id];
    ctx.events.push(...staged.events);
  });
  return deferred;
}
function oa2WorkerPlanContext_(ctx,deferred) {
  const appointments={};Object.keys(ctx.appointments).forEach(id=>{if(!deferred.has(id))appointments[id]=ctx.appointments[id];});
  return Object.assign({},ctx,{appointments});
}

/** Catch up a missed authoritative source schedule without accepting an outcome.
 * Only a unique, exactly owned, still-open managed appointment can change. Queue
 * inputs must match either the retained schedule or the corrected source schedule.
 * The logical absorption copy retains raw cells for the existing fresh-write CAS.
 */
function oa2CatchUpSourceSchedules_(ctx,snap,queue,appointmentIds,edit) {
  const scope=appointmentIds?new Set(appointmentIds):null;
  const leads={},pointers={},queues={},plans=[],changed=new Set(),blocked=new Set(),logical=new Map();
  (snap.records||[]).forEach(r=>{if(!r.meaningful)return;if(r.leadId)leads[r.leadId]=(leads[r.leadId]||0)+1;if(r.appointmentId)pointers[r.appointmentId]=(pointers[r.appointmentId]||0)+1;});
  queue.forEach(q=>{if(!q.appointmentId)return;(queues[q.appointmentId]||(queues[q.appointmentId]=[])).push(q);});
  Object.keys(leads).forEach(id=>{if(leads[id]>1&&(!scope||(snap.records||[]).some(r=>r.leadId===id&&scope.has(r.appointmentId))))ctx.errors.push('Duplicate source Lead ID before schedule recovery.');});
  Object.keys(queues).forEach(id=>{if(queues[id].length>1&&(!scope||scope.has(id)))ctx.errors.push('Duplicate queue appointment ID '+id);});
  (snap.records||[]).forEach(r=>{
    const a=r.appointmentId&&ctx.appointments[r.appointmentId],rows=a&&queues[a.id];
    if(!r.meaningful||!a||!rows||rows.length!==1||(scope&&!scope.has(a.id))||a.outcome||a.provenance==='legacy_show'||!['active','unscheduled','reschedule_requested'].includes(a.state))return;
    if(edit&&edit.forceNew&&r.row>=edit.firstRow&&r.row<=edit.lastRow)return;
    if(Object.keys(ctx.appointments).some(id=>{const x=ctx.appointments[id];return x.id!==a.id&&x.leadId===a.leadId&&x.provenance!=='legacy_show'&&x.previousId===a.id;}))return;
    const q=rows[0],date=oa2Date_(r.date),time=oa2Time_(r.time),status=oa2Status_(r.status);
    if(!['booked','show','no_show'].includes(status))return;
    const invalid=(!!oa2Text_(r.date)&&!date)||(!!oa2Text_(r.time)&&!time),differs=date!==a.date||time!==a.time||a.state==='unscheduled'&&!!date;
    let before;
    if(a.pendingQueueBefore){try{before=JSON.parse(a.pendingQueueBefore);}catch(ignored){}}
    const replay=Array.isArray(before)&&before.length===4&&before.every(v=>typeof v==='string')&&
      (oa2QueueInputState_(q)===a.pendingQueueBefore||oa2QueueInputState_(q)===JSON.stringify([a.date,a.time,before[2],before[3]]));
    if(!differs&&!replay&&!invalid)return;
    if(!r.leadId||leads[r.leadId]!==1||pointers[a.id]!==1||r.leadId!==a.leadId||r.account!==a.account||r.customerKey!==a.customerKey||!r.phone||String(r.phone)!==String(a.phone)||
      q.origin!=='managed'||q.entryId!==a.queueId||q.account!==a.account||q.customerKey!==a.customerKey||!q.raw||oa2Text_(q.raw[17])!==a.queueId||oa2Text_(q.raw[19])!==a.id||oa2Text_(q.raw[23])!==a.leadId||oa2Text_(q.raw[25])!=='managed'){
      const transferred=ctx.events.some(e=>{if(e[2]!==a.id||e[4]!=='account_transferred')return false;try{const before=JSON.parse(e[5]);return before.account===q.account&&before.customerKey===q.customerKey;}catch(ignored){return false;}});
      if(transferred)return;
      ctx.errors.push('Source/queue ownership mismatch before schedule recovery.');return;
    }
    // A malformed current source schedule cannot authorize an outcome against
    // a stale retained date. Isolate only this exactly owned record for review.
    if(invalid){blocked.add(a.id);return;}
    const qDate=oa2Date_(q.date),qTime=oa2Time_(q.time),validQueue=(!oa2Text_(q.date)||!!qDate)&&(!oa2Text_(q.time)||!!qTime);
    const oldMatch=qDate===a.date&&qTime===a.time,newMatch=qDate===date&&qTime===time;
    if(!validQueue||(!oldMatch&&!newMatch&&!replay))return;
    plans.push({r,a,q,date,time,status,differs,oldDisplay:replay&&a.pendingArrivalOverride==='scheduled'&&before[3]===before[0]?before[0]:oa2QueueArrivalDate_(a)});
  });
  if(ctx.errors.length)return {changed,blocked,queue};
  plans.forEach(p=>{
    const {r,a,q,date,time,status}=p;
    if(p.differs){const before=oa2StateView_(a);a.date=date;a.time=time;a.state=date?'active':'unscheduled';a.lastStatus=status;a.lastSchedule=date+'|'+time;a.revision++;a.updatedAt=ctx.now;oa2Event_(ctx,a,'source_schedule_caught_up',before,'source_schedule_recovery');}
    r.appointmentId=a.id;r.bookedAt=a.bookedAt;r.outcome=a.outcome||'';r.outcomeAt=a.outcomeAt;
    const input=Object.assign({},q,{date,time});
    // An unchanged generated pending display follows its new schedule. Explicit
    // clears/overrides and every submitted outcome keep their original evidence.
    if(oa2Outcome_(q.outcome)===''&&a.pendingArrivalOverride==='scheduled'&&oa2Date_(q.arrivalDate)===p.oldDisplay&&(!oa2Text_(q.arrivalDate)||!!oa2Date_(q.arrivalDate)))input.arrivalDate=oa2QueueArrivalDate_(a);
    logical.set(a.id,input);changed.add(a.id);
  });
  return {changed,blocked,queue:queue.map(q=>logical.get(q.appointmentId)||q)};
}

/** A deferred outcome retains staff input while a verified source schedule catches up. */
function oa2ScheduleOnlyQueueOps_(ctx,queue,changed,deferred) {
  return queue.filter(q=>changed.has(q.appointmentId)&&deferred.has(q.appointmentId)).map(q=>({kind:'schedule_only',appt:ctx.appointments[q.appointmentId],row:q.row,state:oa2Outcome_(q.outcome)==='Show'?'已到店：預約日期待核對':'結果待核對'}));
}

function oa2ProcessAccount_(ss,sheet,mode,edit,dryRun,trace) {
  const ctx=oa2Context_(ss,dryRun,trace),snap=omniEditStage_(trace,'account_snapshot',()=>oa2AccountSnapshot_(sheet,dryRun)),queue=omniEditStage_(trace,'arrival_queue_read',()=>oa2ReadQueue_(ss,dryRun));
  oa2ReplaySourceAnchors_(ctx,snap);oa2RehomeMovedAccountAppointments_(ss,ctx,snap);const scheduleRecovery=oa2CatchUpSourceSchedules_(ctx,snap,queue,null,edit),deferred=oa2AbsorbWorkerQueueInputs_(ctx,scheduleRecovery.queue.filter(q=>!scheduleRecovery.blocked.has(q.appointmentId)));scheduleRecovery.blocked.forEach(id=>deferred.add(id));const deferredLeadIds=new Set(Array.from(deferred,id=>ctx.appointments[id].leadId));snap.deferredRows=new Set();
  const duplicates={};snap.records.forEach(r=>{if(r.leadId){if(duplicates[r.leadId])ctx.errors.push('Duplicate Lead ID in '+sheet.getName());duplicates[r.leadId]=true;}});
  snap.records.forEach(r=>{
    if(!r.meaningful)return;if(oa2IsHistoricalCrossAccountRecord_(ctx,r)){snap.deferredRows.add(r.row);return;}if(deferred.has(r.appointmentId)||deferredLeadIds.has(r.leadId)){if(!scheduleRecovery.changed.has(r.appointmentId))snap.deferredRows.add(r.row);return;} if(!r.leadId)r.leadId=ctx.id('lead');
    const touched=edit && r.row>=edit.firstRow && r.row<=edit.lastRow;
    if(touched) {r.bookingMutation=[snap.c.STATUS,snap.c.APPOINTMENT_DATE,snap.c.APPOINTMENT_TIME].some(c=>c>=edit.firstCol&&c<=edit.lastCol);r.forceNew=!!edit.forceNew;}
    // Arrival operations preserve every distinct source appointment, including repeat customers.
    // The person-level current selection remains unchanged for reporting projections.
    const visitStatus=oa2Status_(r.status);
    if(r.isCurrent || visitStatus==='show')oa2EnsureUnqueuedSourceShow_(ctx,r,queue);
    if(r.isCurrent || visitStatus==='booked' || visitStatus==='show' || r.appointmentId || (touched && r.bookingMutation))oa2ReconcileRecord_(ctx,r,touched?'edit':mode==='initialize'?'initialize':'scan');
  });
  const ops=oa2FilterQueueOps_(ctx,queue,oa2PlanQueue_(oa2WorkerPlanContext_(ctx,deferred),queue),snap.records).concat(oa2ScheduleOnlyQueueOps_(ctx,queue,scheduleRecovery.changed,deferred));
  const result={dryRun,account:sheet.getName(),records:snap.records.filter(r=>r.meaningful).length,appointments:Object.keys(ctx.appointments).length,newQueue:ops.filter(o=>o.kind==='append').length,changes:ctx.events.length,deferredQueueConflicts:deferred.size,deferredSourceRecords:snap.deferredRows.size,errors:ctx.errors};
  if(!dryRun)omniEditStage_(trace,'arrival_commit',()=>oa2Commit_(ss,ctx,queue,ops,[snap]));if(!dryRun&&typeof oa3AfterSync_==='function')oa3AfterSync_(ss);try{console.log(JSON.stringify({handler:'omni_arrival_reconciliation',dryRun,deferredReason:deferred.size?'queue_input_needs_review':'',deferredQueueConflicts:deferred.size,deferredSourceRecords:snap.deferredRows.size}));}catch(ignored){}return result;
}
function verifyOmniArrivalV2() {
  const ss=oa2Spreadsheet_(),issues=[],details={};
  if(ss.getSpreadsheetTimeZone()!==OA2.TZ)issues.push('Spreadsheet timezone must be Asia/Hong_Kong; project timezone is not changed.');
  OMNI_ACCOUNT_TABS.forEach(n=>{try{const s=ss.getSheetByName(n);if(!s)throw new Error('missing');getOmniColumns_(s);details[n]={metadataStart:oa2Meta_(s,true),rows:s.getLastRow()};}catch(e){issues.push(n+': '+e.message);}});
  try{const q=oa2ReadQueue_(ss,true);details.queue={rows:q.length,legacyShows:q.filter(r=>oa2Outcome_(r.outcome)==='Show'&&!r.appointmentId).length,blankSlots:q.filter(r=>r.blank).length};}catch(e){issues.push(e.message);}
  try{details.registry=Object.keys(oa2ReadRegistry_(ss).appointments).length;}catch(e){issues.push(e.message);}
  const result={version:OA2.VERSION,enabled:oa2Enabled_(),readOnly:true,issues,details};console.log(JSON.stringify(result));return result;
}
function previewOmniArrivalV2() {
  const ss=oa2Spreadsheet_(),sheet=ss.getActiveSheet();
  if(!sheet || !OMNI_ACCOUNT_TABS.includes(sheet.getName()))return verifyOmniArrivalV2();
  const result=oa2ProcessAccount_(ss,sheet,'scan',null,true);console.log(JSON.stringify(result));return result;
}
/** EXPLICIT MUTATION: adds internal columns/sheets only. Does not enable automation, install triggers or change A:Y/A:S. */
function prepareOmniArrivalV2() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))throw new Error('Busy; retry setup later.');
  try {
    const ss=oa2Spreadsheet_();if(ss.getSpreadsheetTimeZone()!==OA2.TZ)throw new Error('Spreadsheet timezone must already be Asia/Hong_Kong.');
    const queue=ss.getSheetByName(OA2.ARRIVAL),layout=oa2QueueLayout_(queue,true);
    OMNI_ACCOUNT_TABS.forEach(n=>{const sh=ss.getSheetByName(n);getOmniColumns_(sh);if(oa2Meta_(sh,true))return;const col=sh.getLastColumn()+1;if(sh.getMaxColumns()<col+5)sh.insertColumnsAfter(sh.getMaxColumns(),col+5-sh.getMaxColumns());sh.getRange(1,col,1,6).setValues([OA2.ACCOUNT_HEADERS]);sh.hideColumns(col,2);sh.hideColumns(col+5,1);});
    if(queue.getMaxColumns()<layout.width)queue.insertColumnsAfter(queue.getMaxColumns(),layout.width-queue.getMaxColumns());oa2QueueRange_(queue,layout,OA2.HEADER_ROW,20,1,7).setValues([OA2.QUEUE_HEADERS]);queue.hideColumns(layout.columns[19],7);oa2RowGroups_(oa2ReadQueue_(ss,false).filter(q=>q.blank)).forEach(g=>oa2QueueRange_(queue,layout,g[0].row,1,g.length,1).clearDataValidations());
    [[OA2.LEDGER,OA2.LEDGER_HEADERS],[OA2.HISTORY,OA2.HISTORY_HEADERS]].forEach(pair=>{let sh=ss.getSheetByName(pair[0]);if(!sh)sh=ss.insertSheet(pair[0]);if(sh.getMaxColumns()<pair[1].length)sh.insertColumnsAfter(sh.getMaxColumns(),pair[1].length-sh.getMaxColumns());if(sh.getLastRow()===0)sh.getRange(1,1,1,pair[1].length).setValues([pair[1]]);else {
      // Review5 adds only AB after the existing A:AA registry contract; no prior column is moved.
      if(pair[0]===OA2.LEDGER && !oa2Text_(sh.getRange(1,28).getDisplayValue())) {oa2ExactHeaders_(sh,1,1,pair[1].slice(0,27));sh.getRange(1,28).setValues([[pair[1][27]]]);}
      oa2ExactHeaders_(sh,1,1,pair[1]);
    }sh.setFrozenRows(1);if(!sh.isSheetHidden())sh.hideSheet();});
    return verifyOmniArrivalV2();
  }finally{lock.releaseLock();}
}
/** EXPLICIT REVIEW5 MUTATION: only linked, still-pending managed queue rows receive their scheduled E display.
 * Run after prepareOmniArrivalV2 has appended registry AB. No enable flag, trigger, source A:Y, or historical Show changes.
 */
function syncPendingOmniArrivalDatesV2() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))throw new Error('Busy; retry pending date setup later.');
  try {
    const ss=oa2Spreadsheet_(),ctx=oa2Context_(ss,false),queue=oa2ReadQueue_(ss,false),selected=[];
    queue.forEach(q=>{const a=ctx.appointments[q.appointmentId];
      if(!a || q.origin!=='managed' || a.provenance==='legacy_show' || a.outcome || !['active','unscheduled','reschedule_requested'].includes(a.state))return;
      if(q.entryId!==a.queueId)throw new Error('Pending arrival identity mismatch.');
      if(oa2Outcome_(q.outcome)!=='' && oa2Text_(q.outcome)!=='改期')return; // Staff may have completed the row since the rollout baseline.
      selected.push(q);
    });
    oa2AbsorbQueueInputs_(ctx,selected);
    selected.forEach(q=>{const a=ctx.appointments[q.appointmentId];if(!a.pendingArrivalOverride)oa2SetPendingArrivalDate_(ctx,a.id,q.arrivalDate,'pending_date_upgrade',!oa2Text_(q.arrivalDate));});
    const ops=oa2FilterQueueOps_(ctx,selected,selected.map(q=>({kind:'refresh',appt:ctx.appointments[q.appointmentId],row:q.row})));
    oa2Commit_(ss,ctx,queue,ops,[]);const result={pendingRows:selected.length,refreshedRows:ops.length,historicalShowsTouched:0};console.log(JSON.stringify(result));return result;
  }finally{lock.releaseLock();}
}
/** EXPLICIT MUTATION: idempotent 179-row evidence migration; writes only T:Z and new internal registry/history. */
function preserveOmniArrivalHistoryV2() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))throw new Error('Busy; retry later.');try{
    const ss=oa2Spreadsheet_(),ctx=oa2Context_(ss,false),queue=oa2ReadQueue_(ss,false),metadata=[];let imported=0;
    queue.forEach(q=>{if(q.appointmentId)return;if(oa2Outcome_(q.outcome)!=='Show')return;const a=oa2ImportLegacyShow_(ctx,q,null);if(!a)return;imported++;metadata.push({row:q.row,values:oa2QueueMetadata_(a,'legacy_show',ctx)});});
    oa2WriteHistory_(ss,ctx);oa2WriteRegistry_(ss,ctx);const arrival=ss.getSheetByName(OA2.ARRIVAL);oa2WriteQueueRowGroups_(arrival,oa2QueueLayout_(arrival,false),metadata,20,7);return{imported};
  }finally{lock.releaseLock();}
}
/** EXPLICIT MUTATION: run once per Account (six calls); cursor advances only after a successful complete batch. */
function initializeOmniArrivalV2Batch() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return{busy:true};try{
    const props=PropertiesService.getScriptProperties(),i=Number(props.getProperty('OA2_INIT_ACCOUNT')||0);if(i>=OMNI_ACCOUNT_TABS.length)return{done:true};
    const ss=oa2Spreadsheet_(),result=oa2ProcessAccount_(ss,ss.getSheetByName(OMNI_ACCOUNT_TABS[i]),'initialize',null,false);props.setProperty('OA2_INIT_ACCOUNT',String(i+1));return Object.assign(result,{done:i+1===OMNI_ACCOUNT_TABS.length,nextAccount:i+1});
  }finally{lock.releaseLock();}
}
/** EXPLICIT MUTATION: enables hooks after reviewed initialization. Does not create a trigger or request scopes. */
function enableOmniArrivalV2() {if(Number(PropertiesService.getScriptProperties().getProperty('OA2_INIT_ACCOUNT')||0)<6)throw new Error('Initialize all six Accounts first.');const result=verifyOmniArrivalV2();if(result.issues.length)throw new Error(result.issues.join('\n'));PropertiesService.getScriptProperties().setProperty(OA2.PROP,'1');return{enabled:true};}
/** New persistent trigger: run ONLY after user action-time approval. Other owners' triggers remain untouched. */
function installOmniArrivalV2Timer() {
  if(!oa2Enabled_())throw new Error('Complete setup before installing a timer.');
  const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='omniArrivalV2Timer');
  if(existing.length)return{created:false,ownedMatchingTriggers:existing.length};
  ScriptApp.newTrigger('omniArrivalV2Timer').timeBased().everyMinutes(5).create();return{created:true,handler:'omniArrivalV2Timer',cadenceMinutes:5};
}
function omniArrivalV2Timer() {
  if(!oa2Enabled_())return{enabled:false};if(omniStaffPriorityActive_())return omniStaffPriorityTimerSkip_();const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return{busy:true};try{
    if(omniStaffPriorityActive_())return omniStaffPriorityTimerSkip_();
    if(typeof oa3AdmitMaintenance_==='function'){const maintenance=oa3AdmitMaintenance_(oa2Spreadsheet_());if(maintenance)return maintenance;}
    const props=PropertiesService.getScriptProperties(),i=Number(props.getProperty(OA2.CURSOR)||0)%OMNI_ACCOUNT_TABS.length,ss=oa2Spreadsheet_();
    const registered=oa2RegisterImportedLeadIds_(ss,OMNI_ACCOUNT_TABS[i]);
    console.log(JSON.stringify({handler:'arrival_source_registration',registered}));
    const result=oa2ProcessAccount_(ss,ss.getSheetByName(OMNI_ACCOUNT_TABS[i]),'scan',null,false);props.setProperty(OA2.CURSOR,String((i+1)%OMNI_ACCOUNT_TABS.length));
    const csProjection=oa2TryRefreshQueueCs_(ss,{documentLock:lock,accountNames:[OMNI_ACCOUNT_TABS[i]],includeHistory:i===0});
    return Object.assign({},result,{csProjection});
  }finally{lock.releaseLock();}
}
/** Called inside the existing account handler's document lock BEFORE its existing whole-record sort. */
/** Stable source identity precedes slow or deferred appointment reconciliation.
 * Caller owns the document lock. Existing IDs and all business fields remain intact.
 */
function oa2RegisterImportedLeadIds_(ss,account) {
  if(!OMNI_ACCOUNT_TABS.includes(account))throw new Error('Select a managed Account before source registration.');
  const sheet=ss.getSheetByName(account),last=sheet.getLastRow();
  return last>=2?oa2EnsureEditedLeadIds_(sheet,getOmniColumns_(sheet),2,last):0;
}
function registerOmniImportedLeadIds() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return {busy:true,registered:0};
  try{const ss=oa2Spreadsheet_(),account=ss.getActiveSheet().getName(),registered=oa2RegisterImportedLeadIds_(ss,account);const result={busy:false,registered};console.log(JSON.stringify(Object.assign({handler:'arrival_source_registration'},result)));return result;}
  finally{lock.releaseLock();}
}
/** One governed Account recovery; no cursor, trigger or admission policy change. */
function syncActiveOmniArrivalAccount() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return {busy:true};
  try{const ss=oa2Spreadsheet_(),sheet=ss.getActiveSheet();if(!sheet||!OMNI_ACCOUNT_TABS.includes(sheet.getName()))throw new Error('Select a managed Account before arrival recovery.');const result=oa2ProcessAccount_(ss,sheet,'scan',null,false);console.log(JSON.stringify(result));return result;}
  finally{lock.releaseLock();}
}
/** Allocate stable IDs for non-booking edits too, under the existing document lock. */
function oa2EnsureEditedLeadIds_(sheet,c,firstRow,lastRow) {
  const meta=oa2Meta_(sheet,false),width=sheet.getLastColumn(),account=sheet.getName();
  const values=sheet.getRange(firstRow,1,lastRow-firstRow+1,width).getValues(),changes=[];
  values.forEach((row,i)=>{const r=oa2Record_(row,firstRow+i,sheet,c,meta,account);if(!r.meaningful||r.leadId)return;
    if(row.slice(meta,meta+5).some(v=>oa2Text_(v)))throw new Error('Source identity missing with existing appointment metadata; preserving for review.');
    changes.push({row:firstRow+i,expected:row,values:['lead_'+Utilities.getUuid()]});
  });
  oa2RowGroups_(changes).forEach(group=>{const current=sheet.getRange(group[0].row,1,group.length,width).getValues();group.forEach((x,i)=>{if(JSON.stringify(current[i])!==JSON.stringify(x.expected))throw new Error('Source row changed before identity allocation; preserving for retry.');});sheet.getRange(group[0].row,meta,group.length,1).setValues(group.map(x=>x.values));});
  return changes.length;
}
function omniArrivalV2AccountEdit_(e,firstRow,lastRow,firstCol,lastCol,cachedSheet,trace,documentLock) {
  if(!oa2Enabled_())return;
  const sheet=cachedSheet||e.range.getSheet(),c=getOmniColumns_(sheet),ss=e.source||oa2Spreadsheet_();
  omniEditStage_(trace,'source_identity_registration',()=>oa2EnsureEditedLeadIds_(sheet,c,firstRow,lastRow));
  const bookingChanged=[c.STATUS,c.APPOINTMENT_DATE,c.APPOINTMENT_TIME].some(col=>col>=firstCol&&col<=lastCol);
  let result;
  if(bookingChanged)result=oa2ProcessAccount_(ss,sheet,'scan',{firstRow,lastRow,firstCol,lastCol},false,trace);
  if((c.CS_OWNER&&c.CS_OWNER>=firstCol&&c.CS_OWNER<=lastCol)||(result&&result.newQueue>0)) {
    const csProjection=oa2TryRefreshQueueCs_(ss,{documentLock,accountNames:[sheet.getName()],includeHistory:false});
    return Object.assign({},result||{},{csProjection});
  }
  return result;
}
/** Called only after the outer edit handler holds the document lock. */

/** Plan only explicitly edited appointments; unrelated staff inputs remain untouched for their own edit or timer.
 * Keep full context/history/anchor replay and the unchanged commit journal. A duplicate binding for an edited
 * appointment anywhere in the queue remains an error. Do not narrow the queue by row before duplicate checks.
 */
function oa2EditedQueueScope_(ctx,queue,appointmentIds) {
  const ids=new Set(appointmentIds),appointments={};
  ids.forEach(id=>{if(!ctx.appointments[id])throw new Error('Unknown edited appointment ID.');appointments[id]=ctx.appointments[id];});
  return {ctx:Object.assign({},ctx,{appointments}),queue:queue.filter(q=>ids.has(q.appointmentId))};
}

function omniArrivalV2QueueEdit_(e,admission) {
  if(!e||!e.range)return false;
  if(!admission||!admission.lockHeld)throw new Error('Arrival edit requires document-lock admission.');
  if(admission.name!==OA2.ARRIVAL)return false;
  const trace=admission.trace;
  if(!oa2Enabled_())return true;
  const layout=oa2QueueLayout_(admission.sheet,false),outcomeColumn=layout.columns[3],arrivalDateColumn=layout.columns[4];
  if(e.range.getLastRow()<OA2.FIRST_ROW || e.range.getColumn()>arrivalDateColumn || e.range.getLastColumn()<outcomeColumn)return true;
  try {
    const ss=e.source||oa2Spreadsheet_(),ctx=oa2Context_(ss,false,trace),queue=omniEditStage_(trace,'arrival_queue_read',()=>oa2ReadQueue_(ss,false)),first=Math.max(OA2.FIRST_ROW,e.range.getRow()),last=e.range.getLastRow(),changed=[];
    const editedIds=new Set(queue.filter(q=>q.row>=first&&q.row<=last&&q.appointmentId).map(q=>q.appointmentId)),snaps=[];let logicalQueue=queue;
    OMNI_ACCOUNT_TABS.forEach(name=>{if(!Array.from(editedIds).some(id=>ctx.appointments[id]&&ctx.appointments[id].account===name))return;const snap=oa2AccountSnapshot_(ss.getSheetByName(name),false);oa2ReplaySourceAnchors_(ctx,snap);const recovery=oa2CatchUpSourceSchedules_(ctx,snap,logicalQueue,editedIds);if(recovery.blocked.size)throw new Error('Account 預約日期或時間格式有誤，請先修正。');logicalQueue=recovery.queue;snaps.push(snap);});
    if(ctx.errors.length)throw new Error(ctx.errors.join('\n'));
    // An explicit arrival-date edit records even a same-date override or deliberate clear.
    if(e.range.getColumn()<=arrivalDateColumn && e.range.getLastColumn()>=arrivalDateColumn)queue.filter(q=>q.row>=first&&q.row<=last).forEach(q=>{
      const a=ctx.appointments[q.appointmentId];if(a && !a.outcome && a.provenance!=='legacy_show' && (oa2Outcome_(q.outcome)==='' || oa2Text_(q.outcome)==='改期'))oa2SetPendingArrivalDate_(ctx,a.id,q.arrivalDate,'queue_edit',false);
    });
    if(e.range.getColumn()<=arrivalDateColumn&&e.range.getLastColumn()>=arrivalDateColumn){const inputs=new Map(queue.filter(q=>q.row>=first&&q.row<=last).map(q=>[q.row,q.arrivalDate]));logicalQueue=logicalQueue.map(q=>inputs.has(q.row)?Object.assign({},q,{arrivalDate:inputs.get(q.row)}):q);}
    oa2AbsorbQueueInputs_(ctx,logicalQueue.filter(q=>q.row>=first&&q.row<=last));
    if(ctx.errors.length)throw new Error(ctx.errors.join('\n'));
    queue.filter(q=>q.row>=first&&q.row<=last).forEach(q=>{
      if(!q.appointmentId)throw new Error('This row is not linked to a managed appointment. Historical evidence is preserved; do not infer its booking.');
      if(['取消','改期'].includes(oa2Text_(q.outcome)))oa2QueueAction_(ctx,q.appointmentId,oa2Text_(q.outcome));else oa2SetOutcome_(ctx,q.appointmentId,q.outcome,q.arrivalDate,'queue_edit');changed.push(q.appointmentId);
    });
    snaps.forEach(snap=>{snap.records.forEach(r=>{const a=ctx.appointments[r.appointmentId];if(a&&changed.includes(a.id)){if(a.leadId!==r.leadId)throw new Error('Account pointer mismatch');r.outcome=a.outcome || (a.state==='canceled'?'取消':a.state==='reschedule_requested'?'改期':'');r.outcomeAt=a.outcomeAt;r.bookedAt=a.bookedAt;}});});
    const scope=oa2EditedQueueScope_(ctx,queue,changed),ops=oa2FilterQueueOps_(ctx,scope.queue,oa2PlanQueue_(scope.ctx,scope.queue));omniEditStage_(trace,'arrival_commit',()=>oa2Commit_(ss,ctx,queue,ops,snaps));return true;
  }catch(error){(e.source||oa2Spreadsheet_()).toast(String(error.message||error),'到店結果尚未接納',12);throw error;}
}
function createAnotherOmniAppointmentV2() {
  const ss=oa2Spreadsheet_(),sheet=ss.getActiveSheet(),range=sheet.getActiveRange();if(!oa2Enabled_())throw new Error('Arrival workflow is not enabled.');if(!OMNI_ACCOUNT_TABS.includes(sheet.getName())||!range||range.getNumRows()!==1||range.getRow()<2)throw new Error('Select one Account customer row first.');
  const ui=SpreadsheetApp.getUi();if(ui.alert('新建另一次預約','會保留之前的預約／到店歷史，並用此行目前的預約日期時間建立另一筆。繼續？',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))throw new Error('Busy; retry later.');try{const c=getOmniColumns_(sheet);const status=sheet.getRange(range.getRow(),c.STATUS).getDisplayValue();if(oa2Status_(status)!=='booked')throw new Error('Set Account status to 已預約 first.');const result=oa2ProcessAccount_(ss,sheet,'scan',{firstRow:range.getRow(),lastRow:range.getRow(),firstCol:1,lastCol:sheet.getLastColumn(),forceNew:true},false);if(result.newQueue>0)result.csProjection=oa2TryRefreshQueueCs_(ss,{documentLock:lock,accountNames:[sheet.getName()],includeHistory:false});return result;}finally{lock.releaseLock();}
}

/** Reject observable stale single-cell trigger events before legacy row-based writes. */
function omniArrivalV2StaleEdit_(e) {
  if(!oa2Enabled_()||!e||!e.range||e.value===undefined||e.range.getNumRows()!==1||e.range.getNumColumns()!==1)return false;
  const value=e.range.getValue();if(value instanceof Date)return false;
  if(typeof value==='string'||typeof value==='number')return clean_(value)!==clean_(e.value);return false;
}

/**
 * Arrival CS display projection. Local review candidate; installs no trigger.
 * Caller must already hold the arrival document lock. Uses current stable IDs,
 * raw ownership evidence and a second bounded read before one B write.
 * Source values, dates, appointments and outcomes are never written here.
 *
 * Deliberate CS contract (approved 2026-10-05): ownership of a uniquely identified
 * source Lead is independent of funnel eligibility and sorted master row position.
 * Therefore this helper does not read/recalculate _metric_identity_bridge or alias
 * computed B/C/E. Those existing statistical guards remain completely unchanged.
 * Legacy ownership additionally requires the stored alias A/D/F, matching Created
 * At calendar day and exact reconstructed customer key in registry AND queue.
 */
const OA2_CS = Object.freeze({
  HEADER: 'CS同事名', COLUMN: 2, REVIEW: '待核對', EMPTY: '未填CS',
  HISTORY: '歷史 CS Leads', ALIASES: '_arrival_metric_aliases',
  SOURCE_LAST_ROW: 5000,
  HISTORY_LAST_ROW: 7000, REGISTRY_LAST_ROW: 30000,
  ALIAS_LAST_ROW: 1000,
});

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
function oa2CsSourceAccount_(value, sheetName) {
  const blank = value === null || value === undefined ||
    (typeof value === 'string' && oa2CsText_(value) === '');
  return blank && OMNI_ACCOUNT_TABS.includes(sheetName) ? sheetName : value;
}
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

/** Replace the saved adapter at its existing definition, preserving every guard.
 * One bounded provider read per sheet replaces independent column reads.
 */
function oa2CsReadColumns_(ss,name,headerRow,fields,maxLastRow) {
  const sheet=ss.getSheetByName(name);if(!sheet)throw new Error('CS projection: required source sheet missing: '+name);
  const lastRow=sheet.getLastRow();if(lastRow>maxLastRow)throw new Error('CS projection: reviewed row bound exceeded: '+name);
  const headers=sheet.getRange(headerRow,1,1,Math.max(1,sheet.getLastColumn())).getDisplayValues()[0],columns={},keys=Object.keys(fields),count=Math.max(0,lastRow-headerRow);
  keys.forEach(key=>{const indices=[];headers.forEach((h,i)=>{if(oa2CsText_(h)===fields[key])indices.push(i+1);});if(indices.length!==1)throw new Error('CS projection: missing or duplicated header in '+name+': '+fields[key]);columns[key]=indices[0];});
  const first=Math.min(...Object.values(columns)),last=Math.max(...Object.values(columns)),values=count?sheet.getRange(headerRow+1,first,count,last-first+1).getValues():[];
  const rows=values.map((values,i)=>{const row={row:headerRow+1+i};keys.forEach(key=>row[key]=values[columns[key]-first]);return row;});
  return {name,lastRow,columns,rows};
}

function oa2CsCapture_(ss, options) {
  const snapshots = [], sources = [], sourceIds = [];
  const details = {cs:OA2_CS.HEADER, account:'Account', created:'Created At', phone:'電話', email:'Email', social:'IG/FB Username'};
  // Global ID-only reads catch a copied ID in another Account without reading its
  // customer matrix. Detailed fields are read for the selected Account only.
  OMNI_ACCOUNT_TABS.forEach(name => {
    const selected = options.accountNames.includes(name);
    const snap = oa2CsReadColumns_(ss, name, 1, Object.assign({id:'Omni Lead ID'}, selected ? details : {}), OA2_CS.SOURCE_LAST_ROW);
    snapshots.push(snap);
    snap.rows.forEach(row => {
      sourceIds.push({id:row.id});
      if (selected) sources.push(Object.assign({},row,{account:oa2CsSourceAccount_(row.account,name),sheet:name}));
    });
  });
  // History admission status is a funnel rule, not CS ownership. All raw stable
  // history IDs participate in uniqueness; detailed history fields rotate only.
  const history = oa2CsReadColumns_(ss, OA2_CS.HISTORY, 1,
    Object.assign({id:'遷移ID'}, options.includeHistory ? details : {}), OA2_CS.HISTORY_LAST_ROW);
  snapshots.push(history);
  history.rows.forEach(row => {
    const id = oa2CsId_(row.id) ? 'history:' + oa2CsId_(row.id) : '';
    sourceIds.push({id});
    if (options.includeHistory) sources.push(Object.assign({},row,{id,sheet:OA2_CS.HISTORY}));
  });
  const registry = oa2CsReadColumns_(ss, OA2.LEDGER, 1,
    {id:'Appointment ID', leadId:'Lead ID', account:'Account', customerKey:'Customer Key', provenance:'Registration Provenance', queueId:'Queue Entry ID'}, OA2_CS.REGISTRY_LAST_ROW);
  // Read only stored alias ownership anchors, never computed metric B/C/E.
  const aliases = oa2CsReadColumns_(ss, OA2_CS.ALIASES, 1,
    {queueId:'ArrivalRecordID', created:'Frozen Migration CreatedAt', sourceId:'Stable Source ID'}, OA2_CS.ALIAS_LAST_ROW);
  snapshots.push(registry, aliases);
  return {sources, sourceIds, appointments:registry.rows, aliases:aliases.rows,
    fingerprint:JSON.stringify(snapshots)};
}
function oa2CsQueue_(ss) {
  // oa2ReadQueue_ returns canonical pre-insertion raw indices in both layouts.
  return oa2ReadQueue_(ss, false).map(q => Object.assign({}, q, {leadId:oa2CsId_(q.raw[23]),customerKey:oa2CsId_(q.raw[16])}));
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
  const csColumn=oa2QueueLayout_(sheet,false).csColumn;
  const headers = oa2Header_(sheet, OA2.HEADER_ROW), matches = headers.filter(header => header === OA2_CS.HEADER);
  if (!matches.length) return {refreshed:0, skipped:'cs_column_not_installed'};
  if (matches.length !== 1 || headers[csColumn - 1] !== OA2_CS.HEADER) throw new Error('CS projection: CS header is not uniquely installed in B.');
  const capture = oa2CsCapture_(ss, options), queue = oa2CsQueue_(ss);
  if (!queue.length) return {refreshed:0, changed:0};
  const before = sheet.getRange(OA2.FIRST_ROW, csColumn, queue.length, 1).getValues();
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
  const range = sheet.getRange(OA2.FIRST_ROW, csColumn, queue.length, 1);
  if (JSON.stringify(range.getValues()) !== JSON.stringify(before)) throw new Error('CS projection output changed; safe retry required.');
  const changedRows=output.flatMap((values,i)=>before[i][0]!==values[0]?[{row:OA2.FIRST_ROW+i,values}]:[]);
  oa2RowGroups_(changedRows).forEach(group=>{
    const target=sheet.getRange(group[0].row,csColumn,group.length,1),freshValues=target.getValues();
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
function oa2CsActivationState_() {
  try {
    const properties=PropertiesService.getDocumentProperties();
    if(!properties)return 'unavailable';
    const raw=properties.getProperty(OA2_CS_MIGRATION.RECEIPT);
    if(!raw)return 'not_installed';
    const receipt=JSON.parse(raw);
    if(!receipt||receipt.version!==OA2_CS_MIGRATION.VERSION)return 'unverified';
    if(receipt.state==='rolled_back')return 'not_installed';
    if(receipt.state!=='verified'||!receipt.before||!receipt.after||
      receipt.before.inserted!==false||receipt.after.inserted!==true||
      !receipt.before.spreadsheetId||receipt.before.spreadsheetId!==receipt.after.spreadsheetId||
      receipt.before.sheetId!==receipt.after.sheetId||!receipt.after.fingerprint)return 'unverified';
    return 'verified';
  }catch(error){return 'unavailable';}
}
function oa2TryRefreshQueueCs_(ss,options) {
  const started=Date.now(),activation=oa2CsActivationState_();
  if(activation!=='verified') {
    const result={ok:activation==='not_installed',refreshed:0,
      skipped:activation==='not_installed'?'cs_column_not_installed':'cs_activation_'+activation,
      durationMs:Date.now()-started};
    console.log(JSON.stringify(Object.assign({handler:'arrival_cs_projection'},result)));
    return result;
  }
  try {
    const result=oa2RefreshQueueCs_(ss,options);
    console.log(JSON.stringify(Object.assign({handler:'arrival_cs_projection',ok:true,durationMs:Date.now()-started},result)));
    return Object.assign({ok:true},result);
  }catch(error) {
    const result={ok:false,reason:omniCaptureTimeout_(error)?'spreadsheet_timeout':'refresh_not_verified',durationMs:Date.now()-started};
    console.log(JSON.stringify(Object.assign({handler:'arrival_cs_projection'},result)));
    try{ss.toast('原輸入已保留；CS欄未更新，稍後自動重試。','CS欄未更新',10);}catch(ignored){}
    return result;
  }
}
function oa2HistoryCsEdit_(e,sheet,documentLock) {
  if(!oa2Enabled_()||e.range.getLastRow()<2)return;
  const headers=oa2Header_(sheet,1),matches=[];headers.forEach((h,i)=>{if(h===OA2_CS.HEADER)matches.push(i+1);});
  if(matches.length!==1)throw new Error('History CS header must be unique.');
  if(e.range.getColumn()>matches[0]||e.range.getLastColumn()<matches[0])return;
  return oa2TryRefreshQueueCs_(e.source||oa2Spreadsheet_(),{documentLock,accountNames:[],includeHistory:true});
}
/** Explicit initial fill/manual refresh; no trigger installation or source writes. */
function refreshOmniArrivalCsOwners() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(30000))throw new Error('Arrival update running; retry CS refresh later.');
  try{return oa2TryRefreshQueueCs_(oa2Spreadsheet_(),{documentLock:lock,accountNames:OMNI_ACCOUNT_TABS.slice(),includeHistory:true,initialRefresh:true});}
  finally{lock.releaseLock();}
}

/**
 * Explicit, local-review-only CS column migration. No trigger/flag changes.
 * Native insert/delete preserves Sheets references; never rewrites the old grid.
 * Public execute/rollback calls require a reviewed fingerprint from preview.
 * Filter views and their sort order are verified separately in the Sheet UI:
 * SpreadsheetApp exposes only the basic filter, not filter-view definitions.
 */
const OA2_CS_MIGRATION = Object.freeze({
  VERSION:'arrival-cs-insert-v1', MAX_ROWS:707, OLD_COLUMNS:27,
  HEADER:'CS同事名', RANK_HEADER:'到店優先排序（內部）',
  RECEIPT:'OA2_CS_COLUMN_MIGRATION_RECEIPT_V1',
});

function oa2CsMigrationHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(value),Utilities.Charset.UTF_8)
    .map(b=>((b+256)%256).toString(16).padStart(2,'0')).join('');
}
function oa2CsMigrationColumns_(inserted) {
  return Array.from({length:27},(_,i)=>i+1+(inserted&&i>0?1:0));
}
function oa2CsMigrationHeader_(sheet,inserted) {
  if(typeof oa2QueueLayout_!=='function'||typeof oa2QueueRange_!=='function')throw new Error('Install the reviewed layout-compatible source before migration.');
  const expected=OA2_QUEUE_BASE_HEADERS.concat(OA2.QUEUE_HEADERS,[OA2_CS_MIGRATION.RANK_HEADER]);
  if(inserted)expected.splice(1,0,OA2_CS_MIGRATION.HEADER);
  const actual=sheet.getRange(OA2.HEADER_ROW,1,1,sheet.getMaxColumns()).getDisplayValues()[0];
  if(sheet.getMaxColumns()!==expected.length||JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Arrival exact physical header/grid contract changed.');
  if(sheet.getMaxRows()>OA2_CS_MIGRATION.MAX_ROWS||sheet.getLastRow()>OA2_CS_MIGRATION.MAX_ROWS)throw new Error('Arrival reviewed 707-row bound exceeded; take a new review snapshot.');
  const layout=oa2QueueLayout_(sheet,false);
  if(layout.csColumn!==(inserted?2:0)||layout.width!==(inserted?27:26))throw new Error('Unexpected layout resolver contract.');
  return layout;
}

/** Shift only actual A1 references. Quoted formula strings remain byte-identical.
 * Other-sheet ranges remain unchanged. Dynamic references require separate review.
 */
function oa2CsMigrationShiftFormula_(formula,delta) {
  if(!formula)return '';
  const pieces=String(formula).match(/"(?:[^"]|"")*"|[^\"]+/g)||[];
  return pieces.map(piece=>{
    if(piece[0]==='"')return piece;
    if(/\b(?:INDIRECT|ADDRESS)\s*\(/i.test(piece))throw new Error('Arrival formula has an unsupported reference; review it before migrating.');
    const qualified=[];
    const masked=piece.replace(/('(?:[^']|'')+'|[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_.\u0080-\uFFFF]*)!([$]?[A-Z]{1,3}[$]?\d*(?::[$]?[A-Z]{1,3}[$]?\d*)?)/g,(match,name,reference)=>{
      const unquoted=name[0]==="'"?name.slice(1,-1).replace(/''/g,"'"):name;
      qualified.push(unquoted===OA2.ARRIVAL?name+'!'+oa2CsMigrationShiftFormula_(reference,delta):match);
      return '\u0001'+(qualified.length-1)+'\u0002';
    });
    if(masked.includes('!'))throw new Error('Arrival formula has an unsupported qualified reference; review it before migrating.');
    return masked.replace(/(^|[^A-Za-z0-9_.])([$]?)([A-Z]{1,3})([$]?\d+)?(?=\s*:|[,);&+\-*/^=<>\s]|$)/g,(match,prefix,absolute,letters,row,offset,whole)=>{
      // Bare column names count as references only on one side of a range colon.
      const before=whole.slice(0,offset+prefix.length),after=whole.slice(offset+match.length);
      if(!row&&!/:\s*$/.test(before)&&!/^\s*:/.test(after))return match;
      let col=0;for(let i=0;i<letters.length;i++)col=col*26+letters.charCodeAt(i)-64;
      if(delta<0&&col===2)throw new Error('An original formula now refers to the inserted CS column.');
      if(col>=2)col+=delta;
      return prefix+absolute+columnLetter_(col)+(row||'');
    }).replace(/\u0001(\d+)\u0002/g,(_,index)=>qualified[Number(index)]);
  }).join('');
}
function oa2CsMigrationRect_(range,inserted) {
  const start=range.getColumn(),end=range.getLastColumn();
  if(inserted&&(start===2||end===2))throw new Error('New CS-only layout metadata needs review before rollback.');
  return [range.getRow(),inserted&&start>2?start-1:start,range.getLastRow(),inserted&&end>2?end-1:end];
}
function oa2CsMigrationCriteria_(criteria,inserted) {
  if(!criteria)return null;
  const values=criteria.getCriteriaValues().map(value=>
    typeof value==='string'&&value[0]==='='&&inserted?oa2CsMigrationShiftFormula_(value,-1):value);
  return {type:String(criteria.getCriteriaType()),values};
}
function oa2CsMigrationNativeLayout_(sheet,inserted) {
  const columns=oa2CsMigrationColumns_(inserted),filter=sheet.getFilter();
  const basicFilter=filter?{range:oa2CsMigrationRect_(filter.getRange(),inserted),criteria:columns.map(column=>{
    if(column<filter.getRange().getColumn()||column>filter.getRange().getLastColumn())return null;
    const rule=filter.getColumnFilterCriteria(column);
    return rule?{condition:oa2CsMigrationCriteria_(rule,inserted),hidden:rule.getHiddenValues()}:null;
  })}:null;
  const protections=[];
  [SpreadsheetApp.ProtectionType.RANGE,SpreadsheetApp.ProtectionType.SHEET].forEach(type=>{
    sheet.getProtections(type).forEach(protection=>{
      const range=String(type)===String(SpreadsheetApp.ProtectionType.RANGE)?protection.getRange():null;
      protections.push({type:String(type),description:protection.getDescription(),warning:protection.isWarningOnly(),
        editable:protection.canEdit(),range:range?oa2CsMigrationRect_(range,inserted):null,
        unprotected:String(type)===String(SpreadsheetApp.ProtectionType.SHEET)?protection.getUnprotectedRanges().map(r=>oa2CsMigrationRect_(r,inserted)):[]});
    });
  });
  const conditional=sheet.getConditionalFormatRules().map(rule=>{
    const condition=rule.getBooleanCondition();
    return {ranges:rule.getRanges().map(range=>oa2CsMigrationRect_(range,inserted)),
      boolean:condition?oa2CsMigrationCriteria_(condition,inserted):null,
      gradient:!!rule.getGradientCondition()};
  });
  return {rows:sheet.getMaxRows(),frozenRows:sheet.getFrozenRows(),
    frozenColumns:sheet.getFrozenColumns()-(inserted&&sheet.getFrozenColumns()>=2?1:0),
    widths:columns.map(col=>sheet.getColumnWidth(col)),hidden:columns.map(col=>sheet.isColumnHiddenByUser(col)),
    merges:sheet.getRange(1,1,sheet.getMaxRows(),sheet.getMaxColumns()).getMergedRanges().map(range=>oa2CsMigrationRect_(range,inserted)),
    basicFilter,protections,conditional};
}
function oa2CsMigrationCapture_(ss,inserted) {
  const sheet=ss.getSheetByName(OA2.ARRIVAL);if(!sheet)throw new Error('Arrival sheet missing.');
  oa2CsMigrationHeader_(sheet,inserted);
  const rows=sheet.getMaxRows(),width=sheet.getMaxColumns(),range=sheet.getRange(1,1,rows,width);
  const values=range.getValues(),formulas=range.getFormulas(),numberFormats=range.getNumberFormats(),columns=oa2CsMigrationColumns_(inserted);
  const pick=matrix=>matrix.map(row=>columns.map(column=>row[column-1]));
  const canonicalFormulas=pick(formulas).map(row=>row.map(formula=>inserted?oa2CsMigrationShiftFormula_(formula,-1):formula));
  // Validate transformability before the first mutation, including untouched original formulas.
  if(!inserted)canonicalFormulas.forEach(row=>row.forEach(formula=>{
    if(oa2CsMigrationShiftFormula_(oa2CsMigrationShiftFormula_(formula,1),-1)!==formula)throw new Error('Formula reference transform is not reversible.');
  }));
  const canonicalValues=pick(values);
  // B7 is the only added value; all original cells, including immutable IDs and
  // formula output cells, must compare exactly before and after native insertion.
  const layout=oa2CsMigrationNativeLayout_(sheet,inserted);
  const hashes={values:oa2CsMigrationHash_(canonicalValues),formulas:oa2CsMigrationHash_(canonicalFormulas),
    numberFormats:oa2CsMigrationHash_(pick(numberFormats)),layout:oa2CsMigrationHash_(layout)};
  const source=ss.getSheetByName(OMNI_ACCOUNT_TABS[0]);if(!source)throw new Error('CS width reference Account missing.');
  const sourceColumns=getOmniColumns_(source);if(!sourceColumns.CS_OWNER)throw new Error('CS width reference header missing.');
  const result={version:OA2_CS_MIGRATION.VERSION,spreadsheetId:ss.getId(),sheetId:sheet.getSheetId(),rows,
    inserted,hashes,sourceCsWidth:source.getColumnWidth(sourceColumns.CS_OWNER),
    filterViews:'Verified separately in Sheet UI; native API does not expose filter views or sort definitions.',
    layoutLimit:'Native guard includes ranges/conditions, widths, merges and protection settings; colors, editor lists, row heights and filter-view definitions rely on existing private/UI evidence.'};
  result.fingerprint=oa2CsMigrationHash_({version:result.version,spreadsheetId:result.spreadsheetId,
    sheetId:result.sheetId,rows,inserted,hashes,sourceCsWidth:result.sourceCsWidth});
  return result;
}
function oa2CsMigrationAssertSame_(before,after) {
  if(before.spreadsheetId!==after.spreadsheetId||before.sheetId!==after.sheetId||before.rows!==after.rows||
    JSON.stringify(before.hashes)!==JSON.stringify(after.hashes))throw new Error('Original arrival cells/formulas/layout changed. Preserve the sheet and review the migration receipt.');
}
function oa2CsMigrationWithLock_(run) {
  const lock=LockService.getDocumentLock();
  if(!lock.tryLock(30000))throw new Error('Arrival operation is still running; retry after it completes.');
  try{return run(oa2Spreadsheet_());}finally{lock.releaseLock();}
}
function previewOmniArrivalCsMigration() {
  const result=oa2CsMigrationWithLock_(ss=>oa2CsMigrationCapture_(ss,false));
  console.log(JSON.stringify(result));return result;
}
function executeOmniArrivalCsMigration(expectedFingerprint) {
  return oa2CsMigrationWithLock_(ss=>{
    const before=oa2CsMigrationCapture_(ss,false);
    if(typeof expectedFingerprint!=='string'||expectedFingerprint!==before.fingerprint)throw new Error('Reviewed preview fingerprint is required and must still match.');
    const props=PropertiesService.getDocumentProperties();
    if(props.getProperty(OA2_CS_MIGRATION.RECEIPT))throw new Error('A prior CS migration receipt exists; review it before another migration.');
    const receipt={version:OA2_CS_MIGRATION.VERSION,state:'prepared',before,startedAt:new Date().toISOString()};
    props.setProperty(OA2_CS_MIGRATION.RECEIPT,JSON.stringify(receipt));
    const sheet=ss.getSheetByName(OA2.ARRIVAL);
    // The acquired DocumentLock drains active old lock holders. Old executions
    // starting later reject metadata at old T:Z after this insertion; do not run
    // an old installer/setup handler concurrently with this reviewed migration.
    sheet.insertColumnAfter(1);
    sheet.getRange(OA2.HEADER_ROW,2).setValue(OA2_CS_MIGRATION.HEADER);
    sheet.getRange(OA2.HEADER_ROW,2,sheet.getMaxRows()-OA2.HEADER_ROW+1,1).setNumberFormat('@');
    sheet.getRange(OA2.FIRST_ROW,2,sheet.getMaxRows()-OA2.FIRST_ROW+1,1).clearDataValidations();
    sheet.setColumnWidth(2,before.sourceCsWidth);
    SpreadsheetApp.flush();
    receipt.state='inserted_pending_verification';props.setProperty(OA2_CS_MIGRATION.RECEIPT,JSON.stringify(receipt));
    const after=oa2CsMigrationCapture_(ss,true);oa2CsMigrationAssertSame_(before,after);
    receipt.state='verified';receipt.after=after;receipt.completedAt=new Date().toISOString();
    props.setProperty(OA2_CS_MIGRATION.RECEIPT,JSON.stringify(receipt));
    return {state:receipt.state,before:before.fingerprint,after:after.fingerprint,insertedColumn:'B',
      csProjection:'Run the reviewed CS-only projection separately; no original cell values were rewritten.',filterViews:after.filterViews};
  });
}
function previewOmniArrivalCsRollback() {
  const result=oa2CsMigrationWithLock_(ss=>{
    const raw=PropertiesService.getDocumentProperties().getProperty(OA2_CS_MIGRATION.RECEIPT);
    if(!raw)throw new Error('No migration receipt exists.');const receipt=JSON.parse(raw);
    const current=oa2CsMigrationCapture_(ss,true);oa2CsMigrationAssertSame_(receipt.before,current);
    return {state:receipt.state,fingerprint:current.fingerprint,deleteColumn:'B only',filterViews:current.filterViews};
  });console.log(JSON.stringify(result));return result;
}
function rollbackOmniArrivalCsMigration(expectedFingerprint) {
  return oa2CsMigrationWithLock_(ss=>{
    const props=PropertiesService.getDocumentProperties(),raw=props.getProperty(OA2_CS_MIGRATION.RECEIPT);
    if(!raw)throw new Error('No migration receipt exists.');const receipt=JSON.parse(raw);
    const current=oa2CsMigrationCapture_(ss,true);
    if(typeof expectedFingerprint!=='string'||expectedFingerprint!==current.fingerprint)throw new Error('Reviewed rollback fingerprint is required and must still match.');
    oa2CsMigrationAssertSame_(receipt.before,current);
    ss.getSheetByName(OA2.ARRIVAL).deleteColumn(2);SpreadsheetApp.flush();
    const restored=oa2CsMigrationCapture_(ss,false);oa2CsMigrationAssertSame_(receipt.before,restored);
    receipt.state='rolled_back';receipt.rolledBackAt=new Date().toISOString();receipt.restored=restored.fingerprint;
    props.setProperty(OA2_CS_MIGRATION.RECEIPT,JSON.stringify(receipt));
    return {state:'rolled_back',deletedColumn:'B only',fingerprint:restored.fingerprint};
  });
}


/** Explicit one-shot catch-up. No trigger changes and no retry of a busy/failed account.
 * Each step delegates to the normal timer's own document lock, cursor, CAS, journal and CS projection.
 * 200 seconds is an admission budget, NOT a hard timeout: a native Spreadsheet call cannot be interrupted.
 * Concurrent scheduled runs may advance the shared cursor; report observed coverage, never assume six calls cover six accounts.
 */
function catchUpOmniArrivalV2() {
  const started=Date.now(),budgetMs=200000,maxCalls=6,runs=[],covered=new Set();let lastDurationMs=0,stopReason='step_limit';
  const log=value=>{try{console.log(JSON.stringify(Object.assign({handler:'arrival_catch_up'},value)));}catch(ignored){}};
  const summary=reason=>({stopReason:reason,coverageComplete:covered.size===OMNI_ACCOUNT_TABS.length,completedCalls:runs.length,
    coveredAccounts:Array.from(covered),remainingAccounts:OMNI_ACCOUNT_TABS.filter(name=>!covered.has(name)),runs,
    durationMs:Date.now()-started,admissionBudgetMs:budgetMs,hardDeadline:false});
  for(let i=0;i<maxCalls;i++) {
    const remaining=budgetMs-(Date.now()-started),reserve=Math.max(30000,Math.ceil(lastDurationMs*1.5));
    if(remaining<reserve){stopReason='time_budget';break;}
    const stepStarted=Date.now();let result;
    try{result=omniArrivalV2Timer();}
    catch(error){log(summary('account_failure'));throw error;}
    if(result&&result.busy){stopReason='busy';break;}
    if(result&&result.skipped&&result.reason==='staff_priority'){stopReason='staff_priority';break;}
    if(result&&result.enabled===false){stopReason='disabled';break;}
    if(!result||!OMNI_ACCOUNT_TABS.includes(result.account)){log(summary('unexpected_result'));throw new Error('Arrival catch-up received an unexpected timer result.');}
    lastDurationMs=Date.now()-stepStarted;covered.add(result.account);
    const run={account:result.account,newQueue:Number(result.newQueue)||0,changes:Number(result.changes)||0,
      deferredQueueConflicts:Number(result.deferredQueueConflicts)||0,csProjectionOk:!!(result.csProjection&&result.csProjection.ok),
      csChanged:Number(result.csProjection&&result.csProjection.changed)||0,durationMs:lastDurationMs};
    runs.push(run);log(Object.assign({phase:'account_complete',completedCalls:runs.length},run));
    if(covered.size===OMNI_ACCOUNT_TABS.length){stopReason='covered_all_accounts';break;}
  }
  const result=summary(stopReason);log(result);return result;
}

/** Account transfer requires a unique durable source ID and matching open appointment. */
function oa2TransferOpenAppointmentAccount_(ctx, record, sourceCount) {
  const a=ctx.appointments[record.appointmentId];
  if(!a || a.account===record.account)return false;
  if(sourceCount!==1 || a.leadId!==record.leadId || !record.phone || String(a.phone)!==String(record.phone) || (a.outcome && !(a.state==='completed' && ['Show','No Show'].includes(a.outcome))) || a.provenance==='legacy_show' || !OMNI_ACCOUNT_TABS.includes(record.account) || (!['active','unscheduled','canceled','reschedule_requested'].includes(a.state) && !(a.state==='completed' && ['Show','No Show'].includes(a.outcome)))) {
    ctx.errors.push('Account transfer requires unique source and appointment ownership.');return false;
  }
  const before=Object.assign(oa2StateView_(a),{account:a.account,customerKey:a.customerKey});
  a.account=record.account;a.customerKey=record.customerKey;a.revision++;a.updatedAt=ctx.now;
  oa2Event_(ctx,a,'account_transferred',before,'account_transfer_recovery');return true;
}
function oa2RehomeMovedAccountAppointments_(ss,ctx,snap) {
  const moved=snap.records.filter(r=>r.meaningful && r.appointmentId && ctx.appointments[r.appointmentId] && ctx.appointments[r.appointmentId].account!==r.account);
  if(!moved.length)return 0;
  const ids=new Set(moved.map(r=>r.leadId)),counts={};
  OMNI_ACCOUNT_TABS.forEach(name=>{
    const sheet=ss.getSheetByName(name),meta=oa2Meta_(sheet,false),height=Math.max(0,sheet.getLastRow()-1);
    if(height)sheet.getRange(2,meta,height,1).getValues().forEach(row=>{const id=oa2Text_(row[0]);if(ids.has(id))counts[id]=(counts[id]||0)+1;});
  });
  return moved.reduce((n,r)=>{
    const a=ctx.appointments[r.appointmentId],count=counts[r.leadId]||0;
    // An ambiguous historical source must not abort unrelated records.
    if(a.outcome && (count!==1 || a.leadId!==r.leadId || !r.phone || String(a.phone)!==String(r.phone) || a.provenance==='legacy_show' || a.state!=='completed' || !['Show','No Show'].includes(a.outcome)))return n;
    return n+Number(oa2TransferOpenAppointmentAccount_(ctx,r,count));
  },0);
}
function repairOmniArrivalAccountTransfers() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(120000))throw new Error('Arrival worker busy; retry recovery.');
  try {
    const ss=oa2Spreadsheet_(),result=oa2ProcessAccount_(ss,ss.getSheetByName('Alyssa Main'),'scan',null,false);
    console.log(JSON.stringify({handler:'account_transfer_recovery',changes:result.changes,errors:result.errors}));return result;
  } finally {lock.releaseLock();}
}

function requestOmniArrivalAccountTransferRepair() {
  PropertiesService.getScriptProperties().setProperty('OMNI_ACCOUNT_TRANSFER_REPAIR_PENDING','true');
  console.log(JSON.stringify({handler:'account_transfer_recovery',queued:true}));return {queued:true};
}
function oa2RunRequestedAccountTransferRepair_(ss) {
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('OMNI_ACCOUNT_TRANSFER_REPAIR_PENDING')!=='true')return null;
  try {
    const result=oa2ProcessAccount_(ss,ss.getSheetByName('Alyssa Main'),'scan',null,false);
    props.deleteProperty('OMNI_ACCOUNT_TRANSFER_REPAIR_PENDING');
    console.log(JSON.stringify({handler:'account_transfer_recovery',completed:true,changes:result.changes}));return result;
  } catch(ignored) {
    console.log(JSON.stringify({handler:'account_transfer_recovery',completed:false,queued:true}));return null;
  }
}


/** Visible feedback is derived from the accepted registry, never hidden Queue State. */
function oa2QueueCheckFormula_(layout,row) {
  const cell=n=>oa2QueueCell_(layout,n,row),reg="'_appointment_registry'!",ids=reg+'$A$2:$A',table=reg+'$A$2:$U';
  const field=n=>'INDEX(records,pos,'+n+')';
  return '=IF('+cell(20)+'="","",IFERROR(LET(ids,'+ids+',records,'+table+',pos,IFNA(MATCH('+cell(20)+',ids,0),1),hits,COUNTIF(ids,'+cell(20)+'),acceptedOutcome,'+field(16)+',acceptedState,'+field(15)+',acceptedDate,'+field(11)+',expected,IF(acceptedOutcome="Show","已到店",IF(acceptedOutcome<>"",acceptedOutcome,SWITCH(acceptedState,"canceled","取消","reschedule_requested","改期","待到店"))),IFS(hits<>1,"未接納：預約識別缺失或重覆，請核對",OR('+cell(24)+'<>'+field(2)+','+cell(18)+'<>'+field(21)+','+cell(8)+'<>'+field(3)+','+cell(17)+'<>'+field(4)+'),"未接納：預約身份不一致，請核對",'+cell(4)+'<>expected,IF(AND('+cell(4)+'="已到店",acceptedDate=""),"未接納：請先在 Account 補預約日期",IF(acceptedState="canceled","未接納：此預約已取消，請核對取消／到店記錄",IF(AND('+cell(4)+'="已到店",acceptedDate>TODAY()),"未接納：未來預約不能標記已到店","未接納：結果待處理；已接納結果為「"&expected&"」"))),OR('+cell(2)+'<>'+field(11)+','+cell(3)+'<>'+field(12)+'),"待核對：預約日期／時間與已接納記錄不同",AND(acceptedOutcome="Show",'+cell(5)+'<>'+field(17)+'),"待核對：到店日期與已接納記錄不同",acceptedOutcome<>"","已接納："&expected,acceptedState="canceled","已接納：取消",acceptedState="reschedule_requested","已接納：改期；請更新 Account 日期時間",acceptedDate="","待補預約日期",acceptedDate>TODAY(),"未到期",TRUE,"待確認")),"未能核對已接納記錄，請重試"))';
}
