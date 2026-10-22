const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {loadRelease}=require('./fixtures/native-arrival/identity-priority-fixture.cjs');
const source=fs.readFileSync(path.join(__dirname,'apps-script/releases/20261022/edit-read-profile-qa.gs'),'utf8');
const tests=[];
function test(name,run){run();tests.push(name);}
function fixture(options={}){
  const f=loadRelease(),box=f.box,headers=f.sourceHeaders(),calls=[],apiCalls=[],title='Synthetic Account',grid=7,spreadsheetId='synthetic_profile_workbook';
  vm.runInContext('OMNI_ACCOUNT_TABS.splice(0, OMNI_ACCOUNT_TABS.length, "Synthetic Account")',box);
  const forbidden=new Proxy({}, {get(){throw Error('Forbidden service boundary');}});
  box.PropertiesService=forbidden;box.LockService=forbidden;box.ScriptApp=forbidden;box.CacheService=forbidden;box.UrlFetchApp=forbidden;
  const step=(name,result)=>{calls.push(name);if(options.fail===name)throw Error('PRIVATE_PROVIDER_DETAIL');return result;};
  const sheet={getSheetId:()=>step('sheet_id',options.badNativeGrid?8:grid),getName:()=>step('sheet_name',options.unsupported?'Other tab':title),
    getLastColumn:()=>step('last_column',headers.length),getRange:(row,column,height,width)=>{
      if(height===undefined&&width===undefined){assert.deepEqual([row,column],[1,1]);return step('header_range',range);}
      assert.deepEqual([row,column,height,width],[1,1,1,headers.length],'Only the Account header row may be read');
      return {getDisplayValues:()=>step('native_header',[headers.slice()])};
    }};
  const range={getGridId:()=>step('grid_id',grid),getSheet:()=>step('range_sheet',sheet)};
  const ss={getId:()=>step('spreadsheet_id',spreadsheetId),getActiveSheet:()=>step('active_sheet',options.noSheet?null:sheet),getActiveRange:()=>{throw new TypeError('PRIVATE_ACTIVE_RANGE_UNAVAILABLE');}};
  box.SpreadsheetApp={getActiveSpreadsheet:()=>step('active_spreadsheet',ss)};
  box.Sheets={Spreadsheets:{getByDataFilter:(body,id,args)=>{
    assert.equal(id,spreadsheetId);apiCalls.push({body,args});
    const filter=body.dataFilters[0].gridRange;assert.equal(filter.sheetId,grid);
    if(!body.includeGridData){
      assert.deepEqual(Object.keys(filter),['sheetId']);assert.ok(!args.fields.includes('rowData'));
      step('api_metadata');
    }else{
      assert.deepEqual([filter.startRowIndex,filter.endRowIndex,filter.startColumnIndex,filter.endColumnIndex],[0,1,0,headers.length]);
      step('api_header');
    }
    const apiHeaders=headers.slice();if(options.headerDrift)apiHeaders.push('Extra header');
    if(options.invalidMetadata)apiHeaders[apiHeaders.length-1]='Broken metadata';
    const properties={sheetId:grid,title:options.unsupported?'Other tab':title,gridProperties:{columnCount:headers.length}};
    if(body.includeGridData&&options.rename)properties.title='Other tab';
    const selected={properties};
    if(body.includeGridData)selected.data=[{startRow:0,startColumn:0,rowData:[{values:apiHeaders.map(formattedValue=>({formattedValue}))}]}];
    return {spreadsheetId:options.badSpreadsheet?'wrong_workbook':spreadsheetId,sheets:options.duplicateGrid?[selected,selected]:[selected]};
  }}};
  vm.runInContext(source,box,{filename:'edit-read-profile-qa.gs'});
  return {box,calls,apiCalls,logs:f.logs,run:order=>box[order==='api_first'?'profileOmniEditReadApiFirst20261022':'profileOmniEditReadNativeFirst20261022']()};
}
for(const order of ['native_first','api_first'])test(`${order} reads headers only and emits no runtime identity/header values`,()=>{
  const f=fixture(),r=f.run(order);assert.equal(r.ok,true);assert.equal(r.readOnly,true);assert.equal(r.manualActiveSheet,true);assert.equal(r.manualHeaderRange,true);assert.equal(r.manualActiveRange,undefined);assert.equal(r.actualEditEventColdProof,false);assert.equal(r.initialCallsMayWarmMetadata,true);
  assert.ok(Object.values(r.checks).every(Boolean));assert.equal(f.apiCalls.length,2);
  assert.equal(f.calls.indexOf('native_header')<f.calls.indexOf('api_metadata'),order==='native_first');
  const output=JSON.stringify(r)+f.logs.join('\n');
  for(const privateText of ['Synthetic Account','synthetic_profile_workbook','最後更新日期','Omni Lead ID','PRIVATE_PROVIDER_DETAIL'])assert.ok(!output.includes(privateText));
  assert.ok(r.phases.every(p=>typeof p.elapsedMs==='number'&&typeof p.ok==='boolean'));
});
test('missing active sheet returns without header/API reads',()=>{const f=fixture({noSheet:true}),r=f.run('api_first');assert.equal(r.skipped,true);assert.equal(r.reason,'no_active_sheet');assert.equal(f.apiCalls.length,0);assert.ok(!f.calls.includes('native_header'));});
for(const order of ['native_first','api_first'])test(`${order} rejects an unmanaged active tab before header reads`,()=>{const f=fixture({unsupported:true}),r=f.run(order);assert.equal(r.skipped,true);assert.ok(!f.calls.includes('native_header'));assert.ok(!f.calls.includes('api_header'));});
for(const option of ['badNativeGrid','badSpreadsheet','duplicateGrid','rename','invalidMetadata'])test(`${option} fails closed with sanitized output`,()=>{const f=fixture({[option]:true}),r=f.run('api_first');assert.equal(r.ok,false);assert.equal(r.errorCode,'profile_read_or_contract_failed');assert.ok(!JSON.stringify(r).includes('Synthetic Account'));});
test('provider failure returns phase evidence without raw provider text',()=>{const f=fixture({fail:'api_metadata'}),r=f.run('api_first');assert.equal(r.ok,false);assert.equal(r.failedPhase,'api_grid_metadata');assert.ok(!JSON.stringify(r).includes('PRIVATE_PROVIDER_DETAIL'));assert.ok(!f.logs.join('\n').includes('PRIVATE_PROVIDER_DETAIL'));});
test('an unavailable getActiveRange does not affect the manual active-sheet header profile',()=>{const f=fixture(),r=f.run('api_first');assert.equal(r.ok,true);assert.ok(f.calls.includes('header_range'));assert.ok(!JSON.stringify(r).includes('PRIVATE_ACTIVE_RANGE_UNAVAILABLE'));});
for(const [name,message,expected]of [['TypeError','PRIVATE_TYPE_DETAIL','type_error'],['Error','Permission denied PRIVATE_PERMISSION_DETAIL','permission'],['Error','Service timed out PRIVATE_PROVIDER_DETAIL','provider']])test(`failure classification only exposes allowlisted category ${expected}`,()=>{
  const f=fixture();f.box.SpreadsheetApp.getActiveSpreadsheet=()=>{const e=new Error(message);e.name=name;throw e;};const r=f.run('api_first');assert.equal(r.ok,false);assert.equal(r.errorCategory,expected);assert.ok(!JSON.stringify(r).includes('PRIVATE_'));assert.ok(!f.logs.join('\n').includes('PRIVATE_'));
});
test('standalone profile contains no mutating service surface or operational handler declarations',()=>{
  assert.ok(!/LockService|PropertiesService|ScriptApp|CacheService|UrlFetchApp|\.flush\(|\.set[A-Z]|\.clear[A-Z]|\.delete[A-Z]|\.insert[A-Z]|\.activate\(|\.toast\(|batchUpdate|Values\.update/.test(source));
  assert.ok(!/function\s+(?:onEdit|onOmniLeadInstallableEdit|handleOmniLeadEdit_|omniArrivalV2Timer)\s*\(/.test(source));
  assert.ok(!/Alyssa|GOS Beauty|Ineffable|Skin Light|docs\.google|https?:\/\//.test(source));
});
console.log(JSON.stringify({passed:tests.length,readOnly:true,tests},null,2));
