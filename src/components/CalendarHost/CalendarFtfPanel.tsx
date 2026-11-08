"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { NotionCalendarActivity } from '@/types/anfeta';
import { calendarDisplayTitle, calendarDomain, calendarTime, mexicoDate } from '@/services/calendarPresentation';
import { buildFtfDashboard, canViewFtfDashboard } from '@/services/ftfDashboard';
import { normalizePerson } from '@/services/identityNormalizer';
import { CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, ShieldCheck, User } from 'lucide-react';

type Report = ReturnType<typeof buildFtfDashboard> & {
  warning?: string;
  automation?: { state: string; secretConfigured: boolean; actorConfigured: boolean; jobs: any[] };
};

export function CalendarFtfPanel({
  currentUser,
  date,
  onOpenActivity,
}: {
  currentUser: string;
  date: string;
  onOpenActivity: (activity: NotionCalendarActivity) => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [expandedPeople, setExpandedPeople] = useState<Record<string, boolean>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, { isOnline: boolean; lastSeenLabel?: string }>>({});

  useEffect(() => {
    const controller=new AbortController();
    const apply=(data:any)=>{
      if(!Array.isArray(data?.people))return;
      const map:Record<string,{isOnline:boolean;lastSeenLabel?:string}>={};
      for(const p of data.people)if(p.name)map[p.name]={isOnline:Boolean(p.isOnline),lastSeenLabel:p.lastSeenLabel};
      setPresenceMap(map);
    };
    const updated=(event:Event)=>{controller.abort();apply((event as CustomEvent).detail);};
    window.addEventListener('anfeta_team_presence',updated);
    // One bootstrap read; subsequent heartbeats come from the header, not a second timer.
    if(!document.hidden)void fetch('/api/presence',{cache:'no-store',signal:controller.signal})
      .then(res=>res.ok?res.json():null).then(data=>{if(!controller.signal.aborted)apply(data);}).catch(()=>{});
    return()=>{controller.abort();window.removeEventListener('anfeta_team_presence',updated);};
  }, [currentUser]);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('anfeta_bitacora_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('anfeta_bitacora_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const normUser = normalizePerson(currentUser);
  const canMarkReview = normUser === 'John' || normUser === 'Neftali';
  const reviewStorageKey = 'anfeta_bitacora_review:' + date;
  const [supervisorReview, setSupervisorReview] = useState<{ reviewer: string; reviewedAt: string } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(reviewStorageKey);
      if (saved) setSupervisorReview(JSON.parse(saved));
    } catch {}

    let active = true;
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-ftf-review', payload: { date } })
    })
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        if (data.success) {
          setSupervisorReview(data.review || null);
          try {
            if (data.review) localStorage.setItem(reviewStorageKey, JSON.stringify(data.review));
            else localStorage.removeItem(reviewStorageKey);
          } catch {}
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, [date, reviewStorageKey]);

  const toggleSupervisorReview = async () => {
    if (!canMarkReview) return;
    if (supervisorReview) {
      try {
        localStorage.removeItem(reviewStorageKey);
      } catch {}
      setSupervisorReview(null);
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-ftf-review', payload: { date, unmark: true, currentUser } })
      }).catch(() => {});
    } else {
      const reviewData = { reviewer: normUser, reviewedAt: new Date().toISOString() };
      try {
        localStorage.setItem(reviewStorageKey, JSON.stringify(reviewData));
      } catch {}
      setSupervisorReview(reviewData);
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-ftf-review', payload: { date, unmark: false, currentUser } })
      }).catch(() => {});
    }
  };

  const togglePersonExpand = (name: string) => {
    setExpandedPeople(prev => ({ ...prev, [name]: !prev[name] }));
  };

  useEffect(() => {
    setReport(null);
    setError('');
    if (!canViewFtfDashboard(currentUser)) return;
    const controller = new AbortController();
    let stopped = false,
      busy = false;

    const refresh = async () => {
      if (stopped || busy || document.hidden) return;
      busy = true;
      setLoading(true);
      try {
        const response = await fetch('/api/data?type=ftf-dashboard&date=' + encodeURIComponent(date), {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'No se pudo comprobar la Bitácora.');
        if (!stopped) {
          setReport(data);
          setError('');
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : 'No se pudo actualizar la Bitácora.');
      } finally {
        busy = false;
        if (!stopped) setLoading(false);
      }
    };

    void refresh();
    window.addEventListener('anfeta_review_saved', refresh);
    window.addEventListener('anfeta_calendar_refresh', refresh);
    return () => {
      stopped = true;
      controller.abort();
      window.removeEventListener('anfeta_review_saved', refresh);
      window.removeEventListener('anfeta_calendar_refresh', refresh);
    };
  }, [currentUser, date, revision]);

  if (!canViewFtfDashboard(currentUser)) return null;

  return (
    <section className="shrink-0 border-b border-cyan-900/50 bg-[#0B101B]/95 px-3 py-2.5 text-slate-200">
      {/* Header General */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex items-center gap-1.5 font-semibold text-cyan-200 text-xs hover:text-cyan-100 transition-colors cursor-pointer text-left"
            title={isCollapsed ? 'Clic para desplegar bitácora' : 'Clic para plegar bitácora'}
          >
            <ShieldCheck size={16} className="text-cyan-400" />
            <span>Bitácora del equipo (FTF) · {date}</span>
            {isCollapsed ? (
              <ChevronDown size={14} className="text-cyan-400 ml-0.5" />
            ) : (
              <ChevronUp size={14} className="text-cyan-400 ml-0.5" />
            )}
          </button>

          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span className="rounded bg-slate-800/80 px-2 py-0.5 border border-slate-700 text-slate-300 font-mono">
              ⏱ Jornada: 10:00 a 18:00 (8 hrs)
            </span>

            {report && (
              <>
                <span className="rounded bg-cyan-950/60 px-2 py-0.5 border border-cyan-800/60 text-cyan-200 font-mono">
                  {report.totalAssignedHours}h asignadas · {report.totalCompletedHours || 0}h terminadas
                </span>
                {(report as any).weeklyTargetPerPerson > 0 && (
                  <span
                    className="rounded bg-indigo-950/60 px-2 py-0.5 border border-indigo-800/60 text-indigo-200 font-mono"
                    title="Meta acumulada de 6.5h efectivas diarias (Lunes a Viernes)"
                  >
                    🎯 Meta semana: {(report as any).weeklyTargetPerPerson}h ({(report as any).workDaysElapsed}d × 6.5h)
                  </span>
                )}
                <span className="text-slate-400">
                  <strong className="text-emerald-400">{report.completed}</strong> al día ·{' '}
                  <strong className="text-amber-400">{report.pending}</strong> pendientes
                  {report.late > 0 && <span className="text-rose-400"> · {report.late} tarde</span>}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Supervisor, Botón Actualizar y Botón Plegar / Desplegar */}
        <div className="flex items-center gap-2">
          {supervisorReview ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/60 bg-emerald-950/50 px-2.5 py-1 text-xs text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>
                Bitácora revisada por <strong>{supervisorReview.reviewer}</strong>
                {supervisorReview.reviewedAt && (
                  <span className="text-[10.5px] text-emerald-300/80 ml-1 font-mono">
                    ({new Date(supervisorReview.reviewedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' })})
                  </span>
                )}
              </span>
              {canMarkReview && (
                <button
                  type="button"
                  onClick={toggleSupervisorReview}
                  className="ml-1 text-[10px] text-slate-400 underline hover:text-white cursor-pointer"
                >
                  Desmarcar
                </button>
              )}
            </div>
          ) : canMarkReview ? (
            <button
              type="button"
              onClick={toggleSupervisorReview}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-600/70 bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-900/60 cursor-pointer"
              title="Marcar que el supervisor ya revisó y cuadró la bitácora del día"
            >
              <CheckCircle2 size={13} />
              <span>✓ Ya revisé bitácora</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/40 px-2.5 py-1 text-xs text-slate-400">
              <Clock size={12} className="text-slate-500" />
              <span>Bitácora pendiente de revisión</span>
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => setRevision(v => v + 1)}
            className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-xs text-cyan-200 transition-colors hover:bg-slate-800 disabled:opacity-50"
            title="Recargar bitácora"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Comprobando…' : 'Actualizar'}</span>
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex items-center gap-1.5 rounded border border-cyan-800/80 bg-cyan-950/60 px-2.5 py-1 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-600 hover:bg-cyan-900/70"
            title={isCollapsed ? 'Desplegar bitácora' : 'Plegar / Cerrar despliegue de bitácora'}
          >
            {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            <span>{isCollapsed ? 'Desplegar' : 'Plegar'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-2 rounded border border-rose-800/60 bg-rose-950/40 p-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Grid de Colaboradores: items-start evita deformación de filas al desplegar */}
      {report && !isCollapsed && (
        <div className="mt-3 grid max-h-[380px] grid-cols-1 gap-2.5 overflow-y-auto pr-1 items-start sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {report.people.map(person => {
            const isComplete = person.status === 'complete';
            const isPending = person.status === 'pending';
            const isEmpty = person.status === 'empty';
            const isExpanded = !!expandedPeople[person.name];

            const percent = person.total > 0 ? Math.round((person.verified / person.total) * 100) : 0;
            let completionTime = person.completedAt ? calendarTime(person.completedAt) : null;
            const lastEditTime = person.lastActivityEdited ? calendarTime(person.lastActivityEdited) : null;

            // Evitar mostrar 00:00 cuando existe una hora real de edición en Notion
            if ((!completionTime || completionTime === '00:00') && lastEditTime && lastEditTime !== '00:00') {
              completionTime = lastEditTime;
            }
            const hasValidCompletionTime = completionTime && completionTime !== '00:00';
            const hasValidLastEditTime = lastEditTime && lastEditTime !== '00:00';

            return (
              <div
                key={person.name}
                className={`rounded-xl border transition-all ${
                  isComplete
                    ? 'border-emerald-600/40 bg-emerald-950/20'
                    : isPending
                    ? 'border-amber-600/40 bg-amber-950/20'
                    : 'border-slate-800 bg-slate-900/40 opacity-75'
                } p-2.5 shadow-md`}
              >
                {/* Cabecera del colaborador */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-[10px] ${
                        isComplete
                          ? 'bg-emerald-900 text-emerald-200 border border-emerald-500'
                          : isPending
                          ? 'bg-amber-900 text-amber-200 border border-amber-500'
                          : 'bg-slate-800 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {person.name.slice(0, 2).toUpperCase()}
                      {presenceMap[person.name]?.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0B101B]" title="En línea" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-xs text-slate-100">{person.name}</span>
                        {presenceMap[person.name] && (
                          <span
                            className={`text-[9.5px] px-1 py-0.2 rounded font-mono ${
                              presenceMap[person.name].isOnline
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50'
                                : 'text-slate-400'
                            }`}
                            title={presenceMap[person.name].isOnline ? 'En línea en ANFETA' : `Última conexión: ${presenceMap[person.name].lastSeenLabel || 'Desconectado'}`}
                          >
                            {presenceMap[person.name].isOnline ? `🟢 ${presenceMap[person.name].lastSeenLabel || 'En línea'}` : presenceMap[person.name].lastSeenLabel || 'Desconectado'}
                          </span>
                        )}
                        {person.role && (
                          <span className="text-[10px] text-slate-400 truncate">({person.role})</span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-slate-400">
                        {person.verified}/{person.total} checks · {person.assignedHours || 0}h asignadas
                      </div>
                    </div>
                  </div>

                  {/* Estado / Horario */}
                  <div className="shrink-0 text-right">
                    {isComplete ? (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-300 border border-emerald-500/50"
                        title={person.lastActivityEdited ? `Última edición en Notion: ${person.lastActivityEdited}` : (person.completedAt ? `Registrado: ${person.completedAt}` : undefined)}
                      >
                        <CheckCircle2 size={11} />
                        <span>{hasValidCompletionTime ? completionTime : 'Completó'}</span>
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-900/60 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-300 border border-amber-500/50">
                        <Clock size={11} />
                        <span>{person.pending.length} pend.</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">Sin horario</span>
                    )}
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>Avance: {percent}%</span>
                    <span>
                      {person.completedHours || 0}h / {person.assignedHours || 0}h
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isComplete ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-slate-600'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Información de primera actividad y último registro */}
                <div className="mt-1.5 text-[10px] text-slate-400 flex items-center justify-between">
                  <span title={(person as any).firstActivityStart ? `Primera actividad programada: ${(person as any).firstActivityStart}` : undefined}>
                    1ª act: <strong className="text-slate-300 font-mono">{(person as any).firstActivityStart ? calendarTime((person as any).firstActivityStart) : '--:--'}</strong>
                  </span>
                  <span title={person.lastActivityEdited ? `Última edición en Notion: ${person.lastActivityEdited}` : undefined}>
                    {isComplete
                      ? `Fin: ${hasValidCompletionTime ? completionTime : hasValidLastEditTime ? lastEditTime : 'hoy'}`
                      : hasValidLastEditTime
                      ? `Último: ${lastEditTime}`
                      : 'Sin cambios'}
                  </span>
                  {person.late && <span className="font-semibold text-rose-400">Tarde (&gt;18:00)</span>}
                </div>

                {/* Desplegable de Actividades Pendientes (con scroll interno de max-h-40) */}
                {person.pending.length > 0 && (
                  <div className="mt-2 border-t border-slate-800/80 pt-1.5">
                    <button
                      type="button"
                      onClick={() => togglePersonExpand(person.name)}
                      className="flex w-full items-center justify-between rounded px-1.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-slate-800/60"
                    >
                      <span>
                        {isExpanded ? 'Ocultar' : 'Ver'} {person.pending.length} actividad
                        {person.pending.length > 1 ? 'es' : ''} pendiente
                        {person.pending.length > 1 ? 's' : ''}
                      </span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {isExpanded && (
                      <div className="mt-1 max-h-40 overflow-y-auto space-y-1.5 pr-1 select-text">
                        {person.pending.map(activity => (
                          <button
                            type="button"
                            key={activity.pageId}
                            onClick={() => onOpenActivity(activity)}
                            className="block w-full rounded border border-slate-800 bg-slate-950/80 p-2 text-left text-[10.5px] text-slate-200 transition-colors hover:border-cyan-500 hover:bg-slate-900"
                          >
                            <div className="flex items-center justify-between text-cyan-300 font-mono text-[10px] mb-0.5">
                              <span>{calendarTime(activity.start)}</span>
                              <span className="truncate max-w-[120px]">{calendarDomain(activity.title)}</span>
                            </div>
                            <div className="line-clamp-2 text-slate-200 font-normal">
                              {calendarDisplayTitle(activity.title, calendarDomain(activity.title))}
                            </div>
                            {!activity.ftfAvailable && (
                              <span className="mt-1 block text-[10px] text-amber-300">
                                ⚠ Falta la casilla FTF en Notion.
                              </span>
                            )}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => togglePersonExpand(person.name)}
                          className="mt-1 flex w-full items-center justify-center gap-1 rounded py-1 text-[10.5px] font-medium text-amber-300/80 hover:bg-slate-800/80 hover:text-amber-200 border-t border-slate-800/60"
                        >
                          <ChevronUp size={12} />
                          <span>Cerrar pendientes</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
