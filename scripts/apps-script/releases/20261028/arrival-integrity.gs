function auditArrivalIntegrity20261013() {
  const ss=oa2Spreadsheet_(),arrival=ss.getSheetByName(OA2.ARRIVAL),queue=oa2ReadQueue_(ss,true),registry=oa2ReadRegistry_(ss).appointments;
  const headers=arrival.getRange(OA2.HEADER_ROW,1,1,arrival.getLastColumn()).getDisplayValues()[0],width=arrival.getLastColumn(),filter=arrival.getFilter();
  const raw=arrival.getRange(OA2.FIRST_ROW,1,Math.max(1,arrival.getLastRow()-OA2.FIRST_ROW+1),width).getValues();
  const trial=headers.indexOf('試做價'),order=headers.indexOf('開單金額'),moneyRows=raw.filter(r=>(trial>=0&&r[trial]!==''&&r[trial]!==null)||(order>=0&&r[order]!==''&&r[order]!==null));
  const byAppt=new Map(queue.filter(q=>q.appointmentId).map(q=>[q.appointmentId,q]));
  const match=(r,status,day)=>queue.some(q=>q.account===r.account&&q.customerKey===r.customerKey&&(status==='show'?oa2Outcome_(q.outcome)==='Show'&&(!day||oa2Date_(q.arrivalDate)===day):oa2Date_(q.date)===day));
  const accounts=OMNI_ACCOUNT_TABS.map(name=>{
    const snap=oa2AccountSnapshot_(ss.getSheetByName(name),true),hs=snap.sheet.getRange(1,1,1,snap.width).getDisplayValues()[0],dateCol=hs.indexOf('確認到店日期');
    const out={account:name,records:0,currentBooked:0,currentShows:0,missingBooked:0,missingShows:0,missingShowDates:0,showQueueMismatch:0,historicalMissingShows:0,missingDetails:[]};
    snap.records.forEach(r=>{if(!r.meaningful)return;out.records++;const status=oa2Status_(r.status),day=dateCol>=0?oa2Date_(snap.values[r.row-2][dateCol]):'',q=r.appointmentId?byAppt.get(r.appointmentId):null;
      if(status==='show'&&!q&&!match(r,'show',day))out.historicalMissingShows++;
      if(!r.isCurrent)return;
      if(status==='booked'){out.currentBooked++;if(oa2Date_(r.date)&&!q&&!match(r,'booked',oa2Date_(r.date))){out.missingBooked++;const a=r.appointmentId?registry[r.appointmentId]:null;out.missingDetails.push({row:r.row,status:'booked',hasLeadId:!!r.leadId,hasAppointmentId:!!r.appointmentId,registryState:a?a.state:null,registryAccount:a?a.account:null,scheduled:oa2Date_(r.date)});}}
      if(status==='show'){out.currentShows++;if(!day)out.missingShowDates++;if(!q&&!match(r,'show',day)){out.missingShows++;const a=r.appointmentId?registry[r.appointmentId]:null;out.missingDetails.push({row:r.row,status:'show',hasLeadId:!!r.leadId,hasAppointmentId:!!r.appointmentId,registryState:a?a.state:null,registryAccount:a?a.account:null,confirmed:day});}else if(q&&oa2Outcome_(q.outcome)!=='Show')out.showQueueMismatch++;}
    });return out;
  });
  const result={readOnly:true,queueRows:queue.filter(q=>!q.blank).length,registryRows:Object.keys(registry).length,filterRange:filter?filter.getRange().getA1Notation():null,lastColumn:width,moneyRows:moneyRows.length,accounts};
  console.log(JSON.stringify(result));return result;
}
function oa2IsHistoricalCrossAccountRecord_(ctx,record){const a=record.appointmentId&&ctx.appointments[record.appointmentId];return !!(a&&a.leadId===record.leadId&&a.account!==record.account&&a.outcome);}
function oa2EnsureUnqueuedSourceShow_(ctx,record,queue) {
  if(oa2Status_(record.status)!=='show' || !record.leadId)return null;
  const day=oa2Date_(record.confirmedAt);
  let a=record.appointmentId?ctx.appointments[record.appointmentId]:null;
  if(record.appointmentId && !a)throw new Error('Source appointment pointer has no registry owner.');
  if(a && (a.leadId!==record.leadId || a.account!==record.account))return null;
  // A customer can own multiple visits, including undated or same-day visits.
  // Only the same durable appointment owns an existing arrival queue row.
  const ownerId=a?a.id:'appt_'+oa2Hash_(record.leadId+'|source-show');
  const owned=queue.filter(q=>q.appointmentId===ownerId);
  if(owned.length>1)throw new Error('Arrival appointment has duplicate queue ownership.');
  if(owned.length)return null;
  if(queue.some(q=>!q.appointmentId && q.account===record.account &&
      q.customerKey===record.customerKey && oa2Outcome_(q.outcome)==='Show' &&
      (!day || !oa2Date_(q.arrivalDate) || oa2Date_(q.arrivalDate)===day))) {
    throw new Error('Historical arrival has no stable appointment owner; verify its identity before recovery.');
  }
  if(a && (!['active','unscheduled'].includes(a.state) || a.outcome))return null;
  if(!a) {
    const id=ownerId;
    a=ctx.appointments[id];
    if(a && (a.leadId!==record.leadId || a.account!==record.account || a.outcome!=='Show'))throw new Error('Source arrival identity is already owned.');
    if(!a) {
      a={id,leadId:record.leadId,account:record.account,customerKey:record.customerKey,phone:record.phone,name:record.name,
        brand:record.brand,treatment:record.treatment,branch:record.branch,createdAt:oa2Date_(record.createdAt),
        date:oa2Date_(record.date),time:oa2Time_(record.time),bookedAt:'',provenance:'legacy_registration_unknown',
        state:'unscheduled',outcome:'',arrivalDate:'',outcomeAt:'',revision:0,previousId:'',queueId:'',
        lastStatus:'show',lastSchedule:oa2Date_(record.date)+'|'+oa2Time_(record.time),firstSeenAt:ctx.now,updatedAt:ctx.now,
        generatedArrivalDate:'',pendingArrivalOverride:'cleared'};
      ctx.appointments[id]=a;
    }
  }
  if(a.outcome!=='Show') {
    const before=oa2StateView_(a);
    a.state='completed';a.outcome='Show';a.arrivalDate=day;a.outcomeAt='';a.revision++;a.updatedAt=ctx.now;
    oa2Event_(ctx,a,'source_show_reconciled',before,'source_reconciliation');
  }
  if(!a.queueId)a.queueId=ctx.id('arrival');
  record.appointmentId=a.id;
  return a;
}

