const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname,tests=[],failures=[],epoch=Date.UTC(1899,11,30),dayMs=86400000;
const copy=value=>value instanceof Date?new Date(value):Array.isArray(value)?value.map(copy):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copy(v)])):value;
const civilDay=day=>(Date.parse(day+'T00:00:00Z')-epoch)/dayMs;
function fixture(options={}){
  const logs=[],b={Date,console:{log:value=>logs.push(String(value))},Utilities:{formatDate:(date,tz,pattern)=>{assert.equal(tz,'Asia/Hong_Kong');const text=new Date(date.getTime()+8*3600000).toISOString();return pattern==='HH:mm'?text.slice(11,16):pattern==="yyyy-MM-dd'T'HH:mm:ss.SSS"?text.slice(0,23):text.slice(0,10);}}};
  vm.createContext(b);
  for(const path of ['apps-script/releases/20261022/native-main.gs','apps-script/releases/20261022/arrival-workflow.gs','apps-script/releases/20261022/arrival-integrity.gs','apps-script/arrival-queue-append-api.gs'])vm.runInContext(fs.readFileSync(root+'/'+path,'utf8'),b);
  const enabledByDefault=vm.runInContext('OA2_QUEUE_APPEND_API_ENABLED',b);
  const headers=['品牌','電話','客人／預約','CS同事名','預約日期','時間','結果','到店日期','備註','檢查提示','Account','客人識別','電話末4','療程','分店','原預約日期（自動）','可追溯Book日期（自動）','Book日期來源（自動）','補充Book登記日期','穩定客戶識別（內部）','到店紀錄ID（內部）','客戶＋預約日期時間（內部）','Appointment ID','Schedule Revision','Queue State','Outcome Recorded At','Omni Lead ID','Booking Registered At','Record Origin','sortKey','來源','試做價','開單金額','總金額'];
  const cells=new Map(),ledgerRows=new Map(),ledgerOwners=new Set(),historyRows=new Map([[1,Array.from(vm.runInContext('OA2.HISTORY_HEADERS',b))]]),sourceRows=new Map(),sourceOwners=new Set(),sourceHeaders=Array.from(vm.runInContext('OMNI_HEADERS.concat(OA2.ACCOUNT_HEADERS)',b)),apiCalls=[],getCalls=[],nativeWrites=[],grid={rowCount:options.rowCount??1000,columnCount:38},control={beforeBatch:null,afterBatch:null,beforeGet:null,afterGet:null,failBeforeStage:0,failAfterStage:0,blockNativeReads:false,held:true};let nativeReads=0;
  const address=(row,col)=>row+':'+col;
  const cell=(row,col)=>{const key=address(row,col);if(!cells.has(key))cells.set(key,{});return cells.get(key);};
  const set=(row,header,value)=>{const col=typeof header==='number'?header:headers.indexOf(header)+1;assert.ok(col>0);const current=cell(row,col);delete current.userEnteredValue;current.nativeValue=copy(value);};
  headers.forEach((header,index)=>set(7,index+1,header));
  const readCell=(row,col)=>{
    const current=cell(row,col);if('nativeValue'in current)return copy(current.nativeValue);
    const value=current.userEnteredValue;if(!value)return'';
    if('stringValue'in value)return value.stringValue;if('formulaValue'in value)return value.formulaValue;if('boolValue'in value)return value.boolValue;
    if('numberValue'in value){const kind=current.userEnteredFormat?.numberFormat?.type;return['DATE','TIME','DATE_TIME'].includes(kind)?new Date(epoch+value.numberValue*dayMs-8*3600000):value.numberValue;}
    return'';
  };
  const get=(row,header)=>readCell(row,typeof header==='number'?header:headers.indexOf(header)+1);
  const nativeForbidden=method=>{nativeWrites.push(method);throw new Error('Native mutation/fallback is forbidden in append API tests: '+method);};
  const nativeRead=method=>{if(control.blockNativeReads)throw new Error('Adapter must not use native read: '+method);nativeReads++;};
  const sheet={getName:()=> '到店紀錄',getSheetId:()=>17,getLastColumn:()=>{nativeRead('getLastColumn');return headers.length;},getMaxColumns:()=>{nativeRead('getMaxColumns');return grid.columnCount;},getMaxRows:()=>{nativeRead('getMaxRows');return grid.rowCount;},getLastRow:()=>{nativeRead('getLastRow');return Math.max(7,...Array.from(cells.keys(),key=>Number(key.split(':')[0])));},insertRowsAfter:()=>nativeForbidden('insertRowsAfter'),
    getRange:(row,col,height=1,width=1)=>({getValues:()=>{nativeRead('getValues');return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>readCell(row+i,col+j)));},getDisplayValues:()=>{nativeRead('getDisplayValues');return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String(readCell(row+i,col+j))));},getFormulas:()=>{nativeRead('getFormulas');return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>cell(row+i,col+j).userEnteredValue?.formulaValue||''));},setValues:()=>nativeForbidden('setValues'),clearDataValidations:()=>nativeForbidden('clearDataValidations'),setDataValidation:()=>nativeForbidden('setDataValidation'),setNumberFormat:()=>nativeForbidden('setNumberFormat')})};
  const ss={getId:()=> 'PRIVATE_SPREADSHEET',getSheetByName:name=>{assert.equal(name,'到店紀錄');return sheet;}};
  const applyFields=(row,col,payload,fields)=>{
    assert.ok(fields&&fields!=='*','Batch requests need narrow field masks');
    const current=cell(row,col);
    for(const field of fields.split(',').map(s=>s.trim())){
      if(field==='userEnteredValue'){
        delete current.nativeValue;
        if(payload.userEnteredValue===undefined)delete current.userEnteredValue;
        else{const value=payload.userEnteredValue,keys=Object.keys(value);assert.ok(keys.length<=1&&keys.every(key=>['stringValue','formulaValue','numberValue','boolValue'].includes(key)),'Cell values must use a valid ExtendedValue union');if('numberValue'in value)assert.ok(Number.isFinite(value.numberValue));if('stringValue'in value)assert.equal(typeof value.stringValue,'string');if('formulaValue'in value)assert.equal(typeof value.formulaValue,'string');current.userEnteredValue=copy(value);}
      }
      else if(field==='userEnteredFormat.numberFormat'){current.userEnteredFormat??={};current.userEnteredFormat.numberFormat=copy(payload.userEnteredFormat?.numberFormat);}
      else if(field==='dataValidation')current.dataValidation=copy(payload.dataValidation);
      else assert.fail('Unexpected broad or unrelated field mutation: '+field);
    }
  };
  const bounds=range=>{assert.equal(range.sheetId,17);assert.ok(Number.isInteger(range.startRowIndex)&&Number.isInteger(range.endRowIndex)&&range.endRowIndex>range.startRowIndex&&range.endRowIndex<=grid.rowCount);assert.ok(Number.isInteger(range.startColumnIndex)&&Number.isInteger(range.endColumnIndex)&&range.endColumnIndex>range.startColumnIndex&&range.endColumnIndex<=grid.columnCount);return range;};
  const apply=request=>{
    if(request.updateCells){const value=request.updateCells,range=value.range||{sheetId:value.start.sheetId,startRowIndex:value.start.rowIndex,endRowIndex:value.start.rowIndex+value.rows.length,startColumnIndex:value.start.columnIndex,endColumnIndex:value.start.columnIndex+Math.max(...value.rows.map(r=>r.values.length))};bounds(range);
      assert.equal(value.rows.length,range.endRowIndex-range.startRowIndex);
      value.rows.forEach((row,i)=>{assert.ok(Array.isArray(row.values));row.values.forEach((payload,j)=>{assert.ok(range.startColumnIndex+j<range.endColumnIndex);applyFields(range.startRowIndex+i+1,range.startColumnIndex+j+1,payload,value.fields);});});
    }else if(request.repeatCell){const value=request.repeatCell,range=bounds(value.range);for(let row=range.startRowIndex;row<range.endRowIndex;row++)for(let col=range.startColumnIndex;col<range.endColumnIndex;col++)applyFields(row+1,col+1,value.cell,value.fields);
    }else if(request.setDataValidation){const value=request.setDataValidation,range=bounds(value.range);for(let row=range.startRowIndex;row<range.endRowIndex;row++)for(let col=range.startColumnIndex;col<range.endColumnIndex;col++)cell(row+1,col+1).dataValidation=copy(value.rule);
    }else if(request.appendDimension){assert.equal(request.appendDimension.sheetId,17);assert.equal(request.appendDimension.dimension,'ROWS');assert.ok(Number.isSafeInteger(request.appendDimension.length)&&request.appendDimension.length>0);grid.rowCount+=request.appendDimension.length;
    }else assert.fail('Unexpected Sheets mutation request: '+Object.keys(request).join(','));
  };
  const columnIndex=letters=>Array.from(letters).reduce((value,letter)=>value*26+letter.charCodeAt(0)-64,0)-1;
  const gridData=range=>{
    const match=/^(?:'((?:[^']|'')+)'|([^!]+))!(.+)$/.exec(range);assert.ok(match,'GET must use an explicit sheet-scoped range: '+range);const title=(match[1]||match[2]).replace(/''/g,"'");assert.ok(['到店紀錄','_appointment_registry','_appointment_history'].includes(title)||sourceRows.has(title));
    const a1=match[3].replace(/\$/g,''),whole=/^(\d+):(\d+)$/.exec(a1),part=/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(a1);assert.ok(whole||part,'GET must use a bounded header/row range: '+range);
    const startRow=Number(whole?whole[1]:part[2])-1,endRow=Number(whole?whole[2]:part[4]||part[2]),startColumn=whole?0:columnIndex(part[1]),endColumn=whole?(title==='到店紀錄'?grid.columnCount:title==='_appointment_registry'?28:title==='_appointment_history'?8:sourceHeaders.length):columnIndex(part[3]||part[1])+1;
    if(title==='到店紀錄')assert.ok(endRow<=grid.rowCount,'Target GET cannot precede capacity growth');
    return{startRow,startColumn,rowData:Array.from({length:endRow-startRow},(_,i)=>({values:Array.from({length:endColumn-startColumn},(_,j)=>{
      const value=title==='到店紀錄'?cell(startRow+i+1,startColumn+j+1):title==='_appointment_registry'?{nativeValue:ledgerRows.get(startRow+i+1)?.[startColumn+j]??''}:title==='_appointment_history'?{nativeValue:historyRows.get(startRow+i+1)?.[startColumn+j]??''}:{nativeValue:startRow+i===0?sourceHeaders[startColumn+j]??'':sourceRows.get(title)?.get(startRow+i+1)?.[startColumn+j]??''};if(value.userEnteredValue)return{userEnteredValue:copy(value.userEnteredValue)};
      if(!('nativeValue'in value)||value.nativeValue==='')return{};
      const entered=value.nativeValue;return{userEnteredValue:entered instanceof Date?{numberValue:(entered.getTime()+8*3600000-epoch)/dayMs}:typeof entered==='number'?{numberValue:entered}:typeof entered==='boolean'?{boolValue:entered}:{stringValue:String(entered)}};
    })}))};
  };
  b.Sheets={Spreadsheets:{get:(id,options)=>{
    assert.equal(id,ss.getId());assert.ok(Array.isArray(options.ranges)&&options.ranges.length>0);const queueRead=options.ranges.some(range=>range.startsWith("'到店紀錄'!"));assert.ok(options.fields.includes('userEnteredValue')&&(!queueRead||options.fields.includes('timeZone')),'Queue GET needs explicit timezone; every GET needs typed raw cells');
    const stage=getCalls.length+1;if(control.beforeGet)control.beforeGet(stage,options);getCalls.push(copy(options));
    const titleOf=range=>/^(?:'((?:[^']|'')+)'|([^!]+))!/.exec(range).slice(1).filter(Boolean)[0].replace(/''/g,"'"),titles=[...new Set(options.ranges.map(titleOf))];
    const response={spreadsheetId:id,properties:{timeZone:'Asia/Hong_Kong'},sheets:titles.map(title=>({properties:{sheetId:title==='到店紀錄'?17:title==='_appointment_registry'?18:title==='_appointment_history'?20:19,title,gridProperties:title==='到店紀錄'?copy(grid):{rowCount:1000,columnCount:title==='_appointment_registry'?28:title==='_appointment_history'?8:sourceHeaders.length}},data:options.ranges.filter(range=>titleOf(range)===title).map(gridData)}))};if(control.afterGet)control.afterGet(stage,response,options);return response;
  },batchUpdate:(body,id)=>{
    assert.equal(id,ss.getId());assert.ok(Array.isArray(body.requests)&&body.requests.length>0);const stage=apiCalls.length+1;
    if(control.beforeBatch)control.beforeBatch(stage);
    apiCalls.push(copy(body));if(control.failBeforeStage===stage)throw new Error('PRIVATE_API_FAILURE_BEFORE_'+stage);
    body.requests.forEach(apply);
    if(control.afterBatch)control.afterBatch(stage);
    if(control.failAfterStage===stage)throw new Error('PRIVATE_API_RESPONSE_LOST_AFTER_'+stage);
    return{spreadsheetId:id,replies:body.requests.map(()=>({}))};
  }}};
  b.SpreadsheetApp={flush(){},newDataValidation:()=>nativeForbidden('newDataValidation')};
  b.LockService={getDocumentLock:()=>({hasLock:()=>control.held})};
  b.OA2_QUEUE_APPEND_API_ENABLED=true;
  const a={id:'appt_a',leadId:'lead_a',queueId:'arrival_a',account:'GOS Beauty',customerKey:'GOS Beauty|p:01230001',phone:'01230001',name:'=UNTRUSTED_NAME()',brand:'Synthetic brand',treatment:'=UNTRUSTED_TREATMENT()',branch:'=UNTRUSTED_BRANCH()',date:'2026-11-18',time:'15:30',bookedAt:'2026-11-16T16:30:00.000Z',provenance:'observed_booking_edit',state:'active',outcome:'',arrivalDate:'',outcomeAt:'',revision:1,pendingArrivalOverride:'scheduled',pendingQueueBefore:'new',...options.appointment};
  const record={row:2,leadId:a.leadId,appointmentId:a.id,account:a.account,customerKey:a.customerKey,phone:a.phone,fullPhone:a.phone,name:a.name,brand:a.brand,treatment:a.treatment,branch:a.branch};
  const ctx={appointments:{[a.id]:a},rows:{[a.id]:2},events:[],today:'2026-11-16',now:'2026-11-16T01:00:00.000Z',dryRun:false};
  const operations=[{kind:'append',appt:a,row:8,entryId:a.queueId}];
  const queue=()=>b.oa2ReadQueue_(ss,false);
  const syncLedger=(appointment,row)=>{row??=ctx.rows[appointment.id]??Math.max(1,...ledgerRows.keys())+1;ctx.rows[appointment.id]=row;ledgerRows.set(row,b.oa2LedgerRow_(appointment));ledgerOwners.add(appointment.id);};
  const ensureLedger=()=>Object.values(ctx.appointments).forEach(appointment=>{if(!ledgerOwners.has(appointment.id))syncLedger(appointment);});ensureLedger();
  const ensureSources=records=>records.forEach(source=>{if(sourceOwners.has(source.leadId))return;if(!sourceRows.has(source.account))sourceRows.set(source.account,new Map());const values=Array(sourceHeaders.length).fill('');[source.leadId,source.appointmentId,'','','',''].forEach((value,index)=>values[25+index]=value);sourceRows.get(source.account).set(source.row,values);sourceOwners.add(source.leadId);});ensureSources([record]);
  const call=(ops=operations,records=[record])=>{ensureLedger();ensureSources(records);const current=queue();control.blockNativeReads=true;try{return b.oa2WriteQueueAppendApi_(ss,ctx,current,ops,records);}finally{control.blockNativeReads=false;}};
  const run=()=>call();
  return{b,logs,headers,cells,ledgerRows,historyRows,sourceRows,sourceHeaders,grid,apiCalls,getCalls,nativeWrites,control,sheet,ss,a,ctx,record,operations,queue,call,run,set,get,cell,syncLedger,ensureLedger,ensureSources,enabledByDefault,nativeReads:()=>nativeReads};
}
function test(name,run){try{run();tests.push(name);}catch(error){failures.push({name,error:error.message,stack:error.stack});}}
function allocating(f,overrides={}){
  const values={'Appointment ID':f.a.id,'Schedule Revision':1,'Queue State':'待確認','Omni Lead ID':f.a.leadId,'Booking Registered At':'','Record Origin':'allocating','到店紀錄ID（內部）':f.a.queueId,'穩定客戶識別（內部）':f.a.customerKey,'Account':f.a.account,...overrides};
  for(const[header,value]of Object.entries(values))f.set(8,header,value);
}
function snapshot(f,row){return Array.from({length:38},(_,index)=>f.get(row,index+1));}
function writtenValues(f){return f.apiCalls.flatMap(batch=>batch.requests.flatMap(request=>request.updateCells?request.updateCells.rows.flatMap(row=>row.values.map(value=>value.userEnteredValue).filter(Boolean)):[]));}

