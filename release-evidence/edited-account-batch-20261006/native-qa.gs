/**
 * EXPLICIT QA MUTATION, optional separate file, not part of Code.gs.
 * Creates ONE new Google spreadsheet containing synthetic records only.
 * Writes only that returned spreadsheet; does not read the production workbook,
 * install triggers, touch Script/Document Properties, use DriveApp, or change sharing.
 * Keeps the synthetic workbook as review evidence and logs its actual URL.
 * Cleanup: owner can move that one returned QA workbook to Trash after review.
 * Runs reviewed adapter primitives with explicit ss; deliberately avoids production entrypoints.
 */
function runOmniArrivalV2IsolatedSheetTest() {
  const ss=SpreadsheetApp.create('Arrival Workflow QA - SYNTHETIC ONLY - '+new Date().toISOString());
  const results=[];let id=0;
  function assert(name,condition){results.push({name,ok:!!condition});if(!condition)throw new Error('QA failed: '+name);}
  function grow(sh,width){if(sh.getMaxColumns()<width)sh.insertColumnsAfter(sh.getMaxColumns(),width-sh.getMaxColumns());}
  const account=ss.getSheets()[0].setName('QA Synthetic Account');grow(account,OMNI_HEADERS.length+OA2.ACCOUNT_HEADERS.length);
  account.getRange(1,1,1,OMNI_HEADERS.length+OA2.ACCOUNT_HEADERS.length).setValues([OMNI_HEADERS.concat(OA2.ACCOUNT_HEADERS)]);
  const queue=ss.insertSheet(OA2.ARRIVAL);grow(queue,26);
  queue.getRange(7,1,1,26).setValues([OA2_QUEUE_BASE_HEADERS.concat(OA2.QUEUE_HEADERS)]);
  queue.getRange(8,18,8,1).setValues(Array.from({length:8},(_,i)=>['QA-ARR-'+i]));
  const registry=ss.insertSheet(OA2.LEDGER);grow(registry,OA2.LEDGER_HEADERS.length);registry.getRange(1,1,1,OA2.LEDGER_HEADERS.length).setValues([OA2.LEDGER_HEADERS]);
  const history=ss.insertSheet(OA2.HISTORY);history.getRange(1,1,1,OA2.HISTORY_HEADERS.length).setValues([OA2.HISTORY_HEADERS]);
  // The QA file uses Hong Kong time; production/project timezone is not changed.
  ss.setSpreadsheetTimeZone(OA2.TZ);
  const columns=getOmniColumns_(account);
  const rows=[['SYNTHETIC-A','12345678','2026-10-01'],['SYNTHETIC-B','87654321','2026-09-30'],['SYNTHETIC-C','23456789','2026-10-02']].map(item=>{const row=Array(31).fill('');row[columns.LAST_UPDATED-1]=oa2NativeDate_('2026-10-01');row[columns.CREATED_AT-1]=oa2NativeDate_('2026-09-01');row[columns.STATUS-1]='已預約';row[columns.BRAND-1]='SYNTHETIC';row[columns.APPOINTMENT_DATE-1]=oa2NativeDate_(item[2]);row[columns.APPOINTMENT_TIME-1]=oa2NativeTime_('10:30');row[columns.NAME-1]=item[0];row[columns.PHONE-1]=item[1];row[columns.TREATMENT-1]='SYNTHETIC SERVICE';row[columns.BRANCH-1]='SYNTHETIC BRANCH';row[columns.ACCOUNT-1]=account.getName();return row;});
  account.getRange(2,columns.APPOINTMENT_TIME,3,1).setNumberFormat('hh:mm');
  account.getRange(2,columns.APPOINTMENT_DATE,3,1).setNumberFormat('yyyy-mm-dd');
  account.getRange(2,1,3,31).setValues(rows);
  // Exercise the new row reader with real native values in this synthetic file.
  // Temporarily bind a deterministic clock only inside this QA execution.
  const savedToday=today_,rowReadSamples=[];
  try {
    today_=()=>oa2NativeDate_('2026-10-01');
    const samples=[{row:2,col:columns.STATUS,old:'未聯絡'},
      {row:3,col:columns.CS_OWNER,old:''},{row:4,col:columns.APPOINTMENT_DATE,old:''}];
    account.getRange(3,columns.CS_OWNER).setValue('SYNTHETIC CS');
    samples.forEach(sample=>{
      const started=Date.now();
      omniUpdateEditedAccountRows_({oldValue:sample.old,range:{getNumColumns:()=>1}},account,account.getName(),columns,sample.row,sample.row,sample.col,sample.col);
      SpreadsheetApp.flush();rowReadSamples.push({kind:sample.col===columns.STATUS?'booking_status':sample.col===columns.CS_OWNER?'cs_owner':'appointment_date',durationMs:Date.now()-started});
    });
    assert('Native batch reader preserves explicit CS and appointment date',account.getRange(3,columns.CS_OWNER).getValue()==='SYNTHETIC CS'&&oa2Date_(account.getRange(4,columns.APPOINTMENT_DATE).getValue())==='2026-10-02');
    assert('Native batch reader applies original booking update day',oa2Date_(account.getRange(2,columns.LAST_UPDATED).getValue())==='2026-10-01');
  } finally { today_=savedToday; }
  const original=JSON.stringify(account.getRange(2,1,3,25).getValues());
  const ctx={now:'2026-10-01T08:30:00.000Z',today:'2026-10-01',appointments:{},rows:{},original:{},events:[],errors:[],dryRun:false,id:kind=>'qa_'+kind+'_'+(++id)};
  let snap=oa2AccountSnapshot_(account,false);snap.records.forEach(r=>{r.bookingMutation=true;oa2ReconcileRecord_(ctx,r,'edit');});
  function commitPrimitives(snapshot) {
    const q=oa2ReadQueue_(ss,false),ops=oa2FilterQueueOps_(ctx,q,oa2PlanQueue_(ctx,q));
    oa2AssertSourceUnchanged_(snapshot);oa2AllocateQueue_(ss,ctx,q,ops);oa2WriteSourceAnchors_(snapshot,ctx);
    oa2WriteRegistry_(ss,ctx);oa2WriteAccountMeta_(snapshot);oa2WriteQueue_(ss,ctx,q,ops,snapshot.records);oa2WriteRegistry_(ss,ctx);SpreadsheetApp.flush();
  }
  try {
    commitPrimitives(snap);
    let q=oa2ReadQueue_(ss,false).filter(r=>r.appointmentId);
    assert('Native fixed rows include all active bookings, including future appointments',q.length===3&&['2026-09-30','2026-10-01','2026-10-02'].every(day=>q.some(r=>oa2Date_(r.date)===day)));
    assert('Future appointment rejects an outcome',(()=>{try{oa2SetOutcome_(ctx,q.find(r=>oa2Date_(r.date)==='2026-10-02').appointmentId,'Show','2026-10-01','qa');return false;}catch(error){return /future appointment/.test(String(error.message));}})());
    assert('Source A:Y byte-for-byte unchanged by adapter',JSON.stringify(account.getRange(2,1,3,25).getValues())===original);
    assert('Preassigned arrival IDs reused',q.every(r=>r.entryId.indexOf('QA-ARR-')===0));
    const native=oa2ReadRegistry_(ss);assert('Native registration Date and fractional time roundtrip',Object.values(native.appointments).every(a=>a.bookedAt===ctx.now&&a.time==='10:30'));
    Object.assign(ctx,{appointments:native.appointments,rows:native.rows,original:native.original,events:[]});
    const show=q.find(r=>oa2Date_(r.date)==='2026-10-01');queue.getRange(show.row,4).setValue('已到店');
    oa2AbsorbQueueInputs_(ctx,oa2ReadQueue_(ss,false));snap=oa2AccountSnapshot_(account,false);snap.records.forEach(r=>oa2ReconcileRecord_(ctx,r,'scan'));commitPrimitives(snap);
    assert('Native manual Show gets actual HK date',ctx.appointments[show.appointmentId].arrivalDate==='2026-10-01');
    assert('Original LastUpdated and customer fields remain unchanged after Show',JSON.stringify(account.getRange(2,1,3,25).getValues())===original);
    const overdue=q.find(r=>oa2Date_(r.date)==='2026-09-30');queue.getRange(overdue.row,4).setValue('No Show');oa2AbsorbQueueInputs_(ctx,oa2ReadQueue_(ss,false));snap=oa2AccountSnapshot_(account,false);snap.records.forEach(r=>oa2ReconcileRecord_(ctx,r,'scan'));commitPrimitives(snap);
    assert('Native No Show uses scheduled day without invented arrival',ctx.appointments[overdue.appointmentId].arrivalDate===''&&oa2MetricPeople_(ctx.appointments,'no_show','2026-09-01','2026-09-30')===1);
    account.getRange(2,1,3,31).sort([{column:columns.PHONE,ascending:false}]);snap=oa2AccountSnapshot_(account,false);snap.records.forEach(r=>oa2ReconcileRecord_(ctx,r,'scan'));commitPrimitives(snap);
    const shown=snap.records.find(r=>r.appointmentId===show.appointmentId);assert('Native sort retains stable outcome binding',shown&&shown.phone==='12345678'&&account.getRange(shown.row,29).getValue()==='已到店');
    const count=registry.getLastRow();snap=oa2AccountSnapshot_(account,false);snap.records.forEach(r=>oa2ReconcileRecord_(ctx,r,'scan'));commitPrimitives(snap);
    assert('Native retry creates no duplicate registry/queue rows',registry.getLastRow()===count&&oa2ReadQueue_(ss,false).filter(r=>r.appointmentId).length===3);
    const result={syntheticOnly:true,productionTouched:false,scriptPropertiesTouched:false,spreadsheetId:ss.getId(),url:ss.getUrl(),rowReadSamples,passed:results.filter(r=>r.ok).length,total:results.length,results,cleanup:'Only this returned synthetic QA workbook may be moved to Trash after review.'};console.log(JSON.stringify(result));return result;
  } catch(error) {console.log(JSON.stringify({syntheticOnly:true,productionTouched:false,spreadsheetId:ss.getId(),url:ss.getUrl(),error:String(error.message||error),results}));throw error;}
}
