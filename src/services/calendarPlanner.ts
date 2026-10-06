import {normalizePerson} from './identityNormalizer';
import {mexicoMinutes} from './calendarPresentation';
import {workflowState} from './activityWorkflow';
const at=(day:string,m:number)=>day+'T'+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+':00-06:00';
export function planOneClick(activities:any[],day:string,person:string,startMinute=480) {
  const selected=activities.filter(a=>normalizePerson(a.person)===normalizePerson(person)&&!a.isReviewMirror&&!a.isLocked&&workflowState(a.status,a.title)==='pending');
  const fixed=activities.filter(a=>!selected.includes(a)&&normalizePerson(a.person)===normalizePerson(person)&&!a.isReviewMirror).map(a=>[mexicoMinutes(a.start),mexicoMinutes(a.end)]);
  const changes:any[]=[]; let cursor=startMinute;
  for (const activity of selected) {
    const duration=Math.ceil((Date.parse(activity.end)-Date.parse(activity.start))/900000)*15;
    if (!Number.isFinite(duration)||duration<=0) continue;
    while (cursor+duration<=1320 && fixed.some(([a,b])=>cursor<b&&cursor+duration>a)) cursor+=15;
    if(cursor+duration>1320) throw new Error('La jornada no alcanza para todas las actividades; no se ha guardado ningún cambio.');
    changes.push({pageId:activity.pageId,title:activity.title,start:at(day,cursor),end:at(day,cursor+duration)});cursor+=duration;
  }
  return changes;
}