test('append uses three separately acknowledged stages and only narrow updateCells/repeatCell requests',()=>{
  const f=fixture();f.run();assert.equal(f.apiCalls.length,3);assert.equal(f.get(8,'Record Origin'),'managed');assert.equal(f.get(8,'Appointment ID'),f.a.id);assert.equal(f.get(8,'Omni Lead ID'),f.a.leadId);assert.equal(f.get(8,'到店紀錄ID（內部）'),f.a.queueId);assert.equal(f.nativeWrites.length,0);assert.ok(f.nativeReads()>0);
  for(const batch of f.apiCalls)for(const request of batch.requests)assert.ok(request.updateCells||request.repeatCell||request.setDataValidation);
  const stageValues=index=>f.apiCalls[index].requests.flatMap(request=>request.updateCells?request.updateCells.rows.flatMap(row=>row.values.map(value=>value.userEnteredValue?.stringValue)):[]);
  assert.ok(stageValues(0).includes('allocating'));assert.ok(!stageValues(0).includes('managed'));assert.ok(stageValues(2).includes('managed'));
});

test('untrusted leading-equals text is always stringValue; only system association/check cells receive formulaValue',()=>{
  const f=fixture();f.run();const values=writtenValues(f);
  for(const text of [f.a.name,f.a.treatment,f.a.branch,'0001'])assert.ok(values.some(value=>value.stringValue===text),text);
  for(const batch of f.apiCalls)for(const request of batch.requests){if(!request.updateCells)continue;const update=request.updateCells,start=update.range?.startColumnIndex??update.start.columnIndex;
    for(const row of update.rows)row.values.forEach((cell,index)=>{if(cell.userEnteredValue?.formulaValue){const header=f.headers[start+index];assert.ok(['客戶＋預約日期時間（內部）','檢查提示'].includes(header),'Untrusted text must not enter formula cells: '+header);assert.ok(cell.userEnteredValue.formulaValue.startsWith('=IF('));}});
  }
  assert.equal(f.get(8,'客人識別'),f.a.name);assert.equal(f.get(8,'療程'),f.a.treatment);assert.equal(f.get(8,'電話末4'),'0001');
});

