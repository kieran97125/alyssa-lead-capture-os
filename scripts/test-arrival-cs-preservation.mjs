import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('./apps-script/arrival-cs-preservation-reviewed-functions.gs',import.meta.url),'utf8');
const account='Synthetic Account';
function fixture({concurrentEdit=false,sourceChange=false}={}) {
 const values=[['Sandy'],['Summer'],[''],[''],['未填CS'],['待核對']],writes=[];
 const desired=['Summer','Sandy','Sandy','Summer','Summer','Summer'];
 const appointments=desired.map((cs,i)=>({id:'appt-'+i,leadId:'lead-'+i,account,customerKey:account+'|p:20000001',queueId:'arrival-'+i,provenance:'observed_booking_edit'}));
 const queue=appointments.map((a,i)=>({row:8+i,appointmentId:a.id,entryId:a.queueId,leadId:a.leadId,account,customerKey:a.customerKey,origin:'managed',blank:false}));
 const capture={fingerprint:'initial',sources:desired.map((cs,i)=>({id:'lead-'+i,account,cs})),sourceIds:desired.map((cs,i)=>({id:'lead-'+i})),appointments,aliases:[]};
 let captureCalls=0;
 const sheet={getRange:(row,col,height,width)=>({
   getValues:()=>{if(concurrentEdit&&row===10&&height===2)values[2]=['OperatorOverride'];return values.slice(row-8,row-8+height).map(x=>x.slice());},
   setValues:next=>{writes.push({row,col,height,width,values:next.map(x=>x.slice())});next.forEach((x,i)=>values[row-8+i]=x.slice());}
 })};
 const s={console,OA2:{ARRIVAL:'Arrival',HEADER_ROW:7,FIRST_ROW:8},OA2_CS:{HEADER:'CS同事名',COLUMN:2,REVIEW:'待核對',EMPTY:'未填CS'},OMNI_ACCOUNT_TABS:[account],
   oa2Date_:v=>v||'',oa2Header_:()=>['客人／預約','CS同事名'],oa2CsCapture_:()=>({...capture,fingerprint:sourceChange&&++captureCalls>1?'changed':'initial'}),
   oa2CsQueue_:()=>queue,
   oa2RowGroups_:rows=>{const groups=[];for(const row of rows){const last=groups.at(-1);if(last&&last.at(-1).row+1===row.row)last.push(row);else groups.push([row]);}return groups;}
 };
 vm.createContext(s);vm.runInContext(source,s);
 return {s,values,writes,ss:{getSheetByName:()=>sheet},options:{documentLock:{hasLock:()=>true},accountNames:[account],includeHistory:false}};
}
let f=fixture();let result=f.s.oa2RefreshQueueCs_(f.ss,f.options);
assert.equal(result.preserved,4,'Every existing CS value is protected, including legacy placeholders');
assert.equal(result.changed,2);
assert.deepEqual(f.values,[['Sandy'],['Summer'],['Sandy'],['Summer'],['未填CS'],['待核對']],'Source changes cannot reassign existing colleagues');
assert.equal(f.writes.length,1);assert.equal(f.writes[0].row,10);assert.equal(f.writes[0].height,2,'Only blank cells are written');
result=f.s.oa2RefreshQueueCs_(f.ss,f.options);assert.equal(result.changed,0);assert.equal(f.writes.length,1,'Repeated automatic refresh performs no owner changes');
f=fixture({concurrentEdit:true});assert.throws(()=>f.s.oa2RefreshQueueCs_(f.ss,f.options),/preserving colleague input/);assert.equal(f.values[2][0],'OperatorOverride');assert.equal(f.writes.length,0);
f=fixture({sourceChange:true});assert.throws(()=>f.s.oa2RefreshQueueCs_(f.ss,f.options),/sources or identity guards changed/);assert.equal(f.writes.length,0);
f=fixture();result=f.s.oa2RefreshQueueCs_(f.ss,{...f.options,dryRun:true});assert.equal(result.changed,2);assert.equal(f.writes.length,0);assert.equal(f.values[0][0],'Sandy');
console.log('PASS: Sandy/Summer reassignment prevented; same-phone distinct owners; blank-only scoped writes; idempotency; concurrent colleague entry protection; changed-source rejection; dry-run');
