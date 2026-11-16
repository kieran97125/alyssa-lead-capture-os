const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const logs=[],names=['PRIVATE_ACCOUNT_A','PRIVATE_ACCOUNT_B','PRIVATE_ACCOUNT_C','PRIVATE_ACCOUNT_D','PRIVATE_ACCOUNT_E','PRIVATE_ACCOUNT_F'];
  const a={id:'PRIVATE_APPOINTMENT_A',leadId:'PRIVATE_LEAD_A',queueId:'PRIVATE_SHARED_QUEUE',account:names[0],customerKey:'PRIVATE_KEY_A',state:'active',outcome:'',revision:1};
  const b={id:'PRIVATE_APPOINTMENT_B',leadId:'PRIVATE_LEAD_B',queueId:'PRIVATE_SHARED_QUEUE',account:names[1],customerKey:'PRIVATE_KEY_B',state:'active',outcome:'',revision:1};
  const c={id:'PRIVATE_APPOINTMENT_C',leadId:'PRIVATE_LEAD_C',queueId:'PRIVATE_QUEUE_C',account:names[2],customerKey:'PRIVATE_KEY_C',state:'active',outcome:'',revision:1};
  const registry={appointments:{[a.id]:a,[b.id]:b,[c.id]:c},rows:{[a.id]:425,[b.id]:427,[c.id]:430},original:{}};
  for(const owner of Object.values(registry.appointments))registry.original[owner.id]=JSON.stringify(owner);
  const currentA={...a,queueId:'PRIVATE_RECOVERED_QUEUE',revision:2},currentC={...c,state:'canceled',revision:2};
  const context={appointments:{[a.id]:currentA,[b.id]:{...b},[c.id]:currentC},rows:{...registry.rows},original:{...registry.original},
    events:[['PRIVATE_EVENT_A','',a.id],['PRIVATE_EVENT_C','',c.id]]};
  const physical={row:43,appointmentId:b.id,entryId:b.queueId,account:b.account,customerKey:b.customerKey,origin:'allocating',outcome:'',raw:Array(26).fill('')};physical.raw[23]=b.leadId;
  const anchor={valid:true,leadId:a.leadId,currentAppointmentId:a.id,appointments:[currentA]};
  const metadata=new Map(names.map(name=>[name,[]]));metadata.get(names[0]).push([a.leadId,a.id,'','','',JSON.stringify(anchor)]);
  metadata.get(names[1]).push([b.leadId,b.id,'','','','']);
  const control={contextError:false,headerError:false,extentChange:false};
  const ss={getSheetByName:name=>{if(!metadata.has(name))return null;const values=metadata.get(name);let reads=0;return{
    getLastRow:()=>{reads++;return values.length+1+(control.extentChange&&reads>1?1:0);},
    getRange:(row,col,height,width)=>{assert.equal(row,2);assert.equal(col,26);assert.equal(width,6);return{getValues:()=>values.map(v=>v.slice())};}
  };}};
  const box={Date,console:{log:line=>logs.push(String(line))},OMNI_ACCOUNT_TABS:names,
    oa2Spreadsheet_:()=>ss,oa2ReadRegistry_:()=>registry,oa2ReadQueue_:()=>[physical],
    oa2Context_:(_,dryRun)=>{assert.equal(dryRun,true);if(control.contextError)throw new Error('PRIVATE_CONTEXT_ERROR');return context;},
    oa2Meta_:()=>{if(control.headerError)throw new Error('PRIVATE_HEADER_ERROR');return 26;},
    oa2Text_:v=>String(v??'').trim(),oa2ValidIdentityAnchor_:value=>value?.valid===true,
    oa2Outcome_:value=>value==='No Show'?'No Show':value==='Show'?'Show':null};
  const forbidden=new Proxy({},{get(){throw new Error('Diagnostic attempted a write-capable service');}});
  for(const service of ['PropertiesService','LockService','SpreadsheetApp','ScriptApp','Sheets'])box[service]=forbidden;
  vm.createContext(box);vm.runInContext(fs.readFileSync(__dirname+'/apps-script/arrival-queue-ownership-audit.gs','utf8'),box);
  return{box,registry,context,physical,metadata,control,logs,a,b,c,names};
}
const f=fixture(),before=JSON.stringify({registry:f.registry,context:f.context,physical:f.physical,metadata:[...f.metadata]});
const result=f.box.auditArrivalQueueOwnershipReadOnly20261116();
assert.equal(result.readOnly,true);assert.equal(result.changesMade,false);assert.equal(result.completed,true);
assert.equal(result.sharedQueueGroups,1);assert.equal(result.targetGroups,1);assert.equal(result.groups[0].targetGroup,true);
assert.equal(result.groups[0].rawRegistryOwners,2);assert.equal(result.groups[0].replayedOwners,1);
assert.equal(result.groups[0].physical[0].row,43);assert.equal(result.groups[0].physical[0].rawRegistryRow,427);
assert.equal(result.groups[0].physical[0].rawOwnershipMatches,true);assert.equal(result.groups[0].physical[0].replayedOwnershipMatches,true);
const replayed425=result.groups[0].rawOwnersInReplayedView.find(row=>row.registryRow===425);
assert.equal(replayed425.revision,2);assert.equal(replayed425.differsFromRaw,true);assert.equal(replayed425.queueIdMatchesOtherView,false);
assert.equal(replayed425.sourceClaimPositions[0].pendingAnchorValid,true);assert.equal(replayed425.hasReplayedEvents,true);
assert.equal(result.replayedChangeCount,2);assert.equal(result.replayedEventCount,2);
assert.equal(result.replayedChangesOutsideTargetGroups,1);assert.equal(result.replayedEventsOutsideTargetGroups,1);
assert.equal(result.replayedChangePositions.find(row=>row.registryRow===430).state,'canceled');
assert.equal(JSON.stringify({registry:f.registry,context:f.context,physical:f.physical,metadata:[...f.metadata]}),before);
assert.ok(!JSON.stringify(result).includes('PRIVATE_'));assert.ok(f.logs.every(line=>!line.includes('PRIVATE_')));

for(const scenario of ['contextError','extentChange']){
  const item=fixture();item.control[scenario]=true;const output=item.box.auditArrivalQueueOwnershipReadOnly20261116();
  assert.equal(output.completed,false);assert.equal(output.changesMade,false);assert.ok(!JSON.stringify(output).includes('PRIVATE_'));
}
const invalid=fixture();invalid.metadata.get(invalid.names[0])[0][5]='PRIVATE_INVALID_JSON';
const invalidResult=invalid.box.auditArrivalQueueOwnershipReadOnly20261116();assert.equal(invalidResult.invalidPendingAnchors,1);assert.equal(invalidResult.completed,false);
const state=fixture();state.registry.appointments[state.a.id].state='PRIVATE_CUSTOMER';state.registry.appointments[state.a.id].outcome='PRIVATE_PHONE_10000001';
assert.ok(!JSON.stringify(state.box.auditArrivalQueueOwnershipReadOnly20261116()).includes('PRIVATE_'));
const error=fixture();error.control.headerError=true;assert.throws(()=>error.box.auditArrivalQueueOwnershipReadOnly20261116(),/Ownership audit did not complete/);
assert.ok(error.logs.every(line=>!line.includes('PRIVATE_')));
console.log('PASS: readonly ownership audit compares raw/replayed/physical/source-anchor evidence, highlights unrelated replay changes and emits only sanitized counts, positions, states and booleans without writes.');
