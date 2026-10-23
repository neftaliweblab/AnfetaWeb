import type {NotionCalendarActivity} from '@/types/anfeta';
import {canEditActivity} from '@/services/activityPermissions';
import {reviewPreflight} from '@/lib/reviewPreflight';
import {offlineAwareFetch} from '@/services/offlineQueue';

export type AgendaUpdate=Partial<NotionCalendarActivity>&{
  handoff?:boolean;reviewer?:string;reviewAction?:'return'|'reassign';note?:string;
  leaveVisualCopy?:boolean;titleDescription?:string;expectedTitle?:string;expectedStart?:string;expectedEnd?:string;allowOverlap?:boolean;
};

export async function saveAgendaActivity(original:NotionCalendarActivity,updates:AgendaUpdate,currentUser:string,onFresh:(fresh:Partial<NotionCalendarActivity>)=>void) {
  if(!canEditActivity(currentUser,original)||original.isHandoffMirror)throw Error('No puedes modificar esta actividad o está bloqueada.');
  let expectedReviewUpdatedAt=original.reviewFlow?.UpdatedAt||null;
  if(updates.reviewer||updates.reviewAction||updates.handoff){
    const response=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({action:'activity-edit-snapshot',payload:{pageId:original.pageId}})});
    const data=await response.json();
    if(!response.ok||!data.activity)throw Error(data.error||'No se pudo verificar el estado actual.');
    const preflight=reviewPreflight(original,data.activity);
    if(preflight.changed){onFresh(data.activity);throw Error('La actividad cambió. Se actualizaron sus datos; revisa el cambio y confirma de nuevo.');}
    expectedReviewUpdatedAt=preflight.expectedReviewUpdatedAt;
  }
  const response=await offlineAwareFetch('/api/data',{
    action:updates.titleDescription!==undefined?'update-activity-details':updates.start?'update-activity-schedule':updates.reviewer||updates.person?'update-activity-assignee':'update-activity-status',
    payload:{id:original.pageId,currentUser,expectedTitle:original.title,expectedStart:original.start,expectedEnd:original.end,expectedStatus:original.status,expectedPerson:original.person,...((updates.reviewer||updates.reviewAction||updates.handoff)?{expectedReviewUpdatedAt}:{}),...updates},
  });
  const data=await response.json();
  if(data.queued)throw Error('Cambio guardado localmente. Se confirmará al recuperar conexión; se conservan los datos del servidor.');
  if(!response.ok||!data.success||!data.activity){const err:any=new Error(data.error||'Notion no confirmó el guardado.');err.code=data.code;err.conflictTitle=data.conflictTitle;err.suggestedSlot=data.suggestedSlot;throw err;}
  return data as {activity:NotionCalendarActivity;handoffCopies?:NotionCalendarActivity[];warning?:string};
}
