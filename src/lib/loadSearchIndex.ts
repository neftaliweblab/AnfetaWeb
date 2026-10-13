import {readApiJson} from './readApiJson';

export async function loadSearchIndex(options:{signal?:AbortSignal;fresh?:boolean;knownVersion?:string;onPartial?:(data:any)=>void;token?:string}={}){
  let token=options.token;
  if(!token&&typeof window!=='undefined'){
    try{
      const s=localStorage.getItem('anfeta_settings');
      if(s){
        const parsed=JSON.parse(s);
        if(parsed.notionToken)token=parsed.notionToken;
      }
    }catch{}
  }

  const fetchOffset = async (offset: number, version?: string, attempt = 0, first?: any) => {
    const params=new URLSearchParams({type:'search-index',offset:String(offset),limit:'500'});
    if(token)params.set('token',token);
    if(version)params.set('indexVersion',version);
    if(offset>0&&first?.cacheMeta?.source!=='supabase')params.set('indexOrigin','local');
    if(offset===0&&options.fresh&&attempt===0)params.set('fresh','1');
    if(offset===0&&options.knownVersion&&!options.fresh)params.set('ifVersion',options.knownVersion);
    const headers:Record<string,string>={};
    if(token)headers['x-notion-token']=token;
    const response=await fetch('/api/data?'+params,{signal:options.signal,headers,cache:'no-store'});
    const data=await readApiJson(response).catch(error=>{
      if(response.status===409)return {code:'index_version_changed'};
      throw error;
    });
    return data;
  };

  for(let attempt=0;attempt<3;attempt++){
    let offset=0,version:string|undefined,items:any[]=[],first:any;
    const seen=new Set<number>();
    let restart=false;

    // Fetch first page
    if(seen.has(offset))throw new Error('La paginación del índice no pudo completarse.');
    seen.add(offset);
    const data0 = await fetchOffset(0, undefined, attempt);
    if(data0.code==='index_version_changed'){restart=true;continue;}
    if(data0.unchanged)return data0;
    if(!Array.isArray(data0.items)||!data0.indexVersion)throw new Error('El servidor no entregó una página válida del índice.');
    first=data0;
    version=data0.indexVersion;
    items.push(...data0.items);
    options.onPartial?.({...first,items:[...items],loadingIndex:data0.nextOffset!==null});
    if(data0.nextOffset===null||data0.nextOffset===undefined){
      return {...first,items,total:data0.total,indexVersion:version,nextOffset:null};
    }
    if(!Number.isSafeInteger(data0.nextOffset)||data0.nextOffset<=0){
      throw new Error('La paginación del índice no pudo completarse.');
    }

    // Fast path: if total is large and known (>500), fetch remaining offsets in parallel batches
    if(typeof data0.total==='number'&&data0.total>500&&data0.nextOffset===500){
      const remaining:number[]=[];
      for(let o=500;o<data0.total;o+=500){remaining.push(o);}
      const BATCH_SIZE=4;
      for(let i=0;i<remaining.length;i+=BATCH_SIZE){
        const chunk=remaining.slice(i,i+BATCH_SIZE);
        for(const off of chunk){
          if(seen.has(off)){restart=true;break;}
          seen.add(off);
        }
        if(restart)break;
        const results=await Promise.all(chunk.map(off=>fetchOffset(off,version,attempt,first)));
        for(const res of results){
          if(res.code==='index_version_changed'||res.indexVersion!==version){
            restart=true;break;
          }
          if(!Array.isArray(res.items)){
            throw new Error('El servidor no entregó una página válida del índice.');
          }
          items.push(...res.items);
        }
        if(restart)break;
        options.onPartial?.({...first,items:[...items],loadingIndex:i+BATCH_SIZE<remaining.length});
      }
      if(!restart){
        return {...first,items,total:data0.total,indexVersion:version,nextOffset:null};
      }
    } else {
      // Sequential fallback for small or variable pagination (e.g. tests or dynamic cursor)
      offset=data0.nextOffset;
      do{
        if(seen.has(offset))throw new Error('La paginación del índice no pudo completarse.');
        seen.add(offset);
        const nextData=await fetchOffset(offset,version,attempt,first);
        if(nextData.code==='index_version_changed'){restart=true;break;}
        if(!Array.isArray(nextData.items)||!nextData.indexVersion)throw new Error('El servidor no entregó una página válida del índice.');
        items.push(...nextData.items);
        options.onPartial?.({...first,items:[...items],loadingIndex:nextData.nextOffset!==null});
        if(nextData.nextOffset===null||nextData.nextOffset===undefined)return {...first,items,total:nextData.total,indexVersion:version,nextOffset:null};
        if(!Number.isSafeInteger(nextData.nextOffset)||nextData.nextOffset<=offset)throw new Error('La paginación del índice no pudo completarse.');
        offset=nextData.nextOffset;
      }while(true);
    }

    if(!restart)break;
  }
  throw new Error('El índice está cambiando. Intenta actualizar de nuevo en unos segundos.');
}
