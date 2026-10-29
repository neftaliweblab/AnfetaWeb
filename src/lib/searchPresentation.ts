import {newestFirst} from './searchResultOrder';

export const SEARCH_SORTS = [
  ['scheduled-today', 'Hoy primero · horario 08:00 → 22:00'],
  ['scheduled-asc', 'Fecha por hacer · Ayer → Mañana'],
  ['scheduled-desc', 'Fecha por hacer · Mañana → Ayer'],
  ['modified-desc', 'Última modificación · más reciente primero'],
  ['modified-asc', 'Última modificación · editadas hace más tiempo'],
  ['name-asc', 'Título · A–Z'],
  ['name-desc', 'Título · Z–A'],
  ['default', 'Orden habitual del índice'],
] as const;
export const SEARCH_SORT_DESCRIPTIONS:Record<string,string>={
 'scheduled-today':'Primero las actividades de hoy, de la hora más temprana a la más tarde. Después las vencidas y las próximas; sin fecha al final.',
 'scheduled-asc':'Primero los días anteriores. Dentro de cada día, horario de menor a mayor: 08:00 → 22:00.',
 'scheduled-desc':'Primero los días posteriores. Dentro de cada día, horario de menor a mayor: 08:00 → 22:00.',
 'modified-desc':'Ordena por cambios en la página de Notion, no por su horario de trabajo.',
 'modified-asc':'Muestra primero las páginas que llevan más tiempo sin editarse.',
 'name-asc':'Orden alfabético por título.', 'name-desc':'Orden alfabético inverso por título.',
 'default':'Conserva la prioridad habitual de fuentes y fechas del índice.',
};
export function parseSearchDate(raw:any):number|null {
 if(raw===null||raw===undefined||raw==='')return null;
 if(typeof raw==='number')return Number.isFinite(raw)?raw:null;
 const str=String(raw).trim();if(!str||str==='—'||str==='-')return null;
 const iso=str.match(/(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?)?/);
 if(iso){const value=Date.parse(iso[1]+'T'+(iso[2]||'00:00:00')+(iso[3]||'-06:00'));return Number.isFinite(value)?value:null;}
 const latin=str.match(/(?:^|\s)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
 if(latin){const rest=str.slice(latin.index!+latin[0].length),clock=rest.match(/(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s*m\.?)?/i);let hour=clock?Number(clock[1]):0;if(clock?.[3])hour=hour%12+(clock[3].toLowerCase()==='p'?12:0);const value=Date.parse(latin[3]+'-'+latin[2].padStart(2,'0')+'-'+latin[1].padStart(2,'0')+'T'+String(hour).padStart(2,'0')+':'+(clock?.[2]||'00')+':00-06:00');return Number.isFinite(value)?value:null;}
 const value=Date.parse(str);return Number.isFinite(value)?value:null;
}
export function searchRowDate(r:any,field:'scheduled'|'modified'):number|null {
 if(!r)return null;
 return parseSearchDate(field==='scheduled'?(r.scheduledDate||r.ScheduledDate||r.dateStart||r.start||r.Start||r.currentScheduledDate):(r.serverModified||r.ServerModified||r.modifiedLocalDate||r.ModifiedLocalDate||r.lastEdited||r.last_edited_time));
}
export const searchMexicoDay=(date:number|Date)=>new Date(Number(date)-21600000).toISOString().slice(0,10);
export function isFutureScheduled(row:any,now=new Date()){const value=searchRowDate(row,'scheduled');return value!==null&&searchMexicoDay(value)>searchMexicoDay(now);}
const names=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
const nameCompare=(a:any,b:any)=>names.compare(String(a.name||a.Name||''),String(b.name||b.Name||''));
function compareDates(left:number|null,right:number|null,sort:string,today:string){
 if(left===null||right===null)return left===right?0:left===null?1:-1;
 if(sort==='scheduled-desc'){const a=searchMexicoDay(left),b=searchMexicoDay(right);return a===b?left-right:b.localeCompare(a);}
 if(sort==='scheduled-today'){
  const a=searchMexicoDay(left),b=searchMexicoDay(right),rank=(day:string)=>day===today?0:day<today?1:2;
  const diff=rank(a)-rank(b);if(diff)return diff;
 }
 return (sort.endsWith('-desc')?-1:1)*(left-right);
}
export function compareSearchRows(a:any,b:any,sort:string,now=new Date()){
 if(sort==='default')return newestFirst(a,b);
 if(sort.startsWith('name-'))return (sort.endsWith('-desc')?-1:1)*nameCompare(a,b);
 const field=sort.startsWith('scheduled-')?'scheduled':'modified';
 return compareDates(searchRowDate(a,field),searchRowDate(b,field),sort,searchMexicoDay(now))||nameCompare(a,b);
}
/** Parse dates once per row; avoid repeated parsing throughout n log n comparisons. */
export function sortSearchRows<T>(items:readonly T[],sort:string,now=new Date()):T[]{
 if(sort==='default'||sort.startsWith('name-'))return [...items].sort((a,b)=>compareSearchRows(a,b,sort,now));
 const field=sort.startsWith('scheduled-')?'scheduled':'modified',today=searchMexicoDay(now);
 return items.map(item=>({item,date:searchRowDate(item,field)})).sort((a,b)=>compareDates(a.date,b.date,sort,today)||nameCompare(a.item,b.item)).map(row=>row.item);
}

export function lastSearchTerm(query: string) {
  const tokens = query.match(/"[^"]+"|\S+/g) || [];
  let last = '', negate = false;
  for (const token of tokens) {
    if (/^(NOT|!)$/i.test(token)) {
      negate = true;
      continue;
    }
    if (/^(AND|OR|&&|\|\||[()])$/i.test(token)) continue;
    if (!negate && !/^[-!]|^[a-z]+:/i.test(token)) last = token.replace(/^["(]+|[)"]+$/g, '');
    negate = false;
  }
  return last;
}