test('dates and booking timestamps use Hong Kong civil serials; time remains a numeric fraction',()=>{
  const f=fixture();f.run();const serial=(header)=>f.cell(8,f.headers.indexOf(header)+1).userEnteredValue?.numberValue;
  assert.equal(serial('預約日期'),civilDay('2026-11-18'));assert.equal(serial('時間'),15.5/24);assert.equal(serial('到店日期'),civilDay('2026-11-18'));
  assert.equal(serial('可追溯Book日期（自動）'),civilDay('2026-11-17'));assert.ok(Math.abs(serial('Booking Registered At')-(civilDay('2026-11-17')+0.5/24))<1e-8);
  assert.equal(f.b.oa2Date_(f.get(8,'預約日期')),'2026-11-18');assert.equal(f.b.oa2Time_(f.get(8,'時間')),'15:30');
});

for(const time of ['', '00:00'])test('blank and midnight time stay distinct: '+JSON.stringify(time),()=>{
  const f=fixture({appointment:{time}});f.run();const cell=f.cell(8,f.headers.indexOf('時間')+1);
  if(time==='')assert.ok(!cell.userEnteredValue||!('numberValue'in cell.userEnteredValue));else assert.equal(cell.userEnteredValue.numberValue,0);
});

test('sparse physical columns preserve prefix, CS, owned notes and zero-valued manual money',()=>{
  const f=fixture();allocating(f);f.set(8,'品牌','Keep brand');f.set(8,'電話','Keep phone');f.set(8,'CS同事名','Keep CS');f.set(8,'備註','=Keep literal note');f.set(8,'試做價',0);f.set(8,'開單金額',1280);f.set(8,'來源','Keep source');f.set(8,'總金額','=KEEP_MONEY_FORMULA');
  const retained=['品牌','電話','CS同事名','備註','試做價','開單金額','來源','總金額'].map(header=>[header,f.get(8,header)]);f.run();
  for(const[header,value]of retained)assert.equal(f.get(8,header),value,header+' must stay attached to the same appointment');
  assert.equal(f.nativeWrites.length,0);
});

