/** Native arrival maintenance. All business writes use the existing document lock. */
function oa3Sources_(ss) {
  const map=new Map();
  OMNI_ACCOUNT_TABS.forEach(name=>{
    const sh=ss.getSheetByName(name),c=getOmniColumns_(sh),meta=oa2Meta_(sh,false),n=Math.max(0,sh.getLastRow()-1);
    if(!n)return;
    sh.getRange(2,1,n,sh.getLastColumn()).getValues().forEach((row,i)=>{
      const id=oa2Text_(row[meta-1]);if(!id)return;
      const r={id,account:name,row:i+2,cs:oa2Text_(row[c.CS_OWNER-1]),brand:oa2Text_(row[c.BRAND-1]),phone:oa2Text_(row[c.PHONE-1]),email:oa2Text_(row[c.EMAIL-1]),social:oa2Text_(row[c.SOCIAL_USERNAME-1]),created:oa2Date_(row[c.CREATED_AT-1]),appointmentId:oa2Text_(row[meta])};
      const old=map.get(id)||[];old.push(r);map.set(id,old);
    });
  });
  const history=oa2CsReadColumns_(ss,OA2_CS.HISTORY,1,{id:'遷移ID',account:'Account',brand:'品牌',phone:'電話',email:'Email',social:'IG/FB Username',created:'Created At'},OA2_CS.HISTORY_LAST_ROW);
  history.rows.forEach(row=>{
    const rawId=oa2CsId_(row.id);if(!rawId)return;
    // History is display evidence only; it never becomes a new CS assignment.
    const r={id:'history:'+rawId,account:oa2Text_(row.account),brand:oa2Text_(row.brand),phone:oa2Text_(row.phone),email:oa2Text_(row.email),social:oa2Text_(row.social),created:oa2Date_(row.created),cs:'',appointmentId:''};
    const old=map.get(r.id)||[];old.push(r);map.set(r.id,old);
  });return map;
}
function oa3ResolveSource_(a,sources,aliases) {
  const alias=a.provenance==='legacy_show'?aliases.get(a.queueId):null,id=alias?alias.sourceId:a.leadId,list=sources.get(id)||[];
  if(list.length!==1)return null;
  const r=list[0],phone=last8_(r.phone),key=oa2CsCustomerKey_(r),ownedPhone=(oa2Text_(a.customerKey).match(/\|p:(\d{8})$/)||[])[1]||'';
  // A numeric registry cell may have dropped a leading zero; the stable key
  // retains it. Match that key, rather than weakening the phone comparison.
  if(ownedPhone&&phone!==ownedPhone)return null;
  if(!ownedPhone&&a.phone&&phone!==oa2Text_(a.phone))return null;
  if(alias&&(!alias.created||alias.created!==r.created||a.account!==r.account||a.customerKey!==key))return null;
  if(!alias&&a.leadId!==r.id)return null;
  return r;
}
function oa3DisplayValues_(a,source,currentBrand,currentPhone) {
  const keyPhone=(oa2Text_(a.customerKey).match(/\|p:(\d{8})$/)||[])[1]||'',registryPhone=oa2Text_(a.phone);
  const verifiedRegistryPhone=keyPhone&&a.customerKey===a.account+'|p:'+keyPhone&&(registryPhone===keyPhone||/^\d+$/.test(registryPhone)&&Number(registryPhone)===Number(keyPhone))?keyPhone:'';
  return {brand:source&&source.account===a.account&&source.brand||oa2Text_(a.brand)||oa2Text_(currentBrand),phone:source&&source.phone||verifiedRegistryPhone||oa2Text_(currentPhone)};
}
function oa3Aliases_(ss) {
  const sh=ss.getSheetByName('_arrival_metric_aliases'),map=new Map();if(!sh||sh.getLastRow()<2)return map;
  sh.getRange(2,1,sh.getLastRow()-1,6).getValues().forEach(r=>{
    const id=oa2Text_(r[0]);if(!id)return;
    if(map.has(id)){map.set(id,null);return;}
    map.set(id,{sourceId:oa2Text_(r[5]),created:oa2Date_(r[3])});
  });return map;
}
function oa3OwnerRepairDecision_(old,source,a) {
  if(!source||!source.cs||/^[#=]/.test(source.cs))return null;
  const placeholder=['','待核對','未填CS'].includes(oa2Text_(old));
  if(!placeholder&&source.appointmentId!==a.id)return null;
  return old===source.cs?null:source.cs;
}
function oa3RefreshDisplay_(ss,repairOwners,scope) {
  const sh=ss.getSheetByName(OA2.ARRIVAL),headers=oa2Header_(sh,OA2.HEADER_ROW),n=Math.max(0,sh.getLastRow()-OA2.FIRST_ROW+1);
  if(!n)return {namesRestored:0,identitiesRepaired:0};
  const raw=sh.getRange(OA2.FIRST_ROW,1,n,sh.getLastColumn()).getValues(),reg=scope?scope.appointments:oa2ReadRegistry_(ss).appointments,sources=scope?scope.sources:oa3Sources_(ss),aliases=scope?new Map():oa3Aliases_(ss);
  const column=h=>headers.indexOf(h),ic=column('Appointment ID'),lc=column('Omni Lead ID'),qc=column('到店紀錄ID（內部）'),cc=column('CS同事名'),label=column('客人／預約'),brand=column('品牌'),phone=column('電話');
  const counts={};raw.forEach(row=>{const id=oa2Text_(row[ic]);if(id)counts[id]=(counts[id]||0)+1;});
  const plans=[],result={namesRestored:0,identitiesRepaired:0,displayRows:0};
  raw.forEach((row,i)=>{
    const id=oa2Text_(row[ic]),a=reg[id];if(scope&&!scope.ids.has(id))return;if(!a||counts[id]!==1||a.queueId!==oa2Text_(row[qc])||a.leadId!==oa2Text_(row[lc]))return;
    const source=oa3ResolveSource_(a,sources,aliases),changes=[];
    if(cc>=0&&(repairOwners||oa2Text_(row[cc])==='')){const name=oa3OwnerRepairDecision_(row[cc],source,a);if(name!==null){changes.push({col:cc,value:name});result.namesRestored++;}}
    if(label>=0&&/識別待核對/.test(oa2Text_(row[label]))) {
      const text=oa2QueueLabel_(a,source?{account:a.account,leadId:a.leadId,fullPhone:source.phone,name:a.name}:null);
      if(text!==row[label]){changes.push({col:label,value:text});result.identitiesRepaired++;}
    }
    if(brand>=0&&phone>=0) {
      // Brand is actual source metadata; never substitute the Account label.
      const display=oa3DisplayValues_(a,source,row[brand],row[phone]),b=display.brand,p=display.phone;
      if(oa2Text_(row[brand])!==b)changes.push({col:brand,value:b});
      if(oa2Text_(row[phone])!==p)changes.push({col:phone,value:p});
      result.displayRows++;
    }
    if(changes.length)plans.push({row:OA2.FIRST_ROW+i,before:row,changes});
  });
  if(!plans.length){console.log(JSON.stringify(Object.assign({handler:'arrival_display_repair'},result)));return result;}
  const freshSources=scope?scope.freshSources():oa3Sources_(ss);plans.forEach(p=>{const a=reg[oa2Text_(p.before[ic])],old=oa3ResolveSource_(a,sources,aliases),fresh=oa3ResolveSource_(a,freshSources,aliases);if(JSON.stringify(old)!==JSON.stringify(fresh))throw new Error('Source ownership changed during maintenance; safe retry required.');});
  const ownerChanges=plans.flatMap(p=>p.changes.filter(c=>c.col===cc).map(c=>({appointmentId:oa2Text_(p.before[ic]),before:p.before[cc],after:c.value})));
  if(ownerChanges.length){const journal=ss.getSheetByName(OA2.HISTORY),now=new Date().toISOString(),events=ownerChanges.map(c=>['cs_'+oa2Hash_(c.appointmentId+'|'+now+'|'+c.after),now,c.appointmentId,oa2Text_(reg[c.appointmentId].leadId),'cs_owner_repair_intent',JSON.stringify({cs:c.before}),JSON.stringify({cs:c.after}),'explicit_source_verified_repair']);oa2EnsureRows_(journal,journal.getLastRow()+events.length);journal.getRange(journal.getLastRow()+1,1,events.length,OA2.HISTORY_HEADERS.length).setValues(events);}
  const columns=new Set(plans.flatMap(p=>p.changes.map(c=>c.col)));
  columns.forEach(col=>{
    const items=plans.flatMap(p=>{const change=p.changes.find(c=>c.col===col);return change?[{row:p.row,before:p.before,values:[change.value]}]:[];});
    oa2RowGroups_(items).forEach(group=>{
      const fresh=sh.getRange(group[0].row,1,group.length,headers.length).getValues();
      group.forEach((p,i)=>{if(JSON.stringify(fresh[i])!==JSON.stringify(p.before))throw new Error('Arrival row changed during maintenance; preserving colleague input.');});
      const range=sh.getRange(group[0].row,col+1,group.length,1);if(headers[col]==='電話')range.setNumberFormat('@');range.setValues(group.map(p=>p.values));
      group.forEach(p=>{p.before[col]=p.values[0];});
    });
  });
  console.log(JSON.stringify(Object.assign({handler:'arrival_display_repair'},result)));return result;
}
function oa3SnapshotValues_(headers,rows) {
  const idx=headers.indexOf('Appointment ID'),entry=headers.indexOf('到店紀錄ID（內部）');
  const retained=headers.flatMap((h,i)=>['CS同事名','結果','到店日期','備註','補充Book登記日期','來源','試做價','開單金額'].includes(h)?[i]:[]),map={};
  rows.forEach(row=>{
    const id=oa2Text_(row[idx])||oa2Text_(row[entry]);
    if(!id){if(retained.some(i=>oa2Text_(row[i])))throw new Error('Unowned colleague input must be resolved before sorting.');return;}
    if(map[id])throw new Error('Duplicate arrival ownership before sort.');map[id]=retained.map(i=>row[i]);
  });return map;
}
function oa3RowSnapshot_(sh) {
  const headers=oa2Header_(sh,OA2.HEADER_ROW),n=Math.max(0,sh.getLastRow()-OA2.FIRST_ROW+1);
  return oa3SnapshotValues_(headers,n?sh.getRange(OA2.FIRST_ROW,1,n,headers.length).getValues():[]);
}
function oa3SortKey_(date,time,id,index,outcome) {
  const d=oa2Date_(date),t=oa2Time_(time),done=['已到店','Show','No Show','取消'].includes(oa2Text_(outcome));return (id?done?'1':'0':'2')+'|'+(d||'9999-99-99')+'|'+(t||'99:99')+'|'+String(index).padStart(8,'0');
}
function oa3SortArrival_(sh) {
  const n=Math.max(0,sh.getLastRow()-OA2.FIRST_ROW+1);if(n<2)return {sorted:0};
  const headers=oa2Header_(sh,OA2.HEADER_ROW),date=headers.indexOf('預約日期'),time=headers.indexOf('時間'),id=headers.indexOf('Appointment ID'),width=sh.getMaxColumns();
  const outcome=headers.indexOf('結果'),rows=sh.getRange(OA2.FIRST_ROW,1,n,headers.length).getValues(),before=oa3SnapshotValues_(headers,rows),keys=rows.map((r,i)=>[oa3SortKey_(r[date],r[time],r[id],i,r[outcome])]);
  if(keys.every((r,i)=>!i||r[0]>=keys[i-1][0]))return {sorted:0};
  sh.insertColumnAfter(width);
  try{const keyRange=sh.getRange(OA2.FIRST_ROW,width+1,n,1);keyRange.clearDataValidations();keyRange.setValues(keys);sh.getRange(OA2.FIRST_ROW,1,n,width+1).sort({column:width+1,ascending:true});}
  finally{sh.deleteColumn(width+1);}
  const after=oa3RowSnapshot_(sh);if(JSON.stringify(Object.keys(before).sort())!==JSON.stringify(Object.keys(after).sort())||Object.keys(before).some(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])))throw new Error('Arrival ownership or colleague inputs changed during native sorting.');
  return {sorted:Object.keys(before).length};
}
var OA3_MANUAL_RUN_ACTIVE=false;
function oa3AfterSync_(ss) {
  if(OA3_MANUAL_RUN_ACTIVE)return;
  const props=PropertiesService.getDocumentProperties(),workflow=props.getProperty('ARRIVAL_WORKFLOW_V3_ENABLED')==='1',display=props.getProperty('ARRIVAL_DISPLAY_V3_ENABLED')==='1';
  if(workflow||display)oa3RefreshDisplay_(ss,false);
  if(workflow)oa3SortArrival_(ss.getSheetByName(OA2.ARRIVAL));
}
function enableArrivalDisplayProjection20261013() {
  const headers=oa2Header_(oa2Spreadsheet_().getSheetByName(OA2.ARRIVAL),OA2.HEADER_ROW);
  if(headers[0]!=='品牌'||headers[1]!=='電話')throw new Error('Arrival display columns are not installed.');
  PropertiesService.getDocumentProperties().setProperty('ARRIVAL_DISPLAY_V3_ENABLED','1');
  console.log(JSON.stringify({displayProjectionEnabled:true}));return {displayProjectionEnabled:true};
}
function repairArrivalNames20261013() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(30000))throw new Error('同步中，請稍後再試。');
  try{return oa3RefreshDisplay_(oa2Spreadsheet_(),true);}finally{lock.releaseLock();}
}
function syncBookedArrivalAccount(index) {
  if(!Number.isInteger(index)||index<0||index>=OMNI_ACCOUNT_TABS.length)throw new Error('Invalid Account sync index.');
  const lock=LockService.getDocumentLock(),ss=oa2Spreadsheet_();if(!lock.tryLock(1000))return {busy:true,index};
  try{
    OA3_MANUAL_RUN_ACTIVE=true;
    const result=oa2ProcessAccount_(ss,ss.getSheetByName(OMNI_ACCOUNT_TABS[index]),'scan',null,false);
    oa3RefreshDisplay_(ss,false);oa3SortArrival_(ss.getSheetByName(OA2.ARRIVAL));
    const receipt={completed:true,index,added:result.newQueue,errors:result.errors.length,deferred:result.deferredQueueConflicts};
    console.log(JSON.stringify(Object.assign({handler:'manual_arrival_sync_account'},receipt)));return receipt;
  }finally{OA3_MANUAL_RUN_ACTIVE=false;lock.releaseLock();}
}
/** Read-only candidate discovery: existing complete rows never enter reconciliation. */
function oa3MissingBookedSelection_(snaps,queue) {
  const byAppointment=new Map(),entries=new Set(),leads=new Set(),pointers=new Set(),items=[],reviewItems=[];let skipped=0,reviewCount=0;
  queue.forEach(q=>{
    if(q.appointmentId){if(byAppointment.has(q.appointmentId))throw new Error('Duplicate arrival appointment ownership; review before adding.');byAppointment.set(q.appointmentId,q);}
    if(q.entryId){if(entries.has(q.entryId))throw new Error('Duplicate arrival entry ownership; review before adding.');entries.add(q.entryId);}
  });
  snaps.forEach(snap=>snap.records.forEach(r=>{
    if(!r.meaningful)return;
    if(r.leadId){if(leads.has(r.leadId))throw new Error('Duplicate source Lead ID; review before adding.');leads.add(r.leadId);}
    if(r.appointmentId){if(pointers.has(r.appointmentId))throw new Error('Duplicate source appointment pointer; review before adding.');pointers.add(r.appointmentId);}
  }));
  snaps.forEach(snap=>snap.records.forEach(r=>{
    if(!r.meaningful)return;
    const status=oa2Status_(r.status),q=r.appointmentId&&byAppointment.get(r.appointmentId);
    if(!['booked','show','no_show'].includes(status))return;
    if(q&&q.origin==='managed'){
      const gap=(!oa2Text_(q.date)&&!!oa2Date_(r.date))||(!oa2Text_(q.time)&&!!oa2Time_(r.time));
      // Complete existing appointments require no ownership revalidation or write.
      if(!gap){skipped++;return;}
      if(!r.leadId||!q.entryId||oa2Text_(q.raw[23])!==r.leadId||q.account!==r.account||q.customerKey!==r.customerKey){reviewCount++;reviewItems.push({snap,record:r,kind:'schedule_gap',queue:q});return;}
      items.push({snap,record:r,kind:'schedule_gap',queue:q});return;
    }
    if(status!=='booked')return;
    items.push({snap,record:r,kind:'missing',queue:q||null});
  }));
  return {items,skipped,reviewCount,reviewItems,byAppointment};
}
/** Read-only array facade. Shared parsers retain their exact header/mapping guards. */
function oa3ManualMemorySheet_(data,name) {
  const width=data.length?data[0].length:1;
  return {getName:()=>name,getLastRow:()=>data.length,getLastColumn:()=>width,getMaxColumns:()=>width,
    getRange:(row,column,height,columns)=>{
      const read=()=>Array.from({length:height},(_,i)=>Array.from({length:columns},(_,j)=>data[row+i-1]&&data[row+i-1][column+j-1]!==undefined?data[row+i-1][column+j-1]:''));
      return {getValues:read,getDisplayValues:()=>read().map(values=>values.map(oa2Text_))};
    }};
}
/** One bulk native read; updated-day cache is confined to this discovery snapshot. */
function oa3ManualAccountSnapshot_(sheet,account,dateCache) {
  const data=sheet.getDataRange().getValues(),memory=oa3ManualMemorySheet_(data,account),c=getOmniColumns_(memory),cache=dateCache||new Map();
  // Account snapshots use updatedAt only for the existing person-current selector.
  // Replace native Dates in a separate working copy, leaving every CAS cell raw.
  const working=data.map((row,i)=>{
    const value=row[c.LAST_UPDATED-1];if(!i||!(value instanceof Date))return row;
    const key=value.getTime();if(!cache.has(key))cache.set(key,oa2Date_(value));
    const copy=row.slice();copy[c.LAST_UPDATED-1]=cache.get(key);return copy;
  });
  const snap=oa2AccountSnapshot_(oa3ManualMemorySheet_(working,account),false);
  snap.sheet=sheet;snap.values=data.slice(1);return snap;
}
function oa3ManualQueueSnapshot_(sheet) {
  if(!sheet)throw new Error('Missing arrival sheet.');
  const memory=oa3ManualMemorySheet_(sheet.getDataRange().getValues(),OA2.ARRIVAL);
  return oa2ReadQueue_({getSheetByName:name=>name===OA2.ARRIVAL?memory:null},false);
}
function oa3MissingRead_(ss,timings,prefix) {
  const metrics=timings||{},phase=prefix||'scan',cache=new Map();
  const queue=oa3ManualPhase_(metrics,phase+'QueueMs',()=>oa3ManualQueueSnapshot_(ss.getSheetByName(OA2.ARRIVAL)));
  const snaps=OMNI_ACCOUNT_TABS.map((name,index)=>oa3ManualPhase_(metrics,phase+'Source'+index+'Ms',()=>oa3ManualAccountSnapshot_(ss.getSheetByName(name),name,cache)));
  return {queue,snaps,selection:oa3MissingBookedSelection_(snaps,queue)};
}
/** Presence-only discovery never parses displayed dates or verifies complete rows. */
function oa3ManualPresenceSelection_(snaps,queue) {
  const byAppointment=new Map(),entries=new Set(),leads=new Set(),pointers=new Set(),items=[];let skipped=0;
  queue.forEach(q=>{
    if(q.appointmentId){if(byAppointment.has(q.appointmentId))throw new Error('Duplicate arrival appointment ownership; review before adding.');byAppointment.set(q.appointmentId,q);}
    if(q.entryId){if(entries.has(q.entryId))throw new Error('Duplicate arrival entry ownership; review before adding.');entries.add(q.entryId);}
  });
  snaps.forEach(snap=>snap.records.forEach(r=>{
    if(!r.meaningful)return;
    if(r.leadId){if(leads.has(r.leadId))throw new Error('Duplicate source Lead ID; review before adding.');leads.add(r.leadId);}
    if(r.appointmentId){if(pointers.has(r.appointmentId))throw new Error('Duplicate source appointment pointer; review before adding.');pointers.add(r.appointmentId);}
  }));
  snaps.forEach(snap=>snap.records.forEach(r=>{
    if(!r.meaningful)return;const status=oa2Status_(r.status);if(!['booked','show','no_show'].includes(status))return;
    const q=r.appointmentId&&byAppointment.get(r.appointmentId);
    if(q&&q.origin==='managed'){
      const gap=(!oa2Text_(q.date)&&!!oa2Text_(r.date))||(!oa2Text_(q.time)&&!!oa2Text_(r.time));
      if(gap)items.push({snap,record:r,kind:'schedule_gap',queue:q});else skipped++;
      return;
    }
    if(status==='booked')items.push({snap,record:r,kind:'missing',queue:q||null});
  }));return {items,skipped,byAppointment};
}
function oa3ManualDisplayAccount_(sheet,account) {
  const data=sheet.getDataRange().getDisplayValues(),memory=oa3ManualMemorySheet_(data,account),c=getOmniColumns_(memory),meta=oa2Meta_(memory,false),values=data.slice(1);
  const records=values.map((row,i)=>({row:i+2,meaningful:oa2HasBusinessPayload_(row,c),account,status:row[c.STATUS-1],date:row[c.APPOINTMENT_DATE-1],time:row[c.APPOINTMENT_TIME-1],leadId:oa2Text_(row[meta-1]),appointmentId:oa2Text_(row[meta])}));
  return {account,sheet,c,meta,width:data.length?data[0].length:1,values,records};
}
function oa3ManualDisplayQueue_(sheet) {
  if(!sheet)throw new Error('Missing arrival sheet.');
  const data=sheet.getDataRange().getDisplayValues(),memory=oa3ManualMemorySheet_(data,OA2.ARRIVAL),queue=oa2ReadQueue_({getSheetByName:name=>name===OA2.ARRIVAL?memory:null},false);
  Object.defineProperty(queue,'oa3Hydration',{value:{sheet,data,hydrated:new Set()},enumerable:false});return queue;
}
/** Only rows that may receive an operation need native Date/number before-images. */
function oa3ManualHydrateQueueRows_(queue,requestedRows) {
  const state=queue.oa3Hydration;if(!state)return 0;
  const wanted=new Set(requestedRows),pending=queue.filter(q=>wanted.has(q.row)&&!state.hydrated.has(q.row));if(!pending.length)return 0;
  const data=state.data.slice(),width=data.length?data[0].length:1;
  oa2RowGroups_(pending).forEach(group=>{const first=group[0].row,values=state.sheet.getRange(first,1,group.length,width).getValues();values.forEach((row,i)=>data[first+i-1]=row);});
  const memory=oa3ManualMemorySheet_(data,OA2.ARRIVAL),fresh=oa2ReadQueue_({getSheetByName:name=>name===OA2.ARRIVAL?memory:null},false),byRow=new Map(fresh.map(q=>[q.row,q]));
  pending.forEach(q=>{const next=byRow.get(q.row);if(!next||q.appointmentId!==next.appointmentId||q.entryId!==next.entryId||q.origin!==next.origin||oa2Text_(q.raw[23])!==oa2Text_(next.raw[23])||q.account!==next.account||q.customerKey!==next.customerKey)throw new Error('Arrival ownership changed before targeted read; preserving rows for retry.');});
  pending.forEach(q=>{Object.assign(q,byRow.get(q.row));state.hydrated.add(q.row);});state.data=data;return pending.length;
}
function oa3ManualHydrateResolvedQueue_(ctx,snaps,queue) {
  const selection=oa3MissingBookedSelection_(snaps,queue),rows=[];
  selection.items.forEach(item=>{if(!item.record.leadId)return;const a=oa3ManualExistingAppointment_(ctx,item.record);if(!oa3ManualOpenAppointment_(a))return;const q=selection.byAppointment.get(a.id);if(q&&(q.origin==='allocating'||!oa2Text_(q.date)&&oa2Text_(item.record.date)||!oa2Text_(q.time)&&oa2Text_(item.record.time)))rows.push(q.row);});
  return oa3ManualHydrateQueueRows_(queue,rows);
}
function oa3MissingDisplayRead_(ss,timings,prefix,includeRegistry) {
  const metrics=timings||{},phase=prefix||'display',context=oa3ManualBatchDisplayContext_(ss,metrics,phase,!!includeRegistry),display=context.spreadsheet;
  const queue=oa3ManualPhase_(metrics,phase+'QueueMs',()=>oa3ManualDisplayQueue_(display.getSheetByName(OA2.ARRIVAL)));
  const snaps=OMNI_ACCOUNT_TABS.map((name,index)=>oa3ManualPhase_(metrics,phase+'Source'+index+'Ms',()=>oa3ManualDisplayAccount_(display.getSheetByName(name),name)));
  const selection=oa3ManualPresenceSelection_(snaps,queue);
  if(context.readEngine==='sheets_api')oa3ManualRawGapPrefilter_(ss,selection,metrics,phase);
  return {queue,snaps,selection,readEngine:context.readEngine,displaySpreadsheet:display};
}
/** Fresh display discovery controls scope; only affected sources/queue become raw CAS snapshots. */
function oa3MissingWriteRead_(ss,timings) {
  const metrics=timings||{},fresh=oa3MissingDisplayRead_(ss,metrics,'lockedDisplay');
  if(!fresh.selection.items.length)return {queue:fresh.queue,snaps:[],selection:fresh.selection};
  const accounts=new Set(fresh.selection.items.map(item=>item.record.account)),cache=new Map(),byAccount=new Map();
  const queue=fresh.queue;oa3ManualPhase_(metrics,'lockedRawQueueMs',()=>oa3ManualHydrateQueueRows_(queue,fresh.selection.items.filter(item=>item.queue).map(item=>item.queue.row)));
  const snaps=OMNI_ACCOUNT_TABS.flatMap((name,index)=>{
    if(!accounts.has(name))return [];
    const snap=oa3ManualPhase_(metrics,'lockedRawSource'+index+'Ms',()=>oa3ManualAccountSnapshot_(ss.getSheetByName(name),name,cache));byAccount.set(name,snap);return [snap];
  });
  // Repeat global ambiguity checks using raw affected sources plus fresh display-only others.
  const mixed=fresh.snaps.map(snap=>byAccount.get(snap.account)||snap),presence=oa3ManualPresenceSelection_(mixed,queue);
  oa3ManualPhase_(metrics,'lockedAdditionalQueueMs',()=>oa3ManualHydrateQueueRows_(queue,presence.items.filter(item=>item.queue).map(item=>item.queue.row)));
  const selection=oa3MissingBookedSelection_(snaps,queue);
  oa3ManualMergeReviews_(selection,fresh.selection);selection.skipped=presence.skipped;return {queue,snaps,selection,globalSnaps:mixed};
}
function previewMissingBookedArrivalsFast() {
  const started=Date.now(),timings={},ss=oa3ManualPhase_(timings,'spreadsheetMs',()=>oa2Spreadsheet_()),snapshot=oa3MissingDisplayRead_(ss,timings,'previewDisplay');
  const result={readOnly:true,readEngine:snapshot.readEngine,candidates:snapshot.selection.items.length,missing:snapshot.selection.items.filter(item=>item.kind==='missing').length,scheduleGaps:snapshot.selection.items.filter(item=>item.kind==='schedule_gap').length,skipped:snapshot.selection.skipped,timings,elapsedMs:Date.now()-started};
  console.log(JSON.stringify(Object.assign({handler:'manual_missing_booked_preview'},result)));return result;
}
/** Read-only gap ownership audit: output contains positions/booleans, never customer data. */
function auditManualScheduleGapsFast() {
  const started=Date.now(),timings={},ss=oa2Spreadsheet_(),snapshot=oa3MissingDisplayRead_(ss,timings,'auditDisplay',true),ledger=snapshot.displaySpreadsheet.getSheetByName(OA2.LEDGER);
  if(!ledger)throw new Error('Missing appointment registry.');
  const rows=oa3ManualPhase_(timings,'registryOwnershipMs',()=>ledger.getRange(1,1,Math.max(1,ledger.getLastRow()),5).getDisplayValues());
  if(OA2.LEDGER_HEADERS.slice(0,5).some((header,i)=>oa2Text_(rows[0][i])!==header))throw new Error('Registry ownership headers do not match.');
  const registry=new Map();rows.slice(1).forEach(row=>{const id=oa2Text_(row[0]);if(!id)return;const list=registry.get(id)||[];list.push(row);registry.set(id,list);});
  const details=snapshot.selection.items.concat(snapshot.selection.reviewItems||[]).filter(item=>item.kind==='schedule_gap').map(item=>{
    const r=item.record,q=item.queue,s=item.snap,row=s.values[r.row-2],phone=last8_(row[s.c.PHONE-1]),key=oa2CustomerKey_(row,s.c,r.account),matches=registry.get(r.appointmentId)||[],reg=matches.length===1?matches[0]:[];
    const checks={accountIndex:OMNI_ACCOUNT_TABS.indexOf(r.account),sourceRow:r.row,queueRow:q.row,registryUnique:matches.length===1,sourceQueueLead:!!r.leadId&&r.leadId===oa2Text_(q.raw[23]),sourceQueueAccount:r.account===q.account,sourceQueueKey:!!key&&key===q.customerKey,registryLead:!!r.leadId&&oa2Text_(reg[1])===r.leadId,registryAccount:oa2Text_(reg[2])===r.account,registryKey:!!key&&oa2Text_(reg[3])===key,registryPhone:!!phone&&oa2Text_(reg[4])===phone};
    checks.reason=!checks.registryUnique?'registry_missing_or_duplicate':!checks.sourceQueueLead||!checks.sourceQueueAccount||!checks.sourceQueueKey?'queue_ownership_needs_review':!checks.registryLead||!checks.registryAccount||!checks.registryKey||!checks.registryPhone?'registry_ownership_needs_review':'ownership_matches';
    console.log(JSON.stringify(Object.assign({handler:'manual_schedule_gap_audit'},checks)));return checks;
  });
  const result={readOnly:true,readEngine:snapshot.readEngine,candidates:snapshot.selection.items.length,scheduleGaps:details.length,ownershipMatches:details.filter(row=>row.reason==='ownership_matches').length,needsReview:details.filter(row=>row.reason!=='ownership_matches').length,details,elapsedMs:Date.now()-started,timings};
  console.log(JSON.stringify({handler:'manual_schedule_gap_audit_summary',readOnly:true,scheduleGaps:result.scheduleGaps,ownershipMatches:result.ownershipMatches,needsReview:result.needsReview,elapsedMs:result.elapsedMs}));return result;
}
function oa3ManualOpenAppointment_(a) {return !!a&&!a.outcome&&a.provenance!=='legacy_show'&&['active','unscheduled'].includes(a.state);}
function oa3ManualExistingAppointment_(ctx,r) {
  let a=r.appointmentId?ctx.appointments[r.appointmentId]:null;
  if(r.appointmentId&&!a)throw new Error('Unknown source appointment; preserving for review.');
  const recovered=Object.keys(ctx.appointments).map(id=>ctx.appointments[id]).filter(x=>x.leadId===r.leadId&&x.provenance!=='legacy_show').sort((x,y)=>String(x.firstSeenAt).localeCompare(String(y.firstSeenAt)));
  const newest=recovered[recovered.length-1];if(newest&&(!a||newest.previousId===a.id))a=newest;
  if(a&&(a.leadId!==r.leadId||a.account!==r.account||a.customerKey!==r.customerKey||String(a.phone)!==String(r.phone)))throw new Error('Source/registry identity mismatch; preserving for review.');
  return a;
}
/** A manual gap repair changes only missing E/F cells, never staff outcome/H/CS/money. */
function oa3ManualScheduleGap_(ctx,r,q,a) {
  if(!oa3ManualOpenAppointment_(a)||r.appointmentId!==a.id||r.leadId!==a.leadId||q.origin!=='managed'||q.entryId!==a.queueId||oa2Text_(q.raw[23])!==a.leadId||q.account!==a.account||q.customerKey!==a.customerKey||!r.phone)return null;
  const sourceDate=oa2Date_(r.date),sourceTime=oa2Time_(r.time),queueDate=oa2Date_(q.date),queueTime=oa2Time_(q.time);
  if((oa2Text_(r.date)&&!sourceDate)||(oa2Text_(r.time)&&!sourceTime)||(oa2Text_(q.date)&&!queueDate)||(oa2Text_(q.time)&&!queueTime))return null;
  if(queueDate&&queueDate!==sourceDate||queueTime&&queueTime!==sourceTime)return null;
  const date=queueDate||sourceDate,time=queueTime||sourceTime;
  if(date===queueDate&&time===queueTime)return null;
  // Do not amend an ancestor while a retained successor exists.
  if(Object.keys(ctx.appointments).some(id=>{const x=ctx.appointments[id];return x.id!==a.id&&x.leadId===a.leadId&&x.provenance!=='legacy_show'&&x.previousId===a.id;}))return null;
  const before=oa2StateView_(a);
  if(a.date!==date||a.time!==time){a.date=date;a.time=time;a.state=date?'active':'unscheduled';a.lastSchedule=date+'|'+time;a.lastStatus=oa2Status_(r.status);a.revision++;a.updatedAt=ctx.now;oa2Event_(ctx,a,'manual_schedule_gaps_backfilled',before,'manual_missing_booked');}
  return {kind:'schedule_only',appt:a,row:q.row,state:oa2Outcome_(q.outcome)==='Show'?'已到店：待自動同步':oa2QueueState_(a,ctx.today)};
}
/** Display evidence for appended records only; fresh source rows retain the existing CAS guard. */
function oa3ManualDisplaySources_(items,fresh) {
  const map=new Map();
  items.forEach(item=>{
    const s=item.snap,r=item.record,row=fresh?s.sheet.getRange(r.row,1,1,s.width).getValues()[0]:s.values[r.row-2];
    const id=fresh?oa2Text_(row[s.meta-1]):r.leadId,appointmentId=fresh?oa2Text_(row[s.meta]):r.appointmentId;
    if(id!==r.leadId||appointmentId!==r.appointmentId)throw new Error('Source ownership changed before display; retry safely.');
    const c=s.c,value={id,account:r.account,row:r.row,cs:oa2Text_(row[c.CS_OWNER-1]),brand:oa2Text_(row[c.BRAND-1]),phone:oa2Text_(row[c.PHONE-1]),email:oa2Text_(row[c.EMAIL-1]),social:oa2Text_(row[c.SOCIAL_USERNAME-1]),created:oa2Date_(row[c.CREATED_AT-1]),appointmentId};
    const list=map.get(id)||[];list.push(value);map.set(id,list);
  });return map;
}
function oa3ManualPhase_(timings,name,action) {const start=Date.now();console.log(JSON.stringify({handler:'manual_missing_booked_phase',phase:name,state:'started'}));try{return action();}finally{timings[name]=Date.now()-start;console.log(JSON.stringify({handler:'manual_missing_booked_phase',phase:name,durationMs:timings[name]}));}}
/** One missing-only RPC, with a read-only no-op path that never waits on the document lock. */
function syncMissingBookedArrivals() {
  const started=Date.now(),timings={},startup=oa3ManualStartup_(timings),ss=startup.spreadsheet,props=startup.props,pendingKey='ARRIVAL_MANUAL_MISSING_FINALIZE_PENDING';
  const initial=oa3ManualPhase_(timings,'initialReadMs',()=>oa3MissingDisplayRead_(ss,timings,'initialDisplay')),initialReadMs=Date.now()-started,initialPending=props.getProperty(pendingKey)==='1';
  if(!initial.selection.items.length&&!initialPending){const receipt={completed:true,readEngine:initial.readEngine||'native',added:0,repaired:0,skipped:initial.selection.skipped,review:initial.selection.reviewCount||0,elapsedMs:Date.now()-started,initialReadMs,timings,noOp:true};console.log(JSON.stringify(Object.assign({handler:'manual_missing_booked_sync'},receipt)));return receipt;}
  const lock=LockService.getDocumentLock();if(!oa3ManualPhase_(timings,'lockWaitMs',()=>lock.tryLock(1000)))return {busy:true};
  try{
    // Never reuse pre-lock source/queue snapshots for any write.
    const pending=props.getProperty(pendingKey)==='1',current=oa3ManualPhase_(timings,'lockedReadMs',()=>oa3MissingWriteRead_(ss,timings)),queue=current.queue,snaps=current.snaps;
    let selection=current.selection,ops=[],processed=[],review=current.selection.reviewCount||0,ctx=null;
    if(selection.items.length){
      ctx=oa3ManualPhase_(timings,'contextMs',()=>oa2Context_(ss,false));
      snaps.forEach(s=>oa2ReplaySourceAnchors_(ctx,s));
      oa3ManualPhase_(timings,'resolvedRawQueueMs',()=>oa3ManualHydrateResolvedQueue_(ctx,snaps,queue));
      const globalSelection=current.globalSnaps?oa3ManualPresenceSelection_(current.globalSnaps,queue):null;
      selection=oa3MissingBookedSelection_(snaps,queue);oa3ManualMergeReviews_(selection,current.selection);selection.skipped=globalSelection?globalSelection.skipped:current.selection.skipped;review=Math.max(review,selection.reviewCount||0);
      const selectedAppointments={};
      selection.items.forEach(item=>{
        const r=item.record;if(!r.leadId&&[r.appointmentId,r.bookedAt,r.outcome,r.outcomeAt,r.pendingSnapshot].some(value=>oa2Text_(value)))throw new Error('Source identity missing with existing appointment metadata; preserving for review.');let a=oa3ManualExistingAppointment_(ctx,r);
        if(a&&(!oa3ManualOpenAppointment_(a)||ctx.retiredQueueAppointmentIds&&ctx.retiredQueueAppointmentIds.has(a.id))){review++;return;}
        const q=a&&selection.byAppointment.get(a.id);
        if(q&&q.origin==='managed'){
          if(!((!oa2Text_(q.date)&&!!oa2Date_(r.date))||(!oa2Text_(q.time)&&!!oa2Time_(r.time))))return;
          if(q.entryId!==a.queueId||oa2Text_(q.raw[23])!==a.leadId||q.account!==a.account||q.customerKey!==a.customerKey)throw new Error('Arrival owner changed; preserving existing rows.');
          const gap=oa3ManualScheduleGap_(ctx,r,q,a);if(gap){ops.push(gap);processed.push(Object.assign({},item,{kind:'schedule_gap'}));}else if(item.kind==='schedule_gap')review++;
          return;
        }
        if((oa2Text_(r.date)&&!oa2Date_(r.date))||(oa2Text_(r.time)&&!oa2Time_(r.time))||!r.customerKey){review++;return;}
        if(a)r.appointmentId=a.id;
        a=oa2ReconcileRecord_(ctx,r,'scan');
        if(!oa3ManualOpenAppointment_(a)){review++;return;}
        selectedAppointments[a.id]=a;processed.push(item);
      });
      if(ctx.errors.length)throw new Error(ctx.errors.join('\n'));
      const appendOps=oa2PlanQueue_(Object.assign({},ctx,{appointments:selectedAppointments}),queue);
      if(appendOps.some(op=>op.kind!=='append'))throw new Error('Missing-only sync cannot refresh existing arrival rows.');
      ops=ops.concat(appendOps);
      if(ctx.errors.length)throw new Error(ctx.errors.join('\n'));
      if(ops.length){
        const writeSnaps=snaps.filter(s=>processed.some(item=>item.snap===s)),sourceRows=new Map();
        // Gap repairs retain all source metadata, including pending outcome evidence.
        // Their registry transition is durably checkpointed before its queue write.
        processed.filter(item=>item.kind!=='schedule_gap').forEach(item=>{const rows=sourceRows.get(item.snap)||new Set();rows.add(item.record.row);sourceRows.set(item.snap,rows);});
        writeSnaps.forEach(s=>s.deferredRows=new Set(s.records.filter(r=>!(sourceRows.get(s)||new Set()).has(r.row)).map(r=>r.row)));
        // Durable recovery replays remain committed in full; existing queue inputs
        // are never absorbed, reconciled, or projected by this manual route.
        props.setProperty(pendingKey,'1');
        oa3ManualPhase_(timings,'commitMs',()=>oa2Commit_(ss,ctx,queue,ops,writeSnaps,processed.map(item=>item.record)));
      }
    }
    const addedOps=ops.filter(op=>op.kind==='append'),repaired=ops.filter(op=>op.kind==='schedule_only').length;
    if(pending){oa3ManualPhase_(timings,'displayMs',()=>oa3RefreshDisplay_(ss,false));}
    else if(addedOps.length){
      const ids=new Set(addedOps.map(op=>op.appt.id)),displayItems=processed.filter(item=>ids.has(item.record.appointmentId));
      oa3ManualPhase_(timings,'displayMs',()=>oa3RefreshDisplay_(ss,false,{appointments:ctx.appointments,ids,sources:oa3ManualDisplaySources_(displayItems,false),freshSources:()=>oa3ManualDisplaySources_(displayItems,true)}));
    }
    if(ops.length||pending)oa3ManualPhase_(timings,'sortMs',()=>oa3SortArrival_(ss.getSheetByName(OA2.ARRIVAL)));
    if(ops.length||pending)props.deleteProperty(pendingKey);
    const receipt={completed:true,readEngine:initial.readEngine||'native',added:addedOps.length,repaired,skipped:selection.skipped,review,elapsedMs:Date.now()-started,initialReadMs,timings,noOp:!ops.length&&!pending};
    ss.toast('補上 '+receipt.added+' 個預約；補回 '+receipt.repaired+' 個日期／時間。','到店紀錄',8);
    console.log(JSON.stringify(Object.assign({handler:'manual_missing_booked_sync'},receipt)));return receipt;
  }finally{lock.releaseLock();}
}
function syncAllBookedArrivals() {
  const html=HtmlService.createHtmlOutput(`<html><head><meta charset="utf-8"><style>body{font:14px system-ui,sans-serif;color:#213840;padding:20px;background:#f6f8f8}h2{font-size:18px;margin:0 0 16px}section{background:white;border-radius:12px;padding:18px;box-shadow:0 2px 8px #00000008}progress{width:100%;accent-color:#1d3a44;height:8px}p{line-height:1.6}button{border:0;border-radius:7px;padding:10px 18px;color:white;background:#1d3a44;cursor:pointer}</style></head><body><h2>補上未入表預約</h2><section><progress id="progress" max="1"></progress><p id="status" role="status" aria-live="polite">正在尋找未入表及欠日期／時間嘅預約…</p><button id="retry" hidden onclick="run()">再試</button></section><script>let busy=0,running=false,attemptStarted=0;const status=document.getElementById('status'),progress=document.getElementById('progress'),retry=document.getElementById('retry');function run(){if(running)return;if(!attemptStarted)attemptStarted=Date.now();running=true;retry.hidden=true;progress.removeAttribute('value');status.textContent='正在補上未入表及欠日期／時間嘅預約…';google.script.run.withSuccessHandler(r=>{running=false;if(r.busy){if(++busy>60){attemptStarted=0;status.textContent='其他同步仍在進行，請稍後再試。';retry.hidden=false;return;}status.textContent='等候目前同步完成…';setTimeout(run,3000);return;}if(!r.completed){attemptStarted=0;status.textContent='同步未完成，請再試。';retry.hidden=false;return;}busy=0;progress.value=1;const seconds=((Date.now()-attemptStarted)/1000).toFixed(1);attemptStarted=0;status.textContent=(r.noOp?'冇未入表或可補回嘅預約。':'已補上 '+r.added+' 個預約；補回 '+r.repaired+' 個日期／時間。')+' 略過 '+r.skipped+' 個毋須更新嘅記錄。'+(r.review?' '+r.review+' 個需核對。':'')+' 用時 '+seconds+' 秒。';}).withFailureHandler(e=>{running=false;attemptStarted=0;status.textContent='同步未完成：'+e.message;retry.hidden=false;}).syncMissingBookedArrivals();}run();</script></body></html>`).setTitle('到店紀錄');SpreadsheetApp.getUi().showSidebar(html);
}

