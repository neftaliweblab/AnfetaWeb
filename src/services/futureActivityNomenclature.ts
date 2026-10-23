import {workflowState} from './activityWorkflow';
/** Prepared only: no active caller changes titles or workflow classifications. */
export const NEW_NOMENCLATURE_ENABLED=false;
export const FUTURE_CATEGORIES={ZR:'revision',ZS:'software',ZC:'cobro',ZP:'pago'} as const;
export function previewFuturePhase(title:string,status=''){
 const code=title.trim().match(/^(ZR|ZS|ZC|ZP)(?=\s|$)/i)?.[1]?.toUpperCase() as keyof typeof FUTURE_CATEGORIES|undefined;
 if(!code)return null;
 const state=workflowState(status);
 return {code,category:FUTURE_CATEGORIES[code],state,completed:state==='completed',inconsistent:state!=='completed',enabled:NEW_NOMENCLATURE_ENABLED};
}
