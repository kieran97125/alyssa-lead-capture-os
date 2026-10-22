const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadRelease,sheet,workbook}=require('./fixtures/native-arrival/identity-priority-fixture.cjs');
const {buildStagedIdentityQa}=require('./build-native-identity-isolation.cjs');

function harness(options={}) {
  const f=loadRelease(options.staged?'20261021':'20261022'),originalSheet=sheet('Original business',[],[]),originalMap=new Map([['Original business',originalSheet]]);
  const original=workbook(originalMap);original.getId=()=> 'original_binding';
  const created=[],counts={locks:0,releases:0,propertyWrites:0,priority:0},held={value:false};
  let staffChecks=0;
  f.box.omniStaffPriorityActive_=()=>{staffChecks++;return options.staff||options.staffAfterLock&&staffChecks>1;};
  f.box.oa2Spreadsheet_=()=>original;
  f.box.oa4RetiredAppointmentIds_=()=>new Set();
  f.box.LockService={getDocumentLock:()=>({tryLock:timeout=>{assert.equal(timeout,0);counts.locks++;held.value=!options.busy;return held.value;},hasLock:()=>held.value,releaseLock:()=>{counts.releases++;held.value=false;}})};
  const propertyService=f.box.PropertiesService;
  for(const key of ['getScriptProperties','getDocumentProperties']) {
    const get=propertyService[key];propertyService[key]=()=>{const object=get();return {...object,setProperty(){counts.propertyWrites++;throw Error('Original property write forbidden');},deleteProperty(){counts.propertyWrites++;throw Error('Original property deletion forbidden');}};};
  }
  Object.assign(f.box.SpreadsheetApp,{getActiveSpreadsheet:()=>original,flush(){},create(title,rows,columns){
    assert.equal(rows,20);assert.equal(columns,40);
    const sheets=new Map(),ss=workbook(sheets),blank=sheet('Sheet1',[],[]);sheets.set('Sheet1',blank);
    const attach=sh=>{sh.getParent=()=>ss;sh.setName=name=>{sheets.delete(sh.state.name);sh.state.name=name;sheets.set(name,sh);return sh;};return sh;};
    attach(blank);ss.getId=()=>`fixture_${created.length+1}`;ss.getUrl=()=>`https://example.test/fixture/${created.length+1}`;
    ss.setSpreadsheetTimeZone=timezone=>{assert.equal(timezone,'Asia/Hong_Kong');return ss;};
    ss.getSheets=()=>[...sheets.values()];ss.insertSheet=(name,settings)=>{assert.ok(settings.template);const sh=attach(sheet(name,[],[]));sheets.set(name,sh);return sh;};
    created.push({ss,sheets,title});return ss;
  }});
  if(options.banOperationalGlobals){
    const standard=new Set(['Date','Map','Set','JSON','Math','Number','String','Array','Object','RegExp','Error']);
    for(const key of Object.keys(f.box))if(typeof f.box[key]==='function'&&!standard.has(key)){
      f.box[key]=()=>{throw Error(`Candidate called outer operational helper ${key}`);};
    }
  }
  const beforeGlobals=new Map(Object.keys(f.box).map(key=>[key,f.box[key]]));
  const qa=options.staged?buildStagedIdentityQa().source:fs.readFileSync('scripts/apps-script/releases/20261022/identity-isolated-qa.gs','utf8');
  vm.runInContext(qa,f.box);
  const originals={spreadsheet:f.box.oa2Spreadsheet_,start:f.box.oa2HistoryStart_,advance:f.box.oa2AdvanceHistoryCursor_,retired:f.box.oa4RetiredAppointmentIds_};
  f.script.set('OA2_HISTORY_REPLAY_FROM','42');f.script.set('QA_UNRELATED_PROPERTY','preserve');
  f.document.set('QA_DOCUMENT_PROPERTY','preserve');
  const beforeScript=[...f.script],beforeDocument=[...f.document];
  return {...f,originalSheet,created,counts,originals,beforeScript,beforeDocument,run:()=>options.staged?f.box.verifyIdentityPriorityCandidateIsolated20261022():f.box.verifyIdentityPriorityIsolated20261022(),restored(){
    assert.equal(f.box.oa2Spreadsheet_,originals.spreadsheet);assert.equal(f.box.oa2HistoryStart_,originals.start);
    assert.equal(f.box.oa2AdvanceHistoryCursor_,originals.advance);assert.equal(f.box.oa4RetiredAppointmentIds_,originals.retired);
    assert.equal(held.value,false);assert.equal(originalSheet.state.writes.length,0);assert.equal(counts.propertyWrites,0);
    if(options.staged){
      for(const [key,value] of beforeGlobals)assert.equal(f.box[key],value,`Staged bundle replaced global ${key}`);
      assert.deepEqual(Object.keys(f.box).filter(key=>!beforeGlobals.has(key)),['verifyIdentityPriorityCandidateIsolated20261022']);
    }
  }};
}