test('contiguous appends and a separated target row preserve the intervening existing row',()=>{
  const f=fixture(),second={...f.a,id:'appt_b',leadId:'lead_b',queueId:'arrival_b',customerKey:'GOS Beauty|p:10000002',phone:'10000002'},third={...f.a,id:'appt_c',leadId:'lead_c',queueId:'arrival_c',customerKey:'GOS Beauty|p:10000003',phone:'10000003'};
  f.ctx.appointments[second.id]=second;f.ctx.appointments[third.id]=third;
  const ops=[...f.operations,{kind:'append',appt:second,row:9,entryId:second.queueId},{kind:'append',appt:third,row:11,entryId:third.queueId}];
  for(const header of ['品牌','電話','CS同事名','結果','備註','試做價','開單金額'])f.set(10,header,'Keep '+header);const before=snapshot(f,10);
  f.call(ops,[f.record,{...f.record,row:3,leadId:second.leadId,appointmentId:second.id,phone:second.phone,fullPhone:second.phone,customerKey:second.customerKey},{...f.record,row:4,leadId:third.leadId,appointmentId:third.id,phone:third.phone,fullPhone:third.phone,customerKey:third.customerKey}]);
  assert.deepEqual(snapshot(f,10),before);assert.equal(f.get(8,'Record Origin'),'managed');assert.equal(f.get(9,'Record Origin'),'managed');assert.equal(f.get(11,'Record Origin'),'managed');
});

for(const[header,value]of [['試做價',0],['結果','No Show'],['備註','Staff note'],['預約日期','2026-12-01']])test('initial occupied blank slot is rejected before allocating marker: '+header,()=>{
  const f=fixture();f.set(8,header,value);assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.get(8,header),value);
});

for(const[header,value]of [['Appointment ID','foreign_appointment'],['Omni Lead ID','foreign_lead'],['到店紀錄ID（內部）','foreign_entry']])test('foreign partial allocating ownership cannot be adopted: '+header,()=>{
  const f=fixture();allocating(f,{[header]:value});assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.get(8,header),value);
});

for(const stage of [1,2])test('staff input or ownership change after acknowledged stage is rejected before further mutation: '+stage,()=>{
  const f=fixture();f.control.afterBatch=current=>{if(current===stage)f.set(8,'結果','No Show');};assert.throws(()=>f.run());assert.equal(f.apiCalls.length,stage);assert.equal(f.get(8,'結果'),'No Show');assert.equal(f.get(8,'Record Origin'),'allocating');assert.equal(f.nativeWrites.length,0);
});

