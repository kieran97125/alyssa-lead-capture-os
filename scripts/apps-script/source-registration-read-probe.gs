/** Read-only operational probe. No identifiers, contact values or cell payloads are logged. */
function diagnoseSourceRegistrationReadOnly20261117() {
  const started = Date.now(), ss = oa2Spreadsheet_();
  const discovery = oa2IdentityDiscovery_(ss);
  const evidence = oa2IdentityEvidence_(discovery, oa2ReadRegistry_(ss).appointments);
  const accounts = [], pending = [];
  let previewSequence = 0;
  OMNI_ACCOUNT_TABS.forEach((account, accountIndex) => {
    try {
      const snapshot = oa3ManualAccountSnapshot_(ss.getSheetByName(account), account, new Map());
      const candidates = snapshot.records.filter(oa2IdentityCandidate_);
      accounts.push({accountIndex, sourceRows:snapshot.records.length, candidates:candidates.length});
      candidates.forEach(record => {
        const decision = oa2ResolveMissingLeadIdentity_(record, evidence, () => 'preview_only_' + (++previewSequence));
        pending.push({accountIndex, sourceRow:record.row, status:oa2Status_(record.status),
          leadRegistered:!!record.leadId, appointmentLinked:!!record.appointmentId,
          scheduled:!!oa2Text_(record.date), confirmationPresent:!!oa2Text_(record.confirmedAt),
          recoveryPending:!!record.pendingSnapshot, action:decision.action, reason:decision.reason});
      });
    } catch (ignored) {
      accounts.push({accountIndex, unavailable:true});
    }
  });
  const properties = PropertiesService.getScriptProperties();
  const result = {readOnly:true, completed:discovery.identityComplete&&!accounts.some(account=>account.unavailable), identityComplete:discovery.identityComplete,
    accounts, pending, enabled:oa2Enabled_(),
    foregroundLeaseActive:omniArrivalManualLeaseActive_(), maintenancePaused:omniArrivalTimerMaintenanceActive_(),
    staffPriorityActive:omniStaffPriorityActive_(), cursor:Number(properties.getProperty(OA2.CURSOR)||0),
    timerHandlers:ScriptApp.getProjectTriggers().map(trigger=>trigger.getHandlerFunction()),
    elapsedMs:Date.now()-started};
  console.log(JSON.stringify(result));
  return result;
}

/** Read-only provider path: avoids opening the native container or changing transport flags. */
function diagnoseRegistrationBridgeReadOnly20261117() {
  const started=Date.now(), props=PropertiesService.getDocumentProperties();
  const binding=oa3ManualBinding_(props.getProperty('ARRIVAL_MANUAL_CONTAINER_BINDING_V1'),ScriptApp.getScriptId());
  console.log(JSON.stringify({readOnly:true,phase:'bridge_api_read',state:'started'}));
  const response=Sheets.Spreadsheets.Values.batchGet(binding.spreadsheetId,{
    ranges:["'_metric_identity_bridge'!A1:H30000","'lead'!A1:Z29998"],
    valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});
  const bridge=response.valueRanges[0].values||[], master=response.valueRanges[1].values||[], headers=master[0]||[];
  const pending=bridge.slice(1).filter(row=>!row[0]&&row[6]===true).map(row=>{
    const source=master[row[2]-1]||[], account=String(row[1]||'').split('|')[0];
    return {masterRow:row[2],accountIndex:OMNI_ACCOUNT_TABS.indexOf(account),
      status:oa2Status_(source[headers.indexOf('跟進狀態')]),
      scheduled:!!source[headers.indexOf('預約日期')],confirmationPresent:!!source[headers.indexOf('確認到店日期')],
      identity:row[1]};
  });
  const accounts=[...new Set(pending.map(row=>row.accountIndex).filter(index=>index>=0))];
  const sourcePositions=[];
  if(accounts.length){
    console.log(JSON.stringify({readOnly:true,phase:'source_api_read',accounts:accounts.length}));
    const raw=Sheets.Spreadsheets.Values.batchGet(binding.spreadsheetId,{
      ranges:accounts.map(index=>"'"+OMNI_ACCOUNT_TABS[index].replace(/'/g,"''")+"'!A:AE"),
      valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});
    raw.valueRanges.forEach((range,index)=>{
      const accountIndex=accounts[index], values=range.values||[], head=values[0]||[], phone=head.indexOf('電話'), lead=head.indexOf('Omni Lead ID');
      values.slice(1).forEach((row,rowIndex)=>{
        if(row[lead])return;
        const key=OMNI_ACCOUNT_TABS[accountIndex]+'|p:'+String(row[phone]||'').replace(/\D/g,'').slice(-8);
        const matches=pending.filter(item=>item.accountIndex===accountIndex&&item.identity===key);
        if(matches.length)sourcePositions.push({accountIndex,sourceRow:rowIndex+2,masterRows:matches.map(item=>item.masterRow),
          appointmentLinked:!!row[head.indexOf('Appointment ID')],recoveryPending:!!row[head.indexOf('Pending Appointment Snapshot')],
          status:oa2Status_(row[head.indexOf('跟進狀態')])});
      });
    });
  }
  const result={readOnly:true,bridgeRows:bridge.length-1,masterRows:master.length-1,
    pending:pending.map(({identity,...safe})=>safe),sourcePositions,elapsedMs:Date.now()-started};
  console.log(JSON.stringify(result));return result;
}
