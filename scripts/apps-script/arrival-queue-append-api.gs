/** Explicit opt-in. No fallback after an API read/write has an unknown result.
 * Official contracts: spreadsheets.get GridData/userEnteredValue; batchUpdate
 * UpdateCellsRequest, RepeatCellRequest, SetDataValidationRequest. Values use
 * ExtendedValue, civil dates since 1899-12-30, and the existing HKT policy.
 * Canonical commit still owns source CAS, registry, history and recovery intents.
 */
var OA2_QUEUE_APPEND_API_ENABLED=false;
function oa2AppendApiValue_(value) {
  if(value===null||value===undefined||value==='')return {};
  if(value instanceof Date){
    if(isNaN(value.getTime()))throw new Error('Invalid instant.');
    const civil=Utilities.formatDate(value,OA2.TZ,"yyyy-MM-dd'T'HH:mm:ss.SSS"),m=civil.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
    if(!m)throw new Error('Invalid civil timestamp.');
    return {numberValue:(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],+m[7])-Date.UTC(1899,11,30))/86400000};
  }
  if(typeof value==='number'){if(!isFinite(value))throw new Error('Invalid number.');return {numberValue:value};}
  if(typeof value==='boolean')return {boolValue:value};
  if(typeof value==='string')return {stringValue:value};
  throw new Error('Unsupported cell value.');
}
function oa2AppendApiDay_(value) {
  if(!oa2Text_(value))return '';
  const day=oa2Date_(value),m=day.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)throw new Error('Invalid appointment day.');
  return (Date.UTC(+m[1],+m[2]-1,+m[3])-Date.UTC(1899,11,30))/86400000;
}
function oa2AppendApiCell_(value) {const entered=oa2AppendApiValue_(value);return Object.keys(entered).length?{userEnteredValue:entered}:{};}
function oa2AppendApiAssociation_(layout,row) {
  const cell=n=>oa2QueueCell_(layout,n,row);
  return '=IF('+cell(1)+'="","",'+cell(17)+'&"|"&IF('+cell(2)+'="","待填日期",TEXT('+cell(2)+',"yyyy-mm-dd"))&"|"&IF('+cell(3)+'="","未填時間",TEXT('+cell(3)+',"hh:mm")))';
}
function oa2AppendApiRange_(sheetId,row,height,column,width) {return {sheetId,startRowIndex:row-1,endRowIndex:row-1+height,startColumnIndex:column-1,endColumnIndex:column-1+width};}
function oa2AppendApiRequests_(sheetId,items) {
  const rows=new Map();items.forEach(item=>{if(!rows.has(item.row))rows.set(item.row,[]);rows.get(item.row).push(item);});
  const blocks=[];Array.from(rows.keys()).sort((a,b)=>a-b).forEach(row=>{
    let block;rows.get(row).sort((a,b)=>a.column-b.column).forEach(item=>{
      if(block&&item.column===block.column+block.cells.length)block.cells.push(item.cell);
      else{block={row,column:item.column,cells:[item.cell]};blocks.push(block);}
    });
  });
  const grouped=[];blocks.forEach(block=>{
    const group=grouped.find(g=>g.column===block.column&&g.width===block.cells.length&&g.rows[g.rows.length-1].row+1===block.row);
    if(group)group.rows.push(block);else grouped.push({column:block.column,width:block.cells.length,rows:[block]});
  });
  return grouped.map(group=>({updateCells:{start:{sheetId,rowIndex:group.rows[0].row-1,columnIndex:group.column-1},rows:group.rows.map(row=>({values:row.cells})),fields:'userEnteredValue'}}));
}
function oa2AppendApiRead_(spreadsheetId,rows,previous) {
  const quoted="'"+OA2.ARRIVAL.replace(/'/g,"''")+"'",groups=oa2RowGroups_(rows.map(row=>({row}))),ranges=[quoted+'!'+OA2.HEADER_ROW+':'+OA2.HEADER_ROW];
  if(previous)groups.forEach(group=>ranges.push(quoted+'!A'+group[0].row+':'+columnLetter_(previous.columns)+group[group.length-1].row));
  const response=Sheets.Spreadsheets.get(spreadsheetId,{ranges,includeGridData:true,
    fields:'properties(timeZone),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),data(startRow,startColumn,rowData(values(userEnteredValue))))'});
  const sheets=response&&response.sheets,matching=Array.isArray(sheets)?sheets.filter(sheet=>sheet.properties&&sheet.properties.title===OA2.ARRIVAL):[];
  if(!response.properties||response.properties.timeZone!==OA2.TZ||matching.length!==1)throw new Error('API workbook context is not verified.');
  const sheet=matching[0],properties=sheet.properties,grid=properties.gridProperties,data=sheet.data||[];
  if(!Number.isInteger(properties.sheetId)||properties.sheetId<0||!grid||!Number.isInteger(grid.rowCount)||grid.rowCount<OA2.HEADER_ROW||!Number.isInteger(grid.columnCount)||grid.columnCount<1)throw new Error('API grid metadata is incomplete.');
  const header=data.find(block=>(block.startRow||0)===OA2.HEADER_ROW-1&&(block.startColumn||0)===0);
  if(!header||!Array.isArray(header.rowData)||!header.rowData.length)throw new Error('API header is incomplete.');
  const headers=(header.rowData[0].values||[]).map(cell=>cell.userEnteredValue&&cell.userEnteredValue.stringValue||'');
  const memory={getLastColumn:()=>headers.length,getMaxColumns:()=>grid.columnCount,getRange:()=>({getDisplayValues:()=>[headers.slice()]})};
  const layout=oa2QueueLayout_(memory,false);
  if(headers.length>grid.columnCount||layout.width>grid.columnCount)throw new Error('API header exceeds its grid.');
  if(previous&&(properties.sheetId!==previous.sheetId||grid.columnCount!==previous.columns||JSON.stringify(headers)!==JSON.stringify(previous.headers)))throw new Error('Queue layout changed during API writing.');
  const snapshots=new Map();
  if(previous)groups.forEach(group=>{
    const block=data.find(block=>(block.startRow||0)===group[0].row-1&&(block.startColumn||0)===0);
    if(!block)throw new Error('API target coverage is incomplete.');
    const values=block.rowData||[];if(values.length>group.length)throw new Error('API target coverage is invalid.');
    group.forEach((item,index)=>{
      const cells=values[index]&&values[index].values||[];if(cells.length>grid.columnCount)throw new Error('API target width is invalid.');
      snapshots.set(item.row,Array.from({length:grid.columnCount},(_,column)=>cells[column]&&cells[column].userEnteredValue||{}));
    });
  });
  return {sheetId:properties.sheetId,columns:grid.columnCount,rowCount:grid.rowCount,headers,layout,snapshots};
}
function oa2AppendApiScalar_(value) {
  if(value.formulaValue!==undefined)throw new Error('A queue input formula requires review.');
  return value.stringValue!==undefined?value.stringValue:value.numberValue!==undefined?value.numberValue:value.boolValue!==undefined?value.boolValue:'';
}
function oa2AppendApiInput_(values) {
  const raw=values.map(oa2AppendApiScalar_),day=value=>{const normalized=oa2Date_(value);if(oa2Text_(value)&&!normalized)throw new Error('Invalid queue day.');return normalized;},time=oa2Time_(raw[1]);
  if(oa2Text_(raw[1])&&!time)throw new Error('Invalid queue time.');
  return JSON.stringify([day(raw[0]),time,oa2Text_(raw[2]),day(raw[3])]);
}
/** Read through the API before its first queue mutation. Native write caching
 * must never let a queue payload precede its durable registry recovery intent.
 * Failure is explicit; this fence never flushes or falls back to native writes.
 */
function oa2AppendApiRawSheets_(spreadsheetId,ranges) {
  const response=Sheets.Spreadsheets.get(spreadsheetId,{ranges,includeGridData:true,fields:'sheets(properties(title,gridProperties(rowCount)),data(startRow,startColumn,rowData(values(userEnteredValue))))'});
  if(!response||!Array.isArray(response.sheets))throw new Error('Durable receipt is incomplete.');
  return response.sheets;
}
function oa2AppendApiReceiptSheet_(sheets,title) {
  const matching=sheets.filter(sheet=>sheet.properties&&sheet.properties.title===title);
  if(matching.length!==1)throw new Error('Durable receipt context is not verified.');return matching[0];
}
function oa2AppendApiReceiptRow_(sheet,row,column,width) {
  const block=(sheet.data||[]).find(block=>(block.startRow||0)<=row-1&&(block.startRow||0)+(block.rowData||[]).length>row-1&&(block.startColumn||0)===column-1);
  if(!block)throw new Error('Durable receipt coverage is incomplete.');
  const cells=block.rowData[row-1-(block.startRow||0)].values||[];
  if(cells.length>width)throw new Error('Durable receipt width changed.');
  return Array.from({length:width},(_,index)=>cells[index]&&cells[index].userEnteredValue||{});
}
function oa2AppendApiReceiptEqual_(actual,expected) {
  return expected.length===actual.length&&expected.every((value,index)=>{
    const fresh=actual[index],keys=Object.keys(value),freshKeys=Object.keys(fresh);
    return keys.length===1&&keys[0]==='numberValue'&&freshKeys.length===1&&freshKeys[0]==='numberValue'&&Math.abs(value.numberValue-fresh.numberValue)<1e-9||JSON.stringify(value)===JSON.stringify(fresh);
  });
}
function oa2AppendApiIntentFence_(spreadsheetId,ctx,operations,records,onPhase) {
  const stage=name=>{if(onPhase)onPhase(name);};stage('intent_scope');
  const rows=new Map(),sources=new Map(),quote=title=>"'"+title.replace(/'/g,"''")+"'",byLead={};
  (records||[]).forEach(record=>{if(!byLead[record.leadId])byLead[record.leadId]=[];byLead[record.leadId].push(record);});
  if(!Array.isArray(ctx.events))throw new Error('Durable journal scope is unavailable.');
  operations.forEach(op=>{
    const a=op.appt,row=ctx.rows&&ctx.rows[a.id],owners=byLead[a.leadId]||[];
    if(!Number.isInteger(row)||row<2||rows.has(row)||!oa2Text_(a.pendingQueueBefore)||owners.length!==1)throw new Error('Durable queue intent is unavailable.');
    const source=owners[0];if(!Number.isInteger(source.row)||source.row<2||source.account!==a.account||source.appointmentId!==a.id||source.customerKey!==a.customerKey||String(source.phone)!==String(a.phone))throw new Error('Durable source ownership is unavailable.');
    [a.bookedAt,a.outcomeAt].forEach(value=>{
      if(value===null||value===undefined||value==='')return;
      if(value instanceof Date){if(!isNaN(value.getTime()))return;}
      else if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)){
        const instant=new Date(value);if(!isNaN(instant.getTime())&&instant.toISOString()===value)return;
      }
      throw new Error('Registry timestamp requires review.');
    });
    rows.set(row,oa2LedgerRow_(a).map(oa2AppendApiValue_));
    if(!sources.has(source.account))sources.set(source.account,[]);sources.get(source.account).push({record:source,appt:a});
  });
  const groups=oa2RowGroups_(Array.from(rows.keys()).map(row=>({row}))),ranges=groups.map(group=>quote(OA2.LEDGER)+'!A'+group[0].row+':'+columnLetter_(OA2_FIELDS.length)+group[group.length-1].row);
  sources.forEach((items,account)=>ranges.push(quote(account)+'!1:1'));
  if(ctx.events.length)ranges.push(quote(OA2.HISTORY)+'!A1:H1');
  stage('intent_registry');
  const sheets=oa2AppendApiRawSheets_(spreadsheetId,ranges),registry=oa2AppendApiReceiptSheet_(sheets,OA2.LEDGER);
  rows.forEach((expected,row)=>{if(!oa2AppendApiReceiptEqual_(oa2AppendApiReceiptRow_(registry,row,1,OA2_FIELDS.length),expected))throw new Error('Registry recovery intent is not yet durable.');});
  const sourceRanges=[];
  sources.forEach((items,account)=>{
    const sheet=oa2AppendApiReceiptSheet_(sheets,account),header=(sheet.data||[]).find(block=>(block.startRow||0)===0&&(block.startColumn||0)===0),values=header&&header.rowData&&header.rowData[0]&&header.rowData[0].values||[];
    const labels=values.map(cell=>cell.userEnteredValue&&cell.userEnteredValue.stringValue||'');
    const memory={getName:()=>account,getLastColumn:()=>labels.length,getRange:()=>({getDisplayValues:()=>[labels.slice()]})};
    const column=oa2Meta_(memory,false);items.forEach(item=>{item.meta=column;sourceRanges.push(quote(account)+'!'+columnLetter_(column)+item.record.row+':'+columnLetter_(column+5)+item.record.row);});
  });
  stage('intent_source');const sourceSheets=oa2AppendApiRawSheets_(spreadsheetId,sourceRanges);
  sources.forEach((items,account)=>items.forEach(item=>{
    const a=item.appt,values=oa2AppendApiReceiptRow_(oa2AppendApiReceiptSheet_(sourceSheets,account),item.record.row,item.meta,6).map(oa2AppendApiScalar_);
    if(oa2Text_(values[0])!==a.leadId)throw new Error('Source Lead recovery intent is not durable.');
    if(oa2Text_(values[1])===a.id&&!oa2Text_(values[5]))return;
    let anchor;try{anchor=JSON.parse(values[5]);}catch(ignored){throw new Error('Source recovery anchor is not durable.');}
    if(!oa2ValidIdentityAnchor_(anchor,a.account))throw new Error('Source recovery anchor is not governed.');
    const owner=id=>{const value=ctx.appointments[id];return value&&value.leadId===a.leadId&&value.account===a.account;};
    if(!anchor.appointments.every(value=>owner(value.id))||!(anchor.events||[]).every(event=>{
      if(!owner(event[2]))return false;if(event[4]!=='state_checkpoint')return true;
      let checkpoint;try{checkpoint=JSON.parse(event[6]);}catch(ignored){return false;}
      return checkpoint&&checkpoint.id===event[2]&&checkpoint.leadId===a.leadId&&checkpoint.account===a.account;
    }))throw new Error('Source recovery anchor has an unrelated owner.');
    const intended=anchor.appointments.filter(value=>value.id===a.id);
    if(anchor.leadId!==a.leadId||anchor.currentAppointmentId!==a.id||intended.length!==1||!OA2_FIELDS.every(field=>JSON.stringify(intended[0][field]===undefined?'':intended[0][field])===JSON.stringify(a[field]===undefined?'':a[field])))throw new Error('Source recovery anchor does not match the intended appointment.');
  }));
  if(!ctx.events.length)return;
  stage('intent_journal_ids');const history=oa2AppendApiReceiptSheet_(sheets,OA2.HISTORY),header=oa2AppendApiReceiptRow_(history,1,1,OA2.HISTORY_HEADERS.length);
  if(!oa2AppendApiReceiptEqual_(header,OA2.HISTORY_HEADERS.map(oa2AppendApiValue_)))throw new Error('Journal receipt header changed.');
  const grid=history.properties.gridProperties,from=ctx.historyNextRow;
  if(!grid||!Number.isInteger(grid.rowCount)||!Number.isInteger(from)||from<2||ctx.events.length>OA2.BATCH*4)throw new Error('Journal receipt bound is unavailable.');
  const wanted=new Map();ctx.events.forEach(event=>{if(!Array.isArray(event)||event.length!==OA2.HISTORY_HEADERS.length||!event[0]||wanted.has(event[0]))throw new Error('Journal receipt identity is ambiguous.');wanted.set(event[0],event.map(oa2AppendApiValue_));});
  const found=new Map(),first=Math.max(2,from-4000),last=Math.min(grid.rowCount,from+ctx.events.length+500);
  if(last-first+1>5500)throw new Error('Journal receipt scope exceeds its bound.');
  const idGroups=[];for(let end=last;end>=first;end-=500)idGroups.push({start:Math.max(first,end-499),end});
  const idSheet=oa2AppendApiReceiptSheet_(oa2AppendApiRawSheets_(spreadsheetId,idGroups.map(group=>quote(OA2.HISTORY)+'!A'+group.start+':A'+group.end)),OA2.HISTORY);
  idGroups.forEach(group=>{
    const block=(idSheet.data||[]).find(block=>(block.startRow||0)===group.start-1&&(block.startColumn||0)===0);
    if(!block||(block.rowData||[]).length>group.end-group.start+1)throw new Error('Journal ID coverage is incomplete.');
    (block.rowData||[]).forEach((row,index)=>{const value=row.values&&row.values[0]&&row.values[0].userEnteredValue||{},id=oa2Text_(oa2AppendApiScalar_(value));if(!wanted.has(id))return;if(found.has(id))throw new Error('Journal ID has multiple durable owners.');found.set(id,group.start+index);});
  });
  if(found.size!==wanted.size)throw new Error('Required journal recovery intent is not yet durable.');
  stage('intent_journal_content');const eventGroups=oa2RowGroups_(Array.from(found.values()).map(row=>({row}))),eventSheets=oa2AppendApiRawSheets_(spreadsheetId,eventGroups.map(group=>quote(OA2.HISTORY)+'!A'+group[0].row+':H'+group[group.length-1].row)),eventSheet=oa2AppendApiReceiptSheet_(eventSheets,OA2.HISTORY);
  found.forEach((row,id)=>{if(!oa2AppendApiReceiptEqual_(oa2AppendApiReceiptRow_(eventSheet,row,1,OA2.HISTORY_HEADERS.length),wanted.get(id)))throw new Error('Required journal receipt content changed.');});
}
function oa2WriteQueueAppendApi_(ss,ctx,queue,operations,records) {
  if(ctx.dryRun)throw new Error('Dry run cannot write queue.');if(!operations.length)return {completed:true,rows:0,timings:{}};
  if(operations.length>OA2.BATCH||operations.some(op=>!['append','schedule_only'].includes(op.kind)))throw new Error('API queue batch is outside its supported scope.');
  const lock=LockService.getDocumentLock();if(!lock||!lock.hasLock())throw new Error('API queue writing requires the document lock.');
  if(typeof Sheets==='undefined'||!Sheets.Spreadsheets||typeof Sheets.Spreadsheets.get!=='function'||typeof Sheets.Spreadsheets.batchUpdate!=='function')throw new Error('Explicit API queue writer is unavailable.');
  const spreadsheetId=ss.getId(),timings={},stage=name=>{const started=Date.now();return value=>{timings[name]=Date.now()-started;console.log(JSON.stringify({handler:'arrival_queue_api_write',phase:name,elapsedMs:timings[name],rows:operations.length}));return value;};};
  let phase='intent_fence';
  try {
    let done=stage(phase);oa2AppendApiIntentFence_(spreadsheetId,ctx,operations,records,name=>phase=name);done();
    phase='header';done=stage(phase);let context=oa2AppendApiRead_(spreadsheetId,[],null);done();
    const rowIds=new Set(),owners={};Object.keys(ctx.appointments).forEach(id=>{const a=ctx.appointments[id];if(a.queueId){if(owners[a.queueId]&&owners[a.queueId]!==id)throw new Error('Duplicate registry queue owner.');owners[a.queueId]=id;}});
    operations.forEach(op=>{if(!Number.isInteger(op.row)||op.row<OA2.FIRST_ROW||rowIds.has(op.row)||ctx.appointments[op.appt.id]!==op.appt||!op.appt.queueId)throw new Error('Queue operation ownership is invalid.');rowIds.add(op.row);});
    const rows=Array.from(rowIds).sort((a,b)=>a-b),maximum=Math.max(...rows);
    const batch=(name,requests)=>{
      if(!requests.length)return;
      phase=name;const finish=stage(name),reply=Sheets.Spreadsheets.batchUpdate({requests,includeSpreadsheetInResponse:false},spreadsheetId);finish();
      if(!reply||reply.spreadsheetId!==spreadsheetId||!Array.isArray(reply.replies)||reply.replies.length!==requests.length)throw new Error('API write result is unconfirmed.');
    };
    if(maximum>context.rowCount){batch('capacity',[{appendDimension:{sheetId:context.sheetId,dimension:'ROWS',length:maximum-context.rowCount}}]);context=oa2AppendApiRead_(spreadsheetId,[],context);}
    phase='initial_cas';done=stage(phase);let current=oa2AppendApiRead_(spreadsheetId,rows,context);done();context=current;
    const columns=context.layout.columns,recordsByLead={};(records||[]).forEach(record=>recordsByLead[record.leadId]=record);
    const allocating=[],payload=[],managed=[],formats=[],expected=new Map(),alreadyManaged=new Set();
    const add=(list,row,logical,value,formula)=>list.push({row,column:columns[logical-1],cell:formula?{userEnteredValue:{formulaValue:value}}:oa2AppendApiCell_(value)});
    operations.forEach(op=>{
      const a=op.appt,physical=current.snapshots.get(op.row),raw=columns.map(column=>physical[column-1]),r=recordsByLead[a.leadId],q=queue.find(item=>item.row===op.row);
      const scalar=index=>oa2Text_(oa2AppendApiScalar_(raw[index]));
      const owned=scalar(19)===a.id&&scalar(25)==='allocating';
      expected.set(op.row,physical.map(value=>JSON.parse(JSON.stringify(value))));
      if(oa2Text_(a.time)&&!oa2Time_(a.time))throw new Error('Invalid authoritative time.');
      if(op.kind==='append') {
        const desired=JSON.stringify([a.date,a.time,oa2QueueStatus_(a),oa2QueueArrivalDate_(a)]);
        if(scalar(19)===a.id&&scalar(25)==='managed'&&scalar(17)===a.queueId&&scalar(23)===a.leadId&&scalar(7)===a.account&&scalar(16)===a.customerKey&&
          oa2AppendApiInput_(raw.slice(1,5))===desired&&JSON.stringify(raw.slice(19,26))===JSON.stringify(oa2QueueMetadata_(a,'managed',ctx).map(oa2AppendApiValue_))){alreadyManaged.add(op.row);return;}
        if(owned){
          if(scalar(23)!==a.leadId||scalar(17)&&scalar(17)!==a.queueId||scalar(16)&&scalar(16)!==a.customerKey||scalar(7)&&scalar(7)!==a.account)throw new Error('Allocating queue owner changed.');
          const actual=oa2AppendApiInput_(raw.slice(1,5)),blank=JSON.stringify(['','','','']);
          if(actual!==desired&&actual!==blank&&actual!==a.pendingQueueBefore)throw new Error('Staff changed an allocating outcome or schedule.');
          if(scalar(0)&&scalar(0)!==oa2QueueLabel_(a,r))throw new Error('Allocating display identity changed.');
        } else {
          if(raw.some((value,index)=>![6,17,18].includes(index)&&Object.keys(value).length))throw new Error('Queue append slot contains colleague or identity input.');
          if(Object.keys(raw[6]).length&&raw[6].formulaValue!==oa2QueueCheckFormula_(context.layout,op.row)||Object.keys(raw[18]).length&&raw[18].formulaValue!==oa2AppendApiAssociation_(context.layout,op.row))throw new Error('Queue system formula before-image changed.');
          if(scalar(17)&&(!q||q.entryId!==scalar(17)||scalar(17)!==a.queueId||owners[scalar(17)]&&owners[scalar(17)]!==a.id))throw new Error('Queue entry before-image changed.');
          const logical=new Set(columns),trial=context.headers.findIndex(header=>oa2Text_(header)==='試做價')+1,order=context.headers.findIndex(header=>oa2Text_(header)==='開單金額')+1;
          context.headers.forEach((header,index)=>{
            if(logical.has(index+1)||!Object.keys(physical[index]).length)return;
            const total=oa2Text_(header)==='總金額'&&trial>0&&order>0&&physical[index].formulaValue==='=SUM('+columnLetter_(trial)+op.row+':'+columnLetter_(order)+op.row+')';
            if(!total)throw new Error('Queue append slot contains colleague or financial input.');
          });
        }
        const marker=oa2QueueMetadata_(a,'allocating',ctx);marker.forEach((value,index)=>add(allocating,op.row,20+index,value));
        const values=[oa2QueueLabel_(a,r),oa2AppendApiDay_(a.date),a.time?oa2NativeTime_(a.time):'',oa2QueueStatus_(a),oa2AppendApiDay_(oa2QueueArrivalDate_(a)),owned?oa2AppendApiScalar_(raw[5]):''];
        values.forEach((value,index)=>add(payload,op.row,index+1,value));
        [a.account,a.name,oa2Text_(a.phone).slice(-4),a.treatment,a.branch,oa2AppendApiDay_(a.date),a.bookedAt?oa2AppendApiDay_(a.bookedAt):'',a.bookedAt?'正式登記時間（自動）':'舊預約：登記日期待核對'].forEach((value,index)=>add(payload,op.row,8+index,value));
        add(payload,op.row,17,a.customerKey);add(payload,op.row,18,a.queueId);
        add(payload,op.row,19,oa2AppendApiAssociation_(context.layout,op.row),true);
        add(payload,op.row,7,oa2QueueCheckFormula_(context.layout,op.row),true);
      } else {
        if(typeof op.state!=='string')throw new Error('Schedule-only state is not verified.');
        if(!q||q.origin!=='managed'||scalar(19)!==a.id||scalar(17)!==a.queueId||scalar(23)!==a.leadId||scalar(25)!=='managed'||scalar(7)!==a.account||scalar(16)!==a.customerKey||!r||r.appointmentId!==a.id||r.leadId!==a.leadId||r.account!==a.account||r.customerKey!==a.customerKey||!r.phone||String(r.phone)!==String(a.phone))throw new Error('Schedule-only ownership is not verified.');
        const before=q.raw.slice(1,5).map(value=>oa2AppendApiValue_(value));
        const oldInputs=oa2AppendApiInput_(before),actualInputs=oa2AppendApiInput_(raw.slice(1,5)),retained=JSON.parse(oldInputs),intendedInputs=JSON.stringify([a.date,a.time,retained[2],retained[3]]);
        if(actualInputs!==oldInputs&&!(a.pendingQueueBefore===oldInputs&&actualInputs===intendedInputs))throw new Error('Schedule-only colleague input changed.');
        add(payload,op.row,2,oa2AppendApiDay_(a.date));add(payload,op.row,3,a.time?oa2NativeTime_(a.time):'');
      }
      const metadata=oa2QueueMetadata_(a,'managed',ctx);if(op.kind==='schedule_only')metadata[2]=op.state;
      metadata.forEach((value,index)=>add(op.kind==='schedule_only'?payload:managed,op.row,20+index,value));
    });
    const apply=items=>items.forEach(item=>expected.get(item.row)[item.column-1]=item.cell.userEnteredValue||{});
    const check=name=>{
      phase=name;const finish=stage(name),fresh=oa2AppendApiRead_(spreadsheetId,rows,context);finish();
      rows.forEach(row=>{if(JSON.stringify(fresh.snapshots.get(row))!==JSON.stringify(expected.get(row)))throw new Error('Queue cells changed during API write; preserve for retry.');});
    };
    const activeOperations=operations.filter(op=>!alreadyManaged.has(op.row)),rowGroups=oa2RowGroups_(activeOperations.map(op=>({row:op.row,kind:op.kind})));
    rowGroups.forEach(group=>{
      const first=group[0].row,height=group.length;
      [23,25].forEach(logical=>formats.push({repeatCell:{range:oa2AppendApiRange_(context.sheetId,first,height,columns[logical-1],1),cell:{userEnteredFormat:{numberFormat:{type:'DATE_TIME',pattern:'yyyy-mm-dd hh:mm:ss'}}},fields:'userEnteredFormat.numberFormat'}}));
      formats.push({repeatCell:{range:oa2AppendApiRange_(context.sheetId,first,height,columns[1],1),cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'yyyy-mm-dd'}}},fields:'userEnteredFormat.numberFormat'}});
      formats.push({repeatCell:{range:oa2AppendApiRange_(context.sheetId,first,height,columns[2],1),cell:{userEnteredFormat:{numberFormat:{type:'TIME',pattern:'hh:mm'}}},fields:'userEnteredFormat.numberFormat'}});
    });
    oa2RowGroups_(activeOperations.filter(op=>op.kind==='append').map(op=>({row:op.row}))).forEach(group=>{
      const first=group[0].row,height=group.length;
      [5,13,14].forEach(logical=>formats.push({repeatCell:{range:oa2AppendApiRange_(context.sheetId,first,height,columns[logical-1],1),cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'yyyy-mm-dd'}}},fields:'userEnteredFormat.numberFormat'}}));
      formats.push({setDataValidation:{range:oa2AppendApiRange_(context.sheetId,first,height,columns[0],1)}});
      formats.push({setDataValidation:{range:oa2AppendApiRange_(context.sheetId,first,height,columns[3],1),rule:{condition:{type:'ONE_OF_LIST',values:['待到店','已到店','No Show','取消','改期'].map(value=>({userEnteredValue:value}))},strict:true,showCustomUi:true}}});
    });
    batch('allocating',oa2AppendApiRequests_(context.sheetId,allocating));apply(allocating);check('allocating_cas');
    batch('payload',oa2AppendApiRequests_(context.sheetId,payload).concat(formats));apply(payload);check('payload_cas');
    batch('managed',oa2AppendApiRequests_(context.sheetId,managed));apply(managed);check('managed_readback');
    return {completed:true,rows:operations.length,alreadyManaged:alreadyManaged.size,timings};
  }catch(ignored){console.log(JSON.stringify({handler:'arrival_queue_api_write',phase,state:'unconfirmed',rows:operations.length}));throw new Error('API queue update was not confirmed; retain its existing recovery identity and retry safely.');}
}

