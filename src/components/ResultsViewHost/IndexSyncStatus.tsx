'use client';
import {useEffect,useState} from 'react';

export function IndexSyncStatus(){
  const [state,setState]=useState<any>(null);
  const [isRetrying,setIsRetrying]=useState(false);

  useEffect(()=>{
    const read=(event:Event)=>{
      setState((event as CustomEvent).detail);
      setIsRetrying(false);
    };
    window.addEventListener('anfeta_index_status',read);
    return()=>window.removeEventListener('anfeta_index_status',read);
  },[]);

  if(!state?.cacheMeta&&!state?.warning)return null;
  const meta=state.cacheMeta||{},time=meta.updatedAt?new Date(meta.updatedAt).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit'}):'';
  const error=state.warning||meta.lastError;
  const text=error?'Actualización pendiente':meta.syncing||isRetrying?'Actualizando índice…':meta.source==='supabase'?'Copia actualizada'+(time?' · '+time:''):'Datos disponibles';

  if(error)return (
    <details className="relative text-[10px] text-rose-300">
      <summary className="cursor-pointer select-none">Índice: actualización pendiente</summary>
      <div role="alert" className="absolute right-0 top-full z-[300] mt-2 w-80 max-w-[calc(100vw-24px)] rounded-lg border border-rose-800 bg-[#20111A] p-3 text-xs shadow-xl space-y-2">
        <p className="max-h-36 overflow-y-auto break-words leading-snug text-rose-200">{error}</p>
        <button
          type="button"
          disabled={isRetrying}
          onClick={(e)=>{
            e.stopPropagation();
            setIsRetrying(true);
            window.dispatchEvent(new CustomEvent('anfeta_trigger_refresh_index'));
          }}
          className="w-full py-1.5 px-3 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-100 font-semibold transition-colors text-center text-[11px] cursor-pointer disabled:opacity-50"
        >
          {isRetrying ? '⏳ Sincronizando catálogo...' : '🔄 Reintentar sincronización ahora'}
        </button>
      </div>
    </details>
  );

  return <span role="status" title={error||('Última sincronización: '+(meta.updatedAt||'en preparación'))} className={'max-w-40 truncate text-[10px] '+(error?'text-rose-300':meta.syncing||isRetrying?'text-amber-200':'text-cyan-200')}>{text}{error&&<span className="sr-only">: {error}</span>}</span>;
}
