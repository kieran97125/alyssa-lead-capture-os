/** Optional final projection transport; deliberately disabled pending Google QA.
 * Canonical CS/display rules run on one request-local memory workbook. Actual
 * inputs are read again before one atomic Sheets batch, then verified by stable
 * ownership. Sheets does not offer conditional batch CAS against direct user
 * edits: the fresh guards/readback detect observable races, not a database lock.
 * No native arrival reads, flush, or fallback follow API dispatch.
 * See Sheets spreadsheets.get (raw GridData) and spreadsheets.batchUpdate
 * atomicity, UpdateCellsRequest and SortRangeRequest official contracts.
 */
var OA3_FINALIZE_API_ENABLED=false;
// Set only by the isolated QA entrypoint, for this execution's newly created ID.
// Object identity prevents a serializable caller option from granting admission.
var OA3_FINALIZE_API_QA_CONTEXT=null;
var OA3_FINALIZE_API_LIMITS={rows:50000,columns:100,cells:3000000,changes:10000,requests:1000};
function oa3FinalizeApiQaContext_(options,id){
  if(options.qaContext===undefined)return null;
  const context=options.qaContext;
  if(!context||context!==OA3_FINALIZE_API_QA_CONTEXT||context.spreadsheetId!==id||context.documentLock!==options.documentLock||context.createdThisExecution!==true)throw new Error('Synthetic finalizer admission is not verified.');
  return context;
}
function oa3FinalizeApiQuote_(name){return "'"+name.replace(/'/g,"''")+"'";}
function oa3FinalizeApiNames_(){return OMNI_ACCOUNT_TABS.concat([OA2_CS.HISTORY,OA2.LEDGER,OA2_CS.ALIASES,OA2.HISTORY,OA2.ARRIVAL]);}
function oa3FinalizeApiScalar_(value){
  if(!value)return '';
  if(value.errorValue)throw new Error('Formula input is not available.');
  for(const key of ['stringValue','numberValue','boolValue','formulaValue'])if(value[key]!==undefined)return value[key];
  return '';
}
function oa3FinalizeApiValue_(value){
  if(value===null||value===undefined||value==='')return {};
  if(typeof value==='string')return {stringValue:value};
  if(typeof value==='number'&&isFinite(value))return {numberValue:value};
  if(typeof value==='boolean')return {boolValue:value};
  throw new Error('Unsupported finalizer value.');
}
function oa3FinalizeApiMetadata_(id){
  const names=oa3FinalizeApiNames_(),reply=Sheets.Spreadsheets.get(id,{ranges:names.map(name=>oa3FinalizeApiQuote_(name)+'!A1:A1'),includeGridData:false,
    fields:'properties(timeZone),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))'});
  if(!reply||!reply.properties||reply.properties.timeZone!==OA2.TZ||!Array.isArray(reply.sheets))throw new Error('Finalizer workbook is not verified.');
  let cells=0;const result={};
  names.forEach(name=>{const matches=reply.sheets.filter(s=>s.properties&&s.properties.title===name);if(matches.length!==1)throw new Error('Finalizer sheet coverage is incomplete.');
    const p=matches[0].properties,g=p.gridProperties;
    if(!Number.isInteger(p.sheetId)||!g||!Number.isInteger(g.rowCount)||!Number.isInteger(g.columnCount)||g.rowCount<1||g.columnCount<1||g.rowCount>OA3_FINALIZE_API_LIMITS.rows||g.columnCount>OA3_FINALIZE_API_LIMITS.columns)throw new Error('Finalizer grid requires a reviewed bound.');
    cells+=g.rowCount*g.columnCount;result[name]={name,id:p.sheetId,rows:g.rowCount,columns:g.columnCount};
  });if(cells>OA3_FINALIZE_API_LIMITS.cells)throw new Error('Finalizer total grid requires a reviewed bound.');return result;
}
function oa3FinalizeApiCapture_(id,metadata){
  const names=oa3FinalizeApiNames_(),reply=Sheets.Spreadsheets.get(id,{ranges:names.map(name=>{const m=metadata[name];return oa3FinalizeApiQuote_(name)+'!A1:'+columnLetter_(m.columns)+m.rows;}),includeGridData:true,
    fields:'properties(timeZone),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),data(startRow,startColumn,rowData(values(userEnteredValue,note,dataValidation,userEnteredFormat))))'});
  if(!reply||!reply.properties||reply.properties.timeZone!==OA2.TZ||!Array.isArray(reply.sheets))throw new Error('Finalizer raw response is incomplete.');
  const result={};
  names.forEach(name=>{
    const m=metadata[name],matches=reply.sheets.filter(s=>s.properties&&s.properties.title===name);if(matches.length!==1)throw new Error('Finalizer raw coverage is incomplete.');
    const s=matches[0],g=s.properties.gridProperties;if(s.properties.sheetId!==m.id||!g||g.rowCount!==m.rows||g.columnCount!==m.columns)throw new Error('Finalizer grid changed.');
    const data=s.data||[];if(data.length!==1||(data[0].startRow||0)!==0||(data[0].startColumn||0)!==0)throw new Error('Finalizer raw range is incomplete.');
    const rows=data[0].rowData||[];if(rows.length>m.rows)throw new Error('Finalizer raw range exceeds its bound.');
    const cells=rows.map(row=>{const values=row.values||[];if(values.length>m.columns)throw new Error('Finalizer raw width exceeds its bound.');return values.map(cell=>JSON.parse(JSON.stringify(cell||{})));});
    while(cells.length&&!cells[cells.length-1].some(cell=>Object.keys(cell.userEnteredValue||{}).length||cell.note))cells.pop();
    const headerRow=name===OA2.ARRIVAL?OA2.HEADER_ROW:1;
    if(cells.length<headerRow)throw new Error('Finalizer header is absent.');
    const headers=Array.from({length:m.columns},(_,i)=>{const value=cells[headerRow-1][i]&&cells[headerRow-1][i].userEnteredValue;if(value&&value.formulaValue!==undefined)throw new Error('Formula header requires review.');return oa2Text_(oa3FinalizeApiScalar_(value));});
    result[name]={metadata:m,cells,headers,values:cells.map(row=>Array.from({length:m.columns},(_,i)=>oa3FinalizeApiScalar_(row[i]&&row[i].userEnteredValue)))};
  });return result;
}
/** Effective formula reads are restricted to required source/ownership fields.
 * Generated arrival lookups/sort/totals and alias metric B/C/E stay opaque.
 * Staff arrival formulas remain occupied expressions, including ="" and =0.
 */
function oa3FinalizeApiResolve_(id,capture){
  const required=new Map(),add=(name,labels)=>{const tab=capture[name],columns=labels.map(label=>{const found=[];tab.headers.forEach((h,i)=>{if(h===label)found.push(i);});if(found.length!==1)throw new Error('Finalizer source header requires review.');return found[0];});required.set(name,new Set(columns));};
  const source=['Omni Lead ID','Appointment ID','CS同事名','品牌','電話','Email','IG/FB Username','Created At','Account'];
  OMNI_ACCOUNT_TABS.forEach(name=>add(name,source));
  add(OA2_CS.HISTORY,['遷移ID','CS同事名','品牌','電話','Email','IG/FB Username','Created At','Account']);
  add(OA2_CS.ALIASES,['ArrivalRecordID','Frozen Migration CreatedAt','Stable Source ID']);
  const cells=[];
  required.forEach((columns,name)=>capture[name].cells.forEach((row,r)=>{if(r===0)return;columns.forEach(c=>{if(row[c]&&row[c].userEnteredValue&&row[c].userEnteredValue.formulaValue!==undefined)cells.push({name,row:r,column:c,formula:row[c].userEnteredValue.formulaValue});});}));
  [OA2.LEDGER,OA2.HISTORY].forEach(name=>capture[name].cells.forEach(row=>row.forEach(cell=>{if(cell.userEnteredValue&&cell.userEnteredValue.formulaValue!==undefined)throw new Error('Formula registry/journal requires review.');})));
  if(cells.length>200)throw new Error('Formula input count requires review.');
  if(!cells.length)return;
  const ranges=cells.map(cell=>oa3FinalizeApiQuote_(cell.name)+'!'+columnLetter_(cell.column+1)+(cell.row+1));
  const reply=Sheets.Spreadsheets.get(id,{ranges,includeGridData:true,fields:'sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue))))'});
  const found=new Set();(reply&&reply.sheets||[]).forEach(sheet=>(sheet.data||[]).forEach(block=>{
    const cell=cells.find(item=>item.name===sheet.properties.title&&item.row===(block.startRow||0)&&item.column===(block.startColumn||0));if(!cell)throw new Error('Unexpected formula input coverage.');
    const values=block.rowData&&block.rowData[0]&&block.rowData[0].values,value=values&&values[0],key=cell.name+'|'+cell.row+'|'+cell.column;
    if(found.has(key)||!value||!value.userEnteredValue||value.userEnteredValue.formulaValue!==cell.formula||!value.effectiveValue||value.effectiveValue.errorValue)throw new Error('Formula input changed or is unavailable.');
    capture[cell.name].values[cell.row][cell.column]=oa3FinalizeApiScalar_(value.effectiveValue);found.add(key);
  }));if(found.size!==cells.length)throw new Error('Formula input coverage is incomplete.');
}
function oa3FinalizeApiFingerprint_(capture){return JSON.stringify(oa3FinalizeApiNames_().map(name=>[name,capture[name].metadata,capture[name].cells,capture[name].values]));}
/** Only memory is mutable; source/registry writes are rejected at this boundary. */
function oa3FinalizeApiMemory_(capture){
  const changes=new Map(),formats=[],tabs={};
  Object.keys(capture).forEach(name=>{
    const tab=capture[name],matrix=tab.values.map(row=>row.slice());let maxRows=tab.metadata.rows;
    const put=(row,col,value)=>{
      if(name!==OA2.ARRIVAL&&name!==OA2.HISTORY)throw new Error('Finalizer attempted a source or registry mutation.');
      if(name===OA2.HISTORY&&row<=tab.values.length)throw new Error('Finalizer attempted a journal overwrite.');
      if(name===OA2.ARRIVAL){const header=tab.headers[col-1];if(!['CS同事名','品牌','電話','客人／預約'].includes(header))throw new Error('Finalizer attempted a business input mutation.');
        const existing=tab.cells[row-1]&&tab.cells[row-1][col-1];if(existing&&existing.userEnteredValue&&existing.userEnteredValue.formulaValue!==undefined)throw new Error('Finalizer preserves formula-owned display cells.');}
      while(matrix.length<row)matrix.push(Array(tab.metadata.columns).fill(''));matrix[row-1][col-1]=value;
      changes.set(name+'|'+row+'|'+col,{name,row,column:col,value});
    };
    tabs[name]={getName:()=>name,getLastRow:()=>matrix.length,getLastColumn:()=>Math.max(1,...matrix.map(row=>{let n=row.length;while(n&&!oa2Text_(row[n-1]))n--;return n;})),getMaxColumns:()=>tab.metadata.columns,getMaxRows:()=>maxRows,
      insertRowsAfter:(after,count)=>{if(name!==OA2.HISTORY||after!==maxRows||count<1)throw new Error('Unsupported finalizer capacity mutation.');maxRows+=count;},
      getRange:(row,col,height=1,width=1)=>{
        if(!Number.isInteger(row)||!Number.isInteger(col)||row<1||col<1||height<1||width<1||col+width-1>tab.metadata.columns)throw new Error('Unsupported finalizer range.');
        const read=()=>Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>matrix[row+r-1]&&matrix[row+r-1][col+c-1]!==undefined?matrix[row+r-1][col+c-1]:''));
        const range={getValues:read,getDisplayValues:()=>read().map(values=>values.map(oa2Text_)),setValues:values=>{if(values.length!==height||values.some(r=>r.length!==width))throw new Error('Invalid finalizer values.');values.forEach((values,r)=>values.forEach((value,c)=>put(row+r,col+c,value)));return range;},
          setNumberFormat:format=>{if(name!==OA2.ARRIVAL||tab.headers[col-1]!=='電話'||width!==1||format!=='@')throw new Error('Unsupported finalizer format mutation.');formats.push({row,column:col,height});return range;}};return range;
      }};
  });return {ss:{getSheetByName:name=>tabs[name]||null},tabs,changes,formats};
}
function oa3FinalizeApiAssertGraph_(capture,memory){
  const unique=(values,label)=>{const seen=new Set();values.forEach(value=>{const id=oa2Text_(value);if(!id)return;if(seen.has(id))throw new Error(label+' ownership requires review.');seen.add(id);});};
  const ids=[],pointers=[];OMNI_ACCOUNT_TABS.forEach(name=>{const tab=capture[name],id=tab.headers.indexOf('Omni Lead ID'),pointer=tab.headers.indexOf('Appointment ID'),anchor=tab.headers.indexOf('Pending Appointment Snapshot');
    tab.values.slice(1).forEach(row=>{ids.push(row[id]);pointers.push(row[pointer]);if(anchor>=0&&oa2Text_(row[anchor]))throw new Error('Pending source recovery requires review.');});});
  const history=capture[OA2_CS.HISTORY],hid=history.headers.indexOf('遷移ID');history.values.slice(1).forEach(row=>{if(oa2Text_(row[hid]))ids.push('history:'+oa2Text_(row[hid]));});
  unique(ids,'Source');unique(pointers,'Source pointer');
  const reg=oa2ReadRegistry_(memory.ss).appointments,appointments=Object.values(reg);unique(appointments.map(a=>a.queueId),'Registry queue');
  if(appointments.some(a=>oa2Text_(a.pendingQueueBefore)))throw new Error('Pending queue recovery requires review.');
  const queue=oa2CsQueue_(memory.ss);unique(queue.map(q=>q.entryId),'Queue entry');unique(queue.map(q=>q.appointmentId),'Queue appointment');
  if(queue.some(q=>q.origin==='allocating'))throw new Error('Allocating queue recovery requires review.');
}
function oa3FinalizeApiPlan_(capture,options){
  OMNI_ACCOUNT_TABS.forEach(name=>{if(capture[name].cells.length>OA2_CS.SOURCE_LAST_ROW)throw new Error('Source used-row bound requires review.');});
  for(const [name,bound] of [[OA2_CS.HISTORY,OA2_CS.HISTORY_LAST_ROW],[OA2.LEDGER,OA2_CS.REGISTRY_LAST_ROW],[OA2_CS.ALIASES,OA2_CS.ALIAS_LAST_ROW]])if(capture[name].cells.length>bound)throw new Error('Finalizer used-row bound requires review.');
  const memory=oa3FinalizeApiMemory_(capture);oa3FinalizeApiAssertGraph_(capture,memory);
  const activation=options.qaContext&&options.qaContext===OA3_FINALIZE_API_QA_CONTEXT?'verified':oa2CsActivationState_(),hasCs=capture[OA2.ARRIVAL].headers.includes(OA2_CS.HEADER),cs=[];
  if(activation!=='verified'&&hasCs)throw new Error('CS activation requires verification.');
  if(activation==='verified')options.accountNames.forEach((name,i)=>cs.push(oa2RefreshQueueCs_(memory.ss,{documentLock:options.documentLock,accountNames:[name],includeHistory:i===0&&options.includeHistory===true})));
  oa3RefreshDisplay_(memory.ss,false);
  const tab=capture[OA2.ARRIVAL],headers=tab.headers,rows=Array.from({length:Math.max(0,memory.tabs[OA2.ARRIVAL].getLastRow()-OA2.FIRST_ROW+1)},(_,i)=>memory.tabs[OA2.ARRIVAL].getRange(OA2.FIRST_ROW+i,1,1,tab.metadata.columns).getValues()[0]);
  oa3SnapshotValues_(headers,rows);
  const index=label=>{const i=headers.indexOf(label);if(i<0||headers.lastIndexOf(label)!==i)throw new Error('Finalizer sort header requires review.');return i;},date=index('預約日期'),time=index('時間'),id=index('Appointment ID'),outcome=index('結果');
  const keys=rows.map((row,i)=>oa3SortKey_(row[date],row[time],row[id],i,row[outcome]));
  rows.forEach((row,i)=>{for(const c of [date,time,id,outcome]){const cell=tab.cells[OA2.FIRST_ROW-1+i]&&tab.cells[OA2.FIRST_ROW-1+i][c];if(cell&&cell.userEnteredValue&&cell.userEnteredValue.formulaValue!==undefined)throw new Error('Formula sorting input requires review.');}});
  const sort=keys.some((key,i)=>i&&key<keys[i-1]);
  if(sort){const staff=new Set(['CS同事名','結果','到店日期','備註','補充Book登記日期','來源','試做價','開單金額']);tab.cells.slice(OA2.FIRST_ROW-1).forEach(row=>row.forEach((cell,c)=>{if(staff.has(headers[c])&&cell.userEnteredValue&&cell.userEnteredValue.formulaValue!==undefined)throw new Error('Staff formula relocation requires synthetic Google qualification.');}));}
  if(memory.changes.size>OA3_FINALIZE_API_LIMITS.changes)throw new Error('Finalizer write count requires review.');
  return {memory,sort,keys,cs,rows};
}
function oa3FinalizeApiRequests_(capture,plan){
  const requests=[],bySheet=new Map();plan.memory.changes.forEach(item=>{if(!bySheet.has(item.name))bySheet.set(item.name,[]);bySheet.get(item.name).push(item);});
  bySheet.forEach((items,name)=>{const tab=capture[name],last=Math.max(...items.map(item=>item.row));if(last>tab.metadata.rows)requests.push({appendDimension:{sheetId:tab.metadata.id,dimension:'ROWS',length:last-tab.metadata.rows}});
    items.sort((a,b)=>a.row-b.row||a.column-b.column);let group;
    items.forEach(item=>{if(group&&group.row===item.row&&group.column+group.values.length===item.column)group.values.push({userEnteredValue:oa3FinalizeApiValue_(item.value)});else{group={row:item.row,column:item.column,values:[{userEnteredValue:oa3FinalizeApiValue_(item.value)}]};requests.push({updateCells:{start:{sheetId:tab.metadata.id,rowIndex:group.row-1,columnIndex:group.column-1},rows:[{values:group.values}],fields:'userEnteredValue'}});}});
  });
  const tab=capture[OA2.ARRIVAL],sheetId=tab.metadata.id;
  plan.memory.formats.forEach(f=>requests.push({repeatCell:{range:{sheetId,startRowIndex:f.row-1,endRowIndex:f.row-1+f.height,startColumnIndex:f.column-1,endColumnIndex:f.column},cell:{userEnteredFormat:{numberFormat:{type:'TEXT',pattern:'@'}}},fields:'userEnteredFormat.numberFormat'}}));
  if(plan.sort){const column=tab.metadata.columns;
    requests.push({appendDimension:{sheetId,dimension:'COLUMNS',length:1}},{updateCells:{start:{sheetId,rowIndex:OA2.FIRST_ROW-1,columnIndex:column},rows:plan.keys.map(key=>({values:[{userEnteredValue:{stringValue:key}}]})),fields:'userEnteredValue'}},
      {sortRange:{range:{sheetId,startRowIndex:OA2.FIRST_ROW-1,endRowIndex:OA2.FIRST_ROW-1+plan.keys.length,startColumnIndex:0,endColumnIndex:column+1},sortSpecs:[{dimensionIndex:column,sortOrder:'ASCENDING'}]}},
      {deleteDimension:{range:{sheetId,dimension:'COLUMNS',startIndex:column,endIndex:column+1}}});
  }if(requests.length>OA3_FINALIZE_API_LIMITS.requests)throw new Error('Finalizer request count requires review.');return requests;
}
function oa3FinalizeApiVerify_(before,after,plan){
  const arrival=before[OA2.ARRIVAL],actual=after[OA2.ARRIVAL],idColumn=arrival.headers.indexOf('Appointment ID'),entryColumn=arrival.headers.indexOf('到店紀錄ID（內部）');
  if(JSON.stringify(arrival.metadata)!==JSON.stringify(actual.metadata))throw new Error('Finalizer arrival dimensions changed.');
  if(JSON.stringify(arrival.headers)!==JSON.stringify(actual.headers)||JSON.stringify(arrival.cells.slice(0,OA2.FIRST_ROW-1))!==JSON.stringify(actual.cells.slice(0,OA2.FIRST_ROW-1)))throw new Error('Finalizer arrival header or pre-body cells changed.');
  const expected=JSON.parse(JSON.stringify(before));plan.memory.changes.forEach(item=>{const tab=expected[item.name];while(tab.cells.length<item.row)tab.cells.push([]);while(tab.cells[item.row-1].length<item.column)tab.cells[item.row-1].push({});tab.cells[item.row-1][item.column-1].userEnteredValue=oa3FinalizeApiValue_(item.value);});
  plan.memory.formats.forEach(f=>{for(let r=f.row-1;r<f.row-1+f.height;r++){const cell=expected[OA2.ARRIVAL].cells[r][f.column-1];cell.userEnteredFormat=cell.userEnteredFormat||{};cell.userEnteredFormat.numberFormat={type:'TEXT',pattern:'@'};}});
  const rowIdentity=row=>oa2Text_(oa3FinalizeApiScalar_(row[idColumn]&&row[idColumn].userEnteredValue))||oa2Text_(oa3FinalizeApiScalar_(row[entryColumn]&&row[entryColumn].userEnteredValue));
  // Formula-expression movement is not inferred from calculated totals. Until
  // real Google qualification proves relocation, expression changes remain an
  // uncertain readback, including generated formulas. No value-only shortcut.
  const normalize=row=>Array.from({length:arrival.metadata.columns},(_,c)=>row[c]||{});
  const body=tab=>tab.cells.slice(OA2.FIRST_ROW-1),expectedRows=body(expected[OA2.ARRIVAL]),actualRows=body(actual);
  if(expectedRows.length!==actualRows.length)throw new Error('Finalizer arrival row coverage changed.');
  const byId=new Map(),unownedBefore=[],unownedAfter=[];expectedRows.forEach(row=>{const key=rowIdentity(row);if(!key){unownedBefore.push(normalize(row));return;}if(byId.has(key))throw new Error('Duplicate finalizer ownership.');byId.set(key,normalize(row));});
  actualRows.forEach(row=>{const key=rowIdentity(row);if(!key){unownedAfter.push(normalize(row));return;}if(!byId.has(key)||JSON.stringify(normalize(row))!==JSON.stringify(byId.get(key)))throw new Error('Finalizer ownership or retained cell changed.');byId.delete(key);});if(byId.size||JSON.stringify(unownedBefore)!==JSON.stringify(unownedAfter))throw new Error('Finalizer lost arrival ownership or unowned cells.');
  if(plan.sort){const h=arrival.headers,keys=actual.values.slice(OA2.FIRST_ROW-1).map((row,i)=>oa3SortKey_(row[h.indexOf('預約日期')],row[h.indexOf('時間')],row[idColumn],i,row[h.indexOf('結果')]));if(keys.some((key,i)=>i&&key<keys[i-1]))throw new Error('Finalizer sort was not verified.');}
  oa3FinalizeApiNames_().filter(name=>name!==OA2.ARRIVAL).forEach(name=>{if(JSON.stringify(expected[name].cells)!==JSON.stringify(after[name].cells))throw new Error('Finalizer source or journal readback changed.');
    if(name!==OA2.HISTORY&&(JSON.stringify(before[name].metadata)!==JSON.stringify(after[name].metadata)||JSON.stringify(before[name].values)!==JSON.stringify(after[name].values)))throw new Error('Finalizer effective source input changed.');});
}
function oa3TryApiFinalize_(ss,options){
  if(OA3_FINALIZE_API_ENABLED!==true)return null;
  options=options||{};
  if(!options.documentLock||!options.documentLock.hasLock()||!Array.isArray(options.accountNames)||JSON.stringify(options.accountNames)!==JSON.stringify(OMNI_ACCOUNT_TABS)||options.includeHistory!==true)throw new Error('API finalizer requires the held document lock and explicit full scope.');
  if(typeof Sheets==='undefined'||!Sheets.Spreadsheets||typeof Sheets.Spreadsheets.get!=='function'||typeof Sheets.Spreadsheets.batchUpdate!=='function')throw new Error('API finalizer is unavailable; no native fallback is permitted.');
  const id=ss.getId(),qa=oa3FinalizeApiQaContext_(options,id),started=Date.now();let dispatched=false;
  try{
    const metadata=oa3FinalizeApiMetadata_(id),before=oa3FinalizeApiCapture_(id,metadata);oa3FinalizeApiResolve_(id,before);
    const plan=oa3FinalizeApiPlan_(before,options),requests=oa3FinalizeApiRequests_(before,plan),fresh=oa3FinalizeApiCapture_(id,metadata);oa3FinalizeApiResolve_(id,fresh);
    if(oa3FinalizeApiFingerprint_(before)!==oa3FinalizeApiFingerprint_(fresh))throw new Error('Finalizer inputs changed; colleague input is preserved.');
    if(requests.length){dispatched=true;const reply=Sheets.Spreadsheets.batchUpdate({requests,includeSpreadsheetInResponse:false},id);
      if(!reply||reply.spreadsheetId!==id||!Array.isArray(reply.replies)||reply.replies.length!==requests.length)throw new Error('Finalizer API write is unconfirmed.');
      if(qa&&qa.discardNextReply===true){qa.discardNextReply=false;throw new Error('Synthetic reply deliberately discarded after acknowledged application.');}
      const afterMetadata=oa3FinalizeApiMetadata_(id),after=oa3FinalizeApiCapture_(id,afterMetadata);oa3FinalizeApiResolve_(id,after);oa3FinalizeApiVerify_(before,after,plan);
    }
    return {completed:true,changed:plan.memory.changes.size,sorted:plan.sort?plan.rows.length:0,csReviewByAccount:options.accountNames.map((name,i)=>plan.cs[i]&&plan.cs[i].review||0),durationMs:Date.now()-started,transport:'sheets_api'};
  }catch(error){
    if(dispatched)throw new Error('API finalizer result is uncertain; inspect or safely retry this phase. No native fallback was run.');
    return {completed:false,review:true,reason:'api_finalizer_not_admitted',durationMs:Date.now()-started,transport:'sheets_api'};
  }
}

