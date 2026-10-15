// Native financial projection. No customer contact fields or source writes.
export const REVENUE_HEADERS = ['Account','Brand','Treatment','Arrival Date','Trial Revenue','Order Revenue','Revenue','Order Visits','Attended Visits','Monetary Entries'];
export const DASHBOARD_REVENUE_HEADERS = ['Account／品牌／療程','試做收入 HK$','開單收入 HK$','Revenue HK$','開單','到店','開單率','廣告費 HK$','ROAS','廣告 ROI'];
const flat = text => text.replaceAll('\n','');
export function arrivalRevenueFormula() {
 return flat(`=IFNA(LET(
raw,'到店紀錄'!A8:AH,headers,'到店紀錄'!A7:AH7,
field,LAMBDA(h,INDEX(raw,,MATCH(h,headers,0))),
clean,LAMBDA(v,ARRAYFORMULA(TRIM(REGEXREPLACE(SUBSTITUTE(v&"",CHAR(160)," "),"\\s+"," ")))),
account,clean(field("Account")),brandRaw,clean(field("品牌")),
brand,ARRAYFORMULA(IF(account="Alyssa Aesthetics",IF(REGEXMATCH(LOWER(brandRaw),"^(aesthetics medical|aesthetics)$"),"Aesthetics Medical",IF(REGEXMATCH(LOWER(brandRaw),"^(alyssa|alyssa aesthetics)$"),"Alyssa Aesthetics",brandRaw)),brandRaw)),
treatmentRaw,ARRAYFORMULA(LEFT(clean(field("療程")),160)),
category,ARRAYFORMULA(IFNA(VLOOKUP(account&CHAR(29)&treatmentRaw,HSTACK('_dashboard_treatment_map'!B2:B5000&CHAR(29)&'_dashboard_treatment_map'!D2:D5000,'_dashboard_treatment_map'!E2:E5000),2,FALSE),"未分類療程")),
outcome,ARRAYFORMULA(LOWER(clean(field("結果")))),arrival,field("到店日期"),
day,ARRAYFORMULA(IF(arrival="",0,IF(ISNUMBER(arrival),INT(arrival),IFERROR(DATEVALUE(LEFT(arrival&"",10)),0)))),
id,clean(field("Appointment ID")),eligible,ARRAYFORMULA(REGEXMATCH(outcome,"^(已到店|已完成|show|show up)$")*(account<>"")*(day>=36526)*(day<=73415)),
ids,FILTER(id,eligible),valid,AND(COUNTBLANK(ids)=0,COUNTUNIQUE(ids)=ROWS(ids)),
money,LAMBDA(v,ARRAYFORMULA(IF(v="","",ROUND(VALUE(REGEXREPLACE(v&"","(?i)HK\\$|HKD|\\$|,","")),2)))),
trial,money(field("試做價")),orders,money(field("開單金額")),total,money(field("總金額")),
revenue,ARRAYFORMULA(IF(total="",N(trial)+N(orders),total)),
entered,ARRAYFORMULA(N(((trial<>"")+(orders<>"")+((total<>"")*(total<>0)))>0)),
data,FILTER(HSTACK(account,brand,category,day,ARRAYFORMULA(N(trial)),ARRAYFORMULA(N(orders)),revenue,ARRAYFORMULA(N(N(orders)>0)),ARRAYFORMULA(N(account<>"")),entered),eligible),
IF(valid,data,1/0)),"")`);
}
export function dashboardRevenueFormula() {
 const header = '{'+DASHBOARD_REVENUE_HEADERS.map(v=>'"'+v+'"').join(',')+'}';
 return flat(`=IFNA(LET(
raw,'_revenue_facts'!A2:J50000,
data,FILTER(raw,INDEX(raw,,1)<>"",INDEX(raw,,4)>=$A$4,INDEX(raw,,4)<$C$4+1,IF($E$4="All",INDEX(raw,,1)<>"",EXACT(INDEX(raw,,1),$E$4)),IF($G$4="All",INDEX(raw,,1)<>"",EXACT(INDEX(raw,,3),$G$4))),
IF(SUM(INDEX(data,,10))=0,"",LET(
base,QUERY(data,"select Col1,Col2,sum(Col5),sum(Col6),sum(Col7),sum(Col8),sum(Col9),sum(Col10) group by Col1,Col2 label Col1 '',Col2 '',sum(Col5) '',sum(Col6) '',sum(Col7) '',sum(Col8) '',sum(Col9) '',sum(Col10) ''",0),
summary,FILTER(base,INDEX(base,,8)>0),
spend,MAP(INDEX(summary,,1),INDEX(summary,,2),LAMBDA(acct,brand,IF($G$4<>"All","",LET(amount,SUMIFS('_revenue_spend'!D2:D50000,'_revenue_spend'!A2:A50000,">="&$A$4,'_revenue_spend'!A2:A50000,"<"&($C$4+1),'_revenue_spend'!B2:B50000,acct,'_revenue_spend'!C2:C50000,brand),IF(amount>0,amount,""))))),
summaryRows,HSTACK(ARRAYFORMULA(IF(INDEX(summary,,1)=INDEX(summary,,2),INDEX(summary,,1),INDEX(summary,,1)&"／"&INDEX(summary,,2))),CHOOSECOLS(summary,3,4,5,6,7),ARRAYFORMULA(INDEX(summary,,6)/INDEX(summary,,7)),spend,MAP(INDEX(summary,,5),spend,LAMBDA(rev,cost,IF(N(cost)>0,rev/cost,""))),MAP(INDEX(summary,,5),spend,LAMBDA(rev,cost,IF(N(cost)>0,(rev-cost)/cost,"")))),
baseTreatments,QUERY(data,"select Col1,Col2,Col3,sum(Col5),sum(Col6),sum(Col7),sum(Col8),sum(Col9),sum(Col10) group by Col1,Col2,Col3 label Col1 '',Col2 '',Col3 '',sum(Col5) '',sum(Col6) '',sum(Col7) '',sum(Col8) '',sum(Col9) '',sum(Col10) ''",0),
treatments,FILTER(baseTreatments,INDEX(baseTreatments,,9)>0),
treatmentRows,HSTACK(ARRAYFORMULA(IF(INDEX(treatments,,1)=INDEX(treatments,,2),INDEX(treatments,,1),INDEX(treatments,,1)&"／"&INDEX(treatments,,2))&"／"&INDEX(treatments,,3)),CHOOSECOLS(treatments,4,5,6,7,8),ARRAYFORMULA(INDEX(treatments,,7)/INDEX(treatments,,8)),MAKEARRAY(ROWS(treatments),3,LAMBDA(r,c,""))),
VSTACK(${header},summaryRows,MAKEARRAY(1,10,LAMBDA(r,c,"")),${header},treatmentRows)))),"")`);
}
