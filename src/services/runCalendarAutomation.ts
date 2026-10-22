export async function runCalendarAutomation(currentUser:string,date:string,onProgress?:(report:any)=>void,automatic=false) {
  const excluded=new Set<string>();
  const total:any={generatedAt:new Date().toISOString(),reviewed:0,moved:0,failed:0,skippedCompleted:0,skippedReview:0,skippedLocked:0,skippedSuspended:0,movements:[],errors:[]};
  for(let batch=0;batch<100;batch++) {
    const res=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(115000),body:JSON.stringify({action:'calendar-automation-run',payload:{currentUser,date,automatic,excludedIds:[...excluded]}})});
    const data=await res.json();if(!res.ok)throw new Error(data.error || 'No se pudo preparar la jornada.');
    const report=data.report;total.ftfReset=(total.ftfReset||0)+(report.ftf?.reset||0);if(report.alreadyCompleted)total.alreadyCompleted=true;total.reviewed=Math.max(total.reviewed,report.reviewed);total.moved+=report.moved;total.failed+=report.failed;total.movements.push(...report.movements);total.errors.push(...(report.errors || []));
    const confirmed=new Set((report.movements||[]).map((move:any)=>move.activityId));for(const id of report.attemptedIds||[])if(!confirmed.has(id))excluded.add(id);
    for(const name of ['skippedCompleted','skippedReview','skippedLocked','skippedSuspended'])total[name]=Math.max(total[name],report[name] || 0);
    onProgress?.({...total});
    if(!report.remaining || (report.failed&&!(report.attemptedIds||[]).length)) return {...total,remaining:report.remaining || 0};
  }
  throw new Error('Se alcanzó el límite de lotes; revisa el reporte antes de continuar.');
}
