import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
let access,authenticated=true,allowed=true,ready=true,calls=[],projectionCalls=0,projectionReady=true;
let syncResults=[{ok:true,metricRows:1,analysisRows:1}];
const mocks={
 'next/navigation':{redirect:path=>{throw Object.assign(new Error('redirect'),{path});}},
 'next/cache':{revalidatePath:()=>{}},
 '@/lib/security/internalAccessServer':{
  verifyCurrentInternalAccess:async()=>({ok:authenticated,access:authenticated?access:null}),
  requireModuleAccess:async()=>({allowed,access}),
 },
 '@/lib/supabase/admin':{hasSupabaseAdminEnv:()=>ready},
 '@/lib/integrations/googleSheetsSpendProjection':{refreshInstalledMarketingSpendProjections:async()=>{projectionCalls++;return projectionReady;}},
 '@/lib/marketing/commandCenter':{MASTER_ACCOUNT_EMAIL:'owner@example.test'},
 '@/lib/integrations/googleSheetsMarketingSync':{
  syncAllMarketingGoogleSheets:async options=>{calls.push(options);return syncResults;},
 },
};
const module={exports:{}};
new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../src/app/command-center/actions.ts',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText)(name=>mocks[name]||{},module,module.exports);
const form=new FormData();form.set('returnPath','/dashboard');
const run=async action=>{try{await action(form);assert.fail('Expected redirect');}catch(error){assert.ok(error.path);return error.path;}};
for(const role of ['owner','admin','manager','marketer','cs','designer','viewer']) {
 access={source:'supabase_auth',accessLevel:role==='owner'?'master':'admin',workspaceRole:role,
  email:`${role}@example.test`,memberId:`member-${role}`,brandIds:['permitted-brand']};calls=[];
 assert.ok((await run(module.exports.refreshDashboardDataAction)).includes('command_status=success'),role);
 assert.deepEqual(calls,[{actorIdentifier:access.email,purpose:'manual'}],`${role}: authenticated operator audit identity`);
 if(role!=='owner') {
  calls=[];assert.ok((await run(module.exports.syncDataSourceAction)).includes('command_status=error'));
  assert.equal(calls.length,0,'Source administration stays Master-only');
 }
}
for(const denial of ['unauthenticated','module-denied','unavailable']) {
 authenticated=denial!=='unauthenticated';allowed=denial!=='module-denied';ready=denial!=='unavailable';calls=[];
 const path=await run(module.exports.refreshDashboardDataAction);
 assert.ok(path.startsWith('/login')||path.includes('command_status=error'));assert.equal(calls.length,0);
}
authenticated=true;allowed=true;ready=true;projectionReady=false;
const warning=decodeURIComponent(await run(module.exports.refreshDashboardDataAction));
assert.ok(warning.includes('command_status=success')&&warning.includes('廣告費暫未更新'),'Optional Spend export outage never reports a completed Lead sync as failed');
assert.equal(projectionCalls,8,'Only successful authorized refreshes publish Spend');
for(const [failureReason,expected] of [
 ['managed_read_timeout','Google Sheet 回應逾時'],
 ['bridge_registration_pending','預約身份登記未完成'],
 ['sync_busy','另一輪更新進行中'],
 ['unclassified','今次更新未能確認完成'],
]) {
 syncResults=[{ok:false,sourceName:'Synthetic source',metricRows:0,analysisRows:0,failureReason,message:'PRIVATE_CUSTOMER_OR_PROVIDER_PAYLOAD'}];
 const result=decodeURIComponent(await run(module.exports.refreshDashboardDataAction));
 assert.ok(result.includes('command_status=error')&&result.includes(expected),failureReason);
 assert.equal(result.includes('PRIVATE_CUSTOMER_OR_PROVIDER_PAYLOAD'),false,'Never expose raw provider errors in the banner');
 assert.equal(result.includes('需要再檢查'),false,'A classified failure must explain the actual next boundary');
 if(failureReason==='unclassified') assert.equal(result.includes('未發布新數據'),false,'Unknown failures can happen after writes; do not claim nothing was published');
}
assert.equal(projectionCalls,8,'Failed or busy refreshes never publish Spend');
console.log('PASS: all 7 active roles can refresh with their audit identity; unauthenticated/denied requests never sync; source administration remains Master-only');
