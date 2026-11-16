// Reporting-only taxonomy. Source item/offer, identity, ownership and stage dates remain untouched.
export const CATEGORY_MAP_SHEET = '_dashboard_treatment_map';
export const UNCLASSIFIED_TREATMENT = '未分類療程';
export const EXISTING_CATEGORY_RULES = [
  [2, '柔清舒敏／針清', '針清|柔清', 20],
  [3, 'DEP 無針水光', 'dep|nano|無針水光', 20],
  [4, 'S-Lite', 's[- ]?lite|水感輕腿|輕腿', 20],
  [5, 'BTL EXION／EXILIS', 'btl|exion|exilis|膠原提拉|全面膠原', 20],
  [6, 'Facelift／Face Pilates', 'face[ ]?lift|face[ ]?pilates', 20],
  [7, 'Facelift／Face Pilates', 'face[ ]?lift|face[ ]?pilates', 20],
  [8, 'SlimCut', 'slim[ ]?cut', 20],
  [9, 'SlimCut', 'slim[ ]?cut', 20],
  [10, 'JULÄINE', 'jul[äa]ine', 20],
  [11, 'XEOMIN', 'xeomin', 20],
  [12, '肌源28', '肌源[ ]?28|jiyuan[ ]?28', 20],
  [13, '肌源28', '肌源[ ]?28|jiyuan[ ]?28', 20],
  [14, 'Facelift／Face Pilates', 'face[ ]?pilates', 20],
  [15, 'Facelift／Face Pilates', 'face[ ]?pilates', 20],
  [16, '激光脫毛', '脫毛|激脫|bikini|i[ ]?line', 20],
  [17, '激光脫毛', '脫毛|激脫|bikini|i[ ]?line', 20],
  [18, 'BTL EXILIS', '蜜桃胸|exilis|胸部緊緻', 20],
  [19, 'BTL EXILIS', '纖腰腹|exilis|腰腹緊緻', 20],
  [20, '去斑／嫩膚', '去斑|打斑|嫩膚|色斑|雀斑|曬斑|^斑$', 20],
  [21, '疣／癦／痣處理', '疣|癦|痣|肉粒|油脂粒|汗管瘤', 20],
  [22, '激光脫毛', '脫毛|激脫|三波長|bikini|i[ ]?line|永久保養', 20],
  [23, 'Restylane', 'restylane', 20],
  [24, 'Restylane', 'restylane', 20],
  [25, '眼周護理（龍眼）', '龍眼|眼周護理|眼部護理|射頻眼部', 20],
  [26, '水漾淨肌（士多啤梨）', '士多啤梨|皇牌水漾淨肌', 20],
];

const extra = (account, code, category, pattern, priority = 20, note = '') =>
  [true, account, '', code, '', category, category, `報表專用；不改 Lead 項目或品牌。${note}`, '', pattern, priority];
export const ADDITIONAL_CATEGORY_RULES = [
  ...['Alyssa Main', 'Alyssa Aesthetics', 'Alyssa Medical'].flatMap((a, i) => [
    extra(a, `report-${i}-xeomin`, 'XEOMIN', 'xeomin'),
    extra(a, `report-${i}-julaine`, 'JULÄINE', 'jul[äa]ine'),
    extra(a, `report-${i}-belotero`, 'Belotero', 'belotero'),
  ]),
  ...['Alyssa Main', 'Alyssa Aesthetics'].flatMap((a, i) => [
    extra(a, `report-${i}-body-combo`, 'SlimCut＋AI追脂', '復合式體態|複合式體態|slim[ ]?cut.*ai|ai[ ]?追脂|vivi.*combo', 5, '複合式體態／Vivi Combo：KOL promotion 的 Slimcut＋AI 定義。'),
    extra(a, `report-${i}-collagen`, '膠原水光', '膠原水光'),
    extra(a, `report-${i}-microneedle`, '黃金／射頻微針', '黃金微針|射頻微針|射頻針'),
    extra(a, `report-${i}-invisible-lift`, '隱形拉皮術', '隱形拉皮|sd聚點'),
    extra(a, `report-${i}-remote-slim`, '隔空溶脂', '隔空溶脂'),
    extra(a, `report-${i}-cleansing`, '柔清舒敏／針清', '柔清|針清'),
    extra(a, `report-${i}-unspecified-slim`, '瘦身（技術待確認）', '瘦身|減肥|纖體|slim', 100),
    extra(a, `report-${i}-unspecified-face`, '瘦面（技術待確認）', '瘦面', 100),
  ]),
  extra('Alyssa Main', 'report-laiza-slimcut', 'SlimCut', 'laiza.*(combo|瘦身)', 15, 'KOL promotion Laiza：Slimcut；不按價錢或 KOL 名單獨分類。'),
  extra('Skin Light', 'report-skin-facelift', 'Facelift／Face Pilates', 'face[ ]?lift|face[ ]?pilates'),
];