for(const stage of [1,2])test('unknown response after allocating/payload keeps stable owner and retry uses the same row: '+stage,()=>{
  const f=fixture();f.control.failAfterStage=stage;assert.throws(()=>f.run());assert.equal(f.get(8,'Record Origin'),'allocating');assert.equal(f.get(8,'Appointment ID'),f.a.id);assert.equal(f.get(8,'Omni Lead ID'),f.a.leadId);
  f.control.failAfterStage=0;f.run();assert.equal(f.get(8,'Record Origin'),'managed');assert.equal(f.get(8,'到店紀錄ID（內部）'),f.a.queueId);assert.equal(f.sheet.getLastRow(),8);assert.equal(f.nativeWrites.length,0);
});

test('managed marker committed with a lost response acknowledges the same complete tuple without another API write',()=>{
  const f=fixture();f.control.failAfterStage=3;assert.throws(()=>f.run());assert.equal(f.get(8,'Record Origin'),'managed');const writes=f.apiCalls.length,before=snapshot(f,8);
  f.control.failAfterStage=0;const result=f.run();assert.equal(result.alreadyManaged,1);assert.equal(f.apiCalls.length,writes);assert.deepEqual(snapshot(f,8),before);assert.equal(f.nativeWrites.length,0);
});

for(const[header,value]of [['結果','No Show'],['到店日期','2026-11-20']])test('allocating retry preserves fresh colleague outcome/H override instead of replacing it: '+header,()=>{
  const f=fixture();f.control.failAfterStage=2;assert.throws(()=>f.run());assert.equal(f.get(8,'Record Origin'),'allocating');
  f.set(8,header,value);f.control.failAfterStage=0;const writes=f.apiCalls.length;
  assert.throws(()=>f.run());assert.equal(f.apiCalls.length,writes,'Fresh colleague changes must be rejected before another marker/payload write');assert.equal(f.get(8,header),value);assert.equal(f.get(8,'Record Origin'),'allocating');
});

test('typed CAS distinguishes a literal leading-equals note from the same text changed into a formula',()=>{
  const f=fixture();allocating(f);f.set(8,'備註','=KEEP_NOTE()');f.control.afterBatch=stage=>{if(stage===1){const target=f.cell(8,f.headers.indexOf('備註')+1);delete target.nativeValue;target.userEnteredValue={formulaValue:'=KEEP_NOTE()'};}};
  assert.throws(()=>f.run());assert.equal(f.apiCalls.length,1);assert.equal(f.cell(8,f.headers.indexOf('備註')+1).userEnteredValue.formulaValue,'=KEEP_NOTE()');assert.equal(f.get(8,'Record Origin'),'allocating');
});

test('typed CAS rejects a literal customer descriptor changed to the same formula after payload',()=>{
  const f=fixture();f.control.afterBatch=stage=>{if(stage===2){const target=f.cell(8,f.headers.indexOf('客人識別')+1);target.userEnteredValue={formulaValue:f.a.name};delete target.nativeValue;}};
  assert.throws(()=>f.run());assert.equal(f.apiCalls.length,2);assert.equal(f.get(8,'Record Origin'),'allocating');
});

test('managed-marker API failure has no native fallback and leaves payload recoverable',()=>{
  const f=fixture();f.control.failBeforeStage=3;assert.throws(()=>f.run());assert.equal(f.get(8,'Record Origin'),'allocating');assert.equal(f.get(8,'客人識別'),f.a.name);assert.equal(f.nativeWrites.length,0);
});

test('dry-run context cannot issue an append API mutation',()=>{
  const f=fixture();f.ctx.dryRun=true;assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.nativeWrites.length,0);
});

test('unheld document lock cannot issue any API read or mutation',()=>{
  const f=fixture();f.control.held=false;assert.throws(()=>f.run());assert.equal(f.getCalls.length,0);assert.equal(f.apiCalls.length,0);
});

test('missing Advanced Sheets service fails without trying native mutation',()=>{
  const f=fixture();delete f.b.Sheets;assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.nativeWrites.length,0);
});

for(const mismatch of ['timezone','sheet','target-coverage','negative-grid-rows','negative-sheet-id'])test('unverified API read context fails before a mutation: '+mismatch,()=>{
  const f=fixture();f.control.afterGet=(stage,response,options)=>{
    if(!options.ranges.some(range=>range.startsWith("'到店紀錄'!")))return;
    if(mismatch==='timezone')response.properties.timeZone='UTC';
    if(mismatch==='sheet')response.sheets[0].properties.title='Other sheet';
    if(mismatch==='target-coverage'&&options.ranges.some(range=>range.startsWith("'到店紀錄'!A8:")))response.sheets[0].data=response.sheets[0].data.filter(block=>block.startRow===6);
    if(mismatch==='negative-grid-rows')response.sheets[0].properties.gridProperties.rowCount=-1;
    if(mismatch==='negative-sheet-id')response.sheets[0].properties.sheetId=-1;
  };
  assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.nativeWrites.length,0);
});

test('no operations returns without API access; mixed operations are rejected by the append-only adapter',()=>{
  const f=fixture();f.call([],[]);assert.equal(f.apiCalls.length,0);
  assert.throws(()=>f.call([...f.operations,{kind:'refresh',appt:f.a,row:9}],[]));assert.equal(f.apiCalls.length,0);
});

for(const[header,value]of [['Omni Lead ID','unknown_lead'],['Record Origin','managed'],['到店紀錄ID（內部）','unknown_entry'],['品牌','Keep brand'],['電話','Keep phone'],['CS同事名','Keep CS'],['Account','Other account']])test('an unowned target cannot replace unknown identity or prefix/CS cells: '+header,()=>{
  const f=fixture();f.set(8,header,value);assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.get(8,header),value);
});

test('an exact preknown entry before-image may be completed without minting a new queue identity',()=>{
  const f=fixture();f.set(8,'到店紀錄ID（內部）',f.a.queueId);f.run();assert.equal(f.get(8,'到店紀錄ID（內部）'),f.a.queueId);assert.equal(f.get(8,'Appointment ID'),f.a.id);assert.equal(f.get(8,'Record Origin'),'managed');
});

