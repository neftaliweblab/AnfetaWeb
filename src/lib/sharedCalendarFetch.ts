const readStarts=new Map<string,number>();
export function calendarReadBoundary(response:Response,meta:any,fallback=Date.now()){const start=Number(response.headers.get('x-anfeta-read-start'))||fallback,cached=Date.parse(meta?.updatedAt||'');return Number.isFinite(cached)?Math.min(start,cached):start;}
const inFlight=new Map<string,Promise<Response>>();
/** Share simultaneous reads of the same day/account; a cancelled consumer cannot cancel another. */
export async function sharedCalendarFetch(url:string,owner:string,init:RequestInit={}){
  const headers=new Headers(init.headers);
  if(!headers.has('x-notion-token')&&typeof localStorage!=='undefined')try{const token=JSON.parse(localStorage.getItem('anfeta_settings')||'{}').notionToken;if(token)headers.set('x-notion-token',token);}catch{}
  const key=owner+':'+url+':'+(headers.get('x-notion-token')||'');
  init.signal?.throwIfAborted();
  let request=inFlight.get(key);
  if(!request){
    readStarts.set(key,Date.now());
    request=fetch(url,{...init,headers,signal:AbortSignal.timeout(60000)});inFlight.set(key,request);
    const remove=()=>{if(inFlight.get(key)===request){inFlight.delete(key);readStarts.delete(key);}};request.then(remove,remove);
  }
  const startedAt=readStarts.get(key)||Date.now();
  const copy=(response:Response)=>{const clone=response.clone(),headers=new Headers(clone.headers);headers.set('x-anfeta-read-start',String(startedAt));return new Response(clone.body,{status:clone.status,statusText:clone.statusText,headers});};
  if(!init.signal)return copy(await request);
  const signal=init.signal;
  return new Promise<Response>((resolve,reject)=>{
    const cancel=()=>reject(signal.reason);signal.addEventListener('abort',cancel,{once:true});
    request!.then(response=>{signal.removeEventListener('abort',cancel);if(!signal.aborted)resolve(copy(response));},error=>{signal.removeEventListener('abort',cancel);reject(error);});
  });
}
