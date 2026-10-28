import {workflowPresentation} from '@/services/activityWorkflow';

const WORKFLOW_COLORS: Record<string, string> = {
  pending: '#C084FC',
  review: '#7DD3FC',
  completed: '#34D399',
  suspended: '#FACC15',
  unknown: '#94A3B8',
};

export function WorkflowStageBadge({status,title,scale=1}:{status:string;title:string;scale?:number}){
 const info=workflowPresentation(status,title);
 if(!info.stage)return null;
 const color = info.inconsistent ? '#F59E0B' : (WORKFLOW_COLORS[info.state] || '#38BDF8');
 const label = info.inconsistent ? `⚠ ${info.stage.code} · revisar` : `${info.stage.code} · ${info.label}`;

 return (
   <span
     title={info.warning || `Etapa: ${info.stage.code} (${info.label})`}
     style={{
       fontSize: `${Math.max(7.5, 8 * scale).toFixed(1)}px`,
       padding: `${Math.max(1, Math.round(1 * scale))}px ${Math.max(4, Math.round(6 * scale))}px`,
       color,
     }}
     className="inline-flex max-w-full items-center gap-1 rounded-full font-bold bg-[#1E293B] border border-current/25 truncate whitespace-nowrap"
   >
     <span
       className="rounded-full shrink-0"
       style={{
         width: `${Math.max(4, Math.round(6 * scale))}px`,
         height: `${Math.max(4, Math.round(6 * scale))}px`,
         backgroundColor: color,
       }}
     />
     <span className="truncate">{label}</span>
   </span>
 );
}
