import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash, webcrypto } from "node:crypto";
import path from "node:path";
import ts from "typescript";
const native = createRequire(import.meta.url);
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const m = {exports:{}}; cache.set(file,m);
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    new Function("require","module","exports",...Object.keys(globals),code)((name) => {
      if (name === "server-only") return {};
      if (Object.hasOwn(mocks,name)) return mocks[name];
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith(".")) return load(path.posix.normalize(path.posix.join(path.posix.dirname(file),name))+".ts");
      return native(name);
    },m,m.exports,...Object.values(globals));
    return m.exports;
  }
  return load;
}
const uuid = (digit) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const formId=uuid("1"),brandId=uuid("2"),treatmentId=uuid("3"),packageId=uuid("4"),branchId=uuid("5"),leadId=uuid("6"),contactId=uuid("7"),snapshotId=uuid("8"),deliveryId=uuid("9");
const response = {ok:true,lead_id:leadId,contact_id:contactId,source_snapshot_id:snapshotId,form_id:formId,delivery_id:deliveryId,delivery_status:"pending",event_id:"synthetic-event",conversion_mode:"thank_you_redirect",success_redirect_url:"https://example.test/thanks",value:588,source_type:"reg_form_utm",tracking_status:"complete_utm",audit_reason:"synthetic",attribution_trace_id:uuid("a")};
const business = {formId,customerName:"Synthetic",phone:"10000001",email:null,treatmentId,packageId,branchId,appointmentDate:"2026-11-20",appointmentTime:"14:00",paymentOption:"booking_only"};
let rpcError=null,rpcCalls=[],receiptRow=null;
const db = {rpc:async(name,args)=>{rpcCalls.push({name,args});return{data:rpcError?null:{response,replayed:false},error:rpcError};},from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:receiptRow,error:null})};return q;}};
const capture=loader({"@/lib/supabase/admin":{createSupabaseAdminClient:()=>db}})("src/lib/capture/publicCapture.ts");
await test("request identity scopes form and changed business fields",()=>{
  assert.equal(capture.publicCaptureRequestHash(business),capture.publicCaptureRequestHash({...business}));
  assert.notEqual(capture.publicCaptureRequestHash(business),capture.publicCaptureRequestHash({...business,branchId:uuid("a")}));
  assert.notEqual(capture.publicCaptureRequestHash(business),capture.publicCaptureRequestHash({...business,formId:uuid("b")}));
  assert.match(capture.normalizedSubmissionId(undefined),/^[a-f0-9-]{36}$/i);
  assert.throws(()=>capture.normalizedSubmissionId("not-an-id"),/capture_invalid_submission_id/);
});
const envelope={formId,submissionId:uuid("b"),requestHash:capture.publicCaptureRequestHash(business),contact:{},snapshot:{},lead:{},events:[],delivery:{},response:{}};
await test("capture uses one atomic RPC and validates its persisted receipt",async()=>{
  const result=await capture.persistPublicCapture(envelope);assert.equal(result.response.lead_id,leadId);
  assert.equal(rpcCalls.length,1);assert.equal(rpcCalls[0].name,"capture_public_lead_v1");
  assert.equal(rpcCalls[0].args.p_submission_id,envelope.submissionId);
});
await test("capture conflict and unavailable RPC fail without direct-write fallback",async()=>{
  rpcError={code:"22023",message:"capture_idempotency_conflict"};
  await assert.rejects(capture.persistPublicCapture(envelope),/capture_idempotency_conflict/);
  for (const code of ["capture_package_not_allowed", "capture_branch_not_allowed", "capture_invalid_events"]) {
    rpcError={code:"22023",message:code};await assert.rejects(capture.persistPublicCapture(envelope),new RegExp(code));
  }
  rpcError={code:"PGRST202",message:"function unavailable"};
  await assert.rejects(capture.persistPublicCapture(envelope),/capture_transaction_unavailable/);rpcError=null;
});
await test("receipt replays accepted IDs and rejects changed payload",async()=>{
  receiptRow={request_hash:envelope.requestHash,response_json:response};
  assert.equal((await capture.readPublicCaptureReceipt(envelope)).lead_id,leadId);
  await assert.rejects(capture.readPublicCaptureReceipt({...envelope,requestHash:"f".repeat(64)}),/capture_idempotency_conflict/);receiptRow=null;
});
const storage = new Map();
const client = loader({}, {crypto:webcrypto,sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}})("src/lib/capture/submissionIdentity.ts");
const browserBusiness={customer_name:"Synthetic",phone:"10000001",treatment_id:treatmentId,package_id:packageId,branch_id:branchId};
await test("browser retry identity survives reload and rotates when fields change",async()=>{
  const first=await client.getSubmissionIdentity("synthetic-form",browserBusiness,null);
  assert.equal((await client.getSubmissionIdentity("synthetic-form",browserBusiness,first)).id,first.id);
  assert.equal((await client.getSubmissionIdentity("synthetic-form",browserBusiness,null)).id,first.id);
  const edited=await client.getSubmissionIdentity("synthetic-form",{...browserBusiness,phone:"10000002"},first);assert.notEqual(edited.id,first.id);
  assert.ok(![...storage.values()].some(value=>value.includes("10000002")),"session record contains no raw business fields");
  client.clearSubmissionIdentity("synthetic-form",edited);assert.equal(storage.size,0);
});

