import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const text=v=>v==null?'':String(v).trim();
const c={LAST_UPDATED:1,CREATED_AT:2,STATUS:3,BRAND:5,APPOINTMENT_DATE:6,APPOINTMENT_TIME:7,NAME:9,PHONE:10,OFFER:11,TREATMENT:12,BRANCH:13,EMAIL:14,ACCOUNT:21,SOCIAL_USERNAME:22};
let ids=0;
const ctx=vm.createContext({Utilities:{getUuid:()=>`synthetic-${++ids}`},oa2Meta_:()=>26,oa2Text_:text,clean_:text,last8_:v=>text(v).replace(/\D/g,'').slice(-8),oa2Date_:text,oa2RowGroups_:rows=>rows.length?[rows]:[],oa2Enabled_:()=>true,omniEditStage_:(_,__,run)=>run(),getOmniColumns_:()=>c,oa2Spreadsheet_:()=>({}),oa2ProcessAccount_:()=>{throw Error('Non-booking edit must not create a booking');}});
vm.runInContext(readFileSync(new URL('./lead-identity-arrival-label-v1.gs',import.meta.url),'utf8'),ctx);
ctx.oa2CustomerKey_=(row,columns,account)=>account+'|p:'+text(row[columns.PHONE-1]).replace(/\D/g,'').slice(-8);
function fixture({existing=false,orphan=false,concurrent=false}={}) {
 const rows=Array.from({length:2},()=>Array(31).fill(''));rows[0][9]='+852 2345 6789';rows[1][9]='8612345678901';if(existing)rows[0][25]='lead-existing';if(orphan)rows[0][26]='appt-existing';let reads=0,writes=[];
 const sheet={getName:()=> 'Synthetic Account',getLastColumn:()=>31,getRange:(row,col,count,width)=>({getValues:()=>{reads++;let copy=rows.slice(row-2,row-2+count).map(r=>r.slice(col-1,col-1+width));if(concurrent&&reads>1)copy[0][9]='changed';return copy;},setValues:v=>{writes.push({row,col,values:v});v.forEach((r,i)=>r.forEach((x,j)=>rows[row-2+i][col-1+j]=x));}})};return{sheet,rows,writes};
}
let f=fixture();assert.equal(ctx.oa2EnsureEditedLeadIds_(f.sheet,c,2,3),2);assert.equal(f.writes.length,1);assert.equal(f.writes[0].col,26);assert.equal(f.rows[0][9],'+852 2345 6789');assert.equal(f.rows[0][2],'');assert.equal(f.rows[0][5],'');
f=fixture({existing:true});assert.equal(ctx.oa2EnsureEditedLeadIds_(f.sheet,c,2,2),0);assert.equal(f.writes.length,0);
f=fixture({orphan:true});assert.throws(()=>ctx.oa2EnsureEditedLeadIds_(f.sheet,c,2,2),/existing appointment metadata/);assert.equal(f.writes.length,0);
f=fixture({concurrent:true});assert.throws(()=>ctx.oa2EnsureEditedLeadIds_(f.sheet,c,2,3),/changed before identity allocation/);assert.equal(f.writes.length,0);
const appointment={account:'Synthetic Account',leadId:'lead-synthetic',phone:'23456789',customerKey:'Synthetic Account|p:23456789'};
const record={account:'Synthetic Account',leadId:'lead-synthetic',fullPhone:'+852 2345 6789'};
assert.equal(ctx.oa2QueueLabel_(appointment,record),'Synthetic Account · 電話 +852 2345 6789');
for(const mismatched of [{...record,account:'Other Account'},{...record,leadId:'lead-other'}])assert.equal(ctx.oa2QueueLabel_(appointment,mismatched),'Synthetic Account · 識別待核對 lead-synthetic');
f=fixture();ctx.omniArrivalV2AccountEdit_({source:{}},2,2,10,10,f.sheet,null,{});assert.equal(f.writes.length,1);
console.log('PASS: non-booking edit IDs, existing IDs, orphan protection, concurrency, full-phone display, Account/Lead binding and unchanged business dates.');
