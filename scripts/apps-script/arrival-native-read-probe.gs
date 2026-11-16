/** Read-only measurement. Uses native display readers and never the Advanced Sheets adapter. */
function probeMissingBookedArrivalsNativeReadOnly20261116() {
  const started=Date.now(),timings={},ss=oa2Spreadsheet_();let phase='queue';
  try {
    const queue=oa3ManualPhase_(timings,'nativeQueueMs',()=>oa3ManualDisplayQueue_(ss.getSheetByName(OA2.ARRIVAL)));
    const snaps=OMNI_ACCOUNT_TABS.map((name,index)=>{
      phase='source_'+index;
      return oa3ManualPhase_(timings,'nativeSource'+index+'Ms',()=>oa3ManualDisplayAccount_(ss.getSheetByName(name),name));
    });
    phase='selection';
    const selection=oa3ManualPhase_(timings,'nativeSelectionMs',()=>oa3ManualPresenceSelection_(snaps,queue));
    const result={readOnly:true,completed:true,readEngine:'native',sourceCount:snaps.length,
      sourceRows:snaps.reduce((count,snap)=>count+snap.records.length,0),queueRows:queue.length,
      candidates:selection.items.length,missing:selection.items.filter(item=>item.kind==='missing').length,
      scheduleGaps:selection.items.filter(item=>item.kind==='schedule_gap').length,
      skipped:selection.skipped,timings,elapsedMs:Date.now()-started};
    console.log(JSON.stringify(Object.assign({handler:'native_missing_booked_read_probe'},result)));
    return result;
  } catch (error) {
    console.log(JSON.stringify({handler:'native_missing_booked_read_probe',readOnly:true,completed:false,
      readEngine:'native',failedPhase:phase,timings,elapsedMs:Date.now()-started}));
    throw new Error('Native read-only probe did not complete; see phase timings.');
  }
}
