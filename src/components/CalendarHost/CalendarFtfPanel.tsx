"use client";
import React, { useEffect, useState } from 'react';
import { NotionCalendarActivity } from '@/types/anfeta';
import { calendarDisplayTitle, calendarDomain, calendarTime, mexicoDate } from '@/services/calendarPresentation';
import { buildFtfDashboard, canViewFtfDashboard, shiftFtfDate } from '@/services/ftfDashboard';
import { ExternalLink } from 'lucide-react';
import {CalendarFtfWeek, ftfHours} from './CalendarFtfWeek';
import { normalizePerson } from '@/services/identityNormalizer';
import { CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, ShieldCheck, User, LogIn, Activity, Copy, Check, Star, Send, SlidersHorizontal, Award } from 'lucide-react';
import { computeHybridFtfScore, SavedFtfScoreEntry } from '@/services/ftfScoring';


function formatSignalTime(isoString: string | null | undefined, selectedDay: string): string {
  if (!isoString || !Number.isFinite(Date.parse(isoString))) return '--:--';
  const time = calendarTime(isoString);
  const day = mexicoDate(isoString);
  if (day === selectedDay) return time;
  const prevDay = shiftFtfDate(selectedDay, -1);
  if (day === prevDay) return `Ayer ${time}`;
  return `${day.slice(8, 10)}/${day.slice(5, 7)} ${time}`;
}

type Report = ReturnType<typeof buildFtfDashboard> & {
  warning?: string;
  automation?: { state: string; secretConfigured: boolean; actorConfigured: boolean; jobs: any[] };
};

