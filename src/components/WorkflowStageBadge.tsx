import {workflowPresentation} from '@/services/activityWorkflow';
export function WorkflowStageBadge({status,title}:{status:string;title:string}){
 const info=workflowPresentation(status,title);if(!info.stage)return null;
 return <span title={info.warning||'Etapa interpretada de Notion; no modifica el título ni registra movimientos financieros.'} className={'inline-flex max-w-full items-center rounded border px-1.5 py-0.5 text-[10px] '+(info.inconsistent?'border-amber-700 text-amber-200':'border-cyan-800 text-cyan-200')}>
 {info.inconsistent?'⚠ '+info.stage.code+' · revisar estado':info.stage.code+' · '+info.label}
 </span>;
}
