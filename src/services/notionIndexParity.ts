import {notionRequest} from './notionMutations';
import type {CalendarSettings} from './notionCalendar';
import { isExpiredResponsePage } from './reviewNotifications';
export const ANFETA_BASES=[['Revisiones','2eeabd7d-91b7-8193-a131-000b08cd54e2'],['Clientes','2f0abd7d-91b7-810b-b1b8-000b85005b68'],['Dominios','2f0abd7d-91b7-8133-82e8-000b57bceeda'],['Programas y proyectos','796abd7d-91b7-8271-9154-0749f7d58213'],['Cobrar y pagar','2eeabd7d-91b7-815f-b649-000bfdc93a2b'],['Correos Contraseñas','2f1abd7d-91b7-8136-8cc2-000ba807c666']];
export function completedReminder(row:any){return row.sourceName==='Revisiones'&&/^\s*(?:\[Revisiones\]\s*)?\d{4}-\d{2}-\d{2}[ T]\d{2}[:\-]\d{2}\s+(?:jjohn|kkarl|iisai|iisaia|eedua|aacal|aandr|eemma|bbria|ggena|nneft|__all__)\b[\s\S]*(?:^|\s)\[TERMINADO\](?:\s|$)/i.test(row.name||'');}
export function uniqueIndex(rows:any[]){const out=new Map<string,any>();for(const row of rows){if(completedReminder(row)||isExpiredResponsePage(row))continue;const id=String(row.externalId||row.id).replace(/-/g,'').toLowerCase();out.set(row.source+':'+id,row);}return [...out.values()];}
export async function queryAnfetaIndex(settings:CalendarSettings,since?:string){
 const controller=new AbortController(),deadline=AbortSignal.timeout(90000),signal=AbortSignal.any([controller.signal,deadline,...(settings.notionSignal?[settings.notionSignal]:[])]);
 const pages=new Map<string,any>();
 await Promise.all(ANFETA_BASES.map(async([name,defaultId])=>{
  const id=String(name==='Revisiones'?(process.env.NOTION_CALENDAR_DATA_SOURCE_ID||settings.notionDataSourceId||defaultId):defaultId).trim();const validId=/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(id);let cursor:string|undefined;const seen=new Set<string>();let batches=0;
  try{if(!validId)throw new Error('Configura un UUID de data source válido, sin URL ni credenciales.');do{
   signal.throwIfAborted();const data=await notionRequest({...settings,notionSignal:signal},'data_sources/'+id+'/query','POST',{page_size:100,sorts:[{timestamp:'last_edited_time',direction:'descending'}],...(since?{filter:{timestamp:'last_edited_time',last_edited_time:{on_or_after:new Date(Date.parse(since)-120000).toISOString()}}}:{}),...(cursor?{start_cursor:cursor}:{})});
   for(const page of data.results||[])if(!page.archived&&!page.in_trash){
     if(name==='Revisiones'){
       const rawTitle=(Object.values(page.properties||{}).find((p:any)=>p.type==='title') as any)?.title?.map((t:any)=>t.plain_text||t.text?.content||'').join('')||'';
       if(isExpiredResponsePage({name:rawTitle,serverModified:page.last_edited_time}))continue;
     }
     pages.set(page.id.replace(/-/g,'').toLowerCase(),{...page,_anfetaBase:name});
   }
   if(++batches>1000)throw new Error('Demasiadas páginas; no se publicó un índice incompleto.');
   if(data.has_more&&(!data.next_cursor||seen.has(data.next_cursor)))throw new Error('Paginación incompleta');
   cursor=data.has_more?data.next_cursor:undefined;if(cursor)seen.add(cursor);
  }while(cursor);}catch(error){controller.abort();const cause=deadline.aborted?'La sincronización superó 90 segundos; la copia anterior se conserva.':error instanceof Error?error.message:'No se pudo consultar';throw new Error(name+' (data source '+(validId?id:'ID inválido')+'): '+cause);}
 }));
 const list=[...pages.values()];(list as any).isComplete=true;return list;
}
