const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname;
function fixture(){
  const logs=[],b={console:{log:x=>logs.push(String(x))},Date};vm.createContext(b);
  for(const file of ['apps-script/releases/20261022/native-main.gs','apps-script/releases/20261022/arrival-workflow.gs','apps-script/releases/20261022/arrival-integrity.gs','apps-script/arrival-native-read-probe.gs'])vm.runInContext(fs.readFileSync(root+'/'+file,'utf8'),b);
  const names=vm.runInContext('OMNI_ACCOUNT_TABS.slice()',b),sourceHeaders=vm.runInContext('OMNI_HEADERS.concat(OA2.ACCOUNT_HEADERS)',b);
  const arrivalHeaders=['品牌','電話','客人／預約','CS同事名','預約日期','時間','結果','到店日期','備註','檢查提示','Account','客人識別','電話末4','療程','分店','原預約日期（自動）','可追溯Book日期（自動）','Book日期來源（自動）','補充Book登記日期','穩定客戶識別（內部）','到店紀錄ID（內部）','客戶＋預約日期時間（內部）','Appointment ID','Schedule Revision','Queue State','Outcome Recorded At','Omni Lead ID','Booking Registered At','Record Origin'];
  const row=(headers,values)=>headers.map(h=>values[h]??'');
  const matrices=new Map(names.map(name=>[name,[Array.from(sourceHeaders)]]));
  matrices.get(names[3]).push(row(sourceHeaders,{'跟進狀態':'已預約','電話':'10000001','預約日期':'2026-11-18','預約時間':'15:00','Omni Lead ID':'PRIVATE_LEAD_A','Appointment ID':'PRIVATE_APPOINTMENT_A'}),row(sourceHeaders,{'跟進狀態':'已預約','電話':'10000002','預約日期':'2026-11-19','預約時間':'16:00','Omni Lead ID':'PRIVATE_LEAD_B'}));
  matrices.set('到店紀錄',[...Array.from({length:6},()=>Array(arrivalHeaders.length).fill('')),arrivalHeaders,row(arrivalHeaders,{'Account':names[3],'客人／預約':'PRIVATE_CUSTOMER','穩定客戶識別（內部）':names[3]+'|p:10000001','到店紀錄ID（內部）':'PRIVATE_QUEUE_A','Appointment ID':'PRIVATE_APPOINTMENT_A','Omni Lead ID':'PRIVATE_LEAD_A','預約日期':'2026-11-18','時間':'15:00','Record Origin':'managed'})]);
  let reads=0,rawReads=0;
  const ss={getId:()=>'PRIVATE_SYNTHETIC_SHEET',getSheetByName:name=>{
    const matrix=matrices.get(name);if(!matrix)return null;
    return {getName:()=>name,getLastRow:()=>matrix.length,getLastColumn:()=>Math.max(...matrix.map(r=>r.length)),
      getDataRange:()=>({getDisplayValues:()=>{reads++;return matrix.map(r=>r.map(String));},getValues:()=>{rawReads++;return matrix.map(r=>r.slice());}}),
      getRange:(row,col,height,width)=>({getValues:()=>{rawReads++;return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>(matrix[row+i-1]||[])[col+j-1]??''));},
        getDisplayValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String((matrix[row+i-1]||[])[col+j-1]??'')))})};
  }};
  b.oa2Spreadsheet_=()=>ss;
  const forbidden=new Proxy({},{get(){throw new Error('Probe attempted a write-capable or Advanced API service');}});
  for(const service of ['Sheets','PropertiesService','LockService','ScriptApp','SpreadsheetApp'])b[service]=forbidden;
  b.oa2Context_=()=>{throw new Error('Probe must not replay registry state');};
  b.oa2Commit_=()=>{throw new Error('Probe must not commit');};
  return{b,ss,logs,matrices,names,sourceHeaders,row,getReads:()=>reads,getRawReads:()=>rawReads};
}
const f=fixture(),before=JSON.stringify([...f.matrices]);
const result=f.b.probeMissingBookedArrivalsNativeReadOnly20261116();
assert.equal(result.readOnly,true);assert.equal(result.completed,true);assert.equal(result.readEngine,'native');
assert.equal(result.sourceCount,6);assert.equal(result.sourceRows,2);assert.equal(result.queueRows,1);
assert.equal(result.candidates,1);assert.equal(result.missing,1);assert.equal(result.skipped,1);assert.equal(result.scheduleGaps,0);
assert.equal(f.getReads(),7,'Probe reads all six source matrices and the queue, without an Advanced API call');
assert.equal(JSON.stringify([...f.matrices]),before,'Native engine measurement must leave every source and arrival cell unchanged');
assert.equal(Object.keys(result.timings).length,8);
for(const value of Object.values(result.timings))assert.ok(Number.isFinite(value)&&value>=0);
const output=JSON.stringify(result)+f.logs.join('');
for(const value of ['PRIVATE_','10000001',f.names[3]])assert.equal(output.includes(value),false,'Only counts and timings may leave the probe');

