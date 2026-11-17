const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/apps-script/source-registration-recovery.gs','utf8');
function fixture(options={}) {
  const calls=[],lock={tryLock:()=>!options.busy,releaseLock:()=>calls.push('release')};
  const result={registered:1,recovered:0,bookedAdded:1,review:0,reviewReasons:[],accountFailures:[],attemptedAccountIndex:0,...options.result};
  const box={console:{log(){}},Date,Set,Number,Error,
    LockService:{getDocumentLock:()=>options.noLock?null:lock},oa2Enabled_:()=>!options.disabled,
    omniArrivalRenewManualLease_:()=>calls.push('lease'),omniArrivalClearManualLease_:()=>calls.push('clearLease'),
    oa3ManualStartup_:()=>{calls.push('startup');return{spreadsheet:'bound-spreadsheet'};},
    oa2PrioritizeSourceIdentities_:(ss,held,admission)=>{assert.equal(ss,'bound-spreadsheet');assert.equal(held,lock);assert.deepEqual(JSON.parse(JSON.stringify(admission)),{maxAccounts:1,maxIdentityBatch:50,manualRequested:true,recoverPendingAllocations:true,deferDisplay:true});calls.push('canonical');if(options.failure)throw Error('synthetic');return result;},
    SpreadsheetApp:{flush:()=>calls.push('flush')}};
  vm.createContext(box);vm.runInContext(source,box);return{box,calls};
}
for(const option of [{busy:true},{noLock:true}]){const f=fixture(option);assert.equal(f.box.recoverPendingSourceRegistration().completed,false);assert.deepEqual(f.calls,option.busy?['lease']:[]);}
const disabled=fixture({disabled:true});assert.equal(disabled.box.recoverPendingSourceRegistration().reason,'disabled');assert.deepEqual(disabled.calls,['lease','clearLease','release']);
const success=fixture();const receipt=success.box.recoverPendingSourceRegistration();assert.equal(receipt.completed,true);assert.equal(receipt.bookedAdded,1);assert.deepEqual(success.calls,['lease','startup','canonical','flush','clearLease','release']);
for(const result of [{review:1},{blocked:true},{skipped:true},{accountFailures:[{accountIndex:0}]}]){const f=fixture({result});assert.equal(f.box.recoverPendingSourceRegistration().completed,false);assert.equal(f.calls.at(-1),'release');}
for(const options of [{failure:true},{result:{registered:-1}},{result:{bookedAdded:NaN}}]){const f=fixture(options);assert.throws(()=>f.box.recoverPendingSourceRegistration());assert.equal(f.calls.at(-1),'release');}
console.log('PASS: existing writer/lock, bounded admission, deferred display, blocked/busy/review/unknown receipts and release-on-failure.');
