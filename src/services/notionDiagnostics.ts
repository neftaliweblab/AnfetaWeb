import {ANFETA_BASES} from './notionIndexParity';
import {notionRequest} from './notionMutations';
export async function diagnoseNotion(settings:any){
 const started=Date.now(),signal=AbortSignal.timeout(15000),live={...settings,notionSignal:signal,notionApiVersion:settings.notionApiVersion||'2026-03-11'};
 const message=(error:unknown)=>{const value=error instanceof Error?error.message:'No se pudo comprobar la conexión.';return settings.notionToken?value.split(settings.notionToken).join('[token oculto]'):value;};
 const report:any={tokenConfigured:!!settings.notionToken?.trim(),apiVersion:live.notionApiVersion,tokenValid:false,checks:[]};
 if(!report.tokenConfigured)return {...report,error:'No hay token de Notion configurado en esta petición ni en el servidor.',durationMs:Date.now()-started};
 try{const integration=await notionRequest(live,'users/me');report.tokenValid=true;report.integration=integration.name||'Conexión Notion';}catch(error){return {...report,error:message(error),durationMs:Date.now()-started};}
 for(const [name,defaultId] of ANFETA_BASES){const id=String(name==='Revisiones'?(process.env.NOTION_CALENDAR_DATA_SOURCE_ID||settings.notionDataSourceId||defaultId):defaultId).trim();const validId=/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(id);const at=Date.now();
  try{if(!validId)throw new Error('Formato de ID inválido: se necesita un data source ID.');const data=await notionRequest(live,'data_sources/'+id+'/query','POST',{page_size:1});report.checks.push({name,id,ok:true,hasRecords:!!data.results?.length,durationMs:Date.now()-at});}
  catch(error){report.checks.push({name,id:validId?id:'formato inválido',ok:false,error:signal.aborted?'El diagnóstico alcanzó 15 segundos; vuelve a comprobar esta base.':message(error),durationMs:Date.now()-at});}
 }
 return {...report,ok:report.checks.every((check:any)=>check.ok),durationMs:Date.now()-started};
}
