import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
let access,authenticated=true,allowed=true,ready=true,calls=[];
const mocks={
 'next/navigation':{redirect:path=>{throw Object.assign(new Error('redirect'),{path});}},
 'next/cache':{revalidatePath:()=>{}},
 '@/lib/security/internalAccessServer':{
  verifyCurrentInternalAccess:async()=>({ok:authenticated,access:authenticated?access:null}),
  requireModuleAccess:async()=>({allowed,access}),
 },
 '@/lib/supabase/admin':{hasSupabaseAdminEnv:()=>ready},
 '@/lib/marketing/commandCenter':{MASTER_ACCOUNT_EMAIL:'owner@example.test'},
 '@/lib/integrations/googleSheetsMarketingSync':{
  syncAllMarketingGoogleSheets:async options=>{calls.push(options);return[{ok:true,metricRows:1,analysisRows:1}];},
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
console.log('PASS: all 7 active roles can refresh with their audit identity; unauthenticated/denied requests never sync; source administration remains Master-only');
