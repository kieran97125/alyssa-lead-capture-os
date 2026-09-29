// Native Sheets projection of lead-sheet-column-dates-v1.
// Main KPIs use B / A / N / L; the event ledger is audit-only.
export const METRIC_CONTRACT_VERSION = "lead-sheet-column-dates-v1";
export const FACT_SHEET = "_funnel_metrics";
export const FACT_HEADERS = ["Identity", "Account", "Brand", "Treatment", "Lead Date · B", "Book Date · A", "Show Date · N", "No Show Date · L", "Missing Book Date", "Missing Show Date", "Missing No Show Date", "First Source Row"];

export function factsFormula(limit = 30000) {
  return `=LET(
src,FILTER(lead!A2:Y${limit},lead!U2:U${limit}<>""),
sourceRow,FILTER(ROW(lead!U2:U${limit}),lead!U2:U${limit}<>""),
clean,LAMBDA(v,ARRAYFORMULA(TRIM(REGEXREPLACE(SUBSTITUTE(v&"",CHAR(160)," "),"\\s+"," ")))),
norm,LAMBDA(v,ARRAYFORMULA(IF(v="",0,IFERROR(IF(ISNUMBER(v),INT(v),DATEVALUE(LEFT(v&"",10))),0)))),
valid,LAMBDA(v,ARRAYFORMULA(IF((v>=36526)*(v<=73415),v,0))),
accountRaw,clean(INDEX(src,,21)),
accountKey,ARRAYFORMULA(LOWER(REGEXREPLACE(accountRaw,"[-_]+"," "))),
account,ARRAYFORMULA(SWITCH(accountKey,"alyssa main","Alyssa Main","alyssa medical","Alyssa Medical","alyssa aesthetics","Alyssa Aesthetics","gos","GOS Beauty","gos beauty","GOS Beauty","ineffable","Ineffable","ineffable beauty","Ineffable","skin light","Skin Light","skinlight","Skin Light","skin light beauty","Skin Light",accountRaw)),
phone,ARRAYFORMULA(REGEXREPLACE(INDEX(src,,8)&"","[^0-9]","")),
identity,ARRAYFORMULA(account&"|"&IF(LEN(phone)>=8,"p:"&RIGHT(phone,8),"r:"&sourceRow)),
createdRaw,INDEX(src,,2),
created,valid(norm(createdRaw)),
createdNumericSeconds,ARRAYFORMULA(IFERROR(INT((createdRaw-INT(createdRaw))*86400+0.00001),0)),
createdTime,ARRAYFORMULA(IF(ISNUMBER(createdRaw),"",IFERROR(REGEXEXTRACT(clean(createdRaw),"(?:T|\\s)(\\d{1,2}:\\d{2}(?::\\d{2})?)"),""))),
createdSeconds,ARRAYFORMULA(IF(created=0,86399,IF(ISNUMBER(createdRaw),IF(createdNumericSeconds>86399,86399,createdNumericSeconds),IFERROR(VALUE(REGEXEXTRACT(createdTime,"^(\\d{1,2}):")),0)*3600+IFERROR(VALUE(REGEXEXTRACT(createdTime,"^\\d{1,2}:(\\d{2})")),0)*60+IFERROR(VALUE(REGEXEXTRACT(createdTime,"^\\d{1,2}:\\d{2}:(\\d{2})$")),0)))),
updated,valid(norm(INDEX(src,,1))),
confirmed,valid(norm(INDEX(src,,14))),
appointment,valid(norm(INDEX(src,,12))),
primary,ARRAYFORMULA(LOWER(REGEXREPLACE(clean(INDEX(src,,3)),"[\\s_-]+"," "))),
legacy,ARRAYFORMULA(LOWER(REGEXREPLACE(clean(INDEX(src,,19)&" "&INDEX(src,,20)),"[\\s_-]+"," "))),
status,ARRAYFORMULA(IF(primary<>"",IF(REGEXMATCH(primary,"^(已預約|booked|confirmed|rescheduled|requested)$"),"booked",IF(REGEXMATCH(primary,"^(已到店|已完成|完成療程|show|show up|completed)$"),"show",IF(REGEXMATCH(primary,"^(no show|noshow|未到店)$"),"no_show","lead"))),IF(REGEXMATCH(legacy,"no show|noshow|未到店"),"no_show",IF(REGEXMATCH(legacy,"已到店|已完成|完成療程|show up|completed|^show$"),"show",IF(REGEXMATCH(legacy,"已預約|booked|confirmed|rescheduled|requested"),"booked","lead"))))),
brand,ARRAYFORMULA(LEFT(clean(INDEX(src,,4)),180)),
item,clean(INDEX(src,,11)),
offer,clean(INDEX(src,,10)),
treatment,ARRAYFORMULA(LEFT(IF(item<>"",item,IF(offer<>"",offer,"未分類療程")),160)),
first,SORTN(SORT(HSTACK(identity,ARRAYFORMULA(IF(created>0,created,99999)),account,brand,treatment,sourceRow,createdSeconds),1,TRUE,2,TRUE,7,TRUE,6,TRUE),9^9,2,1,TRUE),
metricRows,HSTACK(identity,ARRAYFORMULA(IF((status<>"lead")*(updated>0),updated,99999)),ARRAYFORMULA(IF((status="show")*(confirmed>0),confirmed,99999)),ARRAYFORMULA(IF((status="no_show")*(appointment>0),appointment,99999)),ARRAYFORMULA(N((status<>"lead")*(updated=0))),ARRAYFORMULA(N((status="show")*(confirmed=0))),ARRAYFORMULA(N((status="no_show")*(appointment=0)))),
grouped,QUERY(metricRows,"select Col1,min(Col2),min(Col3),min(Col4),max(Col5),max(Col6),max(Col7) group by Col1 order by Col1 label Col1 '',min(Col2) '',min(Col3) '',min(Col4) '',max(Col5) '',max(Col6) '',max(Col7) ''",0),
metrics,ARRAYFORMULA(VLOOKUP(INDEX(first,,1),grouped,{2,3,4,5,6,7},TRUE)),
HSTACK(INDEX(first,,1),CHOOSECOLS(first,3,4,5),ARRAYFORMULA(IF(INDEX(first,,2)=99999,"",INDEX(first,,2))),ARRAYFORMULA(IF(CHOOSECOLS(metrics,1,2,3)=99999,"",CHOOSECOLS(metrics,1,2,3))),ARRAYFORMULA(IF(CHOOSECOLS(metrics,1,2,3)=99999,CHOOSECOLS(metrics,4,5,6),0)),INDEX(first,,6)))`.replaceAll("\n", "");
}