const p=loader()("src/lib/integrations/googleSheetsLeadSync.ts");
const sheetPayload=p.buildGoogleSheetsLeadPayload({brandId,leadKey:leadId,createdAt:"2026-11-16T00:00:00Z",customerName:"Synthetic",phone:"10000001",email:"native-sheet@example.test",brandName:"GOS Beauty",formName:"Synthetic",treatmentName:"Synthetic",packageName:"Synthetic",price:588,branchName:"Synthetic",appointmentDate:null,appointmentTime:null,pageUrl:null,touch:{}});sheetPayload.secret="";
async function nativeScenario(options={}) {
  const calls=[],intents=[];
  const headers=[...p.GOOGLE_SHEETS_LEAD_HEADERS,...(options.missingIdentity?[]:["Omni Lead ID"])];
  const destination={id:uuid("a"),brand_id:brandId,display_name:"Synthetic",configuration:{dataset:"lead_funnel",spreadsheetId:"synthetic_spreadsheet_delivery_123456789",sourceProfile:"omni-account-v1",tabName:"lead"}};
  const query={select(){return query},eq(){return query},neq(){return query},limit:async()=>({data:options.noDestination?[]:[destination],error:null})};
  const fakeFetch=async(url,init={})=>{
    calls.push({url:decodeURIComponent(url),init});assert.ok(init.signal,"all strict Google reads/writes have a deadline");
    if(init.method==="POST") {
      if(options.appendThrows)throw Error("Synthetic lost response");
      return {ok:(options.appendStatus??200)<300,status:options.appendStatus??200,json:async()=>({updatedSpreadsheet:{sheets:[{properties:{sheetId:75},data:[{startRow:1,rowData:options.missingReceipt?[]:[...Array(10).fill({}),{values:[{userEnteredValue:{stringValue:`lead_${leadId}`}}]}]}]}]}})};
    }
    if(url.includes("?fields="))return{ok:true,json:async()=>({sheets:[{properties:{sheetId:75,title:"GOS Beauty",gridProperties:{rowCount:options.rowCount??5000}}}]})};
    const decoded=decodeURIComponent(url);
    if(decoded.includes("!1:1"))return{ok:true,json:async()=>({values:[headers]})};
    if(decoded.includes("!Z2:Z5000"))return{ok:true,json:async()=>({values:options.existing??[]})};
    if(decoded.includes("!J"))return{ok:true,json:async()=>({values:[[options.phone??"10000001"]]})};
    throw Error(`Unexpected synthetic Google read ${decoded}`);
  };
  const module=loader({"@/lib/integrations/googleSheetsOAuth":{getGoogleSheetsOAuthStatus:async()=>({writeEnabled:true}),getGoogleSheetsOAuthAccessToken:async()=>"synthetic-token"},"@/lib/integrations/googleSheetsLeadSync":p,"@/lib/supabase/admin":{hasSupabaseAdminEnv:()=>true,createSupabaseAdminClient:()=>({from:()=>query})}}, {fetch:fakeFetch})("src/lib/integrations/googleSheetsLeadNative.ts");
  const result=await module.deliverCapturedLeadToNativeSheet({brandId,payload:sheetPayload,pinnedTarget:options.pinnedTarget??null,reconcileOnly:options.reconcileOnly??false,beforeAppend:async(target)=>{intents.push(target);return!options.lostLease}});
  return {result,calls,intents,posts:calls.filter(c=>c.init.method==="POST")};
}
await test("native delivery persists intent before one routed atomic append",async()=>{
  const run=await nativeScenario();assert.equal(run.result.status,"delivered",JSON.stringify(run));assert.equal(run.posts.length,1);assert.equal(run.intents.length,1);assert.equal(run.result.updatedRange,"'GOS Beauty'!A12:Z12");
  const row=JSON.parse(run.posts[0].init.body).requests[0].appendCells.rows[0].values.map(c=>c.userEnteredValue?.stringValue);assert.equal(row[25],`lead_${leadId}`);assert.equal(row[20],"GOS Beauty");assert.equal(row[13],"native-sheet@example.test","GOS Email column N");
});
await test("existing matching ID reconciles without issuing append",async()=>{
  const run=await nativeScenario({existing:[[""],[`lead_${leadId}`]],reconcileOnly:true});assert.equal(run.result.status,"delivered");assert.equal(run.posts.length,0);assert.equal(run.intents.length,0);
});
await test("ambiguous prior write with no found ID never appends",async()=>{
  const run=await nativeScenario({reconcileOnly:true});assert.equal(run.result.status,"uncertain");assert.equal(run.posts.length,0);
});
await test("duplicate IDs or ID/phone mismatch block without overwriting staff data",async()=>{
  assert.equal((await nativeScenario({existing:[[leadId]],phone:"+852 1000 0001"})).result.status,"delivered","equivalent Hong Kong phone formatting reconciles safely");
  assert.equal((await nativeScenario({existing:[[leadId]],phone:"85210000001"})).result.status,"delivered","digits-only country code matches the inbound number");
  assert.equal((await nativeScenario({existing:[[leadId],[`lead_${leadId}`]]})).result.code,"destination_duplicate_identity");
  const run=await nativeScenario({existing:[[leadId]],phone:"10000002"});assert.equal(run.result.code,"destination_identity_phone_mismatch");assert.equal(run.posts.length,0);
});
await test("missing stable header, incomplete lookup and lost lease block append",async()=>{
  for(const input of [{missingIdentity:true},{rowCount:50001},{lostLease:true}]) {const run=await nativeScenario(input);assert.equal(run.result.status,"blocked");assert.equal(run.posts.length,0);}
});
await test("lost append response and HTTP5xx quarantine; HTTP429 is safe retry",async()=>{
  assert.equal((await nativeScenario({missingReceipt:true})).result.status,"uncertain");
  assert.equal((await nativeScenario({appendThrows:true})).result.status,"uncertain");
  assert.equal((await nativeScenario({appendStatus:503})).result.status,"uncertain");
  const run=await nativeScenario({appendStatus:429});assert.equal(run.result.status,"retry");assert.equal(run.result.safeToRetry,true);
});
await test("pinned retry preserves original target routing",async()=>{
  const pinned={sourceId:uuid("a"),spreadsheetId:"synthetic_spreadsheet_delivery_123456789",tabName:"GOS Beauty",headerRow:1,sheetBrand:"Pinned brand",account:"Pinned Account"};
  const run=await nativeScenario({pinnedTarget:pinned});assert.equal(run.result.status,"delivered");const row=JSON.parse(run.posts[0].init.body).requests[0].appendCells.rows[0].values.map(c=>c.userEnteredValue?.stringValue);assert.equal(row[4],"Pinned brand");assert.equal(row[20],"Pinned Account");
});

