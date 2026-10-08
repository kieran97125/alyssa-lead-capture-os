/** Replace the existing oa2QueueAction_ definition; retain its guarded callers. */
function oa2QueueAction_(ctx,apptId,action) {
  const a=ctx.appointments[apptId]; if(!a) throw new Error('Unknown appointment ID');
  const state=action==='取消'?'canceled':action==='改期'?'reschedule_requested':action==='待到店'?(a.date?'active':'unscheduled'):null;
  if(!state) throw new Error('Unsupported appointment action');
  // A managed cancellation is an explicit correction of the current outcome.
  // Imported historical evidence and rescheduling retain their existing guard.
  if(a.outcome && (action!=='取消' || a.provenance==='legacy_show')) throw new Error('Clear the outcome before canceling or rescheduling this appointment.');
  if(a.state===state && !a.outcome) return false;
  const before=oa2StateView_(a);
  if(a.outcome) {
    a.outcome=''; a.arrivalDate=''; a.generatedArrivalDate=''; a.outcomeAt=ctx.now;
  }
  a.revision++; a.state=state; a.updatedAt=ctx.now;
  // One revision and one audit transition retain the original completion in Before.
  oa2Event_(ctx,a,action==='取消'?'canceled':action==='改期'?'reschedule_requested':'pending_restored',before,'queue_edit'); return true;
}
