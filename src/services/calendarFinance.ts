import {financialDisplay,financePerson} from './financeRules';
import type {SearchResultRow} from '@/types/anfeta';
export function financeRowsForDay(rows:SearchResultRow[],day:string) {
  const dayStart=Date.parse(day+'T00:00:00-06:00'),dayEnd=dayStart+86400000;
  return rows.flatMap(row=>{
    if(row.source!=='Notion' || !/cobrar|pagar|cobro|pago/i.test(row.externalSourceName || row.sourceName || ''))return [];
    const title=row.displayName || row.name;
    const stripBase=(value:string)=>value.replace(/^\s*\[(?:Cobrar y pagar|Notion)\]\s*/i,'');const classification=stripBase(row.displayName||'')+' '+stripBase(row.name);
    const kinds=('cobro,pago'.split(',') as ('cobro'|'pago')[]).filter(kind=>(kind==='cobro'?/(?:^|[^\p{L}])(?:a?prtuz|sprtuz|rtuz|z)?cobr(?:ar|o|os)?(?!\p{L})/iu:/(?:^|[^\p{L}])(?:a?prtuz|sprtuz|rtuz|z)?pag(?:ar|o|os)?(?!\p{L})/iu).test(classification));
    if(!kinds.length || !row.scheduledDate)return [];
    const [rawStart,rawEnd]=row.scheduledDate.split(' - ');
    const parse=(raw:string)=>Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+'T08:00:00-06:00':/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)?raw:raw.replace(' ','T')+'-06:00');
    const start=parse(rawStart.trim());let end=rawEnd?parse(rawEnd.trim()):start+3600000;
    if(!Number.isFinite(start))return [];if(!Number.isFinite(end)||end<=start)end=start+3600000;
    if(start>=dayEnd || end<=dayStart)return [];
    return kinds.map(kind=>({id:row.externalId || row.id,title,kind,...financialDisplay(title,row.projectUpdateStatus||row.updateStatus||'',kind,row.description||''),person:financePerson(classification),url:row.externalUrl || row.url || '',start:new Date(start).toISOString(),end:new Date(end).toISOString()}));
  }).filter((item,index,all)=>all.findIndex(other=>other.id===item.id && other.kind===item.kind)===index).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}
