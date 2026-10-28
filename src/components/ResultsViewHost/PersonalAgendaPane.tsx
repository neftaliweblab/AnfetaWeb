"use client";
import {rememberReviewFailure} from '@/lib/reviewOutcome';
import {dailyChecklist} from '@/lib/dailyChecklist';
import {workflowState} from '@/services/activityWorkflow';
import {pageIdentity} from '@/lib/deletedPages';
import {upsertCalendarActivity,applyCalendarStates,mergeCalendarSnapshot} from '@/lib/calendarUpdates';
import {useNotionPageWatch} from '@/components/useNotionPageWatch';
import {applyNotionStates} from '@/lib/applyNotionStates';
import {sharedCalendarFetch,calendarReadBoundary} from "@/lib/sharedCalendarFetch";
import {openNotionPage} from '@/services/windowsIntegration';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDetailPanel} from '../CalendarHost/CalendarDetailPanel';
import {AgendaActivityActions} from './AgendaActivityActions';
import {saveAgendaActivity,type AgendaUpdate} from './saveAgendaActivity';
import {personalAgendaActivities,agendaSelection,agendaAppearance} from '@/lib/personalAgenda';
import {workflowPresentation} from '@/services/activityWorkflow';
import {isFtfReminder} from '@/services/progressKpis';
import {anfetaSync} from '@/lib/anfetaBroadcastSync';
import {filterDeletedPages,DELETED_PAGES_EVENT} from '@/lib/deletedPages';
import {confirmedCalendarActivity} from '@/lib/confirmedCalendarActivity';
import {normalizePerson,PERSON_METADATA} from '@/services/identityNormalizer';
import {calendarDisplayTitle,calendarTime,mexicoDate} from '@/services/calendarPresentation';
import type {NotionCalendarActivity} from '@/types/anfeta';

const SHORT_COLLABORATORS = [
  { short: 'J', name: 'John' },
  { short: 'K', name: 'Karla' },
  { short: 'A', name: 'Andrade' },
  { short: 'N', name: 'Neftali' },
  { short: 'G', name: 'Genaro' },
  { short: 'I', name: 'Isaias' },
  { short: 'S', name: 'Sotelo' },
  { short: 'AC', name: 'Acalli' },
  { short: 'B', name: 'Brian' },
] as const;

const SESSION_PERSON_KEY = 'anfeta_personal_agenda_person';

