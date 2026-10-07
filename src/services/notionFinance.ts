import {ANFETA_BASES} from './notionIndexParity';
import {notionRequest} from './notionMutations';
import {financeRowsForDay} from './calendarFinance';
import {assignedPerson,CalendarSettings} from './notionCalendar';
import type {SearchResultRow} from '@/types/anfeta';

const requests=new Map<string,{expires:number;promise:Promise<ReturnType<typeof financeRowsForDay>>}>();
export function loadLiveFinance(settings:CalendarSettings,rows:SearchResultRow[],day:string) {
  const key=settings.notionToken+':'+(process.env.NOTION_FINANCE_DATA_SOURCE_ID||'default')+':'+day;const cached=requests.get(key);if(cached && cached.expires>Date.now())return cached.promise;
  const promise=load(settings,rows,day).catch(error=>{requests.delete(key);throw error;});if(requests.size>=128)requests.delete(requests.keys().next().value!);requests.set(key,{expires:Date.now()+30000,promise});return promise;
}
async function load(settings:CalendarSettings,rows:SearchResultRow[],day:string) {
  const modern={...settings,notionApiVersion:'2026-03-11'};
  const ids=[process.env.NOTION_FINANCE_DATA_SOURCE_ID?.trim()||ANFETA_BASES.find(([name])=>name==='Cobrar y pagar')![1]];
  const live:SearchResultRow[]=[];
  for(const id of ids){
    const schema=await notionRequest(modern,'data_sources/'+id);
    const dates=Object.entries(schema.properties || {}).filter(([,p]:any)=>p.type==='date');
    const date=dates.find(([name])=>/^fecha por hacer$/i.test(name.trim())) || dates.find(([name])=>/program|cobr|pag|venc/i.test(name)) || (dates.length===1?dates[0]:undefined);
    if(!date)throw new Error('La fuente financiera no tiene una fecha programada identificable.');
    let cursor:string|undefined;const seen=new Set<string>();
    do {
      const data=await notionRequest(modern,'data_sources/'+id+'/query','POST',{page_size:100,...(cursor?{start_cursor:cursor}:{}),filter:{property:date[0],date:{on_or_before:day+'T23:59:59-06:00'}}});
      for(const page of data.results || []){if(page.archived || page.in_trash)continue;const d=page.properties?.[date[0]]?.date;if(!d?.start)continue;
        const title=Object.values(page.properties || {}).filter((p:any)=>p.type==='title').flatMap((p:any)=>p.title || []).map((t:any)=>t.plain_text || t.text?.content || '').join('');
        live.push({id:page.id,externalId:page.id,externalUrl:page.url,name:title,source:'Notion',sourceName:'Cobrar y pagar',scheduledDate:d.start+(d.end?' - '+d.end:''),assignedPerson:assignedPerson(page)} as SearchResultRow);
      }
      if(data.has_more && (!data.next_cursor || seen.has(data.next_cursor)))throw new Error('Paginación financiera incompleta.');cursor=data.has_more?data.next_cursor:undefined;if(cursor)seen.add(cursor);
    }while(cursor);
  }
  return financeRowsForDay(live,day);
}
