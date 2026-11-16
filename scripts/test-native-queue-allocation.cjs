const assert=require('node:assert/strict');
const {loadRelease,clone}=require('./fixtures/native-arrival/identity-priority-fixture.cjs');
const tests=[];
function test(name,run){run();tests.push(name);}
function fixture(){const f=loadRelease();let seq=0;const ctx={appointments:{},events:[],errors:[],dryRun:false,id:()=>`arrival_fresh_${++seq}`},ss={getSheetByName:()=>({getLastRow:()=>10})};return{...f,ctx,ss};}
function a(id,queueId=''){return{id,queueId,leadId:'lead_'+id};}
function blank(row,entryId=''){return{row,entryId,appointmentId:'',blank:true};}
test('a new appointment cannot reuse a physically blank entry retained by another registry owner',()=>{
  const f=fixture(),old=a('old','retained_entry'),next=a('next');f.ctx.appointments={old,next};const op={kind:'append',appt:next,entryId:'new_entry'};
  f.box.oa2AllocateQueue_(f.ss,f.ctx,[blank(8,'retained_entry'),blank(9)],[op]);assert.equal(op.row,9);assert.equal(next.queueId,'new_entry');assert.equal(old.queueId,'retained_entry');
});
test('a retained blank entry is preserved when it is the only available slot',()=>{
  const f=fixture(),old=a('old','retained_entry'),next=a('next');f.ctx.appointments={old,next};const q=blank(8,'retained_entry'),before=clone(q),op={kind:'append',appt:next,entryId:'new_entry'};
  f.box.oa2AllocateQueue_(f.ss,f.ctx,[q],[op]);assert.equal(op.row,11);assert.deepEqual(q,before);assert.equal(next.queueId,'new_entry');
});
test('two formerly unowned blank entries cannot assign the same entry ID to two new appointments',()=>{
  const f=fixture(),one=a('one'),two=a('two');f.ctx.appointments={one,two};const ops=[{kind:'append',appt:one,entryId:'first_new'},{kind:'append',appt:two,entryId:'second_new'}];
  f.box.oa2AllocateQueue_(f.ss,f.ctx,[blank(8,'same_orphan'),blank(9,'same_orphan')],ops);assert.equal(one.queueId,'same_orphan');assert.equal(two.queueId,'second_new');assert.equal(ops[1].row,11);assert.notEqual(one.queueId,two.queueId);
});
test('an exactly owned recovery reserves its blank entry before a new appointment allocates',()=>{
  const f=fixture(),old=a('old','retained_entry'),next=a('next');f.ctx.appointments={old,next};const ops=[{kind:'append',appt:next,entryId:'new_entry'},{kind:'append',appt:old,entryId:'retained_entry',recovery:true}];
  f.box.oa2AllocateQueue_(f.ss,f.ctx,[blank(8,'retained_entry'),blank(9)],ops);assert.equal(ops[1].row,8);assert.equal(ops[1].appt.queueId,'retained_entry');assert.equal(ops[0].row,9);
});
test('explicit recovery row cannot borrow an entry owned by a different retained appointment',()=>{
  const f=fixture(),old=a('old','retained_entry'),next=a('next','next_entry');f.ctx.appointments={old,next};const before=clone(f.ctx.appointments);
  assert.throws(()=>f.box.oa2AllocateQueue_(f.ss,f.ctx,[blank(8,'retained_entry')],[{kind:'append',appt:next,row:8,recovery:true}]),/owned by another/);assert.deepEqual(f.ctx.appointments,before);
});
test('the global preexisting duplicate-owner check still fails before any commit Sheet mutation',()=>{
  const f=fixture(),one=a('one','duplicate'),two=a('two','duplicate');f.ctx.appointments={one,two};let sourceChecks=0,writes=0;
  f.box.oa2QueueLayout_=()=>({});f.box.oa2AssertSourceUnchanged_=()=>{sourceChecks++;};
  for(const name of ['oa2WriteSourceAnchors_','oa2CheckpointChanges_','oa2WriteHistory_','oa2WriteRegistry_','oa2WriteAccountMeta_','oa2WriteQueue_','oa2AdvanceHistoryCursor_'])f.box[name]=()=>{writes++;};
  assert.throws(()=>f.box.oa2Commit_(f.ss,f.ctx,[],[],[{}]),/Duplicate queue entry ownership/);assert.equal(sourceChecks,1);assert.equal(writes,0);
});
test('a provider-generated entry collision cannot overwrite a retained owner',()=>{
  const f=fixture(),one=a('one','collision'),two=a('two');f.ctx.appointments={one,two};f.ctx.id=()=> 'collision';const before=clone(f.ctx.appointments);
  assert.throws(()=>f.box.oa2AllocateQueue_(f.ss,f.ctx,[],[{kind:'append',appt:two}]),/conflicts with a retained/);assert.deepEqual(f.ctx.appointments,before);
});
console.log(JSON.stringify({passed:tests.length,tests},null,2));
