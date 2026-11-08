import {readApiJson} from './readApiJson';
let epoch=0, listening=false;
let cached:{etag:string;state:any}|undefined;
let pending:{epoch:number;controller:AbortController;promise:Promise<any>}|undefined;
function invalidate(){epoch++;cached=undefined;pending?.controller.abort();pending=undefined;}
function listen(){if(listening||typeof window==='undefined')return;listening=true;
 window.addEventListener('anfeta_auth_changed',invalidate);
 window.addEventListener('anfeta_preferences_changed',invalidate);
 window.addEventListener('storage',event=>{if(event.key===null||event.key==='anfeta_preferences_changed')invalidate();});
}
/** Concurrent controls share a request; each later read still verifies the server revision. */
export async function loadAccountPreferences(){
 listen();
 if(pending?.epoch===epoch)return structuredClone(await pending.promise);
 const generation=epoch,previous=cached,controller=new AbortController();
 const promise=(async()=>{
  try{
   const response=await fetch('/api/workspace',{cache:'no-store',signal:controller.signal,headers:previous?{'If-None-Match':previous.etag}:{}});
   let state:any;
   if(response.status===304){if(!previous)throw Error('No hay copia confirmada de las preferencias.');state=previous.state;}
   else state=await readApiJson(response);
   if(generation!==epoch)throw Error('La sesión o las preferencias cambiaron durante la consulta.');
   const etag=response.headers.get('etag');cached=etag?{etag,state:structuredClone(state)}:undefined;
   return state;
  }catch(error){if(generation===epoch)cached=undefined;throw error;}
  finally{if(pending?.epoch===generation)pending=undefined;}
 })();
 pending={epoch:generation,controller,promise};
 return structuredClone(await promise);
}
export async function saveAccountPreferences(patch:Record<string,any>,expectedRevision?:number){listen();invalidate();try{return await readApiJson(await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patch,expectedRevision})}));}finally{invalidate();}}
