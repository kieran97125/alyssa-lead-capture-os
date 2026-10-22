const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadRelease,sheet,workbook}=require('./fixtures/native-arrival/identity-priority-fixture.cjs');
const {buildStagedWorkflowQa}=require('./build-native-workflow-isolation.cjs');

// The fake evaluates the fixture's known Sheets formulas only. This is offline
// boundary/transition coverage; actual Google formula evaluation is a separate
// required evidence gate and cannot be inferred from this emulator.
function harness(options={}) {
  const f=loadRelease(options.staged?'20261021':'20261022'),originalSheet=sheet('Original business',[],[]),originalMap=new Map([['Original business',originalSheet]]);
  const original=workbook(originalMap);original.getId=()=> 'original_binding';
  const created=[],counts={locks:0,releases:0,propertyWrites:0,priority:0},held={value:false};let staffChecks=0;
  f.box.omniStaffPriorityActive_=()=>{staffChecks++;return options.staff||options.staffAfterLock&&staffChecks>1;};
  f.box.oa2Spreadsheet_=()=>original;f.box.oa4RetiredAppointmentIds_=()=>new Set();
  f.box.LockService={getDocumentLock:()=>({tryLock:timeout=>{assert.equal(timeout,0);counts.locks++;held.value=!options.busy;return held.value;},hasLock:()=>held.value,releaseLock:()=>{counts.releases++;held.value=false;}})};
  const service=f.box.PropertiesService;
  for(const key of ['getScriptProperties','getDocumentProperties']){
    const get=service[key];service[key]=()=>{const object=get();return {...object,setProperty(){counts.propertyWrites++;throw Error('Original property write forbidden');},deleteProperty(){counts.propertyWrites++;throw Error('Original property deletion forbidden');}};};
  }
  Object.assign(f.box.SpreadsheetApp,{getActiveSpreadsheet:()=>original,flush(){},create(title,rows,columns){
    assert.equal(rows,20);assert.equal(columns,40);
    const sheets=new Map(),ss=workbook(sheets),blank=sheet('Sheet1',[],[]);sheets.set('Sheet1',blank);
    const evaluate=(sh,row,col,value)=>{
      if(typeof value!=='string'||!value.startsWith('='))return value;
      const matrix=name=>sheets.get(name).state.matrix,header=(name,r)=>matrix(name)[r-1]||[];
      if(value.startsWith('=COUNTIF(')){const outcome=value.includes('"No Show"')?'No Show':'Show';return matrix('_appointment_registry').slice(1).filter(r=>r[15]===outcome).length;}
      if(value.startsWith('=COUNTA(')){const h=header('到店紀錄',7),index=h.indexOf('Appointment ID');return matrix('到店紀錄').slice(7).filter(r=>r[index]).length;}
      if(value.startsWith('=SUM(')){const h=header('到店紀錄',7),indices=['試做價','開單金額'].map(x=>h.indexOf(x));return matrix('到店紀錄').slice(7).reduce((n,r)=>n+indices.reduce((m,i)=>m+(Number(r[i])||0),0),0);}
      if(value.includes('acceptedOutcome,INDEX(records,pos,16)')){
        const h=header('到店紀錄',7),raw=sh.state.matrix[row-1]||[],get=label=>raw[h.indexOf(label)]??'',id=get('Appointment ID');if(!id)return '';
        const matches=matrix('_appointment_registry').slice(1).filter(r=>r[0]===id);if(matches.length!==1)return '未接納：預約識別缺失或重覆，請核對';const a=matches[0];
        if(get('Omni Lead ID')!==a[1]||get('到店紀錄ID（內部）')!==a[20]||get('Account')!==a[2]||get('穩定客戶識別（內部）')!==a[3])return '未接納：預約身份不一致，請核對';
        const textDate=v=>v instanceof Date?new Date(v.getTime()+8*3600000).toISOString().slice(0,10):String(v||''),date=textDate(a[10]);
        const outcome=a[15],state=a[14],expected=outcome==='Show'?'已到店':outcome||({canceled:'取消',reschedule_requested:'改期'}[state]||'待到店'),input=get('結果'),today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
        if(input!==expected){if(input==='已到店'&&!date)return '未接納：請先在 Account 補預約日期';if(state==='canceled')return '未接納：此預約已取消，請核對取消／到店記錄';if(input==='已到店'&&date>today)return '未接納：未來預約不能標記已到店';return '未接納：結果待處理；已接納結果為「'+expected+'」';}
        const time=v=>typeof v==='number'?String(Math.floor(Math.round(v*1440)/60)).padStart(2,'0')+':'+String(Math.round(v*1440)%60).padStart(2,'0'):String(v||'');
        if(textDate(get('預約日期'))!==date||time(get('時間'))!==time(a[11]))return '待核對：預約日期／時間與已接納記錄不同';
        if(outcome==='Show'&&textDate(get('到店日期'))!==textDate(a[16]))return '待核對：到店日期與已接納記錄不同';
        return outcome?'已接納：'+expected:state==='canceled'?'已接納：取消':state==='reschedule_requested'?'已接納：改期；請更新 Account 日期時間':!date?'待補預約日期':date>today?'未到期':'待確認';
      }
      return value;
    };
    const attach=sh=>{
      sh.getParent=()=>ss;sh.setName=name=>{sheets.delete(sh.state.name);sh.state.name=name;sheets.set(name,sh);return sh;};
      let maxColumns=40;sh.getMaxColumns=()=>maxColumns;
      sh.insertColumnAfter=column=>{sh.state.matrix.forEach(row=>row.splice(column,0,''));maxColumns++;return sh;};
      sh.deleteColumn=column=>{sh.state.matrix.forEach(row=>row.splice(column-1,1));maxColumns--;return sh;};
      const getRange=sh.getRange;sh.getRange=(row,col,height=1,width=1)=>{
        const range=getRange(row,col,height,width),getValues=range.getValues,getFormulas=range.getFormulas;
        range.getValues=()=>getValues().map((items,i)=>items.map((v,j)=>evaluate(sh,row+i,col+j,v)));
        range.getValue=()=>range.getValues()[0][0];range.getDisplayValues=()=>range.getValues().map(items=>items.map(v=>v instanceof Date?new Date(v.getTime()+8*3600000).toISOString().slice(0,10):String(v??'')));
        range.getDisplayValue=()=>range.getDisplayValues()[0][0];range.getFormula=()=>getFormulas()[0][0];range.getSheet=()=>sh;
        range.sort=spec=>{const selected=sh.state.matrix.slice(row-1,row-1+height);selected.sort((a,b)=>String(a[spec.column-1]??'').localeCompare(String(b[spec.column-1]??'')));sh.state.matrix.splice(row-1,height,...selected);return range;};
        return range;
      };return sh;
    };
    attach(blank);ss.getId=()=>`fixture_${created.length+1}`;ss.getUrl=()=>`https://example.test/workflow/${created.length+1}`;
    ss.setSpreadsheetTimeZone=timezone=>{assert.equal(timezone,'Asia/Hong_Kong');return ss;};ss.getSheets=()=>[...sheets.values()];
    ss.insertSheet=(name,settings)=>{assert.ok(settings.template);const sh=attach(sheet(name,[],[]));sheets.set(name,sh);return sh;};
    created.push({ss,sheets,title});return ss;
  }});
  f.script.set('OMNI_ARRIVAL_V2_ENABLED','1');f.script.set('OA2_HISTORY_REPLAY_FROM','42');f.script.set('QA_UNRELATED_PROPERTY','preserve');
  f.document.set('ARRIVAL_WORKFLOW_V3_ENABLED','1');f.document.set('ARRIVAL_DISPLAY_V3_ENABLED','1');f.document.set('QA_DOCUMENT_PROPERTY','preserve');
  if(options.banOperationalGlobals){const standard=new Set(['Date','Map','Set','JSON','Math','Number','String','Array','Object','RegExp','Error']);for(const key of Object.keys(f.box))if(typeof f.box[key]==='function'&&!standard.has(key))f.box[key]=()=>{throw Error('Candidate called outer helper '+key);};}
  const beforeGlobals=new Map(Object.keys(f.box).map(key=>[key,f.box[key]]));
  vm.runInContext(options.staged?buildStagedWorkflowQa().source:fs.readFileSync('scripts/apps-script/releases/20261022/workflow-isolated-qa.gs','utf8'),f.box);
  const originals={spreadsheet:f.box.oa2Spreadsheet_,start:f.box.oa2HistoryStart_,advance:f.box.oa2AdvanceHistoryCursor_,retired:f.box.oa4RetiredAppointmentIds_};
  const beforeScript=[...f.script],beforeDocument=[...f.document];
  return {...f,originalSheet,created,counts,originals,beforeScript,beforeDocument,run:()=>options.staged?f.box.verifyArrivalWorkflowCandidateIsolated20261022():f.box.verifyArrivalWorkflowIsolated20261022(),restored(){
    assert.equal(f.box.oa2Spreadsheet_,originals.spreadsheet);assert.equal(f.box.oa2HistoryStart_,originals.start);assert.equal(f.box.oa2AdvanceHistoryCursor_,originals.advance);assert.equal(f.box.oa4RetiredAppointmentIds_,originals.retired);
    assert.equal(held.value,false);assert.equal(originalSheet.state.writes.length,0);assert.equal(counts.propertyWrites,0);
    if(options.staged){for(const [key,value] of beforeGlobals)assert.equal(f.box[key],value,'Replaced outer global '+key);assert.deepEqual(Object.keys(f.box).filter(key=>!beforeGlobals.has(key)),['verifyArrivalWorkflowCandidateIsolated20261022']);}
  }};
}
let passed=0;
for(const mode of ['staff','busy','staffAfterLock']){
  const f=harness({[mode]:true}),r=f.run();assert.equal(r.ok,false);assert.equal(r.skipped,true);assert.equal(f.created.length,1);assert.equal(f.created[0].sheets.size,12);assert.deepEqual([...f.script],f.beforeScript);assert.deepEqual([...f.document],f.beforeDocument);assert.equal(f.counts.locks,mode==='staff'?0:1);assert.equal(f.counts.releases,mode==='staffAfterLock'?1:0);f.restored();passed++;
}
{
  const f=harness();f.box.omniArrivalV2AccountEdit_=()=>{throw Error('Synthetic first phase failure');};const r=f.run();assert.equal(r.ok,false);assert.equal(r.errorCode,'isolated_fixture_execution_failed');assert.equal(r.phases[0].projectPropertiesUnchanged,true);assert.equal(f.counts.releases,1);f.restored();passed++;
}
{
  const f=harness();f.box.omniArrivalV2AccountEdit_=()=>{f.script.set('QA_EXTERNAL_WRITER','preserved');};const r=f.run();assert.equal(r.ok,false);assert.equal(f.script.get('QA_EXTERNAL_WRITER'),'preserved');assert.equal(r.phases[0].projectPropertiesUnchanged,false);f.restored();passed++;
}
{
  const f=harness();f.box.PropertiesService.getScriptProperties=()=>{throw Error('Synthetic snapshot read unavailable');};const r=f.run();assert.equal(r.ok,false);assert.equal(f.counts.releases,1);f.restored();passed++;
}
{
  const f=harness(),get=f.box.PropertiesService.getScriptProperties;let reads=0;f.box.PropertiesService.getScriptProperties=()=>{const p=get();return {...p,getProperties(){if(++reads>1)throw Error('Synthetic cleanup read unavailable');return p.getProperties();}};};const r=f.run();assert.equal(r.ok,false);assert.equal(r.errorCode,'fixture_cleanup_or_property_verification_failed');assert.equal(f.counts.releases,1);f.restored();passed++;
}
for(const options of [{},{staged:true},{staged:true,banOperationalGlobals:true}]){
  const f=harness(options),r=f.run();if(!r.ok)console.error(JSON.stringify(r),f.logs.slice(-8));assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.passed.length,5);assert.ok(r.phases.every(p=>p.projectPropertiesUnchanged));assert.equal(r.registration.appointments,6);assert.equal(r.registration.timestamps.allSourceQueueRegistryEqual,true);assert.equal(r.registration.timestamps.bookings,6);assert.equal(r.registration.timestamps.maxRoundTripToleranceMs,1);assert.equal(r.catchup.sameAppointmentIds,2);assert.equal(r.catchup.timestamps.allSourceQueueRegistryEqual,true);assert.equal(r.outcomes.show,1);assert.equal(r.outcomes.noShow,1);assert.equal(r.outcomes.timestamps.outcomes,2);assert.equal(r.outcomes.timestamps.allSourceQueueRegistryEqual,true);assert.equal(r.outcomes.amount,1830);assert.equal(r.transitions.completedHistoryUnchanged,true);assert.equal(r.retry.injectedFailures,1);assert.equal(r.retry.queueRows,7);assert.equal(r.retry.repeatNoOp,true);assert.equal(r.retry.timestamps.bookings,6);assert.equal(r.retry.timestamps.outcomes,1);assert.equal(r.retry.timestamps.allSourceQueueRegistryEqual,true);assert.equal(f.counts.releases,5);assert.deepEqual([...f.script],f.beforeScript);assert.deepEqual([...f.document],f.beforeDocument);f.restored();passed++;
}
console.log(`PASS: ${passed} current-source workflow isolation guards. All five synthetic phases exercised; no original workbook/property writes; nested global trap passed. Native formula evaluation still requires actual Google execution.`);
