import {getSearchTermColorMap,makeAccentRegexPattern} from '@/lib/multiSearchHighlight';
import {matchesActivityTagQuery,resultAssignedPerson} from '@/services/activityTags';

/** Outside the truncated title: the matching tag and owner remain readable. */
export function ResultIdentityBadges({item,query}:{item:any;query:string}){
 const title=String(item.name||item.title||''),{terms,termColorMap}=getSearchTermColorMap(query);
 const matches=terms.filter(term=>{
  const structured=matchesActivityTagQuery(title,term);
  if(structured!==undefined)return structured;
  return new RegExp(makeAccentRegexPattern(term),'i').test(title);
 });
 const notion=item.source==='Notion'||item.sourceName==='Notion';
 const declared=item.assignedPerson||item.AssignedPerson||item.person||'';
 const person=notion?(/^sin asignar$/i.test(declared)?'Sin asignar':resultAssignedPerson(item)||declared):'';
 if(!matches.length&&!notion)return null;
 return <span className="flex min-w-0 flex-wrap items-center gap-1 text-[9px] leading-4" aria-label="Coincidencias y responsable">
  {matches.map(term=><span key={term} title={'Coincide con la búsqueda: '+term} className={(termColorMap.get(term.toLowerCase())?.badge||'text-cyan-300')+' !mx-0 break-all'}>{term}</span>)}
  {notion&&<span title={'Asignado: '+(person||'Sin asignar')} className="rounded border border-slate-600 bg-slate-800 px-1 text-slate-200">Asignado: {person||'Sin asignar'}</span>}
 </span>;
}