export function PersonalAgendaPane({currentUser,onOpenCalendar,active=true,workspace=false,initialPerson,initialDay}:{currentUser:string;onOpenCalendar?:()=>void;active?:boolean;workspace?:boolean;initialPerson?:string;initialDay?:string}){
  const [person, setPerson] = useState<string>(() => {
    if(initialPerson)return normalizePerson(initialPerson);
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(SESSION_PERSON_KEY);
        if (saved && (PERSON_METADATA[saved] || SHORT_COLLABORATORS.some(c => c.name === saved))) {
          return normalizePerson(saved);
        }
      } catch {}
    }
    return normalizePerson(currentUser) || 'John';
  });

  const [day,setDay]=useState(()=>initialDay||mexicoDate());
  const [items,setItems]=useState<NotionCalendarActivity[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [query,setQuery]=useState(''),[preloading,setPreloading]=useState(false),[loaded,setLoaded]=useState(0);
  const preloadAbort=useRef<AbortController|null>(null);
  useEffect(()=>{setPreloading(false);setLoaded(0);return()=>preloadAbort.current?.abort();},[day,person,currentUser]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [expandedIds,setExpandedIds]=useState<Set<string>>(()=>new Set());
  const [layoutMode,setLayoutMode]=useState<'accordion'|'split'>('split');
  const [sortBy,setSortBy]=useState<'schedule'|'pendingFirst'>('schedule');

  const [menu,setMenu]=useState<{pageId:string;x:number;y:number}|null>(null);
  const [saving,setSaving]=useState(false),[notice,setNotice]=useState('');
  const loadingRef=useRef(false);
  const pendingId=useRef<string|null>(null);
  const pending=useRef(false),revision=useRef(0),requestedSelection=useRef<string|null>(null);
  const itemsRef=useRef(items);itemsRef.current=items;
  const recentSaves=useRef(new Map<string,{activity:NotionCalendarActivity;until:number}>());
  useEffect(()=>{recentSaves.current.clear();setItems([]);},[currentUser]);
  useEffect(()=>{
    if(requestedSelection.current){
      setSelectedId(requestedSelection.current);
      setExpandedIds(new Set([requestedSelection.current]));
      requestedSelection.current=null;
    }
    setMenu(null);setNotice('');
  },[day,person,currentUser]);


  const selectPerson = (newPerson: string) => {
    const norm = normalizePerson(newPerson);
    setPerson(norm);
    try {
      sessionStorage.setItem(SESSION_PERSON_KEY, norm);
    } catch {}
  };

  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();
    const readStartedAt=Date.now();
    const version=revision.current;
    loadingRef.current=true;
    setLoading(true);
    setError('');
    sharedCalendarFetch('/api/data?type=calendar&basic=1&date='+encodeURIComponent(day),currentUser,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])})
      .then(async response=>{
        const data=await response.json();const boundary=calendarReadBoundary(response,data.cacheMeta,readStartedAt);
        if(!response.ok)throw Error(data.error||'No se pudo cargar el calendario.');
        if(!controller.signal.aborted&&!pending.current&&version===revision.current){
          const incoming:NotionCalendarActivity[]=data.activities||[];
          const protectedItems=incoming.map(incomingActivity=>{const previous=itemsRef.current.find(a=>a.pageId===incomingActivity.pageId);const a=!incomingActivity.checklistScanned&&previous?.checklistScanned?{...incomingActivity,checklistScanned:true,checklistTotal:previous.checklistTotal,checklistCompleted:previous.checklistCompleted,checklistItems:previous.checklistItems,completedChecks:previous.completedChecks,todayChecklistCompleted:previous.todayChecklistCompleted}:incomingActivity;const saved=recentSaves.current.get(a.pageId);if(!saved)return a;if(saved.until<Date.now()){recentSaves.current.delete(a.pageId);return a;}return confirmedCalendarActivity(a,saved.activity);});
          for(const saved of recentSaves.current.values())if(saved.until>Date.now()&&mexicoDate(saved.activity.start)===day&&!protectedItems.some(a=>a.pageId===saved.activity.pageId))protectedItems.push(saved.activity);
          setItems(old=>filterDeletedPages(mergeCalendarSnapshot(old,protectedItems,day,boundary),currentUser));
          setError(data.warning||'');
        }
      })
      .catch(e=>{
        if(!controller.signal.aborted)setError(e.message);
      })
      .finally(()=>{
        if(!controller.signal.aborted){loadingRef.current=false;setLoading(false);}
      });
    return()=>{controller.abort();loadingRef.current=false;};
  },[day,currentUser,retry,active]);

  useEffect(()=>{
    const refresh=()=>{if(active&&!pending.current&&!loadingRef.current&&!document.hidden)setRetry(n=>n+1);};
    const removeDeleted=()=>setItems(old=>filterDeletedPages(old,currentUser));
    const unsubscribe=anfetaSync.subscribe(message=>{
      if(message.type==='ACTIVITY_UPDATED'&&message.pageId&&message.updates){
        revision.current++;
        setItems(old=>upsertCalendarActivity(old,message.pageId!,message.updates,day));
      }else if(message.type==='ACTIVITY_CREATED'&&message.activity)setItems(old=>upsertCalendarActivity(old,message.activity.pageId,message.activity,day));
    });
    window.addEventListener('anfeta_data_refreshed',refresh);window.addEventListener('online',refresh);
    window.addEventListener(DELETED_PAGES_EVENT,removeDeleted);window.addEventListener('storage',removeDeleted);
    return()=>{unsubscribe();window.removeEventListener('anfeta_data_refreshed',refresh);window.removeEventListener('online',refresh);window.removeEventListener(DELETED_PAGES_EVENT,removeDeleted);window.removeEventListener('storage',removeDeleted);};
  },[currentUser,day,active]);

  const activities=useMemo(()=>personalAgendaActivities(items.filter(a=>mexicoDate(a.start)===day),person),[items,person,day]);
  const listed=useMemo(()=>{
    const filtered=activities.filter(a=>(a.title+' '+(a.domain||'')).toLowerCase().includes(query.trim().toLowerCase()));
    if(sortBy==='pendingFirst'){
      return [...filtered].sort((a,b)=>Number(workflowState(a.status,a.title)==='completed')-Number(workflowState(b.status,b.title)==='completed')||Date.parse(a.start)-Date.parse(b.start)||a.pageId.localeCompare(b.pageId));
    }
    return [...filtered].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.pageId.localeCompare(b.pageId));
  },[activities,query,sortBy]);

  const toggleExpanded = useCallback((pageId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
    setSelectedId(pageId);
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(listed.map(a => a.pageId)));
  }, [listed]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  useEffect(() => {
    if (listed.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set([listed[0].pageId]));
      setSelectedId(listed[0].pageId);
    }
  }, [listed, day, person]);
  const effectiveSelected=workspace
    ?(selectedId&&listed.some(a=>a.pageId===selectedId)?selectedId:(listed[0]?.pageId??null))
    :agendaSelection(listed,selectedId);
  const selected=activities.find(a=>a.pageId===effectiveSelected);
  useNotionPageWatch(currentUser,activities,active,states=>{const ready=states.filter(s=>!pendingId.current||pageIdentity(s.id)!==pageIdentity(pendingId.current));if(ready.length)setItems(old=>filterDeletedPages(applyCalendarStates(old,ready,day),currentUser));return ready.map(s=>pageIdentity(s.id));},true);
  const menuActivity=activities.find(a=>a.pageId===menu?.pageId);
  const closeMenu=useCallback(()=>setMenu(null),[]);
  const [conflictNotice, setConflictNotice] = useState<{pageId:string;updates:AgendaUpdate;conflictTitle:string;suggestedSlot?:{start:string;end:string}}|null>(null);
  const updateActivity=async(pageId:string,updates:AgendaUpdate)=>{
    if(pending.current)return false;
    const original=itemsRef.current.find(a=>a.pageId===pageId);if(!original)return false;
    pending.current=true;pendingId.current=pageId;revision.current++;setSaving(true);setNotice('');
    try{
      const data=await saveAgendaActivity(original,updates,currentUser,fresh=>{
        recentSaves.current.set(pageId,{activity:{...original,...fresh},until:Date.now()+60000});
        setItems(old=>old.map(a=>a.pageId===pageId?{...a,...fresh}:a));
      });
      const saved={...original,...data.activity};
      recentSaves.current.set(pageId,{activity:saved,until:Date.now()+60000});
      setItems(old=>{
        const next=old.filter(a=>a.pageId!==pageId&&a.pageId!=='review-mirror-'+pageId);
        next.push(saved);
        for(const copy of data.handoffCopies||[])if(!next.some(a=>a.pageId===copy.pageId))next.push(copy);
        if(saved.reviewFlow?.State==='pending'&&saved.reviewFlow.LeaveVisualCopy!==false&&normalizePerson(saved.reviewFlow.OriginalPerson)!==normalizePerson(saved.person))next.push({...saved,pageId:'review-mirror-'+pageId,person:normalizePerson(saved.reviewFlow.OriginalPerson),isReviewMirror:true,title:'[COPIA REVISIÓN] '+saved.title});
        return next;
      });
      setNotice(data.warning||'Cambio confirmado en Notion.');
      anfetaSync.broadcast({type:'ACTIVITY_UPDATED',confirmed:true,pageId,updates:saved});
      window.dispatchEvent(new Event('anfeta_review_saved'));
      if(updates.start)setDay(mexicoDate(saved.start));
      return true;
    }catch(e:any){
      const msg = e instanceof Error ? e.message : 'No se pudo guardar.';
      if(updates.reviewer)rememberReviewFailure(pageId,e);
      const isConflict = e?.code === 'SCHEDULE_CONFLICT' || (typeof msg === 'string' && msg.includes('El horario se empalma con'));
      if (isConflict) {
        const match = typeof msg === 'string' ? msg.match(/El horario se empalma con «([^»]+)».+Horario libre sugerido:\s*(\d{2}:\d{2})[–-](\d{2}:\d{2})/i) : null;
        const freeMatch = match ? { start: day + 'T' + match[2] + ':00-06:00', end: day + 'T' + match[3] + ':00-06:00' } : undefined;
        setConflictNotice({ pageId, updates, conflictTitle: e?.conflictTitle || (match ? match[1] : 'otra actividad'), suggestedSlot: e?.suggestedSlot || freeMatch });
      } else {
        setNotice(msg);
      }
      return false;
    }
    finally{pending.current=false;pendingId.current=null;setSaving(false);}
  };

  const preload=async()=>{
    if(preloading)return;const abort=new AbortController();preloadAbort.current=abort;setPreloading(true);setLoaded(0);let cursor=0;
    const worker=async()=>{while(cursor<listed.length&&!abort.signal.aborted){const row=listed[cursor++],version=revision.current;if(row.checklistScanned){if(!abort.signal.aborted)setLoaded(n=>n+1);continue;}try{
      const response=await fetch('/api/data',{method:'POST',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(45000)]),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get-checklist',payload:{pageId:row.pageId.replace(/^review-mirror-/, '')}})});const data=await response.json();if(!response.ok||!data.success)throw Error(data.error||'No se pudieron leer los pasos.');
      if(!abort.signal.aborted&&version===revision.current&&!pending.current){setItems(old=>old.map(a=>a.pageId===row.pageId?{...a,checklistScanned:true,checklistItems:data.items,checklistTotal:data.items.length,checklistCompleted:data.items.filter((i:any)=>i.isChecked).length,todayChecklistCompleted:dailyChecklist(data.items,day).done}:a));setLoaded(n=>n+1);}
    }catch(error){if(!abort.signal.aborted)setNotice(error instanceof Error?error.message:'No se pudo cargar una actividad.');}}};
    try{await Promise.all([worker(),worker()]);}finally{if(!abort.signal.aborted)setPreloading(false);}
  };
  return (
    <aside aria-label="Calendario individual" className={(workspace?"w-full ":"w-[380px] max-w-[calc(100vw-24px)] ")+"h-full min-w-0 flex flex-col border-l border-slate-800 bg-[#0F141C] p-3 text-xs"}>
      <header className="space-y-2.5 border-b border-slate-800 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-200 text-sm">Calendario individual</h2>
          <span className="text-[10px] text-slate-400 font-mono">
            {person}
          </span>
        </div>

        {workspace ? (
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Buscar actividad del día" placeholder="Buscar actividad o dominio…" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 p-2 text-xs"/>
            <button type="button" onClick={()=>setSortBy(s=>s==='schedule'?'pendingFirst':'schedule')} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-2 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer" title={sortBy==='schedule'?'Orden cronológico por horario (10:30 → 18:00)':'Orden con pendientes primero'}>
              <span>{sortBy==='schedule'?'⏰ Horario':'⚡ Pendientes'}</span>
            </button>
            <button type="button" onClick={()=>setLayoutMode(m=>m==='accordion'?'split':'accordion')} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-2 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer" title={layoutMode==='accordion'?'Cambiar a vista dividida de 2 columnas':'Cambiar a acordeón amplio'}>
              <span>{layoutMode==='accordion'?'📑 Acordeón amplio':'◫ 2 Columnas'}</span>
            </button>
            <div className="flex items-center gap-1">
              <button type="button" disabled={saving||!listed.length} onClick={expandAll} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1.5 text-slate-300 hover:text-white text-xs font-medium cursor-pointer" title="Desplegar todas las actividades">
                ▼ Desplegar todos
              </button>
              <button type="button" disabled={saving||!expandedIds.size} onClick={collapseAll} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-medium cursor-pointer" title="Colapsar todas las actividades">
                ▲ Colapsar
              </button>
            </div>
            <button type="button" disabled={preloading} onClick={()=>void preload()} className="rounded border border-cyan-700 bg-cyan-950/40 hover:bg-cyan-900/60 px-2.5 py-2 text-cyan-200 text-xs font-medium cursor-pointer">
              {preloading?'Cargando '+loaded+'…':'Cargar pasos de esta lista'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('anfeta_open_daily_workspace',{detail:{person,day}}))} className="text-cyan-300 underline font-semibold">
              Abrir jornada en vista amplia ↗
            </button>
            <div className="flex items-center gap-1">
              <button type="button" disabled={saving||!listed.length} onClick={expandAll} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-cyan-300 cursor-pointer" title="Desplegar todas las actividades">
                ▼ Desplegar todos
              </button>
              <button type="button" disabled={saving||!expandedIds.size} onClick={collapseAll} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer" title="Colapsar todas las actividades">
                ▲ Colapsar
              </button>
            </div>
          </div>
        )}
        {/* Fila compacta de botones rápidos de personas: J, K, A, N, G, I, S */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {SHORT_COLLABORATORS.map(({ short, name }) => {
            const isSelected = normalizePerson(name) === person;
            return (
              <button
                key={name}
                type="button"
                disabled={saving} onClick={() => selectPerson(name)}
                title={`Ver actividades de ${name}`}
                aria-pressed={isSelected}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 scale-105'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
              >
                {short}
              </button>
            );
          })}
        </div>

        {/* Selector de fecha y controles */}
        <div className="flex items-center gap-2">
          <input
            aria-label="Fecha del calendario individual"
            type="date" disabled={saving}
            value={day}
            onChange={e=>{if(e.target.value)setDay(e.target.value);}}
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 text-xs"
          />
          <button
            type="button"
            disabled={saving} onClick={()=>setDay(mexicoDate())}
            className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-slate-300 hover:text-white font-medium cursor-pointer"
          >
            Hoy
          </button>
          <button
            type="button"
            aria-label="Actualizar calendario individual"
            onClick={()=>setRetry(n=>n+1)}
            className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-slate-300 hover:text-white cursor-pointer"
            title="Actualizar"
          >
            ↻
          </button>
        </div>
      </header>

      <div className={workspace ? (layoutMode === 'accordion' ? 'flex flex-col min-h-0 flex-1 gap-2 overflow-hidden' : 'grid min-h-0 flex-1 gap-2 overflow-hidden md:grid-cols-[minmax(260px,35%)_1fr]') : 'contents'}>
      {/* Lista de actividades con acordeón desplegable inline (▶ / ▼) */}
      <div className="min-h-0 flex-1 overflow-y-auto space-y-2 py-3">
        {loading && <p role="status" className="animate-pulse text-slate-400 text-center py-4">Cargando actividades…</p>}
        {error && <p role="alert" className="rounded border border-amber-900/60 bg-amber-950/30 p-2 text-amber-300 text-xs">{error}</p>}
        {!loading && !activities.length && !error && (
          <p className="py-8 text-center text-slate-400">No hay actividades para {person} en esta fecha.</p>
        )}
        {notice&&<p role="status" className="rounded-lg border border-cyan-900/60 bg-cyan-950/30 p-2 text-cyan-100 break-words">{notice}</p>}
        {conflictNotice && (<div className="rounded-xl border border-amber-500/70 bg-[#16120D] p-3 text-xs text-amber-200 space-y-2.5 shadow-xl animate-in fade-in duration-150"><div className="flex items-start gap-2"><span className="text-amber-400 font-bold text-base leading-none">⚠️</span><div className="min-w-0 flex-1 leading-snug"><p className="font-semibold text-amber-300">Conflicto de horario (Empalme)</p><p className="mt-0.5 text-[11px] text-slate-300">Se empalma con <strong className="text-white">«{conflictNotice.conflictTitle}»</strong>.</p></div></div><div className="flex flex-col gap-1.5 pt-1"><button type="button" disabled={saving} onClick={()=>{const cn=conflictNotice;setConflictNotice(null);void updateActivity(cn.pageId,{...cn.updates,allowOverlap:true});}} className="w-full rounded-lg border border-amber-500/80 bg-amber-500/20 hover:bg-amber-500/30 py-2 px-2 text-center font-semibold text-amber-200 transition-colors cursor-pointer">⚡ Aceptar que se empalme</button>{conflictNotice.suggestedSlot&&<button type="button" disabled={saving} onClick={()=>{const cn=conflictNotice;setConflictNotice(null);void updateActivity(cn.pageId,{...cn.updates,start:cn.suggestedSlot!.start,end:cn.suggestedSlot!.end,allowOverlap:false});}} className="w-full rounded-lg border border-cyan-500/80 bg-cyan-500/20 hover:bg-cyan-500/30 py-2 px-2 text-center font-semibold text-cyan-200 transition-colors cursor-pointer">🕒 Mover a hora más cercana ({conflictNotice.suggestedSlot.start.slice(11,16)} – {conflictNotice.suggestedSlot.end.slice(11,16)})</button>}<button type="button" disabled={saving} onClick={()=>setConflictNotice(null)} className="text-slate-400 hover:text-slate-200 text-center text-[11px] py-1 cursor-pointer">Descartar cambio</button></div></div>)}
        {listed.map(a => {
          const appearance = agendaAppearance(a);
          const isItemExpanded = expandedIds.has(a.pageId);
          return (
            <article
              key={a.pageId}
              className={'relative rounded-lg border-l-4 border p-2.5 transition-colors ' + appearance.className + (isItemExpanded ? ' ring-1 ring-cyan-400/70 bg-slate-900/60' : '')}
              onContextMenu={e => {
                e.preventDefault();
                if (!saving) setMenu({ pageId: a.pageId, x: e.clientX, y: e.clientY });
              }}
            >
              <div className="flex items-start gap-2">
                {/* Botón triangulito desplegable inline (▶ / ▼) */}
                <button
                  type="button"
                  disabled={saving}
                  aria-expanded={isItemExpanded}
                  aria-label={(isItemExpanded ? 'Colapsar ' : 'Desplegar ') + calendarDisplayTitle(a.title, a.domain || '')}
                  onClick={e => {
                    e.stopPropagation();
                    toggleExpanded(a.pageId);
                  }}
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-cyan-800/70 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/80 hover:text-white transition-all cursor-pointer shadow-sm"
                  title={isItemExpanded ? 'Colapsar detalles de esta actividad' : 'Desplegar contenido completo de la página'}
                >
                  <span className="text-[11px] font-bold leading-none select-none">
                    {isItemExpanded ? '▼' : '▶'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  aria-expanded={isItemExpanded}
                  aria-label={'Ver pasos de ' + calendarDisplayTitle(a.title, a.domain || '')}
                  onClick={() => toggleExpanded(a.pageId)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-semibold text-cyan-200">{calendarTime(a.start)} – {calendarTime(a.end)}</span>
                    <span className={'text-[10px] font-semibold ' + appearance.text}>
                      {isFtfReminder(a) ? 'FTF · Recordatorio · No cuenta como actividad' : workflowPresentation(a.status, a.title).label}
                      {a.isReviewMirror ? ' · Copia de revisión' : a.isHandoffMirror ? ' · Copia histórica' : ''}
                    </span>
                  </div>
                  <span className={'mt-1 block break-words font-medium leading-snug ' + (appearance.state === 'completed' ? 'text-slate-400 line-through' : 'text-slate-100')}>
                    {calendarDisplayTitle(a.title, a.domain || '')}
                  </span>
                  {a.checklistScanned && (
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {dailyChecklist(a.checklistItems || [], day).done} / {dailyChecklist(a.checklistItems || [], day).total} pasos del día
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  aria-label={'Acciones de ' + calendarDisplayTitle(a.title, a.domain || '')}
                  aria-haspopup="menu"
                  className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-700 shrink-0 cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    const box = e.currentTarget.getBoundingClientRect();
                    setMenu({ pageId: a.pageId, x: box.left, y: box.bottom + 4 });
                  }}
                >
                  ⋯
                </button>
              </div>

              {a.ftfVerified && (
                <span aria-label="Pasos FTF verificados para hoy" className="pointer-events-none absolute right-0 top-3 h-8 w-1 rounded-l bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              )}

              {/* Contenido inline desplegado en acordeón amplio */}
              {isItemExpanded && (!workspace || layoutMode === 'accordion') && (
                <div className="mt-3 border-t border-slate-800/90 pt-3" aria-busy={saving}>
                  <CalendarDetailPanel
                    key={a.pageId}
                    embedded
                    isSaving={saving}
                    activity={a}
                    currentUser={currentUser}
                    onClose={() => toggleExpanded(a.pageId)}
                    allActivities={activities}
                    onSelectActivity={next => {
                      if (mexicoDate(next.start) !== day || normalizePerson(next.person) !== person) requestedSelection.current = next.pageId;
                      setSelectedId(next.pageId);
                      setExpandedIds(new Set([next.pageId]));
                      setItems(old => old.some(item => item.pageId === next.pageId) ? old : [...old, next]);
                      if (mexicoDate(next.start) !== day) setDay(mexicoDate(next.start));
                      if (normalizePerson(next.person) !== person) selectPerson(next.person);
                    }}
                    onActivityUpdated={updates => updateActivity(a.pageId, updates)}
                    onChecklistUpdated={updates => setItems(old => old.map(item => item.pageId === a.pageId ? { ...item, ...updates } : item))}
                  />
                </div>
              )}

              {!isItemExpanded && (!workspace || layoutMode === 'accordion') && (
                <div className="mt-2 flex justify-between border-t border-slate-700/50 pt-2 text-[11px]">
                  <button type="button" disabled={saving} onClick={() => toggleExpanded(a.pageId)} className="text-cyan-300 font-medium hover:underline flex items-center gap-1 cursor-pointer">
                    <span>▶</span><span>Ver pasos y editar contenido</span>
                  </button>
                  <button type="button" className="text-sky-300 hover:underline" onClick={() => openNotionPage(a.pageUrl || 'https://www.notion.so/' + a.pageId.replace(/^review-mirror-/, '').replace(/-/g, ''))}>
                    Abrir Notion ↗
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {workspace && layoutMode === 'split' && (
        <div className="min-h-0 overflow-auto rounded-lg bg-[#111b2b] p-2">
          {selected && expandedIds.has(selected.pageId) ? (
            <CalendarDetailPanel
              key={selected.pageId}
              embedded
              isSaving={saving}
              activity={selected}
              currentUser={currentUser}
              onClose={() => toggleExpanded(selected.pageId)}
              allActivities={activities}
              onSelectActivity={next => {
                if (mexicoDate(next.start) !== day || normalizePerson(next.person) !== person) requestedSelection.current = next.pageId;
                setSelectedId(next.pageId);
                setExpandedIds(new Set([next.pageId]));
                setItems(old => old.some(a => a.pageId === next.pageId) ? old : [...old, next]);
                if (mexicoDate(next.start) !== day) setDay(mexicoDate(next.start));
                if (normalizePerson(next.person) !== person) selectPerson(next.person);
              }}
              onActivityUpdated={updates => updateActivity(selected.pageId, updates)}
              onChecklistUpdated={updates => setItems(old => old.map(item => item.pageId === selected.pageId ? { ...item, ...updates } : item))}
            />
          ) : (
            <p className="p-4 text-slate-400">Selecciona una actividad para revisar su contenido.</p>
          )}
        </div>
      )}
      </div>
      {menu&&menuActivity&&<AgendaActivityActions key={menuActivity.pageId} activity={menuActivity} currentUser={currentUser} position={menu} busy={saving} onClose={closeMenu} onSave={updates=>updateActivity(menuActivity.pageId,updates)}/>}
      {onOpenCalendar && (
        <button
          type="button"
          onClick={onOpenCalendar}
          className="rounded-lg border border-cyan-800/80 bg-cyan-950/40 hover:bg-cyan-900/60 p-2 text-cyan-200 text-center font-medium transition-colors cursor-pointer"
        >
          Abrir calendario completo
        </button>
      )}
    </aside>
  );
}
