import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import crypto from 'node:crypto';
const transpile=(path,mocks)=>{const module={exports:{}};new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>mocks[n]??{},module,module.exports);return module.exports;};
let record, providerError=false;
let bindings=0;
const db={from:()=>({select(){return this;},eq(){return this;},async maybeSingle(){return {data:record,error:providerError?{code:'provider_failure'}:null};}}),rpc:async(name,args)=>{assert.equal(name,'bind_marketing_platform_operator');assert.equal(args.p_auth_user_id,'verified-user');bindings++;return {data:true,error:null};}};
class Unavailable extends Error{}
const access=transpile('src/lib/security/platformAccess.ts',{'server-only':{},react:{cache:f=>f},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>db},'@/lib/security/workspaceAuth':{WorkspaceAccessUnavailableError:Unavailable}});
const identity={userId:'verified-user',email:'verified@example.test'};
for(const candidate of [null,{email:identity.email,role:'owner',status:'suspended'},{email:'foreign@example.test',role:'owner',status:'active'},{email:identity.email,auth_user_id:'other-user',role:'owner',status:'active'},{email:identity.email,role:'customer',status:'active'}]){record=candidate;assert.equal(await access.getPlatformOperatorAccess(identity),null);}
for(const role of ['owner','admin','support']){record={id:'operator',email:identity.email,role,status:'active',auth_user_id:null};const result=await access.getPlatformOperatorAccess(identity);assert.equal(result.scope,'platform');assert.equal(access.canProvisionCustomers(result),role!=='support');}
assert.equal(bindings,3,'Unbound reserved operators are bound through an atomic verified-subject receipt');
providerError=true;await assert.rejects(()=>access.getPlatformOperatorAccess(identity),Unavailable);providerError=false;
const routes=transpile('src/lib/security/routeBoundary.ts',{});assert.equal(routes.isInternalRoute('/platform'),true);assert.equal(routes.isInternalRoute('/platform/customers'),true);
const permissions=transpile('src/lib/security/workspacePermissions.ts',{});assert.equal(permissions.normalizeWorkspaceRole('platform_owner'),'viewer');
assert.equal(permissions.hasCustomerOwnerAuthority({workspace_role:'owner',is_master:false}),true,'Customer owner keeps management protection without a platform flag');
assert.equal(permissions.hasCustomerOwnerAuthority({workspace_role:'admin',is_master:true}),true,'Legacy compatibility remains customer-only');
for(const role of ['manager','marketer','platform_owner']) assert.equal(permissions.hasCustomerOwnerAuthority({workspace_role:role,is_master:false}),false);

const proxy=readFileSync(new URL('../src/proxy.ts',import.meta.url),'utf8');assert.ok(proxy.indexOf('getPlatformOperatorAccess(auth.identity)')<proxy.indexOf('verifySignedAdminSession('),'Platform gate runs before customer shared-password compatibility');
const member=readFileSync(new URL('../src/lib/security/workspaceAuth.ts',import.meta.url),'utf8');assert.ok(member.includes('workspace.is_legacy_customer !== true'),'Unqualified additional customer data plane stays closed');
let reservedMember=null,reservedOperator=null,workspace={status:'active',is_legacy_customer:true},admitted=true,inviteError=null,invites=0,otps=0;
const loginDb={rpc:async()=>({data:admitted,error:null}),from:table=>({select(){return this;},eq(){return this;},ilike(){return this;},in(){return this;},async maybeSingle(){return{data:table==='workspace_members'?reservedMember:table==='marketing_platform_operators'?reservedOperator:workspace,error:null};}}),auth:{admin:{inviteUserByEmail:async()=>{invites++;return{data:{user:{id:'provider-created-subject'}},error:inviteError};}}}};
const loginAuth={authDeadline:{run:f=>f()},auth:{signInWithOtp:async args=>{assert.equal(args.options.shouldCreateUser,false);otps++;return{error:null};}}};
const login=transpile('src/lib/security/loginLink.ts',{'server-only':{},'node:crypto':crypto,'@/lib/supabase/admin':{createSupabaseAdminClient:()=>loginDb},'@/lib/supabase/authServer':{createSupabaseServerAuthClient:async()=>loginAuth},'@/lib/supabase/authConfig':{getAuthConfirmUrl:next=>'https://system.example.test/auth/confirm?next='+encodeURIComponent(next)}});
process.env.LAUNCHHUB_ADMIN_SESSION_SECRET='fixture-only-at-least-32-character-key';
const send=()=>login.requestReservedLoginLink('fixture@example.test','fixture-ip','/dashboard');
await send();assert.deepEqual([invites,otps],[0,0],'Unknown identity receives no email');
reservedMember={auth_user_id:'existing-subject',workspace_id:'workspace'};admitted=false;await send();assert.deepEqual([invites,otps],[0,0],'Cooldown never sends');
admitted=true;workspace={status:'provisioning',is_legacy_customer:false};await send();assert.deepEqual([invites,otps],[0,0],'Unqualified customer never sends');
workspace={status:'active',is_legacy_customer:true};await send();assert.deepEqual([invites,otps],[0,1],'Existing customer uses its email identity');
reservedMember=null;reservedOperator={auth_user_id:null,status:'active'};await send();assert.deepEqual([invites,otps],[1,1],'Reserved platform identity receives a provider invite only when requested');
inviteError={code:'provider_unavailable'};await assert.rejects(send);assert.equal(otps,1,'Unknown invitation outcome does not send another email');
inviteError={code:'user_already_exists'};await send();assert.equal(otps,2,'Existing reserved subject uses a non-signup magic link');
console.log('PASS: verified platform identity, mismatched subjects/status/roles, unavailable provider, separate customer roles and closed additional-customer admission');
