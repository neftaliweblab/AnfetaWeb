"use client";
import {loadAccountPreferences,saveAccountPreferences} from '@/lib/accountPreferences';
import {PwaNotifications} from './PwaNotifications';
import React, {useEffect,useState,useRef} from 'react';
export function CalendarReviewNotifications({currentUser}:{currentUser:string}) {
  const [items,setItems] = useState<any[]>([]), [open,setOpen] = useState(false), [error,setError] = useState('');
  const [seen,setSeen] = useState<Record<string,string>>({});
  const owner=useRef(currentUser);owner.current=currentUser;
  const key = 'anfeta-review-notifications-seen:' + currentUser;
  useEffect(() => {
    try {setSeen(JSON.parse(localStorage.getItem(key) || '{}'));} catch {setSeen({});}
    let stopped=false, busy=false; const controller=new AbortController();
    const refresh=async () => {
      if (busy || stopped || document.hidden || !currentUser) return;
      busy=true;
      try {
        const res=await fetch('/api/data?type=review-notifications&person=' + encodeURIComponent(currentUser),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});
        const data=await res.json(); if (!res.ok || data.error) throw new Error(data.error || 'No se pudieron cargar los avisos.');
        const state=await loadAccountPreferences();if(stopped)return;const receipts=state.values?.receipts?.reviewNotifications;setSeen(receipts&&typeof receipts==='object'&&!Array.isArray(receipts)?receipts:{});setItems(data.items || []);setError('');
      } catch(e) {if (!stopped) setError(e instanceof Error ? e.message : 'No se pudieron cargar los avisos.');}
      finally {busy=false;}
    };
    void refresh(); const timer=setInterval(refresh,30000);
    window.addEventListener('focus',refresh); window.addEventListener('online',refresh); document.addEventListener('visibilitychange',refresh); window.addEventListener('anfeta_review_saved',refresh);
    return () => {stopped=true;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('anfeta_review_saved',refresh);};
  },[currentUser,key]);
  const unread=items.filter(item => seen[item.id] !== item.updated).length;
  const markRead=async () => {try{const state=await loadAccountPreferences();if(owner.current!==currentUser)return;const next={...(state.values?.receipts?.reviewNotifications||{})};items.forEach(item=>{next[item.id]=item.updated;});const limited=Object.fromEntries(Object.entries(next).slice(-1000));await saveAccountPreferences({receipts:{...(state.values?.receipts||{}),reviewNotifications:limited}},state.revision);if(owner.current!==currentUser)return;setSeen(limited as Record<string,string>);setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la lectura de avisos.');}};
  return <div className="relative shrink-0">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} title="Avisos de revisión" aria-label={'Avisos de revisión: '+unread+' sin leer'} className="rounded border border-cyan-800 px-2 py-1 text-xs text-cyan-200">🔔 <span className="hidden xl:inline">Revisiones</span> {unread > 0 && <strong className="ml-1 text-amber-300">{unread}</strong>}{error && <span className="ml-1 text-rose-300">!</span>}</button>
    {open && <div role="region" aria-label="Notificaciones de revisión" className="fixed right-3 top-28 z-[280] w-[360px] max-w-[calc(100vw-24px)] max-h-[65dvh] overflow-auto rounded-xl border border-cyan-900 bg-[#0F172A] p-3 shadow-xl">
      <div className="flex justify-between text-xs text-slate-200 mb-3"><strong>Avisos de revisión</strong><button onClick={() => setOpen(false)} aria-label="Cerrar avisos">✕</button></div>
      {error && <p role="alert" className="text-xs text-rose-300 mb-2">{error}</p>}
      {!items.length && !error && <p className="text-xs text-slate-400">No hay avisos de revisión pendientes.</p>}
      {items.map(item => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded border border-slate-700 p-2 mb-2 text-xs text-cyan-200">{seen[item.id] !== item.updated && <span className="text-amber-300">● </span>}{item.title}</a>)}
      <PwaNotifications />
      {items.length > 0 && <button onClick={markRead} className="text-xs text-slate-300 underline">Marcar como leídos</button>}
    </div>}
  </div>;
}
