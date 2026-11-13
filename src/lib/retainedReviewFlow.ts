import {workflowState} from '../services/activityWorkflow';
import {normalizePerson} from '../services/identityNormalizer';

export function retainedReviewFlow<T extends {title:string;person:string;status:string;reviewFlow?:any;reviewFlowScanned?:boolean}>(incoming:T,previous?:T){
  if(incoming.reviewFlowScanned||incoming.reviewFlow)return incoming.reviewFlow;
  if(!previous)return undefined;
  const wf=workflowState(incoming.status,incoming.title);
  if(incoming.status!==previous.status||wf!==workflowState(previous.status,previous.title))return undefined;
  if(incoming.person===previous.person)return previous.reviewFlow;
  if(wf==='review'&&previous.reviewFlow?.State==='pending'&&previous.reviewFlow.LeaveVisualCopy!==true&&previous.reviewFlow.ReviewAssignee&&normalizePerson(incoming.person)===normalizePerson(previous.reviewFlow.ReviewAssignee)){
    return previous.reviewFlow;
  }
  return undefined;
}

export function fixedReviewColumnPerson(person:string,status:string,title:string,reviewFlow?:any,isMirror?:boolean){
  if(!isMirror&&reviewFlow?.State==='pending'&&reviewFlow?.LeaveVisualCopy!==true&&reviewFlow?.OriginalPerson&&normalizePerson(reviewFlow.OriginalPerson)!=='Sin asignar'&&workflowState(status,title)==='review'){
    return normalizePerson(reviewFlow.OriginalPerson);
  }
  return normalizePerson(person);
}
