/**
 * Explicit read-only profiling; select a managed Account before running.
 * No installer, trigger, property access, lock, business-cell read or write.
 * The initial manual active-spreadsheet/range calls may warm SpreadsheetApp.
 * Neither order proves cold performance on an actual edit event's e.range.
 * Existing operational declarations/handlers are never replaced.
 */
function profileOmniEditReadNativeFirst20261022() {
  return oaEditReadProfile20261022_('native_first');
}
function profileOmniEditReadApiFirst20261022() {
  return oaEditReadProfile20261022_('api_first');
}
function oaEditReadProfile20261022_(order) {
  const started=Date.now(),receipt={handler:'edit_read_profile_20261022',readOnly:true,ok:false,order,
    manualActiveRange:true,actualEditEventColdProof:false,initialCallsMayWarmMetadata:true,
    phases:[],checks:{}};
  let phase='initialization';
  const measure=(name,action)=>{
    phase=name;const begin=Date.now();
    console.log(JSON.stringify({handler:receipt.handler,order,phase:name,state:'started'}));
    try {
      const result=action(),elapsedMs=Date.now()-begin;
      receipt.phases.push({phase:name,elapsedMs,ok:true});
      console.log(JSON.stringify({handler:receipt.handler,order,phase:name,state:'complete',elapsedMs}));
      return result;
    } catch(ignored) {
      const elapsedMs=Date.now()-begin;receipt.phases.push({phase:name,elapsedMs,ok:false});
      console.log(JSON.stringify({handler:receipt.handler,order,phase:name,state:'failed',elapsedMs}));
      throw new Error('profile_phase_failed');
    }
  };
  const finish=()=>{receipt.elapsedMs=Date.now()-started;console.log(JSON.stringify(receipt));return receipt;};
  const requireValue=(condition)=>{if(!condition)throw new Error('profile_validation_failed');};
  const supported=title=>Array.isArray(OMNI_ACCOUNT_TABS)&&OMNI_ACCOUNT_TABS.includes(title);
  const trimHeaders=values=>{const result=values.map(value=>String(value==null?'':value));while(result.length&&!result[result.length-1].trim())result.pop();return result;};
  const contract=(headers,title)=>{
    const memory={getName:()=>title,getLastColumn:()=>headers.length,
      getRange:(row,column,height,width)=>{
        requireValue(row===1&&column===1&&height===1&&width===headers.length);
        return {getDisplayValues:()=>[headers.slice()]};
      }};
    return {columns:getOmniColumns_(memory),meta:oa2Meta_(memory,false)};
  };
  try {
    requireValue(order==='native_first'||order==='api_first');
    requireValue(typeof OMNI_ACCOUNT_TABS!=='undefined'&&typeof getOmniColumns_==='function'&&typeof oa2Meta_==='function');
    const ss=measure('active_spreadsheet',()=>SpreadsheetApp.getActiveSpreadsheet());
    requireValue(!!ss);
    const spreadsheetId=measure('spreadsheet_id',()=>ss.getId());
    const range=measure('active_range',()=>ss.getActiveRange());
    if(!range){receipt.skipped=true;receipt.reason='no_active_range';return finish();}
    const gridId=measure('range_grid_id',()=>range.getGridId());
    requireValue(typeof spreadsheetId==='string'&&!!spreadsheetId&&Number.isInteger(gridId)&&gridId>=0);
    const readNative=()=>{
      const sheet=measure('native_range_sheet',()=>range.getSheet());
      const id=measure('native_sheet_id',()=>sheet.getSheetId());
      requireValue(id===gridId);
      const title=measure('native_get_name',()=>sheet.getName());
      if(!supported(title))return null;
      const width=measure('native_last_column',()=>sheet.getLastColumn());
      requireValue(Number.isInteger(width)&&width>0&&width<=256);
      const headers=trimHeaders(measure('native_header_display',()=>sheet.getRange(1,1,1,width).getDisplayValues()[0]));
      requireValue(headers.length>0);
      return {id,title,headers,contract:measure('native_header_contract',()=>contract(headers,title))};
    };
    const readApi=()=>{
      requireValue(typeof Sheets!=='undefined'&&Sheets&&Sheets.Spreadsheets&&typeof Sheets.Spreadsheets.getByDataFilter==='function');
      const select=response=>{
        requireValue(response&&response.spreadsheetId===spreadsheetId&&Array.isArray(response.sheets));
        const selected=response.sheets.filter(sheet=>sheet&&sheet.properties&&sheet.properties.sheetId===gridId);
        requireValue(selected.length===1);return selected[0];
      };
      const metadata=select(measure('api_grid_metadata',()=>Sheets.Spreadsheets.getByDataFilter(
        {dataFilters:[{gridRange:{sheetId:gridId}}],includeGridData:false},spreadsheetId,
        {fields:'spreadsheetId,sheets(properties(sheetId,title,gridProperties(columnCount)))'})));
      const title=metadata.properties.title;
      if(!supported(title))return null;
      const width=metadata.properties.gridProperties&&metadata.properties.gridProperties.columnCount;
      requireValue(Number.isInteger(width)&&width>0&&width<=256);
      const selected=select(measure('api_fresh_header',()=>Sheets.Spreadsheets.getByDataFilter(
        {dataFilters:[{gridRange:{sheetId:gridId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:width}}],includeGridData:true},spreadsheetId,
        {fields:'spreadsheetId,sheets(properties(sheetId,title,gridProperties(columnCount)),data(startRow,startColumn,rowData(values(formattedValue))))'})));
      requireValue(selected.properties.title===title&&supported(selected.properties.title)&&selected.properties.gridProperties.columnCount===width);
      const blocks=selected.data||[];
      requireValue(blocks.length===1&&(blocks[0].startRow||0)===0&&(blocks[0].startColumn||0)===0);
      const data=blocks[0].rowData||[];requireValue(data.length===1);
      const values=data[0].values||[];requireValue(values.length<=width);
      const headers=trimHeaders(Array.from({length:width},(_,i)=>values[i]&&values[i].formattedValue!==undefined?values[i].formattedValue:''));
      requireValue(headers.length>0);
      return {id:selected.properties.sheetId,title,headers,contract:measure('api_header_contract',()=>contract(headers,title))};
    };
    let native,api;
    if(order==='native_first'){native=readNative();if(native)api=readApi();}
    else {api=readApi();if(api)native=readNative();}
    if(!native||!api){receipt.skipped=true;receipt.reason='active_sheet_not_managed_account';return finish();}
    receipt.checks={gridBindingEqual:native.id===gridId&&api.id===gridId,
      freshTitleEqual:native.title===api.title,headerValuesEqual:JSON.stringify(native.headers)===JSON.stringify(api.headers),
      businessContractEqual:JSON.stringify(native.contract.columns)===JSON.stringify(api.contract.columns),
      metadataContractEqual:native.contract.meta===api.contract.meta};
    receipt.ok=Object.keys(receipt.checks).every(key=>receipt.checks[key]);
    return finish();
  } catch(ignored) {
    receipt.errorCode='profile_read_or_contract_failed';receipt.failedPhase=phase;return finish();
  }
}
