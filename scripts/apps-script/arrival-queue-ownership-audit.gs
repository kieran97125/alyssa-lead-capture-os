/** Read-only ownership diagnostic. Never logs identifiers, contacts or raw cell values. */
function auditArrivalQueueOwnershipReadOnly20261116(targetRegistryRow) {
  try{return oa3AuditArrivalQueueOwnershipReadOnly20261116_(targetRegistryRow);}
  catch(ignored){
    console.log(JSON.stringify({handler:'arrival_queue_ownership_audit',readOnly:true,completed:false,reason:'ownership_read_incomplete'}));
    throw new Error('Ownership audit did not complete; no changes were made.');
  }
}
function oa3AuditArrivalQueueOwnershipReadOnly20261116_(targetRegistryRow) {
  const started=Date.now(),target=targetRegistryRow===undefined?425:targetRegistryRow;
  if(!Number.isInteger(target)||target<2)throw new Error('Invalid diagnostic target position.');
  const ss=oa2Spreadsheet_(),raw=oa2ReadRegistry_(ss),queue=oa2ReadQueue_(ss,false),sources=[];
  let replayed=null,contextAvailable=true,sourceExtentsStable=true,invalidAnchors=0;
  try{replayed=oa2Context_(ss,true);}catch(ignored){contextAvailable=false;}
  OMNI_ACCOUNT_TABS.forEach((account,accountIndex)=>{
    const sheet=ss.getSheetByName(account);if(!sheet)throw new Error('An ownership source is unavailable.');
    const meta=oa2Meta_(sheet,false),last=sheet.getLastRow(),values=last<2?[]:sheet.getRange(2,meta,last-1,6).getValues();
    if(sheet.getLastRow()!==last)sourceExtentsStable=false;
    values.forEach((values,index)=>{
      const leadId=oa2Text_(values[0]),appointmentId=oa2Text_(values[1]),pending=oa2Text_(values[5]);
      if(!leadId&&!appointmentId&&!pending)return;
      let anchor=null,anchorValid=false;
      if(pending){try{anchor=JSON.parse(pending);anchorValid=oa2ValidIdentityAnchor_(anchor,account);}catch(ignored){}if(!anchorValid)invalidAnchors++;}
      sources.push({accountIndex,account,row:index+2,leadId,appointmentId,pending:!!pending,anchorValid,anchor:anchorValid?anchor:null});
    });
  });
  const groups=new Map(),get=key=>{if(!groups.has(key))groups.set(key,{raw:[],replayed:[],physical:[],anchors:[]});return groups.get(key);};
  Object.keys(raw.appointments).forEach(id=>{const a=raw.appointments[id];if(a.queueId)get(oa2Text_(a.queueId)).raw.push(a);});
  if(replayed)Object.keys(replayed.appointments).forEach(id=>{const a=replayed.appointments[id];if(a.queueId)get(oa2Text_(a.queueId)).replayed.push(a);});
  queue.forEach(q=>{if(q.entryId)get(q.entryId).physical.push(q);});
  sources.forEach(source=>{if(source.anchor)(source.anchor.appointments||[]).forEach(a=>{if(a.queueId)get(oa2Text_(a.queueId)).anchors.push({source,appointment:a});});});
  const state=value=>['active','unscheduled','completed','canceled','superseded','reschedule_requested'].includes(oa2Text_(value))?oa2Text_(value):'unrecognized';
  const outcome=value=>{
    const text=oa2Text_(value);if(!text)return '';
    if(['待到店','取消','改期'].includes(text))return text;
    const result=oa2Outcome_(text);return result===null?'unrecognized':result;
  };
  const registryPosition=(registry,id)=>registry&&Number.isInteger(registry.rows[id])?registry.rows[id]:0;
  const owned=(a,q)=>!!a&&a.id===q.appointmentId&&a.queueId===q.entryId&&a.leadId===oa2Text_(q.raw&&q.raw[23])&&a.account===q.account&&a.customerKey===q.customerKey;
  // A unique queue ID can still carry a different lead/account/key. Shared-ID
  // groups alone do not explain the native commit's ownership guard.
  const bindingMismatches=queue.filter(q=>q.origin==='managed'&&(!owned(raw.appointments[q.appointmentId],q)||replayed&&!owned(replayed.appointments[q.appointmentId],q))).map(q=>{
    const original=raw.appointments[q.appointmentId],effective=replayed&&replayed.appointments[q.appointmentId],a=effective||original;
    return {queueRow:q.row,queueAccountIndex:OMNI_ACCOUNT_TABS.indexOf(q.account),registryRow:registryPosition(raw,q.appointmentId),
      registryAccountIndex:a?OMNI_ACCOUNT_TABS.indexOf(a.account):-1,rawOwnershipMatches:owned(original,q),replayedOwnershipMatches:owned(effective,q),
      queueIdMatches:!!a&&a.queueId===q.entryId,leadMatches:!!a&&a.leadId===oa2Text_(q.raw&&q.raw[23]),
      accountMatches:!!a&&a.account===q.account,customerKeyMatches:!!a&&a.customerKey===q.customerKey,
      sourceClaimPositions:a?sources.filter(s=>s.appointmentId===a.id||s.leadId===a.leadId).map(s=>({accountIndex:s.accountIndex,row:s.row,
        appointmentMatches:s.appointmentId===a.id,leadMatches:s.leadId===a.leadId,accountMatches:s.account===a.account,pendingAnchorPresent:s.pending})):[]};
  });
  const preflightViolations=[];
  queue.forEach(q=>{
    const view={appointments:replayed?replayed.appointments:raw.appointments,errors:[]};oa2PreflightQueueOwnership_(view,[q]);
    if(!view.errors.length)return;
    const a=view.appointments[q.appointmentId],values=q.raw||[];
    preflightViolations.push({queueRow:q.row,registryRow:registryPosition(raw,q.appointmentId),
      origin:['managed','allocating','legacy_show'].includes(q.origin)?q.origin:'unrecognized',
      registryState:a?state(a.state):'missing',revision:a&&Number.isSafeInteger(a.revision)?a.revision:0,
      visiblePayloadFields:values.slice(0,6).filter(v=>oa2Text_(v)).length,
      queueIdMatches:!!a&&q.entryId===a.queueId,rawEntryMatches:!!a&&oa2Text_(values[17])===a.queueId,
      rawAppointmentMatches:!!a&&oa2Text_(values[19])===a.id,rawLeadMatches:!!a&&oa2Text_(values[23])===a.leadId,
      rawOriginMatches:oa2Text_(values[25])===q.origin,accountMatches:!!a&&q.account===a.account,
      customerKeyMatches:!!a&&q.customerKey===a.customerKey,
      pendingBeforeNew:!!a&&a.pendingQueueBefore==='new',pendingBeforePresent:!!(a&&a.pendingQueueBefore),
      sourceClaimPositions:a?sources.filter(s=>s.appointmentId===a.id||s.leadId===a.leadId).map(s=>({accountIndex:s.accountIndex,row:s.row,
        appointmentMatches:s.appointmentId===a.id,leadMatches:s.leadId===a.leadId,accountMatches:s.account===a.account,pendingAnchorPresent:s.pending})):[]});
  });
  const ownerView=(a,registry,other,group)=>({
    registryRow:registryPosition(registry,a.id),accountIndex:OMNI_ACCOUNT_TABS.indexOf(a.account),state:state(a.state),outcome:outcome(a.outcome),
    revision:Number.isSafeInteger(a.revision)?a.revision:0,
    existsInOtherView:!!(other&&other.appointments[a.id]),
    differsFromRaw:!raw.appointments[a.id]||JSON.stringify(a)!==raw.original[a.id],
    hasReplayedEvents:!!(replayed&&replayed.events.some(event=>event[2]===a.id)),
    queueIdMatchesOtherView:!!(other&&other.appointments[a.id]&&other.appointments[a.id].queueId===a.queueId),
    leadMatchesOtherView:!!(other&&other.appointments[a.id]&&other.appointments[a.id].leadId===a.leadId),
    physicallyOwnedRows:group.physical.filter(q=>owned(a,q)).map(q=>q.row),
    sourceClaimPositions:sources.filter(s=>s.appointmentId===a.id||s.leadId===a.leadId).map(s=>({accountIndex:s.accountIndex,row:s.row,
      appointmentMatches:s.appointmentId===a.id,leadMatches:s.leadId===a.leadId,accountMatches:s.account===a.account,
      pendingAnchorPresent:s.pending,pendingAnchorValid:s.anchorValid})),
    anchorClaimPositions:group.anchors.filter(item=>item.appointment.id===a.id).map(item=>({accountIndex:item.source.accountIndex,row:item.source.row,
      leadMatches:item.appointment.leadId===a.leadId,accountMatches:item.appointment.account===a.account,
      sourceLeadMatches:item.source.leadId===a.leadId,currentPointerMatches:item.source.anchor.currentAppointmentId===a.id}))
  });
  const shared=[],targetOwnerIds=new Set();
  groups.forEach(group=>{
    const owners=new Set(group.raw.concat(group.replayed).map(a=>a.id));
    group.physical.forEach(q=>{if(q.appointmentId)owners.add(q.appointmentId);});group.anchors.forEach(item=>owners.add(item.appointment.id));
    if(owners.size<2&&group.raw.length<2&&group.replayed.length<2&&group.physical.length<2)return;
    const targetGroup=group.raw.some(a=>registryPosition(raw,a.id)===target)||group.replayed.some(a=>registryPosition(replayed,a.id)===target);
    if(targetGroup)owners.forEach(id=>targetOwnerIds.add(id));
    shared.push({targetGroup,distinctAppointmentOwners:owners.size,rawRegistryOwners:group.raw.length,replayedOwners:group.replayed.length,
      physicalRows:group.physical.length,pendingAnchorClaims:group.anchors.length,
      raw:group.raw.map(a=>ownerView(a,raw,replayed,group)),replayed:group.replayed.map(a=>ownerView(a,replayed,raw,group)),
      rawOwnersInReplayedView:replayed?group.raw.filter(a=>replayed.appointments[a.id]).map(a=>ownerView(replayed.appointments[a.id],replayed,raw,group)):[],
      replayedOwnersInRawView:group.replayed.filter(a=>raw.appointments[a.id]).map(a=>ownerView(raw.appointments[a.id],raw,replayed,group)),
      physical:group.physical.map(q=>{
        const original=raw.appointments[q.appointmentId],effective=replayed&&replayed.appointments[q.appointmentId];
        return {row:q.row,accountIndex:OMNI_ACCOUNT_TABS.indexOf(q.account),origin:['managed','allocating','legacy_show'].includes(q.origin)?q.origin:'unrecognized',outcome:outcome(q.outcome),
          rawRegistryRow:registryPosition(raw,q.appointmentId),replayedRegistryRow:registryPosition(replayed,q.appointmentId),
          rawAppointmentKnown:!!original,replayedAppointmentKnown:!!effective,
          rawQueueIdMatches:!!original&&original.queueId===q.entryId,replayedQueueIdMatches:!!effective&&effective.queueId===q.entryId,
          rawLeadMatches:!!original&&original.leadId===oa2Text_(q.raw&&q.raw[23]),replayedLeadMatches:!!effective&&effective.leadId===oa2Text_(q.raw&&q.raw[23]),
          rawOwnershipMatches:owned(original,q),replayedOwnershipMatches:owned(effective,q)};
      }),
      anchorClaims:group.anchors.map(item=>({accountIndex:item.source.accountIndex,sourceRow:item.source.row,
        rawRegistryRow:registryPosition(raw,item.appointment.id),replayedRegistryRow:registryPosition(replayed,item.appointment.id),
        sourceLeadMatches:item.source.leadId===item.appointment.leadId,sourcePointerMatches:item.source.appointmentId===item.appointment.id,
        currentAnchorPointerMatches:item.source.anchor.currentAppointmentId===item.appointment.id}))});
  });
  shared.sort((a,b)=>Number(b.targetGroup)-Number(a.targetGroup));
  const replayChanges=replayed?Object.keys(replayed.appointments).filter(id=>JSON.stringify(replayed.appointments[id])!==replayed.original[id]):[];
  const replayEvents=replayed?replayed.events:[];
  const result={readOnly:true,changesMade:false,completed:contextAvailable&&sourceExtentsStable&&invalidAnchors===0,contextAvailable,sourceExtentsStable,targetRegistryRow:target,
    rawRegistryAppointments:Object.keys(raw.appointments).length,replayedAppointments:replayed?Object.keys(replayed.appointments).length:0,
    replayedOriginalAppointments:replayed?Object.keys(replayed.original).length:0,replayedChangeCount:replayChanges.length,replayedEventCount:replayEvents.length,
    replayedChangesOutsideTargetGroups:replayChanges.filter(id=>!targetOwnerIds.has(id)).length,
    replayedEventsOutsideTargetGroups:replayEvents.filter(event=>!targetOwnerIds.has(event[2])).length,
    replayedChangePositions:replayChanges.map(id=>({registryRow:registryPosition(raw,id),accountIndex:OMNI_ACCOUNT_TABS.indexOf(replayed.appointments[id].account),
      state:state(replayed.appointments[id].state),outcome:outcome(replayed.appointments[id].outcome),hasReplayedEvents:replayEvents.some(event=>event[2]===id)})),
    physicalQueueRows:queue.length,sourceMetadataClaims:sources.length,pendingAnchorRows:sources.filter(s=>s.pending).length,
    invalidPendingAnchors:invalidAnchors,sharedQueueGroups:shared.length,targetGroups:shared.filter(g=>g.targetGroup).length,
    bindingMismatchRows:bindingMismatches.length,bindingMismatches,preflightViolationRows:preflightViolations.length,preflightViolations,groups:shared,elapsedMs:Date.now()-started};
  console.log(JSON.stringify(Object.assign({handler:'arrival_queue_ownership_audit'},result)));
  return result;
}
