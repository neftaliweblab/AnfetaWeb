import {normalizePerson} from '../services/identityNormalizer';
export function reviewPreflight(original:any,fresh:any){
 const baseChanged=String(fresh.title).trim()!==String(original.title).trim()||fresh.status!==original.status||normalizePerson(fresh.person)!==normalizePerson(original.person)||fresh.start!==original.start||fresh.end!==original.end;
 const flowChanged=!!(original.reviewFlowScanned||original.reviewFlow)&&((fresh.reviewFlow?.UpdatedAt||null)!==(original.reviewFlow?.UpdatedAt||null));
 return {changed:baseChanged||flowChanged,expectedReviewUpdatedAt:fresh.reviewFlow?.UpdatedAt||null};
}
