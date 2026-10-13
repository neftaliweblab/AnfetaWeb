'use client';
import {useEffect,useState} from 'react';
import {OfflineMutationQueue} from '@/services/offlineQueue';

export function ConnectionStatus(){
  const [offline,setOffline]=useState(false);
  const [pendingQueueCount,setPendingQueueCount]=useState(0);
  const [queueErrors,setQueueErrors]=useState<string[]>([]),[legacyCount,setLegacyCount]=useState(0);

  useEffect(()=>{
    const stopSync=OfflineMutationQueue.initAutoSync();
    const onQueueChange=()=>void OfflineMutationQueue.getQueue().then(items=>{setPendingQueueCount(items.length);setQueueErrors(items.filter(i=>i.error).map(i=>i.error!));setLegacyCount(OfflineMutationQueue.legacyQueue().length);}).catch(()=>setQueueErrors(['No se pudo consultar el almacenamiento local.']));
    onQueueChange();
    window.addEventListener('anfeta_offline_queue_changed',onQueueChange);

    const media=window.matchMedia('(display-mode: standalone)');let stopped=false;
    const register=()=>{if(process.env.NODE_ENV==='production'&&window.isSecureContext&&'serviceWorker' in navigator&&(media.matches||(navigator as Navigator & {standalone?:boolean}).standalone))void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{if(!stopped)console.warn('No se pudo preparar el acceso sin conexión de ANFETA.');});};
    const online=()=>{setOffline(false);void OfflineMutationQueue.flush().catch(()=>setQueueErrors(['No se pudo leer la cola; los cambios se conservan.']));window.dispatchEvent(new Event('anfeta_data_refreshed'));};
    const lost=()=>setOffline(true);
    setOffline(!navigator.onLine);
    register();
    window.addEventListener('online',online);
    window.addEventListener('offline',lost);
    media.addEventListener('change',register);
    return()=>{
      stopped=true;
      stopSync();
      window.removeEventListener('anfeta_offline_queue_changed',onQueueChange);
      window.removeEventListener('online',online);
      window.removeEventListener('offline',lost);
      media.removeEventListener('change',register);
    };
  },[]);

  if(!offline && pendingQueueCount===0&&legacyCount===0&&queueErrors.length===0)return null;

  if(!offline && (pendingQueueCount>0||legacyCount>0||queueErrors.length>0)) {
    return <div role="status" aria-live="polite" className="fixed bottom-10 left-1/2 z-[250] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-sky-800 bg-slate-950 px-4 py-3 text-xs text-sky-200 shadow-xl"><p>{pendingQueueCount} cambios pendientes de esta persona.</p>{queueErrors[0]&&<p role="alert">{queueErrors[0]} El cambio se conserva para revisión.</p>}{legacyCount>0&&<p>{legacyCount} cambios antiguos conservados sin propietario confirmado. <button onClick={()=>OfflineMutationQueue.exportLegacy()} className="underline">Descargar para revisar</button></p>}</div>;
  }

  return <div role="status" aria-live="polite" className="fixed bottom-10 left-1/2 z-[250] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-amber-800 bg-slate-950 px-4 py-3 text-sm text-amber-200 shadow-xl">Sin conexión. Puedes dejar pendientes checks, horarios y edición de recordatorios; los envíos a revisión y nuevas creaciones requieren conexión.{pendingQueueCount>0?` (${pendingQueueCount} pendientes de esta persona)`:''}{legacyCount>0&&<button onClick={()=>OfflineMutationQueue.exportLegacy()} className="block underline">Descargar {legacyCount} cambios antiguos sin propietario</button>}</div>;
}
