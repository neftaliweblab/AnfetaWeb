'use client';
import {useEffect,useState} from 'react';
import {OfflineMutationQueue} from '@/services/offlineQueue';

export function ConnectionStatus(){
  const [offline,setOffline]=useState(false);
  const [pendingQueueCount,setPendingQueueCount]=useState(0);

  useEffect(()=>{
    OfflineMutationQueue.initAutoSync();
    setPendingQueueCount(OfflineMutationQueue.getQueue().length);
    const onQueueChange=(e:any)=>setPendingQueueCount(e.detail?.count||0);
    window.addEventListener('anfeta_offline_queue_changed',onQueueChange);

    const media=window.matchMedia('(display-mode: standalone)');let stopped=false;
    const register=()=>{if(process.env.NODE_ENV==='production'&&window.isSecureContext&&'serviceWorker' in navigator&&(media.matches||(navigator as Navigator & {standalone?:boolean}).standalone))void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{if(!stopped)console.warn('No se pudo preparar el acceso sin conexión de ANFETA.');});};
    const online=()=>{setOffline(false);void OfflineMutationQueue.flush();window.dispatchEvent(new Event('anfeta_data_refreshed'));};
    const lost=()=>setOffline(true);
    setOffline(!navigator.onLine);
    register();
    window.addEventListener('online',online);
    window.addEventListener('offline',lost);
    media.addEventListener('change',register);
    return()=>{
      stopped=true;
      window.removeEventListener('anfeta_offline_queue_changed',onQueueChange);
      window.removeEventListener('online',online);
      window.removeEventListener('offline',lost);
      media.removeEventListener('change',register);
    };
  },[]);

  if(!offline && pendingQueueCount===0)return null;

  if(!offline && pendingQueueCount>0) {
    return <div role="status" aria-live="polite" className="fixed bottom-10 left-1/2 z-[250] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-sky-800 bg-slate-950 px-4 py-3 text-xs text-sky-200 shadow-xl flex items-center justify-between"><span>Sincronizando {pendingQueueCount} cambio(s) pendientes con el servidor...</span></div>;
  }

  return <div role="status" aria-live="polite" className="fixed bottom-10 left-1/2 z-[250] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-amber-800 bg-slate-950 px-4 py-3 text-sm text-amber-200 shadow-xl">Sin conexión. Los cambios se guardan localmente y se sincronizarán en cuanto vuelva Internet.{pendingQueueCount>0?` (${pendingQueueCount} pendientes en cola)`:''}</div>;
}