function markArrivalManualSyncComplete(added){if(!Number.isInteger(added)||added<0)throw new Error('Invalid count.');oa2Spreadsheet_().toast('同步完成；新增 '+added+' 個預約。','到店紀錄',8);}
function oa3InstallDisplay_(ss) {
    const sh=ss.getSheetByName(OA2.ARRIVAL),headers=oa2Header_(sh,OA2.HEADER_ROW);
    if(headers.indexOf('品牌')<0&&headers.indexOf('電話')<0){
      oa2QueueLayout_(sh,false);oa3RowSnapshot_(sh);if(!ss.getSheetByName('_arrival_workflow_v3_before'))sh.copyTo(ss).setName('_arrival_workflow_v3_before').hideSheet();sh.insertColumnsBefore(1,2);sh.getRange(OA2.HEADER_ROW,1,1,2).setValues([['品牌','電話']]);
      sh.getRange(OA2.FIRST_ROW,2,sh.getMaxRows()-OA2.FIRST_ROW+1,1).setNumberFormat('@');sh.setColumnWidth(1,175);sh.setColumnWidth(2,150);sh.hideColumns(3);
      sh.getRange(OA2.HEADER_ROW,4,1,1).copyTo(sh.getRange(OA2.HEADER_ROW,1,1,2),SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);
    }else if(headers[0]!=='品牌'||headers[1]!=='電話')throw new Error('Arrival display headers are ambiguous.');
    oa2QueueLayout_(sh,false);const result=oa3RefreshDisplay_(ss,true),sort=oa3SortArrival_(sh);
    PropertiesService.getDocumentProperties().setProperty('ARRIVAL_WORKFLOW_V3_ENABLED','1');
    console.log(JSON.stringify({installed:true,display:result,sort}));return {installed:true,display:result,sort};
 }
