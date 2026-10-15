import {randomUUID} from 'node:crypto';
import {supabaseAdmin,supabaseConfigured} from './supabaseServer';
import {notionSourceKey} from './notionSnapshotCache';
import type {CalendarSettings} from './notionCalendar';
export async function prepareHandoff(settings:CalendarSettings,input:{pageId:string;from:string;to:string;actor:string;note:string;copy:boolean;snapshot:any}){
  if(!supabaseConfigured())throw Error('Configura Supabase y aplica la migración activity_handoffs para conservar el historial de reasignación.');
  const id=randomUUID();
  const {error}=await supabaseAdmin().from('activity_handoffs').insert({id,source_key:notionSourceKey(settings),page_id:input.pageId,from_person:input.from,to_person:input.to,actor:input.actor,note:input.note,leave_copy:input.copy,snapshot:input.snapshot});
  if(error)throw Error('No se pudo preparar el historial. Aplica la migración 202610150018_activity_handoffs y vuelve a intentar; no se cambió el responsable.');
  return id;
}
export async function confirmHandoff(settings:CalendarSettings,id:string){const {error}=await supabaseAdmin().from('activity_handoffs').update({confirmed:true}).eq('source_key',notionSourceKey(settings)).eq('id',id);if(error)throw Error('No se pudo confirmar la copia histórica.');}
export async function handoffMirrors(settings:CalendarSettings,first:string,end:string){
 if(!supabaseConfigured())return [];
 const {data,error}=await supabaseAdmin().from('activity_handoffs').select('id,page_id,from_person,to_person,note,snapshot').eq('source_key',notionSourceKey(settings)).eq('confirmed',true).eq('leave_copy',true).gte('snapshot->>start',first).lt('snapshot->>start',end).order('created_at',{ascending:true}).limit(1000);
 if(error){if(error.code==='42P01'||error.code==='PGRST205')return [];throw Error('No se pudo cargar el historial de reasignación.');}
 return (data||[]).map((h:any)=>({...h.snapshot,pageId:'handoff-mirror-'+h.id,originalPageId:h.page_id,isReviewMirror:true,isLocked:true,isHandoffMirror:true,title:'[TRANSFERIDA A '+h.to_person+'] '+h.snapshot.title,shortTitle:h.snapshot.title,person:h.from_person,handoffNote:h.note}));
}
