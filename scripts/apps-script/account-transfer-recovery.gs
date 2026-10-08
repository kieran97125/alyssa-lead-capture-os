/** Account relocation is permitted only for a unique durable source row and an
 * open appointment with the same Lead, pointer and phone. Completed evidence
 * keeps its historical Account. Never infer ownership from a customer name.
 */
function oa2TransferOpenAppointmentAccount_(ctx, record, sourceCount) {
  const a=ctx.appointments[record.appointmentId];
  if(!a || a.account===record.account)return false;
  if(sourceCount!==1 || a.leadId!==record.leadId || !record.phone ||
     String(a.phone)!==String(record.phone) || a.outcome ||
     a.provenance==='legacy_show' || !OMNI_ACCOUNT_TABS.includes(record.account) ||
     !['active','unscheduled','canceled','reschedule_requested'].includes(a.state)) {
    ctx.errors.push('Account transfer requires unique open appointment ownership.');
    return false;
  }
  const before=Object.assign(oa2StateView_(a),{account:a.account,customerKey:a.customerKey});
  a.account=record.account;a.customerKey=record.customerKey;
  a.revision++;a.updatedAt=ctx.now;
  oa2Event_(ctx,a,'account_transferred',before,'account_transfer_recovery');
  return true;
}

function oa2RehomeMovedAccountAppointments_(ss,ctx,snap) {
  const moved=snap.records.filter(r=>r.meaningful && r.appointmentId &&
    ctx.appointments[r.appointmentId] && ctx.appointments[r.appointmentId].account!==r.account);
  if(!moved.length)return 0;
  const ids=new Set(moved.map(r=>r.leadId)),counts={};
  OMNI_ACCOUNT_TABS.forEach(name=>{
    const sheet=ss.getSheetByName(name),meta=oa2Meta_(sheet,false),height=Math.max(0,sheet.getLastRow()-1);
    if(height)sheet.getRange(2,meta,height,1).getValues().forEach(row=>{
      const id=oa2Text_(row[0]);if(ids.has(id))counts[id]=(counts[id]||0)+1;
    });
  });
  return moved.reduce((n,r)=>n+Number(oa2TransferOpenAppointmentAccount_(ctx,r,counts[r.leadId]||0)),0);
}

/** Explicit operator recovery uses the normal guarded journal/registry/queue
 * commit. The scheduled worker uses the same helper before reconciliation.
 */
function repairOmniArrivalAccountTransfers() {
  const lock=LockService.getDocumentLock();
  if(!lock.tryLock(120000))throw new Error('Arrival worker busy; retry recovery.');
  try {
    const ss=oa2Spreadsheet_();
    const result=oa2ProcessAccount_(ss,ss.getSheetByName('Alyssa Main'),'scan',null,false);
    console.log(JSON.stringify({handler:'account_transfer_recovery',changes:result.changes,errors:result.errors}));
    return result;
  } finally {lock.releaseLock();}
}