function installArrivalDisplayColumns20261013() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(30000))throw new Error('同步中，請稍後再試。');
  try{return oa3InstallDisplay_(oa2Spreadsheet_());}finally{lock.releaseLock();}
}
function repairArrivalDisplayFields20261013() {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(30000))throw new Error('同步中，請稍後再試。');
  try{
    const ss=oa2Spreadsheet_(),sh=ss.getSheetByName(OA2.ARRIVAL),headers=oa2Header_(sh,OA2.HEADER_ROW);
    if(headers[0]!=='品牌'||headers[1]!=='電話')throw new Error('Arrival display columns are not installed.');
    // Inserted columns inherited the former customer-selector validation.
    // These are generated display fields, not customer-selector controls.
    sh.getRange(OA2.FIRST_ROW,1,sh.getMaxRows()-OA2.FIRST_ROW+1,2).clearDataValidations();
    return oa3RefreshDisplay_(ss,false);
  }finally{lock.releaseLock();}
}
function requestArrivalWorkflow20261013() {
  PropertiesService.getDocumentProperties().setProperty('ARRIVAL_WORKFLOW_V3_MAINTENANCE_REQUESTED','1');
  console.log(JSON.stringify({maintenanceQueued:true}));return {maintenanceQueued:true};
}
function oa3AdmitMaintenance_(ss) {
  const props=PropertiesService.getDocumentProperties();if(props.getProperty('ARRIVAL_WORKFLOW_V3_MAINTENANCE_REQUESTED')!=='1')return null;
  const result=oa3InstallDisplay_(ss);installArrivalSyncButton20261013();props.deleteProperty('ARRIVAL_WORKFLOW_V3_MAINTENANCE_REQUESTED');
  console.log(JSON.stringify({handler:'arrival_workflow_maintenance',completed:true}));return result;
}
function nativeArrivalWorkflowQa20261013() {
  const ss=SpreadsheetApp.create('Arrival ownership QA — SYNTHETIC ONLY — 20261013'),sh=ss.getSheets()[0].setName('Synthetic Arrivals');ss.setSpreadsheetTimeZone('Asia/Hong_Kong');
  const headers=OA2_QUEUE_BASE_HEADERS.concat(OA2.QUEUE_HEADERS);headers.splice(1,0,'CS同事名');headers.push('來源','試做價','開單金額','總金額');
  sh.getRange(7,1,1,headers.length).setValues([headers]);
  const row=(id,date,time,cs,trial,order)=>{const r=Array(headers.length).fill('');const set=(h,v)=>r[headers.indexOf(h)]=v;set('客人／預約','Synthetic');set('CS同事名',cs);set('預約日期',oa2NativeDate_(date));set('時間',oa2NativeTime_(time));set('結果','待到店');set('Account','Alyssa Main');set('Appointment ID',id);set('到店紀錄ID（內部）','queue_'+id);set('Omni Lead ID','lead_'+id);set('Record Origin','managed');set('來源','AD');set('試做價',trial);set('開單金額',order);set('總金額','=SUM('+columnLetter_(headers.indexOf('試做價')+1)+'8:'+columnLetter_(headers.indexOf('開單金額')+1)+'8)');return r;};
  sh.getRange(8,1,4,headers.length).setValues([row('later','2026-10-20','15:00','sandy',0,500),row('undated','','','summer',20,0),row('early-time','2026-10-15','09:00','summer',10,200),row('late-time','2026-10-15','16:00','sandy',30,300)]);
  sh.getRange(8,headers.indexOf('總金額')+1,4,1).setFormulas(Array.from({length:4},(_,i)=>['=SUM('+columnLetter_(headers.indexOf('試做價')+1)+(8+i)+':'+columnLetter_(headers.indexOf('開單金額')+1)+(8+i)+')']));
  const external=ss.insertSheet('External');external.getRange('A1').setFormula("=COUNTA('Synthetic Arrivals'!U8:U11)");external.getRange('B1').setFormula("=SUM('Synthetic Arrivals'!"+columnLetter_(headers.indexOf('試做價')+1)+"8:"+columnLetter_(headers.indexOf('開單金額')+1)+"11)");
  const before=oa3RowSnapshot_(sh);oa2QueueLayout_(sh,false);sh.insertColumnsBefore(1,2);sh.getRange(7,1,1,2).setValues([['品牌','電話']]);
  const layout=oa2QueueLayout_(sh,false);if(layout.csColumn!==4||layout.columns[19]!==23)throw new Error('New display layout mapping failed.');
  const afterInsert=oa3RowSnapshot_(sh);if(JSON.stringify(before)!==JSON.stringify(afterInsert))throw new Error('Native insertion changed retained data.');
  oa3SortArrival_(sh);const order=sh.getRange(8,layout.columns[19],4,1).getValues().flat();if(JSON.stringify(order)!==JSON.stringify(['early-time','late-time','later','undated']))throw new Error('Native date/time/undated ordering failed.');
  const after=oa3RowSnapshot_(sh);if(Object.keys(before).some(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])))throw new Error('Native sort changed colleague data.');
  SpreadsheetApp.flush();if(external.getRange('A1').getValue()!==4)throw new Error('External owner formula changed.');
  if(external.getRange('B1').getValue()!==1060)throw new Error('External amount formula changed.');
  if(oa3SortArrival_(sh).sorted!==0)throw new Error('Repeat sorting must be idempotent.');
  const result={passed:true,assertions:8,syntheticOnly:true,spreadsheet:ss.getUrl(),sortedOwnership:order,manualZeroPreserved:true,externalReferencesPreserved:true};console.log(JSON.stringify(result));return result;
}

