'use client';
import {useEffect,useState} from 'react';
export function ConnectionStatus(){const [offline,setOffline]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(display-mode: standalone)');let stopped=false;
 const register=()=>{if(process.env.NODE_ENV==='production'&&window.isSecureContext&&'serviceWorker' in navigator&&(media.matches||(navigator as Navigator & {standalone?:boolean}).standalone))void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{if(!stopped)console.warn('No se pudo preparar el acceso sin conexión de ANFETA.');});};
 const online=()=>{setOffline(false);window.dispatchEvent(new Event('anfeta_data_refreshed'));};const lost=()=>setOffline(true);setOffline(!navigator.onLine);register();
 window.addEventListener('online',online);window.addEventListener('offline',lost);media.addEventListener('change',register);
 return()=>{stopped=true;window.removeEventListener('online',online);window.removeEventListener('offline',lost);media.removeEventListener('change',register);};},[]);
 if(!offline)return null;return <div role="status" aria-live="polite" className="fixed bottom-10 left-1/2 z-[250] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-amber-800 bg-slate-950 px-4 py-3 text-sm text-amber-200 shadow-xl">Sin conexión. Los cambios requieren Internet; al reconectar se solicitarán los datos actualizados.</div>;
}