/** Explicit isolated Google qualification. Creates ONLY a new synthetic file.
 * Returns its ID for the operator's existing connector cleanup; no Drive scope.
 * Never substitutes this workbook for the bound operational workbook.
 */
function qaQueueAppendApiSynthetic20261116() {
  const started=Date.now(),ss=SpreadsheetApp.create('SYNTHETIC ONLY - Queue API qualification - 20261116');
  const result={syntheticOnly:true,fixtureSpreadsheetId:ss.getId(),passed:false};
  console.log(JSON.stringify({handler:'arrival_queue_api_synthetic_qa',phase:'created',syntheticOnly:true,fixtureSpreadsheetId:result.fixtureSpreadsheetId}));
  const finish=value=>value;
  let lock,locked=false,phase='fixture',assertions=0;
  const check=(condition,code)=>{assertions++;if(!condition)throw new Error(code);};
  try {
    ss.setSpreadsheetTimeZone(OA2.TZ);
    const sh=ss.getSheets()[0].setName(OA2.ARRIVAL),headers=OA2_QUEUE_BASE_HEADERS.concat(OA2.QUEUE_HEADERS);
    headers.splice(1,0,'CS同事名');headers.unshift('品牌','電話');headers.push('來源','試做價','開單金額','總金額');
    if(sh.getMaxColumns()<headers.length)sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
    sh.getRange(OA2.HEADER_ROW,1,1,headers.length).setValues([headers]);
    const appointment=(id,queueId)=>({id,leadId:'synthetic_lead_'+id,queueId,account:'SYNTHETIC_ACCOUNT',customerKey:'SYNTHETIC_ACCOUNT|p:00000001',phone:'00000001',
      name:'SYNTHETIC_LITERAL',brand:'SYNTHETIC_BRAND',treatment:'SYNTHETIC_TREATMENT',branch:'SYNTHETIC_BRANCH',createdAt:'2026-11-01',
      date:'2026-11-20',time:'00:00',bookedAt:'',provenance:'legacy_registration_unknown',state:'active',outcome:'',arrivalDate:'',outcomeAt:'',
      revision:1,previousId:'',lastStatus:'booked',lastSchedule:'2026-11-20|00:00',firstSeenAt:'2026-11-16T00:00:00.000Z',updatedAt:'2026-11-16T00:00:00.000Z',pendingArrivalOverride:'scheduled',pendingQueueBefore:'new'});
    const a=appointment('synthetic_append','synthetic_entry_append'),b=appointment('synthetic_gap','synthetic_entry_gap');
    b.date='2026-11-21';b.time='16:30';b.bookedAt='2026-11-10T16:30:12.345Z';
    const ctx={dryRun:false,events:[],historyNextRow:2,today:'2026-11-16',now:'2026-11-16T00:00:00.000Z',rows:{[a.id]:2,[b.id]:3},appointments:{[a.id]:a,[b.id]:b}};
    const layout=oa2QueueLayout_(sh,false),index=header=>headers.indexOf(header),rows=[Array(headers.length).fill(''),Array(headers.length).fill('')];
    const set=(row,header,value)=>rows[row][index(header)]=value;
    [a,b].forEach((appt,i)=>{
      oa2QueueMetadata_(appt,i===0?'allocating':'managed',ctx).forEach((value,j)=>rows[i][layout.columns[19+j]-1]=value);
      set(i,'Account',appt.account);set(i,'穩定客戶識別（內部）',appt.customerKey);set(i,'到店紀錄ID（內部）',appt.queueId);
      set(i,'品牌','SYNTHETIC_PREFIX');set(i,'電話','SYNTHETIC_PHONE');set(i,'CS同事名','SYNTHETIC_CS');
      set(i,'備註','SYNTHETIC_REMARK');set(i,'試做價',0);set(i,'開單金額',0);
      set(i,'總金額','=SUM('+columnLetter_(index('試做價')+1)+(8+i)+':'+columnLetter_(index('開單金額')+1)+(8+i)+')');
    });
    b.pendingQueueBefore=JSON.stringify(['2026-11-19','15:00','No Show','2026-11-18']);
    set(1,'客人／預約','SYNTHETIC_EXISTING');set(1,'預約日期',oa2NativeDate_('2026-11-19'));set(1,'時間',oa2NativeTime_('15:00'));set(1,'結果','No Show');set(1,'到店日期',oa2NativeDate_('2026-11-18'));
    sh.getRange(8,1,2,headers.length).setValues(rows);sh.getRange(8,index('備註')+1).setNote('SYNTHETIC_CELL_NOTE');
    const registry=ss.insertSheet(OA2.LEDGER);
    if(registry.getMaxColumns()<OA2.LEDGER_HEADERS.length)registry.insertColumnsAfter(registry.getMaxColumns(),OA2.LEDGER_HEADERS.length-registry.getMaxColumns());
    registry.getRange(1,1,1,OA2.LEDGER_HEADERS.length).setValues([OA2.LEDGER_HEADERS]);
    registry.getRange(2,1,2,OA2.LEDGER_HEADERS.length).setValues([oa2LedgerRow_(a),oa2LedgerRow_(b)].map(values=>values.map(value=>typeof value==='string'&&value.charAt(0)==='='?"'"+value:value)));
    const source=ss.insertSheet(a.account);source.getRange(1,1,1,6).setValues([OA2.ACCOUNT_HEADERS]);
    const history=ss.insertSheet(OA2.HISTORY);history.getRange(1,1,1,OA2.HISTORY_HEADERS.length).setValues([OA2.HISTORY_HEADERS]);
    SpreadsheetApp.flush();
    phase='admission';lock=LockService.getDocumentLock();if(!lock||!lock.tryLock(1000))return finish(Object.assign(result,{skipped:true,reason:'busy',phase,assertions}));locked=true;
    result.freshLockHandleConfirmed=LockService.getDocumentLock().hasLock();check(result.freshLockHandleConfirmed,'fresh_lock_handle_unconfirmed');
    const record=(appt,index)=>({row:index+2,meaningful:true,account:appt.account,leadId:appt.leadId,appointmentId:appt.id,customerKey:appt.customerKey,phone:appt.phone,fullPhone:appt.phone,name:appt.name,bookedAt:appt.bookedAt,outcome:'',outcomeAt:''});
    const records=[record(a,0),record(b,1)],ops=[{kind:'append',appt:a,row:8,entryId:a.queueId,recovery:true},{kind:'schedule_only',appt:b,row:9,state:'結果待核對'}];
    // Capture the queue before the registry write, then deliberately avoid a native
    // flush/read barrier. The API fence must observe the newly persisted intent.
    const capturedQueue=oa2ReadQueue_(ss,false);ctx.original={[a.id]:JSON.stringify(a),[b.id]:JSON.stringify(b)};
    a.revision++;b.revision++;phase='native_write_ahead';
    const snap={sheet:source,meta:1,width:6,values:[Array(6).fill(''),Array(6).fill('')],records};
    oa2WriteSourceAnchors_(snap,ctx);oa2CheckpointChanges_(ctx);
    // Use the canonical history row payload without its bound-script cursor.
    history.getRange(2,1,ctx.events.length,OA2.HISTORY_HEADERS.length).setValues(ctx.events);
    oa2WriteRegistry_(ss,ctx);
    phase='mixed_api_write';const receipt=oa2WriteQueueAppendApi_(ss,ctx,capturedQueue,ops,records);
    result.writeTimings=receipt.timings;SpreadsheetApp.flush();
    phase='native_readback';const after=sh.getRange(8,1,2,headers.length).getValues();
    check(oa2Date_(after[0][index('預約日期')])===a.date,'append_day');check(oa2Time_(after[0][index('時間')])==='00:00','append_midnight');
    check(after[0][index('Booking Registered At')]==='','unknown_book_time');
    check(after[0][index('客人識別')]===a.name&&!sh.getRange(8,index('客人識別')+1).getFormula(),'literal_text');
    check(oa2AppendApiValue_('=SYNTHETIC_LITERAL').stringValue==='=SYNTHETIC_LITERAL','literal_extended_value');
    check(oa2Date_(after[1][index('預約日期')])===b.date&&oa2Time_(after[1][index('時間')])===b.time,'gap_schedule');
    check(after[1][index('結果')]==='No Show'&&oa2Date_(after[1][index('到店日期')])==='2026-11-18','gap_outcome_preserved');
    check(after[1][index('Booking Registered At')] instanceof Date&&after[1][index('Booking Registered At')].toISOString()===b.bookedAt,'metadata_hkt_instant');
    [0,1].forEach(i=>['品牌','電話','CS同事名','備註','試做價','開單金額'].forEach(header=>check(after[i][index(header)]===rows[i][index(header)],'staff_field_preserved')));
    check(sh.getRange(8,index('備註')+1).getNote()==='SYNTHETIC_CELL_NOTE','cell_note_preserved');
    check(sh.getRange(8,index('總金額')+1).getFormula()===rows[0][index('總金額')],'finance_formula_preserved');
    check(sh.getRange(8,index('時間')+1).getNumberFormat()==='hh:mm'&&sh.getRange(9,index('時間')+1).getNumberFormat()==='hh:mm','time_format');
    phase='source_finalize';oa2WriteAccountMeta_(snap);SpreadsheetApp.flush();
    phase='managed_retry';const retry=oa2WriteQueueAppendApi_(ss,ctx,oa2ReadQueue_(ss,false),[ops[0]],records);check(retry.alreadyManaged===1,'managed_retry_ack');
    phase='fresh_outcome_rejection';sh.getRange(8,index('Record Origin')+1).setValue('allocating');sh.getRange(8,index('結果')+1).setValue('No Show');SpreadsheetApp.flush();
    let rejected=false;try{oa2WriteQueueAppendApi_(ss,ctx,oa2ReadQueue_(ss,false),[ops[0]],records);}catch(ignored){rejected=true;}
    check(rejected&&sh.getRange(8,index('結果')+1).getValue()==='No Show','fresh_noshow_preserved');
    phase='fresh_h_rejection';sh.getRange(8,index('結果')+1).setValue('待到店');sh.getRange(8,index('到店日期')+1).setValue(oa2NativeDate_('2026-11-12'));SpreadsheetApp.flush();
    rejected=false;try{oa2WriteQueueAppendApi_(ss,ctx,oa2ReadQueue_(ss,false),[ops[0]],records);}catch(ignored){rejected=true;}
    check(rejected&&oa2Date_(sh.getRange(8,index('到店日期')+1).getValue())==='2026-11-12','fresh_h_preserved');
    return finish(Object.assign(result,{passed:true,assertions,phase:'complete',elapsedMs:Date.now()-started}));
  }catch(ignored){return finish(Object.assign(result,{passed:false,assertions,phase,elapsedMs:Date.now()-started}));}
  finally{
    try{if(locked){try{SpreadsheetApp.flush();}finally{lock.releaseLock();}}}
    catch(ignored){result.passed=false;result.phase='cleanup_unconfirmed';}
    finally{console.log(JSON.stringify(Object.assign({handler:'arrival_queue_api_synthetic_qa'},result,{assertions,elapsedMs:Date.now()-started})));}
  }
}