function oa2QueueManualColumns_(sheet,headers) {
  headers=headers||sheet.getRange(OA2.HEADER_ROW,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  return headers.flatMap((h,i)=>['CS同事名','來源','試做價','開單金額','總金額'].includes(oa2Text_(h))?[i]:[]);
}
/** A generated zero total is an unused template, not an owned payment. */
function oa2QueueManualCellHasData_(header,value) {
  const text=oa2Text_(value);if(!text)return false;
  if(oa2Text_(header)!=='總金額')return true;
  const token=text.replace(/^(?:HK\$|HKD|\$)\s*/i,'').replace(/,/g,'');
  // Invalid or nonzero totals are preserved for review; never coerce them away.
  return !/^-?\d+(?:\.\d{1,2})?$/.test(token)||Number(token)!==0;
}
function oa2QueueRowHasManualData_(sheet,row) {
  const headers=sheet.getRange(OA2.HEADER_ROW,1,1,sheet.getLastColumn()).getDisplayValues()[0],columns=oa2QueueManualColumns_(sheet,headers);if(!columns.length)return false;
  const first=Math.min(...columns),last=Math.max(...columns),values=sheet.getRange(row,first+1,1,last-first+1).getValues()[0];
  return columns.some(i=>oa2QueueManualCellHasData_(headers[i],values[i-first]));
}
function oa2ArrivalManualSnapshot_(sheet) {
  const headers=sheet.getRange(OA2.HEADER_ROW,1,1,sheet.getLastColumn()).getDisplayValues()[0],manual=oa2QueueManualColumns_(sheet,headers);
  const appointment=headers.findIndex(h=>/^Appointment\s*ID$/.test(h)),entry=headers.indexOf('到店紀錄ID（內部）'),count=Math.max(0,sheet.getLastRow()-OA2.FIRST_ROW+1),map={};
  if(!count)return map;
  sheet.getRange(OA2.FIRST_ROW,1,count,headers.length).getValues().forEach((row,i)=>{
    if(!manual.some(c=>oa2QueueManualCellHasData_(headers[c],row[c])))return;
    const key=oa2Text_(row[appointment])||oa2Text_(row[entry])||'row:'+(i+OA2.FIRST_ROW);
    if(map[key])throw new Error('Manual arrival data has duplicate record ownership.');
    map[key]=manual.map(c=>row[c]);
  });return map;
}
function oa2BackupArrivalBeforeRepair_(ss){const name='_arrival_before_20261013',existing=ss.getSheetByName(name),marker='arrival-repair-backup-ready-v1';if(existing&&existing.getRange(1,1).getNote()===marker)return name;const source=ss.getSheetByName(OA2.ARRIVAL),copy=existing||source.copyTo(ss).setName(name),count=Math.max(0,source.getLastRow()-OA2.FIRST_ROW+1);if(count){const values=source.getRange(OA2.FIRST_ROW,1,count,source.getLastColumn()).getValues(),range=copy.getRange(OA2.FIRST_ROW,1,count,source.getLastColumn());range.clearDataValidations();range.clearContent();range.setValues(values);}copy.hideSheet();copy.getRange(1,1).setNote(marker);return name;}

function oa2RepairMissingArrivalAccount20261013_(name) {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))throw new Error('Busy; retry later.');
  try {
    const ss=oa2Spreadsheet_(),arrival=ss.getSheetByName(OA2.ARRIVAL),backup=oa2BackupArrivalBeforeRepair_(ss),before=oa2ArrivalManualSnapshot_(arrival);
    const result=oa2ProcessAccount_(ss,ss.getSheetByName(name),'scan',null,false),after=oa2ArrivalManualSnapshot_(arrival);
    Object.keys(before).forEach(id=>{if(JSON.stringify(before[id])!==JSON.stringify(after[id]))throw new Error('Manual arrival data changed during reconciliation; review the preserved backup.');});
    console.log(JSON.stringify({handler:'arrival_integrity_repair',account:name,newQueue:result.newQueue,changes:result.changes,manualRecordsPreserved:Object.keys(before).length,backup}));
    return result;
  }finally{lock.releaseLock();}
}
function repairMissingArrivalsMain20261013(){return oa2RepairMissingArrivalAccount20261013_('Alyssa Main');}
function repairMissingArrivalsAesthetics20261013(){return oa2RepairMissingArrivalAccount20261013_('Alyssa Aesthetics');}
function previewMissingArrivals20261013(){const ss=oa2Spreadsheet_();const results=['Alyssa Main','Alyssa Aesthetics'].map(name=>oa2ProcessAccount_(ss,ss.getSheetByName(name),'scan',null,true));console.log(JSON.stringify(results));return results;}