const fact = (column) => `'${FACT_SHEET}'!$${column}$2:$${column}$30000`;
export function countFormula(column, accountCell = "$E$4", treatmentCell = "$G$4") {
  const dates = fact(column), account = fact("B"), treatment = fact("D");
  return `=IFERROR(ROWS(FILTER(${dates},${dates}>=$A$4,${dates}<($C$4+1),IF(${accountCell}="All",${account}<>"",EXACT(${account},${accountCell})),IF(${treatmentCell}="All",${account}<>"",EXACT(${treatment},${treatmentCell})))),0)`;
}

export function pendingFormula(column) {
  return `=SUMPRODUCT(${fact(column)},N((($E$4="All")+EXACT(${fact("B")},$E$4))>0),N((($G$4="All")+EXACT(${fact("D")},$G$4))>0))`;
}

export function treatmentFormula() {
  const [account, treatment, lead, book, show, noShow] = ["B", "D", "E", "F", "G", "H"].map(fact);
  return `=IFERROR(LET(s,$A$4,e,$C$4+1,a,${account},t,${treatment},ld,${lead},bd,${book},sd,${show},nd,${noShow},lc,ARRAYFORMULA(N((ld>=s)*(ld<e))),bc,ARRAYFORMULA(N((bd>=s)*(bd<e))),sc,ARRAYFORMULA(N((sd>=s)*(sd<e))),nc,ARRAYFORMULA(N((nd>=s)*(nd<e))),data,FILTER(HSTACK(a,t,lc,bc,sc,nc),a<>"",(lc+bc+sc+nc)>0,IF($E$4="All",a<>"",EXACT(a,$E$4)),IF($G$4="All",a<>"",EXACT(t,$G$4))),summary,QUERY(data,"select Col1,Col2,sum(Col3),sum(Col4),sum(Col5),sum(Col6) group by Col1,Col2 order by sum(Col3) desc,Col1,Col2 label Col1 '',Col2 '',sum(Col3) '',sum(Col4) '',sum(Col5) '',sum(Col6) ''",0),HSTACK(summary,MAP(INDEX(summary,,3),INDEX(summary,,4),LAMBDA(l,b,IF(l=0,"—",b/l))),MAP(INDEX(summary,,4),INDEX(summary,,5),LAMBDA(b,sh,IF(b=0,"—",sh/b))))),"")`;
}
