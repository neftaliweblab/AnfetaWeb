export type LogLevel='warning'|'error';
export type AppLog={id:string;source:string;message:string;level:LogLevel;firstAt:string;lastAt:string;count:number;read:boolean};
const EMPTY:AppLog[]=[],stores=new Map<string,AppLog[]>(),listeners=new Map<string,Set<()=>void>>();
const key=(owner:string)=>'anfeta-diagnostics-v1:'+owner;
export function sanitizeDiagnostic(value:string){return String(value).replace(/Bearer\s+[\w.\-]+/gi,'Bearer [oculto]').replace(/((?:access_token|refresh_token|api[_-]?key|token|secret|password|contraseña)\s*[=:]\s*)[^\s&,;]+/gi,'$1[oculto]').replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[sesión oculta]').replace(/\b(?:ntn_|secret_|sk-)[A-Za-z0-9_\-]+/g,'[credencial oculta]').slice(0,2400);}
export function getAppLogs(owner:string):AppLog[]{
 if(typeof window==='undefined'||!owner)return EMPTY;
 if(!stores.has(owner)){
  let entries:AppLog[]=[];
  try{const saved=JSON.parse(sessionStorage.getItem(key(owner))||'[]');if(Array.isArray(saved))entries=saved.filter(e=>e&&typeof e.id==='string'&&typeof e.message==='string'&&typeof e.source==='string'&&Number.isFinite(Date.parse(e.lastAt))).slice(0,80).map(e=>({...e,message:sanitizeDiagnostic(e.message),source:sanitizeDiagnostic(e.source),count:Number.isSafeInteger(e.count)?e.count:1}));}catch{}
  stores.set(owner,entries);
 }
 return stores.get(owner)!;
}
export function serverAppLogs(){return EMPTY;}
function publish(owner:string,entries:AppLog[]){stores.set(owner,entries);try{sessionStorage.setItem(key(owner),JSON.stringify(entries));}catch{}listeners.get(owner)?.forEach(fn=>fn());}
export function subscribeAppLogs(owner:string,fn:()=>void){if(!listeners.has(owner))listeners.set(owner,new Set());listeners.get(owner)!.add(fn);return()=>{listeners.get(owner)?.delete(fn);};}
export function recordAppLog(owner:string,source:string,message:string,level:LogLevel='warning'){
 if(typeof window==='undefined'||!owner||!message.trim())return;
 const entries=[...getAppLogs(owner)],clean=sanitizeDiagnostic(message.trim()),label=sanitizeDiagnostic(source),now=new Date().toISOString();
 const index=entries.findIndex(e=>e.message===clean&&e.source===label&&e.level===level&&Date.now()-Date.parse(e.lastAt)<60000);
 const old=index>=0?entries.splice(index,1)[0]:null;
 entries.unshift(old?{...old,lastAt:now,count:old.count+1,read:false}:{id:crypto.randomUUID(),source:label,message:clean,level,firstAt:now,lastAt:now,count:1,read:false});
 publish(owner,entries.slice(0,80));
}
export function markAppLogsRead(owner:string){const entries=getAppLogs(owner);if(entries.some(e=>!e.read))publish(owner,entries.map(e=>({...e,read:true})));}
export function clearAppLogs(owner:string){publish(owner,[]);}
export function diagnosticAdvice(message:string){
 const value=message.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 if(/no hay espacio|no cabe|empalm|entre 08:00 y 22:00/.test(value))return {title:'No hay espacio en la jornada',cause:'La duración de la actividad o los horarios ocupados impiden acomodarla entre 08:00 y 22:00.',next:'Revisa el calendario y elige otro día, un hueco libre o una duración adecuada. Recargar no libera horarios.'};
 if(/actividad se guardo|horario se guardo|casilla se guardo/.test(value))return {title:'Guardado con aviso pendiente',cause:'El cambio principal se guardó, pero una operación complementaria no se pudo confirmar.',next:'No repitas el cambio guardado. Revisa el aviso pendiente y comparte este registro si continúa.'};
 if(/no confirmo|no se confirmo|parte del cambio|no confirmado|guardado a tiempo/.test(value))return {title:'Guardado sin confirmar',cause:'La respuesta pudo interrumpirse después de enviar el cambio.',next:'Consulta primero el estado actual de la actividad en ANFETA o Notion antes de repetir la acción, para evitar duplicados.'};
 if(/429|rate.limit|demasiadas solicitudes/.test(value))return {title:'Servicio ocupado',cause:'El servicio está limitando temporalmente las solicitudes.',next:'Espera unos momentos y vuelve a intentar una sola vez. Evita pulsar repetidamente.'};
 if(/cambio en otro|cambiaron|conflict|se esta guardando|estan guardando/.test(value))return {title:'Otro cambio está en curso',cause:'Otra ventana o persona pudo modificar la misma información.',next:'Espera a que termine el guardado y consulta los datos actuales antes de confirmar de nuevo.'};
 if(/401|403|permiso|credencial|token|sesion|inicia sesion/.test(value))return {title:'Revisar acceso o sesión',cause:'La sesión o los permisos del servicio pueden haber cambiado.',next:'Comprueba tu sesión y el acceso a la página. Si continúa, envía una captura de este registro a Neftali.'};
 if(/timeout|demor|tardo|conex|network|fetch|offline|sin internet/.test(value))return {title:'Conexión o respuesta demorada',cause:'Puede haber una interrupción de internet o una respuesta lenta del servicio.',next:'Comprueba internet y espera unos momentos. Si estabas guardando, verifica primero la actividad. Recarga solo cuando no haya guardados en curso.'};
 if(/supabase|migracion|preferencia/.test(value))return {title:'Revisar configuración del servicio',cause:'La configuración o la respuesta del almacenamiento puede requerir revisión.',next:'Conserva tus cambios locales y comparte una captura de este registro. Si son pendientes, usa Reintentar pendientes.'};
 return {title:'Aviso que requiere revisión',cause:'No se puede determinar la causa solo con este mensaje.',next:'Revisa el detalle y comparte una captura con Neftali si persiste. Si estabas guardando, comprueba el resultado antes de repetirlo.'};
}
export function formatDiagnosticReport(entries:AppLog[]){return 'ANFETA · Diagnóstico\n'+entries.map(e=>{const advice=diagnosticAdvice(e.message);return `[${e.lastAt}] ${e.level==='error'?'Error':'Aviso'} · ${e.source} · ${e.count} vez/veces\n${e.message}\nPosible causa: ${advice.cause}\nSugerencia: ${advice.next}`;}).join('\n\n');}