async function workerScenario({mode="delivered", priorIntent=null, attempt=1, loseLease=false, finalWriteError=false}={}) {
  const target={sourceId:uuid("a"),spreadsheetId:"synthetic_spreadsheet_delivery_123456789",tabName:"GOS Beauty",headerRow:1,sheetBrand:"GOS Beauty",account:"GOS Beauty"};
  const row={id:deliveryId,lead_id:leadId,brand_id:brandId,lease_token:uuid("b"),attempt_count:attempt,append_started_at:priorIntent,destination_json:priorIntent?target:null,payload_json:sheetPayload,status:"processing"};
  const patches=[],nativeInputs=[];let nativeWrites=0;
  const workerDb={rpc:async()=>({data:[{...row}],error:null}),from(){let patch,filters=[];const q={update(value){patch=value;return q},eq(...args){filters.push(args);return q},gt(){return q},async select(){
    patches.push(patch);assert.ok(filters.some(([k,v])=>k==="lease_token"&&v===uuid("b")));
    if(loseLease)return{data:[],error:null};
    if(finalWriteError&&patch.status)return{data:null,error:{code:"synthetic_final_journal"}};
    Object.assign(row,patch);return{data:[{id:row.id}],error:null};
  }};return q;}};
  const worker=loader({"@/lib/supabase/admin":{createSupabaseAdminClient:()=>workerDb},"@/lib/integrations/googleSheetsLeadNative":{deliverCapturedLeadToNativeSheet:async(input)=>{
    nativeInputs.push(input);
    if(priorIntent) return{status:mode,code:"synthetic_reconcile",target,safeToRetry:true};
    if(!await input.beforeAppend(target))return{status:"blocked",code:"delivery_lease_lost",target};
    nativeWrites++;return{status:mode,code:"synthetic_delivery",target,safeToRetry:mode==="retry"};
  }}})("src/lib/capture/leadDelivery.ts");
  const old=process.env.GOOGLE_SHEETS_SYNC_ENABLED;process.env.GOOGLE_SHEETS_SYNC_ENABLED="true";
  try{return{result:await worker.processPublicLeadDeliveries(),row,patches,nativeInputs,nativeWrites};}
  finally{if(old===undefined)delete process.env.GOOGLE_SHEETS_SYNC_ENABLED;else process.env.GOOGLE_SHEETS_SYNC_ENABLED=old;}
}
await test("worker journals append intent under lease and finishes delivered",async()=>{
  const run=await workerScenario();assert.equal(run.result.delivered,1);assert.equal(run.nativeWrites,1);
  assert.ok(run.patches[0].append_started_at);assert.equal(run.row.status,"delivered");assert.equal(run.row.lease_token,null);
});
await test("worker fences stale lease before write and final update",async()=>{
  const run=await workerScenario({loseLease:true});assert.equal(run.nativeWrites,0);assert.equal(run.result.failed,1);assert.equal(run.row.status,"processing");
});
await test("worker quarantines ambiguous write and next attempt reconciles only",async()=>{
  const ambiguous=await workerScenario({mode:"uncertain"});assert.equal(ambiguous.row.status,"uncertain");assert.ok(ambiguous.row.append_started_at);
  const reconcile=await workerScenario({priorIntent:ambiguous.row.append_started_at});assert.equal(reconcile.nativeInputs[0].reconcileOnly,true);assert.equal(reconcile.nativeWrites,0);assert.equal(reconcile.result.delivered,1);
});
await test("worker only resets append marker after definite new-write rejection",async()=>{
  const definite=await workerScenario({mode:"retry"});assert.equal(definite.row.append_started_at,null);assert.equal(definite.row.status,"retry");
  const historical=await workerScenario({mode:"blocked",priorIntent:"2026-11-16T00:00:00Z"});assert.ok(historical.row.append_started_at,"reconciliation failures retain uncertain append marker");
});
await test("lost final journal response preserves marker and lease for reconciliation",async()=>{
  const run=await workerScenario({finalWriteError:true});assert.equal(run.result.failed,1);assert.equal(run.row.status,"processing");assert.ok(run.row.append_started_at);
});
await test("retry budget exhaustion becomes visible blocked state",async()=>{
  const run=await workerScenario({mode:"retry",attempt:8});assert.equal(run.result.blocked,1);assert.equal(run.row.status,"blocked");
});

