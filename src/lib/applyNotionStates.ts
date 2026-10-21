import {pageIdentity} from './deletedPages';
export function applyNotionStates(rows:any[],states:any[]){
 const byId=new Map(states.map(state=>[pageIdentity(state.id),state]));
 let changed=false;
 const next=rows.flatMap(row=>{const state=byId.get(pageIdentity(row));if(!state||state.unverified)return [row];if(state.deleted){changed=true;return [];}
  const update={name:state.name,assignedPerson:state.assignedPerson,updateStatus:state.updateStatus,status:state.updateStatus,serverModified:state.serverModified,modifiedLocalDate:String(state.serverModified||'').slice(0,10),scheduledDate:state.scheduledDate};
  if(Object.entries(update).every(([key,value])=>row[key]===value))return [row];changed=true;return [{...row,...update}];
 });return changed?next:rows;
}