function mixedScheduleFixture(){
  const f=fixture(),schedule={...f.a,id:'appt_schedule',leadId:'lead_schedule',queueId:'arrival_schedule',customerKey:'GOS Beauty|p:10000002',phone:'10000002',date:'2026-12-02',time:'16:45',bookedAt:'',revision:2,pendingQueueBefore:JSON.stringify(['2026-11-18','14:00','No Show','2026-11-16'])};
  f.ctx.appointments[schedule.id]=schedule;
  for(const[header,value]of Object.entries({'品牌':'Keep scheduled brand','電話':'Keep scheduled phone','客人／預約':'Keep scheduled label','CS同事名':'Keep scheduled CS','預約日期':'2026-11-18','時間':'14:00','結果':'No Show','到店日期':'2026-11-16','備註':'=Keep scheduled note','Account':schedule.account,'穩定客戶識別（內部）':schedule.customerKey,'到店紀錄ID（內部）':schedule.queueId,'Appointment ID':schedule.id,'Schedule Revision':1,'Omni Lead ID':schedule.leadId,'Record Origin':'managed','來源':'Keep scheduled source','試做價':0,'開單金額':1280}))f.set(9,header,value);
  const record={...f.record,row:3,leadId:schedule.leadId,appointmentId:schedule.id,customerKey:schedule.customerKey,phone:schedule.phone,fullPhone:schedule.phone};
  const operations=[...f.operations,{kind:'schedule_only',appt:schedule,row:9,state:'結果待核對'}],records=[f.record,record];
  return{f,schedule,record,operations,records};
}

test('mixed append and schedule-only updates E/F while preserving NoShow/H/CS/notes and zero money through all stages',()=>{
  const{f,schedule,operations,records}=mixedScheduleFixture(),retained=['品牌','電話','客人／預約','CS同事名','結果','到店日期','備註','來源','試做價','開單金額'].map(header=>[header,f.get(9,header)]);
  f.control.afterBatch=()=>{for(const[header,value]of retained)assert.equal(f.get(9,header),value,header+' must remain after each acknowledged stage');};
  f.call(operations,records);assert.equal(f.apiCalls.length,3);assert.equal(f.get(8,'Record Origin'),'managed');assert.equal(f.b.oa2Date_(f.get(9,'預約日期')),schedule.date);assert.equal(f.b.oa2Time_(f.get(9,'時間')),schedule.time);
  assert.equal(f.cell(9,f.headers.indexOf('預約日期')+1).userEnteredFormat.numberFormat.type,'DATE');assert.equal(f.cell(9,f.headers.indexOf('時間')+1).userEnteredFormat.numberFormat.type,'TIME');assert.equal(f.get(9,'Queue State'),'結果待核對');
});

test('a changed schedule queue before-image rejects the entire mixed batch before allocating another row',()=>{
  const{f,operations,records}=mixedScheduleFixture();f.control.beforeGet=(stage,options)=>{if(options.ranges.some(range=>range.startsWith("'到店紀錄'!A8:")))f.set(9,'時間','13:00');};
  assert.throws(()=>f.call(operations,records));assert.equal(f.apiCalls.length,0);assert.equal(f.get(9,'時間'),'13:00');assert.equal(f.get(8,'Appointment ID'),'');
});

test('schedule-only source identity mismatch rejects before any mixed append mutation',()=>{
  const{f,operations,records}=mixedScheduleFixture();records[1]={...records[1],phone:'10000099'};assert.throws(()=>f.call(operations,records));assert.equal(f.apiCalls.length,0);assert.equal(f.get(9,'結果'),'No Show');assert.equal(f.get(8,'Appointment ID'),'');
});

test('actual opt-in native hook dispatches approved append/schedule-only batches without native header reads',()=>{
  const{f,operations,records}=mixedScheduleFixture();f.ensureLedger();f.ensureSources(records);const queue=f.queue();f.control.blockNativeReads=true;try{f.b.oa2WriteQueue_(f.ss,f.ctx,queue,operations,records);}finally{f.control.blockNativeReads=false;}
  assert.equal(f.apiCalls.length,3);assert.equal(f.get(8,'Record Origin'),'managed');assert.equal(f.get(9,'結果'),'No Show');assert.equal(f.get(9,'備註'),'=Keep scheduled note');
});

test('capacity growth is confirmed before row access and preserves the three queue-write stages',()=>{
  const f=fixture({rowCount:7});f.run();assert.equal(f.grid.rowCount,8);assert.equal(f.apiCalls.length,4);assert.equal(JSON.stringify(f.apiCalls[0].requests),JSON.stringify([{appendDimension:{sheetId:17,dimension:'ROWS',length:1}}]));assert.equal(f.get(8,'Record Origin'),'managed');assert.equal(f.nativeWrites.length,0);
});

test('lost capacity response rechecks actual grid size without growing twice or changing recovery identity',()=>{
  const f=fixture({rowCount:7});f.control.failAfterStage=1;assert.throws(()=>f.run());assert.equal(f.grid.rowCount,8);assert.equal(f.get(8,'Appointment ID'),'');
  f.control.failAfterStage=0;f.run();assert.equal(f.grid.rowCount,8);assert.equal(f.apiCalls.flatMap(batch=>batch.requests).filter(request=>request.appendDimension).length,1);assert.equal(f.get(8,'Appointment ID'),f.a.id);
});

test('schedule-only lost payload response converges with a freshly discovered queue before-image',()=>{
  const{f,schedule,operations,records}=mixedScheduleFixture(),ops=[operations[1]],source=[records[1]];f.control.failAfterStage=1;assert.throws(()=>f.call(ops,source));
  assert.equal(f.b.oa2Date_(f.get(9,'預約日期')),schedule.date);assert.equal(f.get(9,'結果'),'No Show');assert.equal(f.get(9,'到店日期'),'2026-11-16');
  f.control.failAfterStage=0;f.call(ops,source);assert.equal(f.get(9,'Schedule Revision'),schedule.revision);assert.equal(f.get(9,'Queue State'),'結果待核對');assert.equal(f.get(9,'結果'),'No Show');assert.equal(f.get(9,'試做價'),0);
});

