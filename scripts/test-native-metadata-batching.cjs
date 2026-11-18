const assert=require('node:assert/strict');
const {loadRelease,sheet,valuesRow,clone}=require('./fixtures/native-arrival/identity-priority-fixture.cjs');
const tests=[],failures=[];
function test(name,run){try{run();tests.push(name);}catch(error){failures.push({name,error:error.stack});}}
function fixture(count=12){
  const f=loadRelease(),headers=f.sourceHeaders(),meta=headers.indexOf('Omni Lead ID')+1;
  const rows=Array.from({length:count},(_,i)=>valuesRow(headers,{'Created At':'2026-10-01','電話':String(10000001+i),'CS Remark':'Keep colleague '+i,'Omni Lead ID':'lead_'+i,'Appointment ID':'appt_'+i,'Booking Registered At':i===3?0:'','Pending Appointment Snapshot':i===4?'retained_foreign_intent':''}));
  const sh=sheet('GOS Beauty',headers,rows),snap={sheet:sh,meta,width:headers.length,values:rows.map(row=>row.slice())};
  const items=[2,7,12].filter(row=>row<count+2).map(row=>({row,values:[...snap.values[row-2].slice(meta-1,meta+4),'accepted_'+row]}));
  return{...f,sh,snap,items,meta};
}
test('sparse accepted metadata writes use one bounded native write and retain every business and intervening metadata value',()=>{
  const f=fixture(),before=clone(f.sh.state.matrix);f.box.oa2WriteSourceMetadata_(f.snap,f.items,null);
  assert.equal(f.sh.state.writes.length,1);const write=f.sh.state.writes[0];assert.equal(write.column,f.meta);assert.equal(write.width,6);
  for(let row=2;row<f.sh.state.matrix.length+1;row++){
    assert.deepEqual(f.sh.state.matrix[row-1].slice(0,f.meta-1),before[row-1].slice(0,f.meta-1));
    assert.deepEqual(f.sh.state.matrix[row-1].slice(f.meta-1),f.items.find(item=>item.row===row)?.values??before[row-1].slice(f.meta-1));
  }
  assert.equal(f.sh.state.matrix[4][f.meta+1],0,'Numeric zero must remain numeric zero');
});
test('an intervening metadata formula keeps sparse writes and is never replaced by an evaluated value',()=>{
  const f=fixture();f.sh.state.matrix[3][f.meta-1]='="foreign_formula"';f.snap.values[2][f.meta-1]='="foreign_formula"';
  f.box.oa2WriteSourceMetadata_(f.snap,f.items,null);assert.equal(f.sh.state.writes.length,3);
  assert.equal(f.sh.state.matrix[3][f.meta-1],'="foreign_formula"');assert.ok(f.sh.state.writes.every(write=>write.height===1&&write.width===6));
});
test('fresh full-span CAS rejects a concurrent business edit in an intervening row before any metadata mutation',()=>{
  const f=fixture();f.sh.state.beforeRead=(_count,range)=>{if(range.column===1){f.sh.state.matrix[3][0]='Concurrent colleague edit';}};
  assert.throws(()=>f.box.oa2WriteSourceMetadata_(f.snap,f.items,null),/Account rows changed/);assert.equal(f.sh.state.writes.length,0);assert.equal(f.sh.state.matrix[3][0],'Concurrent colleague edit');
});
test('fresh full-span CAS rejects a foreign metadata owner and preserves it',()=>{
  const f=fixture();f.sh.state.matrix[3][f.meta-1]='lead_foreign';
  assert.throws(()=>f.box.oa2WriteSourceMetadata_(f.snap,f.items,null),/Account rows changed/);assert.equal(f.sh.state.writes.length,0);assert.equal(f.sh.state.matrix[3][f.meta-1],'lead_foreign');
});
test('account completion compares against accepted anchors rather than the original pre-anchor snapshot',()=>{
  const f=fixture(),anchored=f.snap.values.map(row=>row.slice(f.meta-1));f.items.forEach(item=>{anchored[item.row-2]=item.values.slice();item.values.forEach((v,j)=>f.sh.state.matrix[item.row-1][f.meta-1+j]=v);});
  const completed=f.items.map(item=>({row:item.row,values:[...item.values.slice(0,5),'']}));f.box.oa2WriteSourceMetadata_(f.snap,completed,anchored);
  assert.equal(f.sh.state.writes.length,1);assert.ok(completed.every(item=>f.sh.state.matrix[item.row-1][f.meta+4]===''));
});
function pendingClearFixture(){
  const f=fixture(8192),rows=[2,3,8193],letter=f.box.columnLetter_(f.meta+5),rangeCalls=[];
  for(const row of rows){f.sh.state.matrix[row-1][f.meta+4]='accepted_'+row;f.snap.values[row-2][f.meta+4]='accepted_'+row;}
  f.sh.state.matrix[12][f.meta+4]='="keep intervening formula"';f.snap.values[11][f.meta+4]=f.sh.state.matrix[12][f.meta+4];
  const items=rows.map(row=>({row,values:[...f.snap.values[row-2].slice(f.meta-1,f.meta+4),'']}));
  f.sh.getRangeList=ranges=>({clearContent(){
    rangeCalls.push(Array.from(ranges));
    for(const range of ranges){
      const match=new RegExp('^'+letter+'(\\d+):'+letter+'(\\d+)$').exec(range);assert.ok(match);
      f.sh.getRange(Number(match[1]),f.meta+5,Number(match[2])-Number(match[1])+1,1).clearContent();
    }
  }});
  return {...f,rows,letter,rangeCalls,items};
}
test('sparse final recovery clears three actual cells in one native request across 8192 rows',()=>{
  const f=pendingClearFixture();f.box.oa2WriteSourceMetadata_(f.snap,f.items,null,true);
  assert.deepEqual(f.rangeCalls,[[f.letter+'2:'+f.letter+'3',f.letter+'8193:'+f.letter+'8193']]);
  assert.equal(f.sh.state.writes.reduce((sum,w)=>sum+w.height*w.width,0),3);
  assert.ok(f.sh.state.writes.every(w=>w.column===f.meta+5));assert.equal(f.sh.state.matrix[12][f.meta+4],'="keep intervening formula"');
  for(const row of f.rows){assert.equal(f.sh.state.matrix[row-1][f.meta+4],'');assert.equal(f.sh.state.matrix[row-1][f.meta-1],f.snap.values[row-2][f.meta-1]);}
});
test('sparse final recovery retains its full business and metadata before-image guard',()=>{
  const f=pendingClearFixture();f.sh.state.matrix[4095][1]='concurrent business edit';
  assert.throws(()=>f.box.oa2WriteSourceMetadata_(f.snap,f.items,null,true),/Account rows changed/);
  assert.equal(f.rangeCalls.length,0);assert.equal(f.sh.state.writes.length,0);assert.equal(f.sh.state.matrix[1][f.meta+4],'accepted_2');
});
test('adjacent final writes omit unchanged identity columns and preserve numeric zero and unrelated formulas',()=>{
  const f=fixture();const items=[3,4].map(row=>{
    const values=f.snap.values[row-2].slice(f.meta-1,f.meta+5);values[3]='取消';values[4]=0;return{row,values};
  });
  f.box.oa2WriteSourceMetadata_(f.snap,items,null,true);
  assert.equal(f.sh.state.writes.length,1);const write=f.sh.state.writes[0];assert.equal(write.column,f.meta+3);assert.equal(write.width,2);
  assert.deepEqual(write.values,[['取消',0],['取消',0]]);
});
test('widely spaced non-clear updates touch only selected rows after full-span verification',()=>{
  const f=fixture(400),items=[2,401].map(row=>{
    const values=f.snap.values[row-2].slice(f.meta-1,f.meta+5);values[3]='取消';return{row,values};
  });
  f.box.oa2WriteSourceMetadata_(f.snap,items,null,true);
  assert.deepEqual(f.sh.state.writes.map(w=>[w.row,w.height,w.width]),[[2,1,1],[401,1,1]]);
});
for(const formula of [true,false])test('a mixed final row preserves an unchanged '+(formula?'formula':'equals-prefixed literal')+' between changed fields',()=>{
  const f=fixture(),row=3,column=f.meta+2;
  f.sh.state.matrix[row-1][column-1]='=keep';f.snap.values[row-2][column-1]='=keep';
  if(!formula){const range=f.sh.getRange;f.sh.getRange=(r,c,h=1,w=1)=>({...range(r,c,h,w),getFormulas:()=>Array.from({length:h},()=>Array(w).fill(''))});}
  const values=f.snap.values[row-2].slice(f.meta-1,f.meta+5);values[1]='new_appointment';values[3]='取消';values[5]='';
  f.box.oa2WriteSourceMetadata_(f.snap,[{row,values}],null,true);
  assert.deepEqual(f.sh.state.writes.map(w=>[w.column,w.width]),[[f.meta+1,1],[f.meta+3,1]]);
  assert.equal(f.sh.state.matrix[row-1][column-1],'=keep');
});
test('a lost native acknowledgement retains the entire accepted anchor span for canonical recovery',()=>{
  const f=fixture();f.sh.state.afterWrite=()=>{throw Error('Synthetic lost reply');};
  assert.throws(()=>f.box.oa2WriteSourceMetadata_(f.snap,f.items,null),/lost reply/);
  f.items.forEach(item=>assert.deepEqual(f.sh.state.matrix[item.row-1].slice(f.meta-1),item.values));
  assert.equal(f.sh.state.matrix[5][f.meta+4],'retained_foreign_intent');
});
test('large spans stay below 49152 written cells and never write a business column',()=>{
  const f=fixture(8200),items=[2,8193,8194,8201].map(row=>({row,values:[...f.snap.values[row-2].slice(f.meta-1,f.meta+4),'accepted']}));
  f.box.oa2WriteSourceMetadata_(f.snap,items,null);assert.equal(f.sh.state.writes.length,2);
  assert.ok(f.sh.state.writes.every(write=>write.width===6&&write.column===f.meta&&write.height<=8192));
});
test('unchanged metadata produces no provider reads or writes',()=>{
  const f=fixture();f.box.oa2WriteSourceMetadata_(f.snap,[],null);assert.equal(f.sh.state.reads,0);assert.equal(f.sh.state.writes.length,0);
});
function anchorFixture(mixed){
  const f=fixture(2),appointments={},original={};
  f.snap.records=f.snap.values.map((row,i)=>{
    const leadId=row[f.meta-1],appointmentId=row[f.meta],a={id:appointmentId,leadId,account:'GOS Beauty',revision:2};
    appointments[a.id]=a;original[a.id]=JSON.stringify({...a,revision:1});
    if(mixed&&i===1){row[f.meta-1]='';f.sh.state.matrix[i+1][f.meta-1]='';}
    return {meaningful:true,row:i+2,account:a.account,leadId,appointmentId};
  });
  return {...f,ctx:{appointments,original,events:[]}};
}
for(const mixed of [false,true])test(mixed?'a mixed Lead ID allocation retains its single six-column reservation':'a stable Lead ID reservation writes only the changed recovery column',()=>{
  const f=anchorFixture(mixed);f.box.oa2WriteSourceAnchors_(f.snap,f.ctx);
  assert.deepEqual(f.sh.state.writes.map(w=>[w.column,w.width,w.height]),[[f.meta+(mixed?0:5),mixed?6:1,2]]);
  for(const r of f.snap.records){
    assert.equal(f.sh.state.matrix[r.row-1][f.meta-1],r.leadId);
    assert.equal(JSON.parse(f.sh.state.matrix[r.row-1][f.meta+4]).currentAppointmentId,r.appointmentId);
  }
});
test('narrow recovery reservations still reject a changed source before writing any cell',()=>{
  const f=anchorFixture(false);let reads=0;
  f.sh.state.beforeRead=(_count,range)=>{if(range.column===1&&++reads===2)f.sh.state.matrix[1][f.meta-1]='replacement_id';};
  assert.throws(()=>f.box.oa2WriteSourceAnchors_(f.snap,f.ctx),/Account rows changed/);
  assert.equal(f.sh.state.writes.length,0);
});
function traceFixture(manual){
  const f=fixture(4);f.box.OA3_MANUAL_RUN_ACTIVE=manual;
  f.snap.records=f.snap.values.map((row,i)=>({row:i+2,meaningful:true,leadId:row[f.meta-1],appointmentId:row[f.meta],outcome:i===1?'':'No Show'}));
  return {...f,receipts:()=>f.logs.map(value=>JSON.parse(value)).filter(r=>r.handler==='manual_source_metadata')};
}
test('manual finalization emits timed formula, fresh-read, compare and write receipts with counts only',()=>{
  const f=traceFixture(true);
  f.sh.state.beforeWrite=()=>{assert.equal(f.receipts().at(-1).stage,'write_metadata');assert.equal(f.receipts().at(-1).state,'start');};
  f.box.oa2WriteAccountMeta_(f.snap);
  const receipts=f.receipts();
  assert.deepEqual(receipts.filter(r=>r.state==='start').map(r=>r.stage),['plan_changes','read_formulas','read_before_image','check_before_image','write_metadata']);
  assert.deepEqual(receipts.filter(r=>r.state==='complete').map(r=>r.stage),receipts.filter(r=>r.state==='start').map(r=>r.stage));
  for(const r of receipts){
    assert.ok(r.rowCount>0&&r.cellCount>=r.rowCount);
    assert.deepEqual(Object.keys(r).sort(),['handler','stage','state','rowCount','cellCount',...(r.state==='start'?[]:['durationMs'])].sort());
    if(r.state==='complete')assert.ok(r.durationMs>=0);
  }
});
test('nonmanual finalization stays quiet and a failed manual provider call emits no data or raw exception',()=>{
  const quiet=traceFixture(false);quiet.box.oa2WriteAccountMeta_(quiet.snap);assert.deepEqual(quiet.receipts(),[]);
  const f=traceFixture(true);f.sh.state.beforeWrite=()=>{throw Error('private_provider_payload');};
  assert.throws(()=>f.box.oa2WriteAccountMeta_(f.snap),/private_provider_payload/);
  const failed=f.receipts().at(-1);assert.equal(failed.stage,'write_metadata');assert.equal(failed.state,'failed');assert.ok(failed.durationMs>=0);
  assert.ok(!JSON.stringify(f.receipts()).includes('private_provider_payload'));
});
function queueBudgetFixture(rows){const f=fixture(),appt={account:'GOS Beauty',customerKey:'GOS Beauty|p:10000001'},ops=rows.map(row=>({row,kind:'refresh',appt})),queue=rows.map(row=>({row,...appt}));return{...f,ops,queue};}
test('a native queue RPC accepts at most 25 contiguous operations of the same kind',()=>{
  const f=queueBudgetFixture(Array.from({length:40},(_,i)=>i+8)),selected=f.box.oa2BoundQueueCommit_(f.ops,f.queue,{singleQueueGroup:true});assert.equal(selected.length,25);assert.equal(selected[0].row,8);assert.equal(selected.at(-1).row,32);
});
for(const kind of ['gap','different operation'])test('a native queue RPC stops before '+kind+' instead of introducing another flush group',()=>{
  const f=queueBudgetFixture(kind==='gap'?[8,9,11]:[8,9,10]);if(kind!=='gap')f.ops[2].kind='schedule_only';const selected=f.box.oa2BoundQueueCommit_(f.ops,f.queue,{singleQueueGroup:true});assert.deepEqual(Array.from(selected,op=>op.row),[8,9]);
});
test('Account relocation stays a single operation and an unadmitted budget leaves the ordinary writer unchanged',()=>{
  const f=queueBudgetFixture([8,9]);f.queue[0].account='Alyssa Main';assert.equal(f.box.oa2BoundQueueCommit_(f.ops,f.queue,{singleQueueGroup:true}).length,1);assert.equal(f.box.oa2BoundQueueCommit_(f.ops,f.queue,{singleQueueGroup:'true'}),f.ops);
});
console.log(JSON.stringify({passed:tests.length,failed:failures.length,tests,failures},null,2));if(failures.length)process.exitCode=1;
