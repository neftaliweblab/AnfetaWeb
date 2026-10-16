import {workflowState} from '@/services/activityWorkflow';

export function isCompletedResult(item:any):boolean{
  return workflowState(item.updateStatus||item.status||item.UpdateStatus||'',item.name||item.title||item.Name||'')==='completed';
}

/** Stable partition: keep the existing date/name/source order within each side. */
export function activeResultsFirst<T>(items:readonly T[]):T[]{
  const active:T[]=[],completed:T[]=[];
  for(const item of items)(isCompletedResult(item)?completed:active).push(item);
  return [...active,...completed];
}

/** Preserve group identities; move groups containing only completed rows last. */
export function activeGroupsFirst<T,G extends {items:T[]}>(groups:G[]):G[]{
  const active:G[]=[],completed:G[]=[];
  for(const group of groups){
    const sorted={...group,items:activeResultsFirst(group.items)};
    (group.items.length>0&&group.items.every(isCompletedResult)?completed:active).push(sorted);
  }
  return [...active,...completed];
}