function installArrivalSyncButton20261013() {
  const sh = oa2Spreadsheet_().getSheetByName(OA2.ARRIVAL);
  const obsolete = sh.getImages().filter(image =>
    image.getAltTextTitle() === '手動同步已預約' &&
    image.getScript() === 'syncAllBookedArrivals');
  obsolete.forEach(image => image.remove());
  onOpen();
  const result = {menu: 'CS 工具', item: '手動同步已預約', handler: 'syncAllBookedArrivals', removedFloatingButtons: obsolete.length};
  console.log(JSON.stringify(result));
  return result;
}

function verifyArrivalWorkflow20261013() {
  const ss=oa2Spreadsheet_(),sh=ss.getSheetByName(OA2.ARRIVAL),headers=oa2Header_(sh,OA2.HEADER_ROW),layout=oa2QueueLayout_(sh,false),props=PropertiesService.getDocumentProperties();
  const n=Math.max(0,sh.getLastRow()-OA2.FIRST_ROW+1),raw=n?sh.getRange(OA2.FIRST_ROW,1,n,headers.length).getValues():[],column=h=>headers.indexOf(h),reg=oa2ReadRegistry_(ss).appointments,sources=oa3Sources_(ss),aliases=oa3Aliases_(ss),image=sh.getImages().find(i=>i.getAltTextTitle()==='手動同步已預約');
  let records=0,unknown=0,ownerMismatch=0,unsorted=0,idOnly=0,previous='';
  raw.forEach((r,i)=>{const id=oa2Text_(r[column('Appointment ID')]),a=reg[id],key=oa3SortKey_(r[column('預約日期')],r[column('時間')],id,i,r[column('結果')]);if(i&&key<previous)unsorted++;previous=key;if(!id)return;records++;if(!a||a.queueId!==oa2Text_(r[column('到店紀錄ID（內部）')])||a.leadId!==oa2Text_(r[column('Omni Lead ID')])){unknown++;return;}const src=oa3ResolveSource_(a,sources,aliases);if(src&&src.cs&&src.appointmentId===id&&oa2Text_(r[column('CS同事名')])!==src.cs)ownerMismatch++;if(/識別待核對/.test(oa2Text_(r[column('客人／預約')])))idOnly++;});
  const result={enabled:props.getProperty('ARRIVAL_WORKFLOW_V3_ENABLED')==='1',maintenancePending:props.getProperty('ARRIVAL_WORKFLOW_V3_MAINTENANCE_REQUESTED')==='1',brandPhoneSeparate:headers[0]==='品牌'&&headers[1]==='電話',csColumn:layout.csColumn,records,unknownBindings:unknown,ownerMismatches:ownerMismatch,idOnlyLabels:idOnly,unsortedPairs:unsorted,buttonInstalled:!!image,buttonHandler:image?image.getScript():null};console.log(JSON.stringify(result));return result;
}


