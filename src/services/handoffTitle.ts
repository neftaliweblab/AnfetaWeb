import {PERSON_ALIASES,normalizePerson} from './identityNormalizer';
import {activePersonTag,scanActivityTags} from './activityTags';
export function handoffTitle(title:string,from:string,to:string){
 const current=scanActivityTags(title).filter(tag=>!tag.legacy&&tag.role==='active'&&tag.person===normalizePerson(from));
 if(current.length){
   let result=title;
   for(const tag of current.reverse())result=result.slice(0,tag.index)+activePersonTag(to,tag.priority)+result.slice(tag.index+tag.token.length);
   return result;
 }
 const aliases=PERSON_ALIASES[normalizePerson(from)]||[],target=PERSON_ALIASES[normalizePerson(to)]?.[0];
 if(!target)throw Error('El responsable no tiene una etiqueta configurada.');
 const pattern=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+aliases.join('|')+')(?<suffix>\\d*)(?![\\p{L}\\p{N}_])','giu');
 const matches=[...title.matchAll(pattern)];
 // Prefer the canonical assignment tag; otherwise replace the last short owner tag,
 // preserving unrelated collaborator/reviewer tags, month, domain and description.
 const match=matches.find(m=>/^(.)\1/.test(m[0]))||matches.at(-1);
 if(match&&match.index!==undefined)return title.slice(0,match.index)+target+(match.groups?.suffix||'')+title.slice(match.index+match[0].length);
 const phase=title.match(/^(?:sprtuzREVISION|prtuzREVISION)\s+/i);
 const active=activePersonTag(to);
 return phase?phase[0]+active+' '+title.slice(phase[0].length):active+' '+title;
}
