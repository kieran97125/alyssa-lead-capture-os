import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const native=createRequire(import.meta.url);
function load(file,mocks={}){const m={exports:{}};const code=ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function("require","module","exports",code)(name=>Object.hasOwn(mocks,name)?mocks[name]:native(name),m,m.exports);return m.exports;}
const auth=load("src/lib/capture/leadDeliveryAuth.ts");
const secret="synthetic-delivery-signing-key-32-plus-characters";
const now=1794798000000,seconds=Math.floor(now/1000);
const sign=(timestamp,path=auth.LEAD_DELIVERY_WORKER_PATH,method="GET")=>createHmac("sha256",secret).update(`${method}\n${path}\n${timestamp}`).digest("hex");
const valid={method:"GET",path:auth.LEAD_DELIVERY_WORKER_PATH,timestamp:String(seconds),signature:sign(String(seconds)),secret,nowMs:now};
let passed=0;
function test(name,fn){fn();passed++;console.log(`PASS ${name}`);}
test("fresh exact endpoint proof verifies",()=>assert.equal(auth.verifyLeadDeliverySignature(valid),true));
test("PostgreSQL and Node canonical signing vector match",()=>assert.equal(sign("1794798000"),"5ae8d7225a7d0a7f385e958e4f28f4453af14d9930c2e44315fe36dbacab38ca"));
test("missing or short signing key fails closed",()=>{for(const key of [undefined,"","short",` ${secret}`,`${secret}\n`])assert.equal(auth.verifyLeadDeliverySignature({...valid,secret:key}),false);});
test("wrong signature and malformed hex are rejected",()=>{for(const signature of [null,"f".repeat(64),"g".repeat(64),"a".repeat(63)])assert.equal(auth.verifyLeadDeliverySignature({...valid,signature}),false);});
test("old and future proofs are rejected outside bounded skew",()=>{for(const age of [61,-16]){const timestamp=String(seconds-age);assert.equal(auth.verifyLeadDeliverySignature({...valid,timestamp,signature:sign(timestamp)}),false);}});
test("freshness boundaries accept exactly 60s old or 15s future",()=>{for(const age of [60,-15]){const timestamp=String(seconds-age);assert.equal(auth.verifyLeadDeliverySignature({...valid,timestamp,signature:sign(timestamp)}),true);}});
test("wrong method or path cannot reuse proof",()=>{assert.equal(auth.verifyLeadDeliverySignature({...valid,method:"POST"}),false);assert.equal(auth.verifyLeadDeliverySignature({...valid,path:"/api/cron/marketing-data-sources"}),false);assert.equal(auth.verifyLeadDeliverySignature({...valid,signature:sign(valid.timestamp,"/another-path")}),false);});
test("non-integer and unsafe timestamps are rejected",()=>{for(const timestamp of ["0","-1","1794798000.1","1794798000x","99999999999999999"]){assert.equal(auth.verifyLeadDeliverySignature({...valid,timestamp,signature:sign(timestamp)}),false);}});
const next=native("next/server");let workerCalls=0;
const route=load("src/app/api/cron/lead-deliveries/route.ts",{"@/lib/capture/leadDeliveryAuth":auth,"@/lib/capture/leadDelivery":{processPublicLeadDeliveries:async()=>{workerCalls++;return{ok:true,claimed:0,delivered:0};}}});
const oldSigning=process.env.LEAD_DELIVERY_SIGNING_SECRET,oldGlobal=process.env.CRON_SECRET;
process.env.LEAD_DELIVERY_SIGNING_SECRET=secret;process.env.CRON_SECRET="synthetic-global-cron-token";
try{
 for(const kind of ["global-token","missing","wrong-path","expired","future","valid","query"]){
  let timestamp=String(Math.floor(Date.now()/1000));if(kind==="expired")timestamp=String(Number(timestamp)-61);if(kind==="future")timestamp=String(Number(timestamp)+16);
  const headers={};if(kind==="global-token")headers.authorization=`Bearer ${process.env.CRON_SECRET}`;else if(kind!=="missing"){headers[auth.LEAD_DELIVERY_TIMESTAMP_HEADER]=timestamp;headers[auth.LEAD_DELIVERY_SIGNATURE_HEADER]=sign(timestamp);}
  const path=kind==="wrong-path"?"/api/cron/marketing-data-sources":auth.LEAD_DELIVERY_WORKER_PATH+(kind==="query"?"?dispatch=1":"");
  const result=await route.GET(new next.NextRequest(`https://example.test${path}`,{headers}));assert.equal(result.status,kind==="valid"?200:401,kind);passed++;console.log(`PASS HTTP ${kind}`);
 }
 assert.equal(workerCalls,1,"only a fresh dedicated proof reaches the worker");
 delete process.env.LEAD_DELIVERY_SIGNING_SECRET;const timestamp=String(Math.floor(Date.now()/1000));const headers={[auth.LEAD_DELIVERY_TIMESTAMP_HEADER]:timestamp,[auth.LEAD_DELIVERY_SIGNATURE_HEADER]:sign(timestamp)};
 assert.equal((await route.GET(new next.NextRequest(`https://example.test${auth.LEAD_DELIVERY_WORKER_PATH}`,{headers}))).status,401);assert.equal(workerCalls,1);passed++;console.log("PASS HTTP missing deployment key");
}finally{if(oldSigning===undefined)delete process.env.LEAD_DELIVERY_SIGNING_SECRET;else process.env.LEAD_DELIVERY_SIGNING_SECRET=oldSigning;if(oldGlobal===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=oldGlobal;}
const recipe=readFileSync(new URL("../supabase/drafts/public_lead_delivery_schedule.sql",import.meta.url),"utf8");
assert.ok(recipe.includes("extensions.hmac("));assert.ok(!recipe.includes("'Authorization'"));assert.ok(!recipe.includes("Bearer "));assert.ok(recipe.includes("65000"));assert.equal(recipe.match(/where name = 'public_lead_delivery_signing_secret'/g)?.length,2);
console.log(`PASS ${passed} signing/HTTP authorization cases plus source-only scheduler guards; no network or configuration mutations.`);
