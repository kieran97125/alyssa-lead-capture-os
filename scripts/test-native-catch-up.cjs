const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filename = process.argv[2] || path.join(__dirname, 'apps-script/releases/20261022/native-main.gs');
const source = fs.readFileSync(filename, 'utf8');
function fixture(responses, durations = []) {
  let now = 0;
  const logs = [];
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({ Date: Clock, console: { log: value => logs.push(JSON.parse(value)) } });
  vm.runInContext(source, context, { filename });
  const accounts = Array.from(vm.runInContext('OMNI_ACCOUNT_TABS.slice()', context));
  let calls = 0;
  context.omniArrivalV2Timer = () => {
    const index = calls++;
    now += durations[index] || 1;
    const next = responses[index];
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(accounts) : next;
  };
  return { accounts, logs, calls: () => calls, run: () => JSON.parse(JSON.stringify(context.catchUpOmniArrivalV2())) };
}
const account = (index, extra = {}) => accounts => ({ account: accounts[index], newQueue: 0, changes: 0,
  deferredQueueConflicts: 0, deferredSourceRecords: 0, csProjection: { ok: true, changed: 0 }, ...extra });

{
  const f = fixture(Array.from({ length: 6 }, (_, i) => account(i)));
  const result = f.run();
  assert.equal(result.scope, 'native_arrival_reconciliation');
  assert.equal(result.nativeState, 'complete');
  assert.equal(result.reconciliationComplete, true);
  assert.equal(result.coverageComplete, true);
  assert.equal(result.completedCalls, 6);
  assert.equal(result.preparatoryCalls, 0);
  assert.deepEqual(result.remainingAccounts, []);
  assert.equal(result.masterProjectionVerified, false, 'Native success never claims a separate formula is verified');
}
{
  const f = fixture([{ identity: { registered: 50, recovered: 1, bookedAdded: 2 }, identityOnly: true, deferredAccountReconciliation: true }]);
  const result = f.run();
  assert.equal(result.nativeState, 'pending');
  assert.equal(result.stopReason, 'identity_pending');
  assert.equal(result.coverageComplete, false);
  assert.equal(result.completedCalls, 0);
  assert.equal(result.preparatoryCalls, 1);
  assert.equal(result.preparatoryRuns[0].registered, 50);
  assert.equal(result.preparatoryRuns[0].recovered, 1);
  assert.deepEqual(result.remainingAccounts, f.accounts);
  assert.equal(f.calls(), 1, 'An accepted identity stage causes neither a false failure nor an extra worker call');
}
for (const identity of [{ review: 1 }, { blocked: true }, { accountFailures: [{ accountIndex: 0, reason: 'synthetic' }] }]) {
  const f = fixture([{ identityOnly: true, identity }]);
  const result = f.run();
  assert.equal(result.nativeState, 'review');
  assert.equal(result.stopReason, 'identity_review');
  assert.equal(result.needsReview, true);
  assert.equal(result.reconciliationComplete, false);
}
{
  const f = fixture([{ installed: true, display: { namesRestored: 0 }, sort: { sorted: 0 }, identity: {} }]);
  const result = f.run();
  assert.equal(result.nativeState, 'pending');
  assert.equal(result.stopReason, 'maintenance_pending');
  assert.deepEqual(result.preparatoryRuns.map(run => run.phase), ['maintenance']);
  assert.equal(result.completedCalls, 0);
  assert.equal(f.calls(), 1);
}
for (const [response, reason] of [[{ busy: true }, 'busy'], [{ skipped: true, reason: 'staff_priority' }, 'staff_priority'], [{ enabled: false }, 'disabled']]) {
  const f = fixture([response]);
  const result = f.run();
  assert.equal(result.stopReason, reason);
  assert.equal(result.nativeState, 'pending');
  assert.equal(result.coverageComplete, false);
  assert.equal(f.calls(), 1, 'Busy, staff priority and disabled admission never spin');
}
{
  const f = fixture([account(0), { identityOnly: true, identity: { registered: 1 } }]);
  const result = f.run();
  assert.equal(result.completedCalls, 1);
  assert.equal(result.preparatoryCalls, 1);
  assert.deepEqual(result.coveredAccounts, [f.accounts[0]]);
  assert.equal(result.remainingAccounts.length, 5);
}
{
  const f = fixture(Array.from({ length: 6 }, () => account(0)));
  const result = f.run();
  assert.equal(result.nativeState, 'pending');
  assert.equal(result.coverageComplete, false, 'A shared cursor or repeated receipt cannot fabricate six-Account coverage');
  assert.equal(result.stopReason, 'step_limit');
}
{
  const f = fixture(Array.from({ length: 6 }, (_, i) => account(i, i === 1 ? { csProjection: { ok: false } } : {})));
  const result = f.run();
  assert.equal(result.coverageComplete, true);
  assert.equal(result.nativeState, 'pending');
  assert.equal(result.projectionPending, true);
  assert.equal(result.reconciliationComplete, false, 'Accepted source changes do not conceal an unfinished CS projection');
}
for (const key of ['deferredQueueConflicts', 'deferredSourceRecords']) {
  const f = fixture(Array.from({ length: 6 }, (_, i) => account(i, i === 2 ? { [key]: 1 } : {})));
  const result = f.run();
  assert.equal(result.coverageComplete, true);
  assert.equal(result.nativeState, 'review');
  assert.equal(result.reconciliationComplete, false);
}
{
  const f = fixture([account(0)], [120000]);
  const result = f.run();
  assert.equal(result.stopReason, 'time_budget');
  assert.equal(result.hardDeadline, false);
  assert.equal(f.calls(), 1, 'The existing admission reserve still bounds the next worker start');
}
for (const malformed of [null, {}, { identityOnly: true }, { installed: true }]) {
  const f = fixture([malformed]);
  assert.throws(() => f.run(), /unexpected timer result/);
  assert.equal(f.logs.at(-1).stopReason, 'unexpected_result');
}
{
  const original = new Error('synthetic worker failure');
  const f = fixture([original]);
  assert.throws(() => f.run(), error => error === original, 'A real worker failure is never converted to success');
  assert.equal(f.logs.at(-1).stopReason, 'account_failure');
}
console.log('PASS: native catch-up stage receipts, partial coverage, review, projection failure, admission budget and real errors; no spreadsheet service invoked.');
