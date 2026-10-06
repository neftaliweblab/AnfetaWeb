"use client";
import {CalendarFinanceColumn} from './CalendarFinanceColumn';
import {readApiJson} from '@/lib/readApiJson';
import {workflowState} from '@/services/activityWorkflow';
import {CalendarBatchModal} from './CalendarBatchModal';
import { CalendarReviewNotifications } from './CalendarReviewNotifications';

import React, { useState, useMemo, useEffect } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { CalendarTopControls } from "./CalendarTopControls";
import { CalendarColHeader } from "./CalendarColHeader";
import { ActivityCard } from "./ActivityCard";
import { CalendarPeoplePickerModal } from "./CalendarPeoplePickerModal";
import { CalendarPersonPreviewPanel } from "./CalendarPersonPreviewPanel";
import { CalendarTemplatesModal } from "./CalendarTemplatesModal";
import { AutomationReportModal } from "../DailyProgressPanel/AutomationReportModal";
import { normalizePerson } from "@/services/identityNormalizer";
import { computeActivityOverlaps } from "@/utils/calendarLayout";

import { canEditActivity, scheduleAtDrop, isDirection } from '@/services/activityPermissions';
import { CreateActivityModal } from './CreateActivityModal';
import { CalendarDetailPanel } from './CalendarDetailPanel';
import { anfetaSync } from '@/lib/anfetaBroadcastSync';
interface CalendarHostProps {
  active?: boolean;
  currentUser: string;
  activities: NotionCalendarActivity[];
  currentDate: string;
  onSelectDate: (date: string) => void;
  availableDates: string[];
  onBackToSearch?: () => void;
  automationReport?: any;
  searchFilterQuery?: string;
  onClearSearchFilter?: () => void;
  onOpenStandaloneWindow?: () => void;
  onRunAutomation?: () => void;
  onOpenDailyProgress?: () => void;
  onRefresh?: () => void;
  loadError?: string;
}

const DEFAULT_COLLABORATORS = [
  "John",
  "Karla",
  "Isaias",
  "Sotelo",
  "Acalli",
  "Andrade",
  "Brian",
  "Genaro",
  "Neftali",
  "Sin asignar",
];

