const inFlight=new Map<string,Promise<Response>>();
/** Share simultaneous reads of the same day/account; a cancelled consumer cannot cancel another. */
export async function sharedCalendarFetch(url:string,owner:string,init:RequestInit={}){
  const headers=new Headers(init.headers);
  if(!headers.has('x-notion-token')&&typeof localStorage!=='undefined')try{const token=JSON.parse(localStorage.getItem('anfeta_settings')||'{}').notionToken;if(token)headers.set('x-notion-token',token);}catch{}
  const key=owner+':'+url+':'+(headers.get('x-notion-token')||'');
  init.signal?.throwIfAborted();
  let request=inFlight.get(key);
  if(!request){
    request=fetch(url,{...init,headers,signal:AbortSignal.timeout(60000)});inFlight.set(key,request);
    const remove=()=>{if(inFlight.get(key)===request)inFlight.delete(key);};request.then(remove,remove);
  }
  if(!init.signal)return (await request).clone();
  const signal=init.signal;
  return new Promise<Response>((resolve,reject)=>{
    const cancel=()=>reject(signal.reason);signal.addEventListener('abort',cancel,{once:true});
    request!.then(response=>{signal.removeEventListener('abort',cancel);if(!signal.aborted)resolve(response.clone());},error=>{signal.removeEventListener('abort',cancel);reject(error);});
  });
}