/** Optional display-only Advanced Sheets adapter; native raw reads remain authoritative. */
function oa3ManualApiRange_(name,columns) {
  const quoted="'"+String(name).replace(/'/g,"''")+"'";
  return columns?quoted+'!'+columns:quoted;
}
function oa3ManualApiMatrix_(valueRange) {
  const values=valueRange&&valueRange.values||[];
  if(!Array.isArray(values)||values.some(row=>!Array.isArray(row)))throw new Error('Invalid spreadsheet display response; safe retry required.');
  const width=values.reduce((n,row)=>Math.max(n,row.length),1);
  if(!values.length)return [['']];
  return values.map(row=>Array.from({length:width},(_,i)=>row[i]===undefined||row[i]===null?'':String(row[i])));
}
/** Formatted strings are for discovery only. Any getValues call delegates to the real sheet. */
function oa3ManualApiSheet_(ss,name,data) {
  const memory=oa3ManualMemorySheet_(data,name);let nativeSheet;
  const real=()=>{if(!nativeSheet)nativeSheet=ss.getSheetByName(name);if(!nativeSheet)throw new Error('Missing spreadsheet tab for native read.');return nativeSheet;};
  return {
    getName:()=>name,getLastRow:memory.getLastRow,getLastColumn:memory.getLastColumn,getMaxColumns:memory.getMaxColumns,
    getDataRange:()=>({getDisplayValues:()=>data.map(row=>row.slice()),getValues:()=>real().getDataRange().getValues()}),
    getRange:(row,column,height,columns)=>({getDisplayValues:()=>memory.getRange(row,column,height,columns).getDisplayValues(),getValues:()=>real().getRange(row,column,height,columns).getValues()})
  };
}
/** No credentials or customer values are logged. Missing Advanced Service keeps the native route. */
function oa3ManualBatchDisplayContext_(ss,timings,prefix,includeRegistry) {
  const names=[OA2.ARRIVAL].concat(OMNI_ACCOUNT_TABS),metrics=timings||{},phase=prefix||'display';
  if(includeRegistry)names.push(OA2.LEDGER);
  if(typeof Sheets==='undefined'){console.log(JSON.stringify({handler:'manual_missing_read_engine',readEngine:'native',rangeCount:names.length}));return {spreadsheet:ss,readEngine:'native',rangeCount:names.length};}
  if(!Sheets||!Sheets.Spreadsheets||!Sheets.Spreadsheets.Values||typeof Sheets.Spreadsheets.Values.batchGet!=='function')throw new Error('Advanced Sheets display service is not configured correctly.');
  const ranges=names.map(name=>oa3ManualApiRange_(name,name===OA2.LEDGER?'A:E':''));
  const response=oa3ManualPhase_(metrics,phase+'ApiBatchMs',()=>Sheets.Spreadsheets.Values.batchGet(ss.getId(),{ranges,majorDimension:'ROWS',valueRenderOption:'FORMATTED_VALUE'}));
  if(!response||!Array.isArray(response.valueRanges)||response.valueRanges.length!==ranges.length)throw new Error('Incomplete spreadsheet display response; safe retry required.');
  const sheets=new Map();names.forEach((name,i)=>sheets.set(name,oa3ManualApiSheet_(ss,name,oa3ManualApiMatrix_(response.valueRanges[i]))));
  const spreadsheet={getId:()=>ss.getId(),getSheetByName:name=>sheets.has(name)?sheets.get(name):ss.getSheetByName(name)};
  console.log(JSON.stringify({handler:'manual_missing_read_engine',readEngine:'sheets_api',rangeCount:names.length}));
  return {spreadsheet,readEngine:'sheets_api',rangeCount:names.length};
}

/** Metadata-only audit. Counts never disclose editor identities or sheet names. */
function oa3ManualEditorsAccessSummary_(sheets) {
  if(!Array.isArray(sheets))throw new Error('Invalid spreadsheet protection response.');
  const relevant=OMNI_ACCOUNT_TABS.map((title,accountIndex)=>({title,role:'source',accountIndex})).concat([{title:OA2.ARRIVAL,role:'arrival',accountIndex:-1},{title:OA2.LEDGER,role:'registry',accountIndex:-1},{title:OA2.HISTORY,role:'history',accountIndex:-1}]);
  const byTitle=new Map();sheets.forEach(sheet=>{const title=sheet&&sheet.properties&&sheet.properties.title;if(!relevant.some(item=>item.title===title))return;if(byTitle.has(title))throw new Error('Duplicate relevant sheet in protection response.');byTitle.set(title,sheet);});
  const details=relevant.map(item=>{
    const sheet=byTitle.get(item.title),ranges=sheet&&sheet.protectedRanges||[];if(!Array.isArray(ranges))throw new Error('Invalid protected-range response.');
    const users=new Set(),groups=new Set(),summary={role:item.role,accountIndex:item.accountIndex,present:!!sheet,protectedRangeCount:ranges.length,warningOnlyRanges:0,restrictedRanges:0,sheetProtectionRanges:0,rangeProtectionRanges:0,unknownScopeRanges:0,unprotectedRangeCount:0,editorUserCount:0,editorGroupCount:0,domainEditableRanges:0,editorDetailsUnavailableRanges:0,currentUserBlockedRanges:0,currentUserPermissionUnknownRanges:0};
    ranges.forEach(range=>{
      const grid=range.range;if(!grid)summary.unknownScopeRanges++;else if(['startRowIndex','endRowIndex','startColumnIndex','endColumnIndex'].every(key=>grid[key]===undefined))summary.sheetProtectionRanges++;else summary.rangeProtectionRanges++;
      summary.unprotectedRangeCount+=(range.unprotectedRanges||[]).length;
      if(range.warningOnly===true){summary.warningOnlyRanges++;return;}summary.restrictedRanges++;
      if(range.requestingUserCanEdit===false)summary.currentUserBlockedRanges++;else if(range.requestingUserCanEdit!==true)summary.currentUserPermissionUnknownRanges++;
      if(!range.editors){summary.editorDetailsUnavailableRanges++;return;}
      (range.editors.users||[]).forEach(value=>users.add(String(value).trim().toLowerCase()));(range.editors.groups||[]).forEach(value=>groups.add(String(value).trim().toLowerCase()));
      if(range.editors.domainUsersCanEdit===true)summary.domainEditableRanges++;
    });
    summary.editorUserCount=users.size;summary.editorGroupCount=groups.size;return summary;
  });
  return {readOnly:true,changesMade:false,relevantSheetCount:details.length,missingRelevantSheets:details.filter(row=>!row.present).length,totalProtectedRanges:details.reduce((n,row)=>n+row.protectedRangeCount,0),warningOnlyRanges:details.reduce((n,row)=>n+row.warningOnlyRanges,0),restrictedRanges:details.reduce((n,row)=>n+row.restrictedRanges,0),currentUserBlockedRanges:details.reduce((n,row)=>n+row.currentUserBlockedRanges,0),editorDetailsUnavailableRanges:details.reduce((n,row)=>n+row.editorDetailsUnavailableRanges,0),details};
}
function auditManualEditorsAccessFast() {
  if(typeof Sheets==='undefined'||!Sheets||!Sheets.Spreadsheets||typeof Sheets.Spreadsheets.get!=='function')throw new Error('Enable the Advanced Sheets service before the protection audit.');
  const started=Date.now(),ss=oa2Spreadsheet_(),fields='sheets(properties(sheetId,title),protectedRanges(range,warningOnly,requestingUserCanEdit,editors(users,groups,domainUsersCanEdit),unprotectedRanges))';
  const response=Sheets.Spreadsheets.get(ss.getId(),{fields,includeGridData:false});
  const result=oa3ManualEditorsAccessSummary_(response&&response.sheets);result.readEngine='sheets_api';result.elapsedMs=Date.now()-started;
  console.log(JSON.stringify(Object.assign({handler:'manual_editors_access_audit'},result)));return result;
}

/** This binding is created only from the governed bound container, never a client ID. */
function oa3ManualBinding_(raw,scriptId) {
  let value;try{value=JSON.parse(raw||'null');}catch(ignored){}
  if(!value||value.version!==1||typeof value.scriptId!=='string'||typeof value.spreadsheetId!=='string'||!value.spreadsheetId||!/^[A-Za-z0-9_-]+$/.test(value.spreadsheetId)||value.scriptId!==scriptId)throw new Error('Manual sync container binding is missing or does not match this project; run the verified binding setup.');
  return value;
}
function prepareManualArrivalBindingFast() {
  const timings={},props=oa3ManualPhase_(timings,'startupPropertiesMs',()=>PropertiesService.getDocumentProperties()),scriptId=oa3ManualPhase_(timings,'startupScriptIdMs',()=>ScriptApp.getScriptId());
  const current=oa3ManualPhase_(timings,'bindingCurrentContainerMs',()=>oa2Spreadsheet_()),spreadsheetId=current&&current.getId();
  if(typeof spreadsheetId!=='string'||!/^[A-Za-z0-9_-]+$/.test(spreadsheetId))throw new Error('No verified bound spreadsheet is available for manual sync.');
  const key='ARRIVAL_MANUAL_CONTAINER_BINDING_V1',raw=props.getProperty(key);
  if(raw){const existing=oa3ManualBinding_(raw,scriptId);if(existing.spreadsheetId!==spreadsheetId)throw new Error('The saved manual sync binding differs from the current container; preserving it for review.');}
  else props.setProperty(key,JSON.stringify({version:1,scriptId,spreadsheetId}));
  const receipt={prepared:true,created:!raw,timings};console.log(JSON.stringify(Object.assign({handler:'manual_container_binding'},receipt)));return receipt;
}
/** Cached identity serves API discovery; native access opens only the verified project binding. */
function oa3ManualStartup_(timings) {
  const metrics=timings||{},props=oa3ManualPhase_(metrics,'startupPropertiesMs',()=>PropertiesService.getDocumentProperties()),scriptId=oa3ManualPhase_(metrics,'startupScriptIdMs',()=>ScriptApp.getScriptId());
  const binding=oa3ManualPhase_(metrics,'startupBindingMs',()=>oa3ManualBinding_(props.getProperty('ARRIVAL_MANUAL_CONTAINER_BINDING_V1'),scriptId));let nativeSpreadsheet;
  const real=()=>{
    if(!nativeSpreadsheet)nativeSpreadsheet=oa3ManualPhase_(metrics,'nativeContainerOpenMs',()=>{const spreadsheet=SpreadsheetApp.openById(binding.spreadsheetId);if(!spreadsheet||spreadsheet.getId()!==binding.spreadsheetId)throw new Error('Native manual sync container identity does not match its verified binding.');return spreadsheet;});
    return nativeSpreadsheet;
  };
  return {props,spreadsheet:{getId:()=>binding.spreadsheetId,getSheetByName:name=>real().getSheetByName(name),toast:(...args)=>real().toast(...args)}};
}

/** Read-only rejection only: API raw identities can defer a gap, never authorize a write. */
function oa3ManualRawGapPrefilter_(ss,selection,timings,prefix) {
  const gaps=selection.items.filter(item=>item.kind==='schedule_gap');
  if(!gaps.length||typeof Sheets==='undefined')return selection;
  if(!Sheets||!Sheets.Spreadsheets||!Sheets.Spreadsheets.Values||typeof Sheets.Spreadsheets.Values.batchGet!=='function')throw new Error('Advanced Sheets identity service is not configured correctly.');
  const ranges=gaps.map(item=>oa3ManualApiRange_(item.snap.account,'A'+item.record.row+':'+columnLetter_(item.snap.width)+item.record.row));
  const response=oa3ManualPhase_(timings||{},(prefix||'display')+'RawGapIdentityMs',()=>Sheets.Spreadsheets.Values.batchGet(ss.getId(),{ranges,majorDimension:'ROWS',valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'}));
  if(!response||!Array.isArray(response.valueRanges)||response.valueRanges.length!==gaps.length)throw new Error('Incomplete spreadsheet identity response; safe retry required.');
  const rejected=new Set(),reviews=[];let unfillableCount=0;
  response.valueRanges.forEach((range,index)=>{
    const rows=range&&range.values||[];
    if(!Array.isArray(rows)||rows.some(row=>!Array.isArray(row))||rows.length>1)throw new Error('Invalid spreadsheet identity response; safe retry required.');
    const item=gaps[index],s=item.snap,r=item.record,q=item.queue,row=rows[0];
    // A row moved or changed between discovery and this raw read stays eligible
    // for the existing locked/native guards; it cannot be rejected from stale IDs.
    if(!row||oa2Text_(row[s.meta-1])!==r.leadId||oa2Text_(row[s.meta])!==r.appointmentId)return;
    const missingDate=!oa2Text_(q.date),missingTime=!oa2Text_(q.time);
    const dateUnavailable=Number.isInteger(s.c.APPOINTMENT_DATE)&&oa3ManualRawGapUnavailable_(row[s.c.APPOINTMENT_DATE-1],'date'),timeUnavailable=Number.isInteger(s.c.APPOINTMENT_TIME)&&oa3ManualRawGapUnavailable_(row[s.c.APPOINTMENT_TIME-1],'time');
    // Invalid raw text cannot fill a missing queue dimension. Native Date/number
    // values remain conservative candidates; this route never constructs Dates.
    if((!missingDate||dateUnavailable)&&(!missingTime||timeUnavailable)){rejected.add(item);selection.skipped++;unfillableCount++;return;}
    const rawPhone=row[s.c.PHONE-1],rawEmail=row[s.c.EMAIL-1],rawSocial=row[s.c.SOCIAL_USERNAME-1];
    const phone=(typeof rawPhone==='string'||typeof rawPhone==='number'&&Number.isFinite(rawPhone))?last8_(rawPhone):'';
    // String identity cells have identical native/API values, including an
    // unusable short phone with empty email/social. Unsupported inputs stay raw.
    const fullKeyKnown=typeof rawPhone==='string'&&typeof rawEmail==='string'&&typeof rawSocial==='string';
    const key=phone?r.account+'|p:'+phone:fullKeyKnown?oa2CustomerKey_(row,s.c,r.account):'';
    const leadMismatch=!!r.leadId&&oa2Text_(q.raw[23])!==r.leadId,accountMismatch=q.account!==r.account,keyMismatch=(!!phone||fullKeyKnown)&&q.customerKey!==key;
    if(!leadMismatch&&!accountMismatch&&!keyMismatch)return;
    rejected.add(item);reviews.push(item);
  });
  const prior={reviewItems:reviews,reviewCount:reviews.length};selection.items=selection.items.filter(item=>!rejected.has(item));oa3ManualMergeReviews_(selection,prior);
  console.log(JSON.stringify({handler:'manual_raw_gap_identity',candidateGapCount:gaps.length,deferredCount:reviews.length,unfillableCount}));return selection;
}
/** A source/queue position is one review even when both raw discovery passes reject it. */
function oa3ManualMergeReviews_(selection,prior) {
  const own=selection.reviewItems||[],other=prior.reviewItems||[],seen=new Set(),merged=[];
  own.concat(other).forEach(item=>{const key=item.record.account+'|'+item.record.row+'|'+(item.queue?item.queue.row:'');if(!seen.has(key)){seen.add(key);merged.push(item);}});
  const unlisted=Math.max(0,(selection.reviewCount||0)-own.length)+Math.max(0,(prior.reviewCount||0)-other.length);
  selection.reviewItems=merged;selection.reviewCount=merged.length+unlisted;return selection;
}

/** Only native-equivalent raw strings prove a field unusable; numbers remain uncertain. */
function oa3ManualRawGapUnavailable_(value,kind) {
  if(typeof value!=='string')return false;
  if(!oa2Text_(value))return true;
  // ISO timestamp strings use native timezone formatting in oa2Date_; leave them
  // for the existing raw writer instead of doing native work during discovery.
  if(kind==='date'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(oa2Text_(value)))return false;
  return kind==='date'?!oa2Date_(value):!oa2Time_(value);
}
