"use client";
import {loadAccountPreferences,saveAccountPreferences} from '@/lib/accountPreferences';
import {PwaNotifications} from './PwaNotifications';
import {createPortal} from 'react-dom';
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
  const [itemsOwner,setItemsOwner]=useState(currentUser);
  const [items,setItems] = useState<any[]>([]), [open,setOpen] = useState(false), [error,setError] = useState('');
  const [seen,setSeen] = useState<Record<string,string>>({});
  const [dismissed,setDismissed] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState(false);
  const [automatic,setAutomatic]=useState<any>(null),[observationImages,setObservationImages]=useState<any[]>([]);
  const shown=useRef(new Set<string>());
  useEffect(()=>{shown.current.clear();setAutomatic(null);setObservationImages([]);},[currentUser]);
  const owner=useRef(currentUser);owner.current=currentUser;
  const key = 'anfeta-review-notifications-seen:' + currentUser;
  useEffect(() => {
    setItems([]);setDismissed({});setOpen(false);
    try {setSeen(JSON.parse(localStorage.getItem(key) || '{}'));} catch {setSeen({});}
    let stopped=false, busy=false; const controller=new AbortController();
    const refresh=async () => {
      if (busy || stopped || document.hidden || !currentUser) return;
      busy=true;
      try {
        const res=await fetch('/api/data?type=review-notifications&person=' + encodeURIComponent(currentUser),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});
        const data=await res.json(); if (!res.ok || data.error) throw new Error(data.error || 'No se pudieron cargar los avisos.');
        const state=await loadAccountPreferences();if(stopped)return;const receipts=state.values?.receipts?.reviewNotifications;setSeen(receipts&&typeof receipts==='object'&&!Array.isArray(receipts)?receipts:{});setDismissed(state.values?.receipts?.dismissedReviewNotifications||{});setItemsOwner(currentUser);setItems(data.items || []);setError(data.warning||'');
      } catch(e) {if (!stopped) setError(e instanceof Error ? e.message : 'No se pudieron cargar los avisos.');}
      finally {busy=false;}
    };
    void refresh(); const timer=setInterval(()=>{ if (!document.hidden) void refresh(); },60000);
    window.addEventListener('focus',refresh); window.addEventListener('online',refresh); document.addEventListener('visibilitychange',refresh); window.addEventListener('anfeta_review_saved',refresh);
    return () => {stopped=true;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('anfeta_review_saved',refresh);};
  },[currentUser,key]);
  const visibleItems=(itemsOwner===currentUser?items:[]).filter(item=>dismissed[item.id]!==item.updated);
  useEffect(()=>{
    if(automatic)return;
    const next=visibleItems.find(item=>/^(?:Correcciones solicitadas|Actividad reasignada)/i.test(item.actionLabel||item.title||'')&&seen[item.id]!==item.updated&&!shown.current.has(item.id+':'+item.updated));
    if(next){shown.current.add(next.id+':'+next.updated);setAutomatic(next);}
  },[items,itemsOwner,currentUser,seen,dismissed,automatic]);
  useEffect(()=>{
    setObservationImages([]);if(!automatic)return;const abort=new AbortController();
    fetch('/api/data',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get-review-thread',payload:{pageId:automatic.id,currentUser}})}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudieron leer las observaciones.');const images=(data.entries||[]).filter((entry:any)=>entry.Kind==='System'&&/^(?:Correcciones solicitadas|Actividad reasignada)/i.test(entry.Text||'')).slice(-1).flatMap((entry:any)=>entry.Attachments||[]).filter((image:any)=>image.BlockId||/^https?:/.test(image.Url||''));if(!abort.signal.aborted)setObservationImages(images);}).catch(()=>{});return()=>abort.abort();
  },[automatic,currentUser]);
  async function acknowledgeAutomatic(){if(!automatic||busy)return;setBusy(true);try{const state=await loadAccountPreferences();if(owner.current!==currentUser)return;const next={...(state.values?.receipts?.reviewNotifications||{}),[automatic.id]:automatic.updated};await saveAccountPreferences({receipts:{...(state.values?.receipts||{}),reviewNotifications:next}},state.revision);if(owner.current!==currentUser)return;setSeen(next);setAutomatic(null);}catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar la lectura.');}finally{setBusy(false);}}
  const unread=visibleItems.filter(item => seen[item.id] !== item.updated).length;
  const dismiss=async(item:any)=>{
    if(busy)return;
    setBusy(true);
    try{
      const state=await loadAccountPreferences();if(owner.current!==currentUser)return;
      const next=Object.fromEntries(Object.entries({...state.values?.receipts?.dismissedReviewNotifications,[item.id]:item.updated}).slice(-1000));
      await saveAccountPreferences({receipts:{...(state.values?.receipts||{}),dismissedReviewNotifications:next}},state.revision);
      if(owner.current!==currentUser)return;
      setDismissed(next as Record<string,string>);setError('');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar el aviso.');}
    finally{setBusy(false);}
  };
  const markRead=async () => {try{const state=await loadAccountPreferences();if(owner.current!==currentUser)return;const next={...(state.values?.receipts?.reviewNotifications||{})};items.forEach(item=>{next[item.id]=item.updated;});const limited=Object.fromEntries(Object.entries(next).slice(-1000));await saveAccountPreferences({receipts:{...(state.values?.receipts||{}),reviewNotifications:limited}},state.revision);if(owner.current!==currentUser)return;setSeen(limited as Record<string,string>);setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la lectura de avisos.');}};

  const handleOpenDirect = async (item: any) => {
    if(item.kind==='ftf'){onSelectDate?.(item.date);setOpen(false);return;}
    setBusy(true);
    try {
      const res=await fetch('/api/data?type=review-activity&id='+encodeURIComponent(item.id),{cache:'no-store',signal:AbortSignal.timeout(45000)});
      const data=await res.json();
      if(!res.ok||!data.activity)throw Error(data.error||'No se pudo abrir la actividad.');
      window.dispatchEvent(new Event('anfeta_open_calendar_from_notice'));onSelectActivity?.(data.activity);setOpen(false);setError('');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo abrir la actividad.');}
    finally{setBusy(false);}
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
    {automatic&&typeof document!=='undefined'&&createPortal(<div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 p-4"><section role="dialog" aria-modal="true" aria-label="Actividad recibida con observaciones" className="max-h-[92dvh] w-full max-w-4xl overflow-auto rounded-2xl border-2 border-amber-400 bg-[#0d1926] p-5 text-slate-100 shadow-[0_0_40px_#fbbf2433]"><header className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-amber-300">↩ Actividad recibida con observaciones</h2><button type="button" aria-label="Cerrar observaciones" onClick={()=>setAutomatic(null)} className="rounded p-2">✕</button></header><h3 className="my-4 text-lg font-semibold">{automatic.activityTitle}</h3><p className="whitespace-pre-wrap rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm leading-relaxed">{automatic.actionLabel||automatic.title}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{observationImages.map((image,index)=><a key={image.BlockId||index} href={image.BlockId?'/api/data?type=image-proxy&blockId='+encodeURIComponent(image.BlockId):image.Url} target="_blank" rel="noreferrer"><img loading="lazy" src={image.BlockId?'/api/data?type=image-proxy&blockId='+encodeURIComponent(image.BlockId):image.Url} alt={image.Name||'Observación explicativa'} className="max-h-80 w-full rounded-lg border border-slate-700 bg-slate-950 object-contain"/></a>)}</div>{error&&<p role="alert" className="mt-3 text-rose-300">{error}</p>}<footer className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" disabled={busy} onClick={()=>{const item=automatic;setAutomatic(null);void handleOpenDirect(item);}} className="rounded-lg border border-cyan-700 px-4 py-2 text-cyan-200">Abrir actividad</button><button type="button" autoFocus disabled={busy} onClick={()=>void acknowledgeAutomatic()} className="rounded-lg bg-amber-400 px-5 py-2 font-semibold text-slate-950">{busy?'Guardando lectura…':'Entendido'}</button></footer></section></div>,document.body)}
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} title="Avisos de revisión" aria-label={'Avisos de revisión: '+unread+' sin leer'} className="rounded border border-cyan-800 px-2 py-1 text-xs text-cyan-200">🔔 <span className="hidden xl:inline">Revisiones</span> {unread > 0 && <strong className="ml-1 text-amber-300">{unread}</strong>}{error && <span className="ml-1 text-rose-300">!</span>}</button>
    {open && <div role="region" aria-label="Notificaciones de revisión" className="fixed right-3 top-28 z-[280] w-[380px] max-w-[calc(100vw-24px)] max-h-[70dvh] overflow-auto rounded-xl border border-cyan-900 bg-[#0F172A] p-3 shadow-xl">
      <div className="flex justify-between text-xs text-slate-200 mb-3"><strong>Avisos de revisión y FTF</strong><button onClick={() => setOpen(false)} aria-label="Cerrar avisos">✕</button></div>
      {error && <p role="alert" className="text-xs text-rose-300 mb-2">{error}</p>}
      {!visibleItems.length && !error && <p className="text-xs text-slate-400">No hay avisos pendientes.</p>}
      {visibleItems.map(item => (
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
              disabled={busy}
              onClick={() => void handleOpenDirect(item)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-500/50 text-[11px] font-medium cursor-pointer transition-colors"
              title="Entrar directamente a la actividad"
            >
              <span>⚡ Entrar directo</span>
            </button>

            {item.kind!=='ftf'&&<button
              type="button"
              onClick={(e) => void handleOpenNotionOriginal(e, item)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[11px] cursor-pointer transition-colors"
              title="Abrir página original en Notion"
            >
              <span>🔗 Original Notion</span>
            </button>}

            {item.kind!=='ftf'&&<a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[10px] text-slate-400 hover:text-slate-200 underline"
              title="Abrir aviso en Notion (BD REVISIONES)"
            >
              Aviso Notion
            </a>}
            <button type="button" disabled={busy} onClick={()=>void dismiss(item)} className="text-[11px] text-rose-300 hover:text-rose-200 disabled:opacity-40 px-2 py-1" title="Eliminar este aviso de tu cuenta; conserva la actividad">Eliminar aviso</button>
          </div>
        </div>
      ))}
      <PwaNotifications />
      {visibleItems.length > 0 && <button disabled={busy} onClick={markRead} className="text-xs text-slate-300 underline mt-2 block">Marcar como leídos</button>}
    </div>}
  </div>;
}
