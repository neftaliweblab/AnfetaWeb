import {workflowState} from './activityWorkflow';
import {progressiveStage,PROGRESSIVE_WORKFLOW_PRIMARY} from './progressiveWorkflow';
/** Title tokens only. Identity/login aliases remain a separate concern. */
export const ACTIVITY_TAGS = {
  Neftali:{active:'nne',reference:'ne',review:'nneft',aliases:['nneft','nnetf','neft','netf','neftali'],passive:'neft'},
  Genaro:{active:'gge',reference:'ge',review:'ggena',aliases:['ggena','gena','genaro'],passive:'gena'},
  Acalli:{active:'aac',reference:'ac',review:'aacal',aliases:['aacal','acal','acalli'],passive:'acal'},
  Karla:{active:'kka',reference:'ka',review:'kkarl',aliases:['kkarl','karl','karla'],passive:'karl'},
  John:{active:'jjo',reference:'jo',review:'jjohn',aliases:['jjohn','john'],passive:'john'},
  Isaias:{active:'iis',reference:'is',review:'iisai',aliases:['iisai','iisaia','isai','isaias'],passive:'isai'},
  Andrade:{active:'aan',reference:'an',review:'aandr',aliases:['aandr','andr','andrade'],passive:'andr'},
  Brian:{active:'bbr',reference:'br',review:'bbria',aliases:['bbria','bria','brian'],passive:'bria'},
  Sotelo:{active:'sso',reference:'so',review:'ssote',aliases:['ssote','sote','eedua','edua','sotelo'],passive:'sote'},
} as const;
export type ActivityPerson=keyof typeof ACTIVITY_TAGS;
export type ActivityPriority='00'|'11'|'22'|'33';
export const PRIORITY_LABELS:Record<ActivityPriority,string>={'00':'Urgente','11':'Primaria','22':'Secundaria','33':'Usar / practicar'};
export interface ActivityTag {person:ActivityPerson;role:'active'|'reference'|'review'|'legacy'|'template';priority?:ActivityPriority;suffix:string;token:string;index:number;legacy:boolean}
const suffixes=['0000','000','001','002','003','00','11','22','33','0','1','2','3'];
const legacyPriority=(suffix:string):ActivityPriority|undefined=>['001','1'].includes(suffix)?'11':['002','2'].includes(suffix)?'22':['003','3'].includes(suffix)?'33':/^0{1,4}$/.test(suffix)?'00':(['11','22','33'].includes(suffix)?suffix as ActivityPriority:undefined);
const PRIORITY_SUFFIXES: [string, ActivityPriority][] = [
  ['0000', '00'], ['000', '00'], ['00', '00'], ['0', '00'],
  ['11', '11'], ['1', '11'],
  ['22', '22'], ['2', '22'],
  ['33', '33'], ['3', '33'],
];
function resolveActivityTag(token:string):Omit<ActivityTag,'index'>|undefined{
  const lower=token.toLowerCase();
  // Hyphenated annotations belong to templates, never to an active assignment.
  if(lower.includes('-')){
    const compact=resolveActivityTag(lower.replace('-', ''))||(/^[a-z]-/.test(lower)?resolveActivityTag(lower.slice(2)):undefined);
    if(compact)return {...compact,role:'template',token};
  }

  for(const [person,entry] of Object.entries(ACTIVITY_TAGS)){
    if(lower===entry.active+'000'||lower===entry.reference+'000')return {person:person as ActivityPerson,role:'review',suffix:'000',token,legacy:false};
    for(const [suffix, priority] of PRIORITY_SUFFIXES){
      if(lower===entry.active+suffix)return {person:person as ActivityPerson,role:'active',priority,suffix:priority,token,legacy:false};
      if(lower===entry.reference+suffix)return {person:person as ActivityPerson,role:'reference',priority,suffix:priority,token,legacy:false};
    }
    for(const alias of entry.aliases){
      if(lower===alias)return {person:person as ActivityPerson,role:lower===entry.review?'review':'legacy',suffix:'',token,legacy:true};
      for(const suffix of suffixes)if(lower===alias+suffix)return {person:person as ActivityPerson,role:alias[0]===alias[1]?'active':'reference',priority:legacyPriority(suffix),suffix,token,legacy:true};
    }
    if(lower===entry.active[0]+'-'+entry.passive)return {person:person as ActivityPerson,role:'legacy',suffix:'',token,legacy:true};
  }
}
// Bound the cache: ordinary words and repeated OR clauses should not rescan every user's aliases.
const tagParseCache=new Map<string,Omit<ActivityTag,'index'>|undefined>();
export function parseActivityTag(token:string):Omit<ActivityTag,'index'>|undefined{
 const key=token.toLowerCase();
 if(!tagParseCache.has(key)){
  if(tagParseCache.size>=2048)tagParseCache.delete(tagParseCache.keys().next().value!);
  tagParseCache.set(key,resolveActivityTag(key));
 }
 const tag=tagParseCache.get(key);return tag?{...tag,token}:undefined;
}
export function scanActivityTags(text:string):ActivityTag[]{
  const found:ActivityTag[]=[];
  for(const match of text.matchAll(/(?<![\p{L}\p{N}_@./-])[a-z]+(?:-[a-z]+)?\d*(?![\p{L}\p{N}_@./-])/giu)){
    const tag=parseActivityTag(match[0]);if(tag)found.push({...tag,index:match.index!});
  }
  return found;
}
export function activityPerson(input:string):ActivityPerson|undefined{
  const value=input.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  return (Object.keys(ACTIVITY_TAGS) as ActivityPerson[]).find(person=>person.toLowerCase()===value)||parseActivityTag(value)?.person;
}
export function activePersonTag(person:string,priority:ActivityPriority='11'){
  const key=activityPerson(person);return key?ACTIVITY_TAGS[key].active+priority:'';
}
export function pendingReviewTag(person:string){const key=activityPerson(person);return key?ACTIVITY_TAGS[key].active+'000':'';}
export function titlePriority(title:string,person?:string){
  const key=person?activityPerson(person):undefined;
  const tags=scanActivityTags(title).filter(tag=>tag.role==='active'&&(!key||tag.person===key));
  return (['00','11','22','33'] as const).find(priority=>tags.some(tag=>tag.priority===priority));
}
/** Urgency is an owned task token; keep the normal priority for when urgency is removed. */
export function setTaskUrgent(title:string,person:string,urgent:boolean){
  const owner=activityPerson(person);
  if(!owner)throw Error('No se encontró el responsable para cambiar la urgencia.');
  const tags=scanActivityTags(title).filter(tag=>tag.person===owner&&tag.role==='active'&&tag.priority==='00');
  if(urgent)return tags.length?title:(title+' '+activePersonTag(owner,'00')).trim();
  let result=title;
  for(const tag of tags.reverse())result=result.slice(0,tag.index)+' '+result.slice(tag.index+tag.token.length);
  return result.replace(/\s+00$/,'').replace(/\s{2,}/g,' ').trim();
}
/** The canonical three-zero tag identifies the active reviewer, not a reference such as ge11. */
export function currentReviewTagPerson(title:string,status=''){
  if(workflowState(status,title)!=='review')return '';
  return scanActivityTags(title).findLast(tag=>tag.role==='review'&&!tag.legacy&&tag.token.toLowerCase()===pendingReviewTag(tag.person))?.person||'';
}
export function inferActivityPerson(title:string,status=''){
  const tags=scanActivityTags(title),review=(PROGRESSIVE_WORKFLOW_PRIMARY&&(progressiveStage(status)?.state==='review'||progressiveStage(title)?.state==='review'))||/rtuzrevision|en revisi[oó]n/i.test(status)||/(?<![a-z])rtuzREVISION\b/i.test(title);
  const candidate=review?(tags.findLast(tag=>tag.role==='review'&&!tag.legacy&&tag.token.toLowerCase()===pendingReviewTag(tag.person))||tags.findLast(tag=>tag.role==='review')):tags.find(tag=>tag.role==='active')||tags.find(tag=>tag.role==='review')||tags.find(tag=>tag.role==='legacy');
  return candidate?.person||'';
}
export function resultAssignedPerson(item:any){
  const review=currentReviewTagPerson(String(item?.name||item?.title||item?.Name||''),String(item?.updateStatus||item?.status||''));
  if(review&&!item?.isReviewMirror&&!item?.IsReviewMirror&&!item?.isHandoffMirror)return review;
  for(const value of [item?.assignedPerson,item?.AssignedPerson,item?.person,...(item?.assignmentKeys||[])]){
    if(typeof value!=='string')continue;
    const identity=value.split('@')[0].trim();if(parseActivityTag(identity)?.role==='template')continue;
    const person=activityPerson(identity);if(person)return person;
  }
  return inferActivityPerson(String(item?.name||item?.title||item?.Name||''),String(item?.updateStatus||item?.status||''));
}
export function activityTagPattern(){
  const tokens:string[]=[];
  for(const entry of Object.values(ACTIVITY_TAGS)){
    tokens.push(entry.active+'000',entry.reference+'000',entry.active.slice(0,2)+'-'+entry.active.slice(2)+'000',entry.active[0]+'-'+entry.reference+'000');
    for(const [suffix] of PRIORITY_SUFFIXES)tokens.push(entry.active.slice(0,2)+'-'+entry.active.slice(2)+suffix,entry.active+suffix,entry.reference+suffix,entry.active[0]+'-'+entry.active+suffix,entry.active[0]+'-'+entry.reference+suffix);
    for(const alias of entry.aliases){tokens.push(alias);for(const suffix of suffixes)tokens.push(alias+suffix);}
    tokens.push(entry.active[0]+'-'+entry.passive);
  }
  return new RegExp('(?<![\\p{L}\\p{N}_@./-])(?:'+tokens.sort((a,b)=>b.length-a.length).join('|')+')(?![\\p{L}\\p{N}_@./-])','giu');
}
export function stripActivityTags(title:string){
  let result=title;for(const tag of scanActivityTags(title).reverse())result=result.slice(0,tag.index)+' '+result.slice(tag.index+tag.token.length);return result;
}
/** Structured tag queries never fall back to substring/identity aliases. */
export function matchesActivityTagQuery(title:string,query:string,matchCase=false):boolean|undefined{
  const wanted=parseActivityTag(query);if(!wanted||wanted.role==='legacy')return undefined;
  return scanActivityTags(title).some(tag=>{
    if(matchCase&&tag.token!==query)return false;
    if(tag.person!==wanted.person||tag.role!==wanted.role)return false;
    if(wanted.role==='review')return true;
    if(wanted.role==='template')return tag.token.toLowerCase()===query.toLowerCase();
    return wanted.priority===tag.priority;
  });
}

/** Completed titles are references only, regardless of whether review metadata exists. */
export function completedActivityTags(title:string,reviewer='',original=''){
  const reviewKey=activityPerson(reviewer),ownerKey=activityPerson(original);
  let result=title;
  for(const tag of scanActivityTags(title).reverse()){
    const legacyOwner=tag.legacy&&tag.person===ownerKey&&tag.token.toLowerCase()===ACTIVITY_TAGS[tag.person].review;
    const remove=(tag.role==='review'&&!legacyOwner)||(reviewKey&&reviewKey!==ownerKey&&tag.person===reviewKey);
    const replacement=legacyOwner?ACTIVITY_TAGS[tag.person].passive:remove?' ':tag.role==='active'?(tag.legacy?ACTIVITY_TAGS[tag.person].passive:ACTIVITY_TAGS[tag.person].reference)+tag.suffix:tag.token;
    result=result.slice(0,tag.index)+replacement+result.slice(tag.index+tag.token.length);
  }
  return result.replace(/\s{2,}/g,' ').trim();
}
