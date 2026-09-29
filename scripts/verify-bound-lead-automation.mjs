import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// Keep synthetic Date constructors deterministic regardless of the host timezone.
process.env.TZ = 'UTC';

// Synthetic Apps Script adapter: no live rows, credentials, or remote writes.
const source = readFileSync(new URL('./apps-script/lead-bound-automation.gs', import.meta.url), 'utf8');
const account = 'Alyssa Aesthetics';
const v4 = ['最後更新日期','Created At','跟進狀態','品牌','分店','客人姓名','電話','Email','療程 / 優惠','療程項目','預約日期','預約時間','確認到店日期','Campaign / 廣告','最後跟進時間','CS Remark','Remark(後續跟進情況)','Status','Show up','Account','IG/FB Username','Day 1','Day 2','Promotion'];
const v5 = [...v4.slice(0,4),'CS同事名',...v4.slice(4)];
const v6 = ['最後更新日期','Created At','跟進狀態','CS同事名','品牌','預約日期','預約時間','確認到店日期','客人姓名','電話','療程 / 優惠','療程項目','分店','Email',...v5.slice(14)];
const eventHeaders = ['Event ID','Event At','Event Date','Event Type','lead_key','Brand','Phone Last8','Source Row','Status Before','Status After','Created At','Treatment','Source','Campaign','Branch','Account'];
const trailing = ['Migration origin','Migration status','Migration key','Source row','Migration reason'];
const semantic = {
  '最後更新日期':'2026-09-01','Created At':'2026-09-01','跟進狀態':'待跟進',
  'CS同事名':'synthetic owner','品牌':account,'分店':'synthetic branch','客人姓名':'Synthetic Person',
  '電話':'85200001234','Email':'fixture@example.invalid','療程 / 優惠':'synthetic offer',
  '療程項目':'synthetic treatment','預約日期':'2026-09-25','預約時間':'12:00',
  '確認到店日期':'2026-09-26','Campaign / 廣告':'synthetic campaign','Account':account,
};
const plain = value => JSON.parse(JSON.stringify(value));
class Sheet {
  constructor(name, headers, rows = []) { this.name = name; this.rows = [headers.slice(), ...rows.map(row => row.slice())]; this.writes = []; this.formats = []; this.hidden = false; }
  getName() { return this.name; }
  getLastColumn() { return Math.max(...this.rows.map(row => row.length)); }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return Math.max(20,this.rows.length); }
  getMaxColumns() { return this.getLastColumn(); }
  insertColumnsAfter() {}
  setFrozenRows() {}
  isSheetHidden() { return this.hidden; }
  hideSheet() { this.hidden = true; }
  getRange(row, col, count = 1, width = 1) {
    if (typeof row === 'string') return { setNumberFormat: format => { this.formats.push([row,format]); } };
    const sheet = this;
    const range = {
      getSheet: () => sheet, getRow: () => row, getLastRow: () => row+count-1,
      getColumn: () => col, getLastColumn: () => col+width-1, getNumColumns: () => width,
      getValues: () => Array.from({length: count},(_,i) => Array.from({length: width},(_,j) => sheet.rows[row+i-1]?.[col+j-1] ?? '')),
      getDisplayValues: () => range.getValues().map(values => values.map(value => value instanceof Date ? value.toISOString().slice(0,10) : String(value))),
      getValue: () => range.getValues()[0][0], getDisplayValue: () => range.getDisplayValues()[0][0],
      setValue: value => range.setValues([[value]]),
      setValues: values => {
        sheet.writes.push({row,col,values: plain(values)});
        values.forEach((values,i) => values.forEach((value,j) => { (sheet.rows[row+i-1] ||= [])[col+j-1] = value; }));
        return range;
      },
      setNumberFormat: format => { sheet.formats.push([row,col,count,width,format]); return range; },
      sort: sorts => {
        const index = sorts[0].column-col;
        const values = range.getValues().sort((a,b) => new Date(a[index])-new Date(b[index]));
        range.setValues(values); return range;
      },
    };
    return range;
  }
}
function fixture(headers, records = [semantic], ruleHeaders = ['I欄關鍵字','J欄輸出']) {
  const sheets = new Map();
  const physical = new Sheet(account,[...headers,...trailing],records.map((record,i) => [...headers.map(header => record[header] ?? ''),...trailing.map((_,j) => `fixture-${i}-${j}`)]));
  const ledger = new Sheet('_funnel_events',eventHeaders);
  const rules = new Sheet('療程項目',['啟用','Account','品牌',...ruleHeaders,'Priority','Unused 1','Unused 2','Unused 3'],[['TRUE',account,'Aesthetics Medical','synthetic','mapped treatment']]);
  sheets.set(account,physical); sheets.set('_funnel_events',ledger); sheets.set('療程項目',rules);
  const alerts = [], menus = [], triggers = [];
  const ss = { getSheetByName: name => sheets.get(name), getSpreadsheetTimeZone: () => 'Asia/Hong_Kong', setSpreadsheetTimeZone() {}, insertSheet: name => { const sheet=new Sheet(name,[]); sheets.set(name,sheet); return sheet; } };
  const menu = { addItem: (...args) => { menus.push(args); return menu; }, addToUi() {} };
  const context = vm.createContext({
    Date, console: {log() {}},
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({alert: text => alerts.push(text),createMenu: () => menu}) },
    PropertiesService: { getScriptProperties: () => ({getProperty: () => '',setProperty() {}}) },
    ScriptApp: {getProjectTriggers: () => [],deleteTrigger() {},newTrigger: name => { triggers.push(name); const trigger={forSpreadsheet:()=>trigger,onEdit:()=>trigger,timeBased:()=>trigger,everyMinutes:()=>trigger,create(){}}; return trigger; }},
    LockService: {getDocumentLock: () => ({waitLock() {},releaseLock() {}})},
    Utilities: {formatDate: date => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(date),computeDigest: (_,value) => [...createHash('sha256').update(value).digest()],DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'}},
  });
  vm.runInContext(source,context);
  context.today_ = () => new Date(2026,8,29);
  return {context,physical,ledger,rules,sheets,menus,triggers};
}
function cell(sheet,header,row=2) { return sheet.getRange(row,sheet.rows[0].indexOf(header)+1); }
function edit(context,sheet,header,oldValue,row=2) { context.handleOmniLeadEdit_({range:cell(sheet,header,row),oldValue}); }

