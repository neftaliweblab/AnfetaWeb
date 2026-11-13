"use client";
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NotionCalendarActivity } from '@/types/anfeta';
import { calendarDisplayTitle, calendarDomain, calendarTime, mexicoDate } from '@/services/calendarPresentation';
import { buildFtfDashboard, canViewFtfDashboard, shiftFtfDate } from '@/services/ftfDashboard';
import {
  Activity,
  Award,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  GripHorizontal,
  LogIn,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  StarHalf,
  X,
} from 'lucide-react';
import { CalendarFtfWeek, ftfHours } from './CalendarFtfWeek';
import { normalizePerson } from '@/services/identityNormalizer';
import { workflowState } from '@/services/activityWorkflow';
import { computeHybridFtfScore, FtfStarValue, SavedFtfScoreEntry, starWeight } from '@/services/ftfScoring';

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

  const [isOpen, setIsOpen] = useState(false);
  const [windowMode, setWindowMode] = useState<'large' | 'compact'>(() => {
    try {
      const saved = localStorage.getItem('anfeta_bitacora_window_mode');
      return saved === 'compact' ? 'compact' : 'large';
    } catch {
      return 'large';
    }
  });
  const [textScale, setTextScale] = useState<'normal' | 'large' | 'xl'>(() => {
    try {
      const saved = localStorage.getItem('anfeta_bitacora_text_scale');
      if (saved === 'normal' || saved === 'xl') return saved;
      return 'large';
    } catch {
      return 'large';
    }
  });
  const updateTextScale = (next: 'normal' | 'large' | 'xl') => {
    setTextScale(next);
    try {
      localStorage.setItem('anfeta_bitacora_text_scale', next);
    } catch {}
  };
  const [personFilter, setPersonFilter] = useState<'all' | 'active' | 'absent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompactPerson, setSelectedCompactPerson] = useState<string>('');
  const [compactPos, setCompactPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(24, window.innerWidth - 560) : 640,
    y: 72,
  }));
  const dragStateRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const openWindow = (mode?: 'large' | 'compact') => {
    if (mode) {
      setWindowMode(mode);
      try {
        localStorage.setItem('anfeta_bitacora_window_mode', mode);
      } catch {}
    }
    if (mode === 'compact' && typeof window !== 'undefined') {
      setCompactPos(prev => ({
        x: Math.min(Math.max(16, prev.x), Math.max(16, window.innerWidth - 540)),
        y: Math.min(Math.max(16, prev.y), Math.max(16, window.innerHeight - 420)),
      }));
    }
    setIsOpen(true);
  };

  const switchWindowMode = (mode: 'large' | 'compact') => {
    setWindowMode(mode);
    try {
      localStorage.setItem('anfeta_bitacora_window_mode', mode);
    } catch {}
    if (mode === 'compact' && typeof window !== 'undefined') {
      setCompactPos(prev => ({
        x: Math.min(Math.max(16, prev.x), Math.max(16, window.innerWidth - 540)),
        y: Math.min(Math.max(16, prev.y), Math.max(16, window.innerHeight - 420)),
      }));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const nextX = Math.max(8, Math.min(window.innerWidth - 360, drag.origX + (e.clientX - drag.startX)));
      const nextY = Math.max(8, Math.min(window.innerHeight - 160, drag.origY + (e.clientY - drag.startY)));
      setCompactPos({ x: nextX, y: nextY });
    };
    const onMouseUp = () => {
      dragStateRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

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
        const d = data.delivery;
        const parts = ['✓ Corte publicado'];
        if (d?.notionJournal?.ok) parts.push('Journal Notion ✓');
        else if (d?.notionJournal?.skipped) parts.push('Journal Notion: falta URL/ID en Ajustes');
        else if (d?.notionJournal?.reason) parts.push(`Journal Notion ✕`);
        if (d?.email?.ok) parts.push(`Correo → ${Array.isArray(d.email.to) ? d.email.to.join(', ') : 'John'} ✓`);
        else if (d?.email?.skipped) parts.push('Correo: falta Resend API Key o email en Ajustes');
        else if (d?.email?.reason) parts.push(`Correo ✕`);
        if (d?.push?.sentCount > 0) parts.push(`Push (${d.push.sentCount}) ✓`);
        setPublishNotice(parts.join(' · '));
        setTimeout(() => setPublishNotice(''), 7000);
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

  const peopleScored = (report?.people || []).map(person => ({
    person,
    scoreInfo: computePersonScore(person, report?.day || date),
  }));

  const activePeopleCount = peopleScored.filter(item => !item.scoreInfo.absent).length;
  const absentPeopleCount = peopleScored.filter(item => item.scoreInfo.absent).length;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredPeople = peopleScored
    .filter(({ person, scoreInfo }) => {
      if (personFilter === 'active' && scoreInfo.absent) return false;
      if (personFilter === 'absent' && !scoreInfo.absent) return false;
      if (windowMode === 'compact' && selectedCompactPerson && person.name !== selectedCompactPerson) return false;
      if (!normalizedSearch) return true;
      if (person.name.toLowerCase().includes(normalizedSearch)) return true;
      const acts: NotionCalendarActivity[] = (person as any).allActivities || [];
      return acts.some(a =>
        calendarDisplayTitle(a.title, calendarDomain(a.title)).toLowerCase().includes(normalizedSearch) ||
        calendarDomain(a.title).toLowerCase().includes(normalizedSearch)
      );
    })
    .sort((a, b) => {
      // Conectados/con trabajo primero, faltas al final; dentro de cada grupo, más horas/puntaje primero
      if (a.scoreInfo.absent !== b.scoreInfo.absent) return a.scoreInfo.absent ? 1 : -1;
      const aOnline = presenceMap[a.person.name]?.isOnline ? 1 : 0;
      const bOnline = presenceMap[b.person.name]?.isOnline ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      return (b.person.assignedHours || 0) - (a.person.assignedHours || 0);
    });

  const renderPersonColumn = ({
    person,
    scoreInfo,
  }: {
    person: Report['people'][number];
    scoreInfo: ReturnType<typeof computePersonScore>;
  }) => {
    const isComplete = person.status === 'complete';
    const isPending = person.status === 'pending';
    const workCompletedHours = Number((person as any).workCompletedHours || 0);
    const reviewHours = Number((person as any).reviewHours || 0);
    const inProgressHours = Number((person as any).inProgressHours || 0);
    const suspendedHours = Number((person as any).suspendedHours || 0);
    const expiredUnfinishedCount = Number((person as any).expiredUnfinishedCount || 0);
    const assigned = person.assignedHours || 0;
    const completedTotal = person.completedHours || 0;
    const workPct = assigned > 0 ? Math.min(100, Math.round((completedTotal / Math.max(0.5, assigned)) * 100)) : 0;
    const workOnlyPct = assigned > 0 ? Math.min(100, Math.round((workCompletedHours / Math.max(0.5, assigned)) * 100)) : 0;
    const reviewOnlyPct = assigned > 0 ? Math.min(100 - workOnlyPct, Math.round((reviewHours / Math.max(0.5, assigned)) * 100)) : 0;

    const completionTime = person.completedAt ? calendarTime(person.completedAt) : null;
    const ftfBlockCompletionTime = (person as any).ftfBlockCompletedAt ? calendarTime((person as any).ftfBlockCompletedAt) : null;
    const isScorerOpen = openScorerFor === person.name;
    const isOnlineNow = !!presenceMap[person.name]?.isOnline;
    const firstSeenIso = (person as any).firstSeen || null;
    const firstDisplay = firstSeenIso ? formatSignalTime(firstSeenIso, report?.day || date) : 'Sin conexión';
    const presenceLastSeen = presenceMap[person.name]?.lastSeen || (person as any).presenceLastSeen || null;
    const lastDisplay = isOnlineNow
      ? 'En línea ahora'
      : presenceLastSeen
      ? formatSignalTime(presenceLastSeen, report?.day || date)
      : firstSeenIso && person.lastActivityEdited
      ? `Notion ${formatSignalTime(person.lastActivityEdited, report?.day || date)}`
      : 'Sin señal';

    const scoreBadgeClass = scoreInfo.absent
      ? 'border-rose-500/70 bg-rose-950/75 text-rose-200'
      : scoreInfo.finalScore >= 85
      ? 'border-emerald-400/75 bg-emerald-500/20 text-emerald-200'
      : scoreInfo.finalScore >= 50
      ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
      : 'border-rose-400/75 bg-rose-500/20 text-rose-200';

    const allDayActivities: NotionCalendarActivity[] = (person as any).allActivities || [];
    const suspendedList: NotionCalendarActivity[] = (person as any).suspendedActivities || [];
    const mealBreakInfo = (person as any).mealBreak as
      | { enabled: boolean; startHour: number; startMinute: number; endHour: number; endMinute: number; minutes: number }
      | null
      | undefined;

    const scale = {
      colWidth: textScale === 'xl' ? 'w-[395px]' : textScale === 'large' ? 'w-[350px]' : 'w-[315px]',
      nameText: textScale === 'xl' ? 'text-base' : textScale === 'large' ? 'text-[15px]' : 'text-sm',
      subText: textScale === 'xl' ? 'text-xs' : textScale === 'large' ? 'text-[11.5px]' : 'text-[10.5px]',
      scoreText: textScale === 'xl' ? 'text-base' : textScale === 'large' ? 'text-sm' : 'text-xs',
      signalLabel: textScale === 'xl' ? 'text-[11px]' : textScale === 'large' ? 'text-[10.5px]' : 'text-[9.5px]',
      signalTime: textScale === 'xl' ? 'text-base' : textScale === 'large' ? 'text-sm' : 'text-xs',
      summaryText: textScale === 'xl' ? 'text-xs' : textScale === 'large' ? 'text-[11.5px]' : 'text-[10.5px]',
      statText: textScale === 'xl' ? 'text-[12.5px]' : textScale === 'large' ? 'text-[11.5px]' : 'text-[10.5px]',
      starText: textScale === 'xl' ? 'text-[11.5px]' : textScale === 'large' ? 'text-[10.5px]' : 'text-[9.5px]',
      actTime: textScale === 'xl' ? 'text-[13.5px]' : textScale === 'large' ? 'text-xs' : 'text-[11px]',
      actTitle: textScale === 'xl' ? 'text-sm' : textScale === 'large' ? 'text-[12.5px]' : 'text-[11.5px]',
      actMeta: textScale === 'xl' ? 'text-[11.5px]' : textScale === 'large' ? 'text-[10.5px]' : 'text-[10px]',
    };

    const padTime = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;

    return (
      <article
        key={person.name}
        className={`flex flex-col rounded-2xl border transition-colors ${
          windowMode === 'large'
            ? `${scale.colWidth} shrink-0 h-full min-h-0`
            : 'w-full'
        } ${
          scoreInfo.absent
            ? 'border-rose-800/50 bg-[#12101a]/90'
            : isComplete
            ? 'border-emerald-600/45 bg-[#0c1a1b]/90'
            : isPending
            ? 'border-cyan-700/45 bg-[#0e1624]/95'
            : 'border-slate-800 bg-[#0d131f]/85'
        } overflow-hidden shadow-lg`}
      >
        {/* Zona 1: Encabezado de colaborador y Calificación */}
        <header className="shrink-0 border-b border-slate-800/80 bg-slate-950/55 px-3.5 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                  scoreInfo.absent
                    ? 'bg-rose-950 text-rose-200 border border-rose-500/70'
                    : isComplete
                    ? 'bg-emerald-900 text-emerald-100 border border-emerald-400'
                    : 'bg-slate-800 text-cyan-100 border border-cyan-700/70'
                }`}
              >
                {person.name.slice(0, 2).toUpperCase()}
                {isOnlineNow && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" title="En línea" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className={`font-bold ${scale.nameText} text-slate-100 truncate`}>{person.name}</h3>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isOnlineNow
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                        : 'bg-slate-900 text-slate-400 border border-slate-700/60'
                    }`}
                  >
                    {isOnlineNow ? 'En línea' : 'Offline'}
                  </span>
                </div>
                <p className={`${scale.subText} text-slate-400 mt-0.5`}>
                  {scoreInfo.absent
                    ? 'Sin conexión registrada'
                    : ftfBlockCompletionTime
                    ? `FTF terminado ${ftfBlockCompletionTime}${isComplete ? '' : ' · jornada en curso'}`
                    : isComplete
                    ? `FTF completado (${completionTime || 'al día'})`
                    : expiredUnfinishedCount > 0
                    ? `${expiredUnfinishedCount} bloque${expiredUnfinishedCount > 1 ? 's' : ''} vencido${expiredUnfinishedCount > 1 ? 's' : ''} sin cerrar`
                    : isPending
                    ? 'Jornada en curso'
                    : 'Sin horario hoy'}
                </p>
                {ftfBlockCompletionTime && (
                  <span
                    className="inline-flex items-center gap-1 mt-1 rounded-md border border-emerald-500/60 bg-emerald-950/70 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300"
                    title="Hora exacta en que marcó como terminado su bloque fijo FTF de hoy"
                  >
                    ✓ FTF terminado {ftfBlockCompletionTime}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 ${scale.scoreText} font-extrabold font-mono ${scoreBadgeClass}`}
                title={`Asistencia ${scoreInfo.breakdown.attendance}/20 + Agenda ${scoreInfo.breakdown.coverage}/20 + Avance ${scoreInfo.breakdown.progress}/35 + Cierre ${scoreInfo.breakdown.ftfFinal}/25`}
              >
                <Award size={13} />
                <span>{scoreInfo.finalScore}</span>
                <span className="text-[10px] opacity-75">/100</span>
              </div>
            </div>
          </div>
        </header>

        {/* Zona 2: Conexión y Resumen de Horas limpio */}
        <div className="shrink-0 border-b border-slate-800/80 px-3.5 py-2.5 space-y-2.5 bg-slate-900/25">
          {/* Tabla limpia de señales con tiempos grandes */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800/80 bg-slate-950/70 px-3 py-2">
            <div title={(person as any).firstActivityStart ? `1er bloque en calendario: ${calendarTime((person as any).firstActivityStart)}` : undefined}>
              <span className={`flex items-center gap-1 ${scale.signalLabel} text-slate-400`}>
                <LogIn size={11} className={firstSeenIso ? 'text-emerald-400' : 'text-rose-400'} />
                <span>Entrada (1ª señal)</span>
              </span>
              <span className={`font-mono font-bold ${scale.signalTime} ${firstSeenIso ? 'text-slate-100' : 'text-rose-300'}`}>
                {firstDisplay}
              </span>
            </div>
            <div>
              <span className={`flex items-center gap-1 ${scale.signalLabel} text-slate-400`}>
                <Activity size={11} className="text-cyan-400" />
                <span>Última señal</span>
              </span>
              <span className={`font-mono font-bold ${scale.signalTime} text-slate-100 truncate block`}>{lastDisplay}</span>
            </div>
          </div>

          {/* Avance de horas con barra y grilla 2x2 ordenada */}
          <div>
            <div className={`flex items-center justify-between ${scale.summaryText} mb-1`}>
              <span className="text-slate-300 font-medium">
                Avance del día <strong className="text-white">{workPct}%</strong>
              </span>
              <span className="font-mono text-slate-200 font-semibold">
                <strong>{completedTotal}h</strong> / {assigned}h asignadas
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800 flex">
              {workOnlyPct > 0 && (
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${workOnlyPct}%` }} />
              )}
              {reviewOnlyPct > 0 && (
                <div className="h-full bg-violet-500 transition-all" style={{ width: `${reviewOnlyPct}%` }} />
              )}
            </div>

            <div className={`mt-2 grid grid-cols-2 gap-x-3 gap-y-1 ${scale.statText}`}>
              <div className="flex items-center justify-between text-slate-400">
                <span>Terminadas:</span>
                <strong className="font-mono text-emerald-300">{workCompletedHours}h</strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>En revisión:</span>
                <strong className="font-mono text-violet-300">{reviewHours}h</strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Por hacer:</span>
                <strong className="font-mono text-sky-300">{inProgressHours}h</strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Checks FTF:</span>
                <strong className="font-mono text-slate-200">{person.verified}/{person.total}</strong>
              </div>
            </div>

            <div className={`mt-1.5 flex items-center justify-between gap-1 flex-wrap ${scale.summaryText} pt-1.5 border-t border-slate-800/60`}>
              <span className={scoreInfo.coverageState === 'complete' ? 'text-emerald-300 font-medium' : 'text-cyan-300/90'}>
                {scoreInfo.coverageState === 'complete'
                  ? mealBreakInfo?.enabled
                    ? `✓ Agenda cubierta (incl. Comida ${padTime(mealBreakInfo.startHour, mealBreakInfo.startMinute)}–${padTime(mealBreakInfo.endHour, mealBreakInfo.endMinute)})`
                    : '✓ Agenda 10–18h sin huecos'
                  : scoreInfo.coverageState === 'empty'
                  ? 'Sin cobertura en 10–18h'
                  : `Hueco 10–18h: ${ftfHours(person.pendingAssignmentMinutes)}`}
              </span>
              {scoreInfo.overtimeHours > 0 && (
                <span className="rounded bg-violet-950 border border-violet-500/50 px-1.5 py-0.2 font-mono text-[10px] font-bold text-violet-200">
                  +{scoreInfo.overtimeHours}h Extra
                </span>
              )}
            </div>
            {mealBreakInfo?.enabled && scoreInfo.coverageState !== 'complete' && scoreInfo.coverageState !== 'empty' && (
              <p className="mt-1 text-[10.5px] text-amber-300/90 font-mono">
                🍽️ Comida {padTime(mealBreakInfo.startHour, mealBreakInfo.startMinute)}–{padTime(mealBreakInfo.endHour, mealBreakInfo.endMinute)} descontada de huecos
              </p>
            )}
            {suspendedHours > 0 && (
              <p className="mt-1 text-[10px] text-slate-500 font-mono">
                {suspendedHours}h en actividades suspendidas (excluidas del conteo)
              </p>
            )}
          </div>

          {/* Zona 3: Calificación por Estrellas con soporte ½★ */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { key: 'star1' as const, label: 'FTF', value: scoreInfo.stars.star1, pts: `${scoreInfo.breakdown.coverage}/20` },
                  { key: 'star2' as const, label: 'Avance', value: scoreInfo.stars.star2, pts: `${scoreInfo.breakdown.progress}/35` },
                  { key: 'star3' as const, label: 'Cierre', value: scoreInfo.stars.star3, pts: `${scoreInfo.breakdown.ftfFinal}/25` },
                ].map(st => {
                  const w = starWeight(st.value);
                  const isFull = w >= 0.99;
                  const isHalf = w > 0.01 && w < 0.99;
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
                      title={`${st.label}: ${st.pts} pts${canMarkReview ? ' · Clic alterna ★ 100% → ½★ 50% → ☆ 0%' : ''}`}
                      className={`inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 ${scale.starText} font-semibold border transition-colors ${
                        isFull
                          ? 'border-amber-400/75 bg-amber-500/20 text-amber-200'
                          : isHalf
                          ? 'border-amber-400/60 border-dashed bg-amber-500/10 text-amber-300'
                          : 'border-slate-700/80 bg-slate-900/80 text-slate-400'
                      } ${canMarkReview ? 'cursor-pointer hover:border-amber-300' : 'cursor-default'}`}
                    >
                      {isHalf ? (
                        <StarHalf size={11} fill="currentColor" className="text-amber-300" />
                      ) : (
                        <Star size={11} fill={isFull ? 'currentColor' : 'none'} className={isFull ? 'text-amber-300' : 'text-slate-500'} />
                      )}
                      <span>{st.label}</span>
                      <span className="text-[9.5px] font-mono opacity-80">{st.pts}</span>
                    </button>
                  );
                })}
              </div>

              {canMarkReview && (
                <button
                  type="button"
                  onClick={() => setOpenScorerFor(isScorerOpen ? null : person.name)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 ${scale.starText} font-semibold border cursor-pointer transition-colors ${
                    isScorerOpen
                      ? 'border-cyan-400 bg-cyan-950 text-cyan-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500 hover:text-white'
                  }`}
                >
                  <SlidersHorizontal size={10} />
                  <span>Ajustar</span>
                </button>
              )}
            </div>

            {scoreInfo.supervisorNote && !isScorerOpen && (
              <p className="rounded-lg bg-indigo-950/40 border border-indigo-500/30 px-2 py-1 text-[10px] text-indigo-200">
                📝 {scoreInfo.supervisorNote}
              </p>
            )}

            {canMarkReview && isScorerOpen && (
              <div className="pt-1.5 border-t border-slate-800 space-y-2 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-cyan-200 font-semibold">Auto: {scoreInfo.autoScore} pts</span>
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
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-rose-200'
                      }`}
                    >
                      {scoreInfo.absent ? '✓ Falta (0)' : 'Marcar falta'}
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
                    >
                      Auto
                    </button>
                  </div>
                </div>

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
                  <span className="text-[9.5px] text-slate-400">Total:</span>
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
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  placeholder="Nota para el colaborador (Enter para guardar)..."
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Zona 4: Columna vertical de actividades del día (siempre visible y ordenada) */}
        <div className="flex-1 min-h-[150px] flex flex-col px-3.5 py-2.5 bg-[#080d17]/75">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
              Actividades ({allDayActivities.length})
            </span>
            {onOpenDailyProgress && (
              <button
                type="button"
                onClick={() => onOpenDailyProgress()}
                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-200 cursor-pointer"
              >
                <span>Ver avance</span>
                <ExternalLink size={9} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-text">
            {allDayActivities.length === 0 && suspendedList.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-800 px-3 py-6 text-center text-[11px] text-slate-500">
                Sin actividades programadas para este día.
              </div>
            )}

            {allDayActivities.map(activity => {
              const wf = workflowState(activity.status, activity.title);
              const isDone = wf === 'completed';
              const isRev = wf === 'review';
              const endMs = Date.parse(activity.end || activity.start);
              const isExpired = !isDone && !isRev && Number.isFinite(endMs) && endMs <= Date.now();
              const diffH = Number(
                Math.max(0.5, ((Date.parse(activity.end || activity.start) - Date.parse(activity.start)) / 3600000) || 0.5).toFixed(1)
              );

              const stateStyle = isDone
                ? { label: 'Terminada', bar: 'border-l-emerald-500', badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50' }
                : isRev
                ? { label: 'En revisión', bar: 'border-l-violet-500', badge: 'bg-violet-950/80 text-violet-200 border-violet-500/50' }
                : isExpired
                ? { label: 'Vencida', bar: 'border-l-rose-500', badge: 'bg-rose-950/80 text-rose-300 border-rose-500/50' }
                : { label: 'Por hacer', bar: 'border-l-sky-500', badge: 'bg-sky-950/70 text-sky-200 border-sky-600/45' };

              return (
                <button
                  type="button"
                  key={activity.pageId}
                  onClick={() => onOpenActivity(activity)}
                  className={`block w-full rounded-xl border border-slate-800/90 border-l-4 ${stateStyle.bar} bg-slate-950/90 p-2.5 text-left transition-all hover:border-cyan-500/70 hover:bg-slate-900 cursor-pointer`}
                >
                  <div className={`flex items-center justify-between gap-2 ${scale.actTime} mb-1`}>
                    <span className="font-mono font-bold text-cyan-200">
                      {calendarTime(activity.start)}–{calendarTime(activity.end || activity.start)} ({diffH}h)
                    </span>
                    <span className={`rounded-full border px-2 py-0.2 text-[10px] font-semibold ${stateStyle.badge}`}>
                      {stateStyle.label}
                    </span>
                  </div>
                  <div className={`${scale.actTitle} font-medium text-slate-100 leading-snug line-clamp-2`}>
                    {calendarDisplayTitle(activity.title, calendarDomain(activity.title))}
                  </div>
                  <div className={`mt-1.5 flex items-center justify-between gap-2 ${scale.actMeta}`}>
                    <span className="text-slate-400 truncate">{calendarDomain(activity.title) || 'General'}</span>
                    <span className={activity.ftfVerified ? 'text-emerald-400 font-medium' : 'text-amber-300/90'}>
                      {activity.ftfVerified ? '✓ FTF' : 'Pend. FTF'}
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
                className={`block w-full rounded-xl border border-slate-800/70 bg-slate-950/45 p-2 text-left ${scale.actMeta} text-slate-400 opacity-75 hover:opacity-100 cursor-pointer`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-mono font-semibold">{calendarTime(activity.start)}–{calendarTime(activity.end || activity.start)}</span>
                  <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.2 text-slate-400 text-[10px]">
                    Suspendida (no cuenta)
                  </span>
                </div>
                <div className="line-clamp-1 line-through">
                  {calendarDisplayTitle(activity.title, calendarDomain(activity.title))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </article>
    );
  };

  return (
    <>
      {/* Barra superior compacta integrada al calendario */}
      <section className="shrink-0 border-b border-cyan-900/50 bg-[#0B101B]/95 px-3 py-2 text-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectDate?.(shiftFtfDate(date, -1))}
                className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                title="Ver día anterior"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => onSelectDate?.(shiftFtfDate(date, 1))}
                className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                title="Ver día siguiente"
              >
                ▶
              </button>
            </div>

            <button
              type="button"
              onClick={() => (isOpen ? setIsOpen(false) : openWindow(windowMode))}
              className="flex items-center gap-1.5 font-semibold text-cyan-200 text-xs hover:text-cyan-100 cursor-pointer"
              title="Abrir bitácora desacoplada para ver columnas y actividades sin amontonar"
            >
              <ShieldCheck size={16} className="text-cyan-400" />
              <span>Bitácora del equipo (FTF) · {date}</span>
            </button>

            {report && (
              <div className="flex items-center gap-2 text-[11px] text-slate-300 flex-wrap">
                <span className="rounded bg-cyan-950/60 px-2 py-0.5 border border-cyan-800/60 text-cyan-200 font-mono">
                  {report.totalAssignedHours}h asignadas · {report.totalCompletedHours || 0}h cerradas/rev.
                </span>
                <span className="text-slate-400">
                  <strong className="text-emerald-400">{activePeopleCount}</strong> conectados ·{' '}
                  <strong className="text-slate-300">{absentPeopleCount}</strong> sin señal
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => openWindow('large')}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                isOpen && windowMode === 'large'
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                  : 'border-cyan-700/80 bg-cyan-950/60 text-cyan-200 hover:bg-cyan-900/70'
              }`}
              title="Abrir Bitácora en ventana grande en columnas para ver a todo el equipo sin hacer scroll hacia abajo"
            >
              <Maximize2 size={12} />
              <span>Ventana grande</span>
            </button>

            <button
              type="button"
              onClick={() => openWindow('compact')}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                isOpen && windowMode === 'compact'
                  ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                  : 'border-slate-700 bg-slate-900/80 text-slate-200 hover:border-indigo-500 hover:text-indigo-200'
              }`}
              title="Abrir Bitácora en ventana flotante pequeña para comparar al lado del calendario"
            >
              <PanelRightOpen size={12} />
              <span>Ventana pequeña</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowWeek(v => !v);
                if (!isOpen) openWindow('large');
              }}
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-xs text-cyan-200 hover:bg-slate-800 cursor-pointer"
            >
              Matriz semanal
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              disabled={!report}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200 hover:border-cyan-600 disabled:opacity-40 cursor-pointer"
            >
              {copiedReport ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedReport ? 'Copiado' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => setRevision(v => v + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-cyan-200 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              title="Recargar bitácora"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Cargando…' : 'Actualizar'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Ventana Desacoplada (Grande o Pequeña flotante comparativa) */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={
              windowMode === 'large'
                ? 'fixed inset-0 z-[320] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5'
                : 'fixed inset-0 z-[320] pointer-events-none'
            }
            onClick={() => {
              if (windowMode === 'large') setIsOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal={windowMode === 'large'}
              aria-label="Bitácora del equipo FTF"
              onClick={e => e.stopPropagation()}
              style={
                windowMode === 'compact'
                  ? {
                      left: `${compactPos.x}px`,
                      top: `${compactPos.y}px`,
                      width: 'min(540px, calc(100vw - 24px))',
                      height: 'min(620px, calc(100vh - 32px))',
                      resize: 'both',
                    }
                  : undefined
              }
              className={
                windowMode === 'large'
                  ? 'flex flex-col w-full max-w-[1720px] h-[92dvh] rounded-2xl border border-cyan-700/60 bg-[#080d16] text-slate-100 shadow-[0_24px_90px_rgba(0,0,0,0.85)] overflow-hidden'
                  : 'fixed pointer-events-auto flex flex-col min-w-[340px] min-h-[340px] max-w-[96vw] max-h-[92vh] rounded-2xl border-2 border-cyan-500/60 bg-[#080d16]/95 text-slate-100 shadow-[0_20px_70px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-md'
              }
            >
              {/* Barra superior de la ventana desacoplada (en modo compacto funciona como barra para arrastrar) */}
              <header
                onMouseDown={e => {
                  if (windowMode !== 'compact') return;
                  if ((e.target as HTMLElement).closest('button, input, select')) return;
                  dragStateRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: compactPos.x,
                    origY: compactPos.y,
                  };
                }}
                className={`shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0c1422] px-4 py-2.5 ${
                  windowMode === 'compact' ? 'cursor-move select-none' : ''
                }`}
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  {windowMode === 'compact' && <GripHorizontal size={15} className="text-cyan-400/70" />}
                  <ShieldCheck size={18} className="text-cyan-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white">Bitácora del Equipo · {date}</h2>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectDate?.(shiftFtfDate(date, -1))}
                          className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-[10.5px] text-slate-300 hover:text-white cursor-pointer"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectDate?.(shiftFtfDate(date, 1))}
                          className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-[10.5px] text-slate-300 hover:text-white cursor-pointer"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-400">
                      100 pts = Asistencia (20) + Agenda FTF (20) + Avance (35) + Cierre 18:30 (25)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {canMarkReview && report && (
                    <button
                      type="button"
                      disabled={publishingScores}
                      onClick={handlePublishCutoff}
                      className="flex items-center gap-1 rounded-lg border border-indigo-500/70 bg-indigo-950/70 px-2.5 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-900 cursor-pointer disabled:opacity-50"
                    >
                      <Send size={12} />
                      <span>{publishingScores ? 'Enviando…' : 'Enviar calif.'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowWeek(v => !v)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                      showWeek
                        ? 'border-cyan-400 bg-cyan-950 text-cyan-100'
                        : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-600'
                    }`}
                  >
                    {showWeek ? 'Ver columnas del día' : 'Matriz semanal'}
                  </button>

                  {canMarkReview && (
                    <button
                      type="button"
                      onClick={toggleSupervisorReview}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        supervisorReview
                          ? 'border-emerald-500/70 bg-emerald-950/60 text-emerald-200'
                          : 'border-slate-700 bg-slate-900 text-emerald-300 hover:border-emerald-500'
                      }`}
                    >
                      <CheckCircle2 size={12} />
                      <span>{supervisorReview ? `Revisada (${supervisorReview.reviewer})` : 'Marcar revisada'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyReport}
                    disabled={!report}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:border-cyan-600 cursor-pointer"
                  >
                    {copiedReport ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedReport ? 'Copiado' : 'Copiar'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setRevision(v => v + 1)}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-cyan-200 hover:bg-slate-800 cursor-pointer"
                  >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  </button>

                  {/* Selector de tamaño de texto y tiempos (A / A+ / A++) */}
                  <div
                    className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5"
                    title="Tamaño de letra y tiempos en las columnas"
                  >
                    {([
                      { id: 'normal' as const, label: 'A', desc: 'Compacto' },
                      { id: 'large' as const, label: 'A+', desc: 'Grande' },
                      { id: 'xl' as const, label: 'A++', desc: 'Extra grande' },
                    ]).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateTextScale(opt.id)}
                        title={`Texto ${opt.desc}`}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                          textScale === opt.id
                            ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/60'
                            : 'text-slate-400 hover:text-white border border-transparent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Selector rápido Grande ↔ Pequeña */}
                  <button
                    type="button"
                    onClick={() => switchWindowMode(windowMode === 'large' ? 'compact' : 'large')}
                    className="flex items-center gap-1 rounded-lg border border-cyan-700/80 bg-cyan-950/60 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-900 cursor-pointer"
                    title={windowMode === 'large' ? 'Cambiar a ventana pequeña flotante para comparar con el calendario' : 'Ampliar a ventana grande'}
                  >
                    {windowMode === 'large' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    <span>{windowMode === 'large' ? 'Ventana pequeña' : 'Ventana grande'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-slate-700 bg-slate-900 p-1 text-slate-300 hover:border-rose-500 hover:text-rose-200 cursor-pointer"
                    title="Cerrar bitácora (Esc)"
                  >
                    <X size={15} />
                  </button>
                </div>
              </header>

              {/* Filtros y búsqueda limpia */}
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-[#0a111d] px-4 py-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all' as const, label: `Todos (${peopleScored.length})` },
                    { id: 'active' as const, label: `Conectados / Con trabajo (${activePeopleCount})` },
                    { id: 'absent' as const, label: `Sin señal (${absentPeopleCount})` },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPersonFilter(tab.id)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                        personFilter === tab.id
                          ? 'border-cyan-500/80 bg-cyan-950/80 text-cyan-100'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-xs justify-end">
                  <div className="relative w-full">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Filtrar integrante o actividad..."
                      className="w-full rounded-lg border border-slate-700/80 bg-slate-950 pl-7 pr-2.5 py-1 text-[11px] text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Selector rápido de persona en modo ventana pequeña para no saturar */}
              {windowMode === 'compact' && !showWeek && report && (
                <div className="shrink-0 flex items-center gap-1 overflow-x-auto border-b border-slate-800/70 bg-slate-950/60 px-3 py-1.5 text-[10.5px]">
                  <button
                    type="button"
                    onClick={() => setSelectedCompactPerson('')}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 border cursor-pointer ${
                      selectedCompactPerson === ''
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100 font-semibold'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos
                  </button>
                  {peopleScored.map(({ person, scoreInfo }) => (
                    <button
                      key={person.name}
                      type="button"
                      onClick={() => setSelectedCompactPerson(person.name)}
                      className={`shrink-0 rounded-full px-2.5 py-0.5 border cursor-pointer ${
                        selectedCompactPerson === person.name
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100 font-semibold'
                          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {person.name} <span className="font-mono opacity-75">({scoreInfo.finalScore})</span>
                    </button>
                  ))}
                </div>
              )}

              {publishNotice && (
                <div role="status" className="mx-4 mt-2 rounded-lg border border-indigo-500/60 bg-indigo-950/50 px-3 py-1.5 text-xs text-indigo-200 flex items-center justify-between">
                  <span>{publishNotice}</span>
                  <button type="button" onClick={() => setPublishNotice('')} className="cursor-pointer">✕</button>
                </div>
              )}

              {error && (
                <div role="alert" className="mx-4 mt-2 rounded-lg border border-rose-800/60 bg-rose-950/40 p-2.5 text-xs text-rose-300">
                  {error}
                </div>
              )}

              {/* Contenido principal: Matriz Semanal o Columnas limpias por colaborador */}
              <div className="flex-1 min-h-0 p-3.5 overflow-hidden">
                {showWeek ? (
                  <div className="h-full overflow-auto">
                    <CalendarFtfWeek date={date} />
                  </div>
                ) : !report ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Cargando bitácora del equipo…
                  </div>
                ) : filteredPeople.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Ningún integrante coincide con el filtro actual.
                  </div>
                ) : windowMode === 'large' ? (
                  <div className="flex h-full gap-3.5 overflow-x-auto pb-2 items-stretch">
                    {filteredPeople.map(item => renderPersonColumn(item))}
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto space-y-3 pr-1">
                    {filteredPeople.map(item => renderPersonColumn(item))}
                  </div>
                )}
              </div>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
