import {mexicoDate} from '../services/calendarPresentation';
/** Daily workload excludes checked history; never changes the underlying Notion checks. */
export function dailyChecklist<T extends {isChecked:boolean;markedAt?:string;markingSource?:string}>(items:readonly T[],day:string){
 const pending:T[]=[],completed:T[]=[],history:T[]=[];let unknown=0;
 for(const item of items){if(!item.isChecked){pending.push(item);continue;}const markedDay=item.markedAt?mexicoDate(item.markedAt):'';if(item.markingSource==='verified'&&markedDay===day)completed.push(item);else{history.push(item);if(item.markingSource!=='verified'||!markedDay)unknown++;}}
 const total=pending.length+completed.length;
 return {items:[...pending,...completed],pending,completed,history,unknown,total,done:completed.length,percent:total?Math.round(completed.length*100/total):0};
}

export function dailyActivityChecks(activity:any,day=mexicoDate(activity.start)){
 if(Array.isArray(activity.checklistItems)&&(activity.checklistItems.length>0||!activity.checklistTotal))return dailyChecklist(activity.checklistItems,day);
 const total=(activity.dailyChecklistTotal!==undefined?activity.dailyChecklistTotal:(activity.todayChecklistCompleted!==undefined?activity.checklistTotal:0))||0;
 const done=activity.dailyChecklistCompleted??activity.todayChecklistCompleted??0;
 return {total,done,percent:total?Math.round(done*100/total):0};
}

/** Actual checked state, independent of whether the marking date is known. */
export function checklistTotals(activity:any){
 const items=Array.isArray(activity.checklistItems)?activity.checklistItems:[];
 const hasItems=items.length>0;
 const total=hasItems?items.length:Math.max(0,Number(activity.checklistTotal)||0);
 const done=hasItems?items.filter((item:any)=>item.isChecked).length:Math.max(0,Math.min(total,Number(activity.checklistCompleted)||0));
 return {total,done,percent:total?Math.round(done*100/total):0};
}
