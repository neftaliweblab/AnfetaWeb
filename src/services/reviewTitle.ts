import {normalizePerson} from './identityNormalizer';
import {ACTIVITY_TAGS,ActivityPerson,scanActivityTags} from './activityTags';

export function reviewTitle(title:string,original:string,reviewer:string,state:'pending'|'returned'|'approved',previousReviewer=''){
  const ownerKey=normalizePerson(original) as ActivityPerson,reviewKey=normalizePerson(reviewer) as ActivityPerson;
  const owner=ACTIVITY_TAGS[ownerKey],review=ACTIVITY_TAGS[reviewKey];
  if((!owner&&normalizePerson(original)!=='Sin asignar')||!review)throw Error('No se encontró la configuración de tags de revisión.');
  const previousKey=normalizePerson(previousReviewer) as ActivityPerson;
  if(state==='pending'&&ACTIVITY_TAGS[previousKey]&&previousKey!==reviewKey&&previousKey!==ownerKey){
    let source=title;
    for(const tag of scanActivityTags(title).reverse())if(tag.person===previousKey&&tag.role==='review')source=source.slice(0,tag.index)+ACTIVITY_TAGS[previousKey].passive+source.slice(tag.index+tag.token.length);
    return reviewTitle(source,original,reviewer,state);
  }
  const tags=scanActivityTags(title);
  const ownerTags=tags.filter(tag=>tag.person===ownerKey&&(tag.role==='active'||tag.role==='reference'));
  const ownerTokens=[...new Set(ownerTags.map(tag=>tag.legacy?(state==='returned'?ACTIVITY_TAGS[ownerKey].review:ACTIVITY_TAGS[ownerKey].passive)+tag.suffix:(state==='returned'?ACTIVITY_TAGS[ownerKey].active:ACTIVITY_TAGS[ownerKey].reference)+tag.suffix))];
  if(owner&&!ownerTokens.length)ownerTokens.push(state==='returned'?owner.review:owner.passive);
  const legacyReviewSuffix=tags.find(tag=>tag.person===reviewKey&&tag.legacy&&tag.suffix)?.suffix||'';
  const remove=tags.filter(tag=>{
    if(tag.person===ownerKey)return tag.role!=='legacy'||tag.token===tag.token.toLowerCase();
    if(tag.person===reviewKey)return tag.role==='review'||tag.legacy&&(!!tag.suffix||tag.token===tag.token.toLowerCase());
    return false;
  });
  let body=title;
  for(const tag of remove.reverse())body=body.slice(0,tag.index)+' '+body.slice(tag.index+tag.token.length);
  body=body.replace(/[\s·|—–-]+$/, '').trim();
  const phase=/(?<![\p{L}\p{N}_])(?:sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)(?![\p{L}\p{N}_])/giu;
  const target=state==='pending'?'rtuzREVISION':state==='approved'?'zREVISION':'prtuzREVISION';
  body=phase.test(body)?body.replace(phase,target):target+' '+body;
  const reviewerToken=(state==='pending'?review.review:review.passive)+legacyReviewSuffix;
  return [body,...ownerTokens,reviewerToken].join(' ').replace(/\s{2,}/g,' ').trim();
}
