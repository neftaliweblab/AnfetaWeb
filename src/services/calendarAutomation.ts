import { queryCalendarPages, assignedPerson, calendarStatusField, readReviewFlow } from './notionCalendar';
import { mutateActivity } from './notionMutations';
import { canEditActivity } from './activityPermissions';
import { mexicoDate, mexicoMinutes } from './calendarPresentation';
import { workflowState } from './activityWorkflow';
import { normalizePerson } from './identityNormalizer';
import {calendarConflict,nearbyFreeCalendarSlots,type CalendarSlot} from './calendarConflicts';
const shift=(day:string,n:number)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const at=(day:string,m:number)=>day+'T'+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+':00-06:00';
export async function planDailyAutomation(settings:any,actor:string,today:string,now=new Date(),excluded:string[]=[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || today !== mexicoDate(now.toISOString())) throw new Error('El robot solo puede preparar la jornada de hoy.');
  if (mexicoMinutes(now.toISOString()) < 300) throw new Error('La corrida diaria se habilita a las 05:00.');
  const pages=await queryCalendarPages(settings,shift(today,-14),shift(today,1),true), movements:any[]=[];
  const occupied:CalendarSlot[]=pages.flatMap(page=>{const date:any=Object.entries(page.properties||{}).find(([n,p]:any)=>/^fecha por hacer$/i.test(n.trim())&&p.type==='date')?.[1];if(!date?.date?.start)return [];const start=date.date.start.length===10?date.date.start+'T08:00:00-06:00':date.date.start;return [{pageId:page.id,title:'Actividad existente',person:assignedPerson(page),start,end:date.date.end||new Date(Date.parse(start)+3600000).toISOString()}];});
  let skippedCompleted=0,skippedReview=0,skippedLocked=0,skippedSuspended=0;
  for (const page of pages) {
    if(excluded.includes(page.id))continue;
    const title=Object.values(page.properties || {}).filter((p:any)=>p.type==='title').flatMap((p:any)=>p.title || []).map((t:any)=>t.plain_text || t.text?.content || '').join('');
    const status=calendarStatusField(page)?.[1], state=workflowState(status?.[status.type]?.name || '',title);
    const activity={title,person:assignedPerson(page),isLocked:Object.entries(page.properties || {}).some(([n,p]:any)=>/lock|bloquead/i.test(n)&&p.checkbox)};
    if (!canEditActivity(actor,activity)) {skippedLocked++;continue;}
    if (state==='review') {skippedReview++;continue;}
    if (state==='completed'||/\bzREVISION\b/i.test(title)) {skippedCompleted++;continue;}
    if(/\b(?:FTF|ccale)\b/i.test(title)||Object.entries(page.properties||{}).some(([n,p]:any)=>/fij[oa]|fixed/i.test(n)&&p.checkbox)){skippedLocked++;continue;}
    if (!['pending','suspended'].includes(state)) continue;
    const date:any=Object.entries(page.properties || {}).find(([n,p]:any)=>/^fecha por hacer$/i.test(n.trim())&&p.type==='date')?.[1];
    if (!date?.date?.start) continue;
    const oldStart=date.date.start,oldEnd=date.date.end || new Date(Date.parse(oldStart)+3600000).toISOString();
    const originalDay=oldStart.length===10?oldStart:mexicoDate(oldStart);
    if(originalDay>=today)continue;
    const duration=(Date.parse(oldEnd)-Date.parse(oldStart))/60000;
    if (!Number.isFinite(duration) || duration<=0 || duration>840) continue;
    const minute=oldStart.length===10 ? 480 : mexicoMinutes(oldStart);
    const start=Math.max(480,Math.min(1320-duration,minute));
    const desired={pageId:page.id,title,person:activity.person,start:at(today,start),end:at(today,start+duration)};
    const available=calendarConflict(occupied,desired)?nearbyFreeCalendarSlots(occupied,desired)[0]:desired;
    movements.push({activityId:page.id,title,person:activity.person,originalDate:mexicoDate(oldStart),targetDate:today,previousStart:oldStart,previousEnd:date.date.end||undefined,previousStatus:status?.[status.type]?.name||'',...(available||{start:desired.start,end:desired.end}),noSpace:!available,status:state,reason:state==='suspended'?'Suspendida reprogramada':'Pendiente de día anterior'});
    if(available)occupied.push({...desired,...available});
  }
  return {generatedAt:new Date().toISOString(),reviewed:pages.length,moved:0,skippedCompleted,skippedReview,skippedLocked,skippedSuspended,failed:0,movements};
}
export async function executeDailyAutomation(settings:any,actor:string,day:string,excluded:string[]=[]) {
  const report=await planDailyAutomation(settings,actor,day,new Date(),excluded); const confirmed:any[]=[];
  const errors:string[]=[];
  const eligible=report.movements.filter(move=>!excluded.includes(move.activityId)),batch=eligible.slice(0,10);
  for (const move of batch) {
    try {
      if(move.noSpace)throw Error('No hay espacio suficiente entre 08:00 y 22:00.');
      const page=await mutateActivity(settings,actor,move.activityId,{start:move.start,end:move.end,expectedStart:move.previousStart,expectedEnd:move.previousEnd,expectedTitle:move.title,expectedStatus:move.previousStatus,automationMove:true});
      confirmed.push({...move,page});
    } catch(e) {errors.push(move.title+': '+(e instanceof Error?e.message:'No se pudo mover'));}
  }
  return {...report,moved:confirmed.length,failed:errors.length,movements:confirmed.map(({page,...move})=>move),errors,attemptedIds:batch.map(move=>move.activityId),remaining:Math.max(0,eligible.length-batch.length),pages:confirmed.map(move=>move.page)};
}
