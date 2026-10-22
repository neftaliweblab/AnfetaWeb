import {pageIdentity} from './deletedPages';
import {workflowState} from '../services/activityWorkflow';
import {normalizePerson} from '../services/identityNormalizer';
export function applyNotionStates<T extends Record<string,any>>(rows:T[],states:any[]):T[]{
 const byId=new Map(states.map(state=>[pageIdentity(state.id),state]));let changed=false;
 const next=rows.flatMap(row=>{
  const state=byId.get(pageIdentity(row));if(!state||state.unverified)return [row];if(state.deleted){changed=true;return [];}
  if(row.isHandoffMirror)return [row];
  if(row.isReviewMirror&&state.updateStatus&&workflowState(state.updateStatus,state.name)==='completed'){changed=true;return [];}
  if(Date.parse(row.serverModified||'')>Date.parse(state.serverModified||''))return [row];
  const calendar=!!row.pageId;
  const values:Record<string,unknown>=calendar?{title:state.name===undefined?undefined:row.isReviewMirror?'[COPIA REVISIÓN] '+state.name:state.name,person:row.isReviewMirror?undefined:state.assignedPerson===undefined?undefined:normalizePerson(state.assignedPerson),status:state.updateStatus,start:state.scheduledDate,end:state.scheduledEnd,ftfVerified:state.ftfVerified,ftfAvailable:state.ftfAvailable,serverModified:state.serverModified}:{name:state.name,assignedPerson:state.assignedPerson,updateStatus:state.updateStatus,statusLabel:state.updateStatus,status:state.updateStatus,serverModified:state.serverModified,modifiedLocalDate:state.serverModified?String(state.serverModified).slice(0,10):undefined,scheduledDate:state.scheduledDate};
  // Sparse events must never erase fields omitted by the publisher.
  const update=Object.fromEntries(Object.entries(values).filter(([,value])=>value!==undefined));
  if(calendar&&(!state.scheduledDate||String(state.scheduledDate).length===10)){delete update.start;delete update.end;}
  if(Object.entries(update).every(([key,value])=>row[key]===value))return [row];changed=true;return [{...row,...update}];
 });return changed?next:rows;
}