export function CalendarFtfPanel({
  currentUser,
  date,
  onOpenActivity,
  onSelectDate,
  onOpenDailyProgress,
}: {
  currentUser: string;
  date: string;
  onOpenActivity: (activity: NotionCalendarActivity) => void;
  onSelectDate?: (date: string) => void;
  onOpenDailyProgress?: () => void;
}) {
  const [showWeek, setShowWeek] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [expandedPeople, setExpandedPeople] = useState<Record<string, boolean>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, { isOnline: boolean; lastSeenLabel?: string; lastSeen?: string }>>({});

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
  const [scoresMap, setScoresMap] = useState<Record<string, Partial<SavedFtfScoreEntry>>>({});
  const [openScorerFor, setOpenScorerFor] = useState<string | null>(null);
  const [publishingScores, setPublishingScores] = useState(false);
  const [publishNotice, setPublishNotice] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-ftf-scores', payload: { date } })
    })
      .then(res => res.json())
      .then(data => {
        if (active && data.success && data.scores) setScoresMap(data.scores);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [date, revision]);

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

  const computePersonScore = (person: Report['people'][number], targetDay: string) => {
    const pres = presenceMap[person.name];
    return computeHybridFtfScore(
      {
        name: person.name,
        assignedHours: person.assignedHours || 0,
        completedHours: person.completedHours || 0,
        verified: person.verified || 0,
        total: person.total || 0,
        ftfPendingAssignmentMinutes: person.pendingAssignmentMinutes || 0,
        status: person.status,
        late: person.late,
        completedAt: person.completedAt,
        lastActivityEdited: person.lastActivityEdited,
        firstSignalAt: (person as any).firstSignal || (person as any).firstSeen,
        lastSignalAt: (person as any).lastSignal || pres?.lastSeen,
        isOnline: pres?.isOnline,
        afterCutoffHours: (person as any).afterCutoffHours || 0,
      },
      targetDay,
      scoresMap[person.name],
      {
        pendingTitles: person.pending.map(a => calendarDisplayTitle(a.title, calendarDomain(a.title))),
      }
    );
  };

  const savePersonScore = async (
    person: Report['people'][number],
    patch: Partial<SavedFtfScoreEntry>
  ) => {
    if (!canMarkReview || !report) return;
    const mergedSaved: Partial<SavedFtfScoreEntry> = {
      ...(scoresMap[person.name] || {}),
      ...patch,
      starsOverride: {
        ...(scoresMap[person.name]?.starsOverride || {}),
        ...(patch.starsOverride || {}),
      },
    };
    const nextComputed = computeHybridFtfScore(
      {
        name: person.name,
        assignedHours: person.assignedHours || 0,
        completedHours: person.completedHours || 0,
        verified: person.verified || 0,
        total: person.total || 0,
        ftfPendingAssignmentMinutes: person.pendingAssignmentMinutes || 0,
        status: person.status,
        late: person.late,
        completedAt: person.completedAt,
        lastActivityEdited: person.lastActivityEdited,
        firstSignalAt: (person as any).firstSignal || (person as any).firstSeen,
        lastSignalAt: (person as any).lastSignal || presenceMap[person.name]?.lastSeen,
        isOnline: presenceMap[person.name]?.isOnline,
        afterCutoffHours: (person as any).afterCutoffHours || 0,
      },
      report.day,
      mergedSaved,
      {
        pendingTitles: person.pending.map(a => calendarDisplayTitle(a.title, calendarDomain(a.title))),
      }
    );
    setScoresMap(prev => ({ ...prev, [person.name]: nextComputed }));
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-ftf-score',
          payload: { date: report.day, person: person.name, entry: nextComputed, currentUser }
        })
      });
    } catch {}
  };

  const handlePublishCutoff = async () => {
    if (!canMarkReview || !report || publishingScores) return;
    setPublishingScores(true);
    setPublishNotice('');
    try {
      const entries = report.people.map(p => computePersonScore(p, report.day));
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish-ftf-scores',
          payload: { date: report.day, entries, currentUser }
        })
      });
      const data = await res.json();
      if (data.success && data.scores) {
        setScoresMap(data.scores);
        setPublishNotice('✓ Corte 18:30 publicado y enviado al equipo');
        setTimeout(() => setPublishNotice(''), 4000);
      }
    } catch {
      setPublishNotice('No se pudo publicar el corte');
    } finally {
      setPublishingScores(false);
    }
  };

  const [copiedReport, setCopiedReport] = useState(false);

  const handleCopyReport = () => {
    if (!report) return;
    const lines: string[] = [
      `📊 *Reporte Diario ANFETA · Bitácora FTF & Puntajes*`,
      `📅 *Fecha:* ${date} · Corte 18:30`,
      `⏱ *Horas asignadas:* ${report.totalAssignedHours}h | *Con FTF verificado:* ${report.totalCompletedHours || 0}h`,
      `📈 *Estado:* ${report.completed} al día · ${report.pending} pendientes${report.late > 0 ? ` · ${report.late} tarde` : ''}`,
      ``,
      `👥 *Avance y Puntaje por Colaborador:*`,
    ];

    for (const person of report.people) {
      const pct = person.total > 0 ? Math.round((person.verified / person.total) * 100) : 0;
      const sc = computePersonScore(person, report.day);
      const starsStr = `${sc.stars.star1 ? '★' : '☆'}${sc.stars.star2 ? '★' : '☆'}${sc.stars.star3 ? '★' : '☆'}`;
      const icon = sc.absent ? '🚫' : sc.finalScore >= 85 ? '🌟' : person.status === 'complete' ? '✅' : person.status === 'pending' ? '⏳' : '⚪';
      const pendingCount = Array.isArray(person.pending) ? person.pending.length : Number(person.pending) || 0;
      const pendingText = pendingCount > 0 ? ` (${pendingCount} pend.)` : '';
      const extraText = sc.overtimeHours > 0 ? ` · +${sc.overtimeHours}h Extra Bono` : '';
      lines.push(`${icon} *${person.name}*: *${sc.finalScore}/100 pts* [${starsStr}] · ${pct}% · ${person.completedHours || 0}h/${person.assignedHours || 0}h · ${person.verified}/${person.total}${pendingText}${extraText}`);
    }

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    }).catch(() => {});
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
          <div className="flex items-center gap-1 mr-1">
            <button
              type="button"
              onClick={() => onSelectDate?.(shiftFtfDate(date, -1))}
              className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
              title="Ver día anterior"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => onSelectDate?.(shiftFtfDate(date, 1))}
              className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
              title="Ver día siguiente"
            >
              ▶
            </button>
          </div>
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
              ⏱ Jornada: 10:00 – 18:00 · Corte 18:30
            </span>

            {report && (
              <>
                <span className="rounded bg-cyan-950/60 px-2 py-0.5 border border-cyan-800/60 text-cyan-200 font-mono">
                  {report.totalAssignedHours}h asignadas · {report.totalCompletedHours || 0}h con FTF verificado
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
          <button type="button" aria-expanded={showWeek} onClick={() => setShowWeek(value => !value)} className="rounded border border-cyan-800 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-950/60 cursor-pointer">
            {showWeek ? 'Ocultar matriz semanal' : 'Matriz semanal · Pagos'}
          </button>
          {canMarkReview && report && (
            <button
              type="button"
              disabled={publishingScores}
              onClick={handlePublishCutoff}
              className="flex items-center gap-1.5 rounded border border-indigo-500/70 bg-indigo-950/60 px-2.5 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-900/70 transition-colors cursor-pointer disabled:opacity-50"
              title="Publicar calificaciones 0–100 del corte 18:30 y enviar resumen individual a cada colaborador"
            >
              <Send size={12} className="text-indigo-300" />
              <span>{publishingScores ? 'Enviando…' : 'Corte 18:30 · Enviar calif.'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyReport}
            disabled={!report}
            className="flex items-center gap-1.5 rounded border border-cyan-700/80 bg-cyan-950/50 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-900/60 transition-colors disabled:opacity-40 cursor-pointer"
            title="Copiar reporte diario para WhatsApp o Slack"
          >
            {copiedReport ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copiedReport ? '✓ Copiado' : 'Copiar reporte'}</span>
          </button>
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

      {showWeek && <CalendarFtfWeek date={date} />}

      {publishNotice && (
        <div role="status" className="mt-2 rounded border border-indigo-500/60 bg-indigo-950/50 px-2.5 py-1.5 text-xs text-indigo-200 flex items-center justify-between">
          <span>{publishNotice}</span>
          <button type="button" onClick={() => setPublishNotice('')} className="text-indigo-300 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

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
            const completionTime = person.completedAt ? calendarTime(person.completedAt) : null;
            const lastEditTime = person.lastActivityEdited ? calendarTime(person.lastActivityEdited) : null;
            const scoreInfo = computePersonScore(person, report.day);
            const isScorerOpen = openScorerFor === person.name;
            const scoreBadgeClass = scoreInfo.absent
              ? 'border-rose-500/80 bg-rose-950/80 text-rose-200'
              : scoreInfo.finalScore >= 85
              ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : scoreInfo.finalScore >= 50
              ? 'border-amber-400/75 bg-amber-500/20 text-amber-200'
              : 'border-rose-400/80 bg-rose-500/20 text-rose-200';

            return (
              <div
                key={person.name}
                className={`rounded-xl border transition-all ${
                  scoreInfo.absent
                    ? 'border-rose-700/50 bg-rose-950/15'
                    : isComplete
                    ? 'border-emerald-600/40 bg-emerald-950/20'
                    : isPending
                    ? 'border-amber-600/40 bg-amber-950/20'
                    : 'border-slate-800 bg-slate-900/40 opacity-85'
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
                            className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 ${
                              presenceMap[person.name].isOnline
                                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-600/60'
                                : 'bg-slate-900/60 text-slate-400 border border-slate-700/50'
                            }`}
                            title={presenceMap[person.name].isOnline ? 'En línea en ANFETA' : `Última conexión: ${presenceMap[person.name].lastSeenLabel || 'Desconectado'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${presenceMap[person.name].isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                            <span>{presenceMap[person.name].isOnline ? 'En línea' : 'Desconectado'}</span>
                          </span>
                        )}
                        {person.role && (
                          <span className="text-[10px] text-slate-400 truncate">({person.role})</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] text-slate-400 gap-2">
                        <span>{person.verified}/{person.total} checks · {person.assignedHours || 0}h asignadas</span>
                        {onOpenDailyProgress && (
                          <button
                            type="button"
                            onClick={() => onOpenDailyProgress()}
                            className="inline-flex items-center gap-0.5 text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                            title="Abrir módulo de Avance Diario para ver desglose detallado"
                          >
                            <span>Avance</span>
                            <ExternalLink size={9} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Estado / Puntaje 0-100 */}
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold font-mono border ${scoreBadgeClass}`}
                      title={`Puntaje diario: ${scoreInfo.finalScore}/100 · Asistencia ${scoreInfo.breakdown.attendance}/20 · Cobertura FTF ${scoreInfo.breakdown.coverage}/20 · Avances ${scoreInfo.breakdown.progress}/35 · Cierre 18:30 ${scoreInfo.breakdown.ftfFinal}/25${scoreInfo.published ? ' (Publicado)' : ''}`}
                    >
                      <Award size={11} />
                      <span>{scoreInfo.finalScore} pts</span>
                    </span>
                    {isComplete ? (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-emerald-900/60 px-1.5 py-0.2 text-[9.5px] font-semibold text-emerald-300 border border-emerald-500/50"
                        title={person.timeKind === 'confirmed' ? 'Confirmación FTF' : 'FTF observado'}
                      >
                        <CheckCircle2 size={10} />
                        <span>{completionTime || 'Completó'}</span>
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-900/60 px-1.5 py-0.2 text-[9.5px] font-medium text-amber-300 border border-amber-500/50">
                        <Clock size={10} />
                        <span>{person.pending.length} pend.</span>
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-slate-500 italic">{scoreInfo.absent ? 'Falta (0 pts)' : 'Sin horario'}</span>
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

                {/* Conexiones & Horarios: 1ª señal y Última señal juntas con iconos */}
                {(() => {
                  const isOnlineNow = !!presenceMap[person.name]?.isOnline;
                  const firstSignalIso = (person as any).firstSeen || (person as any).firstActivityStart;
                  const firstDisplay = formatSignalTime(firstSignalIso, report.day);
                  const firstTitle = (person as any).firstSeen
                    ? `1ª conexión en ANFETA: ${(person as any).firstSeen}`
                    : (person as any).firstActivityStart
                    ? `1ª actividad programada: ${(person as any).firstActivityStart}`
                    : 'Sin registro de primera señal';

                  const personLastActivity = person.lastActivityEdited;
                  const presenceLastSeen = presenceMap[person.name]?.lastSeen || (person as any).presenceLastSeen;
                  const lastCandidates = [presenceLastSeen, personLastActivity].filter(
                    (v): v is string => Boolean(v && Number.isFinite(Date.parse(v)))
                  );
                  lastCandidates.sort();
                  const effectiveLast = lastCandidates.at(-1) || null;

                  const lastDisplay = isOnlineNow
                    ? 'En línea'
                    : effectiveLast
                    ? formatSignalTime(effectiveLast, report.day)
                    : (lastEditTime || 'Sin cambios');

                  const lastTitle = isOnlineNow
                    ? 'En línea en este momento en ANFETA'
                    : effectiveLast === personLastActivity
                    ? `Última edición en Notion: ${personLastActivity}`
                    : presenceLastSeen
                    ? `Última conexión ANFETA: ${presenceLastSeen}`
                    : 'Sin registro de última señal';

                  return (
                    <div className="mt-2 rounded-lg bg-slate-950/70 border border-slate-800/90 px-2.5 py-1.5 flex items-center justify-between text-[10px] font-mono shadow-inner">
                      <div className="flex items-center gap-1.5" title={firstTitle}>
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <LogIn size={11} className="text-emerald-400" />
                          <span>1ª señal:</span>
                        </span>
                        <span className="text-slate-200 font-bold">
                          {firstDisplay}
                        </span>
                      </div>

                      <span className="text-slate-700">|</span>

                      <div className="flex items-center gap-1.5" title={lastTitle}>
                        <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                          <Activity size={11} className="text-cyan-400" />
                          <span>Última señal:</span>
                        </span>
                        <span className="text-slate-200 font-bold truncate max-w-[120px] flex items-center gap-1">
                          {isOnlineNow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          <span>{lastDisplay}</span>
                        </span>
                      </div>
                      {person.late && <span className="font-semibold text-rose-400 ml-1">⚠ Tarde</span>}
                    </div>
                  );
                })()}

                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                  <span className={scoreInfo.coverageState === 'complete' ? 'text-emerald-300 font-medium' : 'text-cyan-200'}>
                    {scoreInfo.coverageState === 'complete'
                      ? '✓ Agenda llena sin huecos'
                      : `Por asignar (dinámico): ${ftfHours(person.pendingAssignmentMinutes)}`}
                  </span>
                  {scoreInfo.overtimeHours > 0 && (
                    <span
                      className="rounded-full bg-violet-950/80 border border-violet-400/60 px-1.5 py-0.2 text-[9.5px] font-bold text-violet-200 font-mono"
                      title="Horas extra trabajadas después del corte 18:30 tras cumplir la jornada normal"
                    >
                      +{scoreInfo.overtimeHours}h Bono Extra
                    </span>
                  )}
                </div>

                {/* 3 Tiempos / Estrellas Interactivas + Tabulador del Supervisor */}
                <div className="mt-1.5 flex items-center justify-between gap-1 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {[
                      {
                        key: 'star1' as const,
                        label: 'FTF',
                        active: scoreInfo.stars.star1,
                        tip:
                          scoreInfo.coverageState === 'complete'
                            ? 'Tiempo 1: Agenda llena sin huecos (completo)'
                            : 'Tiempo 1 (Dinámico): se marca completo automáticamente al llenar las horas del día',
                      },
                      {
                        key: 'star2' as const,
                        label: 'Avance',
                        active: scoreInfo.stars.star2,
                        tip: 'Tiempo 2: Avances, checks y tareas terminadas durante el día',
                      },
                      {
                        key: 'star3' as const,
                        label: 'Cierre',
                        active: scoreInfo.stars.star3,
                        tip: 'Tiempo 3: FTF Final completado antes del corte 18:30',
                      },
                    ].map(st => (
                      <button
                        key={st.key}
                        type="button"
                        disabled={!canMarkReview}
                        onClick={() => {
                          if (!canMarkReview) return;
                          void savePersonScore(person, {
                            starsOverride: { [st.key]: !st.active },
                          });
                        }}
                        title={canMarkReview ? `${st.tip} · Clic para alternar manualmente` : st.tip}
                        className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9.5px] font-semibold border transition-colors ${
                          st.active
                            ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                            : 'border-slate-700/80 bg-slate-900/80 text-slate-500'
                        } ${canMarkReview ? 'cursor-pointer hover:border-amber-300' : 'cursor-default'}`}
                      >
                        <Star size={10} fill={st.active ? 'currentColor' : 'none'} className={st.active ? 'text-amber-300' : 'text-slate-500'} />
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>
                  {canMarkReview && (
                    <button
                      type="button"
                      onClick={() => setOpenScorerFor(isScorerOpen ? null : person.name)}
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-medium border cursor-pointer transition-colors ${
                        isScorerOpen
                          ? 'border-cyan-400 bg-cyan-950/70 text-cyan-200'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-cyan-600'
                      }`}
                      title="Abrir tabulador manual 0–100 y nota de retroalimentación"
                    >
                      <SlidersHorizontal size={10} />
                      <span>Calificar</span>
                    </button>
                  )}
                </div>

                {scoreInfo.supervisorNote && !isScorerOpen && (
                  <p className="mt-1 rounded bg-indigo-950/35 border border-indigo-500/30 px-2 py-1 text-[10px] text-indigo-200">
                    📝 {scoreInfo.supervisorNote}
                  </p>
                )}

                {/* Panel Tabulador del Supervisor */}
                {canMarkReview && isScorerOpen && (
                  <div className="mt-1.5 rounded-lg border border-cyan-500/40 bg-slate-950/90 p-2 space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-cyan-200">Tabulador (Auto: {scoreInfo.autoScore})</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            void savePersonScore(person, {
                              absent: !scoreInfo.absent,
                              manualScoreOverride: null,
                            })
                          }
                          className={`px-1.5 py-0.5 rounded border text-[9px] font-bold cursor-pointer ${
                            scoreInfo.absent
                              ? 'border-rose-400 bg-rose-500/30 text-rose-100'
                              : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-rose-200'
                          }`}
                        >
                          {scoreInfo.absent ? '✓ Falta (0 pts)' : 'Marcar falta'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void savePersonScore(person, {
                              manualScoreOverride: null,
                              absent: false,
                              starsOverride: {},
                            })
                          }
                          className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-[9px] cursor-pointer"
                          title="Restaurar cálculo automático"
                        >
                          Auto
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={scoreInfo.finalScore}
                        onChange={(e) =>
                          void savePersonScore(person, {
                            manualScoreOverride: Number(e.target.value),
                            absent: false,
                          })
                        }
                        className="flex-1 accent-cyan-400"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scoreInfo.finalScore}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          void savePersonScore(person, { manualScoreOverride: v, absent: false });
                        }}
                        className="w-12 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-center font-mono font-bold text-cyan-200"
                      />
                    </div>
                    <input
                      type="text"
                      defaultValue={scoreInfo.supervisorNote || ''}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (scoreInfo.supervisorNote || '')) {
                          void savePersonScore(person, { supervisorNote: val });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="Nota para el colaborador (Enter para guardar)..."
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                )}

                {/* Actividades del colaborador (Pendientes y Terminadas) */}
                {((person as any).completedActivities?.length > 0 && person.pending.length === 0) && (
                  <div className="mt-2 border-t border-slate-800/80 pt-1.5">
                    <button
                      type="button"
                      onClick={() => togglePersonExpand(person.name)}
                      className="flex w-full items-center justify-between rounded px-1.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-slate-800/60"
                    >
                      <span>
                        {isExpanded ? 'Ocultar' : 'Ver'} {(person as any).completedActivities.length} actividad{(person as any).completedActivities.length > 1 ? 'es' : ''} terminada{(person as any).completedActivities.length > 1 ? 's' : ''}
                      </span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {isExpanded && (
                      <div className="mt-1 max-h-40 overflow-y-auto space-y-1.5 pr-1 select-text">
                        {(person as any).completedActivities.map((activity: any) => (
                          <button
                            type="button"
                            key={activity.pageId}
                            onClick={() => onOpenActivity(activity)}
                            className="block w-full rounded border border-emerald-950/60 bg-emerald-950/20 p-2 text-left text-[10.5px] text-slate-300 transition-colors hover:border-emerald-500 hover:bg-slate-900"
                          >
                            <div className="flex items-center justify-between text-emerald-400 font-mono text-[10px] mb-0.5">
                              <span>✓ {calendarTime(activity.start)}</span>
                              <span className="truncate max-w-[120px]">{calendarDomain(activity.title)}</span>
                            </div>
                            <div className="line-clamp-2 text-slate-300 font-normal">
                              {calendarDisplayTitle(activity.title, calendarDomain(activity.title))}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