/** Real Google qualification, ONLY in a new synthetic spreadsheet. No bound
 * workbook/cursor/property writes and no Drive service or added scope. Keep the
 * fixture for operator inspection/connector cleanup; its ID is logged at create
 * and again in the unconditional final summary, even if lock cleanup fails.
 */
function qualifyArrivalFinalizeApi20261116(){
  const started=Date.now(),oldFlag=OA3_FINALIZE_API_ENABLED,oldContext=OA3_FINALIZE_API_QA_CONTEXT;
  const result={syntheticOnly:true,fixtureSpreadsheetId:null,fixtureRetained:true,passed:false,activationQualified:false,remainingGate:'real_google_formula_semantics_and_latency_review',cleanupVerified:false,timings:{}};
  let lock,locked=false,phase='create',assertions=0;
  const check=(condition,code)=>{assertions++;if(!condition)throw new Error(code);};
  try{
    check(oldFlag===false&&oldContext===null,'qa_requires_disabled_transport');
    const names=oa3FinalizeApiNames_(),ids={},sourceHeaders=OMNI_HEADERS.concat(OA2.ACCOUNT_HEADERS),arrivalHeaders=OA2_QUEUE_BASE_HEADERS.concat(OA2.QUEUE_HEADERS);
    arrivalHeaders.splice(1,0,OA2_CS.HEADER);arrivalHeaders.unshift('品牌','電話');arrivalHeaders.push('sortKey','來源','試做價','開單金額','總金額','','','','Synthetic extra staff field');
    const created=Sheets.Spreadsheets.create({properties:{title:'SYNTHETIC ONLY - Arrival finalizer QA - 20261116',timeZone:OA2.TZ},sheets:names.map((name,i)=>{ids[name]=i+1;return {properties:{sheetId:i+1,title:name,gridProperties:{rowCount:40,columnCount:Math.max(38,sourceHeaders.length,arrivalHeaders.length)}}};})});
    check(created&&typeof created.spreadsheetId==='string'&&!!created.spreadsheetId,'fixture_creation_unconfirmed');result.fixtureSpreadsheetId=created.spreadsheetId;
    console.log(JSON.stringify({handler:'arrival_finalize_api_synthetic_qa',phase:'created',syntheticOnly:true,fixtureSpreadsheetId:result.fixtureSpreadsheetId}));
    phase='seed';const id=result.fixtureSpreadsheetId,requests=[],data=[],headersByName={};
    OMNI_ACCOUNT_TABS.forEach(name=>headersByName[name]=sourceHeaders);headersByName[OA2_CS.HISTORY]=['遷移ID','CS同事名','品牌','電話','Email','IG/FB Username','Created At','Account'];headersByName[OA2.LEDGER]=OA2.LEDGER_HEADERS;headersByName[OA2.HISTORY]=OA2.HISTORY_HEADERS;
    headersByName[OA2_CS.ALIASES]=['ArrivalRecordID','Synthetic computed B','Synthetic computed C','Frozen Migration CreatedAt','Synthetic computed E','Stable Source ID'];headersByName[OA2.ARRIVAL]=arrivalHeaders;
    const row=(headers,values)=>headers.map(header=>values[header]===undefined?'':values[header]);
    const put=(name,r,values)=>requests.push({updateCells:{start:{sheetId:ids[name],rowIndex:r-1,columnIndex:0},rows:[{values:values.map(value=>({userEnteredValue:oa3FinalizeApiValue_(value)}))}],fields:'userEnteredValue'}});
    names.forEach(name=>put(name,name===OA2.ARRIVAL?OA2.HEADER_ROW:1,headersByName[name]));
    const civil=day=>(Date.parse(day+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;
    OMNI_ACCOUNT_TABS.forEach((name,i)=>{
      const phone='0000000'+(i+1),a={id:'synthetic_finalizer_appt_'+i,leadId:'synthetic_finalizer_lead_'+i,queueId:'synthetic_finalizer_queue_'+i,account:name,customerKey:name+'|p:'+phone,phone,name:'SYNTHETIC PERSON',brand:'SYNTHETIC BRAND '+i,treatment:'SYNTHETIC OFFER',branch:'SYNTHETIC BRANCH',createdAt:'2026-11-01',date:'2026-11-'+(26-i),time:'00:00',bookedAt:'2026-11-16T16:30:00.000Z',provenance:'observed_booking_edit',state:'active',outcome:'',arrivalDate:'',outcomeAt:'',revision:1,previousId:'',lastStatus:'booked',lastSchedule:'',firstSeenAt:'2026-11-16T00:00:00.000Z',updatedAt:'2026-11-16T00:00:00.000Z',generatedArrivalDate:'',pendingQueueBefore:'',pendingArrivalOverride:''};
      data.push(a);put(name,2,row(sourceHeaders,{'最後更新日期':a.date,'Created At':a.createdAt,'跟進狀態':'已預約','CS同事名':'SYNTHETIC CS '+i,'品牌':a.brand,'電話':phone,'Account':name,'Omni Lead ID':a.leadId,'Appointment ID':a.id,'Booking Registered At':a.bookedAt}));put(OA2.LEDGER,i+2,OA2_FIELDS.map(field=>a[field]==null?'':a[field]));
      put(OA2.ARRIVAL,OA2.FIRST_ROW+i,row(arrivalHeaders,{'品牌':'SYNTHETIC OLD BRAND','客人／預約':a.name,'預約日期':civil(a.date),'時間':0,'結果':'待到店','備註':'=SYNTHETIC LITERAL NOTE','Account':name,'穩定客戶識別（內部）':a.customerKey,'到店紀錄ID（內部）':a.queueId,'Appointment ID':a.id,'Schedule Revision':1,'Omni Lead ID':a.leadId,'Record Origin':'managed','來源':'SYNTHETIC SOURCE','試做價':0,'開單金額':i*100,'Synthetic extra staff field':'SYNTHETIC TAG '+i}));
    });
    const legacy={...data[0],id:'synthetic_finalizer_legacy_appt',leadId:'history:synthetic_finalizer_legacy',queueId:'synthetic_finalizer_legacy_queue',provenance:'legacy_show',state:'completed',outcome:'Show',date:'2026-10-01'};data.push(legacy);
    put(OA2_CS.HISTORY,2,row(headersByName[OA2_CS.HISTORY],{'遷移ID':'synthetic_finalizer_legacy','CS同事名':'SYNTHETIC HISTORY CS','品牌':legacy.brand,'電話':legacy.phone,'Created At':'2026-11-16T16:30:00.000Z','Account':legacy.account}));
    put(OA2_CS.ALIASES,2,[legacy.queueId,'','','2026-11-17','',legacy.leadId]);put(OA2.LEDGER,8,OA2_FIELDS.map(field=>legacy[field]==null?'':legacy[field]));
    put(OA2.ARRIVAL,14,row(arrivalHeaders,{'客人／預約':'SYNTHETIC HISTORY','預約日期':civil(legacy.date),'時間':0,'結果':'Show','Account':legacy.account,'穩定客戶識別（內部）':legacy.customerKey,'到店紀錄ID（內部）':legacy.queueId,'Appointment ID':legacy.id,'Omni Lead ID':legacy.leadId,'Record Origin':'legacy_show'}));
    const aid=ids[OA2.ARRIVAL],column=header=>arrivalHeaders.indexOf(header),range=(r,c,height=1,width=1)=>({sheetId:aid,startRowIndex:r-1,endRowIndex:r-1+height,startColumnIndex:c,endColumnIndex:c+width});
    requests.push({repeatCell:{range:range(8,column('Synthetic extra staff field')),cell:{note:'SYNTHETIC RETAINED CELL NOTE',dataValidation:{condition:{type:'ONE_OF_LIST',values:[{userEnteredValue:'SYNTHETIC TAG 0'}]},strict:true},userEnteredFormat:{backgroundColor:{red:0.2,green:0.3,blue:0.4}}},fields:'note,dataValidation,userEnteredFormat.backgroundColor'}},
      {repeatCell:{range:range(8,column('預約日期'),7),cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'yyyy-mm-dd'}}},fields:'userEnteredFormat.numberFormat'}},
      {repeatCell:{range:range(8,column('時間'),7),cell:{userEnteredFormat:{numberFormat:{type:'TIME',pattern:'hh:mm'}}},fields:'userEnteredFormat.numberFormat'}});
    const seeded=Sheets.Spreadsheets.batchUpdate({requests,includeSpreadsheetInResponse:false},id);check(seeded&&seeded.spreadsheetId===id,'fixture_seed_unconfirmed');result.timings.seedMs=Date.now()-started;
    phase='admission';lock=LockService.getDocumentLock();if(!lock||!lock.tryLock(1000)){result.skipped=true;result.reason='busy';return result;}locked=true;
    const context={spreadsheetId:id,documentLock:lock,createdThisExecution:true,discardNextReply:false};OA3_FINALIZE_API_QA_CONTEXT=context;OA3_FINALIZE_API_ENABLED=true;
    const opts={documentLock:lock,accountNames:OMNI_ACCOUNT_TABS.slice(),includeHistory:true,qaContext:context},ss={getId:()=>id};
    const capture=()=>{const m=oa3FinalizeApiMetadata_(id),c=oa3FinalizeApiCapture_(id,m);oa3FinalizeApiResolve_(id,c);return c;};
    const body=c=>c[OA2.ARRIVAL].cells.slice(OA2.FIRST_ROW-1),find=(c,appointmentId)=>{const index=body(c).findIndex(values=>oa3FinalizeApiScalar_(values[column('Appointment ID')]&&values[column('Appointment ID')].userEnteredValue)===appointmentId);check(index>=0,'fixture_owner_not_found');return {row:OA2.FIRST_ROW+index,cells:body(c)[index]};},value=(r,h)=>oa3FinalizeApiScalar_(r.cells[column(h)]&&r.cells[column(h)].userEnteredValue);
    const edit=(r,h,entered)=>{const reply=Sheets.Spreadsheets.batchUpdate({requests:[{updateCells:{start:{sheetId:aid,rowIndex:r-1,columnIndex:column(h)},rows:[{values:[{userEnteredValue:entered}]}],fields:'userEnteredValue'}}]},id);check(reply&&reply.spreadsheetId===id,'fixture_edit_unconfirmed');};
    phase='canonical_finalizer';let began=Date.now();const receipt=oa3TryApiFinalize_(ss,opts);result.timings.canonicalFinalizerMs=Date.now()-began;check(receipt&&receipt.completed===true,'canonical_finalizer_unconfirmed');
    let captured=capture();result.allocatedCellCount=Object.values(captured).reduce((n,t)=>n+t.metadata.rows*t.metadata.columns,0);result.canonicalSixScopes=receipt.csReviewByAccount.length===6;
    data.slice(0,6).forEach((a,i)=>{const r=find(captured,a.id);check(value(r,'CS同事名')==='SYNTHETIC CS '+i,'canonical_cs_scope');check(value(r,'電話')===a.phone&&oa2Time_(value(r,'時間'))==='00:00'&&oa2Date_(value(r,'預約日期'))===a.date,'phone_midnight_day');check(value(r,'試做價')===0&&value(r,'開單金額')===i*100,'money_retained');});
    const first=find(captured,data[0].id),extra=first.cells[column('Synthetic extra staff field')];check(extra.note==='SYNTHETIC RETAINED CELL NOTE'&&extra.dataValidation&&extra.dataValidation.strict===true,'note_validation_retained');
    check(first.cells[column('電話')].userEnteredFormat.numberFormat.type==='TEXT'&&first.cells[column('電話')].userEnteredFormat.numberFormat.pattern==='@','phone_text_format');
    check(first.cells[column('時間')].userEnteredFormat.numberFormat.pattern==='hh:mm','time_format');check(value(find(captured,legacy.id),'CS同事名')==='SYNTHETIC HISTORY CS','legacy_hkt_alias');
    result.wholeRecordSortVerified=true;result.notesValidationsFormatsVerified=true;result.hktMidnightZeroVerified=true;
    phase='lost_reply';const sourceBrand=sourceHeaders.indexOf('品牌');Sheets.Spreadsheets.batchUpdate({requests:[{updateCells:{start:{sheetId:ids[data[0].account],rowIndex:1,columnIndex:sourceBrand},rows:[{values:[{userEnteredValue:{stringValue:'SYNTHETIC REVISED BRAND'}}]}],fields:'userEnteredValue'}}]},id);
    context.discardNextReply=true;let unknown=false;try{oa3TryApiFinalize_(ss,opts);}catch(ignored){unknown=true;}check(unknown&&!context.discardNextReply,'discarded_reply_not_observed');const retry=oa3TryApiFinalize_(ss,opts);check(retry&&retry.completed===true&&retry.changed===0,'lost_reply_retry_not_idempotent');result.simulatedLostReplyRetryVerified=true;
    phase='occupied_cs';captured=capture();let zero=find(captured,data[1].id),formula=find(captured,data[2].id);edit(zero.row,'CS同事名',{numberValue:0});edit(formula.row,'CS同事名',{formulaValue:'=""'});check(oa3TryApiFinalize_(ss,opts).completed===true,'occupied_cs_finalizer');captured=capture();check(value(find(captured,data[1].id),'CS同事名')===0&&value(find(captured,data[2].id),'CS同事名')==='=""','occupied_cs_preserved');result.occupiedCsVerified=true;
    phase='staff_formula_gate';edit(formula.row,'CS同事名',{stringValue:'SYNTHETIC CS 2'});const moving=find(captured,data[5].id),oldDate=moving.cells[column('預約日期')].userEnteredValue,oldMoney=moving.cells[column('開單金額')].userEnteredValue;edit(moving.row,'預約日期',{numberValue:civil('2026-12-31')});edit(moving.row,'開單金額',{formulaValue:'=AF'+moving.row+'*2'});const beforeGate=capture(),review=oa3TryApiFinalize_(ss,opts),afterGate=capture();check(review&&review.review===true&&review.completed===false&&oa3FinalizeApiFingerprint_(beforeGate)===oa3FinalizeApiFingerprint_(afterGate),'staff_formula_review_not_readonly');result.staffFormulaGateVerified=true;
    phase='real_formula_sort';edit(moving.row,'預約日期',oldDate);edit(moving.row,'開單金額',oldMoney);formula=find(afterGate,data[2].id);edit(formula.row,'CS同事名',{stringValue:'SYNTHETIC CS 2'});edit(moving.row,'總金額',{formulaValue:'=SUM(AF'+moving.row+':AG'+moving.row+')'});edit(moving.row,'預約日期',{numberValue:civil('2026-12-31')});
    began=Date.now();let formulaReceipt=null,formulaUnknown=false;try{formulaReceipt=oa3TryApiFinalize_(ss,opts);}catch(ignored){formulaUnknown=true;}result.timings.formulaSortMs=Date.now()-began;captured=capture();const moved=find(captured,data[5].id),stored=value(moved,'總金額');result.formulaExpressionMoved=stored!=='=SUM(AF'+moving.row+':AG'+moving.row+')';result.formulaSortReportedUncertain=formulaUnknown;
    const order=captured[OA2.ARRIVAL].values.slice(OA2.FIRST_ROW-1).map((values,i)=>oa3SortKey_(values[column('預約日期')],values[column('時間')],values[column('Appointment ID')],i,values[column('結果')]));result.realFormulaSortObserved=moved.row!==moving.row&&order.every((key,i)=>!i||key>=order[i-1]);check(result.realFormulaSortObserved,'actual_formula_sort_not_observed');
    const response=Sheets.Spreadsheets.get(id,{ranges:[oa3FinalizeApiQuote_(OA2.ARRIVAL)+'!'+columnLetter_(column('總金額')+1)+moved.row],includeGridData:true,fields:'sheets(data(rowData(values(effectiveValue))))'}),effective=response&&response.sheets&&response.sheets[0]&&response.sheets[0].data&&response.sheets[0].data[0]&&response.sheets[0].data[0].rowData&&response.sheets[0].data[0].rowData[0]&&response.sheets[0].data[0].rowData[0].values&&response.sheets[0].data[0].rowData[0].values[0];
    result.relativeMoneySemanticVerified=!!effective&&!!effective.effectiveValue&&effective.effectiveValue.numberValue===500;
    check(formulaUnknown||formulaReceipt&&formulaReceipt.completed===true,'formula_sort_not_exercised');check(result.relativeMoneySemanticVerified,'relative_formula_money_changed');
    result.passed=true;phase='complete';return result;
  }catch(ignored){result.passed=false;return result;}
  finally{
    try{OA3_FINALIZE_API_ENABLED=oldFlag;OA3_FINALIZE_API_QA_CONTEXT=oldContext;if(locked)lock.releaseLock();result.cleanupVerified=OA3_FINALIZE_API_ENABLED===oldFlag&&OA3_FINALIZE_API_QA_CONTEXT===oldContext;}
    catch(ignored){result.passed=false;result.cleanupVerified=false;phase='cleanup_unconfirmed';}
    finally{result.phase=phase;result.assertions=assertions;result.elapsedMs=Date.now()-started;console.log(JSON.stringify(Object.assign({handler:'arrival_finalize_api_synthetic_qa'},result)));}
  }
}
