"use client";
import {UpdateNotice} from '../UpdateNotice';
import {retainedReviewFlow} from '@/lib/retainedReviewFlow';
import {confirmedCalendarActivity} from '@/lib/confirmedCalendarActivity';
import {calendarConflict,nearbyFreeCalendarSlots} from '@/services/calendarConflicts';
import {planDurationCascade} from '@/services/calendarPlanner';
import {CalendarHourGrid} from './CalendarHourGrid';
import {calendarThemes,parseCalendarTheme} from '@/lib/calendarTheme';
import {offlineAwareFetch} from '@/services/offlineQueue';
import {CalendarSummaryModal} from './CalendarSummaryModal';
import {financeSlot} from '@/lib/financeColumnOptions';
import {reviewTitle} from '@/services/reviewTitle';
import {CalendarLayoutCloud} from './CalendarLayoutCloud';
import {calendarLayoutPreference} from '@/lib/calendarLayoutPreferences';
import {CalendarRemindersColumn} from './CalendarRemindersColumn';
import {CalendarFinanceColumn} from './CalendarFinanceColumn';
import {readApiJson} from '@/lib/readApiJson';
import {mexicoDate} from '@/services/calendarPresentation';
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

import { canEditActivity, scheduleAtDrop, isDirection, isReviewer } from '@/services/activityPermissions';
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
  initialCacheMeta?:any;
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
  "Emmanuel",
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
  loadError,initialCacheMeta,
}: CalendarHostProps) {
  const [activitiesList, setActivitiesList] = useState<NotionCalendarActivity[]>(initialActivities);
  const [error, setError] = useState('');
  const [refreshWarning,setRefreshWarning]=useState('');
  const [gridTheme,setGridTheme]=useState(calendarThemes.soft),[themeOwner,setThemeOwner]=useState('');
  const themeKey='anfeta_calendar_theme_v1:'+normalizePerson(currentUser);
  useEffect(()=>{let raw=null;try{raw=localStorage.getItem(themeKey);}catch{}setGridTheme(parseCalendarTheme(raw));setThemeOwner(themeKey);},[themeKey]);
  useEffect(()=>{if(themeOwner!==themeKey)return;try{localStorage.setItem(themeKey,JSON.stringify(gridTheme));}catch{}},[gridTheme,themeOwner,themeKey]);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 6000);
    return () => clearTimeout(timer);
  }, [error]);
  const [headerSummary,setHeaderSummary]=useState<{person:string|null}|null>(null),[previewTab,setPreviewTab]=useState<'checks'|'activities'>('checks'),[batchDefaults,setBatchDefaults]=useState<{person:string;day:string}|null>(null);const [showBatch,setShowBatch]=useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [durationProposal,setDurationProposal]=useState<any[]|undefined>();
  const mutationVersion = React.useRef(0);
  const pending = React.useRef(new Set<string>());
  const [,setSaveRevision]=useState(0);
  const recentSaves=React.useRef(new Map<string,{activity:NotionCalendarActivity,until:number}>());
  const recentHandoffs=React.useRef(new Map<string,{activity:NotionCalendarActivity,until:number}>());

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const autoScrollRaf = React.useRef<number | null>(null);
  const autoScrollSpeed = React.useRef<number>(0);

  const stopAutoScroll = React.useCallback(() => {
    if (autoScrollRaf.current !== null) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
    autoScrollSpeed.current = 0;
  }, []);

  const startAutoScroll = React.useCallback((speed: number) => {
    autoScrollSpeed.current = speed;
    if (autoScrollRaf.current !== null) return;

    const scrollLoop = () => {
      const container = scrollContainerRef.current;
      if (!container || autoScrollSpeed.current === 0) {
        autoScrollRaf.current = null;
        return;
      }
      const prev = container.scrollTop;
      container.scrollTop += autoScrollSpeed.current;
      if (container.scrollTop === prev && ((autoScrollSpeed.current < 0 && container.scrollTop <= 0) || (autoScrollSpeed.current > 0 && container.scrollTop + container.clientHeight >= container.scrollHeight))) {
        stopAutoScroll();
        return;
      }
      autoScrollRaf.current = requestAnimationFrame(scrollLoop);
    };
    autoScrollRaf.current = requestAnimationFrame(scrollLoop);
  }, [stopAutoScroll]);

  const handleContainerDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clientY = e.clientY;
    const threshold = 70;
    const maxSpeed = 16;

    const distTop = clientY - rect.top;
    const distBottom = rect.bottom - clientY;

    if (distTop >= 0 && distTop < threshold) {
      const intensity = Math.max(0, Math.min(1, (threshold - distTop) / threshold));
      const speed = -Math.round(intensity * maxSpeed + 2);
      startAutoScroll(speed);
    } else if (distBottom >= 0 && distBottom < threshold) {
      const intensity = Math.max(0, Math.min(1, (threshold - distBottom) / threshold));
      const speed = Math.round(intensity * maxSpeed + 2);
      startAutoScroll(speed);
    } else {
      stopAutoScroll();
    }
  }, [startAutoScroll, stopAutoScroll]);

  React.useEffect(() => {
    const onDragEnd = () => stopAutoScroll();
    window.addEventListener('dragend', onDragEnd);
    return () => {
      window.removeEventListener('dragend', onDragEnd);
      stopAutoScroll();
    };
  }, [stopAutoScroll]);
  const protectSaved=(incoming:NotionCalendarActivity[])=>{
    const historical=new Map(incoming.filter(a=>a.isHandoffMirror).map(a=>[a.pageId,a]));
    for(const [id,saved] of recentHandoffs.current){if(saved.until<Date.now()){recentHandoffs.current.delete(id);continue;}if(mexicoDate(saved.activity.start)===currentDate)historical.set(id,saved.activity);}
    const originals=incoming.filter(a=>!a.isReviewMirror).map(a=>{const saved=recentSaves.current.get(a.pageId);if(!saved)return a;if(saved.until<Date.now()){recentSaves.current.delete(a.pageId);return a;}return confirmedCalendarActivity(a,saved.activity);});
    const mirrors=originals.filter(a=>a.reviewFlow?.State==='pending'&&a.reviewFlow.LeaveVisualCopy!==false&&normalizePerson(a.reviewFlow.OriginalPerson)!==normalizePerson(a.person)).map(a=>({...a,pageId:'review-mirror-'+a.pageId,person:normalizePerson(a.reviewFlow!.OriginalPerson),isReviewMirror:true,title:'[COPIA REVISIÓN] '+a.title}));return [...originals,...mirrors,...historical.values()];
  };
  const [pixelsPerHour, setPixelsPerHour] = useState(72);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [phaseFilter,setPhaseFilter]=useState('');
  const [calendarPalette, setCalendarPalette] = useState<"web" | "desktop">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_calendar_palette");
        if (saved === "web" || saved === "desktop") return saved;
      } catch {}
    }
    return "web";
  });
  const handleTogglePalette = () => {
    setCalendarPalette((prev) => {
      const next = prev === "web" ? "desktop" : "web";
      try {
        localStorage.setItem("anfeta_calendar_palette", next);
      } catch {}
      return next;
    });
  };
  const [extraHours,setExtraHours]=useState(false);
  const [financeItems,setFinanceItems]=useState<any[]>([]);
  const [financeWarning,setFinanceWarning]=useState('');
  const [financeSlots,setFinanceSlots]=useState({cobro:DEFAULT_COLLABORATORS.length,pago:DEFAULT_COLLABORATORS.length});const [financePosition,setFinancePosition]=useState<'before'|'after'>('after');
  const [cacheMeta,setCacheMeta]=useState<any>(initialCacheMeta);
  useEffect(()=>setCacheMeta(initialCacheMeta),[initialCacheMeta,currentDate]);
  const [showReminders,setShowReminders]=useState(false);
  const [financeLoading,setFinanceLoading]=useState(false);const [filterCobros, setFilterCobros] = useState(false);
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
    try {const saved=JSON.parse(localStorage.getItem(preferencesKey)||'null');setPhaseFilter(typeof saved?.phase==='string'?saved.phase:'');setExtraHours(saved?.extraHours===true);setShowReminders(saved?.reminders===true);setFilterCobros(saved?.cobros===true);setFilterPagos(saved?.pagos===true);setFinancePosition(saved?.financePosition==='before'?'before':'after');setFinanceSlots({cobro:financeSlot(saved?.financeSlots?.cobro,DEFAULT_COLLABORATORS.length,saved?.financePosition),pago:financeSlot(saved?.financeSlots?.pago,DEFAULT_COLLABORATORS.length,saved?.financePosition)});}catch{}
    setPeopleOrder(order); setVisiblePeople(visible); setColumnWidth(width); setPixelsPerHour(height);
    setPreferencesLoaded(preferencesKey);
  }, [preferencesKey]);
  useEffect(() => {
    if (preferencesLoaded !== preferencesKey) return;
    try { localStorage.setItem(preferencesKey, JSON.stringify({order:peopleOrder, visible:visiblePeople, width:columnWidth, height:pixelsPerHour,phase:phaseFilter,extraHours,cobros:filterCobros,pagos:filterPagos,financePosition,financeSlots,reminders:showReminders})); }
    catch { /* Layout remains usable when browser storage is unavailable. */ }
  }, [preferencesKey, preferencesLoaded, peopleOrder, visiblePeople, columnWidth, pixelsPerHour, phaseFilter, extraHours, filterCobros, filterPagos, financePosition,financeSlots,showReminders]);
  const movePerson = (person: string, direction: number) => setPeopleOrder(prev => {
    const index = prev.indexOf(person), target = index + direction;
    if (index < 0 || target < 0 || target >= prev.length) return prev;
    const next = [...prev]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const [selectedPersonPreview, setSelectedPersonPreview] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<NotionCalendarActivity | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    setActivitiesList(prev=>pending.current.size?[...initialActivities.filter(a=>!pending.current.has(a.pageId)&&!pending.current.has(a.pageId.replace(/^review-mirror-/,''))),...prev.filter(a=>pending.current.has(a.pageId)||pending.current.has(a.pageId.replace(/^review-mirror-/,'')))]:protectSaved(initialActivities));
  }, [initialActivities]);
  useEffect(() => {setRefreshWarning(loadError||'');}, [loadError]);

  // Listener en tiempo real multi-ventana y multi-pestaña
  useEffect(() => {
    const unsubscribe = anfetaSync.subscribe((msg) => {
      if (msg.type === "CALENDAR_REFRESHED" && msg.date === currentDate && msg.activities) {
        if(!pending.current.size)setActivitiesList(protectSaved(msg.activities));
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
    let stopped = false, busy = false, lightBusy=false, enrichOffset=0, basic=true, sequence=0, appliedSequence=0;
    let enrichmentTimer:ReturnType<typeof setTimeout>|undefined;
    const controller = new AbortController();
    const refresh = async (light=false) => {
      if (stopped || (light?lightBusy:busy) || document.hidden || pending.current.size) return;
      if(light)lightBusy=true;else busy = true;
      const version = mutationVersion.current;
      const requestSequence=++sequence;
      try {
        const response = await fetch('/api/data?type=calendar&date=' + encodeURIComponent(currentDate) + (light||basic?'&basic=1':'&enrichOffset=' + enrichOffset), {cache:'no-store', signal:AbortSignal.any([controller.signal, AbortSignal.timeout(60000)])});
        const data = await readApiJson(response);
        if (!response.ok || data.error) throw new Error(data.error || 'No se pudo actualizar el calendario.');
        if (stopped || pending.current.size || version !== mutationVersion.current) return;
        // Una lectura lenta de metadatos no debe reemplazar una lectura reciente del horario.
        if(requestSequence<appliedSequence){
          if(!light){
            setActivitiesList(prev=>prev.map(old=>{const read=(data.activities||[]).find((a:NotionCalendarActivity)=>a.pageId===old.pageId);if(!read?.checklistScanned||confirmedCalendarActivity(read,old)!==read)return old;return {...old,checklistScanned:read.checklistScanned,checklistTotal:read.checklistTotal,checklistCompleted:read.checklistCompleted,todayChecklistCompleted:read.todayChecklistCompleted,completedChecks:read.completedChecks,checklistItems:read.checklistItems};}));
            const wasBasic=basic;basic=false;enrichOffset=data.nextEnrichOffset||0;
            if(wasBasic||enrichOffset)enrichmentTimer=setTimeout(()=>void refresh(),1000);
          }
          return;
        }
        appliedSequence=requestSequence;
        setRefreshWarning('');
        setActivitiesList(prev=>{
          const merged=protectSaved(data.activities || []).map((activity:NotionCalendarActivity)=>{const old=prev.find(a=>a.pageId===activity.pageId);return !activity.checklistScanned && old?.checklistScanned?{...activity,checklistScanned:old.checklistScanned,checklistTotal:old.checklistTotal,checklistCompleted:old.checklistCompleted,todayChecklistCompleted:old.todayChecklistCompleted,completedChecks:old.completedChecks,checklistItems:old.checklistItems,reviewFlow:retainedReviewFlow(activity,old)}:activity;});
          const originals=merged.filter((a:NotionCalendarActivity)=>!a.isReviewMirror).map((a:NotionCalendarActivity)=>({...a,reviewFlow:retainedReviewFlow(a,prev.find(old=>old.pageId===a.pageId))}));const mirrors=originals.filter((a:NotionCalendarActivity)=>a.reviewFlow?.State==='pending'&&a.reviewFlow.LeaveVisualCopy!==false&&normalizePerson(a.reviewFlow.OriginalPerson)!==normalizePerson(a.person)).map((a:NotionCalendarActivity)=>({...a,pageId:'review-mirror-'+a.pageId,person:normalizePerson(a.reviewFlow!.OriginalPerson),isReviewMirror:true,title:'[COPIA REVISIÓN] '+a.title}));const combined=[...originals,...mirrors];queueMicrotask(()=>anfetaSync.broadcast({type:'CALENDAR_REFRESHED',date:currentDate,activities:combined}));return combined;
        });
        setCacheMeta(data.cacheMeta||{source:'notion',updatedAt:new Date().toISOString()});
        if(!light){const wasBasic=basic;basic=false;
          enrichOffset=data.nextEnrichOffset || 0;
          if(wasBasic||enrichOffset)enrichmentTimer=setTimeout(()=>void refresh(),1000);
        }
        const isBgSyncWarning = data.warning && /copia Supabase|copia disponible/i.test(data.warning);
        if (!isBgSyncWarning) setRefreshWarning(data.warning || '');
      } catch (e) { if (!stopped) {const message=e instanceof Error && e.name==='TimeoutError'?'Actualización demorada; se conserva el calendario y se volverá a intentar.':e instanceof Error ? e.message : 'No se pudo actualizar el calendario.';setRefreshWarning(message);} }
      finally {if(light)lightBusy=false;else busy = false;}
    };
    void refresh();
    const timer = setInterval(()=>void refresh(), 30000);
    const fastRefresh=()=>{void refresh(true);};
    const fastTimer=setInterval(fastRefresh,5000);
    window.addEventListener('anfeta_data_refreshed',fastRefresh);window.addEventListener('focus', fastRefresh); window.addEventListener('online', fastRefresh); document.addEventListener('visibilitychange', fastRefresh);
    return () => {stopped = true; controller.abort(); clearInterval(timer);clearInterval(fastTimer);if(enrichmentTimer)clearTimeout(enrichmentTimer); window.removeEventListener('anfeta_data_refreshed',fastRefresh);window.removeEventListener('focus', fastRefresh); window.removeEventListener('online', fastRefresh); document.removeEventListener('visibilitychange', fastRefresh);};
  }, [currentDate, currentUser, active]);

  useEffect(()=>{
    if(!active || (!filterCobros && !filterPagos))return;
    const controller=new AbortController();let running=false;setFinanceItems([]);setFinanceWarning('');setFinanceLoading(true);
    const load=async(force=false)=>{if(running||controller.signal.aborted)return;running=true;try{const response=await fetch('/api/data?type=calendar-finance&date='+currentDate+(force?'&fresh=1':''),{signal:controller.signal});const data=await readApiJson(response);if(!controller.signal.aborted){setFinanceItems(data.items || []);setFinanceWarning(data.warning || '');}}catch(error){if(!controller.signal.aborted)setFinanceWarning(error instanceof Error?error.message:'No se pudo cargar Cobros/Pagos.');}finally{running=false;if(!controller.signal.aborted)setFinanceLoading(false);}};
    const refresh=(event?:Event)=>{if(!document.hidden)void load(event?.type==='anfeta_finance_refresh'||event?.type==='anfeta_data_refreshed');};void load();const timer=setInterval(refresh,60000);window.addEventListener('anfeta_finance_refresh',refresh);window.addEventListener('anfeta_data_refreshed',refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);return()=>{controller.abort();clearInterval(timer);window.removeEventListener('anfeta_finance_refresh',refresh);window.removeEventListener('anfeta_data_refreshed',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};
  },[currentDate,currentUser,filterCobros,filterPagos,active]);

  const handleChangeZoom = (delta: number) => {
    setPixelsPerHour((prev) => Math.min(120, Math.max(48, prev + delta)));
  };

  const handleUpdateActivity = async (pageId: string, updates: Partial<NotionCalendarActivity> & { reviewer?: string; handoff?:boolean; reviewAction?:'return'|'reassign';note?:string;leaveVisualCopy?: boolean;titleDescription?:string;expectedTitle?:string;expectedStart?:string;expectedEnd?:string }) => {
    const original = activitiesList.find(a => a.pageId === pageId);
    if (!original || !canEditActivity(currentUser, original)) { setError('No puedes modificar esta actividad o está bloqueada.'); return false; }
    if (pending.current.has(pageId)) { setError('Espera a que termine el guardado de esta actividad.'); return false; }
    pending.current.add(pageId); mutationVersion.current++; setError('');
    const originalMirror=activitiesList.find(a=>a.pageId==='review-mirror-'+pageId);
    const restoreSchedule=()=>{if(updates.start){setActivitiesList(prev=>prev.map(a=>a.pageId===pageId?original:a));setSelectedActivity(prev=>prev?.pageId===pageId?original:prev);}};
    if(updates.start){const moving={...original,...updates};setActivitiesList(prev=>prev.map(a=>a.pageId===pageId?moving:a));setSelectedActivity(prev=>prev?.pageId===pageId?moving:prev);}
    if(updates.reviewer){
      try{const person=normalizePerson(updates.reviewer),owner=original.reviewFlow?.OriginalPerson||original.person;
        const optimistic={...original,person,status:'rtuzREVISION',title:reviewTitle(original.title,owner,person,'pending'),isCompletedForReview:true,isFinalized:false,isSuspended:false,reviewFlow:{...original.reviewFlow,OriginalPerson:owner,ReviewAssignee:person,State:'pending',LeaveVisualCopy:updates.leaveVisualCopy!==false}};
        recentSaves.current.set(pageId, { activity: optimistic, until: Date.now() + 120000 });
        setActivitiesList(prev=>{const next=prev.filter(a=>a.pageId!==pageId&&a.pageId!=='review-mirror-'+pageId);next.push(optimistic);if(updates.leaveVisualCopy!==false&&normalizePerson(owner)!==person)next.push({...optimistic,pageId:'review-mirror-'+pageId,person:normalizePerson(owner),isReviewMirror:true,title:'[COPIA REVISIÓN] '+optimistic.title});return next;});
      }catch(e){pending.current.delete(pageId);setError(e instanceof Error?e.message:'No se pudo preparar la revisión.');return false;}
    }
    try {
      const response = await offlineAwareFetch('/api/data', { action:updates.titleDescription!==undefined?'update-activity-details':updates.start ? 'update-activity-schedule' : updates.reviewer || updates.person ? 'update-activity-assignee' : 'update-activity-status', payload:{id:pageId,currentUser,expectedTitle:original.title,expectedStart:original.start,expectedEnd:original.end,expectedStatus:original.status,expectedPerson:original.person,...((updates.reviewer||updates.reviewAction||updates.handoff)?{expectedReviewUpdatedAt:original.reviewFlow?.UpdatedAt||null}:{}),...updates,...(updates.start?{expectedStart:updates.expectedStart||original.start,expectedEnd:updates.expectedEnd||original.end}:{})} });
      const data = await response.json();
      if(data.queued){restoreSchedule();setError('Cambio guardado localmente. Se confirmará al recuperar conexión; la tarjeta conserva los datos del servidor.');return false;}
      if (!response.ok || !data.success || !data.activity) throw new Error(data.error || 'Notion no confirmó el guardado.');
      const saved: NotionCalendarActivity = data.activity;
      if(updates.handoff){setVisiblePeople(prev=>prev.includes(saved.person)?prev:[...prev,saved.person]);if(Array.isArray(data.handoffCopies))for(const copy of data.handoffCopies)recentHandoffs.current.set(copy.pageId,{activity:copy,until:Date.now()+120000});}
      recentSaves.current.set(pageId,{activity:saved,until:Date.now()+60000});
      setActivitiesList(prev => {
        const next = prev.filter(a => a.pageId !== pageId && a.pageId !== 'review-mirror-' + pageId);
        next.push(saved);
        if(Array.isArray(data.handoffCopies)){for(const copy of data.handoffCopies){if(!next.some(a=>a.pageId===copy.pageId))next.push(copy);}}
        if (saved.reviewFlow?.State === 'pending' && saved.reviewFlow.LeaveVisualCopy !== false && normalizePerson(saved.reviewFlow.OriginalPerson) !== normalizePerson(saved.person)) next.push({...saved, pageId:'review-mirror-' + pageId, person:normalizePerson(saved.reviewFlow.OriginalPerson), isReviewMirror:true, title:'[COPIA REVISIÓN] ' + saved.title});
        return next;
      });
      setSelectedActivity(prev => prev?.pageId === pageId ? saved : prev);
      // Broadcast only the state confirmed by Notion.
      anfetaSync.broadcast({type:'ACTIVITY_UPDATED',pageId,updates:saved});
      const isBgWarning = data.warning && /copia Supabase|copia disponible/i.test(data.warning);
      if (!isBgWarning) setError(data.warning || '');
      window.dispatchEvent(new Event('anfeta_review_saved'));
      if(updates.start&&saved.start){const date=mexicoDate(saved.start);if(date!==currentDate)onSelectDate(date);}
      onRefresh?.();
      return true;
    } catch (error) {
      restoreSchedule();
      recentSaves.current.delete(pageId);
      if(updates.reviewer)setActivitiesList(prev=>[...prev.filter(a=>a.pageId!==pageId&&a.pageId!=='review-mirror-'+pageId),original,...(originalMirror?[originalMirror]:[])]);
      setError(error instanceof Error ? error.message : 'Error de conexión.');
      return false;
    } finally { pending.current.delete(pageId);setSaveRevision(v=>v+1); }
  };

  const startHour = 8;
  const endHour = 22;
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

  useEffect(()=>{const available=filteredActivities.filter(a=>visiblePeople.includes(normalizePerson(a.person)));setSelectedActivity(old=>(old&&available.find(a=>a.pageId===old.pageId))||available[0]||null);},[filteredActivities,visiblePeople]);
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
    stopAutoScroll();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { pageId, offsetY = 0 } = JSON.parse(dataStr);
      const activity = activitiesList.find(a => a.pageId === pageId);
      if (!activity || !canEditActivity(currentUser, activity)) {setError('No tienes permiso para mover esta actividad o está bloqueada.');return;}
      if(workflowState(activity.status,activity.title)==='completed'){setError('Esta revisión es histórica. Reactívala antes de cambiar su horario.');return;}
      const reassignment=normalizePerson(activity.person)!==colPerson;
      if(reassignment&&!isReviewer(currentUser)){setError('Solo Dirección o un revisor puede mover actividades a otra persona.');return;}

      const columnRect = e.currentTarget.getBoundingClientRect();
      // 56px es la altura del CalendarColHeader
      const y = Math.max(0, e.clientY - columnRect.top - 56 - offsetY);
      const newSchedule = scheduleAtDrop(activity, currentDate, (y / pixelsPerHour) * 60);
      const moving={...activity,...newSchedule,person:colPerson};
      const conflict=calendarConflict(activitiesList,moving);
      if(conflict){const free=nearbyFreeCalendarSlots(activitiesList,moving)[0];setError('Se empalma con «'+conflict.title+'». '+(free?'Puedes moverla a '+free.start.slice(11,16)+'–'+free.end.slice(11,16)+'.':'No hay espacio en la jornada.')+' No se movió la actividad.');return;}

      void handleUpdateActivity(pageId, {...newSchedule,...(reassignment?{person:colPerson}:{})});
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Movimiento inválido');
    }
  };

  // Red line Y position
  const currentTimeTop = currentDateMinutes !== null && currentDateMinutes >= 0 && currentDateMinutes <= totalHours * 60
    ? (currentDateMinutes / 60) * pixelsPerHour
    : null;

  const displayedPeople=peopleOrder.filter(person=>visiblePeople.includes(person));
  const financeColumns=<>{(['cobro','pago'] as const).filter(kind=>kind==='cobro'?filterCobros:filterPagos).map(kind=><CalendarFinanceColumn key={kind} kind={kind} items={financeItems.filter(item=>item.kind===kind)} warning={financeWarning} loading={financeLoading} width={columnWidth} height={canvasHeight} pixelsPerHour={pixelsPerHour} date={currentDate} order={financeSlot(financeSlots[kind],displayedPeople.length)*3+(kind==='cobro'?0:1)} slot={financeSlot(financeSlots[kind],displayedPeople.length)} people={displayedPeople} onPosition={slot=>setFinanceSlots(prev=>({...prev,[kind]:slot}))} onWidth={setColumnWidth} onRefresh={()=>window.dispatchEvent(new Event('anfeta_finance_refresh'))} onClose={()=>kind==='cobro'?setFilterCobros(false):setFilterPagos(false)} />)}</>;


  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B0F] relative" style={{'--anfeta-calendar-bg':gridTheme.background,'--anfeta-hour-line':gridTheme.lines,'--anfeta-half-line':gridTheme.lines+'88','--anfeta-quarter-line':gridTheme.lines+'33','--anfeta-hour-text':gridTheme.hours} as React.CSSProperties}>
      <UpdateNotice message={refreshWarning}/>
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
      {headerSummary&&<CalendarSummaryModal activities={activitiesList} date={currentDate} person={headerSummary.person} onClose={()=>setHeaderSummary(null)}/>}
      {selectedActivity&&canEditActivity(currentUser,selectedActivity)&&workflowState(selectedActivity.status,selectedActivity.title)==='pending'&&<div className="flex gap-2 px-3 py-1 text-xs text-cyan-200"><span>Ajustar duración de actividad seleccionada:</span>{[-15,15].map(delta=><button key={delta} disabled={pending.current.has(selectedActivity.pageId)} onClick={()=>{try{setDurationProposal(planDurationCascade(activitiesList,selectedActivity.pageId,currentUser,delta));setShowBatch(true);}catch(e){setError(e instanceof Error?e.message:'No se pudo preparar el ajuste.');}}} className="rounded border border-cyan-900 px-2 disabled:opacity-40">{delta>0?'+15 en cadena':'−15 minutos'}</button>)}</div>}
      {showBatch && <CalendarBatchModal initialChanges={durationProposal} initialPerson={batchDefaults?.person} initialDay={batchDefaults?.day} activities={activitiesList} currentUser={currentUser} date={currentDate} onClose={()=>{setShowBatch(false);setBatchDefaults(null);setDurationProposal(undefined);}} onSaved={items=>{items.forEach(activity=>{recentSaves.current.set(activity.pageId,{activity,until:Date.now()+60000});});setActivitiesList(prev=>prev.map(a=>items.find(item=>item.pageId===a.pageId)||a));items.forEach(activity=>anfetaSync.broadcast({type:'ACTIVITY_UPDATED',pageId:activity.pageId,updates:activity}));onRefresh?.();}} />}
      {showCreate && (
        <CreateActivityModal
          currentUser={currentUser}
          date={currentDate}
          initialPerson={createSlotSeed?.person}
          initialStart={createSlotSeed?.start}
          initialEnd={createSlotSeed?.end}
          onOpenTemplates={() => {
            setShowCreate(false);
            setShowTemplates(true);
          }}
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
      {preferencesLoaded===preferencesKey&&<CalendarLayoutCloud key={preferencesKey} value={{order:peopleOrder,visible:visiblePeople,width:columnWidth,height:pixelsPerHour,phase:phaseFilter,extraHours,cobros:filterCobros,pagos:filterPagos,financePosition,financeSlots,reminders:showReminders}} onRestore={raw=>{const saved=calendarLayoutPreference(raw,DEFAULT_COLLABORATORS);if(!saved)return;setPeopleOrder(saved.order as string[]);setVisiblePeople(saved.visible as string[]);setColumnWidth(saved.width);setPixelsPerHour(saved.height);setPhaseFilter(saved.phase);setExtraHours(saved.extraHours);setFilterCobros(saved.cobros);setFilterPagos(saved.pagos);setFinancePosition(saved.financePosition as 'before'|'after');setFinanceSlots(saved.financeSlots);setShowReminders(saved.reminders);}}/>}
      {cacheMeta&&<div role="status" className="shrink-0 px-3 py-1 text-[10px] text-cyan-200/80">{cacheMeta.source==='supabase'?'Copia Supabase':'Lectura de Notion'}{cacheMeta.updatedAt?' · '+new Date(cacheMeta.updatedAt).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit'}):''}{cacheMeta.syncing?' · actualizando…':''}{cacheMeta.stale&&!cacheMeta.syncing?' · actualización pendiente':''}</div>}
      <CalendarTopControls
        phaseFilter={phaseFilter}
        onPhaseFilter={setPhaseFilter}
        extraHours={extraHours}
        onExtraHours={()=>setExtraHours(prev=>!prev)}
        onOpenBatch={()=>{setBatchDefaults(null);setShowBatch(true);}}
        reviewNotifications={
          <CalendarReviewNotifications
            currentUser={currentUser}
            activities={activitiesList}
            onSelectActivity={(act) => setSelectedActivity(act)}
            onSelectDate={onSelectDate}
          />
        }
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
        calendarPalette={calendarPalette}
        onTogglePalette={handleTogglePalette}
      />

      <div className="px-3 py-1 border-b border-slate-800 text-xs"><button aria-pressed={showReminders} onClick={()=>setShowReminders(v=>!v)} className={showReminders?"text-cyan-300":"text-slate-400"}>🔔 {showReminders?"Ocultar":"Mostrar"} recordatorios del día</button></div>
      <details className="px-3 py-1 text-xs border-b border-slate-800"><summary className="cursor-pointer text-cyan-200">Diseño del calendario · fondo, líneas y horas</summary><div className="flex flex-wrap items-center gap-3 py-2">{Object.entries(calendarThemes).map(([key,value])=><button key={key} onClick={()=>setGridTheme(value)} className="rounded border border-slate-600 px-2 py-1">{key==='soft'?'Suave':key==='blue'?'Azul':'Alto contraste'}</button>)}{(['background','lines','hours'] as const).map(key=><label key={key} className="flex items-center gap-2">{key==='background'?'Fondo':key==='lines'?'Líneas':'Horas'}<input aria-label={'Color de '+key} type="color" value={gridTheme[key]} onChange={e=>setGridTheme(old=>({...old,[key]:e.target.value}))}/></label>)}</div></details>
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          onDragOver={handleContainerDragOver}
          onDragLeave={(e) => {
            if (!scrollContainerRef.current?.contains(e.relatedTarget as Node)) {
              stopAutoScroll();
            }
          }}
          className="flex-1 flex overflow-auto scrollbar-thin relative select-none"
        >
          {/* Sticky Left Time Rail */}
          <div
            className="w-16 bg-[#0F141A] border-r border-[#26323E] flex-shrink-0 sticky left-0 z-45"
            style={{ height: `${canvasHeight + 56}px`,backgroundColor:'var(--anfeta-calendar-bg)' }}
          >
            <div className="h-14 border-b-2 border-[#496278] flex items-center justify-center text-xs font-bold font-mono text-cyan-100">
              HORA
            </div>
            <div className="relative overflow-hidden" style={{ height: `${canvasHeight}px` }}>
              <CalendarHourGrid pixelsPerHour={pixelsPerHour} />
              {hoursList.map((hour, idx) => {
                const isCurrentHour = currentTimeTop !== null && currentDateMinutes !== null && Math.floor(currentDateMinutes / 60) === idx;
                return (
                  <div key={hour}>
                    <div
                      style={{ top: `${idx * pixelsPerHour}px`,transform:idx===0?'translateY(0)':idx===hoursList.length-1?'translateY(-100%)':'translateY(-50%)',color:isCurrentHour?'#38BDF8':'var(--anfeta-hour-text)',backgroundColor:'var(--anfeta-calendar-bg)' }}
                      className={`absolute w-full text-right pr-4 text-xs font-semibold font-mono select-none z-10 ${
                        isCurrentHour ? 'text-[#38BDF8] font-bold drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]' : 'text-cyan-100/90'
                      }`}
                    >
                      {hour}
                    </div>
                    {/* Tick conector de hora completa */}
                    <div
                      style={{ top: `${idx * pixelsPerHour}px` }}
                      className="absolute right-0 w-2.5 h-[2px] bg-[#496278] pointer-events-none z-10"
                    />
                    {/* Tick de media hora */}
                    {idx < hoursList.length - 1 && (
                      <div
                        style={{ top: `${idx * pixelsPerHour + pixelsPerHour / 2}px` }}
                        className="absolute right-0 w-1.5 h-px bg-[#293e52] pointer-events-none flex items-center justify-end z-10"
                      >
                        {pixelsPerHour >= 72 && (
                          <span className="text-[9px] text-cyan-400/50 font-mono pr-2 select-none -translate-y-0.5">
                            :30
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Current time red tag on time rail */}
              {currentTimeTop !== null && (
                <div
                  style={{ top: `${currentTimeTop}px` }}
                  className="absolute right-0 -translate-y-1/2 z-50 flex items-center"
                >
                  <span className="bg-[#EF4444] text-white text-[11px] font-bold px-1 rounded-l shadow-sm font-mono">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Collaborators Columns - Fluid and Auto-expanding with min width guarantee */}
          <div className="flex flex-1 relative" style={{ minWidth: Math.max(1, visiblePeople.length + Number(filterCobros) + Number(filterPagos)+Number(showReminders)) * columnWidth }}>
            {/* Global red line across all columns */}
            {currentTimeTop !== null && (
              <div
                style={{ top: `${currentTimeTop + 56}px` }}
                className="absolute left-0 right-0 h-[2px] bg-[#EF4444] z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.7)]"
              >
                <div className="w-2 h-2 rounded-full bg-[#EF4444] -translate-y-[3px] -translate-x-1" />
              </div>
            )}

            {financeColumns}
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
              displayedPeople.map((person,columnIndex) => {
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
                    style={{ order:columnIndex*3+2,height: `${canvasHeight + 56}px`, flex: `1 0 ${columnWidth}px`, width: columnWidth }}
                  >
                    <CalendarColHeader
                      personName={person}
                      onAction={action=>{if(action==='activities'||action==='progress'){setPreviewTab(action==='activities'?'activities':'checks');setSelectedPersonPreview(person);}else if(action==='summary'||action==='team')setHeaderSummary({person:action==='team'?null:person});else if(action==='left'||action==='right')movePerson(person,action==='left'?-1:1);else if(action==='first'||action==='last')setPeopleOrder(prev=>action==='first'?[person,...prev.filter(p=>p!==person)]:[...prev.filter(p=>p!==person),person]);else if(['small','normal','large','reset'].includes(action))setColumnWidth(action==='small'?180:action==='large'?360:240);else if(action==='hide')setVisiblePeople(prev=>prev.filter(p=>p!==person));else if(action==='return'){const previous=new Date(currentDate+'T12:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);setBatchDefaults({person,day:previous.toISOString().slice(0,10)});setShowBatch(true);}}}
                      activityCount={personActivities.length}
                      checklistPercent={checklistPercent}
                      totalChecklistItems={totalChecks}
                      completedChecklistItems={doneChecks}
                      coverageHours={totalCoverageHours}
                      onSelectPerson={(p) => {setPreviewTab('activities');setSelectedPersonPreview(p);}}
                    />
                    <div
                      onClick={(e) => handleColumnCanvasClick(e, person)}
                      className="relative flex-1 overflow-hidden bg-[#080B0F] cursor-pointer"
                      style={{ height: `${canvasHeight}px`,backgroundColor:'var(--anfeta-calendar-bg)' }}
                    >
                      <CalendarHourGrid pixelsPerHour={pixelsPerHour}/>
                      {positioned.map(({ activity: act, overlapIndex, overlapTotal }, idx) => (
                        <ActivityCard
                          key={act.pageId || idx}
                          activity={act}
                          isSaving={pending.current.has(act.pageId)}
                          onChecklistUpdated={(pageId,updates)=>{mutationVersion.current++;setActivitiesList(prev=>prev.map(a=>a.pageId===pageId?{...a,...updates}:a));const saved=recentSaves.current.get(pageId);if(saved)saved.activity={...saved.activity,...updates};}}
                          displayDate={currentDate}
                          currentUser={currentUser}
                          pixelsPerHour={pixelsPerHour}
                          overlapIndex={overlapIndex}
                          overlapTotal={overlapTotal}
                          palette={calendarPalette}
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
            {showReminders&&<div style={{order:999}} className="flex"><CalendarRemindersColumn date={currentDate} width={columnWidth} height={canvasHeight} pixelsPerHour={pixelsPerHour} onClose={()=>setShowReminders(false)}/></div>}
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
        <CalendarPersonPreviewPanel key={selectedPersonPreview+previewTab} initialTab={previewTab}
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
          onClose={() => {
            setShowTemplates(false);
            setCreateSlotSeed(null);
          }}
          currentDate={currentDate}
          initialPerson={createSlotSeed?.person}
          initialTime={createSlotSeed?.start || "10:00"}
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
