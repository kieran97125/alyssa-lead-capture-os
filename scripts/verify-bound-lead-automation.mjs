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
let nextSheetId = 1;
const letter = column => {
  let result = '';
  for (let n=column; n>0; n=Math.floor((n-1)/26)) result=String.fromCharCode(65+(n-1)%26)+result;
  return result;
};
const columnNumber = letters => [...letters].reduce((value,c)=>value*26+c.charCodeAt(0)-64,0);
class ConditionalRule {
  constructor(ranges, formula) { this.ranges=ranges; this.formula=formula; }
  getRanges() { return this.ranges; }
  copy() {
    let ranges=this.ranges.slice();
    const formula=this.formula;
    const builder={setRanges: value => { ranges=value; return builder; },build: () => new ConditionalRule(ranges,formula)};
    return builder;
  }
}
class Sheet {
  constructor(name, headers, rows = []) {
    this.name=name; this.id=nextSheetId++; this.rows=[headers.slice(), ...rows.map(row => row.slice())]; this.maxColumns=headers.length;
    this.writes=[]; this.formats=[]; this.hidden=false; this.moves=[]; this.sorts=[]; this.columnChanges=[]; this.conditionalRules=[];
    this.conditionalWrites=[]; this.rowProperties=this.rows.map((_,i)=>({identity:i,format:`format-${i}`,validation:`validation-${i}`,note:`note-${i}`,hidden:i%2===0}));
    this.filter={identity:'original-filter'}; this.selection=null;
  }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  getParent() { return this.parent; }
  getLastColumn() { return Math.max(1,...this.rows.map(row => row.findLastIndex(value=>value!=='' && value!==null && value!==undefined)+1)); }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return this.maxRows ?? Math.max(20,this.rows.length); }
  getMaxColumns() { return Math.max(this.maxColumns,...this.rows.map(row=>row.length)); }
  getFilter() { return this.filter; }
  isRowHiddenByFilter() { return false; }
  isRowHiddenByUser(row) { return Boolean(this.rowProperties[row-1]?.hidden); }
  activate() { if (this.parent) this.parent.setActiveSheet(this); return this; }
  setActiveRange(range) { this.selection=range.getA1Notation(); return range; }
  getConditionalFormatRules() { return this.conditionalRules; }
  setConditionalFormatRules(rules) { this.conditionalRules=rules; this.conditionalWrites.push(rules); return this; }
  moveRows() { throw new Error('Structural row moves are unsafe for bounded master/cache references'); }
  insertColumnsAfter(after,count) {
    assert.equal(after,this.getMaxColumns(),'temporary helper is after the full grid width');
    this.columnChanges.push({operation:'insert',column:after+1,count});
    this.rows.forEach(row=>{ while (row.length<after) row.push(''); row.splice(after,0,...Array(count).fill('')); });
    this.maxColumns=after+count;
    return this;
  }
  deleteColumn(column) {
    this.columnChanges.push({operation:'delete',column,count:1});
    this.rows.forEach(row=>row.splice(column-1,1));
    this.maxColumns--;
    return this;
  }
  setFrozenRows() {}
  isSheetHidden() { return this.hidden; }
  hideSheet() { this.hidden = true; }
  getRange(row, col, count = 1, width = 1) {
    if (typeof row === 'string') {
      const match=row.replaceAll('$','').match(/^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/);
      assert.ok(match,`supported fixture A1 range: ${row}`);
      col=columnNumber(match[1]);
      const endCol=columnNumber(match[3] || match[1]);
      row=Number(match[2] || 1);
      const endRow=Number(match[4] || (match[3] ? this.getMaxRows() : row));
      count=endRow-row+1; width=endCol-col+1;
    }
    const sheet = this;
    const range = {
      getSheet: () => sheet, getRow: () => row, getLastRow: () => row+count-1,
      getColumn: () => col, getLastColumn: () => col+width-1, getNumColumns: () => width, getNumRows: () => count,
      getA1Notation: () => `${letter(col)}${row}${count>1 || width>1 ? `:${letter(col+width-1)}${row+count-1}` : ''}`,
      activate: () => { sheet.selection=range.getA1Notation(); return range; },
      canEdit: () => true,
      getMergedRanges: () => [],
      getValues: () => Array.from({length: count},(_,i) => Array.from({length: width},(_,j) => sheet.rows[row+i-1]?.[col+j-1] ?? '')),
      getDisplayValues: () => range.getValues().map(values => values.map(value => value instanceof Date ? value.toISOString().slice(0,10) : String(value))),
      getValue: () => range.getValues()[0][0], getDisplayValue: () => range.getDisplayValues()[0][0],
      getFormulas: () => range.getValues().map(values=>values.map(value=>typeof value==='string' && value.startsWith('=') ? value : '')),
      getFormula: () => range.getFormulas()[0][0],
      setFormula: value => range.setValue(value),
      setFormulas: values => range.setValues(values),
      setValue: value => range.setValues([[value]]),
      setValues: values => {
        sheet.writes.push({row,col,values: plain(values)});
        values.forEach((values,i) => values.forEach((value,j) => { (sheet.rows[row+i-1] ||= [])[col+j-1] = value; }));
        return range;
      },
      setNumberFormat: format => { sheet.formats.push([row,col,count,width,format]); return range; },
      sort: sorts => {
        const index = sorts[0].column-col;
        if (sheet.failSort) throw new Error('Synthetic native sort failure');
        const entries=range.getValues().map((values,i)=>({values,oldRow:row+i,properties:sheet.rowProperties[row+i-1]}));
        entries.sort((a,b)=>new Date(a.values[index])-new Date(b.values[index]));
        const coordinates=new Map(entries.map((entry,i)=>[entry.oldRow,row+i]));
        const hiddenPositions=sheet.rowProperties.map(properties=>properties.hidden);
        entries.forEach((entry,i)=>{
          entry.values.forEach((value,j)=>{
            if (typeof value==='string') value=value.replace(/^=([A-Z]+)(\d+)$/,(_,c,r)=>`=${c}${coordinates.get(Number(r)) || r}`);
            sheet.rows[row+i-1][col+j-1]=value;
          });
          sheet.rowProperties[row+i-1]={...entry.properties,hidden:hiddenPositions[row+i-1]};
        });
        sheet.sorts.push({row,col,count,width,sorts:plain(sorts)});
        return range;
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
  const alerts = [], menus = [], triggers = [], toasts=[], lifecycle=[];
  const state={activeSheet:physical,promptText:'00001234',promptButton:'OK',allowLock:true,locked:false,onPrompt:null};
  const ss = {
    getSheetByName: name => sheets.get(name), getActiveSheet: () => state.activeSheet,
    setActiveSheet: sheet => { state.activeSheet=sheet; return sheet; },
    getSpreadsheetTimeZone: () => 'Asia/Hong_Kong', setSpreadsheetTimeZone() {},
    toast: (...args) => toasts.push(args),
    setActiveRange: range => range.activate(),
    insertSheet: name => { const sheet=new Sheet(name,[]); sheet.parent=ss; sheets.set(name,sheet); return sheet; },
  };
  for (const sheet of sheets.values()) sheet.parent=ss;
  const menu = { addItem: (...args) => { menus.push(args); return menu; }, addToUi() {} };
  const ui={
    Button:{OK:'OK',CANCEL:'CANCEL',CLOSE:'CLOSE'},ButtonSet:{OK_CANCEL:'OK_CANCEL'},
    alert: text => { assert.equal(state.locked,false,'dialogs must happen outside document lock'); alerts.push(text); },
    createMenu: () => menu,
    prompt: () => {
      assert.equal(state.locked,false,'prompt happens before document lock'); lifecycle.push('prompt');
      if (state.onPrompt) state.onPrompt();
      return {getSelectedButton:()=>state.promptButton,getResponseText:()=>state.promptText};
    },
  };
  const context = vm.createContext({
    Date, console: {log() {}},
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getActiveSheet: () => state.activeSheet, getUi: () => ui,flush: () => lifecycle.push('flush') },
    PropertiesService: { getScriptProperties: () => ({getProperty: () => '',setProperty() {}}) },
    ScriptApp: {getProjectTriggers: () => [],deleteTrigger() {},newTrigger: name => { triggers.push(name); const trigger={forSpreadsheet:()=>trigger,onEdit:()=>trigger,timeBased:()=>trigger,everyMinutes:()=>trigger,create(){}}; return trigger; }},
    LockService: {getDocumentLock: () => ({
      waitLock() { state.locked=true; lifecycle.push('lock'); },
      tryLock() { lifecycle.push('lock'); state.locked=state.allowLock; return state.allowLock; },
      releaseLock() { state.locked=false; lifecycle.push('unlock'); },
    })},
    Utilities: {formatDate: date => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(date),computeDigest: (_,value) => [...createHash('sha256').update(value).digest()],DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'}},
  });
  vm.runInContext(source,context);
  context.today_ = () => new Date(2026,8,29);
  return {context,physical,ledger,rules,sheets,menus,triggers,state,alerts,toasts,lifecycle};
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
  context.onOpen(); assert.equal(menus.length,6);
  assert.ok(menus.some(([,handler])=>handler==='searchOmniPhoneToBottom'));
  context.installOmniLeadAutomation();
  assert.deepEqual(triggers,['onOmniLeadInstallableEdit','captureMissingLeadEvents']);
  assert.equal(master.writes.length,0,'installer does not rewrite master formulas or headers');
  assert.equal(dashboard.writes.length,0,'installer does not rewrite dashboard');
  assert.equal(physical.writes.length,0,'installer does not rewrite account rows or headers');
}
// Native sort must preserve external range addresses: only temporary helper values may be written.
function assertNoLeadWrites({physical,ledger}) {
  assert.ok(physical.writes.every(write=>write.col===physical.getMaxColumns()+1),'only temporary helper cells may be written');
  assert.equal(physical.columnChanges.filter(change=>change.operation==='insert').length,physical.columnChanges.filter(change=>change.operation==='delete').length,'helper column is always removed');
  assert.equal(ledger.writes.length,0,'search/move must not create audit events');
}
for (const [version,headers] of [['v4',v4],['v5',v5],['v6',v6]]) {
  const records=[
    {...semantic,'電話':'+852 0000-1234','療程項目':'first touch'},
    {...semantic,'電話':'85200009999','療程項目':'other lead'},
    {...semantic,'電話':'00001234','療程項目':'same-date later touch'},
    {...semantic,'電話':'','療程項目':'metadata-only contact'},
    {...semantic,'電話':'00001234','療程項目':'existing matching suffix'},
  ];
  const f=fixture(headers,records), {physical,context}=f;
  physical.maxRows=physical.getLastRow(); // full grids need no new row.
  const originalRows=plain(physical.rows), originalProperties=plain(physical.rowProperties);
  const originalFilter=physical.filter;
  const phoneCol=headers.indexOf('電話')+1;
  const sameRowFormulaCol=physical.getLastColumn()+1;
  physical.rows[0].push('Synthetic same-row phone reference');
  physical.rows.slice(1).forEach((row,i)=>row.push(`=${letter(phoneCol)}${i+2}`));
  physical.maxColumns=45; // allocated blank columns also precede the temporary key.
  const rules=[
    new ConditionalRule([physical.getRange('C2:C6')],'=$C2="已到店"'),
    new ConditionalRule([physical.getRange(`${letter(phoneCol)}2:${letter(phoneCol)}6`)],`=INDIRECT("_format_cache!F"&ROW())>1`),
  ];
  physical.conditionalRules=rules;
  const beforeCf=rules.map(rule=>({formula:rule.formula,ranges:rule.getRanges().map(range=>range.getA1Notation())}));
  const result=context.moveOmniPhoneRowsToBottom_(physical,'00001234');
  assert.deepEqual(plain(result),{count:3,firstRow:4,lastRow:6,moves:physical.sorts.length});
  const order=[0,2,4,1,3,5];
  order.forEach((original,index)=>{
    assert.deepEqual(plain(physical.rows[index].slice(0,sameRowFormulaCol-1)),originalRows[original],`${version}: values and tail provenance stay with their row`);
    assert.deepEqual(plain(physical.rowProperties[index]),{...originalProperties[original],hidden:originalProperties[index].hidden},`${version}: cell format, validation and notes follow data; hidden-row position stays fixed`);
    if (index>0) assert.equal(physical.rows[index][sameRowFormulaCol-1],`=${letter(phoneCol)}${index+1}`,`${version}: native movement keeps same-row reference attached`);
  });
  assert.equal(cell(physical,'療程項目',4).getValue(),'first touch',`${version}: first-touch tie order preserved`);
  assert.deepEqual(physical.conditionalRules.map(rule=>({formula:rule.formula,ranges:rule.getRanges().map(range=>range.getA1Notation())})),beforeCf,`${version}: native sort leaves conditional rule formulas/ranges unchanged`);
  assert.equal(physical.conditionalWrites.length,0,'sort needs no conditional format rewrite');
  assert.equal(physical.filter,originalFilter,'existing filter remains untouched');
  assert.ok(physical.sorts.every(sort=>sort.col===1 && sort.width===46),'sort includes the full allocated grid, trailing metadata and the temporary helper');
  assertNoLeadWrites(f);
}

let patterns=0;
for (let size=1; size<=10; size++) {
  for (let mask=0; mask<(1<<size); mask++) {
    const matching=Array.from({length:size},(_,i)=>Boolean(mask&(1<<i)));
    const f=fixture(v6,matching.map((match,i)=>({...semantic,'電話':match?'00001234':`9000${String(i).padStart(4,'0')}`})));
    f.physical.maxRows=f.physical.getLastRow();
    const before=plain(f.physical.rows);
    const result=f.context.moveOmniPhoneRowsToBottom_(f.physical,'00001234');
    const expected=[before[0],...before.slice(1).filter((_,i)=>!matching[i]),...before.slice(1).filter((_,i)=>matching[i])];
    assert.deepEqual(plain(f.physical.rows),expected,`stable partition size=${size} mask=${mask}`);
    assert.equal(result.count,matching.filter(Boolean).length);
    assert.equal(result.moves,f.physical.sorts.length);
    if (result.count) {
      assert.equal(result.firstRow,size-result.count+2);
      assert.equal(result.lastRow,size+1);
    } else assert.deepEqual(plain(result),{count:0,moves:0});
    const alreadySuffix=matching.every((match,i)=>!match || matching.slice(i).every(Boolean));
    if (alreadySuffix) assert.equal(f.physical.sorts.length,0,'already-bottom and all/no-match cases need no sort');
    assertNoLeadWrites(f);
    patterns++;
  }
}

for (const [scenario,configure] of [
  ['cancel',f=>{f.state.promptButton='CANCEL';}],
  ['close',f=>{f.state.promptButton='CLOSE';}],
  ['blank input',f=>{f.state.promptText='';}],
  ['short input',f=>{f.state.promptText='1234567';}],
  ['overlong input',f=>{f.state.promptText='1234567890123456';}],
  ['non-phone input',f=>{f.state.promptText='call 00001234';}],
  ['no match',f=>{f.state.promptText='99998888';}],
  ['master tab',f=>{f.state.activeSheet=new Sheet('lead',v6);}],
  ['history tab',f=>{f.state.activeSheet=new Sheet('歷史 CS Leads',v6);}],
  ['lock contention',f=>{f.state.allowLock=false;}],
  ['active tab changed while prompting',f=>{f.state.onPrompt=()=>{f.state.activeSheet=new Sheet('Alyssa Main',v6);};}],
]) {
  const f=fixture(v6,[semantic,{...semantic,'電話':'99999999'}]);
  const before=plain(f.physical.rows);
  configure(f);
  f.context.searchOmniPhoneToBottom();
  assert.deepEqual(plain(f.physical.rows),before,`${scenario}: data unchanged`);
  assert.equal(f.physical.sorts.length,0,`${scenario}: no row sorting`);
  assert.equal(f.physical.columnChanges.length,0,`${scenario}: no helper column mutation`);
  assert.equal(f.physical.conditionalWrites.length,0,`${scenario}: no formatting mutation`);
  assert.equal(f.state.locked,false,`${scenario}: lock released`);
  assertNoLeadWrites(f);
}

{
  const f=fixture(v6,[semantic,{...semantic,'電話':'99999999'}]);
  f.state.promptText='+852 0000-1234';
  f.context.searchOmniPhoneToBottom();
  assert.equal(cell(f.physical,'電話',3).getValue(),'85200001234');
  assert.ok(f.physical.selection,'matching suffix is selected for editing');
  assert.ok(f.toasts.length,'successful search provides feedback');
  assert.ok(f.lifecycle.indexOf('prompt')<f.lifecycle.indexOf('lock'),'read prompt before locking');
  assert.equal(f.state.locked,false,'success releases lock');
  assertNoLeadWrites(f);
}

{
  const f=fixture(v6,[semantic,{...semantic,'電話':'99999999'}]);
  const before=plain(f.physical.rows), width=f.physical.getMaxColumns();
  f.physical.failSort=true;
  assert.throws(()=>f.context.moveOmniPhoneRowsToBottom_(f.physical,'00001234'),/Synthetic native sort failure/);
  assert.deepEqual(plain(f.physical.rows),before,'failed sort leaves lead records intact');
  assert.equal(f.physical.getMaxColumns(),width,'failed sort cleans up its temporary column');
  assertNoLeadWrites(f);
  f.context.searchOmniPhoneToBottom();
  assert.equal(f.state.locked,false,'public error path releases the lock before alerting');
  assert.ok(f.alerts.some(message=>message.includes('Synthetic native sort failure')),'public error feedback is honest');
  assertNoLeadWrites(f);
}
for (const headers of [v6.filter(header=>header!=='電話'),[...v6,'電話']]) {
  const f=fixture(headers);
  assert.throws(()=>f.context.moveOmniPhoneRowsToBottom_(f.physical,'00001234'),/header contract/);
  assert.equal(f.physical.columnChanges.length,0,'bad header stops before temporary-column mutation');
  assertNoLeadWrites(f);
}
console.log(`PASS bound Lead automation: original contracts; phone menu; ${patterns} stable-partition cases; v4/v5/v6 row metadata/formats/validation/reference preservation; unchanged CF; safe cancel/input/tab/lock flows`);
