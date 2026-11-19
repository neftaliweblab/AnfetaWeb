import {hasIndexedContentMatch,type SearchMatchOptions} from '@/services/advancedQuery';
import {getSearchTermColorMap,makeAccentRegexPattern} from '@/lib/multiSearchHighlight';
import {matchesActivityTagQuery,resultAssignedPerson} from '@/services/activityTags';

/** Outside the truncated title: the matching tag and owner remain readable. */
export function ResultIdentityBadges({item,query,searchOptions,scale=1}:{item:any;query:string;searchOptions?:SearchMatchOptions;scale?:number}){
 const title=String(item.name||item.title||''),{terms,termColorMap}=getSearchTermColorMap(query);
 const matches=terms.filter(term=>{
  const structured=matchesActivityTagQuery(title,term,false,'',item);
  if(structured!==undefined)return structured;
  return new RegExp(makeAccentRegexPattern(term),'i').test(title);
 });
 const notion=item.source==='Notion'||item.sourceName==='Notion';
 const declared=item.assignedPerson||item.AssignedPerson||item.person||'';
 const person=notion?(/^sin asignar$/i.test(declared)?'Sin asignar':resultAssignedPerson(item)||declared):'';
 const contentMatch=hasIndexedContentMatch(item,query,searchOptions);
 const isNonStandardTitle = (() => {
  if (!notion) return false;
  const clean = title.replace(/^\[[^\]]+\]\s*/, '').trim();
  if (!clean) return false;
  if (/(?:prtu\.\s*r|sprtu\s*z|saprtuz|dominio\s+dominio|aprtuda\s+dominio)/i.test(clean)) return true;
  const src = String(item.sourceName || item.externalSourceName || '').toLowerCase();
  if (src.includes('revision')) {
    const hasPrtuz = /^(?:saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|pprtuz|rtuz|tuz|uz|z[rsdcp]?|zrevision|prtu)/i.test(clean);
    const hasStructure = clean.includes('|') || clean.includes('[') || clean.includes(']') || /(?:^|\s)[01pd]\.(?=[a-z0-9-]+\.)/i.test(clean);
    if (!hasPrtuz || !hasStructure) return true;
  }
  return false;
 })();

 if(!matches.length&&!notion&&!contentMatch&&!isNonStandardTitle)return null;
 return <span style={{fontSize:`${Math.max(9.5, 10.5 * scale).toFixed(1)}px`}} className="inline-flex min-w-0 w-full items-center justify-end gap-1 leading-none max-w-full" aria-label="Coincidencias y responsable">
  <span className="inline-flex min-w-0 items-center gap-1 overflow-hidden" title={matches.join(" · ")}>
  {isNonStandardTitle&&<span title="El nombre no sigue la estructura oficial (prtuzR | tipo | fecha | dominio...)" className="rounded border border-amber-600/70 bg-amber-950/70 px-1 py-0.5 font-semibold text-amber-300 font-mono">⚠️ Formato</span>}
  {contentMatch&&<span title="Coincidencia en el texto indexado" className="rounded border border-cyan-700 bg-cyan-950 px-1.5 py-0.5 font-semibold text-cyan-200">En contenido</span>}
  {matches.map(term=><span key={term} title={'Coincide con la búsqueda: '+term} className={(termColorMap.get(term.toLowerCase())?.badge||'text-cyan-300')+' !mx-0 break-all rounded px-1 py-0.5'}>{term}</span>)}
  </span>
  {notion&&<span title={'Asignado: '+(person||'Sin asignar')} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-700/80 bg-[#16202c] px-1.5 py-0.5 text-slate-200 max-w-full">
    <svg style={{width:`${Math.round(11 * scale)}px`,height:`${Math.round(11 * scale)}px`}} className="text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
    <span className="truncate max-w-[115px] font-medium">{person||'Sin asignar'}</span>
  </span>}
 </span>;
}