let passed=0;
for(const mode of ['staff','busy','staffAfterLock']) {
  const f=harness({[mode]:true}),r=f.run();assert.equal(r.ok,false);assert.equal(r.skipped,true);assert.equal(f.created.length,1);
  assert.equal(f.created[0].sheets.size,9);assert.deepEqual([...f.script],f.beforeScript);assert.deepEqual([...f.document],f.beforeDocument);
  assert.equal(f.counts.locks,mode==='staff'?0:1);assert.equal(f.counts.releases,mode==='staffAfterLock'?1:0);f.restored();passed++;
}
{
  const f=harness();f.box.oa2PrioritizeSourceIdentities_=(ss,lock)=>{
    assert.equal(lock.hasLock(),true);assert.notEqual(ss.getId(),'original_binding');
    assert.equal(f.box.oa2Spreadsheet_().getId(),ss.getId());f.box.oa2AdvanceHistoryCursor_(ss,3);
    throw Error('Synthetic fixture-only failure');
  };
  const r=f.run();assert.equal(r.ok,false);assert.equal(r.errorCode,'isolated_fixture_execution_failed');assert.equal(r.phases[0].projectPropertiesUnchanged,true);
  assert.deepEqual([...f.script],f.beforeScript);assert.deepEqual([...f.document],f.beforeDocument);assert.equal(f.counts.releases,1);f.restored();passed++;
}
{
  const f=harness();f.box.oa2PrioritizeSourceIdentities_=()=>{f.script.set('QA_EXTERNAL_WRITER','preserved');return {registered:2,bookedAdded:2,accountFailures:[]};};
  const r=f.run();assert.equal(r.ok,false);assert.equal(f.script.get('QA_EXTERNAL_WRITER'),'preserved');assert.equal(r.phases[0].projectPropertiesUnchanged,false);
  f.restored();passed++;
}
{
  const f=harness();f.box.PropertiesService.getScriptProperties=()=>{throw Error('Synthetic property read unavailable');};
  const r=f.run();assert.equal(r.ok,false);assert.equal(f.counts.releases,1);f.restored();passed++;
}
{
  const f=harness(),get=f.box.PropertiesService.getScriptProperties;let reads=0;
  f.box.PropertiesService.getScriptProperties=()=>{const p=get();return {...p,getProperties(){if(++reads>1)throw Error('Synthetic cleanup read unavailable');return p.getProperties();}};};
  const r=f.run();assert.equal(r.ok,false);assert.equal(r.errorCode,'fixture_cleanup_or_property_verification_failed');
  assert.equal(f.counts.releases,1);f.restored();passed++;
}
{
  const f=harness(),r=f.run();assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.passed.length,6);assert.equal(r.allFixturePhasesVerified,true);
  assert.ok(r.phases.every(x=>x.projectPropertiesUnchanged));assert.equal(r.firstPass.registered,2);assert.equal(r.firstPass.bookedAdded,2);assert.equal(r.enquiry.registered,1);assert.equal(r.recovery.recovered,1);
  assert.equal(r.normalCsRejection.allocationAttempts,0);assert.equal(r.normalCsRejection.manualNotePreserved,true);
  assert.equal(f.counts.releases,6);assert.deepEqual([...f.script],f.beforeScript);assert.deepEqual([...f.document],f.beforeDocument);f.restored();passed++;
}
{
  const f=harness({staged:true}),r=f.run();assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.passed.length,6);
  assert.equal(r.firstPass.registered,2);assert.equal(r.firstPass.bookedAdded,2);assert.equal(r.enquiry.registered,1);
  assert.deepEqual([...f.script],f.beforeScript);assert.deepEqual([...f.document],f.beforeDocument);f.restored();passed++;
}
{
  const f=harness({staged:true,banOperationalGlobals:true}),r=f.run();assert.equal(r.ok,true,JSON.stringify(r));
  assert.equal(r.passed.length,6);assert.deepEqual([...f.script],f.beforeScript);assert.deepEqual([...f.document],f.beforeDocument);f.restored();passed++;
}
console.log(`PASS: ${passed} Google isolation-runner safety cases; no original workbook/property writes, real helper boundaries restored, staff/busy admission and synthetic IO verified.`);
