import assert from 'node:assert/strict';
import { EXISTING_CATEGORY_RULES, ADDITIONAL_CATEGORY_RULES, reportingRulesFromRows, classifyReportingTreatment, categoryFilterFormula, categoryExceptionFormula, groupedTreatmentPerformanceFormula } from './lead-sheet-treatment-categories.mjs';

const accounts = ['Ineffable','Ineffable','Ineffable','Ineffable','Alyssa Main','Alyssa Aesthetics','Alyssa Main','Alyssa Aesthetics','Alyssa Aesthetics','Alyssa Aesthetics','Alyssa Main','Alyssa Aesthetics','Alyssa Main','Alyssa Aesthetics','GOS Beauty','GOS Beauty','GOS Beauty','GOS Beauty','GOS Beauty','GOS Beauty','GOS Beauty','Alyssa Main','Alyssa Aesthetics','GOS Beauty','GOS Beauty'];
const rows = [['enabled','account']];
for (const [i, category, pattern, priority] of EXISTING_CATEGORY_RULES) rows[i-1] = [true,accounts[i-2],'','','','',category,'','',pattern,priority];
rows.push(...ADDITIONAL_CATEGORY_RULES);
const rules = reportingRulesFromRows(rows);
const cases = [
  ['Alyssa Aesthetics','了解Xeomin 優惠💕','XEOMIN'],
  ['Alyssa Aesthetics','優惠1：$999 魚尾紋/眉心/抬頭紋/收鼻翼 優惠2：$1699 XEOMIN 瘦面針','XEOMIN'],
  ['Alyssa Aesthetics','了解JULÄINE優惠 💕','JULÄINE'],
  ['Alyssa Aesthetics','BELOTERO®️ Revive水光💚','Belotero'],
  ['Alyssa Aesthetics','Belotero買一送一優惠🥰','Belotero'],
  ['Alyssa Main','$1010 XEOMIN','XEOMIN'],
  ['Alyssa Medical','了解Xeomin 優惠💕','XEOMIN'],
  ['GOS Beauty','10.10 脫毛｜$988｜Bikini V + I Line，各6次','激光脫毛'],
  ['GOS Beauty','兩年激脫計劃 永久保養計劃','激光脫毛'],
  ['GOS Beauty','10.10 蜜桃胸｜BTL EXILIS 胸部緊緻護理｜$380／2次','BTL EXILIS'],
  ['GOS Beauty','10.10 纖腰腹｜BTL EXILIS 腰腹緊緻塑形','BTL EXILIS'],
  ['GOS Beauty','士多啤梨 $580','水漾淨肌（士多啤梨）'],
  ['GOS Beauty','斑','去斑／嫩膚'],
  ['GOS Beauty','龍眼','眼周護理（龍眼）'],
  ['Alyssa Main','$1,280 復合式體態管理優惠','SlimCut＋AI追脂'],
  ['Alyssa Main','Slimcut + AI追脂','SlimCut＋AI追脂'],
  ['Alyssa Main','ViVi 瘦身Combo','SlimCut＋AI追脂'],
  ['Alyssa Main','Laiza瘦身Combo','SlimCut'],
  ['Alyssa Main','Vivi 做的瘦身','瘦身（技術待確認）'],
  ['Alyssa Main','Poyi嘅1010瘦面優惠','瘦面（技術待確認）'],
  ['Alyssa Aesthetics','Yanyan 做嘅Face Pilates','Facelift／Face Pilates'],
  ['Skin Light','facelift $688','Facelift／Face Pilates'],
  ['Ineffable','$588 S-Lite 水感輕腿管理','S-Lite'],
  ['Ineffable','$388 柔清舒敏針清','柔清舒敏／針清'],
  ['GOS Beauty','$988','未分類療程'],
  ['Ineffable','Poyi','未分類療程'],
  ['GOS Beauty','了解Xeomin 優惠','未分類療程'],
];
for (const [a,t,want] of cases) assert.equal(classifyReportingTreatment(a,t,rules),want, `${a}: ${t}`);
// Group by Account + Brand + category, preserving every stage independently.
const facts = [
  {a:'Alyssa Aesthetics',b:'Aesthetics Medical',t:'了解Xeomin 優惠',n:[3,1,0,1]},
  {a:'Alyssa Aesthetics',b:'Aesthetics Medical',t:'了解Xeomin 優惠💕',n:[1,0,0,0]},
  {a:'Alyssa Aesthetics',b:'Alyssa Aesthetics',t:'了解Xeomin 優惠💕',n:[8,0,0,0]},
  {a:'Alyssa Medical',b:'Alyssa Medical',t:'了解Xeomin 優惠💕',n:[2,1,0,0]},
];
const grouped=new Map();
for(const f of facts){const key=JSON.stringify([f.a,f.b,classifyReportingTreatment(f.a,f.t,rules)]);const n=grouped.get(key)||[0,0,0,0];grouped.set(key,n.map((v,i)=>v+f.n[i]));}
assert.equal(grouped.size,3);
assert.deepEqual(grouped.get(JSON.stringify(['Alyssa Aesthetics','Aesthetics Medical','XEOMIN'])),[4,1,0,1]);
assert.deepEqual([...grouped.values()].reduce((t,n)=>t.map((v,i)=>v+n[i]),[0,0,0,0]),[14,2,0,1]);
assert.match(categoryFilterFormula("EXACT('_funnel_metrics'!$D$2:$D$30000,$G$4)"),/\$M\$2/);
assert.throws(()=>categoryExceptionFormula('wrong version'));
assert.throws(()=>groupedTreatmentPerformanceFormula('wrong version'));
console.log('PASS: technical aliases, scoped ownership, composite priority, unknown data and stage-total conservation');
