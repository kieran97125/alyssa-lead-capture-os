/** Bridge current, unqueued Show evidence without guessing dates or registration time. */
function oa2IsHistoricalCrossAccountRecord_(ctx,record) {
  const a=record.appointmentId&&ctx.appointments[record.appointmentId];
  return !!(a&&a.leadId===record.leadId&&a.account!==record.account&&a.outcome);
}
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

function oa2QueueManualColumns_(sheet) {
  const headers=sheet.getRange(OA2.HEADER_ROW,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  return headers.flatMap((h,i)=>['來源','試做價','開單金額'].includes(oa2Text_(h))?[i]:[]);
}
function oa2QueueRowHasManualData_(sheet,row) {
  const columns=oa2QueueManualColumns_(sheet);if(!columns.length)return false;
  const first=Math.min(...columns),last=Math.max(...columns),values=sheet.getRange(row,first+1,1,last-first+1).getValues()[0];
  return columns.some(i=>oa2Text_(values[i-first])!=='');
}

function oa2ArrivalManualSnapshot_(sheet) {
  const headers=sheet.getRange(OA2.HEADER_ROW,1,1,sheet.getLastColumn()).getDisplayValues()[0],manual=oa2QueueManualColumns_(sheet);
  const appointment=headers.findIndex(h=>/^Appointment\s*ID$/.test(h)),entry=headers.indexOf('到店紀錄ID（內部）'),count=Math.max(0,sheet.getLastRow()-OA2.FIRST_ROW+1),map={};
  if(!count)return map;
  sheet.getRange(OA2.FIRST_ROW,1,count,headers.length).getValues().forEach((row,i)=>{
    if(!manual.some(c=>oa2Text_(row[c])!==''))return;
    const key=oa2Text_(row[appointment])||oa2Text_(row[entry])||'row:'+(i+OA2.FIRST_ROW);
    if(map[key])throw new Error('Manual arrival data has duplicate record ownership.');
    map[key]=manual.map(c=>row[c]);
  });return map;
}

function oa2BackupArrivalBeforeRepair_(ss) {
  const name='_arrival_before_20261013',existing=ss.getSheetByName(name),marker='arrival-repair-backup-ready-v1';
  if(existing&&existing.getRange(1,1).getNote()===marker)return name;
  const source=ss.getSheetByName(OA2.ARRIVAL),copy=existing||source.copyTo(ss).setName(name),count=Math.max(0,source.getLastRow()-OA2.FIRST_ROW+1);
  if(count){const values=source.getRange(OA2.FIRST_ROW,1,count,source.getLastColumn()).getValues(),range=copy.getRange(OA2.FIRST_ROW,1,count,source.getLastColumn());range.clearDataValidations();range.clearContent();range.setValues(values);}
  copy.hideSheet();copy.getRange(1,1).setNote(marker);return name;
}
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