let expectedRecord;
for (const [name,headers] of [['v4',v4],['v5',v5],['v6',v6]]) {
  const {context,physical,ledger} = fixture(headers);
  const columns = context.getOmniColumns_(physical);
  const record = plain(context.rowRecord_(physical.rows[1],columns));
  expectedRecord ||= record;
  assert.deepEqual(record,expectedRecord,`${name}: semantic record is layout independent`);
  assert.equal(context.stableIdentity_(record,account),`${account}|${account}|00001234|2026-09-01`);
  const before = plain(physical.rows[1]);
  cell(physical,'跟進狀態').setValue('已到店'); physical.writes=[];
  edit(context,physical,'跟進狀態','待跟進');
  assert.equal(cell(physical,'最後更新日期').getDisplayValue(),'2026-09-29');
  assert.equal(cell(physical,'Created At').getDisplayValue(),'2026-09-01');
  assert.equal(cell(physical,'確認到店日期').getDisplayValue(),'2026-09-26');
  assert.equal(cell(physical,'預約日期').getDisplayValue(),'2026-09-25');
  assert.equal(cell(physical,'電話').getDisplayValue(),'85200001234');
  assert.deepEqual(plain(physical.rows[1].slice(headers.length)),before.slice(headers.length));
  assert.deepEqual(ledger.rows.slice(1).map(row=>row[3]),['lead','show']);
  assert.deepEqual(ledger.rows.slice(1).map(row=>row[6]),['00001234','00001234']);
  assert.equal(context.captureMissingLeadEvents().added,0,`${name}: lead event deduplicates`);
  edit(context,physical,'跟進狀態','待跟進');
  assert.equal(ledger.rows.length,3,`${name}: repeated stage does not duplicate events`);
  assert.ok(physical.writes.every(write => write.col===columns.LAST_UPDATED),`${name}: only last-updated cell changes`);

  const blank = fixture(headers,[{...semantic,'確認到店日期':''}]);
  cell(blank.physical,'跟進狀態').setValue('已到店');
  edit(blank.context,blank.physical,'跟進狀態','待跟進');
  assert.equal(cell(blank.physical,'確認到店日期').getValue(),'');
  for (const status of ['已預約','No Show']) {
    cell(blank.physical,'跟進狀態').setValue(status);
    edit(blank.context,blank.physical,'跟進狀態','已到店');
    assert.equal(cell(blank.physical,'預約日期').getValue(),'2026-09-25');
  }
  const sorted = fixture(headers,[semantic,{...semantic,'電話':'85200005678','最後更新日期':'2026-09-28'}]);
  cell(sorted.physical,'跟進狀態').setValue('已預約');
  edit(sorted.context,sorted.physical,'跟進狀態','待跟進');
  assert.equal(cell(sorted.physical,'電話',3).getValue(),'85200001234');
  assert.deepEqual(sorted.physical.rows[2].slice(headers.length),trailing.map((_,j)=>`fixture-0-${j}`),`${name}: provenance follows sort`);
}
for (const ruleHeaders of [['I欄關鍵字','J欄輸出'],['J欄關鍵字','K欄輸出'],['K欄關鍵字','L欄輸出'],['療程 / 優惠關鍵字','療程項目輸出']]) {
  for (const headers of [v4,v5,v6]) {
    const {context,physical} = fixture(headers,[{...semantic,'療程項目':''}],ruleHeaders);
    edit(context,physical,'療程 / 優惠','');
    assert.equal(cell(physical,'療程項目').getValue(),'mapped treatment');
    assert.equal(cell(physical,'品牌').getValue(),'Aesthetics Medical');
    assert.equal(cell(physical,'預約日期').getValue(),'2026-09-25');
    cell(physical,'療程項目').setValue('existing manual treatment');
    edit(context,physical,'療程 / 優惠','');
    assert.equal(cell(physical,'療程項目').getValue(),'existing manual treatment');
  }
}
for (const brokenHeaders of [v6.filter(h=>h!=='電話'),[...v6,'電話']]) {
  const {context,physical} = fixture(brokenHeaders);
  assert.throws(()=>edit(context,physical,'跟進狀態','待跟進'),/header contract/);
  assert.equal(physical.writes.length,0,'invalid header fails before mutation');
}
for (const headers of [v4,v5,v6]) {
  const {context,physical,sheets,menus,triggers} = fixture(headers);
  const master = new Sheet('lead',headers,[headers.map((_,i)=>i===0?'=SAFE_MASTER_FORMULA()':'')]);
  sheets.set('lead',master);
  const dashboard = new Sheet('Mkt_Dashboard',['KPI','Value'],[['Lead','=SAFE_DASHBOARD_FORMULA()']]);
  sheets.set('Mkt_Dashboard',dashboard);
  context.applyOmniDateFormats_(false);
  const cols = context.getOmniColumns_(physical);
  assert.ok(physical.formats.some(f=>f[1]===cols.APPOINTMENT_DATE && f[4]==='yyyy-mm-dd'));
  assert.ok(physical.formats.some(f=>f[1]===cols.SHOW_DATE && f[4]==='yyyy-mm-dd'));
  assert.ok(physical.formats.some(f=>f[1]===cols.APPOINTMENT_TIME && f[4]==='hh:mm'));
  context.onOpen(); assert.equal(menus.length,5);
  context.installOmniLeadAutomation();
  assert.deepEqual(triggers,['onOmniLeadInstallableEdit','captureMissingLeadEvents']);
  assert.equal(master.writes.length,0,'installer does not rewrite master formulas or headers');
  assert.equal(dashboard.writes.length,0,'installer does not rewrite dashboard');
  assert.equal(physical.writes.length,0,'installer does not rewrite account rows or headers');
}
console.log('PASS bound Lead automation: v4/v5/v6 headers, onEdit dates, treatment aliases, event dedupe, provenance sort, fail-closed headers, safe menus/installer');
