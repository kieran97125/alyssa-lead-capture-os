import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(process.argv[2] || new URL('./apps-script/releases/20261021/native-main.gs', import.meta.url), 'utf8');
const box = {};
vm.createContext(box);
vm.runInContext(source, box);
const current = [3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29];
for (const row of [8, 123, 1001]) {
  const formula = box.oa2QueueCheckFormula_({columns:current},row);
  assert.ok(formula.includes(`MATCH($W${row},ids,0)`));
  for (const column of ['AA','U','K','T','G','E','F','H']) assert.ok(formula.includes(`$${column}${row}`));
  assert.ok(!formula.includes(`$Y${row}`), 'a hidden Queue State edit cannot masquerade as acceptance');
  assert.ok(formula.includes('COUNTIF(ids,'), 'duplicate appointment identities must fail closed');
  for (const text of ['未接納：請先在 Account 補預約日期','未接納：此預約已取消','未接納：未來預約不能標記已到店','已接納：']) assert.ok(formula.includes(text));
}
const legacy=box.oa2QueueCheckFormula_({columns:Array.from({length:26},(_,i)=>i+1)},8);
assert.ok(legacy.includes('MATCH($T8,ids,0)'));
assert.ok(legacy.includes('$D8<>expected'));
assert.ok(!legacy.includes('$V8'), 'legacy hidden state is not an authority either');
assert.ok(source.includes('checks.push({row:op.row,values:[oa2QueueCheckFormula_(layout,op.row)]});'));
assert.ok(!source.includes('function installArrivalStatusFeedback20261021'), 'no blanket installer should erase historical feedback');
console.log('Visible registry acceptance feedback contract passed across row and physical-layout variants.');
