export const INDEX_REFRESH_MS=10*60*1000;
export const CALENDAR_REFRESH_MS=2*60*1000;
export function snapshotNeedsRefresh(row:{valid?:boolean;updated_at?:string|null},key:string,force=false,now=Date.now()){const age=now-Date.parse(row.updated_at||'');return force||!row.valid||!Number.isFinite(age)||age>(key==='search-index'?INDEX_REFRESH_MS:CALENDAR_REFRESH_MS);}
