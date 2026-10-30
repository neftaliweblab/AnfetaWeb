import {readApiJson} from './readApiJson';
export async function loadSearchIndex(options:{signal?:AbortSignal;fresh?:boolean;knownVersion?:string;onPartial?:(data:any)=>void;token?:string}={}){
 let token=options.token;if(!token&&typeof window!=='undefined')try{token=JSON.parse(localStorage.getItem('anfeta_settings')||'{}').notionToken;}catch{}
 const deadline=Date.now()+120000;
 const fetchPage=async(offset:number,version?:string,attempt=0,first?:any)=>{
  const remaining=deadline-Date.now();if(remaining<=0)throw new Error('La carga del catálogo tardó demasiado. Los resultados recibidos se conservan; intenta actualizar de nuevo.');
  const params=new URLSearchParams({type:'search-index',offset:String(offset),limit:'500'});
  if(version)params.set('indexVersion',version);if(offset>0&&first?.cacheMeta?.source!=='supabase')params.set('indexOrigin','local');
  if(offset===0&&options.fresh&&attempt===0)params.set('fresh','1');if(offset===0&&options.knownVersion&&!options.fresh)params.set('ifVersion',options.knownVersion);
  const timeout=AbortSignal.timeout(Math.min(60000,remaining)),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
  let response:Response;try{response=await fetch('/api/data?'+params,{signal,headers:token?{'x-notion-token':token}:{},cache:'no-store'});}catch(error){if(options.signal?.aborted)throw error;if(timeout.aborted){if(attempt<2){await new Promise(r=>setTimeout(r,1000*(attempt+1)));return fetchPage(offset,version,attempt+1,first);}throw new Error('El servidor tardó demasiado en entregar una página del catálogo. Los resultados recibidos se conservan.');}throw error;}if((response.status===504||response.status===502)&&attempt<2){await new Promise(r=>setTimeout(r,1000*(attempt+1)));return fetchPage(offset,version,attempt+1,first);}
  if(response.status===409)return {code:'index_version_changed'};return readApiJson(response);
 };
 for(let attempt=0;attempt<3;attempt++){
  let offset=0,version:string|undefined,first:any,items:any[]=[];const seen=new Set<number>();let restart=false;
  do{
   if(seen.has(offset))throw new Error('La paginación del índice no pudo completarse.');seen.add(offset);
   const data=await fetchPage(offset,version,attempt,first);if(data.code==='index_version_changed'){restart=true;break;}
   if(data.unchanged){if(offset!==0)throw new Error('La paginación del índice no pudo completarse.');return data;}
   if(!Array.isArray(data.items)||!data.indexVersion)throw new Error('El servidor no entregó una página válida del índice.');
   if(version&&data.indexVersion!==version){restart=true;break;}if(!first){first=data;version=data.indexVersion;}
   items.push(...data.items);if(items.length>100000)throw new Error('El catálogo supera el límite de carga; los resultados recibidos se conservan.');
   const next=data.nextOffset??null;options.onPartial?.({...first,items:[...items],loadingIndex:next!==null});
   if(next===null)return {...first,items,total:data.total??items.length,indexVersion:version,nextOffset:null};
   if(!Number.isSafeInteger(next)||next<=offset||next!==offset+(data.scannedCount??data.items.length))throw new Error('La paginación del índice no pudo completarse.');
   offset=next;
  }while(true);
  if(!restart)break;
 }
 throw new Error('El índice está cambiando. Intenta actualizar de nuevo en unos segundos.');
}
