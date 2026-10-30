import {staleActivity} from './activityRevision';
import {pageIdentity} from './deletedPages';
import {workflowState} from '../services/activityWorkflow';
import {normalizePerson} from '../services/identityNormalizer';
export function applyNotionStates<T extends Record<string,any>>(rows:T[],states:any[]):T[]{
 const byId=new Map(states.map(state=>[pageIdentity(state.id),state]));let changed=false;
 const next=rows.flatMap(row=>{
  const state=byId.get(pageIdentity(row));if(!state||state.unverified)return [row];if(state.deleted){changed=true;return [];}
  if(row.isHandoffMirror)return [row];
  if(staleActivity(state,row))return [row];
  const flow=state.calendarActivity?.reviewFlow||state.reviewFlow;
  if(row.isReviewMirror&&((state.updateStatus&&workflowState(state.updateStatus,state.name)==='completed')||flow?.State==='returned'||flow?.LeaveVisualCopy===false)){changed=true;return [];}
  const calendar=!!row.pageId;
  const values:Record<string,unknown>=calendar?{title:state.name===undefined?undefined:row.isReviewMirror?'[COPIA REVISIÓN] '+state.name:state.name,person:row.isReviewMirror?undefined:state.assignedPerson===undefined?undefined:normalizePerson(state.assignedPerson),status:state.updateStatus,start:state.scheduledDate,end:state.scheduledEnd,ftfVerified:state.ftfVerified,ftfAvailable:state.ftfAvailable,reviewFlow:state.calendarActivity?.reviewFlow||state.reviewFlow,serverModified:state.serverModified}:{name:state.name,assignedPerson:state.assignedPerson,updateStatus:state.updateStatus,statusLabel:state.updateStatus,status:state.updateStatus,serverModified:state.serverModified,modifiedLocalDate:state.serverModified?String(state.serverModified).slice(0,10):undefined,scheduledDate:state.scheduledDate,scheduledEnd:state.scheduledEnd,ftfVerified:state.ftfVerified,ftfAvailable:state.ftfAvailable};
  // Sparse events must never erase fields omitted by the publisher.
  const update=Object.fromEntries(Object.entries(values).filter(([,value])=>value!==undefined));
  if(calendar&&(!state.scheduledDate||String(state.scheduledDate).length===10)){delete update.start;delete update.end;}
  if(Object.entries(update).every(([key,value])=>row[key]===value))return [row];changed=true;return [{...row,...update}];
 });
 for(const state of states){const a=state.calendarActivity;if(state.deleted||state.unverified||!a?.pageId||!a.title||!a.start||next.some(row=>pageIdentity(row)===pageIdentity(a)))continue;
   next.push({id:a.pageId,externalId:a.pageId,name:a.title,path:a.pageUrl||'',folder:'',extension:'',sizeBytes:0,modifiedLocalDate:String(a.serverModified||'').slice(0,10),serverModified:a.serverModified,source:'Notion',sourceName:'Revisiones',type:'PAGE',externalUrl:a.pageUrl,target:a.pageUrl,assignedPerson:a.person,scheduledDate:a.start,updateStatus:a.status,statusLabel:a.status,domainChip:a.domain} as unknown as T);changed=true;
 }
 return changed?next:rows;
}
