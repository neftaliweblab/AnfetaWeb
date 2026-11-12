"use client";
import React, { useEffect, useState } from 'react';
import { NotionCalendarActivity } from '@/types/anfeta';
import { calendarDisplayTitle, calendarDomain, calendarTime, mexicoDate } from '@/services/calendarPresentation';
import { buildFtfDashboard, canViewFtfDashboard, shiftFtfDate } from '@/services/ftfDashboard';
import { ExternalLink } from 'lucide-react';
import {CalendarFtfWeek, ftfHours} from './CalendarFtfWeek';
import { normalizePerson } from '@/services/identityNormalizer';
import { workflowState } from '@/services/activityWorkflow';
import { CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, ShieldCheck, User, LogIn, Activity, Copy, Check, Star, StarHalf, Send, SlidersHorizontal, Award } from 'lucide-react';
import { computeHybridFtfScore, FtfStarValue, normalizeStarValue, SavedFtfScoreEntry, starWeight } from '@/services/ftfScoring';

function nextStarCycle(current: FtfStarValue): number {
  const w = starWeight(current);
  if (w >= 0.99) return 0.5;
  if (w >= 0.25) return 0;
  return 1;
}

function starGlyph(value: FtfStarValue): string {
  const w = starWeight(value);
  return w >= 0.99 ? '★' : w >= 0.25 ? '◐' : '☆';
}


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

  const buildScoreInput = (person: Report['people'][number]) => {
    const pres = presenceMap[person.name];
    return {
      name: person.name,
      assignedHours: person.assignedHours || 0,
      completedHours: person.completedHours || 0,
      workCompletedHours: (person as any).workCompletedHours || 0,
      reviewHours: (person as any).reviewHours || 0,
      inProgressHours: (person as any).inProgressHours || 0,
      ftfVerifiedHours: (person as any).ftfVerifiedHours || 0,
      expiredUnfinishedCount: (person as any).expiredUnfinishedCount || 0,
      verified: person.verified || 0,
      total: person.total || 0,
      ftfPendingAssignmentMinutes: person.pendingAssignmentMinutes || 0,
      status: person.status,
      late: person.late,
      completedAt: person.completedAt,
      lastActivityEdited: person.lastActivityEdited,
      // Presencia real ANFETA (nunca hora inventada de calendario)
      firstSignalAt: (person as any).firstSeen || null,
      lastSignalAt: pres?.lastSeen || (person as any).presenceLastSeen || (person as any).lastSignal || null,
      isOnline: pres?.isOnline,
      afterCutoffHours: (person as any).afterCutoffHours || 0,
    };
  };

  const computePersonScore = (person: Report['people'][number], targetDay: string) => {
    return computeHybridFtfScore(
      buildScoreInput(person),
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
      buildScoreInput(person),
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
      `⏱ *Horas asignadas:* ${report.totalAssignedHours}h | *Terminadas/Revisión:* ${report.totalCompletedHours || 0}h`,
      `📈 *Estado:* ${report.completed} al día · ${report.pending} pendientes${report.late > 0 ? ` · ${report.late} tarde` : ''}`,
      ``,
      `👥 *Avance y Puntaje por Colaborador:*`,
    ];

    for (const person of report.people) {
      const pct = person.assignedHours > 0 ? Math.min(100, Math.round(((person.completedHours || 0) / person.assignedHours) * 100)) : 0;
      const sc = computePersonScore(person, report.day);
      const starsStr = `${starGlyph(sc.stars.star1)}${starGlyph(sc.stars.star2)}${starGlyph(sc.stars.star3)}`;
      const icon = sc.absent ? '🚫' : sc.finalScore >= 85 ? '🌟' : person.status === 'complete' ? '✅' : person.status === 'pending' ? '⏳' : '⚪';
      const pendingCount = Array.isArray(person.pending) ? person.pending.length : Number(person.pending) || 0;
      const pendingText = pendingCount > 0 ? ` (${pendingCount} sin check FTF)` : '';
      const extraText = sc.overtimeHours > 0 ? ` · +${sc.overtimeHours}h Extra Bono` : '';
      lines.push(`${icon} *${person.name}*: *${sc.finalScore}/100 pts* [${starsStr}] · ${pct}% (${person.completedHours || 0}h/${person.assignedHours || 0}h) · FTF ${person.verified}/${person.total}${pendingText}${extraText}`);
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
                  {report.totalAssignedHours}h asignadas · {report.totalCompletedHours || 0}h terminadas/revisión
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
            const isExpanded = !!expandedPeople[person.name];

            const workCompletedHours = Number((person as any).workCompletedHours || 0);
            const reviewHours = Number((person as any).reviewHours || 0);
            const inProgressHours = Number((person as any).inProgressHours || 0);
            const suspendedHours = Number((person as any).suspendedHours || 0);
            const expiredUnfinishedCount = Number((person as any).expiredUnfinishedCount || 0);
            const workPct = (person.assignedHours || 0) > 0
              ? Math.min(100, Math.round(((person.completedHours || 0) / Math.max(0.5, person.assignedHours || 0)) * 100))
              : 0;
            const workOnlyPct = (person.assignedHours || 0) > 0
              ? Math.min(100, Math.round((workCompletedHours / Math.max(0.5, person.assignedHours || 0)) * 100))
              : 0;
            const reviewOnlyPct = (person.assignedHours || 0) > 0
              ? Math.min(100 - workOnlyPct, Math.round((reviewHours / Math.max(0.5, person.assignedHours || 0)) * 100))
              : 0;

            const completionTime = person.completedAt ? calendarTime(person.completedAt) : null;
            const scoreInfo = computePersonScore(person, report.day);
            const isScorerOpen = openScorerFor === person.name;
            const scoreBadgeClass = scoreInfo.absent
              ? 'border-rose-500/80 bg-rose-950/80 text-rose-200'
              : scoreInfo.finalScore >= 85
              ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : scoreInfo.finalScore >= 50
              ? 'border-amber-400/75 bg-amber-500/20 text-amber-200'
              : 'border-rose-400/80 bg-rose-500/20 text-rose-200';

            const allDayActivities: NotionCalendarActivity[] = (person as any).allActivities || [];
            const suspendedList: NotionCalendarActivity[] = (person as any).suspendedActivities || [];

            return (
              <div
                key={person.name}
                className={`rounded-xl border transition-all ${
                  scoreInfo.absent
                    ? 'border-rose-700/50 bg-rose-950/15'
                    : isComplete
                    ? 'border-emerald-600/40 bg-emerald-950/20'
                    : isPending
                    ? 'border-amber-600/40 bg-amber-950/15'
                    : 'border-slate-800 bg-slate-900/40 opacity-85'
                } p-3 shadow-md space-y-2`}
              >
                {/* Cabecera del colaborador */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold text-[10.5px] ${
                        scoreInfo.absent
                          ? 'bg-rose-950 text-rose-200 border border-rose-500/70'
                          : isComplete
                          ? 'bg-emerald-900 text-emerald-200 border border-emerald-500'
                          : isPending
                          ? 'bg-amber-900 text-amber-200 border border-amber-500'
                          : 'bg-slate-800 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {person.name.slice(0, 2).toUpperCase()}
                      {presenceMap[person.name]?.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0B101B]" title="En línea" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-slate-100">{person.name}</span>
                        {presenceMap[person.name] && (
                          <span
                            className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-mono inline-flex items-center gap-1 ${
                              presenceMap[person.name].isOnline
                                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-600/60'
                                : 'bg-slate-900/70 text-slate-400 border border-slate-700/60'
                            }`}
                            title={presenceMap[person.name].isOnline ? 'En línea en ANFETA' : `Última conexión: ${presenceMap[person.name].lastSeenLabel || 'Sin registro hoy'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${presenceMap[person.name].isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                            <span>{presenceMap[person.name].isOnline ? 'En línea' : 'Desconectado'}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-[10px] text-slate-400 gap-2 mt-0.5">
                        <span>Checks FTF: <strong className="text-slate-200">{person.verified}/{person.total}</strong></span>
                        <span>·</span>
                        <span>Agenda: <strong className="text-cyan-200">{person.assignedHours || 0}h</strong></span>
                        {onOpenDailyProgress && (
                          <button
                            type="button"
                            onClick={() => onOpenDailyProgress()}
                            className="inline-flex items-center gap-0.5 text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                            title="Abrir módulo de Avance Diario"
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
                      title={`Asistencia ${scoreInfo.breakdown.attendance}/20 + FTF ${scoreInfo.breakdown.coverage}/20 + Avance ${scoreInfo.breakdown.progress}/35 + Cierre ${scoreInfo.breakdown.ftfFinal}/25${scoreInfo.published ? ' (Publicado)' : ''}`}
                    >
                      <Award size={11} />
                      <span>{scoreInfo.finalScore} pts</span>
                    </span>
                    {scoreInfo.absent ? (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-950/70 px-1.5 py-0.2 text-[9.5px] font-semibold text-rose-300 border border-rose-500/50">
                        Sin conexión (0)
                      </span>
                    ) : isComplete ? (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-emerald-900/60 px-1.5 py-0.2 text-[9.5px] font-semibold text-emerald-300 border border-emerald-500/50"
                        title={person.timeKind === 'confirmed' ? 'Confirmación FTF' : 'FTF observado'}
                      >
                        <CheckCircle2 size={10} />
                        <span>{completionTime || 'Completó'}</span>
                      </span>
                    ) : expiredUnfinishedCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-rose-950/70 px-1.5 py-0.2 text-[9.5px] font-medium text-rose-300 border border-rose-500/50"
                        title="Bloques cuyo horario ya terminó hoy y siguen en Por hacer"
                      >
                        <AlertTriangle size={10} />
                        <span>{expiredUnfinishedCount} vencida{expiredUnfinishedCount > 1 ? 's' : ''}</span>
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-900/60 px-1.5 py-0.2 text-[9.5px] font-medium text-amber-300 border border-amber-500/50">
                        <Clock size={10} />
                        <span>En curso</span>
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-slate-500 italic">Sin horario</span>
                    )}
                  </div>
                </div>

                {/* Barra de avance real + Desglose exacto de horas */}
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>Avance real: <strong className="text-slate-200">{workPct}%</strong></span>
                    <span className="font-mono text-slate-300">
                      {person.completedHours || 0}h cerradas/rev. de {person.assignedHours || 0}h
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800 flex">
                    {workOnlyPct > 0 && (
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${workOnlyPct}%` }} title={`Terminadas: ${workCompletedHours}h`} />
                    )}
                    {reviewOnlyPct > 0 && (
                      <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${reviewOnlyPct}%` }} title={`En revisión: ${reviewHours}h`} />
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1 text-[9.5px] font-mono">
                    {workCompletedHours > 0 && (
                      <span className="rounded bg-emerald-950/60 border border-emerald-600/40 px-1.5 py-0.2 text-emerald-300">
                        ✓ {workCompletedHours}h Term.
                      </span>
                    )}
                    {reviewHours > 0 && (
                      <span className="rounded bg-violet-950/60 border border-violet-500/50 px-1.5 py-0.2 text-violet-200">
                        ◎ {reviewHours}h Revisión
                      </span>
                    )}
                    {inProgressHours > 0 && (
                      <span className="rounded bg-sky-950/50 border border-sky-700/40 px-1.5 py-0.2 text-sky-300">
                        ● {inProgressHours}h Por hacer
                      </span>
                    )}
                    {suspendedHours > 0 && (
                      <span
                        className="rounded bg-slate-900 border border-slate-700/80 px-1.5 py-0.2 text-slate-400 line-through"
                        title="Actividades suspendidas: excluidas de horas asignadas, avance y bono extra"
                      >
                        {suspendedHours}h Susp.
                      </span>
                    )}
                    {(person.assignedHours || 0) === 0 && suspendedHours === 0 && (
                      <span className="text-slate-500 italic">Sin bloques productivos hoy</span>
                    )}
                  </div>
                </div>

                {/* Señales reales de conexión (1ª señal = login real en ANFETA, nunca inventada del horario) */}
                {(() => {
                  const isOnlineNow = !!presenceMap[person.name]?.isOnline;
                  const firstSeenIso = (person as any).firstSeen || null;
                  const firstDisplay = firstSeenIso ? formatSignalTime(firstSeenIso, report.day) : 'Sin conexión';
                  const firstTitle = firstSeenIso
                    ? `1ª conexión real en ANFETA: ${firstSeenIso}`
                    : (person as any).firstActivityStart
                    ? `Sin conexión registrada en ANFETA (1er bloque en agenda: ${calendarTime((person as any).firstActivityStart)})`
                    : 'Sin registro de conexión en ANFETA';

                  const presenceLastSeen = presenceMap[person.name]?.lastSeen || (person as any).presenceLastSeen || null;
                  const lastDisplay = isOnlineNow
                    ? 'En línea'
                    : presenceLastSeen
                    ? formatSignalTime(presenceLastSeen, report.day)
                    : firstSeenIso && person.lastActivityEdited
                    ? formatSignalTime(person.lastActivityEdited, report.day)
                    : 'Sin señal';

                  const lastTitle = isOnlineNow
                    ? 'En línea ahora en ANFETA'
                    : presenceLastSeen
                    ? `Último latido ANFETA: ${presenceLastSeen}`
                    : firstSeenIso && person.lastActivityEdited
                    ? `Última edición en Notion: ${person.lastActivityEdited}`
                    : 'Sin señal de actividad';

                  return (
                    <div className="rounded-lg bg-slate-950/75 border border-slate-800/90 px-2.5 py-1.5 flex items-center justify-between text-[10px] font-mono">
                      <div className="flex items-center gap-1" title={firstTitle}>
                        <LogIn size={11} className={firstSeenIso ? 'text-emerald-400' : 'text-rose-400/80'} />
                        <span className="text-slate-400">1ª:</span>
                        <span className={`font-bold ${firstSeenIso ? 'text-slate-100' : 'text-rose-300/90'}`}>
                          {firstDisplay}
                        </span>
                      </div>

                      <span className="text-slate-700">|</span>

                      <div className="flex items-center gap-1" title={lastTitle}>
                        <Activity size={11} className={isOnlineNow || presenceLastSeen ? 'text-cyan-400' : 'text-slate-500'} />
                        <span className="text-slate-400">Últ:</span>
                        <span className="text-slate-200 font-bold truncate max-w-[95px] inline-flex items-center gap-1">
                          {isOnlineNow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          <span>{lastDisplay}</span>
                        </span>
                      </div>
                      {person.late && <span className="font-semibold text-rose-400 ml-1">⚠ Tarde</span>}
                    </div>
                  );
                })()}

                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                  <span className={scoreInfo.coverageState === 'complete' ? 'text-emerald-300 font-medium' : 'text-cyan-200/90'}>
                    {scoreInfo.coverageState === 'complete'
                      ? '✓ Agenda sin huecos (10–18h)'
                      : scoreInfo.coverageState === 'empty'
                      ? 'Sin cobertura registrada'
                      : `Por cubrir (10–18h): ${ftfHours(person.pendingAssignmentMinutes)}`}
                  </span>
                  {scoreInfo.overtimeHours > 0 && (
                    <span
                      className="rounded-full bg-violet-950/80 border border-violet-400/60 px-1.5 py-0.2 text-[9.5px] font-bold text-violet-200 font-mono"
                      title="Horas extra reales post-18:30 (actividades suspendidas excluidas)"
                    >
                      +{scoreInfo.overtimeHours}h Extra Bono
                    </span>
                  )}
                </div>

                {/* 3 Estrellas con soporte ½ ★ + Botón Ajustar intuitivo */}
                <div className="flex items-center justify-between gap-1 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {[
                      {
                        key: 'star1' as const,
                        label: 'FTF',
                        maxPts: 20,
                        value: scoreInfo.stars.star1,
                        tip: 'Cobertura sin huecos (20 pts)',
                      },
                      {
                        key: 'star2' as const,
                        label: 'Avance',
                        maxPts: 35,
                        value: scoreInfo.stars.star2,
                        tip: 'Terminadas, en revisión y checks (35 pts)',
                      },
                      {
                        key: 'star3' as const,
                        label: 'Cierre',
                        maxPts: 25,
                        value: scoreInfo.stars.star3,
                        tip: 'Cierre FTF antes de 18:30 (25 pts)',
                      },
                    ].map(st => {
                      const w = starWeight(st.value);
                      const isFull = w >= 0.99;
                      const isHalf = w > 0.01 && w < 0.99;
                      const pctLabel = Math.round(w * 100);
                      return (
                        <button
                          key={st.key}
                          type="button"
                          disabled={!canMarkReview}
                          onClick={() => {
                            if (!canMarkReview) return;
                            void savePersonScore(person, {
                              absent: false,
                              starsOverride: { [st.key]: nextStarCycle(st.value) },
                            });
                          }}
                          title={canMarkReview ? `${st.tip} (${pctLabel}%) · Clic alterna ★ 100% → ½★ 50% → ☆ 0%` : `${st.tip} (${pctLabel}%)`}
                          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9.5px] font-semibold border transition-colors ${
                            isFull
                              ? 'border-amber-400/75 bg-amber-500/20 text-amber-200'
                              : isHalf
                              ? 'border-amber-400/60 border-dashed bg-amber-500/10 text-amber-300'
                              : 'border-slate-700/80 bg-slate-900/80 text-slate-500'
                          } ${canMarkReview ? 'cursor-pointer hover:border-amber-300' : 'cursor-default'}`}
                        >
                          {isHalf ? (
                            <StarHalf size={10} fill="currentColor" className="text-amber-300" />
                          ) : (
                            <Star size={10} fill={isFull ? 'currentColor' : 'none'} className={isFull ? 'text-amber-300' : 'text-slate-500'} />
                          )}
                          <span>{st.label}</span>
                          {isHalf && <span className="text-[8.5px] font-mono">{pctLabel}%</span>}
                        </button>
                      );
                    })}
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
                      title="Abrir ponderación detallada (0–100), medios puntos (½★) y nota"
                    >
                      <SlidersHorizontal size={10} />
                      <span>Ajustar</span>
                    </button>
                  )}
                </div>

                {scoreInfo.supervisorNote && !isScorerOpen && (
                  <p className="rounded bg-indigo-950/35 border border-indigo-500/30 px-2 py-1 text-[10px] text-indigo-200">
                    📝 {scoreInfo.supervisorNote}
                  </p>
                )}

                {/* Panel claro de Ponderación del Supervisor */}
                {canMarkReview && isScorerOpen && (
                  <div className="rounded-lg border border-cyan-500/45 bg-slate-950/95 p-2.5 space-y-2 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-cyan-200">Ponderación del día (Auto: {scoreInfo.autoScore})</span>
                        <p className="text-[9px] text-slate-400">
                          Asistencia {scoreInfo.breakdown.attendance}/20 + FTF {scoreInfo.breakdown.coverage}/20 + Avance {scoreInfo.breakdown.progress}/35 + Cierre {scoreInfo.breakdown.ftfFinal}/25
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
                          {scoreInfo.absent ? '✓ Falta (0)' : 'Falta'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void savePersonScore(person, {
                              manualScoreOverride: null,
                              absent: undefined,
                              starsOverride: {},
                            })
                          }
                          className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-[9px] cursor-pointer"
                          title="Volver al cálculo automático"
                        >
                          Auto
                        </button>
                      </div>
                    </div>

                    {/* Selector rápido de % por estrella (0%, 50% ½★, 100% ★) */}
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { key: 'star1' as const, label: 'FTF (20p)', value: scoreInfo.stars.star1 },
                        { key: 'star2' as const, label: 'Avance (35p)', value: scoreInfo.stars.star2 },
                        { key: 'star3' as const, label: 'Cierre (25p)', value: scoreInfo.stars.star3 },
                      ].map(st => {
                        const w = starWeight(st.value);
                        return (
                          <div key={st.key} className="rounded border border-slate-800 bg-slate-900/70 p-1 text-center">
                            <div className="text-[9px] text-slate-400 mb-1 truncate">{st.label}</div>
                            <div className="flex items-center justify-center gap-0.5">
                              {[
                                { w: 0, lbl: '0%' },
                                { w: 0.5, lbl: '½★' },
                                { w: 1, lbl: '★' },
                              ].map(opt => {
                                const selected = Math.abs(w - opt.w) < 0.15;
                                return (
                                  <button
                                    key={opt.lbl}
                                    type="button"
                                    onClick={() =>
                                      void savePersonScore(person, {
                                        absent: false,
                                        manualScoreOverride: null,
                                        starsOverride: { [st.key]: opt.w },
                                      })
                                    }
                                    className={`px-1 py-0.5 rounded text-[9px] font-mono cursor-pointer border ${
                                      selected
                                        ? 'border-amber-400 bg-amber-500/25 text-amber-200 font-bold'
                                        : 'border-slate-700/70 bg-slate-950 text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    {opt.lbl}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[9.5px] text-slate-400 shrink-0">Total:</span>
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

                {/* Desplegable transparente de todas las actividades del día con su estado real */}
                {(allDayActivities.length > 0 || suspendedList.length > 0) && (
                  <div className="border-t border-slate-800/80 pt-1.5">
                    <button
                      type="button"
                      onClick={() => togglePersonExpand(person.name)}
                      className="flex w-full items-center justify-between rounded px-1.5 py-1 text-[10.5px] font-medium text-cyan-200 hover:bg-slate-800/60 cursor-pointer"
                    >
                      <span>
                        {isExpanded ? 'Ocultar' : 'Ver'} desglose ({allDayActivities.length} act. · {person.assignedHours || 0}h)
                      </span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {isExpanded && (
                      <div className="mt-1 max-h-48 overflow-y-auto space-y-1.5 pr-1 select-text">
                        {allDayActivities.map(activity => {
                          const wf = workflowState(activity.status, activity.title);
                          const isDone = wf === 'completed';
                          const isRev = wf === 'review';
                          const endMs = Date.parse(activity.end || activity.start);
                          const isExpired = !isDone && !isRev && Number.isFinite(endMs) && endMs <= Date.now();
                          const stateBadge = isDone
                            ? { label: '✓ Terminada', cls: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50' }
                            : isRev
                            ? { label: '◎ En revisión', cls: 'bg-violet-950/70 text-violet-200 border-violet-500/50' }
                            : isExpired
                            ? { label: '⚠ Vencida (Por hacer)', cls: 'bg-rose-950/70 text-rose-300 border-rose-500/50' }
                            : { label: '● Por hacer', cls: 'bg-sky-950/60 text-sky-300 border-sky-600/40' };
                          return (
                            <button
                              type="button"
                              key={activity.pageId}
                              onClick={() => onOpenActivity(activity)}
                              className="block w-full rounded border border-slate-800 bg-slate-950/85 p-2 text-left text-[10.5px] text-slate-200 transition-colors hover:border-cyan-500 hover:bg-slate-900 cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-1 text-[9.5px] mb-1">
                                <span className={`rounded border px-1.5 py-0.2 font-semibold ${stateBadge.cls}`}>
                                  {stateBadge.label}
                                </span>
                                <span className="font-mono text-slate-400">
                                  {calendarTime(activity.start)}–{calendarTime(activity.end || activity.start)}
                                </span>
                              </div>
                              <div className="line-clamp-2 text-slate-200 font-normal">
                                {calendarDisplayTitle(activity.title, calendarDomain(activity.title))}
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[9.5px] text-slate-400">
                                <span className="truncate max-w-[120px]">{calendarDomain(activity.title)}</span>
                                <span className={activity.ftfVerified ? 'text-emerald-400' : 'text-amber-300'}>
                                  {activity.ftfVerified ? '✓ Check FTF' : 'Sin check FTF'}
                                </span>
                              </div>
                            </button>
                          );
                        })}

                        {suspendedList.map(activity => (
                          <button
                            type="button"
                            key={activity.pageId}
                            onClick={() => onOpenActivity(activity)}
                            className="block w-full rounded border border-slate-800/60 bg-slate-950/40 p-2 text-left text-[10px] text-slate-400 opacity-75 hover:opacity-100 cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-[9px] mb-0.5">
                              <span className="rounded border border-slate-700 bg-slate-900 px-1 py-0.2 text-slate-400">
                                Suspendida · No cuenta
                              </span>
                              <span className="font-mono">{calendarTime(activity.start)}</span>
                            </div>
                            <div className="line-clamp-1 line-through">
                              {calendarDisplayTitle(activity.title, calendarDomain(activity.title))}
                            </div>
                          </button>
                        ))}
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
