/** Governed one-off repair primitive. The operator supplies an independently
 * reviewed positional/identity plan; no default plan or automatic discovery is
 * authorized to mutate data. Existing native commit/journal/CAS remain in use.
 */
function oa2QueueEntryRebindId_(plan) {
  return 'arrival_repair_'+oa2Hash_('queue_entry_rebind_20261116|'+plan.appointmentId+'|'+plan.oldQueueId);
}
function oa2QueueRebindPendingBeforeSafe_(value) {
  if(!value||value==='new')return true;let before;try{before=JSON.parse(value);}catch(ignored){return false;}
  return Array.isArray(before)&&before.length===4&&before.every(v=>typeof v==='string')&&['','待到店'].includes(before[2])&&
    oa2Date_(before[0])===before[0]&&oa2Time_(before[1])===before[1]&&oa2Date_(before[3])===before[3];
}
/** Original deployed native code has a two-argument fresh-claim helper. Build
 * the full retained-lineage scope here, using its existing pure primitives,
 * rather than silently relying on a newer optional argument being understood.
 */
function oa2AssertQueueRebindClaimsFresh_(ss,items,appointments) {
  const scope=oa2IdentityAnchorScope_(items,appointments),planned=new Set();
  items.forEach(item=>{if(planned.has(item.record.leadId))throw new Error('Duplicate planned repair source ownership.');planned.add(item.record.leadId);});
  OMNI_ACCOUNT_TABS.forEach(account=>{
    const sh=ss.getSheetByName(account);if(!sh)throw new Error('A governed identity source is missing.');
    const meta=oa2Meta_(sh,false),height=sh.getLastRow()-1;if(height<1)return;
    sh.getRange(2,meta,height,6).getValues().forEach((v,i)=>{
      if(scope.rows.has(account+'|'+(i+2)))return;
      if(scope.leadIds.has(oa2Text_(v[0]))||scope.appointmentIds.has(oa2Text_(v[1])))throw new Error('Source identity ownership changed; preserve for retry.');
      if(!oa2Text_(v[5]))return;let anchor;
      try{anchor=JSON.parse(oa2Text_(v[5]));}catch(ignored){throw new Error('Outside recovery ownership cannot be verified.');}
      if(!oa2ValidIdentityAnchor_(anchor,account))throw new Error('Outside recovery ownership cannot be verified.');
      if(scope.leadIds.has(anchor.leadId)||scope.appointmentIds.has(anchor.currentAppointmentId)||anchor.appointments.some(a=>scope.leadIds.has(a.leadId)||scope.appointmentIds.has(a.id))||
        (anchor.events||[]).some(e=>scope.appointmentIds.has(e[2])||scope.leadIds.has(e[3])))throw new Error('Outside recovery intent claims this source identity.');
    });
  });
}
function oa2RebindOrphanQueueEntries_(ss,plans,options) {
  options=options||{};const dryRun=options.dryRun===true,lock=options.documentLock;
  if(!dryRun&&(!lock||typeof lock.hasLock!=='function'||!lock.hasLock()))throw new Error('Queue repair requires the admitted document lock.');
  if(!Array.isArray(plans)||!plans.length||plans.length>20)throw new Error('An explicit bounded reviewed repair plan is required.');
  const ids=new Set();plans.forEach(p=>{
    if(!p||['appointmentId','leadId','oldQueueId','physicalOwnerAppointmentId'].some(k=>typeof p[k]!=='string'||!p[k]||p[k].length>160)||
      ['registryRow','sourceRow','physicalOwnerRegistryRow','physicalQueueRow','expectedRevision','accountIndex'].some(k=>!Number.isSafeInteger(p[k]))||
      p.registryRow<2||p.sourceRow<2||p.physicalOwnerRegistryRow<2||p.physicalQueueRow<OA2.FIRST_ROW||p.expectedRevision<1||p.accountIndex<0||p.accountIndex>=OMNI_ACCOUNT_TABS.length||ids.has(p.appointmentId)||p.appointmentId===p.physicalOwnerAppointmentId)throw new Error('Repair plan identity or position is invalid.');
    ids.add(p.appointmentId);
  });
  const ctx=oa2Context_(ss,dryRun),queue=oa2ReadQueue_(ss,false),snaps=new Map(),items=[],ops=[],details=[];
  if(ctx.errors.length)throw new Error('Recovery context requires review.');
  // A targeted repair may not incidentally persist an unrelated recovery.
  Object.keys(ctx.appointments).forEach(id=>{if(!ids.has(id)&&ctx.original[id]!==JSON.stringify(ctx.appointments[id]))throw new Error('Unrelated appointment recovery must be resolved before this targeted repair.');});
  if(ctx.events.some(e=>!ids.has(e[2])))throw new Error('Unrelated journal recovery must be resolved before this targeted repair.');
  const duplicateEntries=new Set(),entries=new Set(),pointers=new Set();queue.forEach(q=>{
    if(q.entryId){if(entries.has(q.entryId))duplicateEntries.add(q.entryId);entries.add(q.entryId);}
    if(q.appointmentId){if(pointers.has(q.appointmentId))throw new Error('Duplicate physical appointment ownership requires review.');pointers.add(q.appointmentId);}
  });
  if(duplicateEntries.size)throw new Error('Duplicate physical queue entry IDs require review.');
  let changed=0,resumed=0,alreadyRepaired=0;
  function ownerRow(p,rows) {
    const matches=rows.filter(q=>q.entryId===p.oldQueueId),owner=ctx.appointments[p.physicalOwnerAppointmentId];
    if(matches.length!==1||!owner||ctx.rows[owner.id]!==p.physicalOwnerRegistryRow||owner.queueId!==p.oldQueueId)throw new Error('Retained physical queue owner changed.');
    const q=matches[0],raw=q.raw||[];
    if(q.row!==p.physicalQueueRow||q.appointmentId!==owner.id||q.entryId!==owner.queueId||oa2Text_(raw[17])!==owner.queueId||oa2Text_(raw[19])!==owner.id||oa2Text_(raw[23])!==owner.leadId||oa2Text_(raw[25])!==q.origin||!['managed','allocating'].includes(q.origin)||
      (q.account&&q.account!==owner.account)||(q.customerKey&&q.customerKey!==owner.customerKey)||(q.origin==='managed'&&(!q.account||!q.customerKey)))throw new Error('Retained physical queue binding does not match the reviewed plan.');
    return q;
  }
  plans.forEach(p=>{
    const a=ctx.appointments[p.appointmentId],account=OMNI_ACCOUNT_TABS[p.accountIndex],newId=oa2QueueEntryRebindId_(p);
    if(!a||a.leadId!==p.leadId||a.account!==account||ctx.rows[a.id]!==p.registryRow||a.queueId!==p.oldQueueId&&a.queueId!==newId)throw new Error('Repair target registry ownership changed.');
    if(ctx.retiredQueueAppointmentIds&&ctx.retiredQueueAppointmentIds.has(a.id))throw new Error('A retired appointment cannot be repaired into the pending queue.');
    if(Object.keys(ctx.appointments).some(id=>ctx.appointments[id].previousId===a.id))throw new Error('An appointment with a retained successor is not an orphan repair target.');
    ownerRow(p,queue);
    const foreignNewOwners=Object.keys(ctx.appointments).filter(id=>id!==a.id&&ctx.appointments[id].queueId===newId);
    if(foreignNewOwners.length||queue.some(q=>q.entryId===newId&&q.appointmentId!==a.id))throw new Error('Replacement queue identity already has a different owner.');
    if(!snaps.has(account))snaps.set(account,oa2AccountSnapshot_(ss.getSheetByName(account),false));
    const snap=snaps.get(account),r=snap.records.find(r=>r.row===p.sourceRow);
    if(!r||!r.meaningful||r.leadId!==a.leadId||r.appointmentId!==a.id||r.account!==a.account||!r.customerKey||r.customerKey!==a.customerKey||!r.phone||oa2Text_(r.phone)!==oa2Text_(a.phone)||
      oa2Date_(r.date)!==a.date||oa2Time_(r.time)!==a.time||!!oa2Text_(r.date)&&!oa2Date_(r.date)||!!oa2Text_(r.time)&&!oa2Time_(r.time))throw new Error('Repair source identity or authoritative schedule changed.');
    const targetRows=queue.filter(q=>q.appointmentId===a.id),first=a.queueId===p.oldQueueId;
    if(first){
      if(Number(a.revision)!==p.expectedRevision||!['active','unscheduled'].includes(a.state)||a.outcome||a.arrivalDate||a.outcomeAt||a.provenance==='legacy_show'||oa2Status_(r.status)!=='booked'||r.outcome||r.outcomeAt||oa2Text_(r.confirmedAt)||targetRows.length||
        !oa2QueueRebindPendingBeforeSafe_(a.pendingQueueBefore))throw new Error('Only an exactly owned open orphan without outcome evidence can be rebound.');
      const shared=Object.keys(ctx.appointments).filter(id=>ctx.appointments[id].queueId===p.oldQueueId);
      if(shared.length<2||!shared.includes(p.physicalOwnerAppointmentId))throw new Error('The reviewed shared queue identity no longer exists.');
      const before=Object.assign(oa2StateView_(a),{queueId:a.queueId,pendingQueueBefore:a.pendingQueueBefore||''});a.queueId=newId;a.revision++;a.updatedAt=ctx.now;a.pendingQueueBefore='';
      const after=Object.assign(oa2StateView_(a),{queueId:newId,pendingQueueBefore:'new'});
      ctx.events.push(['qrb_'+oa2Hash_('queue_entry_rebind_20261116|'+a.id+'|'+p.oldQueueId),ctx.now,a.id,a.leadId,'queue_entry_rebound',JSON.stringify(before),JSON.stringify(after),'governed_queue_repair_20261116']);
      ops.push({kind:'append',appt:a,entryId:newId,recovery:true,state:oa2QueueState_(a,ctx.today)});changed++;
    }else{
      if(Number(a.revision)<p.expectedRevision+1||targetRows.length>1)throw new Error('Prior queue repair cannot be verified.');
      const q=targetRows[0];
      if(q&&(q.entryId!==newId||oa2Text_(q.raw[17])!==newId||oa2Text_(q.raw[19])!==a.id||oa2Text_(q.raw[23])!==a.leadId||oa2Text_(q.raw[25])!==q.origin||!['managed','allocating'].includes(q.origin)||(q.account&&q.account!==a.account)||(q.customerKey&&q.customerKey!==a.customerKey)||(q.origin==='managed'&&(!q.account||!q.customerKey))))throw new Error('Prior repaired queue binding is not exact.');
      if(q&&q.origin==='managed')alreadyRepaired++;
      else{
        if(!['active','unscheduled'].includes(a.state)||a.outcome||oa2Status_(r.status)!=='booked')throw new Error('Incomplete repair with changed outcome requires review.');
        const op={kind:'append',appt:a,entryId:newId,recovery:true,state:oa2QueueState_(a,ctx.today)};if(q)op.row=q.row;ops.push(op);resumed++;
      }
    }
    r.appointmentId=a.id;r.bookedAt=a.bookedAt;r.outcome=a.outcome||(a.state==='canceled'?'取消':'');r.outcomeAt=a.outcomeAt;
    items.push({snap,record:r,decision:{action:'recover',appointmentId:a.id}});
    details.push({accountIndex:p.accountIndex,sourceRow:r.row,registryRow:p.registryRow,physicalOwnerRegistryRow:p.physicalOwnerRegistryRow,physicalQueueRow:p.physicalQueueRow,newBinding:first,alreadyRepaired:!first&&targetRows.length===1&&targetRows[0].origin==='managed'});
  });
  // Do not hide an unreviewed duplicate anywhere in the global registry.
  const owners={};Object.keys(ctx.appointments).forEach(id=>{const qid=ctx.appointments[id].queueId;if(!qid)return;if(owners[qid]&&owners[qid]!==id)throw new Error('An unreviewed duplicate registry queue identity remains.');owners[qid]=id;});
  oa2AssertQueueRebindClaimsFresh_(ss,items,ctx.appointments);
  const freshRegistry=oa2ReadRegistry_(ss);if(Object.keys(freshRegistry.original).length!==Object.keys(ctx.original).length||Object.keys(ctx.original).some(id=>freshRegistry.original[id]!==ctx.original[id]))throw new Error('Registry changed during repair planning; preserve for retry.');
  const freshQueue=oa2ReadQueue_(ss,false);plans.forEach(p=>{ownerRow(p,freshQueue);const id=oa2QueueEntryRebindId_(p),before=queue.filter(q=>q.appointmentId===p.appointmentId),after=freshQueue.filter(q=>q.appointmentId===p.appointmentId);if(JSON.stringify(before.map(q=>q.raw))!==JSON.stringify(after.map(q=>q.raw))||freshQueue.some(q=>q.entryId===id&&q.appointmentId!==p.appointmentId))throw new Error('Queue repair ownership changed during planning.');});
  const writeSnaps=Array.from(snaps.values());writeSnaps.forEach(s=>{const rows=new Set(items.filter(item=>item.snap===s).map(item=>item.record.row));s.deferredRows=new Set(s.records.filter(r=>!rows.has(r.row)).map(r=>r.row));});
  const pending=ctx.events.length||Object.keys(ctx.appointments).some(id=>ctx.original[id]!==JSON.stringify(ctx.appointments[id]))||items.some(item=>item.record.pendingSnapshot);
  if(!dryRun){
    try{
    if(ops.length||pending)oa2Commit_(ss,ctx,freshQueue,ops,writeSnaps,items.map(item=>item.record));
    // Only repaired identities receive their normal visible Brand/Phone/CS
    // projection. Do not finalize another owner's allocating row or sort it.
    oa3RefreshDisplay_(ss,false,{appointments:ctx.appointments,ids:new Set(plans.map(p=>p.appointmentId)),sources:oa3ManualDisplaySources_(items,false),freshSources:()=>oa3ManualDisplaySources_(items,true)});
    SpreadsheetApp.flush();
    const retained=oa2ReadRegistry_(ss).appointments,rows=oa2ReadQueue_(ss,false);
    plans.forEach(p=>{const a=retained[p.appointmentId],id=oa2QueueEntryRebindId_(p),matches=rows.filter(q=>q.appointmentId===p.appointmentId);if(!a||a.queueId!==id||matches.length!==1||matches[0].entryId!==id||matches[0].origin!=='managed'||oa2Text_(matches[0].raw[23])!==a.leadId)throw new Error('Repair readback is incomplete; inspect retained recovery before retry.');ownerRow(p,rows);});
    items.forEach(item=>{const s=item.snap,r=item.record,row=s.sheet.getRange(r.row,1,1,s.width).getValues()[0];if(JSON.stringify(row.slice(0,s.meta-1))!==JSON.stringify(s.values[r.row-2].slice(0,s.meta-1))||oa2Text_(row[s.meta-1])!==r.leadId||oa2Text_(row[s.meta])!==r.appointmentId||oa2Text_(row[s.meta+4]))throw new Error('Repaired source readback changed; inspect accepted stable identity before retry.');});
    }catch(error){try{SpreadsheetApp.flush();}catch(ignored){}throw error;}
  }
  return {readOnly:dryRun,completed:true,changed,resumed,alreadyRepaired,details};
}
