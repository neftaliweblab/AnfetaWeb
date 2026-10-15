"use client";
import {loadAccountPreferences,saveAccountPreferences} from '@/lib/accountPreferences';
import {PwaNotifications} from './PwaNotifications';
import React, {useEffect,useState,useRef} from 'react';
import { NotionCalendarActivity } from '@/types/anfeta';

export function CalendarReviewNotifications({
  currentUser,
  activities,
  onSelectActivity,
  onSelectDate,
}: {
  currentUser: string;
  activities?: NotionCalendarActivity[];
  onSelectActivity?: (activity: NotionCalendarActivity) => void;
  onSelectDate?: (date: string) => void;
}) {
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
    void refresh(); const timer=setInterval(()=>{ if (!document.hidden) void refresh(); },60000);
    window.addEventListener('focus',refresh); window.addEventListener('online',refresh); document.addEventListener('visibilitychange',refresh); window.addEventListener('anfeta_review_saved',refresh);
    return () => {stopped=true;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('anfeta_review_saved',refresh);};
  },[currentUser,key]);
  const unread=items.filter(item => seen[item.id] !== item.updated).length;
  const markRead=async () => {try{const state=await loadAccountPreferences();if(owner.current!==currentUser)return;const next={...(state.values?.receipts?.reviewNotifications||{})};items.forEach(item=>{next[item.id]=item.updated;});const limited=Object.fromEntries(Object.entries(next).slice(-1000));await saveAccountPreferences({receipts:{...(state.values?.receipts||{}),reviewNotifications:limited}},state.revision);if(owner.current!==currentUser)return;setSeen(limited as Record<string,string>);setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la lectura de avisos.');}};

  const handleOpenDirect = async (item: any) => {
    const targetTitle = (item.activityTitle || item.title || '').trim().toLowerCase();
    const domainMatch = targetTitle.match(/(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|vip|app|edu|gob|co|ai|dev)/i)?.[0]?.toLowerCase();
    
    const found = activities?.find(a => {
      if (item.activityUrl && a.pageId && item.activityUrl.includes(a.pageId.replace(/-/g, ''))) return true;
      const aTitle = (a.title || '').toLowerCase();
      if (targetTitle && (aTitle.includes(targetTitle) || targetTitle.includes(aTitle))) return true;
      if (domainMatch && aTitle.includes(domainMatch)) return true;
      return false;
    });

    if (found && onSelectActivity) {
      onSelectActivity(found);
      setOpen(false);
      return;
    }

    if (item.activityUrl) {
      window.open(item.activityUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-review-thread', payload: { pageId: item.id, currentUser } })
      });
      const data = await res.json();
      if (data.sourceActivity?.PageUrl) {
        window.open(data.sourceActivity.PageUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (data.sourceActivity?.PageId) {
        window.open(`https://www.notion.so/${data.sourceActivity.PageId.replace(/-/g, '')}`, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {}

    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenNotionOriginal = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    e.preventDefault();
    if (item.activityUrl) {
      window.open(item.activityUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const targetTitle = (item.activityTitle || item.title || '').trim().toLowerCase();
    const domainMatch = targetTitle.match(/(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|vip|app|edu|gob|co|ai|dev)/i)?.[0]?.toLowerCase();
    const found = activities?.find(a => {
      const aTitle = (a.title || '').toLowerCase();
      if (targetTitle && (aTitle.includes(targetTitle) || targetTitle.includes(aTitle))) return true;
      if (domainMatch && aTitle.includes(domainMatch)) return true;
      return false;
    });
    if (found?.pageId) {
      window.open(`https://www.notion.so/${found.pageId.replace(/-/g, '')}`, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-review-thread', payload: { pageId: item.id, currentUser } })
      });
      const data = await res.json();
      if (data.sourceActivity?.PageUrl) {
        window.open(data.sourceActivity.PageUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (data.sourceActivity?.PageId) {
        window.open(`https://www.notion.so/${data.sourceActivity.PageId.replace(/-/g, '')}`, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {}
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  return <div className="relative shrink-0">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} title="Avisos de revisión" aria-label={'Avisos de revisión: '+unread+' sin leer'} className="rounded border border-cyan-800 px-2 py-1 text-xs text-cyan-200">🔔 <span className="hidden xl:inline">Revisiones</span> {unread > 0 && <strong className="ml-1 text-amber-300">{unread}</strong>}{error && <span className="ml-1 text-rose-300">!</span>}</button>
    {open && <div role="region" aria-label="Notificaciones de revisión" className="fixed right-3 top-28 z-[280] w-[380px] max-w-[calc(100vw-24px)] max-h-[70dvh] overflow-auto rounded-xl border border-cyan-900 bg-[#0F172A] p-3 shadow-xl">
      <div className="flex justify-between text-xs text-slate-200 mb-3"><strong>Avisos de revisión</strong><button onClick={() => setOpen(false)} aria-label="Cerrar avisos">✕</button></div>
      {error && <p role="alert" className="text-xs text-rose-300 mb-2">{error}</p>}
      {!items.length && !error && <p className="text-xs text-slate-400">No hay avisos de revisión pendientes.</p>}
      {items.map(item => (
        <div key={item.id} className="block rounded-lg border border-slate-700 bg-slate-900/90 p-2.5 mb-2.5 text-xs text-slate-200 shadow-sm transition-all hover:border-cyan-700/60">
          <div className="flex items-start justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-1 font-semibold text-cyan-300">
              {seen[item.id] !== item.updated && <span className="text-amber-300" title="Nuevo aviso">●</span>}
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300">
                {item.actionLabel || 'Revisión'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {item.updated ? new Date(item.updated).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>

          <p className="text-[11px] text-slate-200 font-medium line-clamp-2 mb-2 leading-relaxed">
            {item.activityTitle || item.title}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-800">
            <button
              type="button"
              onClick={() => void handleOpenDirect(item)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-500/50 text-[11px] font-medium cursor-pointer transition-colors"
              title="Entrar directamente a la actividad"
            >
              <span>⚡ Entrar directo</span>
            </button>

            <button
              type="button"
              onClick={(e) => void handleOpenNotionOriginal(e, item)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[11px] cursor-pointer transition-colors"
              title="Abrir página original en Notion"
            >
              <span>🔗 Original Notion</span>
            </button>

            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[10px] text-slate-400 hover:text-slate-200 underline"
              title="Abrir aviso en Notion (BD REVISIONES)"
            >
              Aviso Notion
            </a>
          </div>
        </div>
      ))}
      <PwaNotifications />
      {items.length > 0 && <button onClick={markRead} className="text-xs text-slate-300 underline mt-2 block">Marcar como leídos</button>}
    </div>}
  </div>;
}
