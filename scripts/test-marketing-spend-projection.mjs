import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import{createRequire}from'node:module';import ts from'typescript';
const require=createRequire(import.meta.url),cache=new Map();let mode='ok',writes=[],oauth=0,dbReads=[];
const db={from(table){let range=[0,999];const q={select(fields){dbReads.push({table,fields});return q;},eq(){return q;},neq(){return q;},limit(){return q;},order(){return q;},range(a,b){range=[a,b];return q;},abortSignal(signal){assert.ok(signal instanceof AbortSignal);return q;},then(resolve,reject){const data=table==='marketing_data_sources'?[{configuration:{spreadsheetId:'synthetic_workbook_12345678'}}]:table==='brands'?[{id:'a',name:'Alyssa',slug:'alyssa'},{id:'m',name:'Aesthetics',slug:'aesthetics'}]:range[0]===0?[{brand_id:'a',spend_date:'2026-10-01',amount:'0.10'},{brand_id:'a',spend_date:'2026-10-01',amount:'0.20'},{brand_id:'m',spend_date:'2026-10-01',amount:2}]:[];return Promise.resolve({data,error:mode==='db-failure'?new Error('Synthetic'):null}).then(resolve,reject);}};return q;}};
const mocks={'server-only':{},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>db},'@/lib/integrations/googleSheetsOAuth':{getGoogleSheetsOAuthAccessToken:async opts=>{oauth++;assert.equal(opts.recordHealth,false);return'synthetic-token';}}};
function load(p){if(cache.has(p))return cache.get(p).exports;const m={exports:{}};cache.set(p,m);new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../'+p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>mocks[id]??(id.startsWith('@/')?load('src/'+id.slice(2)+'.ts'):require(id)),m,m.exports);return m.exports;}
const mod=load('src/lib/integrations/googleSheetsSpendProjection.ts'),nativeFetch=fetch,nativeWarn=console.warn;
console.warn=()=>{};
globalThis.fetch=async(url,init)=>{assert.ok(init.signal instanceof AbortSignal);const u=new URL(url);if(init.method==='POST'){writes.push(JSON.parse(init.body));if(mode==='provider-failure')return{ok:false};return{ok:true,json:async()=>({})};}return{ok:true,json:async()=>u.pathname.includes('/values/')?{values:[['Spend Date','Account','Brand','Ad Spend HKD','',mode==='unowned'?'wrong-version':mod.REVENUE_SPEND_VERSION]]}:{sheets:mode==='uninstalled'?[]:[{properties:{sheetId:123,title:mod.REVENUE_SPEND_SHEET,gridProperties:{rowCount:1000,columnCount:7}}}]}};};
try{
 assert.equal(await mod.refreshInstalledMarketingSpendProjections(),true);assert.equal(writes.length,1,'One atomic clear/replace batch');
 const body=writes[0],rows=body.requests.find(r=>r.updateCells?.start.columnIndex===0).updateCells.rows;
 assert.deepEqual(rows.slice(1).map(r=>r.values.map(v=>Object.values(v.userEnteredValue)[0])),[[46296,'Alyssa Aesthetics','Aesthetics Medical',2],[46296,'Alyssa Aesthetics','Alyssa Aesthetics',0.3]],'Canonical brand-specific cost allocation, exact cents and all channels sum once');
 assert.ok(body.requests.every(r=>(r.repeatCell?.range.sheetId??r.updateCells?.start.sheetId)===123),'Only installed projection cells change');
 assert.equal(body.requests[0].repeatCell.range.endColumnIndex,4);assert.equal(body.requests[0].repeatCell.fields,'userEnteredValue');
 assert.ok(dbReads.every(r=>!/(note|email|token|configuration.*secret)/.test(r.fields)),'No ledger notes, staff identities or secrets exported');
 for(mode of ['uninstalled','unowned','db-failure','provider-failure']){writes=[];assert.equal(await mod.refreshInstalledMarketingSpendProjections(),mode==='uninstalled');assert.equal(writes.length,mode==='provider-failure'?1:0,mode);}
 assert.ok(oauth>0);
 assert.throws(()=>mod.marketingSpendProjectionRows([{id:'a',name:'Alyssa',slug:'alyssa'}],[{brand_id:'a',spend_date:'2026-02-30',amount:1}]));
 assert.throws(()=>mod.marketingSpendProjectionRows([{id:'a',name:'Alyssa',slug:'alyssa'}],[{brand_id:'a',spend_date:'2026-10-01',amount:-1}]));
 assert.deepEqual(mod.marketingSpendProjectionRows([{id:'a',name:'Alyssa',slug:'alyssa'}],[{brand_id:'unmapped',spend_date:'2026-10-01',amount:1}]),[]);
}finally{globalThis.fetch=nativeFetch;console.warn=nativeWarn;}
console.log('PASS: installed-only atomic Spend projection, canonical Account/Brand allocation, cents, absent destinations, ownership guard, bounded cancellation and failure isolation');
