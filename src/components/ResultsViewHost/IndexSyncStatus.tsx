'use client';
import {useEffect,useState} from 'react';
import {recordAppLog} from '@/lib/appDiagnostics';

export function IndexSyncStatus({owner=''}:{owner?:string}){
  const [state,setState]=useState<any>(null);
  const [isRetrying,setIsRetrying]=useState(false);

  useEffect(()=>{
    const read=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      const warning=detail?.warning||detail?.cacheMeta?.lastError;
      if(warning)recordAppLog(owner,'Buscador · sincronización',String(warning));
      setState(detail);
      setIsRetrying(false);
    };
    window.addEventListener('anfeta_index_status',read);
    return()=>window.removeEventListener('anfeta_index_status',read);
  },[owner]);

  if(!state?.cacheMeta&&!state?.warning)return null;
  const meta=state.cacheMeta||{},time=meta.updatedAt?new Date(meta.updatedAt).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit'}):'';
  const error=state.warning||meta.lastError;
  const text=error?'Actualización pendiente':meta.syncing||isRetrying?'Actualizando índice…':meta.source==='supabase'?'Copia actualizada'+(time?' · '+time:''):'Datos disponibles';

  if(error)return <span className="text-[10px] text-amber-200">Índice: revisar Logs</span>;
  return <span role="status" title={error||('Última sincronización: '+(meta.updatedAt||'en preparación'))} className={'max-w-40 truncate text-[10px] '+(error?'text-rose-300':meta.syncing||isRetrying?'text-amber-200':'text-cyan-200')}>{text}{error&&<span className="sr-only">: {error}</span>}</span>;
}
