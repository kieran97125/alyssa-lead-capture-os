/**
 * Explicit current-source workflow QA. All cells are synthetic, in one newly
 * created spreadsheet. No installer, timer, outer onEdit, trigger or manual RPC
 * is invoked. Admission uses the existing DocumentLock, without waiting, and
 * respects staff priority before and after acquisition. Properties are compared
 * internally only, never written, restored, logged or returned.
 *
 * Coverage uses the real inner Account/arrival edit handlers and the existing
 * missing-only planner/commit primitives. The fixture report is an independent
 * native Sheets COUNTIF/SUM check of accepted registry/amount cells, not a claim
 * that the separately governed production dashboard has been verified here.
 */
function verifyArrivalWorkflowIsolated20261022() {
  const started=Date.now(),receipt={handler:'workflow_isolated_qa_20261022',ok:false,skipped:false,passed:[],phases:[]};
  let fixture,historyCursor=2;
  const assert=(ok,code)=>{if(!ok){const error=new Error(code);error.qaCode=code;throw error;}};
  const canonical=properties=>JSON.stringify(Object.keys(properties).sort().map(key=>[key,properties[key]]));
  const finish=()=>{receipt.elapsedMs=Date.now()-started;console.log(JSON.stringify(receipt));return receipt;};
  const phase=(name,action)=>{
    if(Date.now()-started>250000){receipt.skipped=true;receipt.reason='execution_budget';return false;}
    if(omniStaffPriorityActive_()){receipt.skipped=true;receipt.reason='staff_priority';return false;}
    const lock=LockService.getDocumentLock();
    if(!lock||!lock.tryLock(0)){receipt.skipped=true;receipt.reason='document_lock_busy';return false;}
    const phaseStarted=Date.now();let result,error,originals,scriptProperties,documentProperties,beforeScript,beforeDocument,unchanged=null;
    try {
      if(omniStaffPriorityActive_()){receipt.skipped=true;receipt.reason='staff_priority';return false;}
      scriptProperties=PropertiesService.getScriptProperties();documentProperties=PropertiesService.getDocumentProperties();
      beforeScript=canonical(scriptProperties.getProperties());beforeDocument=canonical(documentProperties.getProperties());
      originals={spreadsheet:oa2Spreadsheet_,historyStart:oa2HistoryStart_,advanceHistory:oa2AdvanceHistoryCursor_,retired:oa4RetiredAppointmentIds_};
      oa2Spreadsheet_=()=>fixture;
      oa2HistoryStart_=sheet=>{assert(sheet.getParent().getId()===fixture.getId(),'history_context_not_fixture');assert(historyCursor<=sheet.getLastRow()+1,'fixture_history_cursor_invalid');return historyCursor;};
      oa2AdvanceHistoryCursor_=(ss,nextRow)=>{assert(ss.getId()===fixture.getId(),'history_write_not_fixture');assert(Number.isInteger(nextRow)&&nextRow>=2,'fixture_history_cursor_invalid');historyCursor=nextRow;};
      oa4RetiredAppointmentIds_=()=>new Set();
      assert(oa2Enabled_(),'current_native_workflow_not_enabled');
      result=action(lock);
    }catch(caught){error=caught;}
    finally {
      try {
        if(originals){oa2Spreadsheet_=originals.spreadsheet;oa2HistoryStart_=originals.historyStart;oa2AdvanceHistoryCursor_=originals.advanceHistory;oa4RetiredAppointmentIds_=originals.retired;}
        if(beforeScript!==undefined&&beforeDocument!==undefined){
          unchanged=beforeScript===canonical(scriptProperties.getProperties())&&beforeDocument===canonical(documentProperties.getProperties());
          if(!unchanged&&!error){error=new Error('project_properties_changed_during_fixture');error.qaCode='project_properties_changed_during_fixture';}
        }
      }catch(cleanupError){if(!error){error=new Error('fixture_cleanup_or_property_verification_failed');error.qaCode='fixture_cleanup_or_property_verification_failed';}}
      finally {receipt.phases.push({name,elapsedMs:Date.now()-phaseStarted,projectPropertiesUnchanged:unchanged});lock.releaseLock();}
    }
    if(error)throw error;receipt.passed.push(name);return result===undefined?true:result;
  };
  try {
    const originalId=oa2Spreadsheet_().getId();assert(!!originalId,'missing_original_binding');
    fixture=SpreadsheetApp.create('Alyssa workflow isolated QA 20261022 '+Utilities.formatDate(new Date(),'Asia/Hong_Kong','yyyyMMdd-HHmmss'),20,40);
    fixture.setSpreadsheetTimeZone('Asia/Hong_Kong');assert(fixture.getId()!==originalId,'fixture_is_original');receipt.fixtureUrl=fixture.getUrl();
    const blank=fixture.getSheets()[0];blank.setName(OMNI_ACCOUNT_TABS[0]);
    const names=OMNI_ACCOUNT_TABS.concat([OA2.ARRIVAL,OA2.LEDGER,OA2.HISTORY,OA2_CS.HISTORY,OA2_CS.ALIASES,'QA Accepted Report']);
    names.slice(1).forEach(name=>fixture.insertSheet(name,{template:blank}));
    const headers=OMNI_HEADERS.concat(OA2.ACCOUNT_HEADERS),field=label=>headers.indexOf(label)+1;
    OMNI_ACCOUNT_TABS.forEach(name=>fixture.getSheetByName(name).getRange(1,1,1,headers.length).setValues([headers]));
    fixture.getSheetByName(OA2.LEDGER).getRange(1,1,1,OA2.LEDGER_HEADERS.length).setValues([OA2.LEDGER_HEADERS]);
    fixture.getSheetByName(OA2.HISTORY).getRange(1,1,1,OA2.HISTORY_HEADERS.length).setValues([OA2.HISTORY_HEADERS]);
    const historyHeaders=['遷移ID','CS同事名','Account','品牌','電話','Email','IG/FB Username','Created At'];
    fixture.getSheetByName(OA2_CS.HISTORY).getRange(1,1,1,historyHeaders.length).setValues([historyHeaders]);
    fixture.getSheetByName(OA2_CS.ALIASES).getRange(1,1,1,6).setValues([['ArrivalRecordID','Metric1','Metric2','Frozen Migration CreatedAt','Metric3','Stable Source ID']]);
    const queue=fixture.getSheetByName(OA2.ARRIVAL),qh=['品牌','電話',OA2_QUEUE_BASE_HEADERS[0],'CS同事名'].concat(OA2_QUEUE_BASE_HEADERS.slice(1),OA2.QUEUE_HEADERS,['sortKey','來源','試做價','開單金額','總金額']);
    queue.getRange(OA2.HEADER_ROW,1,1,qh.length).setValues([qh]);
    const sh=fixture.getSheetByName('GOS Beauty'),today=oa2Date_(new Date()),past=oa2Date_(new Date(Date.now()-2*86400000)),future=oa2Date_(new Date(Date.now()+2*86400000));
    const rows=Array.from({length:6},(_,i)=>{
      const values={'最後更新日期':oa2NativeDate_(today),'Created At':oa2NativeDate_(today),'跟進狀態':'已預約','CS同事名':'QA CS '+i,'品牌':'QA Brand '+i,'客人姓名':'Synthetic workflow '+i,'電話':i<2?'10000001':'1000000'+(i+1),'療程 / 優惠':'QA Offer','療程項目':'QA Treatment','分店':'QA Branch','CS Remark':'Keep source note '+i+'\n第二行','Remark(後續跟進情況)':'Keep follow-up '+i,'Status':'Keep legacy status '+i,'Show up':'Keep legacy brand '+i,'Account':'GOS Beauty','Day 1':'Keep Day1 '+i,'Day 2':'Keep Day2 '+i,'預約日期':i===0?'':oa2NativeDate_(i===4?future:past),'預約時間':i===1?'':14/24};
      return headers.map(label=>values[label]===undefined?'':values[label]);
    });
    sh.getRange(2,field('電話'),6,1).setNumberFormat('@');
    ['最後更新日期','Created At','預約日期'].forEach(label=>sh.getRange(2,field(label),6,1).setNumberFormat('yyyy-mm-dd'));
    sh.getRange(2,field('預約時間'),6,1).setNumberFormat('hh:mm');sh.getRange(2,1,6,headers.length).setValues(rows);
    const report=fixture.getSheetByName('QA Accepted Report');
    report.getRange(1,1,1,4).setValues([['Accepted Show appointments','Accepted No Show appointments','Trial plus Order','Arrival rows']]);
    report.getRange(2,1,1,4).setFormulas([["=COUNTIF('_appointment_registry'!P2:P20,\"Show\")","=COUNTIF('_appointment_registry'!P2:P20,\"No Show\")","=SUM('到店紀錄'!"+columnLetter_(qh.indexOf('試做價')+1)+"8:"+columnLetter_(qh.indexOf('開單金額')+1)+"20)","=COUNTA('到店紀錄'!"+columnLetter_(qh.indexOf('Appointment ID')+1)+"8:"+columnLetter_(qh.indexOf('Appointment ID')+1)+"20)"]]);
    SpreadsheetApp.flush();
    const meta=oa2Meta_(sh,false),ids=()=>sh.getRange(2,meta,6,2).getValues().map(v=>({leadId:oa2Text_(v[0]),id:oa2Text_(v[1])}));
    const retainedColumns=['CS同事名','品牌','CS Remark','Remark(後續跟進情況)','Status','Show up','Day 1','Day 2','電話','客人姓名','療程 / 優惠','療程項目','分店','Created At'];
    const business=()=>JSON.stringify(sh.getRange(2,1,6,OMNI_HEADERS.length).getValues().map(r=>retainedColumns.map(h=>r[field(h)-1]))),sourceBefore=business();
    let appointments,bookedAt,arrivalBusiness;
    const queueRows=()=>oa2ReadQueue_(fixture,false).filter(q=>q.appointmentId),own=id=>{const q=queueRows().filter(q=>q.appointmentId===id);assert(q.length===1,'appointment_queue_not_unique');return q[0];};
    const registry=()=>oa2ReadRegistry_(fixture).appointments;
    // Reuse the registry adapter's Date/ISO epoch semantics. Sheets stores
    // dates as doubles, so permit at most 1 ms of round-trip conversion loss;
    // never round to seconds or replace the stored timestamp/date meanings.
    const timestamp=value=>{
      assert(value instanceof Date||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value),'timestamp_blank_or_not_native_date_iso');
      const millis=value instanceof Date?value.getTime():new Date(value).getTime();assert(isFinite(millis),'timestamp_invalid');return millis;
    };
    const sameTimestamp=(expected,actual,code)=>assert(Math.abs(timestamp(expected)-timestamp(actual))<=1,code);
    const timestampReadback=outcomeIndices=>{
      const reg=registry(),source=sh.getRange(2,meta,6,5).getValues(),rows=queueRows();
      source.forEach((values,i)=>{
        const a=reg[oa2Text_(values[1])];assert(!!a,'timestamp_owner_missing');
        const q=rows.find(row=>row.appointmentId===a.id);assert(!!q,'timestamp_owner_missing');
        sameTimestamp(a.bookedAt,values[2],'source_registry_booking_timestamp_mismatch');
        sameTimestamp(a.bookedAt,q.raw[24],'queue_registry_booking_timestamp_mismatch');
        assert(oa2Date_(a.bookedAt)===today,'booking_timestamp_confused_with_appointment_date');
        if((outcomeIndices||[]).includes(i)){
          assert(!!a.outcome&&oa2Outcome_(values[3])===a.outcome,'timestamp_outcome_not_accepted');
          sameTimestamp(a.outcomeAt,values[4],'source_registry_outcome_timestamp_mismatch');
          sameTimestamp(a.outcomeAt,q.raw[22],'queue_registry_outcome_timestamp_mismatch');
        }
      });
      return {bookings:6,outcomes:(outcomeIndices||[]).length,allSourceQueueRegistryEqual:true,maxRoundTripToleranceMs:1};
    };
    const fullQueue=id=>queue.getRange(own(id).row,1,1,qh.length).getValues()[0];
    const checkCell=(id,expected)=>{SpreadsheetApp.flush();const q=own(id),cell=queue.getRange(q.row,qh.indexOf('檢查提示')+1);assert(cell.getFormula().startsWith('=IF('),'visible_check_not_formula');assert(cell.getDisplayValue()===expected,'visible_check_evaluation_mismatch');};
    const historyFor=id=>{const h=fixture.getSheetByName(OA2.HISTORY),n=h.getLastRow()-1;return n?h.getRange(2,1,n,OA2.HISTORY_HEADERS.length).getValues().filter(r=>r[2]===id):[];};
    const accountEdit=(lock,row,column,value)=>{if(value!==undefined)sh.getRange(row,column).setValue(value);const range=sh.getRange(row,column);return omniArrivalV2AccountEdit_({source:fixture,range},row,row,column,column,sh,undefined,lock);};
    const queueEdit=(lock,id,value)=>{const q=own(id),range=queue.getRange(q.row,qh.indexOf('結果')+1);range.setValue(value);return omniArrivalV2QueueEdit_({source:fixture,range},{sheet:queue,name:OA2.ARRIVAL,lockHeld:true,documentLock:lock});};
    const stable=()=>{assert(business()===sourceBefore,'source_cs_notes_brand_history_changed');if(arrivalBusiness){const actual={};queueRows().forEach(q=>{if(arrivalBusiness[q.appointmentId])actual[q.appointmentId]=['CS同事名','品牌','備註','來源','試做價','開單金額','總金額'].map(h=>fullQueue(q.appointmentId)[qh.indexOf(h)]);});assert(canonical(actual)===canonical(arrivalBusiness),'arrival_cs_notes_brand_amount_changed');}};
    if(!phase('normal_account_booking_identity_and_registration',lock=>{
      const column=field('跟進狀態'),range=sh.getRange(2,column,6,1);
      omniArrivalV2AccountEdit_({source:fixture,range},2,7,column,column,sh,undefined,lock);SpreadsheetApp.flush();
      appointments=ids();assert(appointments.every(a=>a.leadId&&a.id),'booking_missing_identity');
      assert(new Set(appointments.map(a=>a.leadId)).size===6&&new Set(appointments.map(a=>a.id)).size===6&&queueRows().length===6,'repeat_customer_appointments_merged');
      const reg=registry();bookedAt=appointments.map(a=>reg[a.id].bookedAt);
      assert(bookedAt.every(v=>!!v)&&oa2Date_(bookedAt[0])===today,'actual_booking_timestamp_missing');
      assert(reg[appointments[0].id].state==='unscheduled'&&!reg[appointments[0].id].date&&reg[appointments[0].id].time==='14:00','initial_missing_date_not_retained');
      assert(reg[appointments[1].id].date===past&&!reg[appointments[1].id].time,'initial_missing_time_not_retained');
      queueRows().forEach((q,i)=>{queue.getRange(q.row,qh.indexOf('備註')+1).setValue('Keep arrival note '+i+'\n第二行');queue.getRange(q.row,qh.indexOf('來源')+1).setValue('QA synthetic source');queue.getRange(q.row,qh.indexOf('試做價')+1).setValue(100+i);queue.getRange(q.row,qh.indexOf('開單金額')+1).setValue(200+i);queue.getRange(q.row,qh.indexOf('總金額')+1).setValue(300+2*i);});
      arrivalBusiness={};queueRows().forEach(q=>arrivalBusiness[q.appointmentId]=['CS同事名','品牌','備註','來源','試做價','開單金額','總金額'].map(h=>fullQueue(q.appointmentId)[qh.indexOf(h)]));
      stable();checkCell(appointments[0].id,'待補預約日期');receipt.registration={appointments:6,queueRows:6,samePhoneDistinctAppointments:2,observedBookingTimestamps:6,timestamps:timestampReadback()};
    }))return finish();
    if(!phase('date_and_time_catchup_same_appointment_missing_only',lock=>{
      accountEdit(lock,2,field('預約日期'),oa2NativeDate_(past));accountEdit(lock,3,field('預約時間'),15/24);SpreadsheetApp.flush();
      const reg=registry();assert(ids().every((a,i)=>a.id===appointments[i].id&&a.leadId===appointments[i].leadId),'catchup_changed_stable_ids');
      [0,1].forEach(i=>{const a=reg[appointments[i].id],q=own(a.id);assert(a.date===past&&a.time===(i?'15:00':'14:00')&&oa2Date_(q.date)===a.date&&oa2Time_(q.time)===a.time,'catchup_registry_queue_schedule_mismatch');assert(a.bookedAt===bookedAt[i],'catchup_rebooked_registration_time');});
      // Reproduce two existing projections with missing cells, using fixture-only
      // writes. The actual missing-only planner/commit must fill only those
      // gaps without changing accepted appointment ownership or staff fields.
      queue.getRange(own(appointments[0].id).row,qh.indexOf('預約日期')+1).clearContent();
      queue.getRange(own(appointments[1].id).row,qh.indexOf('時間')+1).clearContent();
      const repairSnapshots=OMNI_ACCOUNT_TABS.map(name=>oa3ManualAccountSnapshot_(fixture.getSheetByName(name),name,new Map())),repairQueue=queueRows(),repairSelection=oa3MissingBookedSelection_(repairSnapshots,repairQueue),repairContext=oa2Context_(fixture,false);
      repairSnapshots.forEach(snap=>oa2ReplaySourceAnchors_(repairContext,snap));
      assert(repairSelection.items.length===2&&repairSelection.items.every(item=>item.kind==='schedule_gap'),'manual_missing_gap_discovery');
      const repairs=repairSelection.items.map(item=>Object.assign({},item,{decision:{action:'existing',leadId:item.record.leadId}}));
      const repaired=oa3CommitIdentityBookings_(fixture,repairs,repairSnapshots,repairQueue,repairContext,{staffEdit:true});
      assert(repaired.added===0&&repaired.review===0&&repaired.acceptedRows.length===2,'manual_gap_commit_counts');
      assert(oa2Date_(own(appointments[0].id).date)===past&&oa2Time_(own(appointments[1].id).time)==='15:00','manual_gap_cells_not_filled');
      const snapshots=OMNI_ACCOUNT_TABS.map(name=>oa3ManualAccountSnapshot_(fixture.getSheetByName(name),name,new Map())),selection=oa3MissingBookedSelection_(snapshots,queueRows());
      assert(selection.items.length===0&&selection.skipped===6,'manual_missing_complete_not_skipped');
      assert(queueRows().length===6,'catchup_duplicated_queue');stable();receipt.catchup={sameAppointmentIds:2,dateFilled:1,timeFilled:1,manualMissingCandidates:0,completeSkipped:6,manualScheduleGapsRepaired:2,manualAdded:0,timestamps:timestampReadback()};
    }))return finish();
    let completedRegistry,completedQueue;
    if(!phase('accepted_show_no_show_and_visible_rejection_then_retry',lock=>{
      queueEdit(lock,appointments[2].id,'已到店');queueEdit(lock,appointments[3].id,'No Show');SpreadsheetApp.flush();
      let reg=registry();assert(reg[appointments[2].id].outcome==='Show'&&reg[appointments[2].id].arrivalDate===past&&reg[appointments[2].id].state==='completed','show_registry_not_accepted');
      assert(reg[appointments[3].id].outcome==='No Show'&&!reg[appointments[3].id].arrivalDate&&reg[appointments[3].id].state==='completed','no_show_registry_not_accepted');
      assert(oa2Outcome_(sh.getRange(4,meta+3).getValue())==='Show'&&sh.getRange(5,meta+3).getValue()==='No Show','accepted_account_metadata_mismatch');
      assert(oa2Date_(own(appointments[2].id).arrivalDate)===past,'show_actual_arrival_date_not_filled');
      checkCell(appointments[2].id,'已接納：已到店');checkCell(appointments[3].id,'已接納：No Show');
      const before=JSON.stringify(reg[appointments[4].id]);let rejected=false;
      try{queueEdit(lock,appointments[4].id,'已到店');}catch(error){rejected=String(error.message).includes('future appointment');}
      assert(rejected&&JSON.stringify(registry()[appointments[4].id])===before,'future_show_not_safely_rejected');
      checkCell(appointments[4].id,'未接納：未來預約不能標記已到店');
      queueEdit(lock,appointments[4].id,'待到店');checkCell(appointments[4].id,'未到期');
      const beforeHistory=fixture.getSheetByName(OA2.HISTORY).getLastRow(),beforeRevision=registry()[appointments[2].id].revision;
      queueEdit(lock,appointments[2].id,'已到店');assert(fixture.getSheetByName(OA2.HISTORY).getLastRow()===beforeHistory&&registry()[appointments[2].id].revision===beforeRevision,'repeat_outcome_created_history');
      SpreadsheetApp.flush();const counts=report.getRange(2,1,1,4).getValues()[0];assert(counts[0]===1&&counts[1]===1&&counts[2]===1830&&counts[3]===6,'native_report_accepted_counts_or_amount_mismatch');
      assert(oa2MetricPeople_(registry(),'show',past,today)===1&&oa2MetricPeople_(registry(),'no_show',past,today)===1,'accepted_person_oracle_mismatch');
      completedRegistry=JSON.stringify(registry()[appointments[2].id]);completedQueue=JSON.stringify(fullQueue(appointments[2].id));stable();
      receipt.outcomes={show:1,noShow:1,reportShow:counts[0],reportNoShow:counts[1],amount:counts[2],futureRejected:true,visibleReasonVerified:true,repeatOutcomeNoOp:true,timestamps:timestampReadback([2,3])};
    }))return finish();
    if(!phase('cancellation_and_reschedule_preserve_business_history',lock=>{
      queueEdit(lock,appointments[4].id,'取消');queueEdit(lock,appointments[5].id,'改期');
      let reg=registry();assert(reg[appointments[4].id].state==='canceled'&&!reg[appointments[4].id].outcome,'cancellation_registry_mismatch');
      assert(reg[appointments[5].id].state==='reschedule_requested','reschedule_not_requested');checkCell(appointments[4].id,'已接納：取消');checkCell(appointments[5].id,'已接納：改期；請更新 Account 日期時間');
      accountEdit(lock,7,field('預約日期'),oa2NativeDate_(future));accountEdit(lock,7,field('預約時間'),16/24);reg=registry();
      assert(ids()[5].id===appointments[5].id&&reg[appointments[5].id].state==='reschedule_requested'&&reg[appointments[5].id].date===future&&reg[appointments[5].id].time==='16:00','reschedule_same_id_or_schedule_mismatch');
      // Current native behavior requires this second visible acknowledgement;
      // date/time edits alone retain the original requested-reschedule input.
      queueEdit(lock,appointments[5].id,'待到店');reg=registry();
      assert(reg[appointments[5].id].state==='active'&&reg[appointments[5].id].date===future&&reg[appointments[5].id].time==='16:00','visible_reschedule_confirmation_not_active');checkCell(appointments[5].id,'未到期');
      assert(reg[appointments[5].id].bookedAt===bookedAt[5],'reschedule_changed_registration_time');
      assert(historyFor(appointments[4].id).some(r=>r[4]==='canceled')&&historyFor(appointments[5].id).some(r=>r[4]==='reschedule_requested')&&historyFor(appointments[5].id).some(r=>r[4]==='source_schedule_caught_up'||r[4]==='rescheduled'),'cancel_reschedule_history_missing');
      assert(JSON.stringify(reg[appointments[2].id])===completedRegistry&&JSON.stringify(fullQueue(appointments[2].id))===completedQueue,'completed_history_changed_during_other_edits');
      stable();receipt.transitions={canceled:1,rescheduled:1,rescheduleSameAppointment:true,rescheduleRequiresVisibleConfirmation:true,completedHistoryUnchanged:true};
    }))return finish();
    if(!phase('completed_successor_interrupted_commit_retry_and_no_duplicate',lock=>{
      // Fail after the real journal/registry/source-pointer writes but before
      // queue cells. This helper binding is lexical in the candidate bundle.
      const writeQueue=oa2WriteQueue_;let injected=0,caught=false;
      oa2WriteQueue_=(ss,ctx,queueRows,ops,records)=>{assert(ss.getId()===fixture.getId(),'injected_write_not_fixture');if(ops.some(op=>op.kind==='append')){injected++;throw new Error('Synthetic fixture queue interruption');}return writeQueue(ss,ctx,queueRows,ops,records);};
      try{accountEdit(lock,4,field('預約日期'),oa2NativeDate_(future));}catch(error){caught=String(error.message).includes('Synthetic fixture queue interruption');}
      finally{oa2WriteQueue_=writeQueue;}
      assert(caught&&injected===1,'fixture_commit_failure_not_injected');
      const successor=ids()[2].id,interrupted=registry();assert(successor&&successor!==appointments[2].id&&interrupted[successor]&&interrupted[successor].previousId===appointments[2].id,'interrupted_successor_not_durable');
      assert(queueRows().length===6&&!queueRows().some(q=>q.appointmentId===successor),'interrupted_queue_unexpected_append');
      accountEdit(lock,4,field('預約日期'));SpreadsheetApp.flush();
      const reg=registry();assert(ids()[2].id===successor&&queueRows().length===7&&Object.keys(reg).length===7,'retry_duplicated_successor');
      assert(reg[successor].previousId===appointments[2].id&&reg[successor].date===future&&reg[successor].state==='active'&&!reg[successor].outcome&&!!reg[successor].bookedAt,'retry_successor_state_mismatch');
      assert(JSON.stringify(reg[appointments[2].id])===completedRegistry&&JSON.stringify(fullQueue(appointments[2].id))===completedQueue,'completed_history_changed_during_successor_retry');
      const beforeHistory=fixture.getSheetByName(OA2.HISTORY).getLastRow(),beforeQueue=JSON.stringify(queueRows().map(q=>fullQueue(q.appointmentId))),selection=oa3MissingBookedSelection_(OMNI_ACCOUNT_TABS.map(name=>oa3ManualAccountSnapshot_(fixture.getSheetByName(name),name,new Map())),queueRows());
      assert(selection.items.length===0&&selection.skipped===6,'retry_manual_missing_not_noop');
      accountEdit(lock,4,field('預約日期'));assert(ids()[2].id===successor&&queueRows().length===7&&fixture.getSheetByName(OA2.HISTORY).getLastRow()===beforeHistory&&JSON.stringify(queueRows().map(q=>fullQueue(q.appointmentId)))===beforeQueue,'retry_repeat_not_idempotent');
      checkCell(successor,'未到期');stable();SpreadsheetApp.flush();const counts=report.getRange(2,1,1,4).getValues()[0];assert(counts[0]===1&&counts[1]===1&&counts[2]===1830&&counts[3]===7,'final_report_mismatch');
      const history=historyFor(successor),idsSeen=history.map(r=>r[0]);assert(new Set(idsSeen).size===idsSeen.length,'retry_duplicated_history_event_ids');
      receipt.retry={injectedFailures:injected,successorAppointments:1,queueRows:7,registryAppointments:7,repeatNoOp:true,completedHistoryUnchanged:true,amount:counts[2],timestamps:timestampReadback([3])};
    }))return finish();
    receipt.ok=true;receipt.allFixturePhasesVerified=true;return finish();
  }catch(error){receipt.errorCode=typeof error.qaCode==='string'?error.qaCode:'isolated_fixture_execution_failed';return finish();}
}
