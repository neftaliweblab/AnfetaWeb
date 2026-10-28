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
 return <span className="inline-flex shrink-0 items-center gap-1 text-[9px] leading-none" aria-label="Coincidencias y responsable">
  {matches.map(term=><span key={term} title={'Coincide con la búsqueda: '+term} className={(termColorMap.get(term.toLowerCase())?.badge||'text-cyan-300')+' !mx-0 break-all rounded px-1 py-0.5'}>{term}</span>)}
  {notion&&<span title={'Asignado: '+(person||'Sin asignar')} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-700/80 bg-[#16202c] px-1.5 py-0.5 text-slate-200">
    <svg className="h-2.5 w-2.5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
    <span className="truncate max-w-[85px] font-medium">{person||'Sin asignar'}</span>
  </span>}
 </span>;
}
