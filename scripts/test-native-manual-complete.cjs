const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname,jobKey='ARRIVAL_MANUAL_COMPLETE_SYNC_V1',tests=[],failures=[];
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(){
  const logs=[],b={Date,console:{log:value=>logs.push(String(value))}};vm.createContext(b);
  for(const path of ['apps-script/releases/20261022/native-main.gs','apps-script/releases/20261022/arrival-workflow.gs'])vm.runInContext(fs.readFileSync(root+'/'+path,'utf8'),b);
  const names=Array.from(vm.runInContext('OMNI_ACCOUNT_TABS',b));
  const stored=new Map([['ARRIVAL_WORKFLOW_V3_ENABLED','1'],['ARRIVAL_DISPLAY_V3_ENABLED','1']]);
  const writes=[],calls={identity:[],account:[],cs:[],display:[],sort:[],release:0,flush:0};
  const control={busy:false,staff:false,identityRemaining:0,identityReview:0,identityBlocked:false,accountFailure:false,resultFailure:false,projectionFailure:false,displayFailure:false,failSave:false,failFlush:false};
  const checkpoint=()=>{const raw=stored.get(jobKey);return raw?JSON.parse(raw):null;};
  const props={getProperty:key=>stored.get(key)??null,setProperty:(key,value)=>{if(control.failSave&&key===jobKey&&JSON.parse(value).attempt===null){control.failSave=false;throw new Error('PRIVATE_PROPERTY_WRITE_FAILURE');}writes.push({key,value});stored.set(key,String(value));return props;},deleteProperty:key=>{writes.push({key,deleted:true});stored.delete(key);return props;}};
  let serial=0;
  const lock={tryLock:()=>!control.busy,hasLock:()=>!control.busy,releaseLock:()=>{calls.release++;}};
  const ss={getSheetByName:name=>({getName:()=>name}),toast(){}};
  b.PropertiesService={getDocumentProperties:()=>props,getScriptProperties:()=>({getProperty:key=>key==='OMNI_ARRIVAL_V2_ENABLED'?'1':null})};
  b.LockService={getDocumentLock:()=>lock};
  b.Utilities={getUuid:()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`};
  b.SpreadsheetApp={flush:()=>{calls.flush++;if(control.failFlush){control.failFlush=false;throw new Error('PRIVATE_CUSTOMER_10000001 Flush provider exception');}}};
  b.oa2Spreadsheet_=()=>ss;
  b.oa3ManualStartup_=()=>({spreadsheet:ss,props});
  b.omniStaffPriorityActive_=()=>control.staff;
  b.oa2PrioritizeSourceIdentities_=(spreadsheet,admittedLock,options)=>{
    assert.equal(spreadsheet,ss);assert.equal(admittedLock,lock);
    assert.equal(options.maxAccounts,1);assert.equal(options.accountNames.length,1);
    assert.notEqual(options.staffEdit,true,'A manual scan must not impersonate a current CS edit');assert.notEqual(options.bookingMutation,true,'A manual scan cannot invent an observed Book timestamp');
    assert.equal(options.accountNames[0],names[options.startAccountIndex]);
    assert.equal(options.manualRequested,true,'Only an explicit manual request bypasses the idle hint; DocumentLock remains required');
    assert.equal(options.deferDisplay,true,'The complete job projects display once in its guarded final phase');
    assert.ok(checkpoint().attempt,'Identity writer must have a persisted pre-step attempt marker');
    calls.identity.push(clone(options));
    if(control.identityBlocked)return{registered:0,recovered:0,bookedAdded:0,review:1,blocked:true,accountFailures:[{accountIndex:-1,reason:'synthetic_identity_review'}]};
    if(options.startAccountIndex===0&&control.identityRemaining>0){const registered=Math.min(50,control.identityRemaining);control.identityRemaining-=registered;return{registered,recovered:0,bookedAdded:registered,review:0,accountFailures:[],processedAccounts:[names[0]]};}
    return{registered:0,recovered:0,bookedAdded:0,review:control.identityReview,accountFailures:[],processedAccounts:[]};
  };
  b.oa2ProcessAccount_=(spreadsheet,sheet,mode,edit,dryRun,trace,options)=>{
    assert.equal(spreadsheet,ss);assert.equal(mode,'scan');assert.equal(edit,null);assert.equal(dryRun,false);
    assert.equal(trace,undefined);assert.equal(options?.manualComplete,true);
    assert.equal(b.OA3_MANUAL_RUN_ACTIVE,true,'A complete manual job must suppress per-Account global display/sort');
    assert.ok(checkpoint().attempt,'Account writer must have a persisted pre-step attempt marker');
    calls.account.push(sheet.getName());
    if(control.accountFailure)throw new Error('PRIVATE_CUSTOMER_10000001 Provider exception');
    if(control.resultFailure)return{account:sheet.getName(),errors:['PRIVATE_CUSTOMER_10000001 Bad identity']};
    b.oa3AfterSync_(ss);
    return{account:sheet.getName(),newQueue:1,changes:2,deferredQueueConflicts:0,deferredSourceRecords:0,errors:[]};
  };
  b.oa2TryRefreshQueueCs_=(spreadsheet,options)=>{assert.equal(spreadsheet,ss);assert.ok(checkpoint().attempt,'Projection writer must have a persisted pre-step attempt marker');assert.equal(options.accountNames.length,1);assert.ok(names.includes(options.accountNames[0]));assert.notEqual(options.initialRefresh,true);calls.cs.push(options);if(control.projectionFailure)return{ok:false,reason:'synthetic_projection_failure'};return{ok:true,refreshed:6,changed:0};};
  b.oa3RefreshDisplay_=(spreadsheet,repairOwners)=>{assert.equal(spreadsheet,ss);assert.equal(repairOwners,false);calls.display.push(true);if(control.displayFailure)throw new Error('PRIVATE_CUSTOMER_10000001 Display provider exception');return{displayRows:6,namesRestored:0,identitiesRepaired:0};};
  b.oa3SortArrival_=()=>{calls.sort.push(true);return{sorted:6};};
  assert.equal(typeof b.startBookedArrivalsFullSync,'function','Full-sync start API must exist');
  assert.equal(typeof b.continueBookedArrivalsFullSync,'function','Full-sync continuation API must exist');
  const job=()=>{const raw=stored.get(jobKey);return raw?JSON.parse(raw):null;};
  const start=()=>{b.startBookedArrivalsFullSync();return job();};
  const step=()=>b.continueBookedArrivalsFullSync(job().id);
  const toAccount=()=>{for(let i=0;i<10&&job().phase==='identity';i++)step();assert.equal(job().phase,'account');};
  const finish=()=>{for(let i=0;i<100&&job().phase!=='complete';i++)step();assert.equal(job().phase,'complete','Bounded successive RPCs must eventually cover all six Accounts and final projection');return job();};
  return{b,names,stored,writes,calls,control,logs,job,start,step,toAccount,finish};
}
function test(name,run){try{run();tests.push(name);}catch(error){failures.push({name,error:error.message,stack:error.stack});}}
function assertPendingProgress(f,before){
  const expected=JSON.parse(before),actual=f.job();
  for(const key of ['phase','accountIndex','processedAccounts','registered','recovered','added','changed','reviewCount','projectionComplete'])assert.deepEqual(actual[key],expected[key],key+' must not be acknowledged after an unknown step');
  assert.ok(actual.attempt,'A failed step must leave its attempt checkpoint for honest retry accounting');
}

test('identity batches larger than 50 stay on the same Account and do not count as reconciliation coverage',()=>{
  const f=fixture();f.control.identityRemaining=121;f.start();
  for(const remaining of [71,21,0]){f.step();assert.equal(f.control.identityRemaining,remaining);assert.equal(f.job().phase,'identity');assert.equal(f.job().accountIndex,0);assert.deepEqual(f.job().processedAccounts,[]);}
  assert.equal(f.calls.account.length,0);assert.equal(f.calls.identity.length,3);assert.equal(f.job().registered,121);
  f.step();assert.equal(f.job().phase,'account');assert.deepEqual(f.job().processedAccounts,[]);
  f.step();assert.deepEqual(f.job().processedAccounts,[0]);assert.equal(f.job().accountIndex,1);assert.equal(f.job().phase,'identity');
});

test('all six Account receipts are distinct from preparatory identity calls and global projection runs once',()=>{
  const f=fixture();f.start();
  for(let index=0;index<6;index++){
    assert.equal(f.job().accountIndex,index);f.toAccount();
    assert.equal(f.calls.display.length,0);assert.equal(f.calls.sort.length,0);assert.equal(f.calls.cs.length,0);
    f.step();assert.deepEqual(f.job().processedAccounts,Array.from({length:index+1},(_,i)=>i));
  }
  assert.equal(f.job().phase,'projection');assert.equal(f.job().projectionComplete,false);
  assert.deepEqual(f.calls.account,f.names);assert.equal(f.calls.identity.length,6);
  f.step();assert.equal(f.job().phase,'complete');assert.equal(f.job().projectionComplete,true);
  assert.equal(f.calls.cs.length,6);assert.equal(f.calls.display.length,1);assert.equal(f.calls.sort.length,1);
  assert.equal(f.job().added,6);assert.equal(f.job().changed,12);
  f.step();assert.equal(f.calls.cs.length,6);assert.equal(f.calls.account.length,6,'A retry after completion cannot repeat accepted worker calls');
});

test('enabled API finalizer receives explicit full scope and never enters native projection or flush',()=>{
 const f=fixture();f.start();for(let i=0;i<30&&f.job().phase!=='projection';i++)f.step();const before=f.calls.flush;
 f.b.OA3_FINALIZE_API_ENABLED=true;let called=0;f.b.oa3TryApiFinalize_=(ss,opts)=>{called++;assert.deepEqual(Array.from(opts.accountNames),f.names);assert.equal(opts.includeHistory,true);assert.equal(opts.documentLock.hasLock(),true);return {completed:true,csReviewByAccount:[0,0,0,0,0,0]};};
 const receipt=f.step();assert.equal(receipt.completed,true);assert.equal(called,1);assert.equal(f.calls.flush,before);assert.equal(f.calls.cs.length,0);assert.equal(f.calls.display.length,0);assert.equal(f.calls.sort.length,0);
});
for(const mode of ['review','unknown','malformed','overflow'])test('API finalizer '+mode+' never falls back, flushes or acknowledges projection',()=>{
 const f=fixture();f.start();for(let i=0;i<30&&f.job().phase!=='projection';i++)f.step();const before=f.calls.flush;f.b.OA3_FINALIZE_API_ENABLED=true;
 f.b.oa3TryApiFinalize_=()=>{if(mode==='unknown')throw Error('Synthetic API unknown');if(mode==='malformed')return {completed:true};if(mode==='overflow')return {completed:true,csReviewByAccount:Array(6).fill(Number.MAX_SAFE_INTEGER)};return {completed:false,review:true};};
 assert.throws(()=>f.step());assert.equal(f.job().phase,'projection');assert.equal(f.job().projectionComplete,false);assert.ok(f.job().attempt);assert.equal(f.calls.flush,before);assert.equal(f.calls.cs.length,0);assert.equal(f.calls.display.length,0);assert.equal(f.calls.sort.length,0);
});

test('start resumes a pending job without resetting coverage and creates a new identity only after completion',()=>{
  const f=fixture(),first=f.start();f.toAccount();f.step();const current=f.job();
  const resumed=f.start();assert.equal(resumed.id,first.id);assert.equal(resumed.phase,current.phase);assert.deepEqual(resumed.processedAccounts,current.processedAccounts);assert.equal(resumed.added,current.added);
  f.finish();const next=f.start();assert.notEqual(next.id,first.id);assert.equal(next.phase,'identity');assert.equal(next.accountIndex,0);assert.deepEqual(next.processedAccounts,[]);
});

test('busy document lock leaves the pending phase and counts unchanged',()=>{
  const f=fixture();f.start();
  const before=f.stored.get(jobKey),calls=f.calls.identity.length;f.control.busy=true;f.control.staff=true;
  const result=f.step();assert.equal(result.busy,true);assert.equal(f.stored.get(jobKey),before);assert.equal(f.calls.identity.length,calls);assert.equal(f.calls.account.length,0);
});

test('explicit manual sync progresses through identity and Accounts while an idle hint is active',()=>{
  const f=fixture();f.control.staff=true;f.control.identityRemaining=51;f.start();f.finish();
  assert.deepEqual(f.calls.account,f.names);assert.equal(f.job().phase,'complete');assert.equal(f.job().registered,51);
  assert.ok(f.calls.identity.every(options=>options.manualRequested===true&&options.staffEdit!==true&&options.bookingMutation!==true));
});

test('lost client response resumes persisted next phase instead of repeating the accepted Account',()=>{
  const f=fixture();f.start();f.toAccount();f.step();
  assert.deepEqual(f.calls.account,[f.names[0]]);assert.equal(f.job().accountIndex,1);
  f.step();assert.deepEqual(f.calls.account,[f.names[0]],'A replay with the same job ID reads the checkpoint and performs the next phase');
  f.finish();assert.deepEqual(f.calls.account,f.names);assert.equal(f.job().added,6);
});

test('projection failure retains projection phase and successful retry does not rerun Account commits',()=>{
  const f=fixture();f.start();for(let i=0;i<30&&f.job().phase!=='projection';i++)f.step();assert.equal(f.job().phase,'projection');const accountCalls=f.calls.account.slice();
  f.control.projectionFailure=true;
  let error;try{f.step();}catch(value){error=value;}
  assert.ok(error,'An unsuccessful projection must not be reported complete');assert.equal(f.job().phase,'projection');assert.equal(f.job().projectionComplete,false);
  f.control.projectionFailure=false;f.step();assert.equal(f.job().phase,'complete');assert.deepEqual(f.calls.account,accountCalls);
  assert.equal(f.calls.display.length,1);assert.equal(f.calls.sort.length,1);
});

test('stale job identity rejoins the latest verified view without operational or checkpoint writes',()=>{
  const f=fixture(),old=f.start();f.finish();f.start();const before=f.stored.get(jobKey),writes=f.writes.length,workers=f.calls.identity.length+f.calls.account.length;
  const receipt=f.b.continueBookedArrivalsFullSync(old.id);assert.equal(receipt.stale,true);assert.equal(receipt.jobId,f.job().id);assert.equal(receipt.phase,f.job().phase);
  assert.equal(f.stored.get(jobKey),before);assert.equal(f.writes.length,writes);assert.equal(f.calls.identity.length+f.calls.account.length,workers);
});

test('partially applied display phase retries its idempotent finalizer without repeating Account commits',()=>{
  const f=fixture();f.start();for(let i=0;i<30&&f.job().phase!=='projection';i++)f.step();assert.equal(f.job().phase,'projection');const accounts=f.calls.account.slice();
  f.control.displayFailure=true;let error;try{f.step();}catch(value){error=value;}
  assert.ok(error);assert.ok(!String(error.message).includes('PRIVATE_'));assert.equal(f.job().phase,'projection');assert.equal(f.job().projectionComplete,false);assert.equal(f.calls.sort.length,0);
  f.control.displayFailure=false;f.step();assert.equal(f.job().phase,'complete');assert.deepEqual(f.calls.account,accounts);assert.equal(f.calls.sort.length,1);
});

for(const resultFailure of [false,true])test('worker failure retains Account checkpoint and never returns private error details: '+resultFailure,()=>{
  const f=fixture();f.start();f.toAccount();const before=f.stored.get(jobKey);
  f.control.accountFailure=!resultFailure;f.control.resultFailure=resultFailure;
  let error;try{f.step();}catch(value){error=value;}
  assert.ok(error);assertPendingProgress(f,before);assert.equal(f.b.OA3_MANUAL_RUN_ACTIVE,false,'Execution flag must reset even after worker failure');
  assert.ok(!String(error.message).includes('PRIVATE_')&&!String(error.message).includes('10000001'));
  assert.ok(f.logs.every(line=>!line.includes('PRIVATE_')&&!line.includes('10000001')));
  assert.equal(f.calls.display.length,0);assert.equal(f.calls.sort.length,0);
});

test('review-only identity observations remain visible without faking Account coverage',()=>{
  const f=fixture();f.control.identityReview=2;f.start();f.step();assert.equal(f.job().phase,'account');assert.equal(f.job().reviewCount,2);assert.deepEqual(f.job().processedAccounts,[]);
  f.finish();assert.ok(f.job().reviewCount>=2);assert.equal(f.calls.account.length,6);
  const receipt=f.step();assert.equal(receipt.finished,true);assert.equal(receipt.completed,false);assert.equal(receipt.nativeState,'review');assert.equal(receipt.reconciliationComplete,false);assert.equal(receipt.projectionComplete,true);
});

for(const point of ['failSave','failFlush'])test('failure after worker return keeps its checkpoint pending and uses canonical retry: '+point,()=>{
  const f=fixture();f.start();f.toAccount();const before=f.stored.get(jobKey),releases=f.calls.release;f.control[point]=true;
  let error;try{f.step();}catch(value){error=value;}
  assert.ok(error);assertPendingProgress(f,before);assert.equal(f.calls.release,releases+1);assert.equal(f.b.OA3_MANUAL_RUN_ACTIVE,false);
  assert.ok(!String(error.message).includes('PRIVATE_')&&!String(error.message).includes('10000001'));
  f.step();assert.equal(f.job().accountIndex,0);assert.equal(f.job().phase,'account');assert.equal(f.calls.account.length,1,'Unknown Account acceptance first rechecks allocation recovery without counting Account coverage');
  f.step();assert.equal(f.job().accountIndex,1);assert.deepEqual(f.job().processedAccounts,[0]);assert.equal(f.calls.account.length,2,'The canonical Account worker retries after recovery admission');
  assert.equal(f.job().countsVerified,false,'Unknown prior acceptance cannot become an exact added-count claim');assert.ok(f.job().unknownCountSteps>=1);assert.equal(f.job().attempt,null);
  const receipt=f.finish();assert.equal(receipt.countsVerified,false,'Count uncertainty must survive every remaining phase');
});

test('caller-supplied phase or coverage cannot override the stored continuation state',()=>{
  const f=fixture(),job=f.start();f.b.continueBookedArrivalsFullSync(job.id,{phase:'complete',accountIndex:6,processedAccounts:[0,1,2,3,4,5],projectionComplete:true});
  assert.equal(f.job().phase,'account');assert.equal(f.job().accountIndex,0);assert.deepEqual(f.job().processedAccounts,[]);assert.equal(f.calls.account.length,0);assert.equal(f.calls.display.length,0);
});

for(const [name,corrupt]of [
  ['malformed JSON',()=>'{'],
  ['nonsequential coverage',job=>({...job,accountIndex:1,processedAccounts:[1],processedAt:[job.startedAt]})],
  ['projection before Account coverage',job=>({...job,phase:'projection'})],
  ['completed review mismatch',job=>({...job,phase:'complete',accountIndex:6,processedAccounts:[0,1,2,3,4,5],processedAt:Array(6).fill(job.startedAt),reviewByAccount:[2,0,0,0,0,0],reviewCount:0,projectionComplete:true})],
  ['unearned pending projection',job=>({...job,projectionComplete:true})],
  ['nonboolean projection flag',job=>({...job,projectionComplete:'false'})],
  ['invalid start timestamp',job=>({...job,startedAt:{private:'invalid'}})],
  ['invalid processed timestamp',job=>({...job,accountIndex:1,processedAccounts:[0],processedAt:['not-a-date']})],
  ['nonboolean count verification',job=>({...job,countsVerified:'false'})],
  ['exact counts after an unknown step',job=>({...job,countsVerified:true,unknownCountSteps:1})],
  ['negative unknown-step count',job=>({...job,unknownCountSteps:-1})],
  ['attempt from a different phase',job=>({...job,attempt:{phase:'account',accountIndex:0,startedAt:job.startedAt}})],
])test('corrupt persisted checkpoint fails before operational writes: '+name,()=>{
  const f=fixture(),job=f.start(),value=corrupt(job);f.stored.set(jobKey,typeof value==='string'?value:JSON.stringify(value));
  const before=f.stored.get(jobKey),writes=f.writes.length;
  assert.throws(()=>f.b.continueBookedArrivalsFullSync(job.id));assert.equal(f.stored.get(jobKey),before);assert.equal(f.writes.length,writes);
  assert.equal(f.calls.identity.length,0);assert.equal(f.calls.account.length,0);assert.equal(f.calls.display.length,0);assert.equal(f.calls.sort.length,0);
});

for(const [key,value]of [['registered','1'],['recovered',null],['bookedAdded',-1],['review',Number.NaN],['accountFailures',null]])test('malformed identity receipt cannot become a zero/no-progress acceptance: '+key,()=>{
  const f=fixture();f.start();const original=f.b.oa2PrioritizeSourceIdentities_;f.b.oa2PrioritizeSourceIdentities_=(...args)=>({...original(...args),[key]:value});
  const before=f.stored.get(jobKey);assert.throws(()=>f.step());assertPendingProgress(f,before);assert.equal(f.calls.account.length,0);
});

for(const [key,value]of [['newQueue','1'],['changes',null],['deferredQueueConflicts',-1],['deferredSourceRecords',Number.MAX_SAFE_INTEGER+1],['manualReviewCount','2']])test('malformed Account receipt cannot advance coverage or hide review: '+key,()=>{
  const f=fixture();f.start();f.toAccount();const original=f.b.oa2ProcessAccount_;f.b.oa2ProcessAccount_=(...args)=>({...original(...args),[key]:value});
  const before=f.stored.get(jobKey);assert.throws(()=>f.step());assertPendingProgress(f,before);assert.deepEqual(f.job().processedAccounts,[]);
});

test('permanent identity review is an explicit blocked result with no automatic phase advancement',()=>{
  const f=fixture();f.control.identityBlocked=true;f.start();
  const receipt=f.step();assert.equal(receipt.blocked,true);assert.equal(receipt.reason,'identity_review');assert.equal(f.job().phase,'identity');assert.equal(f.job().accountIndex,0);assert.deepEqual(f.job().processedAccounts,[]);assert.equal(f.calls.account.length,0);assert.equal(f.calls.display.length,0);
});

function sidebarFixture(options={}){
  const f=fixture();let content='';
  f.b.HtmlService={createHtmlOutput:value=>{content=value;return{setTitle(){return this;}};}};
  f.b.SpreadsheetApp.getUi=()=>({showSidebar(){}});f.b.syncAllBookedArrivals();
  const script=/<script>([\s\S]*?)<\/script>/.exec(content)?.[1];assert.ok(script,'Real sidebar must provide its continuation UI');
  const nodes=Object.fromEntries(['status','detail','progress','retry'].map(id=>[id,{textContent:'',hidden:false,value:0,max:7,focused:false,removeAttribute(){},focus(){this.focused=true;}}]));
  const callbacks={},timers=[],requests=[],events={},calls={start:0,continue:[]};
  const rpc={withSuccessHandler:handler=>{callbacks.success=handler;return rpc;},withFailureHandler:handler=>{callbacks.failure=handler;return rpc;},startBookedArrivalsFullSync:()=>{calls.start++;requests.push({...callbacks});},continueBookedArrivalsFullSync:id=>{calls.continue.push(id);requests.push({...callbacks,id});}};
  const context={document:{getElementById:id=>nodes[id]},google:{script:{run:rpc}},navigator:{onLine:options.online!==false},window:{addEventListener:(name,handler)=>{events[name]=handler;}},setTimeout:(action,delay)=>{timers.push({action,delay,cleared:false});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].cleared=true;}};
  vm.createContext(context);vm.runInContext(script,context);
  return{nodes,callbacks,timers,requests,events,calls,context,content};
}
const uiReceipt=overrides=>({jobId:'job-current',totalAccounts:6,processedAccounts:0,phase:'identity',finished:false,projectionComplete:false,needsReview:false,reviewAccounts:0,countsVerified:true,added:0,...overrides});

test('real sidebar rejoins a stale-job view and continues the server-selected job without creating another run',()=>{
  const f=sidebarFixture();assert.equal(f.calls.start,1);
  f.callbacks.success(uiReceipt({stale:true,jobId:'latest-job',phase:'account'}));
  assert.equal(f.calls.start,1);assert.equal(f.timers.length,1);f.timers[0].action();assert.deepEqual(f.calls.continue,['latest-job']);
});

test('missing shared checkpoint returns restart guidance without an operational write and sidebar restarts preparation',()=>{
  const f=fixture();const receipt=f.b.continueBookedArrivalsFullSync('former-job');assert.equal(receipt.restartRequired,true);assert.equal(receipt.jobId,null);assert.equal(f.writes.length,0);assert.equal(f.calls.identity.length,0);assert.equal(f.calls.account.length,0);
  const ui=sidebarFixture();ui.callbacks.success({stale:true,restartRequired:true,jobId:null});assert.equal(ui.timers.length,1);ui.timers[0].action();assert.equal(ui.calls.start,2);assert.deepEqual(ui.calls.continue,[]);
});

test('real sidebar stops automatic retries for permanent identity review and shows a useful blocker',()=>{
  const f=sidebarFixture();f.callbacks.success(uiReceipt({blocked:true,reason:'identity_review',needsReview:true,reviewAccounts:1}));
  assert.equal(f.timers.length,0);assert.equal(f.nodes.retry.hidden,false);assert.ok(f.nodes.status.textContent.includes('核對'));
  assert.ok(!f.nodes.status.textContent.includes('未啟用'),'Identity review must not masquerade as a disabled installation');
});

test('real sidebar does not present exact added totals after an unknown step and keeps review completion honest',()=>{
  const uncertain=sidebarFixture();uncertain.callbacks.success(uiReceipt({finished:true,phase:'complete',processedAccounts:6,projectionComplete:true,countsVerified:false,unknownCountSteps:1,added:12345}));
  assert.ok(!uncertain.nodes.detail.textContent.includes('12345'),'A partial receipt counter is not an exact total');assert.equal(uncertain.timers.length,0);
  const review=sidebarFixture();review.callbacks.success(uiReceipt({finished:true,phase:'complete',processedAccounts:6,projectionComplete:true,needsReview:true,reviewAccounts:2,completed:false}));
  assert.ok(review.nodes.status.textContent.includes('核對'));assert.ok(!review.nodes.status.textContent.includes('已逐一更新所有'));
});

test('real sidebar uses fixed recovery feedback instead of rendering a raw provider exception',()=>{
  const f=sidebarFixture();f.callbacks.failure({message:'PRIVATE_CUSTOMER_10000001 Provider error'});
  assert.equal(f.nodes.retry.hidden,false);assert.ok(!JSON.stringify(f.nodes).includes('PRIVATE_'));assert.equal(f.timers.length,1);assert.equal(f.timers[0].delay,2000);
});

test('transport failures rejoin the same durable job with bounded backoff rather than start another run',()=>{
  const f=sidebarFixture();f.callbacks.success(uiReceipt({jobId:'retained-job'}));f.timers[0].action();
  for(const delay of [2000,5000,10000]){f.callbacks.failure({message:'PRIVATE_TRANSPORT_ERROR'});const timer=f.timers.at(-1);assert.equal(timer.delay,delay);timer.action();}
  const count=f.timers.length;f.callbacks.failure({message:'PRIVATE_TRANSPORT_ERROR'});
  assert.equal(f.timers.length,count);assert.equal(f.calls.start,1);assert.deepEqual(f.calls.continue,['retained-job','retained-job','retained-job','retained-job']);
  assert.equal(f.nodes.retry.hidden,false);assert.ok(f.nodes.status.textContent.includes('多次連線'));
  f.events.online();assert.equal(f.timers.length,count,'Repeated reconnects cannot bypass exhausted recovery admission');
});

test('an initially offline sidebar waits for connectivity and starts preparation once without losing the retry control',()=>{
  const f=sidebarFixture({online:false});assert.equal(f.calls.start,0);assert.equal(f.timers.length,0);assert.equal(f.nodes.retry.hidden,false);
  f.context.navigator.onLine=true;f.events.online();assert.equal(f.calls.start,1);
  f.events.online();assert.equal(f.calls.start,1,'A second online event cannot overlap the admitted RPC');
});

test('offline transport failure pauses timers and reconnect continues the retained job',()=>{
  const f=sidebarFixture();f.callbacks.success(uiReceipt({jobId:'retained-job'}));f.timers[0].action();
  f.context.navigator.onLine=false;f.events.offline();f.callbacks.failure({message:'PRIVATE_OFFLINE'});
  assert.equal(f.timers.length,1);assert.ok(f.nodes.status.textContent.includes('離線'));
  f.context.navigator.onLine=true;f.events.online();assert.equal(f.calls.start,1);assert.deepEqual(f.calls.continue,['retained-job','retained-job']);
});

test('manual retry cancels the scheduled retry and resets only client recovery admission',()=>{
  const f=sidebarFixture();f.callbacks.success(uiReceipt({jobId:'retained-job'}));f.timers[0].action();f.callbacks.failure();
  const timer=f.timers.at(-1);vm.runInContext('resume()',f.context);assert.equal(timer.cleared,true);
  assert.equal(f.calls.start,1);assert.deepEqual(f.calls.continue,['retained-job','retained-job']);
  f.callbacks.failure();assert.equal(f.timers.at(-1).delay,2000);
});

test('late callbacks cannot overwrite the active request or an accepted completion',()=>{
  const f=sidebarFixture(),old=f.requests[0];old.failure();f.timers[0].action();const current=f.requests[1];
  const timers=f.timers.length;old.success(uiReceipt({jobId:'stale-job'}));old.failure();assert.equal(f.timers.length,timers);
  current.success(uiReceipt({finished:true,phase:'complete',processedAccounts:6,projectionComplete:true,startedAt:'2026-11-16T10:00:00.000Z'}));
  const message=f.nodes.status.textContent,starts=f.calls.start;f.events.offline();f.events.online();vm.runInContext('run();resume()',f.context);
  assert.equal(f.calls.start,starts);assert.equal(f.nodes.status.textContent,message);assert.equal(f.nodes.retry.hidden,true);
});

test('permanent review cannot be restarted by reconnection, but an explicit retry can recheck it',()=>{
  const f=sidebarFixture();f.callbacks.success(uiReceipt({blocked:true,reason:'identity_review'}));
  f.events.online();assert.equal(f.calls.start,1);assert.deepEqual(f.calls.continue,[]);
  vm.runInContext('resume()',f.context);assert.deepEqual(f.calls.continue,['job-current']);
});

test('real sidebar exposes accessible progress and keeps pending coverage separate from completion',()=>{
  const f=sidebarFixture();assert.ok(f.content.includes('aria-label="同步進度"'));assert.ok(f.content.includes('role="status" aria-live="polite"'));
  f.callbacks.success(uiReceipt({phase:'account',processedAccounts:3}));
  assert.equal(f.nodes.progress.value,3);assert.ok(f.nodes.detail.textContent.includes('3 / 6'));assert.equal(f.timers.length,1);
  assert.ok(!f.nodes.status.textContent.includes('已逐一更新所有'));
});

test('real sidebar announces verified completion and returns keyboard focus to a retry after failure',()=>{
  const done=sidebarFixture();done.callbacks.success(uiReceipt({finished:true,phase:'complete',processedAccounts:6,projectionComplete:true,countsVerified:true,added:5,startedAt:'2026-11-16T10:00:00.000Z'}));
  assert.equal(done.nodes.progress.value,7);assert.ok(done.nodes.detail.textContent.includes('新增／補回 5 筆預約記錄'));assert.equal(done.timers.length,0);
  const retry=sidebarFixture();retry.callbacks.failure({message:'PRIVATE_ERROR'});assert.equal(retry.nodes.retry.focused,true);
});

console.log(JSON.stringify({passed:tests.length,failed:failures.length,tests,failures},null,2));
if(failures.length)process.exitCode=1;
