import {normalizePerson} from './identityNormalizer';
import {mexicoMinutes,mexicoDate} from './calendarPresentation';
import {workflowState} from './activityWorkflow';
import {canEditActivity} from './activityPermissions';
const at=(day:string,m:number)=>day+'T'+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+':00-06:00';
export function planDurationCascade(activities:any[],pageId:string,actor:string,delta:number){
  const root=activities.find(a=>a.pageId===pageId);
  if(!root||!canEditActivity(actor,root)||workflowState(root.status,root.title)!=='pending')throw new Error('Solo se puede ajustar una actividad pendiente y editable.');
  const day=mexicoDate(root.start),duration=(Date.parse(root.end)-Date.parse(root.start))/60000;
  if(!Number.isFinite(duration)||duration+delta<15)throw new Error('La duración mínima es de 15 minutos.');
  const changes:any[]=[];
  const add=(a:any,start:number,end:number)=>{if(end>1320)throw new Error('El ajuste supera las 22:00. No se aplicaron cambios.');changes.push({pageId:a.pageId,title:a.title,expectedTitle:a.title,expectedStart:a.start,expectedEnd:a.end,start:at(day,start),end:at(day,end)});};
  let cursor=mexicoMinutes(root.start)+duration+delta;
  add(root,mexicoMinutes(root.start),cursor);
  if(delta>0){
    const others=activities.filter(a=>a.pageId!==root.pageId&&!a.isReviewMirror&&normalizePerson(a.person)===normalizePerson(root.person)&&mexicoDate(a.start)===day).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
    for(const a of others){
      if(Date.parse(a.end)<=Date.parse(root.start))continue;
      if(Date.parse(a.start)<Date.parse(root.start))throw new Error('La actividad ya tiene un empalme anterior; corrígelo antes del ajuste.');
      if(mexicoMinutes(a.start)>=cursor)break;
      if(!canEditActivity(actor,a)||workflowState(a.status,a.title)!=='pending')throw new Error('El ajuste alcanza una actividad fija, bloqueada o en revisión: '+a.title);
      const minutes=(Date.parse(a.end)-Date.parse(a.start))/60000;
      if(!Number.isFinite(minutes)||minutes<=0)throw new Error('Una actividad tiene duración inválida.');
      add(a,cursor,cursor+minutes);cursor+=minutes;
    }
  }
  if(changes.length>30)throw new Error('El ajuste supera el máximo de 30 actividades.');
  // Mover primero la cola libera el espacio antes de ampliar la actividad inicial.
  return changes.reverse();
}
export function planOneClick(activities:any[],day:string,person:string,startMinute=480) {
  const selected=activities.filter(a=>normalizePerson(a.person)===normalizePerson(person)&&!a.isReviewMirror&&!a.isLocked&&workflowState(a.status,a.title)==='pending');
  const fixed=activities.filter(a=>!selected.includes(a)&&normalizePerson(a.person)===normalizePerson(person)&&!a.isReviewMirror).map(a=>[mexicoMinutes(a.start),mexicoMinutes(a.end)]);
  const changes:any[]=[]; let cursor=startMinute;
  for (const activity of selected) {
    const duration=Math.ceil((Date.parse(activity.end)-Date.parse(activity.start))/900000)*15;
    if (!Number.isFinite(duration)||duration<=0) continue;
    while (cursor+duration<=1320 && fixed.some(([a,b])=>cursor<b&&cursor+duration>a)) cursor+=15;
    if(cursor+duration>1320) throw new Error('La jornada no alcanza para todas las actividades; no se ha guardado ningún cambio.');
    changes.push({pageId:activity.pageId,title:activity.title,expectedTitle:activity.title,expectedStart:activity.start,expectedEnd:activity.end,start:at(day,cursor),end:at(day,cursor+duration)});cursor+=duration;
  }
  return changes;
}