test('schedule-only lost payload response resumes the same durable before-image without overwriting outcome/H',()=>{
  const{f,schedule,operations,records}=mixedScheduleFixture(),ops=[operations[1]],source=[records[1]];f.ensureLedger();f.ensureSources(source);const before=f.queue();
  const run=()=>{f.control.blockNativeReads=true;try{return f.b.oa2WriteQueueAppendApi_(f.ss,f.ctx,before,ops,source);}finally{f.control.blockNativeReads=false;}};
  f.control.failAfterStage=1;assert.throws(run);f.control.failAfterStage=0;run();
  assert.equal(f.b.oa2Date_(f.get(9,'預約日期')),schedule.date);assert.equal(f.b.oa2Time_(f.get(9,'時間')),schedule.time);assert.equal(f.get(9,'結果'),'No Show');assert.equal(f.get(9,'到店日期'),'2026-11-16');assert.equal(f.get(9,'Schedule Revision'),schedule.revision);
});

for(const[field,value]of [['bookedAt','2026-11-17'],['bookedAt','2026/11/17 00:30'],['bookedAt','2026-11-17T00:30:00'],['bookedAt','2026-11-17T00:30:00+08:00'],['outcomeAt','11/17/2026'],['outcomeAt','2026-11-17T00:30:00']])test('noncanonical registry instant is rejected before queue mutation: '+field+' '+value,()=>{
  const f=fixture({appointment:{[field]:value}});assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);
});

test('valid Date registry instant preserves its Hong Kong civil interpretation',()=>{
  const f=fixture({appointment:{bookedAt:new Date('2026-11-16T16:30:00.000Z')}});f.run();assert.equal(f.get(8,'Record Origin'),'managed');assert.equal(f.b.oa2Date_(f.get(8,'可追溯Book日期（自動）')),'2026-11-17');
});

for(const issue of ['missing-row','missing-intent','changed-revision','changed-durable-intent'])test('durable registry write-ahead fence rejects '+issue+' without a queue write',()=>{
  const f=fixture();if(issue==='missing-row')delete f.ctx.rows[f.a.id];if(issue==='missing-intent')f.a.pendingQueueBefore='';if(issue==='changed-revision')f.ledgerRows.get(2)[18]=99;if(issue==='changed-durable-intent')f.ledgerRows.get(2)[26]='';
  assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.get(8,'Appointment ID'),'');
});

function sourceAnchorFixture(){
  const f=fixture(),values=f.sourceRows.get(f.a.account).get(f.record.row),anchor={leadId:f.a.leadId,account:f.a.account,currentAppointmentId:f.a.id,appointments:[copy(f.a)]};
  values[26]='previous_source_pointer';values[30]=JSON.stringify(anchor);return{f,values,anchor};
}

test('a fully matching pending source anchor permits recovery while its final source pointer is stale',()=>{
  const{f}=sourceAnchorFixture();f.run();assert.equal(f.get(8,'Record Origin'),'managed');assert.equal(f.get(8,'Appointment ID'),f.a.id);
});

for(const issue of ['wrong-queue-id','wrong-revision','wrong-source-lead','missing-anchor'])test('source recovery fence rejects '+issue+' before capacity or queue mutation',()=>{
  const{f,values,anchor}=sourceAnchorFixture();if(issue==='wrong-queue-id')anchor.appointments[0].queueId='foreign_entry';if(issue==='wrong-revision')anchor.appointments[0].revision++;if(issue==='wrong-source-lead')values[25]='foreign_lead';values[30]=issue==='missing-anchor'?'':JSON.stringify(anchor);
  assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.get(8,'Appointment ID'),'');assert.equal(f.nativeWrites.length,0);
});

test('source metadata header ambiguity fails before a queue mutation',()=>{
  const f=fixture();f.sourceHeaders[25]='Invalid source identity header';assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);
});

test('a duplicate single source metadata label outside its complete block rejects before queue writes',()=>{
  const f=fixture();f.sourceHeaders[0]='Omni Lead ID';assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.get(8,'Appointment ID'),'');
});

test('source metadata header whitespace follows the canonical native header parser',()=>{
  const f=fixture();for(let index=25;index<31;index++)f.sourceHeaders[index]='  '+f.sourceHeaders[index]+'  ';f.run();assert.equal(f.get(8,'Record Origin'),'managed');
});

test('a governed pending anchor may retain its same-owner checkpoint event',()=>{
  const{f,values,anchor}=sourceAnchorFixture();anchor.events=[['anchor_event',f.ctx.now,f.a.id,f.a.leadId,'state_checkpoint','{}',JSON.stringify(f.a),'synthetic']];values[30]=JSON.stringify(anchor);
  f.run();assert.equal(f.get(8,'Record Origin'),'managed');
});

for(const issue of ['foreign-extra-appointment','foreign-extra-event','same-lead-unknown-event-appointment','malformed-state-checkpoint'])test('pending source anchor rejects '+issue+' without any API write',()=>{
  const{f,values,anchor}=sourceAnchorFixture(),foreign={...f.a,id:'appt_foreign',leadId:'lead_foreign',account:'Other Account',queueId:'arrival_foreign'};
  if(issue==='foreign-extra-appointment'){f.ctx.appointments[foreign.id]=foreign;anchor.appointments.push(copy(foreign));}
  if(issue==='foreign-extra-event'){f.ctx.appointments[foreign.id]=foreign;anchor.events=[['extra_event',f.ctx.now,foreign.id,f.a.leadId,'registered','{}','{}','synthetic']];}
  if(issue==='same-lead-unknown-event-appointment')anchor.events=[['unknown_event',f.ctx.now,'appt_not_in_context',f.a.leadId,'state_checkpoint','{}',JSON.stringify({id:'appt_not_in_context',leadId:f.a.leadId,account:f.a.account}),'synthetic']];
  if(issue==='malformed-state-checkpoint')anchor.events=[['malformed_event',f.ctx.now,f.a.id,f.a.leadId,'state_checkpoint','{}','{invalid checkpoint','synthetic']];
  values[30]=JSON.stringify(anchor);assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.get(8,'Appointment ID'),'');assert.equal(f.nativeWrites.length,0);
});