// Execute the actual HTTP route with isolated configuration/DB adapters. This
// verifies validation, receipt ordering and background scheduling without writes.
const next=native("next/server");
let adminReady=true,persisted=[],background=[],replayedReceipt=null,receiptExpectedHash=null,routeError=null,scheduleFailure=false;
const form={id:formId,public_form_token:"synthetic-form",brand_id:brandId,status:"active",allowed_domains:["https://example.test"],default_treatment_id:treatmentId,default_package_id:packageId,default_branch_id:branchId,form_name:"Synthetic",package_selection_mode:"fixed",conversion_mode:"thank_you_redirect",success_redirect_url:"https://example.test/thanks"};
let routeBrandSlug = "gos";
const routeDb={from(table){const q={select(){return q},eq(){return q},order(){return q},single(){return q},maybeSingle(){return q},then(resolve,reject){
  const data=table==="forms"?form:table==="form_branches"?[{branch_id:branchId,is_default:true,is_active:true}]:table==="packages"?{id:packageId,treatment_id:treatmentId,name:"Synthetic",promo_price:588,currency:"HKD",payment_required:false}:table==="treatments"?{id:treatmentId,brand_id:brandId,name:"Synthetic"}:table==="branches"?{id:branchId,brand_id:brandId,name:"Synthetic"}:table==="brands"?{slug:routeBrandSlug,name:"Synthetic Brand"}:null;
  return Promise.resolve({data,error:null}).then(resolve,reject);
}};return q;}};
const route=loader({"next/server":{...next,after:fn=>{if(scheduleFailure)throw Error("Synthetic scheduler unavailable");background.push(fn)}},"@/lib/supabase/admin":{hasSupabaseAdminEnv:()=>adminReady,createSupabaseAdminClient:()=>routeDb},"@/lib/capture/publicCapture":{...capture,readPublicCaptureReceipt:async(input)=>{if(replayedReceipt&&receiptExpectedHash&&input.requestHash!==receiptExpectedHash)throw new capture.PublicCaptureError("capture_idempotency_conflict");return replayedReceipt;},persistPublicCapture:async(input)=>{if(routeError)throw new capture.PublicCaptureError(routeError);persisted.push(input);return{response,replayed:false};}},"@/lib/capture/leadDelivery":{processPublicLeadDeliveries:async()=>{throw Error("Only an explicitly invoked background fixture may deliver");}}})("src/app/api/public/leads/route.ts");
const validBody={form_token:"synthetic-form",submission_id:uuid("b"),customer_name:"Synthetic",phone:"10000001",email:"  form+receipt@example.test  ",treatment_id:treatmentId,package_id:packageId,branch_id:branchId,appointment_date:"2026-11-20",appointment_time:"14:00",payment_option:"booking_only",legalConsentAccepted:true,submitted_touch_json:{current_page_url:"https://example.test/campaign?utm_source=meta&utm_medium=paid&utm_campaign=synthetic",utm_source:"meta",utm_medium:"paid",utm_campaign:"synthetic"}};
let ip=1;
async function request(body=validBody) {return route.POST(new next.NextRequest("https://example.test/api/public/leads",{method:"POST",headers:{"content-type":"application/json",origin:"https://example.test","x-forwarded-for":`203.0.113.${ip++}`},body:JSON.stringify(body)}));}
const envBefore={NODE_ENV:process.env.NODE_ENV,ALYSSA_E2E_FIXTURES:process.env.ALYSSA_E2E_FIXTURES,GOOGLE_SHEETS_SYNC_ENABLED:process.env.GOOGLE_SHEETS_SYNC_ENABLED,GOOGLE_SHEETS_WEBHOOK_SECRET:process.env.GOOGLE_SHEETS_WEBHOOK_SECRET};
process.env.NODE_ENV="production";delete process.env.ALYSSA_E2E_FIXTURES;process.env.GOOGLE_SHEETS_SYNC_ENABLED="true";process.env.GOOGLE_SHEETS_WEBHOOK_SECRET="synthetic-never-persist";
try {
  await test("production missing database rejects rather than faking accepted registration",async()=>{
    adminReady=false;const result=await request();assert.equal(result.status,503);assert.equal((await result.json()).ok,false);assert.equal(persisted.length,0);adminReady=true;
  });
  await test("GOS rejects missing and invalid email before any capture or delivery", async () => {
    for (const [email, code] of [[undefined, "email_required"], ["   ", "email_required"], ["bad-address", "invalid_email"], ["x@b", "invalid_email"]]) {
      const result = await request({ ...validBody, email, brand_id: "other-brand" });
      assert.equal(result.status, 400);
      assert.equal((await result.json()).error, code);
    }
    assert.equal(persisted.length, 0);
    assert.equal(background.length, 0);
  });
  await test("accepted HTTP capture persists consent/source and defers Google work",async()=>{
    const result=await request();assert.equal(result.status,201);const body=await result.json();assert.equal(body.lead_id,leadId);
    assert.ok(body.final_redirect_url.includes(leadId));assert.equal(persisted.length,1);assert.equal(background.length,1);
    assert.equal(persisted[0].contact.email,"form+receipt@example.test");
    assert.equal(persisted[0].delivery.payload.rowValues[13],"form+receipt@example.test");
    assert.equal(persisted[0].delivery.payload.secret,"");assert.equal(persisted[0].events.length,3);
    assert.ok(persisted[0].events.some(e=>e.event_payload_json.consent_event==="legal_consent_accepted"));
    assert.equal(persisted[0].snapshot.utm_source,"meta");assert.equal(persisted[0].lead.normalized_phone,"+85210000001");
  });
  await test("accepted receipt survives later form archival without new capture or background send",async()=>{
    replayedReceipt=response;form.status="archived";const result=await request();assert.equal(result.status,201);assert.equal(persisted.length,1);assert.equal(background.length,1);form.status="active";replayedReceipt=null;
  });
  await test("transaction failure returns unavailable with no background delivery",async()=>{
    routeError="capture_transaction_unavailable";const result=await request();assert.equal(result.status,503);assert.equal(background.length,1);routeError=null;
  });
  await test("missing consent is rejected before persistence",async()=>{
    const result=await request({...validBody,legalConsentAccepted:false});assert.equal(result.status,400);assert.equal(persisted.length,1);
  });
  await test("identical declared selection replays despite changed form defaults",async()=>{
    const omitted={...validBody,submission_id:uuid("c")};delete omitted.treatment_id;delete omitted.package_id;delete omitted.branch_id;
    assert.equal((await request(omitted)).status,201);const acceptedCount=persisted.length;
    receiptExpectedHash=persisted.at(-1).requestHash;replayedReceipt=response;
    const original=[form.default_treatment_id,form.default_package_id,form.default_branch_id];
    [form.default_treatment_id,form.default_package_id,form.default_branch_id]=[uuid("a"),uuid("b"),uuid("c")];
    try {assert.equal((await request(omitted)).status,201);assert.equal(persisted.length,acceptedCount);}
    finally {[form.default_treatment_id,form.default_package_id,form.default_branch_id]=original;receiptExpectedHash=null;replayedReceipt=null;}
  });
  await test("existing GOS receipts from before mandatory email still replay", async () => {
    const before = persisted.length;
    replayedReceipt = response;
    try {
      const result = await request({ ...validBody, email: undefined });
      assert.equal(result.status, 201);
      assert.equal(persisted.length, before);
    } finally { replayedReceipt = null; }
  });
  await test("other brands still accept a fresh submission without email", async () => {
    routeBrandSlug = "ineffable";
    try { assert.equal((await request({ ...validBody, email: undefined })).status, 201); }
    finally { routeBrandSlug = "gos"; }
  });
  await test("background scheduler failure cannot revoke a committed acceptance",async()=>{
    scheduleFailure=true;const before=persisted.length;
    try {const result=await request();assert.equal(result.status,201);assert.equal(persisted.length,before+1);}
    finally {scheduleFailure=false;}
  });
} finally {for(const[k,v]of Object.entries(envBefore)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
await test("native Wix email-only bookings keep the submitted email, Hong Kong time and immutable source", async () => {
  const wix = loader()("src/lib/capture/gosWixRegistration.ts");
  const body = { kind:"booking", eventId:formId, email:"native@example.test", firstName:"Synthetic",
    label:"Synthetic service", initiator:"VISITOR", startsAt:"2026-11-30T03:30:00Z" };
  const secret = "a".repeat(64);
  const digest = createHash("sha256").update(secret).digest("hex");
  assert.equal(wix.authenticGosWixWebhook(secret, digest), true);
  assert.equal(wix.authenticGosWixWebhook("b".repeat(64), digest), false);
  assert.equal(wix.gosWixEvent.safeParse({...body,email:"invalid"}).success, false);
  const payload = wix.gosWixSheetPayload(wix.gosWixEvent.parse(body), leadId);
  assert.equal(payload.email,body.email); assert.equal(payload.phone,""); assert.equal(payload.secret,"");
  assert.equal(payload.appointmentDate,"2026-11-30"); assert.equal(payload.appointmentTime,"11:30");
  const cells = loader()("src/lib/integrations/gosLeadSheetCells.ts");
  assert.deepEqual(cells.gosLeadSheetCells(["電話","Email"],["",body.email],true), [{},{userEnteredValue:{stringValue:body.email}}]);
  assert.throws(()=>cells.gosLeadSheetCells(["電話"],[""]));
});
console.log(`PASS ${passed} public capture, HTTP acceptance, browser identity and durable delivery cases; no external network/database mutations.`);
