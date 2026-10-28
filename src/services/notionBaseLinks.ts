import {ANFETA_BASES} from '@/lib/notionBaseCatalog';
import {notionRequest} from './notionMutations';
const cache=new Map<string,{at:number;report:any}>();
export async function notionBaseLinks(settings:any){
 const cached=cache.get(settings.notionToken);if(cached&&Date.now()-cached.at<300000)return cached.report;
 const items:{id:string;name:string;url:string}[]=[],warnings:string[]=[];
 const add=(source:any,name:string)=>{const databaseId=source.object==='database'?source.id:source.parent?.database_id;if(!databaseId){warnings.push(name+': no se pudo identificar la base original.');return;}if(!items.some(x=>x.id===databaseId))items.push({id:databaseId,name:'BDz '+name,url:'https://www.notion.so/'+databaseId.replace(/-/g,'')});};
 for(const [name,id] of ANFETA_BASES){try{let source;try{source=await notionRequest(settings,'data_sources/'+id);}catch{source=await notionRequest(settings,'databases/'+id);}add(source,name);}catch{warnings.push(name+': la integración no pudo consultar esta base.');}}
 try{const response=await notionRequest({...settings,notionApiVersion:'2026-03-11'},'search','POST',{query:'SALDO',filter:{value:'data_source',property:'object'},page_size:30});if(!response.results?.length)warnings.push('Saldo ADS: no aparece entre las bases accesibles para la integración.');for(const source of response.results||[]){const title=(source.title||[]).map((t:any)=>t.plain_text||t.text?.content||'').join('');if(/saldo/i.test(title))add(source,title);}}catch{warnings.push('Saldo ADS: no se pudo confirmar el enlace con la integración.');}
 const report={items,warnings};if(cache.size>=8)cache.delete(cache.keys().next().value!);cache.set(settings.notionToken,{at:Date.now(),report});return report;
}