export function CalendarHost({
  activities: initialActivities, currentUser, active = true,
  currentDate,
  onSelectDate,
  availableDates,
  onBackToSearch,
  automationReport,
  searchFilterQuery = "",
  onClearSearchFilter,
  onOpenStandaloneWindow,
  onRunAutomation,
  onOpenDailyProgress,
  onRefresh,
  loadError,
}: CalendarHostProps) {
  const [activitiesList, setActivitiesList] = useState<NotionCalendarActivity[]>(initialActivities);
  const [error, setError] = useState('');
  const [showBatch,setShowBatch]=useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const mutationVersion = React.useRef(0);
  const pending = React.useRef(new Set<string>());
  const [pixelsPerHour, setPixelsPerHour] = useState(72);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [phaseFilter,setPhaseFilter]=useState('');
  const [extraHours,setExtraHours]=useState(false);
  const [financeItems,setFinanceItems]=useState<any[]>([]);
  const [financeWarning,setFinanceWarning]=useState('');
  const [financePosition,setFinancePosition]=useState<'before'|'after'>('after');
  const [filterCobros, setFilterCobros] = useState(false);
  const [filterPagos, setFilterPagos] = useState(false);
  const [visiblePeople, setVisiblePeople] = useState<string[]>(DEFAULT_COLLABORATORS);
  const [peopleOrder, setPeopleOrder] = useState<string[]>(DEFAULT_COLLABORATORS);
  const [columnWidth, setColumnWidth] = useState(260);
  const [preferencesLoaded, setPreferencesLoaded] = useState('');
  const preferencesKey = 'anfeta-calendar-layout-v1:' + normalizePerson(currentUser);
  useEffect(() => {
    let visible = DEFAULT_COLLABORATORS, order = DEFAULT_COLLABORATORS, width = 260, height = 72;
    try {
      const saved = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
      if (saved) {
        const valid = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((p): p is string => typeof p === 'string' && DEFAULT_COLLABORATORS.includes(p)))] : DEFAULT_COLLABORATORS;
        order = valid(saved.order);
        order = [...order, ...DEFAULT_COLLABORATORS.filter(p => !order.includes(p))];
        visible = valid(saved.visible);
        if (Number.isFinite(saved.width)) width = Math.min(600, Math.max(180, saved.width));
        if (Number.isFinite(saved.height)) height = Math.min(120, Math.max(48, saved.height));
      }
    } catch { /* Invalid or unavailable storage falls back to defaults. */ }
    try {const saved=JSON.parse(localStorage.getItem(preferencesKey)||'null');setPhaseFilter(typeof saved?.phase==='string'?saved.phase:'');setExtraHours(saved?.extraHours===true);setFilterCobros(saved?.cobros===true);setFilterPagos(saved?.pagos===true);setFinancePosition(saved?.financePosition==='before'?'before':'after');}catch{}
    setPeopleOrder(order); setVisiblePeople(visible); setColumnWidth(width); setPixelsPerHour(height);
    setPreferencesLoaded(preferencesKey);
  }, [preferencesKey]);
  useEffect(() => {
    if (preferencesLoaded !== preferencesKey) return;
    try { localStorage.setItem(preferencesKey, JSON.stringify({order:peopleOrder, visible:visiblePeople, width:columnWidth, height:pixelsPerHour,phase:phaseFilter,extraHours,cobros:filterCobros,pagos:filterPagos,financePosition})); }
    catch { /* Layout remains usable when browser storage is unavailable. */ }
  }, [preferencesKey, preferencesLoaded, peopleOrder, visiblePeople, columnWidth, pixelsPerHour, phaseFilter, extraHours, filterCobros, filterPagos, financePosition]);
  const movePerson = (person: string, direction: number) => setPeopleOrder(prev => {
    const index = prev.indexOf(person), target = index + direction;
    if (index < 0 || target < 0 || target >= prev.length) return prev;
    const next = [...prev]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const [selectedPersonPreview, setSelectedPersonPreview] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<NotionCalendarActivity | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    setActivitiesList(initialActivities);
    setSelectedActivity(prev => prev ? initialActivities.find(a => a.pageId === prev.pageId) || null : null);
  }, [initialActivities]);
  useEffect(() => { if (loadError) setError(loadError); }, [loadError]);

  // Listener en tiempo real multi-ventana y multi-pestaña
  useEffect(() => {
    const unsubscribe = anfetaSync.subscribe((msg) => {
      if (msg.type === "CALENDAR_REFRESHED" && msg.date === currentDate && msg.activities) {
        setActivitiesList(msg.activities);
      } else if (msg.type === "ACTIVITY_UPDATED" && msg.pageId && msg.updates) {
        setActivitiesList((prev) =>
          (() => {
            const saved = prev.find(a => a.pageId === msg.pageId);
            if (!saved) return prev;
            const activity = {...saved,...msg.updates};
            const next = prev.filter(a => a.pageId !== msg.pageId && a.pageId !== 'review-mirror-' + msg.pageId);
            next.push(activity);
            if (activity.reviewFlow?.State === 'pending' && activity.reviewFlow.LeaveVisualCopy !== false && normalizePerson(activity.reviewFlow.OriginalPerson) !== normalizePerson(activity.person)) next.push({...activity,pageId:'review-mirror-' + activity.pageId,person:normalizePerson(activity.reviewFlow.OriginalPerson),isReviewMirror:true,title:'[COPIA REVISIÓN] ' + activity.title});
            return next;
          })()
        );
        setSelectedActivity((prev) =>
          prev && prev.pageId === msg.pageId ? { ...prev, ...msg.updates } : prev
        );
      } else if (msg.type === "ACTIVITY_CREATED" && msg.activity) {
        setActivitiesList((prev) => {
          if (prev.some((a) => a.pageId === msg.activity.pageId)) return prev;
          return [...prev, msg.activity];
        });
      }
    });
    return () => unsubscribe();
  }, [currentDate]);

  useEffect(() => {
    if(!active)return;
    let stopped = false, busy = false, enrichOffset=0;
    let enrichmentTimer:ReturnType<typeof setTimeout>|undefined;
    const controller = new AbortController();
    const refresh = async () => {
      if (stopped || busy || document.hidden || pending.current.size) return;
      busy = true;
      const version = mutationVersion.current;
      try {
        const response = await fetch('/api/data?type=calendar&date=' + encodeURIComponent(currentDate) + '&enrichOffset=' + enrichOffset, {cache:'no-store', signal:AbortSignal.any([controller.signal, AbortSignal.timeout(60000)])});
        const data = await readApiJson(response);
        if (!response.ok || data.error) throw new Error(data.error || 'No se pudo actualizar el calendario.');
        if (stopped || pending.current.size || version !== mutationVersion.current) return;
        setActivitiesList(prev=>{
          const merged=(data.activities || []).map((activity:NotionCalendarActivity)=>{const old=prev.find(a=>a.pageId===activity.pageId);return !activity.checklistScanned && old?.checklistScanned?{...activity,checklistScanned:old.checklistScanned,checklistTotal:old.checklistTotal,checklistCompleted:old.checklistCompleted,todayChecklistCompleted:old.todayChecklistCompleted,completedChecks:old.completedChecks,reviewFlow:activity.reviewFlow || old.reviewFlow}:activity;});
          queueMicrotask(()=>anfetaSync.broadcast({type:'CALENDAR_REFRESHED',date:currentDate,activities:merged}));return merged;
        });
        enrichOffset=data.nextEnrichOffset || 0;
        if(enrichOffset)enrichmentTimer=setTimeout(refresh,100);
        setSelectedActivity(prev => prev ? (data.activities || []).find((a:NotionCalendarActivity) => a.pageId === prev.pageId) || null : null);
        setError(data.warning || '');
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'No se pudo actualizar el calendario.'); }
      finally {busy = false;}
    };
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    return () => {stopped = true; controller.abort(); clearInterval(timer);if(enrichmentTimer)clearTimeout(enrichmentTimer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh);};
  }, [currentDate, currentUser, active]);

  useEffect(()=>{
    if(!active || (!filterCobros && !filterPagos))return;
    const controller=new AbortController();setFinanceItems([]);
    const load=async()=>{try{const response=await fetch('/api/data?type=calendar-finance&date='+currentDate,{signal:controller.signal});const data=await readApiJson(response);if(!controller.signal.aborted){setFinanceItems(data.items || []);setFinanceWarning(data.warning || '');}}catch(error){if(!controller.signal.aborted)setFinanceWarning(error instanceof Error?error.message:'No se pudo cargar Cobros/Pagos.');}};
    void load();const timer=setInterval(load,60000);return()=>{controller.abort();clearInterval(timer);};
  },[currentDate,filterCobros,filterPagos,active]);

  const handleChangeZoom = (delta: number) => {
    setPixelsPerHour((prev) => Math.min(120, Math.max(48, prev + delta)));
  };

  const handleUpdateActivity = async (pageId: string, updates: Partial<NotionCalendarActivity> & { reviewer?: string; leaveVisualCopy?: boolean }) => {
    const original = activitiesList.find(a => a.pageId === pageId);
    if (!original || !canEditActivity(currentUser, original)) { setError('No puedes modificar esta actividad o está bloqueada.'); return false; }
    if (pending.current.has(pageId)) { setError('Espera a que termine el guardado de esta actividad.'); return false; }
    pending.current.add(pageId); mutationVersion.current++; setError('');
    try {
      const response = await fetch('/api/data', {
        method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(60000),
        body:JSON.stringify({ action:updates.start ? 'update-activity-schedule' : updates.reviewer || updates.person ? 'update-activity-assignee' : 'update-activity-status', payload:{id:pageId,currentUser,...updates,...(updates.start?{expectedStart:original.start}:{})} }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.activity) throw new Error(data.error || 'Notion no confirmó el guardado.');
      const saved: NotionCalendarActivity = data.activity;
      setActivitiesList(prev => {
        const next = prev.filter(a => a.pageId !== pageId && a.pageId !== 'review-mirror-' + pageId);
        next.push(saved);
        if (saved.reviewFlow?.State === 'pending' && saved.reviewFlow.LeaveVisualCopy !== false && normalizePerson(saved.reviewFlow.OriginalPerson) !== normalizePerson(saved.person)) next.push({...saved, pageId:'review-mirror-' + pageId, person:normalizePerson(saved.reviewFlow.OriginalPerson), isReviewMirror:true, title:'[COPIA REVISIÓN] ' + saved.title});
        return next;
      });
      setSelectedActivity(prev => prev?.pageId === pageId ? saved : prev);
      // Broadcast only the state confirmed by Notion.
      anfetaSync.broadcast({type:'ACTIVITY_UPDATED',pageId,updates:saved});
      setError(data.warning || '');
      window.dispatchEvent(new Event('anfeta_review_saved'));
      onRefresh?.();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error de conexión.');
      return false;
    } finally { pending.current.delete(pageId); }
  };

  const startHour = 8;
  const endHour = extraHours ? 22 : 21;
  const totalHours = endHour - startHour;
  const canvasHeight = totalHours * pixelsPerHour;

  const hoursList = useMemo(() => {
    const list = [];
    for (let h = startHour; h <= endHour; h++) {
      list.push(`${h.toString().padStart(2, "0")}:00`);
    }
    return list;
  }, [startHour, endHour]);

  const filteredActivities = useMemo(() => {
    return activitiesList.filter((act) => {
      if(phaseFilter && workflowState(act.status,act.title)!==phaseFilter)return false;
      const text = `${act.title} ${act.status} ${act.project} ${act.domain || ""} ${act.person || ""}`.toLowerCase();
      if (searchFilterQuery && searchFilterQuery.trim()) {
        const terms = searchFilterQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const matchesAll = terms.every((t) => text.includes(t));
        if (!matchesAll) return false;
      }
      return true;
    });
  }, [activitiesList, filterCobros, filterPagos, searchFilterQuery, phaseFilter]);

  const activitiesByPerson = useMemo(() => {
    const map: Record<string, NotionCalendarActivity[]> = {};
    visiblePeople.forEach((p) => {
      map[p] = [];
    });
    filteredActivities.forEach((act) => {
      const canonical = normalizePerson(act.person);
      if (!map[canonical]) map[canonical] = [];
      map[canonical].push(act);
    });
    return map;
  }, [filteredActivities, visiblePeople]);

  const [createSlotSeed, setCreateSlotSeed] = useState<{
    person: string;
    start: string;
    end: string;
  } | null>(null);

  // Current time tracking
  const [currentDateMinutes, setCurrentDateMinutes] = useState<number | null>(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (currentDate === todayStr) {
      return (now.getHours() - startHour) * 60 + now.getMinutes();
    }
    return null;
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (currentDate === todayStr) {
        setCurrentDateMinutes((now.getHours() - startHour) * 60 + now.getMinutes());
      } else {
        setCurrentDateMinutes(null);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [currentDate, startHour]);

  // Click on empty slot in column
  const handleColumnCanvasClick = (e: React.MouseEvent<HTMLDivElement>, colPerson: string) => {
    // Only trigger if clicking on the background canvas, not a child card
    if ((e.target as HTMLElement).closest('[data-activity-card="true"]')) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = Math.max(0, e.clientY - rect.top);
    const rawMinutes = (offsetY / pixelsPerHour) * 60;
    // Round to nearest 15 minutes
    let snappedMinutes = Math.round(rawMinutes / 15) * 15;
    const maxStartMinutes = (endHour - startHour) * 60 - 15;
    snappedMinutes = Math.min(Math.max(0, snappedMinutes), maxStartMinutes);

    const startTotalMinutes = startHour * 60 + snappedMinutes;
    const startH = Math.floor(startTotalMinutes / 60);
    const startM = startTotalMinutes % 60;

    // Default duration 60 mins (or up to 22:00)
    const endTotalMinutes = Math.min(endHour * 60, startTotalMinutes + 60);
    const endH = Math.floor(endTotalMinutes / 60);
    const endM = endTotalMinutes % 60;

    const startFormatted = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
    const endFormatted = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    setCreateSlotSeed({
      person: colPerson,
      start: startFormatted,
      end: endFormatted,
    });
    setShowCreate(true);
  };

  const handleDropOnColumn = (e: React.DragEvent, colPerson: string) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { pageId, offsetY = 0 } = JSON.parse(dataStr);
      const activity = activitiesList.find(a => a.pageId === pageId);
      if (!activity || !canEditActivity(currentUser, activity) || normalizePerson(activity.person) !== colPerson) return;

      const columnRect = e.currentTarget.getBoundingClientRect();
      // 56px es la altura del CalendarColHeader
      const y = Math.max(0, e.clientY - columnRect.top - 56 - offsetY);
      const newSchedule = scheduleAtDrop(activity, currentDate, (y / pixelsPerHour) * 60);

      void handleUpdateActivity(pageId, newSchedule);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Movimiento inválido');
    }
  };

  // Red line Y position
  const currentTimeTop = currentDateMinutes !== null && currentDateMinutes >= 0 && currentDateMinutes <= totalHours * 60
    ? (currentDateMinutes / 60) * pixelsPerHour
    : null;

  const financeColumns=<>{(['cobro','pago'] as const).filter(kind=>kind==='cobro'?filterCobros:filterPagos).map(kind=><CalendarFinanceColumn key={kind} kind={kind} items={financeItems.filter(item=>item.kind===kind)} warning={financeWarning} width={columnWidth} height={canvasHeight} pixelsPerHour={pixelsPerHour} date={currentDate} onMove={()=>setFinancePosition(p=>p==='before'?'after':'before')} onClose={()=>kind==='cobro'?setFilterCobros(false):setFilterPagos(false)} />)}</>;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B0F] relative">
      {/* Notificación de Error / Alerta Visible y Elegante */}
      {error && (
        <div
          role="alert"
          className="absolute top-14 left-1/2 -translate-x-1/2 z-[300] max-w-lg w-full px-4 py-3 rounded-xl bg-[#2A0E14] border-2 border-[#E11D48] text-rose-200 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 w-6 h-6 rounded-full bg-[#E11D48] text-white flex items-center justify-center font-bold text-xs">
              ✕
            </span>
            <div className="text-xs">
              <strong className="block text-white font-bold leading-tight">{error.startsWith('La actividad se guardó') ? 'Guardado con aviso pendiente' : 'Acción no completada'}</strong>
              <span className="text-rose-200/90 leading-tight break-words">{error}</span>
            </div>
          </div>
          <button
            onClick={() => setError("")}
            className="shrink-0 rounded p-1 text-rose-300 hover:text-white hover:bg-rose-950/40 transition-colors text-xs font-bold"
          >
            Cerrar
          </button>
        </div>
      )}
      {showBatch && <CalendarBatchModal activities={activitiesList} currentUser={currentUser} date={currentDate} onClose={()=>setShowBatch(false)} onSaved={items=>{items.forEach(activity=>anfetaSync.broadcast({type:'ACTIVITY_UPDATED',pageId:activity.pageId,updates:activity}));onRefresh?.();}} />}
      {showCreate && (
        <CreateActivityModal
          currentUser={currentUser}
          date={currentDate}
          initialPerson={createSlotSeed?.person}
          initialStart={createSlotSeed?.start}
          initialEnd={createSlotSeed?.end}
          onClose={() => {
            setShowCreate(false);
            setCreateSlotSeed(null);
          }}
          onCreated={(activity) => {
            setActivitiesList((prev) => [...prev, activity]);
            anfetaSync.broadcast({
              type: "ACTIVITY_CREATED",
              activity,
            });
            setShowCreate(false);
            setCreateSlotSeed(null);
            onRefresh?.();
          }}
        />
      )}
      <CalendarTopControls
        phaseFilter={phaseFilter}
        onPhaseFilter={setPhaseFilter}
        extraHours={extraHours}
        onExtraHours={()=>setExtraHours(prev=>!prev)}
        onOpenBatch={()=>setShowBatch(true)}
        reviewNotifications={<CalendarReviewNotifications currentUser={currentUser} />}
        onCreateActivity={() => {
          setCreateSlotSeed(null);
          setShowCreate(true);
        }}
        currentDate={currentDate}
        onSelectDate={onSelectDate}
        availableDates={availableDates}
        onOpenPeoplePicker={() => setShowPeoplePicker(true)}
        totalActivitiesCount={filteredActivities.filter(a => !a.isReviewMirror).length}
        pixelsPerHour={pixelsPerHour}
        onChangeZoom={handleChangeZoom}
        onResetZoom={() => setPixelsPerHour(72)}
        filterCobros={filterCobros}
        onToggleCobros={() => setFilterCobros(!filterCobros)}
        filterPagos={filterPagos}
        onTogglePagos={() => setFilterPagos(!filterPagos)}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenReport={() => setShowReport(true)}
        onBackToSearch={() => onBackToSearch?.()}
        searchFilterQuery={searchFilterQuery}
        onClearSearchFilter={onClearSearchFilter}
        onRunAutomation={onRunAutomation}
        onOpenDailyProgress={onOpenDailyProgress}
        onRefresh={onRefresh}
        onOpenStandaloneWindow={onOpenStandaloneWindow}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex overflow-auto scrollbar-thin relative select-none">
          {/* Sticky Left Time Rail */}
          <div
            className="w-16 bg-[#0F141A] border-r border-[#26323E] flex-shrink-0 sticky left-0 z-45"
            style={{ height: `${canvasHeight + 56}px` }}
          >
            <div className="h-14 border-b border-[#26323E] flex items-center justify-center text-[10px] font-mono text-[#64748B]">
              HORA
            </div>
            <div className="relative" style={{ height: `${canvasHeight}px` }}>
              {hoursList.map((hour, idx) => (
                <div
                  key={hour}
                  style={{ top: `${idx * pixelsPerHour}px` }}
                  className="absolute w-full text-right pr-2 text-[10px] font-mono text-[#64748B] -translate-y-2"
                >
                  {hour}
                </div>
              ))}
              {/* Current time red tag on time rail */}
              {currentTimeTop !== null && (
                <div
                  style={{ top: `${currentTimeTop}px` }}
                  className="absolute right-0 -translate-y-1/2 z-50 flex items-center"
                >
                  <span className="bg-[#EF4444] text-white text-[8.5px] font-bold px-1 rounded-l shadow-sm font-mono">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Collaborators Columns - Fluid and Auto-expanding with min width guarantee */}
          <div className="flex flex-1 relative" style={{ minWidth: Math.max(1, visiblePeople.length + Number(filterCobros) + Number(filterPagos)) * columnWidth }}>
            {/* Global red line across all columns */}
            {currentTimeTop !== null && (
              <div
                style={{ top: `${currentTimeTop + 56}px` }}
                className="absolute left-0 right-0 h-[2px] bg-[#EF4444] z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.7)]"
              >
                <div className="w-2 h-2 rounded-full bg-[#EF4444] -translate-y-[3px] -translate-x-1" />
              </div>
            )}

            {financePosition==='before' && financeColumns}
            {visiblePeople.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#64748B]">
                <p className="text-sm font-medium text-[#94A3B8]">No hay colaboradores visibles en el calendario</p>
                <p className="text-xs text-[#64748B] mt-1">Haz clic en el selector para activar columnas</p>
                <button
                  onClick={() => setShowPeoplePicker(true)}
                  className="mt-3 px-3 py-1.5 rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848] text-xs font-medium"
                >
                  Configurar colaboradores
                </button>
              </div>
            ) : (
              peopleOrder.filter(person => visiblePeople.includes(person)).map((person) => {
                const personActivities = activitiesByPerson[person] || [];
                const positioned = computeActivityOverlaps(personActivities, currentDate);

                // Compute person KPIs
                let totalChecks = 0;
                let doneChecks = 0;
                let totalCoverageHours = 0;

                personActivities.forEach((act) => {
                  if (act.isReviewMirror) return;
                  totalChecks += act.checklistTotal || 0;
                  doneChecks += act.checklistCompleted || 0;
                  if (act.start && act.end) {
                    const st = new Date(act.start).getTime();
                    const en = new Date(act.end).getTime();
                    if (en > st) {
                      totalCoverageHours += (en - st) / 3600000;
                    }
                  }
                });

                const checklistPercent = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0;

                return (
                  <div
                    key={person}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnColumn(e, person)}
                    className="min-w-0 border-r border-[#202832] flex flex-col"
                    style={{ height: `${canvasHeight + 56}px`, flex: `1 0 ${columnWidth}px`, width: columnWidth }}
                  >
                    <CalendarColHeader
                      personName={person}
                      activityCount={personActivities.length}
                      checklistPercent={checklistPercent}
                      totalChecklistItems={totalChecks}
                      completedChecklistItems={doneChecks}
                      coverageHours={totalCoverageHours}
                      onSelectPerson={(p) => setSelectedPersonPreview(p)}
                    />
                    <div
                      onClick={(e) => handleColumnCanvasClick(e, person)}
                      className="relative flex-1 overflow-hidden bg-[#080B0F] cursor-pointer"
                      style={{ height: `${canvasHeight}px` }}
                      title={`Haz clic en un hueco vacío para crear actividad para ${person}`}
                    >
                      {hoursList.map((_, idx) => (
                        <div
                          key={idx}
                          style={{ top: `${idx * pixelsPerHour}px` }}
                          className="absolute w-full h-px bg-[#161F2B] pointer-events-none"
                        />
                      ))}
                      {positioned.map(({ activity: act, overlapIndex, overlapTotal }, idx) => (
                        <ActivityCard
                          key={act.pageId || idx}
                          activity={act}
                          displayDate={currentDate}
                          currentUser={currentUser}
                          pixelsPerHour={pixelsPerHour}
                          overlapIndex={overlapIndex}
                          overlapTotal={overlapTotal}
                          isSelected={selectedActivity?.pageId === act.pageId && isDetailOpen}
                          onSelectActivity={(selected) => {
                            setSelectedActivity(selected);
                            setIsDetailOpen(true);
                          }}
                          onUpdateActivity={handleUpdateActivity}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            {financePosition==='after' && financeColumns}
          </div>
        </div>

        {/* Panel Lateral de Detalle y Checklist (WPF Parity) */}
        {selectedActivity && isDetailOpen && (
          <CalendarDetailPanel
            activity={selectedActivity}
            currentUser={currentUser}
            allActivities={activitiesList}
            onSelectActivity={(act) => setSelectedActivity(act)}
            onClose={() => setIsDetailOpen(false)}
            onActivityUpdated={(updates) => handleUpdateActivity(selectedActivity.pageId, updates)}
            onChecklistUpdated={(updates) => {
              const pageId = selectedActivity.pageId;
              setActivitiesList(prev => prev.map(a => a.pageId === pageId ? {...a,...updates} : a));
              setSelectedActivity(prev => prev ? {...prev,...updates} : prev);
              anfetaSync.broadcast({type:'ACTIVITY_UPDATED',pageId,updates});
            }}
          />
        )}
      </div>

      {showPeoplePicker && (
        <CalendarPeoplePickerModal
          allPeople={peopleOrder}
          columnWidth={columnWidth}
          onChangeWidth={setColumnWidth}
          onMovePerson={movePerson}
          visiblePeople={visiblePeople}
          onTogglePerson={(p) => {
            setVisiblePeople((prev) =>
              prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
            );
          }}
          onClose={() => setShowPeoplePicker(false)}
        />
      )}

      {selectedPersonPreview && (
        <CalendarPersonPreviewPanel
          personName={selectedPersonPreview}
          activities={activitiesByPerson[selectedPersonPreview] || []}
          currentDate={currentDate}
          onClose={() => setSelectedPersonPreview(null)}
        />
      )}

      {showTemplates && (
        <CalendarTemplatesModal
          currentUser={currentUser}
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          currentDate={currentDate}
          onActivitiesCreated={(created) => {
            setActivitiesList((prev) => [...prev, ...created]);
            created.forEach(activity=>anfetaSync.broadcast({type:"ACTIVITY_CREATED",activity}));
            onRefresh?.();
          }}
        />
      )}

      {showReport && (
        <AutomationReportModal report={automationReport} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
