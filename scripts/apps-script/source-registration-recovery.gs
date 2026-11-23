/** Explicit operator recovery through the existing canonical writer and document lock. */
function recoverPendingSourceRegistration() {
  const started=Date.now(), lock=LockService.getDocumentLock();
  const report=receipt=>{console.log(JSON.stringify(Object.assign({handler:'source_registration_recovery'},receipt)));return receipt;};
  if(!lock)return report({blocked:true,reason:'container_unavailable',completed:false});
  omniArrivalRenewManualLease_();
  if(!lock.tryLock(1000))return report({busy:true,reason:'document_busy',completed:false});
  try {
    if(!oa2Enabled_()){omniArrivalClearManualLease_();return report({blocked:true,reason:'disabled',completed:false});}
    const startup=oa3ManualStartup_({});
    const result=oa2PrioritizeSourceIdentities_(startup.spreadsheet,lock,{
      maxAccounts:1,maxIdentityBatch:50,manualRequested:true,
      recoverPendingAllocations:true,deferDisplay:true});
    if(!result||['registered','recovered','bookedAdded','review'].some(key=>!Number.isSafeInteger(result[key])||result[key]<0)||!Array.isArray(result.accountFailures))
      throw new Error('Source registration acknowledgement could not be verified; preserve accepted recovery state.');
    SpreadsheetApp.flush();
    const receipt={completed:!result.blocked&&!result.skipped&&!result.review&&!result.accountFailures.length,
      registered:result.registered,recovered:result.recovered,bookedAdded:result.bookedAdded,
      review:result.review,blocked:!!result.blocked,skipped:!!result.skipped,
      accountIndex:Number.isInteger(result.attemptedAccountIndex)?result.attemptedAccountIndex:null,
      failureCount:result.accountFailures.length,reviewReasons:[...new Set(result.reviewReasons||[])],
      elapsedMs:Date.now()-started};
    if(receipt.completed)omniArrivalClearManualLease_();
    return report(receipt);
  } finally {lock.releaseLock();}
}
