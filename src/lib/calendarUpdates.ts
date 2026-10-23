import {staleActivity} from './activityRevision';
import type {NotionCalendarActivity} from '../types/anfeta';
import {pageIdentity} from './deletedPages';
import {mexicoDate} from '../services/calendarPresentation';
import {normalizePerson} from '../services/identityNormalizer';
import {retainedReviewFlow} from './retainedReviewFlow';
import {applyNotionStates} from './applyNotionStates';
const equal=(a:any,b:any)=>Object.keys(b).every(key=>a[key]===b[key])&&Object.keys(a).every(key=>key in b);
function merge(old:NotionCalendarActivity|undefined,incoming:Partial<NotionCalendarActivity>){
  if(old&&staleActivity(incoming,old))return old;
  const patch=Object.fromEntries(Object.entries(incoming).filter(([,v])=>v!==undefined));
  const next={...old,...patch} as NotionCalendarActivity;
  if(old?.checklistScanned&&incoming.checklistScanned===false)for(const key of ['checklistScanned','checklistTotal','checklistCompleted','checklistItems','completedChecks','todayChecklistCompleted'] as const)(next as any)[key]=old[key];
  next.reviewFlow=retainedReviewFlow({...next,reviewFlow:incoming.reviewFlow,reviewFlowScanned:incoming.reviewFlowScanned},old);
  return old&&equal(old,next)?old:next;
}
/** Apply one confirmed activity, including arrival/departure from this day and review mirrors. */
export function upsertCalendarActivity(rows:NotionCalendarActivity[],pageId:string,patch:Partial<NotionCalendarActivity>,day:string){
  const id=pageIdentity(pageId),old=rows.find(a=>!a.isReviewMirror&&!a.isHandoffMirror&&pageIdentity(a)===id);
  if(!old&&(!patch.pageId||!patch.start||!patch.end||!patch.title))return rows;
  const saved=merge(old,patch);
  const valid=!!saved.start&&!!saved.end&&Number.isFinite(Date.parse(saved.start))&&Number.isFinite(Date.parse(saved.end));
  const here=valid&&mexicoDate(saved.start)===day;
  const expected:NotionCalendarActivity[]=[];
  if(here){
    expected.push(saved);
    const flow=saved.reviewFlow;
    if(flow?.State==='pending'&&flow.LeaveVisualCopy!==false&&normalizePerson(flow.OriginalPerson)!==normalizePerson(saved.person))expected.push({...saved,pageId:'review-mirror-'+saved.pageId,person:normalizePerson(flow.OriginalPerson),isReviewMirror:true,title:'[COPIA REVISIÓN] '+saved.title});
  }
  let inserted=false;const next:NotionCalendarActivity[]=[];
  for(const row of rows){
    if(!row.isHandoffMirror&&pageIdentity(row)===id){if(!inserted){for(const item of expected){const previous=rows.find(a=>a.pageId===item.pageId);next.push(previous&&equal(previous,item)?previous:item);}inserted=true;}continue;}
    next.push(row);
  }
  if(!inserted)next.push(...expected);
  return next.length===rows.length&&next.every((a,i)=>a===rows[i])?rows:next;
}
export function applyCalendarStates(rows:NotionCalendarActivity[],states:any[],day:string){
  let next=rows;
  for(const state of states){
    if(state.unverified)continue;
    const id=pageIdentity(state.id);
    const known=next.find(a=>!a.isHandoffMirror&&pageIdentity(a)===id);
    if(staleActivity(state,known))continue;
    if(state.deleted){const filtered=next.filter(a=>pageIdentity(a)!==id);if(filtered.length!==next.length)next=filtered;continue;}
    if(state.scheduledDate===''){next=next.filter(a=>a.isHandoffMirror||pageIdentity(a)!==id);continue;}
    const existing=next.find(a=>!a.isReviewMirror&&!a.isHandoffMirror&&pageIdentity(a)===id);
    if(state.calendarActivity)next=upsertCalendarActivity(next,id,state.calendarActivity,day);
    else if(existing){const patched=applyNotionStates([existing],[state])[0];if(patched!==existing)next=upsertCalendarActivity(next,id,patched,day);}
    if(state.checklistUpdate){const current=next.find(a=>!a.isReviewMirror&&pageIdentity(a)===id),update=state.checklistUpdate;
      if(current){const patch:any={serverModified:state.serverModified};for(const key of ['checklistTotal','checklistCompleted','todayChecklistCompleted'])if(typeof update[key]==='number')patch[key]=update[key];
        if(current.checklistItems&&update.blockId)patch.checklistItems=current.checklistItems.map(item=>pageIdentity(item.blockId||item.id)===pageIdentity(update.blockId)?{...item,isChecked:update.checked}:item);
        next=upsertCalendarActivity(next,id,patch,day);
      }
    }
  }
  return next;
}
export function mergeCalendarSnapshot(previous:NotionCalendarActivity[],incoming:NotionCalendarActivity[],day:string,readStartedAt?:number){
  const history=incoming.filter(a=>a.isHandoffMirror&&mexicoDate(a.start)===day);let next:NotionCalendarActivity[]=[...history];
  for(const row of incoming.filter(a=>!a.isReviewMirror&&!a.isHandoffMirror)){
    const old=previous.find(a=>!a.isReviewMirror&&pageIdentity(a)===pageIdentity(row));
    next=upsertCalendarActivity(next,row.pageId,merge(old,row),day);
  }
  for(const row of previous)if(!row.isReviewMirror&&!row.isHandoffMirror&&((row.localConfirmedAt&&Date.now()-row.localConfirmedAt<60000)||(readStartedAt!==undefined&&Date.parse(row.serverModified||'')>=readStartedAt))&&row.start&&mexicoDate(row.start)===day&&!next.some(a=>pageIdentity(a)===pageIdentity(row)))next=upsertCalendarActivity(next,row.pageId,row,day);
  return next.length===previous.length&&next.every((a,i)=>a===previous[i])?previous:next;
}
