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
