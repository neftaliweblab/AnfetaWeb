"use client";
import {openNotionPage} from '@/services/windowsIntegration';
import React,{useEffect,useMemo,useState} from 'react';
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

  const selectPerson = (newPerson: string) => {
    const norm = normalizePerson(newPerson);
    setPerson(norm);
    try {
      sessionStorage.setItem(SESSION_PERSON_KEY, norm);
    } catch {}
  };

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);
    setError('');
    setItems([]);
    fetch('/api/data?type=calendar&basic=1&date='+encodeURIComponent(day),{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok)throw Error(data.error||'No se pudo cargar el calendario.');
        if(!controller.signal.aborted){
          setItems(data.activities||[]);
          setError(data.warning||'');
        }
      })
      .catch(e=>{
        if(!controller.signal.aborted)setError(e.message);
      })
      .finally(()=>{
        if(!controller.signal.aborted)setLoading(false);
      });
    return()=>controller.abort();
  },[day,currentUser,retry]);

  useEffect(()=>{
    const refresh=()=>setRetry(n=>n+1);
    window.addEventListener('anfeta_data_refreshed',refresh);
    return()=>window.removeEventListener('anfeta_data_refreshed',refresh);
  },[]);

  const activities=useMemo(
    ()=>items.filter(a=>normalizePerson(a.person)===person).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)),
    [items,person]
  );

  return (
    <aside aria-label="Calendario individual" className="w-[340px] h-full flex flex-col border-l border-slate-800 bg-[#0F141C] p-3 text-xs">
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
                onClick={() => selectPerson(name)}
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
            type="date"
            value={day}
            onChange={e=>{if(e.target.value)setDay(e.target.value);}}
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 text-xs"
          />
          <button
            type="button"
            onClick={()=>setDay(mexicoDate())}
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
        {activities.map(a => (
          <article
            key={a.pageId+String(a.isReviewMirror)}
            className="rounded-lg border border-slate-800 hover:border-slate-700 bg-[#141B24] p-2.5 transition-colors"
          >
            <p className="font-mono text-slate-300 text-[11px] font-medium tracking-tight">
              {calendarTime(a.start)} – {calendarTime(a.end)}
            </p>
            <p className="mt-1 text-slate-100 font-medium leading-snug">
              {calendarDisplayTitle(a.title, a.domain||'')}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
              <span className="text-slate-400">{a.status}</span>
              <button
                type="button"
                className="text-[#38BDF8] hover:text-white hover:underline transition-colors"
                onClick={()=>openNotionPage('https://www.notion.so/'+a.pageId.replace(/-/g,''))}
              >
                Abrir Notion ↗
              </button>
            </div>
          </article>
        ))}
      </div>

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
