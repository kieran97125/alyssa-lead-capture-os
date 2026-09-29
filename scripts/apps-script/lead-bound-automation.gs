/**
 * Alyssa Omni Account Lead Sheet — header-resolved automation v1.5
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
    .createMenu('Lead 工具')
    .addItem('安裝 / 更新自動化', 'installOmniLeadAutomation')
    .addItem('檢查設定', 'verifyOmniLeadSetup')
    .addItem('重新套用日期格式', 'applyOmniDateFormats')
    .addItem('重新同步療程項目', 'syncAllAccountTreatments')
    .addItem('補齊缺少 Lead Event', 'captureMissingLeadEvents')
    .addToUi();
}

function installOmniLeadAutomation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Asia/Hong_Kong');

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (['onOmniLeadInstallableEdit','captureMissingLeadEvents'].includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onOmniLeadInstallableEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('captureMissingLeadEvents').timeBased().everyMinutes(1).create();
  PropertiesService.getScriptProperties().setProperty(OMNI_INSTALLABLE_EDIT_PROP, '1');

  applyOmniDateFormats_(false);
  ensureEventSheet_();
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

function handleOmniLeadEdit_(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const account = sheet.getName();
  if (!OMNI_ACCOUNT_TABS.includes(account)) return;
  if (e.range.getLastRow() < 2) return;
  const columns = getOmniColumns_(sheet);

  const firstRow = Math.max(2, e.range.getRow());
  const lastRow = e.range.getLastRow();
  const firstCol = e.range.getColumn();
  const lastCol = e.range.getLastColumn();

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    let shouldResort = false;
    for (let row = firstRow; row <= lastRow; row++) {
      ensureAccountAndCreatedDate_(sheet, row, account, columns);

      if (columns.OFFER >= firstCol && columns.OFFER <= lastCol) {
        syncTreatmentForRow_(sheet, row, account, columns);
      }

      if (columns.STATUS >= firstCol && columns.STATUS <= lastCol) {
        const before = (firstRow === lastRow && e.range.getNumColumns() === 1)
          ? clean_(e.oldValue)
          : '';
        const after = clean_(sheet.getRange(row, columns.STATUS).getDisplayValue());
        if (after && normalizeStatus_(before) !== normalizeStatus_(after)) {
          sheet.getRange(row, columns.LAST_UPDATED).setValue(today_()).setNumberFormat('yyyy-mm-dd');
          captureStageEventForRow_(sheet, row, account, before, after, columns);
          shouldResort = true;
        }
      }

      // New rows also belong in chronological order.
      if (columns.CREATED_AT >= firstCol && columns.CREATED_AT <= lastCol) {
        shouldResort = true;
      }
    }
    if (shouldResort) sortAccountSheet_(sheet, columns);
  } finally {
    lock.releaseLock();
  }
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

function syncTreatmentForRow_(sheet, row, account, columns, rules) {
  const offer = clean_(sheet.getRange(row, columns.OFFER).getDisplayValue());
  if (!offer) return;
  const text = [
    offer,
    clean_(sheet.getRange(row, columns.TREATMENT).getDisplayValue()),
    clean_(sheet.getRange(row, columns.CAMPAIGN).getDisplayValue()),
  ].filter(Boolean).join(' ').toLowerCase();

  const rule = (rules || getTreatmentRules_()).find(item =>
    item.enabled &&
    item.account === account &&
    item.keywords.some(keyword => text.includes(keyword.toLowerCase()))
  );
  if (!rule) return;

  const treatmentCell = sheet.getRange(row, columns.TREATMENT);
  if (!clean_(treatmentCell.getDisplayValue())) treatmentCell.setValue(rule.output);

  const brandCell = sheet.getRange(row, columns.BRAND);
  if (rule.brand && clean_(brandCell.getDisplayValue()) !== rule.brand) {
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

function ensureEventSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(OMNI_EVENT_SHEET);
  if (!sheet) sheet = ss.insertSheet(OMNI_EVENT_SHEET);
  if (sheet.getMaxColumns() < EVENT_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), EVENT_HEADERS.length - sheet.getMaxColumns());
  }
  const current = sheet.getRange(1,1,1,EVENT_HEADERS.length).getDisplayValues()[0].map(clean_);
  if (current.every(v=>!v)) sheet.getRange(1,1,1,EVENT_HEADERS.length).setValues([EVENT_HEADERS]);
  else if (EVENT_HEADERS.some((h,i)=>current[i] !== h)) throw new Error('_funnel_events header contract 不符。');

  sheet.setFrozenRows(1);
  sheet.getRange('B:C').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('K:K').setNumberFormat('yyyy-mm-dd');
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function captureMissingLeadEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ledger = ensureEventSheet_();
  const existing = getEventIndex_(ledger);
  const append = [];

  OMNI_ACCOUNT_TABS.forEach(account => {
    const sheet = ss.getSheetByName(account);
    if (!sheet || sheet.getLastRow() < 2) return;
    const columns = getOmniColumns_(sheet);
    const values = sheet.getRange(2,1,sheet.getLastRow()-1,leadDataWidth_(columns)).getValues();
    values.forEach((row,index) => {
      const rowNumber = index + 2;
      const record = rowRecord_(row, columns);
      const identity = stableIdentity_(record, account);
      if (!identity || existing.has(`${identity}|lead`)) return;
      const event = buildEventRow_(record, account, rowNumber, 'lead', record.createdAt || today_(), '', clean_(record.status));
      append.push(event);
      existing.add(`${identity}|lead`);
    });
  });

  appendEvents_(ledger, append);
  return { added: append.length };
}

function captureStageEventForRow_(sheet, rowNumber, account, before, after, columns) {
  const ledger = ensureEventSheet_();
  const record = rowRecord_(sheet.getRange(rowNumber,1,1,leadDataWidth_(columns)).getValues()[0], columns);
  const identity = stableIdentity_(record, account);
  if (!identity) return 0;

  const existing = getEventIndex_(ledger);
  const events = [];
  if (!existing.has(`${identity}|lead`)) {
    events.push(buildEventRow_(record, account, rowNumber, 'lead', record.createdAt || today_(), '', after));
    existing.add(`${identity}|lead`);
  }

  const type = statusEventType_(after);
  if (type && !existing.has(`${identity}|${type}`)) {
    events.push(buildEventRow_(record, account, rowNumber, type, today_(), before, after));
    existing.add(`${identity}|${type}`);
  }
  appendEvents_(ledger, events);
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

function getEventIndex_(sheet) {
  const set = new Set();
  if (sheet.getLastRow() < 2) return set;
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,EVENT_HEADERS.length).getValues();
  rows.forEach(row => {
    const account = clean_(row[15]);
    const brand = clean_(row[5]);
    const phone = last8_(row[6]);
    const created = dateText_(row[10]);
    const type = clean_(row[3]).toLowerCase();
    if (account && brand && phone && created && type) {
      set.add(`${account}|${brand}|${phone}|${created}|${type}`);
    }
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
  ensureEventSheet_();
  if (showAlert) SpreadsheetApp.getUi().alert('日期格式已統一。');
}

function verifyOmniLeadSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const problems = [];
  if (ss.getSpreadsheetTimeZone() !== 'Asia/Hong_Kong') problems.push('Timezone 應為 Asia/Hong_Kong');

  [OMNI_MASTER_SHEET,...OMNI_ACCOUNT_TABS,OMNI_TREATMENT_SHEET,OMNI_EVENT_SHEET].forEach(name => {
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
