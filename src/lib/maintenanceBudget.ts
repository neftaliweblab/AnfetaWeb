const runs=new Map<string,{running:boolean;nextAt:number}>();
/** Share background maintenance across users without blocking interactive reads. */
export async function runMaintenanceOnce(key:string,task:()=>Promise<unknown>,cooldownMs=15*60*1000):Promise<boolean>{
  const now=Date.now(),previous=runs.get(key);
  if(previous&&(previous.running||previous.nextAt>now))return false;
  if(!previous&&runs.size>=64){const old=[...runs].find(([,value])=>!value.running);if(!old)return false;runs.delete(old[0]);}
  const entry={running:true,nextAt:0};runs.set(key,entry);
  try{await task();entry.nextAt=Date.now()+cooldownMs;return true;}
  catch(error){entry.nextAt=Date.now()+Math.min(cooldownMs,60000);throw error;}
  finally{entry.running=false;}
}
