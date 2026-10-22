import {normalizePerson} from '../services/identityNormalizer';
import {sameInstant} from './sameInstant';
export function reviewPreflight(original:any,fresh:any){
 const baseChanged=String(fresh.title).trim()!==String(original.title).trim()||fresh.status!==original.status||normalizePerson(fresh.person)!==normalizePerson(original.person)||!sameInstant(fresh.start,original.start)||!sameInstant(fresh.end,original.end);
 const flowChanged=!!(original.reviewFlowScanned||original.reviewFlow)&&!sameInstant(fresh.reviewFlow?.UpdatedAt||null,original.reviewFlow?.UpdatedAt||null);
 return {changed:baseChanged||flowChanged,expectedReviewUpdatedAt:fresh.reviewFlow?.UpdatedAt||null};
}