const selected=f.b.oa3ManualBatchDisplayContext_(f.ss,{},'selectedNative',true);
assert.equal(selected.readEngine,'native');assert.equal(selected.spreadsheet,f.ss);assert.equal(selected.rangeCount,8);
assert.equal(f.getReads(),7,'Selecting the engine itself must not read cell matrices');
const actual=f.b.oa3MissingDisplayRead_(f.ss,{},'nativeIntegration');
assert.equal(actual.readEngine,'native');assert.equal(actual.selection.items.length,1);assert.equal(actual.selection.skipped,1);
assert.equal(f.getReads(),14);assert.equal(f.getRawReads(),0,'Read-only discovery keeps raw authoritative data deferred');
const locked=f.b.oa3MissingWriteRead_(f.ss,{});
assert.equal(locked.selection.items.length,1);assert.equal(locked.snaps.length,1,'Only the affected Account is hydrated raw');
assert.equal(locked.snaps[0].records[0].account,f.names[3]);assert.ok(f.getRawReads()>0);
assert.equal(JSON.stringify([...f.matrices]),before,'Both discovery engines preserve source/arrival values before the writer');

const api=fixture();api.b.OA3_MANUAL_USE_NATIVE_DISPLAY_READS=false;
api.b.Sheets={Spreadsheets:{Values:{batchGet:()=>{throw new Error('Synthetic explicit API failure');}}}};
assert.throws(()=>api.b.oa3MissingDisplayRead_(api.ss),/Synthetic explicit API failure/);
assert.equal(api.getReads(),0,'A failed explicitly selected API call cannot silently retry through native matrices');

const duplicate=fixture();
duplicate.matrices.get(duplicate.names[5]).push(duplicate.row(duplicate.sourceHeaders,{'跟進狀態':'待跟進','電話':'10000003','Omni Lead ID':'PRIVATE_LEAD_A'}));
assert.throws(()=>duplicate.b.probeMissingBookedArrivalsNativeReadOnly20261116(),/Native read-only probe did not complete/);
assert.ok(duplicate.logs.some(line=>JSON.parse(line).failedPhase==='selection'),'Even non-booked rows on another Account participate in global ownership checks');
assert.ok(duplicate.logs.every(line=>!line.includes('PRIVATE_')));
const missing=fixture();missing.matrices.delete(missing.names[2]);
assert.throws(()=>missing.b.probeMissingBookedArrivalsNativeReadOnly20261116(),/Native read-only probe did not complete/);
assert.ok(missing.logs.some(line=>JSON.parse(line).failedPhase==='source_2'));
console.log('PASS: native-only probe/selected engine use real discovery and locked hydration, cover all Account identities, preserve cells/CAS scope, reject duplicate/incomplete ownership, avoid API failure fallback and emit counts/timings only.');
