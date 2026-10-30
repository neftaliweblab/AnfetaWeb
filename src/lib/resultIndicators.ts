import {workflowState} from '../services/activityWorkflow';
export const RESULT_STATUS_FILTERS=[['all','Todos los estados'],['pending','PH · Por hacer'],['review','REV · En revisión'],['completed','TER · Terminadas'],['suspended','SUS · Suspendidas'],['unknown','Sin clasificar']] as const;
export function matchesResultStatus(row:any,filter:string){return filter==='all'||workflowState(row.updateStatus||row.statusLabel||row.status||'',row.name||'')===filter;}
/** Visual only: never change scheduledDate or the sort key. */
export function resultDuration(row:any){
 let minutes=Number(row.estimatedWorkMinutes||row.estimatedMinutes||0);
 if(!(minutes>0)){
  const raw=String(row.scheduledDate||row.start||''),iso=raw.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?/g)||[];
  const end=row.scheduledEnd||row.end||iso[1];
  if(iso[0]&&end)minutes=(Date.parse(end)-Date.parse(iso[0]))/60000;
  else {const clocks=[...raw.matchAll(/(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s*m\.?)?/gi)];if(clocks.length===2){const time=(m:RegExpMatchArray)=>(m[3]?Number(m[1])%12+(m[3].toLowerCase()==='p'?12:0):Number(m[1]))*60+Number(m[2]);minutes=time(clocks[1])-time(clocks[0]);if(minutes<0)minutes+=1440;}}
 }
 if(!Number.isFinite(minutes)||minutes<=0)return '';
 minutes=Math.round(minutes);return [Math.floor(minutes/60)?Math.floor(minutes/60)+' h':'',minutes%60?minutes%60+' min':''].filter(Boolean).join(' ');
}
