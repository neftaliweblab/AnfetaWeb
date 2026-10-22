"use client";
import {useNotionPageWatch} from '@/components/useNotionPageWatch';
import {applyNotionStates} from '@/lib/applyNotionStates';
import {sharedCalendarFetch} from "@/lib/sharedCalendarFetch";
import {openNotionPage} from '@/services/windowsIntegration';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDetailPanel} from '../CalendarHost/CalendarDetailPanel';
import {AgendaActivityActions} from './AgendaActivityActions';
import {saveAgendaActivity,type AgendaUpdate} from './saveAgendaActivity';
import {personalAgendaActivities,agendaSelection,agendaAppearance} from '@/lib/personalAgenda';
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

export function PersonalAgendaPane({currentUser,onOpenCalendar}:{currentUser:string;onOpenCalendar?:()=>void}){
  const [person, setPerson] = useState<string>(() => {
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

  const [day,setDay]=useState(()=>mexicoDate());
  const [items,setItems]=useState<NotionCalendarActivity[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [selectedId,setSelectedId]=useState<string|null>(null),[expanded,setExpanded]=useState(true);
  const [menu,setMenu]=useState<{pageId:string;x:number;y:number}|null>(null);
  const [saving,setSaving]=useState(false),[notice,setNotice]=useState('');
  const loadingRef=useRef(false);
  const pending=useRef(false),revision=useRef(0),requestedSelection=useRef<string|null>(null);
  const itemsRef=useRef(items);itemsRef.current=items;
  const recentSaves=useRef(new Map<string,{activity:NotionCalendarActivity;until:number}>());
  useEffect(()=>{recentSaves.current.clear();setItems([]);},[currentUser]);
  useEffect(()=>{setSelectedId(requestedSelection.current);requestedSelection.current=null;setExpanded(true);setMenu(null);setNotice('');},[day,person,currentUser]);


  const selectPerson = (newPerson: string) => {
    const norm = normalizePerson(newPerson);
    setPerson(norm);
    try {
      sessionStorage.setItem(SESSION_PERSON_KEY, norm);
    } catch {}
  };

  useEffect(()=>{
    const controller=new AbortController();
    const version=revision.current;
    loadingRef.current=true;
    setLoading(true);
    setError('');
    sharedCalendarFetch('/api/data?type=calendar&basic=1&date='+encodeURIComponent(day),currentUser,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok)throw Error(data.error||'No se pudo cargar el calendario.');
        if(!controller.signal.aborted&&!pending.current&&version===revision.current){
          const incoming:NotionCalendarActivity[]=data.activities||[];
          const protectedItems=incoming.map(incomingActivity=>{const previous=itemsRef.current.find(a=>a.pageId===incomingActivity.pageId);const a=!incomingActivity.checklistScanned&&previous?.checklistScanned?{...incomingActivity,checklistScanned:true,checklistTotal:previous.checklistTotal,checklistCompleted:previous.checklistCompleted,checklistItems:previous.checklistItems,completedChecks:previous.completedChecks,todayChecklistCompleted:previous.todayChecklistCompleted}:incomingActivity;const saved=recentSaves.current.get(a.pageId);if(!saved)return a;if(saved.until<Date.now()){recentSaves.current.delete(a.pageId);return a;}return confirmedCalendarActivity(a,saved.activity);});
          for(const saved of recentSaves.current.values())if(saved.until>Date.now()&&mexicoDate(saved.activity.start)===day&&!protectedItems.some(a=>a.pageId===saved.activity.pageId))protectedItems.push(saved.activity);
          setItems(filterDeletedPages(protectedItems,currentUser));
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
  },[day,currentUser,retry]);

  useEffect(()=>{
    const refresh=()=>{if(!pending.current&&!loadingRef.current&&!document.hidden)setRetry(n=>n+1);};
    const removeDeleted=()=>setItems(old=>filterDeletedPages(old,currentUser));
    const unsubscribe=anfetaSync.subscribe(message=>{
      if(message.type==='ACTIVITY_UPDATED'&&message.pageId&&message.updates){
        revision.current++;
        setItems(old=>old.map(a=>a.pageId===message.pageId?{...a,...message.updates}:a));
      }else if(message.type==='ACTIVITY_CREATED'&&message.activity)setItems(old=>old.some(a=>a.pageId===message.activity.pageId)?old:[...old,message.activity]);
    });
    window.addEventListener('anfeta_data_refreshed',refresh);window.addEventListener('online',refresh);
    window.addEventListener(DELETED_PAGES_EVENT,removeDeleted);window.addEventListener('storage',removeDeleted);
    return()=>{unsubscribe();window.removeEventListener('anfeta_data_refreshed',refresh);window.removeEventListener('online',refresh);window.removeEventListener(DELETED_PAGES_EVENT,removeDeleted);window.removeEventListener('storage',removeDeleted);};
  },[currentUser]);

  const activities=useMemo(()=>personalAgendaActivities(items.filter(a=>mexicoDate(a.start)===day),person),[items,person,day]);
  const effectiveSelected=agendaSelection(activities,selectedId);
  const selected=activities.find(a=>a.pageId===effectiveSelected);
  useNotionPageWatch(currentUser,activities,true,states=>{if(!pending.current)setItems(old=>filterDeletedPages(applyNotionStates(old,states),currentUser));});
  const menuActivity=activities.find(a=>a.pageId===menu?.pageId);
  const closeMenu=useCallback(()=>setMenu(null),[]);
  const updateActivity=async(pageId:string,updates:AgendaUpdate)=>{
    if(pending.current)return false;
    const original=itemsRef.current.find(a=>a.pageId===pageId);if(!original)return false;
    pending.current=true;revision.current++;setSaving(true);setNotice('');
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
      anfetaSync.broadcast({type:'ACTIVITY_UPDATED',pageId,updates:saved});
      window.dispatchEvent(new Event('anfeta_review_saved'));
      if(updates.start)setDay(mexicoDate(saved.start));
      return true;
    }catch(e){setNotice(e instanceof Error?e.message:'No se pudo guardar.');return false;}
    finally{pending.current=false;setSaving(false);}
  };

  return (
    <aside aria-label="Calendario individual" className="w-[380px] max-w-[calc(100vw-24px)] h-full min-w-0 flex flex-col border-l border-slate-800 bg-[#0F141C] p-3 text-xs">
      <header className="space-y-2.5 border-b border-slate-800 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-200 text-sm">Calendario individual</h2>
          <span className="text-[10px] text-slate-400 font-mono">
            {person}
          </span>
        </div>

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

      {/* Lista de actividades con texto suave / neutro para evitar fatiga visual */}
      <div className="min-h-0 flex-1 overflow-y-auto space-y-2 py-3">
        {loading && <p role="status" className="animate-pulse text-slate-400 text-center py-4">Cargando actividades…</p>}
        {error && <p role="alert" className="rounded border border-amber-900/60 bg-amber-950/30 p-2 text-amber-300 text-xs">{error}</p>}
        {!loading && !activities.length && !error && (
          <p className="py-8 text-center text-slate-400">No hay actividades para {person} en esta fecha.</p>
        )}
        {notice&&<p role="status" className="rounded-lg border border-cyan-900/60 bg-cyan-950/30 p-2 text-cyan-100 break-words">{notice}</p>}
        {activities.map(a => {
          const appearance=agendaAppearance(a),active=expanded&&selected?.pageId===a.pageId;
          return <article key={a.pageId} className={'relative rounded-lg border-l-4 border p-2.5 transition-colors '+appearance.className+(active?' ring-1 ring-cyan-400/70':'')} onContextMenu={e=>{e.preventDefault();if(!saving)setMenu({pageId:a.pageId,x:e.clientX,y:e.clientY});}}>
            <div className="flex items-start gap-2">
              <button type="button" disabled={saving} aria-expanded={active} aria-label={'Ver pasos de '+calendarDisplayTitle(a.title,a.domain||'')} onClick={()=>{setSelectedId(a.pageId);setExpanded(true);}} className="min-w-0 flex-1 text-left">
                <span className="font-mono text-[11px] text-slate-300">{calendarTime(a.start)} – {calendarTime(a.end)}</span>
                <span className={'mt-1 block text-[10px] font-semibold '+appearance.text}>{appearance.label}{a.isReviewMirror?' · Copia de revisión':a.isHandoffMirror?' · Copia histórica':''}</span>
                <span className={'mt-1 block break-words font-medium leading-snug '+(appearance.state==='completed'?'text-slate-400 line-through':'text-slate-100')}>{calendarDisplayTitle(a.title,a.domain||'')}</span>
                {a.checklistScanned&&<span className="mt-1 block text-[10px] text-slate-400">{a.checklistCompleted} / {a.checklistTotal} pasos</span>}
              </button>
              <button type="button" disabled={saving} aria-label={'Acciones de '+calendarDisplayTitle(a.title,a.domain||'')} aria-haspopup="menu" className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-700" onClick={e=>{e.stopPropagation();const box=e.currentTarget.getBoundingClientRect();setMenu({pageId:a.pageId,x:box.left,y:box.bottom+4});}}>⋯</button>
            </div>
            {a.ftfVerified&&<span aria-label="Pasos FTF verificados para hoy" className="pointer-events-none absolute right-0 top-3 h-8 w-1 rounded-l bg-emerald-400 shadow-[0_0_8px_#34d399]"/>}
            {active&&<div className="mt-3" aria-busy={saving}><CalendarDetailPanel key={a.pageId} embedded isSaving={saving} activity={a} currentUser={currentUser} onClose={()=>setExpanded(false)} allActivities={activities} onSelectActivity={next=>{if(mexicoDate(next.start)!==day||normalizePerson(next.person)!==person)requestedSelection.current=next.pageId;setSelectedId(next.pageId);setExpanded(true);setItems(old=>old.some(a=>a.pageId===next.pageId)?old:[...old,next]);if(mexicoDate(next.start)!==day)setDay(mexicoDate(next.start));if(normalizePerson(next.person)!==person)selectPerson(next.person);}} onActivityUpdated={updates=>updateActivity(a.pageId,updates)} onChecklistUpdated={updates=>setItems(old=>old.map(item=>item.pageId===a.pageId?{...item,...updates}:item))}/></div>}
            {!active&&<div className="mt-2 flex justify-between border-t border-slate-700/50 pt-2 text-[11px]"><button type="button" disabled={saving} onClick={()=>{setSelectedId(a.pageId);setExpanded(true);}} className="text-cyan-300">Ver pasos y detalle</button><button type="button" className="text-sky-300" onClick={()=>openNotionPage(a.pageUrl||'https://www.notion.so/'+a.pageId.replace(/^review-mirror-/,'').replace(/-/g,''))}>Abrir Notion ↗</button></div>}
          </article>;
        })}

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
