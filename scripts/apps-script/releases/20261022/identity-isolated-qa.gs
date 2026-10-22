/**
 * Real Google Sheets isolation check for the 20261022 native identity release.
 *
 * Run explicitly from the existing authorized bound project. Every cell write is
 * made to a newly created, synthetic, private spreadsheet. No trigger is created,
 * no native installer/public timer is called, and no Drive service is used.
 *
 * Fixture creation happens before DocumentLock admission. If staff priority or a
 * busy lock is observed, the fixture URL is returned with skipped=true. During
 * each small fixture phase the ACTUAL existing DocumentLock is held. Only the
 * history cursor and active/retired spreadsheet helper boundaries are replaced
 * in this execution's memory; originals are restored before releasing the lock.
 * PropertiesService itself is never replaced, and no properties are written or
 * restored. Full original property snapshots are compared internally only; their
 * keys/values, especially secrets, are never logged or returned.
 */
function verifyIdentityPriorityIsolated20261022() {
  const started=Date.now(),receipt={handler:'identity_isolated_qa_20261022',ok:false,skipped:false,passed:[],phases:[]};
  let fixture,historyCursor=2;
  const assert=(ok,code)=>{if(!ok){const error=new Error(code);error.qaCode=code;throw error;}};
  const canonical=properties=>JSON.stringify(Object.keys(properties).sort().map(key=>[key,properties[key]]));
  const finish=()=>{receipt.elapsedMs=Date.now()-started;console.log(JSON.stringify(receipt));return receipt;};
  const phase=(name,action)=>{
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
      result=action(lock);
    } catch(caught) {error=caught;}
    finally {
      try {
        if(originals){
          oa2Spreadsheet_=originals.spreadsheet;
          oa2HistoryStart_=originals.historyStart;
          oa2AdvanceHistoryCursor_=originals.advanceHistory;
          oa4RetiredAppointmentIds_=originals.retired;
        }
        if(beforeScript!==undefined&&beforeDocument!==undefined){
          unchanged=beforeScript===canonical(scriptProperties.getProperties())&&beforeDocument===canonical(documentProperties.getProperties());
          // A concurrent staff-priority stamp is also treated conservatively as
          // unverified. Never overwrite it or any other property to "restore".
          if(!unchanged&&!error){error=new Error('project_properties_changed_during_fixture');error.qaCode='project_properties_changed_during_fixture';}
        }
      }catch(cleanupError){if(!error){error=new Error('fixture_cleanup_or_property_verification_failed');error.qaCode='fixture_cleanup_or_property_verification_failed';}}
      finally {
        receipt.phases.push({name,elapsedMs:Date.now()-phaseStarted,projectPropertiesUnchanged:unchanged});
        lock.releaseLock();
      }
    }
    if(error)throw error;
    receipt.passed.push(name);return result===undefined?true:result;
  };
  try {
    const bound=oa2Spreadsheet_(),originalId=bound&&bound.getId();
    assert(!!originalId,'missing_original_binding');
    const title='Alyssa identity isolated QA 20261022 '+Utilities.formatDate(new Date(),'Asia/Hong_Kong','yyyyMMdd-HHmmss');
    fixture=SpreadsheetApp.create(title,20,40);fixture.setSpreadsheetTimeZone('Asia/Hong_Kong');
    assert(fixture.getId()!==originalId,'fixture_is_original');
    receipt.fixtureUrl=fixture.getUrl();
    const blank=fixture.getSheets()[0];blank.setName(OMNI_ACCOUNT_TABS[0]);
    const names=OMNI_ACCOUNT_TABS.concat([OA2.ARRIVAL,OA2.LEDGER,OA2.HISTORY]);
    names.slice(1).forEach(name=>fixture.insertSheet(name,{template:blank}));
    const headers=OMNI_HEADERS.concat(OA2.ACCOUNT_HEADERS),field=label=>headers.indexOf(label)+1;
    OMNI_ACCOUNT_TABS.forEach(name=>fixture.getSheetByName(name).getRange(1,1,1,headers.length).setValues([headers]));
    fixture.getSheetByName('Alyssa Main').getRange(1,field('療程 / 優惠')).setValue(' '.repeat(140));
    const future=Utilities.formatDate(new Date(Date.now()+2*86400000),'Asia/Hong_Kong','yyyy-MM-dd');
    const source=(account,phone,status)=>{
      const values={ '最後更新日期':oa2NativeDate_(Utilities.formatDate(new Date(),'Asia/Hong_Kong','yyyy-MM-dd')),
        'Created At':oa2NativeDate_(Utilities.formatDate(new Date(),'Asia/Hong_Kong','yyyy-MM-dd')),
        '跟進狀態':status,'CS同事名':'QA CS one','品牌':'QA synthetic brand','客人姓名':'Synthetic identity fixture',
        '電話':phone,'療程 / 優惠':'QA synthetic offer','療程項目':'QA synthetic treatment','分店':'QA synthetic branch',
        'CS Remark':'Keep QA note\n第二行','Remark(後續跟進情況)':'Keep QA follow-up','Status':'Keep legacy note',
        'Show up':'Keep legacy brand','Account':account,'Day 1':'Keep Day 1','Day 2':'Keep Day 2' };
      if(status==='已預約'){values['預約日期']=oa2NativeDate_(future);values['預約時間']=14/24;}
      const row=headers.map(label=>values[label]===undefined?'':values[label]),sh=fixture.getSheetByName(account);
      sh.getRange(2,field('電話')).setNumberFormat('@');
      ['最後更新日期','Created At','預約日期'].forEach(label=>sh.getRange(2,field(label)).setNumberFormat('yyyy-mm-dd'));
      sh.getRange(2,field('預約時間')).setNumberFormat('hh:mm');sh.getRange(2,1,1,row.length).setValues([row]);
      return sh;
    };
    const booked=source('GOS Beauty','10000001','已預約'),enquiry=source('Ineffable','10000002','待跟進');
    const secondBooking=booked.getRange(2,1,1,headers.length).getValues()[0];
    secondBooking[field('客人姓名')-1]='Synthetic distinct appointment';
    secondBooking[field('預約日期')-1]=oa2NativeDate_(Utilities.formatDate(new Date(Date.now()+3*86400000),'Asia/Hong_Kong','yyyy-MM-dd'));
    booked.getRange(3,1,1,headers.length).setValues([secondBooking]);
    booked.getRange(3,field('電話')).setNumberFormat('@');booked.getRange(3,field('預約日期')).setNumberFormat('yyyy-mm-dd');booked.getRange(3,field('預約時間')).setNumberFormat('hh:mm');
    const queue=fixture.getSheetByName(OA2.ARRIVAL),queueHeaders=['品牌','電話',OA2_QUEUE_BASE_HEADERS[0],'CS同事名'].concat(OA2_QUEUE_BASE_HEADERS.slice(1),OA2.QUEUE_HEADERS,['sortKey','來源','試做價','開單金額','總金額']);
    queue.getRange(OA2.HEADER_ROW,1,1,queueHeaders.length).setValues([queueHeaders]);
    fixture.getSheetByName(OA2.LEDGER).getRange(1,1,1,OA2.LEDGER_HEADERS.length).setValues([OA2.LEDGER_HEADERS]);
    fixture.getSheetByName(OA2.HISTORY).getRange(1,1,1,OA2.HISTORY_HEADERS.length).setValues([OA2.HISTORY_HEADERS]);
    SpreadsheetApp.flush();
    const sourceBusiness=sh=>JSON.stringify(sh.getRange(2,1,sh.getLastRow()-1,OMNI_HEADERS.length).getValues());
    const beforeBooked=sourceBusiness(booked),beforeEnquiry=sourceBusiness(enquiry);
    const meta=oa2Meta_(booked,false),readIds=()=>({leadId:oa2Text_(booked.getRange(2,meta).getValue()),appointmentId:oa2Text_(booked.getRange(2,meta+1).getValue())});
    let leadId,appointmentId;
    if(!phase('bad_header_isolation_and_real_booking_commit',lock=>{
      const result=oa2PrioritizeSourceIdentities_(fixture,lock,{accountNames:['GOS Beauty']});SpreadsheetApp.flush();
      assert(result.registered===2&&result.bookedAdded===2,'first_pass_counts');
      assert(result.accountFailures.some(item=>item.accountIndex===OMNI_ACCOUNT_TABS.indexOf('Alyssa Main')),'bad_header_not_isolated');
      const ids=readIds();leadId=ids.leadId;appointmentId=ids.appointmentId;
      assert(!!leadId&&!!appointmentId,'source_identity_not_persisted');
      const registry=oa2ReadRegistry_(fixture).appointments[appointmentId],rows=oa2ReadQueue_(fixture,false);
      assert(registry&&registry.leadId===leadId&&registry.account==='GOS Beauty','registry_identity_readback');
      assert(registry.state==='active'&&!registry.outcome&&registry.date===future&&registry.time==='14:00','registry_schedule_readback');
      const ownQueue=rows.find(row=>row.appointmentId===appointmentId);
      assert(rows.length===2&&ownQueue&&ownQueue.raw[23]===leadId,'queue_identity_readback');
      const secondIds=booked.getRange(3,meta,1,2).getValues()[0];
      assert(!!secondIds[0]&&!!secondIds[1]&&secondIds[0]!==leadId&&secondIds[1]!==appointmentId,'distinct_appointments_merged');
      assert(sourceBusiness(booked)===beforeBooked&&sourceBusiness(enquiry)===beforeEnquiry,'source_business_changed');
      const row=ownQueue.row;
      queue.getRange(row,queueHeaders.indexOf('備註')+1).setValue('Keep arrival QA note\n第二行');
      queue.getRange(row,queueHeaders.indexOf('試做價')+1).setValue(123);
      queue.getRange(row,queueHeaders.indexOf('開單金額')+1).setValue(456);
      queue.getRange(row,queueHeaders.indexOf('總金額')+1).setValue(579);
      receipt.firstPass={registered:result.registered,bookedAdded:result.bookedAdded,queueRows:rows.length};
    }))return finish();
    if(!phase('enquiry_identity_without_appointment',lock=>{
      const result=oa2PrioritizeSourceIdentities_(fixture,lock,{accountNames:['Ineffable']});SpreadsheetApp.flush();
      const enquiryId=oa2Text_(enquiry.getRange(2,oa2Meta_(enquiry,false)).getValue());
      assert(result.registered===1&&result.bookedAdded===0,'enquiry_counts');
      assert(!!enquiryId&&enquiryId!==leadId&&!oa2Text_(enquiry.getRange(2,oa2Meta_(enquiry,false)+1).getValue()),'enquiry_identity_readback');
      assert(sourceBusiness(enquiry)===beforeEnquiry,'enquiry_business_changed');
      receipt.enquiry={registered:result.registered,bookedAdded:result.bookedAdded};
    }))return finish();
    const retainedQueue=JSON.stringify(queue.getRange(OA2.FIRST_ROW,1,2,queueHeaders.length).getValues());
    booked.getRange(2,meta).clearContent();SpreadsheetApp.flush();
    if(!phase('exact_pointer_recovery_and_business_preservation',lock=>{
      const result=oa2PrioritizeSourceIdentities_(fixture,lock,{accountNames:['GOS Beauty']});SpreadsheetApp.flush();
      const ids=readIds();assert(ids.leadId===leadId&&ids.appointmentId===appointmentId,'exact_pointer_not_restored');
      assert(result.recovered===1&&result.registered===0&&result.bookedAdded===0,'recovery_counts');
      assert(oa2ReadQueue_(fixture,false).length===2,'recovery_duplicated_queue');
      assert(JSON.stringify(queue.getRange(OA2.FIRST_ROW,1,2,queueHeaders.length).getValues())===retainedQueue,'arrival_business_changed');
      assert(sourceBusiness(booked)===beforeBooked&&sourceBusiness(enquiry)===beforeEnquiry,'source_business_changed');
      receipt.recovery={recovered:result.recovered,bookedAdded:result.bookedAdded};
    }))return finish();
    const beforeHistory=fixture.getSheetByName(OA2.HISTORY).getLastRow(),beforeRegistry=fixture.getSheetByName(OA2.LEDGER).getLastRow();
    if(!phase('repeat_is_missing_only',lock=>{
      const result=oa2PrioritizeSourceIdentities_(fixture,lock);SpreadsheetApp.flush();
      assert(result.registered===0&&result.recovered===0&&result.bookedAdded===0,'repeat_not_missing_only');
      assert(fixture.getSheetByName(OA2.HISTORY).getLastRow()===beforeHistory&&fixture.getSheetByName(OA2.LEDGER).getLastRow()===beforeRegistry,'repeat_rewrote_history');
      assert(oa2ReadQueue_(fixture,false).length===2,'repeat_duplicated_queue');
      assert(JSON.stringify(queue.getRange(OA2.FIRST_ROW,1,2,queueHeaders.length).getValues())===retainedQueue,'repeat_changed_arrival_business');
    }))return finish();
    if(!phase('conflicting_anchor_is_rejected_without_allocation',()=>{
      const record=oa3ManualAccountSnapshot_(booked,'GOS Beauty',new Map()).records[0],a=oa2ReadRegistry_(fixture).appointments[appointmentId];
      const other=Object.assign({},a,{leadId:'lead_fixture_conflict'}),anchor={leadId:other.leadId,account:other.account,currentAppointmentId:other.id,appointments:[other],events:[]};
      let allocations=0;const candidate=Object.assign({},record,{leadId:'',pendingSnapshot:JSON.stringify(anchor)});
      const result=oa2ResolveMissingLeadIdentity_(candidate,{appointments:{[appointmentId]:a},owners:{},knownLeadIds:new Set()},()=>{allocations++;return 'lead_unexpected_fixture';});
      assert(result.action==='review'&&allocations===0,'conflicting_anchor_allocated_identity');
    }))return finish();
    const rejectedRow=booked.getRange(2,1,1,headers.length).getValues()[0];
    for(let column=meta-1;column<rejectedRow.length;column++)rejectedRow[column]='';
    rejectedRow[field('電話')-1]='10000003';rejectedRow[field('客人姓名')-1]='Synthetic unknown appointment';
    rejectedRow[meta]='appt_unregistered_synthetic_fixture';
    booked.getRange(4,field('電話')).setNumberFormat('@');booked.getRange(4,1,1,headers.length).setValues([rejectedRow]);
    const manualNote='Keep manual status note\n第二行',statusCell=booked.getRange(4,field('跟進狀態'));
    statusCell.setNote(manualNote);SpreadsheetApp.flush();
    const rejectedBusiness=JSON.stringify(booked.getRange(4,1,1,OMNI_HEADERS.length).getValues()[0]);
    const rejectionRegistryRows=fixture.getSheetByName(OA2.LEDGER).getLastRow(),rejectionHistoryRows=fixture.getSheetByName(OA2.HISTORY).getLastRow();
    if(!phase('normal_cs_rejection_note_preserves_manual_note_and_values',lock=>{
      const resolver=oa2ResolveMissingLeadIdentity_;let allocationAttempts=0,rejection;
      // Count the actual allocator callback without replacing Utilities or
      // weakening the real identity decision. This binding is local in staging.
      oa2ResolveMissingLeadIdentity_=(record,evidence,allocate)=>resolver(record,evidence,()=>{allocationAttempts++;return allocate();});
      try{oa2EnsureEditedLeadIds_(booked,getOmniColumns_(booked),4,4,lock);}
      catch(error){rejection=error;}
      finally{oa2ResolveMissingLeadIdentity_=resolver;}
      SpreadsheetApp.flush();
      const phrase='預約 ID 搵唔到對應紀錄',note=statusCell.getNote();
      assert(!!rejection&&String(rejection.message||'').includes(phrase),'normal_cs_unknown_pointer_not_rejected');
      assert(allocationAttempts===0,'normal_cs_rejection_allocated_uuid');
      assert(!oa2Text_(booked.getRange(4,meta).getValue())&&booked.getRange(4,meta+1).getValue()==='appt_unregistered_synthetic_fixture','normal_cs_rejection_changed_identity');
      assert(note.slice(0,manualNote.length)===manualNote&&note.includes('\n【系統檢查・身份】未接納：'+phrase+'。'),'normal_cs_note_did_not_preserve_manual_bytes');
      assert(!note.includes('10000003')&&!note.includes('appt_unregistered_synthetic_fixture'),'normal_cs_note_leaked_source_values');
      assert(JSON.stringify(booked.getRange(4,1,1,OMNI_HEADERS.length).getValues()[0])===rejectedBusiness,'normal_cs_rejection_changed_business_values');
      assert(fixture.getSheetByName(OA2.LEDGER).getLastRow()===rejectionRegistryRows&&fixture.getSheetByName(OA2.HISTORY).getLastRow()===rejectionHistoryRows,'normal_cs_rejection_grew_registry_or_history');
      assert(oa2ReadQueue_(fixture,false).length===2&&JSON.stringify(queue.getRange(OA2.FIRST_ROW,1,2,queueHeaders.length).getValues())===retainedQueue,'normal_cs_rejection_changed_arrival_values');
      receipt.normalCsRejection={rejected:true,allocationAttempts,manualNotePreserved:true,businessValuesUnchanged:true,queueRows:2};
    }))return finish();
    receipt.ok=true;receipt.allFixturePhasesVerified=true;return finish();
  } catch(error) {
    receipt.errorCode=typeof error.qaCode==='string'?error.qaCode:'isolated_fixture_execution_failed';
    return finish();
  }
}
