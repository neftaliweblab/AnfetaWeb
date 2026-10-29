/** Limit read-only detail requests; queued work is cancelled when its panel closes. */
export function createActivityDetailQueue(limit=2){
 let active=0;
 const pending:{start:()=>void;cancel:()=>void}[]=[];
 const drain=()=>{while(active<limit&&pending.length)pending.shift()!.start();};
 return function run<T>(task:()=>Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise((resolve,reject)=>{
   if(signal.aborted){reject(signal.reason);return;}
   const job={start:()=>{signal.removeEventListener('abort',job.cancel);if(signal.aborted){reject(signal.reason);drain();return;}active++;Promise.resolve().then(()=>{signal.throwIfAborted();return task();}).then(resolve,reject).finally(()=>{active--;drain();});},cancel:()=>{const i=pending.indexOf(job);if(i>=0){pending.splice(i,1);reject(signal.reason);}}};
   signal.addEventListener('abort',job.cancel,{once:true});pending.push(job);drain();
  });
 };
}
export const runActivityDetailRequest=createActivityDetailQueue(2);
