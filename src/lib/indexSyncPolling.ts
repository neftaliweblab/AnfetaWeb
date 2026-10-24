/** Allow the 180-second server lease to finish, with bounded, spaced checks. */
export const INDEX_POLL_BUDGET_MS=240000;
export function indexSyncPolling(data:any,elapsed:number){
 if(!data?.cacheMeta?.syncing)return {delay:null,status:data};
 if(elapsed<INDEX_POLL_BUDGET_MS)return {delay:elapsed<60000?15000:30000,status:data};
 return {delay:null,status:{...data,warning:data.warning||data.cacheMeta.lastError||'No se confirmó la actualización del catálogo tras 4 minutos. Se pausaron las comprobaciones automáticas; los resultados recibidos se conservan. Usa Refrescar para volver a consultar.',cacheMeta:{...data.cacheMeta,pollingPaused:true}}};
}
