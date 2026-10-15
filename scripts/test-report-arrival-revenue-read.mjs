import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createRequire}from'node:module';import ts from'typescript';
const require=createRequire(import.meta.url),cache=new Map();const mocks={'server-only':{},'@/lib/integrations/googleSheetsOAuth':{getGoogleSheetsOAuthAccessToken:async()=> 'synthetic-token'},'@/lib/integrations/metaLeadFormSheetNormalizer':{normalizeMetaLeadFormRows:()=>({})}};
function load(p){if(cache.has(p))return cache.get(p).exports;const m={exports:{}};cache.set(p,m);new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../'+p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>mocks[n]??(n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):require(n)),m,m.exports);return m.exports;}
const {readLiveArrivalRevenueTable:read}=load('src/lib/integrations/googleSheetsLeadTable.ts');const {ARRIVAL_REVENUE_HEADERS}=load('src/lib/reports/arrivalRevenue.ts');
const headers=Array(38).fill(''),positions=[0,6,7,10,13,22,31,32,33];positions.forEach((col,i)=>headers[col]=ARRIVAL_REVENUE_HEADERS[i]);
const rows=[['GOS Beauty','已到店',46298,'GOS Beauty','Treatment','synthetic-appointment',100,900,1000]];
const originalFetch=globalThis.fetch,originalTimeout=globalThis.setTimeout;let calls=[],mode='ok';
globalThis.fetch=async(url,init)=>{const u=new URL(url);calls.push({url:u,init});if(mode==='stalled')return new Promise(()=>{});if(!u.pathname.endsWith('values:batchGet'))return{ok:true,json:async()=>({sheets:[{properties:{title:'到店紀錄',gridProperties:{rowCount:766,columnCount:38}}}]})};const ranges=u.searchParams.getAll('ranges');return{ok:true,json:async()=>({valueRanges:ranges.length===1?[{values:[headers]}]:[...positions.map((_,col)=>({values:rows.map(row=>[row[col]])})),{values:[mode==='changed'?[...headers,'unexpected']:headers]}]})};};
const config={sourceProfile:'alyssa_workspace_lead_funnel',spreadsheetId:'synthetic_workbook_123456789'};
try{
 const result=await read(config);assert.deepEqual(result.headers,[...ARRIVAL_REVENUE_HEADERS]);assert.deepEqual(result.rows,rows);assert.equal(calls.length,3);
 const ranges=calls[2].url.searchParams.getAll('ranges');assert.deepEqual(ranges,["'到店紀錄'!A8:A766","'到店紀錄'!G8:G766","'到店紀錄'!H8:H766","'到店紀錄'!K8:K766","'到店紀錄'!N8:N766","'到店紀錄'!W8:W766","'到店紀錄'!AF8:AF766","'到店紀錄'!AG8:AG766","'到店紀錄'!AH8:AH766","'到店紀錄'!A7:AL7"]);
 assert.equal(calls[2].url.searchParams.get('valueRenderOption'),'UNFORMATTED_VALUE');assert.ok(calls.every(c=>c.init.cache==='no-store'&&c.init.signal));
 await assert.rejects(read({...config,sourceProfile:'other'}));await assert.rejects(read({...config,spreadsheetId:'https://untrusted.invalid'}));assert.equal(calls.length,3);
 mode='changed';await assert.rejects(read(config),/欄位讀取期間有變/);
 mode='stalled';globalThis.setTimeout=(callback,ms,...args)=>originalTimeout(callback,ms===15000?1:ms,...args);await assert.rejects(read(config),error=>error.reason==='managed_read_timeout');assert.equal(calls.at(-1).init.signal.aborted,true);
}finally{globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimeout;}
console.log('PASS: configured managed workbook, metadata-bounded header-resolved financial columns, one values snapshot, no customer/phone/CS reads, changed-header rejection, read-only and bounded timeout');
