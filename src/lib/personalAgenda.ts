import type {NotionCalendarActivity} from '../types/anfeta';
import {workflowState} from '../services/activityWorkflow';
import {normalizePerson} from '../services/identityNormalizer';
import {calendarUrgent} from '../services/calendarPresentation';

export function personalAgendaActivities(items:NotionCalendarActivity[], person:string) {
  return items.filter(a=>normalizePerson(a.person)===normalizePerson(person))
    .sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.pageId.localeCompare(b.pageId));
}

export function agendaSelection(items:NotionCalendarActivity[], selected:string|null) {
  return items.find(a=>a.pageId===selected)?.pageId
    ?? items.find(a=>workflowState(a.status,a.title)!=='completed'&&!a.isReviewMirror&&!a.isHandoffMirror)?.pageId
    ?? null;
}

export function agendaAppearance(activity:NotionCalendarActivity) {
  const state=workflowState(activity.status,activity.title);
  if(state==='completed')return {label:'Terminada',className:'border-emerald-800/70 bg-[#111815]',text:'text-emerald-300',state};
  if(calendarUrgent(activity.title))return {label:'Urgente',className:'border-rose-700/70 bg-[#181114]',text:'text-rose-300',state};
  if(state==='review')return {label:'En revisión',className:'border-sky-800/70 bg-[#101720]',text:'text-sky-300',state};
  if(state==='suspended')return {label:'Suspendida',className:'border-purple-800/70 bg-[#15121E]',text:'text-purple-300',state};
  return {label:state==='unknown'?(activity.status||'Sin estado'):'Pendiente',className:'border-amber-900/80 bg-[#171514]',text:'text-amber-200',state};
}
