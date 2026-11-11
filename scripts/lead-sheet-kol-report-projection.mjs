/** Date-independent, evaluated source for the existing KOL成效 calculation.
 * Customer identifiers stay in Sheets. Only a local ordinal for inquiry
 * deduplication leaves the source, and it never enters a report snapshot.
 */
export const KOL_REPORT_PROJECTION_TITLE = "_report_kol_events";
export const KOL_REPORT_EVENT_HEADERS = ["Account", "KOL", "療程", "優惠名稱", "Metric Date", "Metric Kind", "Metric Count", "Revenue", "Inquiry Key", "Source Order"];

export function kolReportProjectionFormula() {
  return `=IFNA(LET(
clean,LAMBDA(v,ARRAYFORMULA(TRIM(REGEXREPLACE(SUBSTITUTE(v&"",CHAR(160)," "),"\\s+"," ")))),
norm,LAMBDA(v,ARRAYFORMULA(IF(v="",0,IFERROR(IF(ISNUMBER(v),INT(v),DATEVALUE(LEFT(v&"",10))),0)))),
service,LAMBDA(t,o,ARRAYFORMULA(IF(REGEXMATCH(o&"","(?i)\\bKiu\\b.*1010[ ]*瘦面"),"瘦面",IF(REGEXMATCH(o&"","(?i)\\bKiu\\b.*瘦鼻翼"),"瘦鼻翼",IF((t<>"")*(t<>"未分類療程"),t,IF(REGEXMATCH(o&"","消脂"),"消脂（技術待確認）",IF(REGEXMATCH(o&"","[袪祛去]皺"),"袪皺（技術待確認）","待確認"))))))),
event,LAMBDA(segment,person,treatment,offer,day,kind,amount,revenue,inquiry,source,HSTACK(segment,person,service(treatment,offer),offer,day,ARRAYFORMULA(IF(day<>"",kind,kind)),ARRAYFORMULA(day*0+amount),ARRAYFORMULA(day*0+revenue),ARRAYFORMULA(day*0+inquiry),ARRAYFORMULA(day*0+source))),
metrics,FILTER('_funnel_metrics'!A2:M30000,'_funnel_metrics'!A2:A30000<>""),
segment,FILTER('_dashboard_main_accounts'!A2:A30000,'_funnel_metrics'!A2:A30000<>""),
person,FILTER('_dashboard_main_accounts'!F2:F30000,'_funnel_metrics'!A2:A30000<>""),
originalOffer,ARRAYFORMULA(IFNA(VLOOKUP(INDEX(metrics,,12),HSTACK(ROW(lead!L2:L29998),lead!L2:L29998),2,FALSE),INDEX(metrics,,4))),
offer,clean(ARRAYFORMULA(IF(originalOffer="",INDEX(metrics,,4),originalOffer))),
book,FILTER('_dashboard_book_dimensions'!A2:F30000,'_dashboard_book_dimensions'!A2:A30000<>""),
bookSegment,FILTER('_dashboard_main_accounts'!B2:B30000,'_dashboard_book_dimensions'!A2:A30000<>""),
bookPerson,ARRAYFORMULA(IFNA(VLOOKUP(INDEX(book,,1),HSTACK('_funnel_metrics'!A2:A30000,'_dashboard_main_accounts'!F2:F30000),2,FALSE),"未識別KOL")),
queryDay,norm(lead!B2:B29998),
queries,IFNA(FILTER(HSTACK(ROW(lead!A2:A29998),queryDay,clean(lead!L2:L29998),clean(lead!J2:J29998)),clean(lead!U2:U29998)="Alyssa Main",queryDay>0),HSTACK(0,0,"","")),
queryPhone,ARRAYFORMULA(REGEXREPLACE(INDEX(queries,,4)&"","[^0-9]","")),
queryKey,ARRAYFORMULA(IF(LEN(queryPhone)>=8,"p:"&RIGHT(queryPhone,8),"r:"&INDEX(queries,,1))),
queryOrdinal,ARRAYFORMULA(MATCH(queryKey,UNIQUE(queryKey),0)),
queryLookup,ARRAYFORMULA("Alyssa Main"&CHAR(29)&INDEX(queries,,3)),
querySegment,ARRAYFORMULA(IFNA(VLOOKUP(queryLookup,'_dashboard_kol_map'!A2:E2000,5,FALSE),"Alyssa Main Organic")),
queryPerson,ARRAYFORMULA(IFNA(VLOOKUP(queryLookup,'_dashboard_kol_map'!A2:E2000,4,FALSE),"未識別KOL")),
queryTreatment,ARRAYFORMULA(IFNA(VLOOKUP(queryLookup,HSTACK('_dashboard_treatment_map'!B2:B5000&CHAR(29)&'_dashboard_treatment_map'!D2:D5000,'_dashboard_treatment_map'!E2:E5000),2,FALSE),"未分類療程")),
revenue,IFNA(FILTER('_revenue_facts'!A2:J50000,'_revenue_facts'!A2:A50000<>""),MAKEARRAY(1,10,LAMBDA(row,col,0))),
revenueSegment,IFNA(FILTER('_dashboard_main_accounts'!E2:E50000,'_revenue_facts'!A2:A50000<>""),""),
revenuePerson,IFNA(FILTER('_dashboard_main_accounts'!I2:I50000,'_revenue_facts'!A2:A50000<>""),""),
revenueOffer,IFNA(LET(raw,'到店紀錄'!A8:AH,headers,'到店紀錄'!A7:AH7,field,LAMBDA(h,INDEX(raw,,MATCH(h,headers,0))),account,clean(field("Account")),outcome,ARRAYFORMULA(LOWER(clean(field("結果")))),day,norm(field("到店日期")),eligible,ARRAYFORMULA(REGEXMATCH(outcome,"^(已到店|已完成|show|show up)$")*(account<>"")*(day>=36526)*(day<=73415)),FILTER(clean(field("療程")),eligible)),ARRAYFORMULA(INDEX(revenue,,3)&"")),
data,VSTACK(
event(segment,person,INDEX(metrics,,13),offer,norm(INDEX(metrics,,5)),"lead",1,0,0,0),
event(segment,person,INDEX(metrics,,13),offer,norm(INDEX(metrics,,7)),"show",1,0,0,0),
event(segment,person,INDEX(metrics,,13),offer,norm(INDEX(metrics,,8)),"no_show",1,0,0,0),
event(bookSegment,bookPerson,INDEX(book,,6),clean(INDEX(book,,4)),norm(INDEX(book,,5)),"book",1,0,0,0),
event(querySegment,queryPerson,queryTreatment,INDEX(queries,,3),INDEX(queries,,2),"inquiry",1,0,queryOrdinal,INDEX(queries,,1)),
event(revenueSegment,revenuePerson,INDEX(revenue,,3),revenueOffer,norm(INDEX(revenue,,4)),"revenue",0,INDEX(revenue,,7),0,0)),
picked,FILTER(data,ARRAYFORMULA(REGEXMATCH(INDEX(data,,1),"^Alyssa Main( Medical| Organic)?$")),INDEX(data,,5)>0,ARRAYFORMULA((INDEX(data,,6)<>"revenue")+(ABS(INDEX(data,,8))>0))),
QUERY(picked,"select Col1,Col2,Col3,Col4,Col5,Col6,sum(Col7),sum(Col8),Col9,Col10 group by Col1,Col2,Col3,Col4,Col5,Col6,Col9,Col10 label Col1 '',Col2 '',Col3 '',Col4 '',Col5 '',Col6 '',sum(Col7) '',sum(Col8) '',Col9 '',Col10 ''",0)),"")`.replace(/\n/g, "");
}
