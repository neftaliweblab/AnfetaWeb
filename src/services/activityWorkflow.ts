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
/**
 * Diferenciador explícito de estados de opción múltiple / ciclo de vida:
 * Distingue entre 'pending', 'review', 'suspended', 'terminated' (tuz / terminada por aprobar) y 'finalized' (z / FIN definitiva).
 */
export function activityDetailedState(status: string, title = ''): 'pending' | 'review' | 'suspended' | 'terminated' | 'finalized' | 'unknown' {
  const isFin = /finaliz|fin\b|cobro\/documentacion|cobrado/i.test(status) || /(?<![a-z])z[rdscp]?\b/i.test(title) || /(?<![a-z])z\b/i.test(status);
  if (isFin) return 'finalized';

  const isTer = (/terminad/i.test(status) && !/no\s+terminad/i.test(status)) || /(?<![a-z])tuz[rdscp]?\b/i.test(title) || /^tuz\b/i.test(status);
  if (isTer) return 'terminated';

  const base = workflowState(status, title);
  if (base === 'completed') return 'finalized';
  return base;
}

/** Display only: never use these abbreviations as Notion properties or title tokens. */
export function workflowBadgePresentation(status:string,title=''){
 const info=workflowPresentation(status,title);
 const basic={pending:'PH',review:'REV',completed:'TER',suspended:'SUS',unknown:'SC'};
 const stages:Record<string,string>={aprtuzR:'PA',aprtuz:'PA',prtuzR:'PH',prtuz:'PH',rtuzR:'REV',rtuz:'REV',saprtuzR:'SUS',saprtuz:'SUS',tuzR:'TER',tuz:'TER',uzR:'CP',uz:'CP',zR:'FIN',z:'FIN',ZS:'ST',ZC:'CT',ZP:'PT'};
 const isFin = info.stage?.code?.toLowerCase().startsWith('z') || /finaliz|fin\b|cobro\/documentacion|cobrado/i.test(status) || /(?<![a-z])z[rdscp]?\b/i.test(title);
 const isTer = !isFin && (info.stage?.code?.toLowerCase().startsWith('tuz') || (/terminad/i.test(status) && !/no\s+terminad/i.test(status)) || /(?<![a-z])tuz[rdscp]?\b/i.test(title));
 const shortLabel = isFin ? 'FIN' : isTer ? 'TER' : info.stage && !info.inconsistent ? (stages[info.stage.code] || basic[info.state]) : basic[info.state];
 const description=[isFin ? 'Finalizada (Fin)' : isTer ? 'Terminada · por aprobar' : info.label,info.stage?'Etapa: '+info.stage.code:'',status?'Estado en Notion: '+status:'',info.warning].filter(Boolean).join(' · ');
 return {...info,shortLabel,description,isFin,isTer};
}
