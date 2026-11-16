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