for(const issue of ['contradictory-queue-owner','malformed-anchor'])test('a final source pointer cannot bypass a nonempty pending anchor: '+issue,()=>{
  const{f,values,anchor}=sourceAnchorFixture();values[26]=f.a.id;anchor.appointments[0].queueId='foreign_pending_entry';values[30]=issue==='malformed-anchor'?'{invalid pending anchor':JSON.stringify(anchor);
  assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.get(8,'Appointment ID'),'');assert.equal(f.nativeWrites.length,0);
});

function journalFixture(){
  const f=fixture({rowCount:7}),event=['checkpoint_test',f.ctx.now,f.a.id,f.a.leadId,'state_checkpoint','{}',JSON.stringify(f.a),'synthetic_queue_api_test'];
  f.ctx.events=[event];f.ctx.historyNextRow=2;f.historyRows.set(2,event.slice());return{f,event};
}

test('an exact durable journal checkpoint is verified in its bounded ID scan before queue capacity grows',()=>{
  const{f}=journalFixture();f.run();assert.equal(f.get(8,'Record Origin'),'managed');assert.equal(f.grid.rowCount,8);
  assert.ok(f.getCalls.some(call=>call.ranges.some(range=>/^'_appointment_history'!A\d+:A\d+$/.test(range))));
  assert.ok(f.getCalls.some(call=>call.ranges.some(range=>range==="'_appointment_history'!A2:H2")));
});

for(const issue of ['missing-event','missing-header','duplicate-id','changed-content','provider-failure','missing-read-bound'])test('journal fence rejects '+issue+' before any capacity or queue mutation',()=>{
  const{f,event}=journalFixture();
  if(issue==='missing-event')f.historyRows.delete(2);if(issue==='missing-header')f.historyRows.delete(1);if(issue==='duplicate-id')f.historyRows.set(3,event.slice());if(issue==='changed-content')f.historyRows.get(2)[6]='{"different":"durable checkpoint"}';if(issue==='missing-read-bound')delete f.ctx.historyNextRow;
  if(issue==='provider-failure')f.control.beforeGet=(stage,options)=>{if(options.ranges.some(range=>range.startsWith("'_appointment_history'!A")))throw new Error('PRIVATE_JOURNAL_PROVIDER_FAILURE');};
  assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);assert.equal(f.grid.rowCount,7);assert.equal(f.nativeWrites.length,0);assert.equal(f.get(8,'Appointment ID'),'');
});

test('actual native writer delegates only when append optimization is enabled and every operation appends',()=>{
  const f=fixture(),queue=f.queue();f.control.blockNativeReads=true;try{f.b.oa2WriteQueue_(f.ss,f.ctx,queue,f.operations,[f.record]);}finally{f.control.blockNativeReads=false;}assert.equal(f.apiCalls.length,3);assert.equal(f.get(8,'Record Origin'),'managed');
});

for(const mode of ['disabled','mixed-refresh'])test('opt-in hook leaves the existing native path selected for '+mode,()=>{
  const f=fixture(),queue=f.queue();assert.equal(f.enabledByDefault,false,'Experimental API dispatch must remain an explicit opt-in');
  if(mode==='disabled')f.b.OA2_QUEUE_APPEND_API_ENABLED=false;
  const operations=mode==='mixed-refresh'?[...f.operations,{kind:'refresh',appt:f.a,row:9}]:f.operations;
  f.control.blockNativeReads=true;try{assert.throws(()=>f.b.oa2WriteQueue_(f.ss,f.ctx,queue,operations,[f.record]),/Adapter must not use native read/);}finally{f.control.blockNativeReads=false;}
  assert.equal(f.apiCalls.length,0);assert.equal(f.getCalls.length,0,'Unsupported/disabled batches must never start the API writer');
});

test('native numeric registry phone is accepted only under the exact retained Account/customer-key proof',()=>{
  const f=fixture();f.ledgerRows.get(2)[4]=Number(f.a.phone);const result=f.run();assert.equal(result.completed,true);assert.equal(f.get(8,'Record Origin'),'managed');
});
for(const uncertain of [false,true])test('canonical commit flushes accepted native intent before API dispatch and retains uncertainty: '+uncertain,()=>{
  const f=fixture(),order=[],writer=f.b.oa2WriteQueue_;f.ctx.errors=[];
  f.b.oa2AllocateQueue_=()=>{};f.b.oa2CheckpointChanges_=()=>order.push('checkpoint');
  f.b.oa2WriteHistory_=()=>{order.push('history');return 2;};f.b.oa2WriteRegistry_=()=>order.push('registry');
  f.b.oa2AdvanceHistoryCursor_=()=>order.push('cursor');f.b.SpreadsheetApp.flush=()=>order.push('flush');
  f.b.oa2WriteQueue_=(...args)=>{order.push('queue');assert.deepEqual(order.slice(-3),['registry','flush','queue']);return writer(...args);};
  if(uncertain)f.control.failAfterStage=2;
  const run=()=>f.b.oa2Commit_(f.ss,f.ctx,f.queue(),f.operations,[],[f.record]);
  if(uncertain){assert.throws(run);assert.equal(f.a.pendingQueueBefore,'new');assert.ok(!order.includes('cursor'));}
  else{run();assert.equal(f.a.pendingQueueBefore,'');assert.equal(order.at(-1),'cursor');assert.equal(f.get(8,'Record Origin'),'managed');}
});
for(const issue of ['different-number','foreign-key','other-field'])test('numeric registry compatibility cannot admit '+issue,()=>{
  const f=fixture();f.ledgerRows.get(2)[4]=Number(f.a.phone);
  if(issue==='different-number')f.ledgerRows.get(2)[4]++;
  if(issue==='foreign-key'){f.a.customerKey='GOS Beauty|p:99999999';f.record.customerKey=f.a.customerKey;f.ledgerRows.get(2)[3]=f.a.customerKey;}
  if(issue==='other-field')f.ledgerRows.get(2)[18]++;
  assert.throws(()=>f.run());assert.equal(f.apiCalls.length,0);
});
console.log(JSON.stringify({passed:tests.length,failed:failures.length,tests,failures},null,2));if(failures.length)process.exitCode=1;
