function oa2Record_(row,number,sheet,c,meta,cachedAccount) {
  const account=cachedAccount===undefined?sheet.getName():cachedAccount,phone=last8_(row[c.PHONE-1]);
  const meaningful=Object.keys(c).some(k=>!['ACCOUNT','BRAND','CREATED_AT','LAST_UPDATED'].includes(k) && clean_(row[c[k]-1]));
  return {row:number,meaningful,account,phone,fullPhone:oa2Text_(row[c.PHONE-1]),customerKey:oa2CustomerKey_(row,c,account),name:clean_(row[c.NAME-1]),brand:clean_(row[c.BRAND-1]),treatment:clean_(row[c.TREATMENT-1]||row[c.OFFER-1]),branch:clean_(row[c.BRANCH-1]),createdAt:row[c.CREATED_AT-1],updatedAt:oa2Date_(row[c.LAST_UPDATED-1]),status:row[c.STATUS-1],date:row[c.APPOINTMENT_DATE-1],time:row[c.APPOINTMENT_TIME-1],email:clean_(row[c.EMAIL-1]).toLowerCase(),social:clean_(row[c.SOCIAL_USERNAME-1]).toLowerCase(),leadId:meta?oa2Text_(row[meta-1]):'',appointmentId:meta?oa2Text_(row[meta]):'',bookedAt:meta?row[meta+1]:'',outcome:meta?row[meta+2]:'',outcomeAt:meta?row[meta+3]:'',pendingSnapshot:meta?oa2Text_(row[meta+4]):''};
}

function oa2QueueLabel_(a,record) {const bound=record&&record.account===a.account&&record.leadId===a.leadId;const key=oa2Text_(a.customerKey),email=key.indexOf(a.account+'|e:')===0?key.slice(a.account.length+3):bound&&record.email,social=key.indexOf(a.account+'|i:')===0?key.slice(a.account.length+3):bound&&record.social;const fullPhone=bound?oa2Text_(record.fullPhone):'';return a.account+' · '+(fullPhone?'電話 '+fullPhone:email?'Email '+email:social?'IG/FB '+social:'識別待核對 '+a.leadId);}

/** Allocate stable IDs for non-booking edits too, under the existing document lock. */
function oa2EnsureEditedLeadIds_(sheet,c,firstRow,lastRow) {
  const meta=oa2Meta_(sheet,false),width=sheet.getLastColumn(),account=sheet.getName();
  const values=sheet.getRange(firstRow,1,lastRow-firstRow+1,width).getValues(),changes=[];
  values.forEach((row,i)=>{const r=oa2Record_(row,firstRow+i,sheet,c,meta,account);if(!r.meaningful||r.leadId)return;
    if(row.slice(meta,meta+5).some(v=>oa2Text_(v)))throw new Error('Source identity missing with existing appointment metadata; preserving for review.');
    changes.push({row:firstRow+i,expected:row,values:['lead_'+Utilities.getUuid()]});
  });
  oa2RowGroups_(changes).forEach(group=>{const current=sheet.getRange(group[0].row,1,group.length,width).getValues();group.forEach((x,i)=>{if(JSON.stringify(current[i])!==JSON.stringify(x.expected))throw new Error('Source row changed before identity allocation; preserving for retry.');});sheet.getRange(group[0].row,meta,group.length,1).setValues(group.map(x=>x.values));});
  return changes.length;
}

function omniArrivalV2AccountEdit_(e,firstRow,lastRow,firstCol,lastCol,cachedSheet,trace,documentLock) {
  if(!oa2Enabled_())return;
  const sheet=cachedSheet||e.range.getSheet(),c=getOmniColumns_(sheet),ss=e.source||oa2Spreadsheet_();
  omniEditStage_(trace,'source_identity_registration',()=>oa2EnsureEditedLeadIds_(sheet,c,firstRow,lastRow));
  const bookingChanged=[c.STATUS,c.APPOINTMENT_DATE,c.APPOINTMENT_TIME].some(col=>col>=firstCol&&col<=lastCol);
  let result;
  if(bookingChanged)result=oa2ProcessAccount_(ss,sheet,'scan',{firstRow,lastRow,firstCol,lastCol},false,trace);
  if((c.CS_OWNER&&c.CS_OWNER>=firstCol&&c.CS_OWNER<=lastCol)||(result&&result.newQueue>0)) {
    const csProjection=oa2TryRefreshQueueCs_(ss,{documentLock,accountNames:[sheet.getName()],includeHistory:false});
    return Object.assign({},result||{},{csProjection});
  }
  return result;
}
/** Called only after the outer edit handler holds the document lock. */

/** Plan only explicitly edited appointments; unrelated staff inputs remain untouched for their own edit or timer.
 * Keep full context/history/anchor replay and the unchanged commit journal. A duplicate binding for an edited
 * appointment anywhere in the queue remains an error. Do not narrow the queue by row before duplicate checks.
 */