export function reportingRulesFromRows(rows) {
  return rows.slice(1).map((r, i) => ({ account: r[1], category: r[6], pattern: r[9], priority: Number(r[10] || 1000), row: i + 2, enabled: r[0] === true || r[0] === 'TRUE' }))
    .filter(r => r.enabled && r.account && r.category && r.pattern)
    .sort((a, b) => a.priority - b.priority || a.row - b.row);
}
export function classifyReportingTreatment(account, treatment, rules) {
  return rules.find(r => r.account === account && new RegExp(r.pattern, 'i').test(String(treatment)))?.category || UNCLASSIFIED_TREATMENT;
}
export function treatmentCategoryMapFormula(limit = 30000) {
  return `=LET(headers,lead!A1:Y1,raw,lead!A2:Y${limit},clean,LAMBDA(v,ARRAYFORMULA(TRIM(REGEXREPLACE(SUBSTITUTE(v&"",CHAR(160)," "),"\\s+"," ")))),field,LAMBDA(h,INDEX(raw,,MATCH(h,headers,0))),accountRaw,clean(field("Account")),accountKey,ARRAYFORMULA(LOWER(REGEXREPLACE(accountRaw,"[-_]+"," "))),a,ARRAYFORMULA(SWITCH(accountKey,"alyssa main","Alyssa Main","alyssa medical","Alyssa Medical","alyssa aesthetics","Alyssa Aesthetics","gos","GOS Beauty","gos beauty","GOS Beauty","ineffable","Ineffable","ineffable beauty","Ineffable","skin light","Skin Light","skinlight","Skin Light","skin light beauty","Skin Light",accountRaw)),b,clean(field("品牌")),item,clean(field("療程項目")),offer,clean(field("療程 / 優惠")),t,ARRAYFORMULA(LEFT(IF(item<>"",item,IF(offer<>"",offer,"未分類療程")),160)),dims,VSTACK(IFNA(FILTER(HSTACK(a,b,t),a<>""),HSTACK("","","")),'_funnel_metrics'!B2:D${limit},'_dashboard_book_dimensions'!B2:D${limit},'_arrival_pending_metrics'!B2:D${limit}),uniqueDims,UNIQUE(FILTER(dims,INDEX(dims,,1)<>"")),rules,SORT(FILTER(HSTACK('療程項目'!B2:B1004,'療程項目'!G2:G1004,'療程項目'!J2:J1004,'療程項目'!K2:K1004,ROW('療程項目'!A2:A1004)),'療程項目'!A2:A1004=TRUE,'療程項目'!B2:B1004<>"",'療程項目'!G2:G1004<>"",'療程項目'!J2:J1004<>""),4,TRUE,5,TRUE),categories,MAP(INDEX(uniqueDims,,1),INDEX(uniqueDims,,3),LAMBDA(account,text,IFNA(INDEX(FILTER(INDEX(rules,,2),EXACT(INDEX(rules,,1),account),ARRAYFORMULA(REGEXMATCH(text,"(?i)"&INDEX(rules,,3)))),1),"未分類療程"))),key,ARRAYFORMULA(INDEX(uniqueDims,,1)&CHAR(29)&INDEX(uniqueDims,,2)&CHAR(29)&INDEX(uniqueDims,,3)),HSTACK(key,uniqueDims,categories))`;
}
export function categoryVectorFormula(sheet, limit = 30000) {
  return `=ARRAYFORMULA(IF('${sheet}'!A2:A${limit}="","",VLOOKUP('${sheet}'!B2:B${limit}&CHAR(29)&'${sheet}'!C2:C${limit}&CHAR(29)&'${sheet}'!D2:D${limit},'${CATEGORY_MAP_SHEET}'!A2:E30000,5,FALSE)))`;
}
export function groupedTreatmentPerformanceFormula(current) {
  for (const token of ["'_funnel_metrics'!A2:H30000", "'_dashboard_book_dimensions'!A2:E30000", 't,INDEX(m,,4)', 'bt,INDEX(bm,,4)'])
    if (!current.includes(token)) throw new Error(`Treatment summary schema changed: ${token}`);
  return current.replace("'_funnel_metrics'!A2:H30000", "'_funnel_metrics'!A2:M30000")
    .replace("'_dashboard_book_dimensions'!A2:E30000", "'_dashboard_book_dimensions'!A2:F30000")
    .replace('t,INDEX(m,,4)', 't,INDEX(m,,13)').replace('bt,INDEX(bm,,4)', 'bt,INDEX(bm,,6)');
}
export function categoryFilterFormula(current) {
  return current.replaceAll("'_funnel_metrics'!$D$2:$D$30000", "'_funnel_metrics'!$M$2:$M$30000")
    .replaceAll("'_dashboard_book_dimensions'!$D$2:$D$30000", "'_dashboard_book_dimensions'!$F$2:$F$30000")
    .replaceAll("'_arrival_pending_metrics'!$D$2:$D$30000", "'_arrival_pending_metrics'!$H$2:$H$30000");
}
export function categoryExceptionFormula(current) {
  const original = 'treatment,ARRAYFORMULA(LEFT(IF(item<>"",item,IF(offer<>"",offer,"未分類療程")),160)),owner,';
  if (!current.includes(original)) throw new Error('Current exception dimensions changed');
  return current.replace(original, `treatmentRaw,ARRAYFORMULA(LEFT(IF(item<>"",item,IF(offer<>"",offer,"未分類療程")),160)),treatment,ARRAYFORMULA(VLOOKUP(accountOut&CHAR(29)&clean(cf("品牌"))&CHAR(29)&treatmentRaw,'${CATEGORY_MAP_SHEET}'!A2:E30000,5,FALSE)),owner,`);
}
