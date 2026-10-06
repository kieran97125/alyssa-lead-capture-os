function omniUpdateEditedAccountRows_(e,sheet,account,c,firstRow,lastRow,firstCol,lastCol) {
  const values=sheet.getRange(firstRow,1,lastRow-firstRow+1,leadDataWidth_(c)).getValues();
  const offerEdited=c.OFFER>=firstCol&&c.OFFER<=lastCol;
  const rules=offerEdited?getTreatmentRules_():null;
  let shouldResort=c.CREATED_AT>=firstCol&&c.CREATED_AT<=lastCol;
  values.forEach((row,index)=>{
    const number=firstRow+index;
    if(clean_(row[c.ACCOUNT-1])!==account){sheet.getRange(number,c.ACCOUNT).setValue(account);row[c.ACCOUNT-1]=account;}
    const defaultBrand=DEFAULT_BRAND_BY_ACCOUNT[account]||'';
    if(defaultBrand&&!clean_(row[c.BRAND-1])){sheet.getRange(number,c.BRAND).setValue(defaultBrand);row[c.BRAND-1]=defaultBrand;}
    if(!row[c.CREATED_AT-1]&&row.some((v,i)=>![c.ACCOUNT,c.LAST_UPDATED,c.CREATED_AT].includes(i+1)&&Boolean(clean_(v)))) {
      const created=today_();sheet.getRange(number,c.CREATED_AT).setValue(created).setNumberFormat('yyyy-mm-dd');
      if(!row[c.LAST_UPDATED-1])sheet.getRange(number,c.LAST_UPDATED).setValue(created).setNumberFormat('yyyy-mm-dd');
    }
    if(offerEdited)syncTreatmentForRow_(sheet,number,account,c,rules,row);
    if(c.STATUS>=firstCol&&c.STATUS<=lastCol) {
      const before=firstRow===lastRow&&e.range.getNumColumns()===1?clean_(e.oldValue):'';
      const after=clean_(row[c.STATUS-1]);
      if(after&&normalizeStatus_(before)!==normalizeStatus_(after)) {
        sheet.getRange(number,c.LAST_UPDATED).setValue(today_()).setNumberFormat('yyyy-mm-dd');shouldResort=true;
      }
    }
  });
  return shouldResort;
}

function syncTreatmentForRow_(sheet, row, account, columns, rules, cachedValues) {
  const offer = clean_(cachedValues ? cachedValues[columns.OFFER-1] : sheet.getRange(row, columns.OFFER).getDisplayValue());
  if (!offer) return;
  const text = [
    offer,
    clean_(cachedValues ? cachedValues[columns.TREATMENT-1] : sheet.getRange(row, columns.TREATMENT).getDisplayValue()),
    clean_(cachedValues ? cachedValues[columns.CAMPAIGN-1] : sheet.getRange(row, columns.CAMPAIGN).getDisplayValue()),
  ].filter(Boolean).join(' ').toLowerCase();

  const rule = (rules || getTreatmentRules_()).find(item =>
    item.enabled &&
    item.account === account &&
    item.keywords.some(keyword => text.includes(keyword.toLowerCase()))
  );
  if (!rule) return;

  const treatmentCell = sheet.getRange(row, columns.TREATMENT);
  if (!clean_(cachedValues ? cachedValues[columns.TREATMENT-1] : treatmentCell.getDisplayValue())) treatmentCell.setValue(rule.output);

  const brandCell = sheet.getRange(row, columns.BRAND);
  if (rule.brand && clean_(cachedValues ? cachedValues[columns.BRAND-1] : brandCell.getDisplayValue()) !== rule.brand) {
    brandCell.setValue(rule.brand);
  }
}
