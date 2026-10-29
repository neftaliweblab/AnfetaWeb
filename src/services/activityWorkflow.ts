import {workflowStateLegacy} from './activityWorkflowLegacy';
import {progressiveStage,PROGRESSIVE_WORKFLOW_PRIMARY} from './progressiveWorkflow';
export {workflowStateLegacy};
/** Explicit Notion state takes precedence; new title tokens are a fallback, never a mutation. */
export function workflowState(status:string,title=''){
 if(!PROGRESSIVE_WORKFLOW_PRIMARY)return workflowStateLegacy(status,title);
 const explicit=progressiveStage(status);
 if(explicit)return explicit.state;
 const known=workflowStateLegacy(status);
 if(known!=='unknown')return known;
 const stage=progressiveStage(title);
 return stage?.state||workflowStateLegacy('',title);
}
export function workflowPresentation(status:string,title=''){
 const state=workflowState(status,title),stage=PROGRESSIVE_WORKFLOW_PRIMARY?(progressiveStage(status)||progressiveStage(title)):null;
 const inconsistent=!!stage&&state!==stage.state;
 const basic={pending:'Por hacer',review:'En revisión',completed:'Terminada',suspended:'Suspendida',unknown:'Sin clasificar'};
 return {state,stage,inconsistent,label:stage&&!inconsistent?stage.label:basic[state],financial:stage&&!inconsistent?stage.financial:'unknown',warning:inconsistent?'El código '+stage!.code+' difiere del estado de Notion; se conserva el estado de la propiedad.':''};
}

/** Display only: never use these abbreviations as Notion properties or title tokens. */
export function workflowBadgePresentation(status:string,title=''){
 const info=workflowPresentation(status,title);
 const basic={pending:'PH',review:'REV',completed:'TER',suspended:'SUS',unknown:'SC'};
 const stages:Record<string,string>={aprtuzR:'PA',prtuzR:'PH',rtuzR:'REV',saprtuzR:'SUS',tuzR:'APR',uzR:'CP',zR:'FIN',ZS:'ST',ZC:'CT',ZP:'PT'};
 const shortLabel=info.stage&&!info.inconsistent?(stages[info.stage.code]||basic[info.state]):basic[info.state];
 const description=[info.label,info.stage?'Etapa: '+info.stage.code:'',status?'Estado en Notion: '+status:'',info.warning].filter(Boolean).join(' · ');
 return {...info,shortLabel,description};
}
