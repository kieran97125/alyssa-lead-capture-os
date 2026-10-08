import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const sourcePath=process.argv[2]||new URL('../release-evidence/arrival-cancellation-20261008/transition-baseline.gs',import.meta.url);
const before=fs.readFileSync(sourcePath,'utf8');
const replacement=fs.readFileSync(new URL('./apps-script/arrival-cancel-correction-v1.gs',import.meta.url),'utf8').replace(/^\/\*\*[^]*?\*\/\s*/, '').trim();
const qa=fs.readFileSync(new URL('../release-evidence/arrival-cancellation-20261008/native-qa.gs',import.meta.url),'utf8');
const definition=/^function oa2QueueAction_\(ctx,apptId,action\) \{[^]*?^\}/gm;
assert.equal([...before.matchAll(definition)].length,1,'Replace exactly one bound transition');
const patched=before.replace(definition,replacement);
new vm.Script(patched+'\n'+qa);
const Utilities={DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest(_algorithm,value){return [...createHash('sha256').update(value).digest()];},formatDate(date,timeZone,format){assert.equal(format,'yyyy-MM-dd');return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}};
function run(source){const ctx=vm.createContext({console,Utilities,Date,JSON,Set,Map});vm.runInContext(source+'\n'+qa,ctx);return ctx.verifyArrivalCancellationCorrection20261008();}
assert.throws(()=>run(before),/Cancellation QA: Show cancellation clears current evidence/,'The regression must fail against the saved live guard');
const result=run(patched);assert.equal(result.failed,0);assert.equal(result.spreadsheetWrites,0);assert.ok(result.passed>=35);
console.log(`PASS: original bug reproduced; ${result.passed} corrected transition, retry, history, metric and concurrent-edit checks`);
