import type {CalendarSettings} from './notionCalendar';
import {readUserState,updateUserState} from './userState';
import {normalizePerson} from './identityNormalizer';
import {notionSourceKey} from './notionSnapshotCache';
import {sendPwaPush} from './pwaPush';

/** A daily close requires today's planned work, not unrelated completed history. */
export function assertDailyClosureReady(workDate:string,today:string,itemCount:number,summary:any){
 if(workDate!==today)throw Error('Solo puedes confirmar el cierre del día actual.');
 if(!itemCount || (summary.hasDailyPlan ? !summary.completedForDay : summary.done===0))throw Error('Completa los pasos de hoy antes de confirmar el cierre.');
}

/** One durable supervisor notice per activity/day; repeated confirmations do not resend. */
export async function confirmActivityDayNotice(settings:CalendarSettings,actor:string,live:any,day:string,summary:any):Promise<string|undefined>{
 const state=await readUserState(settings,'John'),receipts=state.values?.receipts||{};
 const records={...(receipts.activityDayCompletions||{})};
 const pageId=String(live.id||live.pageId||'').replace(/-/g,'').toLowerCase();
 if(!/^[a-f0-9]{32}$/.test(pageId))throw Error('No se pudo identificar la actividad para el aviso.');
 const id='activity-day:'+notionSourceKey(settings)+':'+pageId+':'+day;
 if(records[id])return;
 const person=normalizePerson(actor),stamp=new Date().toISOString();
 const entry={id,kind:'activity-day',date:day,pageId,updated:stamp,completedAt:stamp,authorName:person,recipientName:'John',person:live.person,activityTitle:live.title,activityUrl:live.url||'https://www.notion.so/'+pageId,actionLabel:'TERMINADO POR HOY',title:live.title,detail:`${person} confirmó el cierre diario · ${summary.hasDailyPlan ? summary.plannedDone : summary.done}/${summary.hasDailyPlan ? summary.plannedTotal : summary.total} pasos de hoy`};
 records[id]=entry;
 await updateUserState(settings,'John',{receipts:{...receipts,activityDayCompletions:Object.fromEntries(Object.entries(records).slice(-300))}},state.revision);
 try{const delivery=await sendPwaPush(settings,'John',{title:'ANFETA · Terminado por hoy',body:person+' confirmó: '+live.title,tag:id});if(delivery?.failed)return 'El aviso está guardado para John; falló la notificación en algún dispositivo.';}catch{return 'El aviso está guardado para John; no se confirmó la notificación del dispositivo.';}
}
