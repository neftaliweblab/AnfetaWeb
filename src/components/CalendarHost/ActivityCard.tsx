"use client";
import {ReassignActivityModal} from './ReassignActivityModal';
import {QuickAssigneeSelect} from './QuickAssigneeSelect';
import {titlePriority} from '@/services/activityTags';

import { calendarDisplayTitle, calendarType, calendarUrgent, calendarInterval, calendarTime, mexicoDate } from "@/services/calendarPresentation";
import {isFtfReminder} from '@/services/progressKpis';
import React, { useState, useRef, useMemo } from "react";
import {createPortal} from 'react-dom';
import {offlineAwareFetch} from '@/services/offlineQueue';
import { Eye, CheckSquare, Tag, ExternalLink, Calendar, Clock, CheckCircle2, ListTodo, Maximize2, Minimize2, ChevronDown, ChevronUp, X, Edit3 } from "lucide-react";
import { formatSmartDate } from "@/lib/dateUtils";
import { NotionCalendarActivity } from "@/types/anfeta";
import { openNotionPage } from "@/services/windowsIntegration";
import {notionPageUrl} from '@/lib/notionPageUrl';
import {ViewportMenu} from './ViewportMenu';
import {QuickScheduleActions} from './QuickScheduleModal';
import { ChecklistPopup } from "./ChecklistPopup";
import { workflowState,workflowPresentation } from "@/services/activityWorkflow";
import { canEditActivity, isActivityLocked, isDirection, isReviewer } from "@/services/activityPermissions";
import { PERSON_ALIASES, normalizePerson } from "@/services/identityNormalizer";
import { SendToReviewModal } from "./SendToReviewModal";
import { anfetaSync } from "@/lib/anfetaBroadcastSync";

interface ChecklistCardCacheEntry {
  total: number;
  completed: number;
  today: number;
  items: any[];
  completedChecks: any[];
}

const checklistMemoryCache = new Map<string, ChecklistCardCacheEntry>();
const checklistInFlight = new Map<string, Promise<ChecklistCardCacheEntry | null>>();

function cleanCardId(id: string): string {
  return (id || "").replace(/^review-mirror-/, "").replace(/[^a-zA-Z0-9]/g, "");
}

function getDesktopAreaColors(area?: string | null): { bg: string; text: string; border: string } {
  const clean = (area || "").toUpperCase().trim();
  switch (clean) {
    case "ADS":
      return { bg: "#0284C7", text: "#FFFFFF", border: "#0EA5E9" };
    case "SEO":
      return { bg: "#059669", text: "#FFFFFF", border: "#10B981" };
    case "WEB":
    case "WEBS":
      return { bg: "#7C3AED", text: "#FFFFFF", border: "#8B5CF6" };
    case "COTI":
      return { bg: "#D97706", text: "#FFFFFF", border: "#F59E0B" };
    case "MAPS":
      return { bg: "#E11D48", text: "#FFFFFF", border: "#F43F5E" };
    case "REDES":
      return { bg: "#DB2777", text: "#FFFFFF", border: "#EC4899" };
    case "APP":
      return { bg: "#4F46E5", text: "#FFFFFF", border: "#6366F1" };
    case "BIBLIA":
      return { bg: "#9333EA", text: "#FFFFFF", border: "#A855F7" };
    case "DISEÑO":
      return { bg: "#EA580C", text: "#FFFFFF", border: "#FB923C" };
    case "CONTENIDO":
      return { bg: "#0D9488", text: "#FFFFFF", border: "#14B8A6" };
    default:
      return { bg: "#1E293B", text: "#38BDF8", border: "#38BDF8/40" };
  }
}

interface ActivityCardProps {
  currentUser: string;
  displayDate?: string;
  activity: NotionCalendarActivity;
  pixelsPerHour: number;
  overlapIndex: number;
  overlapTotal: number;
  palette?: "web" | "desktop";
  isSelected?: boolean;
  isSaving?: boolean;
  onChecklistUpdated?: (pageId:string,updates:Partial<NotionCalendarActivity>)=>void;
  onSelectActivity?: (activity: NotionCalendarActivity) => void;
  onUpdateActivity?: (pageId: string, updates: Partial<NotionCalendarActivity>) => Promise<boolean | void> | void;
}

export function ActivityCard({
  activity,
  currentUser,
  displayDate,
  pixelsPerHour,
  overlapIndex,
  overlapTotal,
  palette = "web",
  isSelected,
  isSaving = false,
  onChecklistUpdated,
  onSelectActivity,
  onUpdateActivity,
}: ActivityCardProps) {
  const editable = canEditActivity(currentUser, activity);
  const [showPopup, setShowPopup] = useState(false);
  const [showHover, setShowHover] = useState(false);
  const ftfBusy = useRef(false);
  const [ftfSaving, setFtfSaving] = useState(false);
  const [ftfMessage, setFtfMessage] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showHandoff,setShowHandoff]=useState(false);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [popoverSize, setPopoverSize] = useState<"small" | "medium" | "large" | "xl">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_preview_size");
        if (saved === "small" || saved === "medium" || saved === "large" || saved === "xl") return saved as any;
      } catch {}
    }
    return "medium";
  });
  const [showAllChecks, setShowAllChecks] = useState(false);
  const [showEditDateModal, setShowEditDateModal] = useState(false);
  const [editDay, setEditDay] = useState(() => mexicoDate(activity.start || new Date()));
  const [editStart, setEditStart] = useState(() => calendarTime(activity.start || '08:00'));
  const [editEnd, setEditEnd] = useState(() => calendarTime(activity.end || '09:00'));
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [checklistData, setChecklistData] = useState<ChecklistCardCacheEntry | null>(() => {
    const key = cleanCardId(activity.pageId);
    if (checklistMemoryCache.has(key)) return checklistMemoryCache.get(key)!;
    if (activity.checklistScanned || (activity.checklistTotal ?? 0) > 0 || (activity.checklistItems && activity.checklistItems.length > 0)) {
      const entry: ChecklistCardCacheEntry = {
        total: activity.checklistTotal ?? 0,
        completed: activity.checklistCompleted ?? 0,
        today: activity.todayChecklistCompleted ?? 0,
        items: activity.checklistItems || activity.completedChecks || [],
        completedChecks: activity.completedChecks || [],
      };
      checklistMemoryCache.set(key, entry);
      return entry;
    }
    return null;
  });

  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const checkBusy=useRef(false),[checkSaving,setCheckSaving]=useState(false),[checkMessage,setCheckMessage]=useState('');

  React.useEffect(() => {
    if(checkBusy.current)return;
    const key = cleanCardId(activity.pageId);
    if (activity.checklistScanned && activity.checklistItems) {
      const entry={total:activity.checklistTotal??0,completed:activity.checklistCompleted??0,today:activity.todayChecklistCompleted??0,items:activity.checklistItems,completedChecks:activity.completedChecks||[]};
      checklistMemoryCache.set(key,entry);setChecklistData(entry);
    } else if (checklistMemoryCache.has(key)) {
      setChecklistData(checklistMemoryCache.get(key)!);
    } else if (activity.checklistScanned || (activity.checklistTotal ?? 0) > 0 || (activity.checklistItems && activity.checklistItems.length > 0)) {
      const entry: ChecklistCardCacheEntry = {
        total: activity.checklistTotal ?? 0,
        completed: activity.checklistCompleted ?? 0,
        today: activity.todayChecklistCompleted ?? 0,
        items: activity.checklistItems || activity.completedChecks || [],
        completedChecks: activity.completedChecks || [],
      };
      checklistMemoryCache.set(key, entry);
      setChecklistData(entry);
    }
  }, [activity.pageId, activity.checklistScanned, activity.checklistTotal, activity.checklistCompleted, activity.todayChecklistCompleted, activity.checklistItems, activity.completedChecks]);

  const fetchChecklistIfNeeded = React.useCallback(async () => {
    if(activity.isHandoffMirror||checkBusy.current)return;
    const rawId = activity.isReviewMirror ? activity.pageId.replace(/^review-mirror-/, "") : activity.pageId;
    if (!rawId || rawId.startsWith("act-")) return;
    const key = cleanCardId(rawId);

    if (checklistMemoryCache.has(key)) {
      setChecklistData(checklistMemoryCache.get(key)!);
      return;
    }

    if (activity.checklistScanned && ((activity.checklistTotal ?? 0) > 0 || activity.checklistItems?.length)) {
      const entry: ChecklistCardCacheEntry = {
        total: activity.checklistTotal ?? 0,
        completed: activity.checklistCompleted ?? 0,
        today: activity.todayChecklistCompleted ?? 0,
        items: activity.checklistItems || activity.completedChecks || [],
        completedChecks: activity.completedChecks || [],
      };
      checklistMemoryCache.set(key, entry);
      setChecklistData(entry);
      return;
    }

    let promise = checklistInFlight.get(key);
    if (!promise) {
      setLoadingChecklist(true);
      promise = (async (): Promise<ChecklistCardCacheEntry | null> => {
        try {
          const res = await fetch("/api/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get-checklist", payload: { pageId: rawId } }),
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.items)) {
            const items = data.items;
            const total = items.length;
            const completed = items.filter((i: any) => i.isChecked).length;
            const todayStr = mexicoDate(activity.start || new Date());
            const completedChecks = items.filter((item: any) => item.isChecked && (item.markingSource === "verified" ? item.markedAt && mexicoDate(item.markedAt) === todayStr : item.markingSource === "estimated" && item.editedAt && mexicoDate(item.editedAt) === todayStr));
            const activeCompleted = completedChecks.length > 0 ? completedChecks : items.filter((item: any) => item.isChecked);
            const today = completedChecks.length > 0 ? completedChecks.length : completed;
            const entry: ChecklistCardCacheEntry = {
              total,
              completed,
              today,
              items,
              completedChecks: activeCompleted,
            };
            checklistMemoryCache.set(key, entry);
            anfetaSync.broadcast({
              type: "ACTIVITY_UPDATED",
              pageId: activity.pageId,
              updates: {
                checklistScanned: true,
                checklistTotal: total,
                checklistCompleted: completed,
                todayChecklistCompleted: today,
                checklistItems: items,
                completedChecks: activeCompleted,
              },
            });
            return entry;
          }
          return null;
        } catch {
          return null;
        } finally {
          checklistInFlight.delete(key);
        }
      })();
      checklistInFlight.set(key, promise);
    }

    try {
      const result = await promise;
      if (result) {
        setChecklistData(result);
      }
    } finally {
      setLoadingChecklist(false);
    }
  }, [activity.isReviewMirror, activity.pageId, activity.checklistScanned, activity.checklistTotal, activity.checklistItems, activity.completedChecks, activity.todayChecklistCompleted, activity.start]);

  // Safe titles & metadata
  const title = activity?.title || (activity as any)?.Title || "";
  const shortTitle = activity?.shortTitle || (activity as any)?.ShortTitle || title;
  const status = activity?.status || (activity as any)?.Status || "";
  const domain = activity?.domain || (activity as any)?.ParsedDomain || "DOMINIO";

  // Limpiar título de tecnicismos redundantes como prtuzREVISION, nneft, jjohn, fechas [10OCT], etc.
  const cleanTitle = calendarDisplayTitle(title, domain);
  const typeLabel = calendarType(title, activity.project);
  const startStr = activity.start || '';
  const endStr = activity.end || '';
  const interval = calendarInterval(startStr, endStr, displayDate);
  const startMinute = interval.start;
  const endMinute = interval.end;
  const startH = Math.floor(startMinute / 60), startM = startMinute % 60;
  const endH = Math.floor(endMinute / 60), endM = endMinute % 60;
  const durationMinutes = Math.max(15, endMinute - startMinute);
  const durationHours = durationMinutes / 60;
  const hours = Math.floor(durationHours);
  const minutes = durationMinutes % 60;
  const durationFormatted = hours > 0 ? (minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`) : `${minutes}m`;

  const top = Math.max(0, ((startMinute - 8 * 60) / 60) * pixelsPerHour);
  const height = Math.max(8, (durationMinutes / 60) * pixelsPerHour);

  // Workflow, Letra Insignia y Estilos sobrios con colores balanceados (sin saturación chillona)
  const isUrgent = !!(activity?.isUrgent || calendarUrgent(title));
  const wf = workflowState(status, title);
  const isCompleted = wf === "completed";
  const isReview = wf === "review";
  const isSuspended = wf === "suspended";

  // Badges y colores más tenues, profesionales y oscuros (WPF Parity)
  let badgeLetter = "P";
  let badgeBg = "#261A10";
  let badgeBorder = "#B45309";
  let badgeText = "#FDE68A";
  let cardBorder = "border-[#382818]";
  let cardBg = "bg-[#161516]";

  let phaseLabel = "POR HACER";
  let phaseColor = "#2E1909";
  let phaseTextColor = "#FDBA74";

  if (isUrgent) {
    badgeLetter = "!";
    badgeBg = "#300D15";
    badgeBorder = "#E11D48";
    badgeText = "#FDA4AF";
    cardBorder = "border-[#9F1239]/70 shadow-[0_0_10px_rgba(225,29,72,0.18)]";
    cardBg = "bg-[#181114]";
    phaseLabel = "00 URGENTE";
    phaseColor = "#300D15";
    phaseTextColor = "#FDA4AF";
  } else if (isCompleted) {
    badgeLetter = "T";
    badgeBg = "#062E22";
    badgeBorder = "#059669";
    badgeText = "#6EE7B7";
    cardBorder = "border-[#065F46]/70";
    cardBg = "bg-[#111815]";
    phaseLabel = "TERMINADA";
    phaseColor = "#062E22";
    phaseTextColor = "#6EE7B7";
  } else if (isReview) {
    badgeLetter = "R";
    badgeBg = "#0C2E46";
    badgeBorder = "#0284C7";
    badgeText = "#7DD3FC";
    cardBorder = "border-[#075985]/70";
    cardBg = "bg-[#101720]";
    phaseLabel = "EN REVISIÓN";
    phaseColor = "#0C2E46";
    phaseTextColor = "#7DD3FC";
  } else if (isSuspended) {
    badgeLetter = "S";
    badgeBg = "#240E3E";
    badgeBorder = "#9333EA";
    badgeText = "#D8B4FE";
    cardBorder = "border-[#6B21A8]/70";
    cardBg = "bg-[#15121E]";
    phaseLabel = "SUSPENDIDA";
    phaseColor = "#240E3E";
    phaseTextColor = "#D8B4FE";
  } else {
    // Pendiente
    badgeLetter = "P";
    badgeBg = "#261A10";
    badgeBorder = "#B45309";
    badgeText = "#FDE68A";
    cardBorder = "border-[#3D2614]/80";
    cardBg = "bg-[#171514]";
    phaseLabel = "POR HACER";
    phaseColor = "#261A10";
    phaseTextColor = "#FDE68A";
  }

  const phaseInfo=workflowPresentation(status,title);
  if(phaseInfo.stage&&!phaseInfo.inconsistent&&!isUrgent)phaseLabel=phaseInfo.label.toUpperCase();

  // Desktop palette customization (ANFETA Desktop parity)
  let priorityBorderColor = "#64748B";
  if (isUrgent || calendarUrgent(activity.title)) {
    priorityBorderColor = "#F87171";
  } else if (titlePriority(activity.title,activity.person)==='11') {
    priorityBorderColor = "#FBBF24";
  } else if (titlePriority(activity.title,activity.person)==='22') {
    priorityBorderColor = "#60A5FA";
  } else if (isCompleted) {
    priorityBorderColor = "#10B981";
  } else if (isReview) {
    priorityBorderColor = "#38BDF8";
  } else if (isSuspended) {
    priorityBorderColor = "#C084FC";
  } else {
    priorityBorderColor = "#EAB308";
  }

  let desktopCardBg = "bg-[#1E232B]";
  let desktopCardBorder = "border-[#333C4A]";
  if (isUrgent) {
    desktopCardBg = "bg-[#28181D]";
    desktopCardBorder = "border-[#522935]";
  } else if (isCompleted) {
    desktopCardBg = "bg-[#1D2B24]";
    desktopCardBorder = "border-[#2B4438]";
  } else if (isReview) {
    desktopCardBg = "bg-[#182535]";
    desktopCardBorder = "border-[#253D58]";
  } else if (isSuspended) {
    desktopCardBg = "bg-[#231A2D]";
    desktopCardBorder = "border-[#3E2C52]";
  }

  if (palette === "desktop") {
    if (isUrgent) {
      badgeBg = "#4C1D24";
      badgeBorder = "#F87171";
      badgeText = "#FECDD3";
      phaseLabel = "00 URGENTE";
      phaseColor = "#4C1D24";
      phaseTextColor = "#FECDD3";
    } else if (isCompleted) {
      badgeBg = "#14382A";
      badgeBorder = "#10B981";
      badgeText = "#A7F3D0";
      phaseLabel = "TERMINADA";
      phaseColor = "#14382A";
      phaseTextColor = "#A7F3D0";
    } else if (isReview) {
      badgeBg = "#12304A";
      badgeBorder = "#38BDF8";
      badgeText = "#BAE6FD";
      phaseLabel = "EN REVISIÓN";
      phaseColor = "#12304A";
      phaseTextColor = "#BAE6FD";
    } else if (isSuspended) {
      badgeBg = "#301B42";
      badgeBorder = "#C084FC";
      badgeText = "#E9D5FF";
      phaseLabel = "SUSPENDIDA";
      phaseColor = "#301B42";
      phaseTextColor = "#E9D5FF";
    } else {
      badgeBg = "#382914";
      badgeBorder = "#F59E0B";
      badgeText = "#FDE68A";
      phaseLabel = "POR HACER";
      phaseColor = "#382914";
      phaseTextColor = "#FDE68A";
    }
  }

  const desktopArea = getDesktopAreaColors(typeLabel);

  const widthPct = 100 / Math.max(1, overlapTotal);
  const leftPct = overlapIndex * widthPct;

  const effectiveTotal = checklistData ? checklistData.total : (activity.checklistTotal ?? 0);
  const effectiveCompleted = checklistData ? checklistData.completed : (activity.checklistCompleted ?? 0);
  const effectiveToday = checklistData ? checklistData.today : (activity.todayChecklistCompleted ?? 0);
  const effectiveItems = checklistData ? checklistData.items : (activity.checklistItems || activity.completedChecks || []);
  async function toggleCardCheck(chk:any){
    if(!editable||isSaving||checkBusy.current||!(chk.blockId||chk.id))return;
    checkBusy.current=true;setCheckSaving(true);setCheckMessage('');
    const previous=checklistData,items=effectiveItems.map((i:any)=>(i.id||i.blockId)===(chk.id||chk.blockId)?{...i,isChecked:!chk.isChecked}:i);
    const optimistic={total:effectiveTotal,completed:Math.max(0,effectiveCompleted+(chk.isChecked?-1:1)),today:effectiveToday,items,completedChecks:previous?.completedChecks||[]};
    setChecklistData(optimistic);
    try{const response=await offlineAwareFetch('/api/data',{action:'toggle-checklist',payload:{pageId:activity.pageId,blockId:chk.blockId||chk.id,checked:!chk.isChecked,expectedChecked:!!chk.isChecked,currentUser}});const data=await response.json();
      if(data.queued){setChecklistData(previous);setCheckMessage('Pendiente local; se confirmará al recuperar conexión.');return;}
      if(!response.ok||!data.success||data.checked!==!chk.isChecked)throw Error(data.error||'Notion no confirmó el check.');
      const confirmed={...optimistic,items:data.stats?.checklistItems||items,total:data.stats?.checklistTotal??optimistic.total,completed:data.stats?.checklistCompleted??optimistic.completed,today:data.stats?.todayChecklistCompleted??effectiveToday,completedChecks:data.stats?.completedChecks||optimistic.completedChecks};
      checklistMemoryCache.set(cleanCardId(activity.pageId),confirmed);setChecklistData(confirmed);
      const updates={checklistScanned:true,checklistTotal:confirmed.total,checklistCompleted:confirmed.completed,checklistItems:confirmed.items,todayChecklistCompleted:confirmed.today,completedChecks:confirmed.completedChecks};onChecklistUpdated?.(activity.pageId,updates);anfetaSync.broadcast({type:'ACTIVITY_UPDATED',confirmed:true,pageId:activity.pageId,updates});setCheckMessage(data.warning||'Check guardado en Notion.');
    }catch(e){setChecklistData(previous);setCheckMessage(e instanceof Error?e.message:'No se pudo guardar.');}finally{checkBusy.current=false;setCheckSaving(false);}
  }
  const isScanned = !!(activity.checklistScanned || checklistData);
  const totalChecklist = effectiveTotal;
  const completedChecklist = effectiveCompleted;
  const pct = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  // Hover handlers con protección mejorada de zoom y colisiones en pantalla
  const handleMouseEnter = () => {
    void fetchChecklistIfNeeded();
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const expectedWidth = popoverSize === "small" ? 360 : popoverSize === "large" ? 640 : popoverSize === "xl" ? 820 : 480;
        const fitsRight = rect.right + 14 + expectedWidth <= window.innerWidth;
        const left = fitsRight
          ? Math.min(window.innerWidth - expectedWidth - 14, rect.right + 12)
          : Math.max(12, rect.left - expectedWidth - 12);
        const top = Math.min(Math.max(12, window.innerHeight - 560), Math.max(12, rect.top - 20));
        setHoverPos({ x: Math.max(12, left), y: Math.max(12, top) });
        setShowHover(true);
      }
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setShowHover(false);
    }, 280);
  };

  const handlePopoverMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  const handlePopoverMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setShowHover(false);
    }, 200);
  };

  // Context Menu Handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  React.useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  if (interval.end <= interval.start) return null;

  return (
    <>
      <div
        ref={cardRef}
        draggable={editable && !isSaving && !/(?<![\p{L}\p{Nd}_])zREVISION(?![\p{L}\p{Nd}_])/iu.test(activity.status+' '+activity.title)}
        aria-busy={isSaving}
        title={isSaving?'Guardando movimiento en Notion…':undefined}
        onDragStart={(e) => {
          if (!editable) {
            e.preventDefault();
            return;
          }
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          setShowHover(false);
          e.dataTransfer.setData(
            "text/plain",
            JSON.stringify({
              pageId: activity.pageId,
              person: activity.person,
              durationHours,
              offsetY: e.clientY - e.currentTarget.getBoundingClientRect().top,
            })
          );
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectActivity?.(activity);
        }}
        onDoubleClick={e=>{if((e.target as Element).closest('button,input,select,textarea,a'))return;openNotionPage(notionPageUrl(activity));}}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        data-activity-card="true"
        data-activity-id={activity.pageId}
        style={{
          top: `${top + 2}px`,
          height: `${height - 4}px`,
          padding: height < 34 ? '1px' : undefined,
          width: `calc(${widthPct}% - 4px)`,
          left: `calc(${leftPct}% + 2px)`,
          ...(palette === "desktop" ? { borderLeftWidth: "4px", borderLeftColor: priorityBorderColor } : {}),
        }}
        className={`absolute rounded-md border p-2 flex flex-col justify-between ${
          editable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        } transition-all select-none overflow-hidden ${
          palette === "desktop" ? `${desktopCardBg} ${desktopCardBorder}` : `${cardBg} ${cardBorder}`
        } ${
          isSelected
            ? "ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.4)] z-30"
            : "hover:z-20 hover:border-slate-500 shadow-sm"
        }`}
      >
        {activity.ftfVerified&&!activity.isReviewMirror&&<span role="img" aria-label="Pasos FTF verificados para hoy" className="pointer-events-none absolute right-0 top-1/2 h-2/3 min-h-3 w-1.5 -translate-y-1/2 rounded-l-full bg-emerald-400 shadow-[-3px_0_12px_rgba(52,211,153,0.7)]"/>}
        {/* Fila Superior: Badge P/R/T/S + Dominio + Overlap + Checklist Pill */}
        {isSaving&&<span role="status" className="text-[10px] text-cyan-200 animate-pulse">Guardando en Notion…</span>}
        <div className="flex items-center justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            {/* Badge circular con inicial oficial (P, R, T, S) */}
            <span
              style={{ backgroundColor: badgeBg, borderColor: badgeBorder, color: badgeText }}
              className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-black font-mono shadow-sm"
              title={isCompleted ? "Terminada" : isReview ? "En Revisión" : isSuspended ? "Suspendida" : "Pendiente"}
            >
              {badgeLetter}
            </span>

            {/* Badge de tipo de actividad (ADS, WEBS, SEO, MAPS, etc.) */}
            {typeLabel && (
              <span
                style={
                  palette === "desktop"
                    ? { backgroundColor: desktopArea.bg, color: desktopArea.text, borderColor: desktopArea.border }
                    : undefined
                }
                className={`shrink-0 px-1 py-0.2 rounded text-[8.5px] font-bold font-mono tracking-wider border ${
                  palette === "desktop" ? "" : "bg-[#1E293B] border-[#38BDF8]/40 text-[#38BDF8]"
                }`}
              >
                {typeLabel}
              </span>
            )}

            {/* Dominio en azul claro */}
            <span className="font-mono text-[11px] font-semibold text-[#38BDF8] truncate tracking-tight">
              {isActivityLocked(activity) && <span aria-label="Bloqueada" className="text-[10px]">🔒 </span>}
              {domain}
            </span>

            {/* Indicador de colisión de horario */}
            {overlapTotal > 1 && (
              <span
                className="shrink-0 px-1 py-0.2 rounded text-[8px] font-bold bg-[#211C2D] border border-[#65547A] text-[#C4B5D5]"
                title={`Empalme: ${overlapIndex + 1} de ${overlapTotal}`}
              >
                {overlapIndex + 1}/{overlapTotal}
              </span>
            )}
          </div>

          {/* Pastilla verde de checklist estilo WPF original: [0/0] */}
          {totalChecklist > 0 ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setShowPopup(!showPopup);
              }}
              className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#16291F] border border-[#42654E] text-[#A0BEAA] hover:bg-[#20362A] transition-colors cursor-pointer"
              title={`Checklist: ${completedChecklist} de ${totalChecklist} completadas`}
            >
              {completedChecklist}/{totalChecklist}
            </span>
          ) : loadingChecklist ? (
            <span className="p-0.5 text-cyan-400 shrink-0 opacity-80 animate-pulse" title="Cargando checklist...">
              <Clock className="w-3 h-3 animate-spin" />
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void fetchChecklistIfNeeded();
                setShowPopup(!showPopup);
              }}
              className="p-0.5 text-slate-500 hover:text-[#38BDF8] shrink-0 opacity-40 hover:opacity-100 transition-opacity"
              title="Ver checklist"
            >
              <Eye className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Título de la actividad limpio y legible */}
        <div className="my-auto py-0.5 min-w-0">
          <h5 className="text-[11px] font-medium text-[#E2E8F0] line-clamp-2 leading-[13px] break-words">
            {activity.isReviewMirror && <span className="mr-1 rounded border border-cyan-800 bg-cyan-950/50 px-1 text-[9px] font-semibold text-cyan-200" title="Copia visual de seguimiento. La actividad original está con otro responsable; esta copia no se puede mover ni editar.">{activity.isHandoffMirror?'TRANSFERIDA':'COPIA REVISIÓN'}</span>}
            {isFtfReminder(activity)&&<span className="mr-1 rounded border border-cyan-800 px-1 text-[9px] text-cyan-200" title="Recordatorio FTF: visible, sin sumar actividades ni carga de trabajo">FTF · Recordatorio</span>}
            <span className={wf==='completed'?'text-slate-400 line-through decoration-slate-400/60 decoration-1 opacity-75':''}>{cleanTitle}</span>
          </h5>
        </div>

        {/* Fila Inferior: Horario + Duración (ej: 09:00 - 10:00 · 1H) */}
        <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400 pt-0.5 border-t border-[#26262B]/50">
          <span className="truncate">
            {calendarTime(startStr)}
            {endStr ? ` – ${calendarTime(endStr)}` : ""}
            <span className="text-slate-500 ml-1">· {durationFormatted.toUpperCase()}</span>
          </span>
          {isUrgent && <span className="text-[#FB7185] font-black text-[9px] tracking-wide">00 URGENTE</span>}
        </div>
      </div>

      {/* Hover Preview Popover */}
      {showHover && hoverPos && !isSelected && (
        <div
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          onClick={(event) => event.stopPropagation()}
          data-activity-card="true"
          style={{ top: `${hoverPos.y}px`, left: `${hoverPos.x}px` }}
          className={`fixed z-[100] rounded-xl border border-[#2B3B4E] bg-[#0E1520]/95 backdrop-blur-md p-4 shadow-2xl text-xs text-[#E2E8F0] space-y-2.5 pointer-events-auto transition-all duration-150 animate-in fade-in zoom-in-95 max-h-[88vh] overflow-y-auto scrollbar-thin ${
            popoverSize === "small"
              ? "w-80 max-w-[92vw]"
              : popoverSize === "large"
              ? "w-[560px] max-w-[95vw]"
              : popoverSize === "xl"
              ? "w-[760px] max-w-[96vw]"
              : "w-[440px] max-w-[94vw]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-[#223246] pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="rounded px-2 py-0.5 text-[9.5px] font-bold uppercase truncate"
                style={{ backgroundColor: phaseColor, color: phaseTextColor }}
              >
                {phaseLabel}
              </span>
              <span className="font-mono font-bold text-[11px] text-[#38BDF8] truncate">
                {domain}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Selector de tamaño S/M/L/XL */}
              <div className="flex items-center rounded border border-[#253549] bg-[#111822] p-0.5 text-[9.5px] font-mono">
                {(["small", "medium", "large", "xl"] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopoverSize(sz);
                      try { localStorage.setItem("anfeta_preview_size", sz); } catch {}
                    }}
                    title={`Tamaño ${sz === "small" ? "Compacto" : sz === "large" ? "Amplio" : sz === "xl" ? "Extra Grande" : "Normal"}`}
                    className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                      popoverSize === sz
                        ? "bg-[#0C4A6E] text-[#38BDF8] font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {sz === "small" ? "S" : sz === "large" ? "L" : sz === "xl" ? "XL" : "M"}
                  </button>
                ))}
              </div>

              {!editable && (
                <span title="Actividad bloqueada" className="text-amber-400 text-xs">
                  🔒
                </span>
              )}
              {overlapTotal > 1 && (
                <span className="rounded px-1.5 py-0.2 text-[8.5px] font-bold bg-[#3B0764] border border-[#C084FC] text-[#E9D5FF]">
                  Empalme {overlapIndex + 1}/{overlapTotal}
                </span>
              )}
            </div>
          </div>

          {/* Full Title */}
          <h4 className="font-semibold text-slate-100 text-xs leading-snug break-words">
            {title}
          </h4>

          {/* Metadata Base */}
          <div className="rounded-lg bg-[#141E2B] p-2.5 space-y-1.5 text-[11px] border border-[#1E2E40]">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Responsable:</span>
              <QuickAssigneeSelect activity={activity} currentUser={currentUser} onConfirm={updates=>onUpdateActivity?.(activity.pageId,updates)}/>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Horario programado:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-cyan-300 font-semibold">
                  {calendarTime(startStr)}
                  {endStr ? ` – ${calendarTime(endStr)}` : ""} ({durationFormatted})
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHover(false);
                      setShowEditDateModal(true);
                    }}
                    className="p-1 rounded hover:bg-[#1E2E42] text-cyan-400 hover:text-cyan-200 transition-colors cursor-pointer"
                    title="Editar fecha y hora"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <label className={`flex items-start gap-2 rounded-lg border p-2.5 ${activity.ftfVerified ? 'border-emerald-500/70 bg-emerald-950/40' : 'border-slate-700 bg-slate-900/40'}`}>
              <input
                type="checkbox"
                aria-label="Pasos FTF verificados para hoy"
                checked={!!activity.ftfVerified}
                disabled={!editable || !activity.ftfAvailable || isSaving || ftfSaving || !onUpdateActivity}
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400"
                onChange={async event => {
                  if (ftfBusy.current || !onUpdateActivity) return;
                  const checked = event.target.checked;
                  ftfBusy.current = true;
                  setFtfSaving(true);
                  setFtfMessage('');
                  try {
                    const saved = await onUpdateActivity(activity.pageId, {
                      ftfVerified: checked,
                      expectedFtfVerified: !!activity.ftfVerified,
                    });
                    setFtfMessage(saved === false
                      ? 'No se confirmó la verificación FTF. Revisa el aviso del calendario.'
                      : checked ? 'Pasos verificados: la actividad ya está entendida.' : 'Se retiró la verificación FTF.');
                  } catch (error) {
                    setFtfMessage(error instanceof Error ? error.message : 'No se pudo guardar la verificación FTF.');
                  } finally {
                    ftfBusy.current = false;
                    setFtfSaving(false);
                  }
                }}
              />
              <span>
                <span className={`block font-semibold ${activity.ftfVerified ? 'text-emerald-300' : 'text-slate-200'}`}>
                  {ftfSaving ? 'Guardando…' : 'Pasos revisados y actividad entendida'}
                </span>
                <span className="mt-1 block text-[10px] leading-relaxed text-slate-400">
                  {activity.ftfAvailable ? 'Activa la franja verde de verificación FTF.' : 'No se encontró la casilla “Check FTF Pasos Verificados Hoy” en esta página.'}
                </span>
              </span>
            </label>
            {ftfMessage && <p role="status" className="text-[11px] text-cyan-200">{ftfMessage}</p>}

            {/* Resumen de Checks e Historial Hoy (Anfeta Original Parity) */}
            {loadingChecklist && (
              <div className="pt-2 border-t border-[#1E2E40] py-2 flex items-center gap-2 text-[10.5px] text-cyan-300 font-mono animate-pulse">
                <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                <span>Cargando checks de la actividad...</span>
              </div>
            )}

            {!loadingChecklist && isScanned && totalChecklist === 0 && (
              <div className="pt-2 border-t border-[#1E2E40] py-1.5 flex items-center gap-1.5 text-[10.5px] text-slate-400 font-mono">
                <CheckSquare className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Sin tareas checklist en esta actividad</span>
              </div>
            )}

            {totalChecklist > 0 && (
              <div className="pt-2 border-t border-[#1E2E40] space-y-1.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-slate-300 flex items-center gap-1 font-semibold">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    Checks de la actividad:
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-emerald-400 font-bold">
                      {completedChecklist} / {totalChecklist} ({pct}%)
                    </span>
                    {effectiveToday > 0 && (
                      <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                        +{effectiveToday} hoy
                      </span>
                    )}
                  </div>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0D1520]">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Desglose rápido de Checks con fecha de agregado y completado */}
                {checkMessage&&<p role="status" className="text-xs text-amber-200">{checkMessage}</p>}
                {effectiveItems.length > 0 && (
                  <div className={`mt-2 pt-1.5 border-t border-[#1E2E40]/60 space-y-1 overflow-y-auto pr-0.5 scrollbar-thin ${
                    showAllChecks || popoverSize === "xl" ? "max-h-72" : "max-h-40"
                  }`}>
                    {effectiveItems.slice(0, showAllChecks || popoverSize === "xl" ? undefined : 6).map((chk: any, idx: number) => {
                      const isDone = Boolean(chk.isChecked);
                      const addedDate = chk.createdAt ? formatSmartDate(chk.createdAt) : null;
                      const doneDate = chk.markedAt || chk.editedAt ? formatSmartDate(chk.markedAt || chk.editedAt) : null;

                      return (
                        <div
                          key={chk.id || chk.blockId || idx}
                          className="flex items-start justify-between gap-2 p-1.5 rounded bg-[#0D1520]/70 border border-[#1E2A38]/60 text-[10.5px]"
                        >
                          <div className="flex items-start gap-1.5 min-w-0 flex-1">
                            <input type="checkbox" aria-label={'Completar '+(chk.text||'tarea')} checked={isDone} disabled={!editable||isSaving||checkSaving} onChange={()=>void toggleCardCheck(chk)} className="mt-0.5 shrink-0 accent-emerald-400"/>
                            <span className={`leading-tight ${isDone ? "text-slate-300 line-through opacity-80" : "text-slate-100"}`}>
                              {chk.text || "Tarea sin título"}
                            </span>
                          </div>

                          <div className="shrink-0 text-right font-mono text-[9px] pl-2">
                            {isDone && doneDate ? (
                              <span className="text-emerald-400 block font-medium" title={`Completado: ${doneDate}`}>
                                ✓ {doneDate}
                              </span>
                            ) : addedDate ? (
                              <span className="text-slate-400 block" title={`Agregado: ${addedDate}`}>
                                + {addedDate}
                              </span>
                            ) : (
                              <span className="text-slate-500 block">
                                {isDone ? "Completado" : "Pendiente"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {totalChecklist > 6 && (
                      <div className="pt-1.5 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllChecks(prev => !prev);
                          }}
                          className="w-full py-1 px-2 text-[10px] text-cyan-300 hover:text-cyan-100 bg-[#122132]/80 hover:bg-[#182C42] border border-[#234360] rounded flex items-center justify-center gap-1 font-mono transition-colors cursor-pointer"
                        >
                          {showAllChecks ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              <span>Mostrar menos</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              <span>Ver las {totalChecklist - 6} tareas restantes (desglosar todas)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Tips */}
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowHover(false);
                setShowPopup(true);
              }}
              className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>💡 Clic para abrir ventana modal fija</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openNotionPage(notionPageUrl(activity));
              }}
              className="text-sky-400 hover:underline font-medium cursor-pointer"
            >
              ↗ Abrir en Notion
            </button>
          </div>
        </div>
      )}

      {showPopup && createPortal(
        <div
          className="fixed inset-0 z-[350] bg-black/60 flex items-center justify-center p-4"
        >
          <ChecklistPopup
            activity={{
              ...activity,
              checklistScanned: true,
              checklistTotal: totalChecklist,
              checklistCompleted: completedChecklist,
              todayChecklistCompleted: effectiveToday,
              checklistItems: effectiveItems,
              completedChecks: checklistData?.completedChecks || activity.completedChecks || [],
            }}
            onClose={() => setShowPopup(false)}
            onToggle={toggleCardCheck}
            disabled={!editable||isSaving||checkSaving}
            message={checkMessage}
          />
        </div>
      ,document.body)}

      {/* Right Click Context Menu */}
      {contextMenu && (
        <ViewportMenu position={contextMenu}>
          <div className="px-3 py-1 text-[10px] font-mono text-[#64748B] border-b border-[#1E2836]">
            ACCIONES DE ACTIVIDAD
          </div>
          <button disabled={!editable||isCompleted||(!isDirection(currentUser)&&normalizePerson(currentUser)!==normalizePerson(activity.person))||activity.reviewFlow?.State==='pending'} onClick={()=>{closeContextMenu();setShowHandoff(true);}} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-cyan-200 hover:bg-slate-800 disabled:opacity-40"><Tag className="h-3.5 w-3.5"/><span>Reasignar actividad…</span></button>
          <button
            disabled={!editable||isCompleted}
            onClick={() => {
              closeContextMenu();
              setShowReviewModal(true);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#38BDF8] flex items-center gap-2"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Enviar a revisión final…</span>
          </button>
          <button
            disabled={!editable || (activity.reviewFlow?.State==='pending'?normalizePerson(currentUser)!==normalizePerson(activity.reviewFlow.ReviewAssignee):!isReviewer(currentUser))}
            onClick={() => {
              onUpdateActivity?.(activity.pageId, {
                status: "zREVISION",
                isFinalized: true,
              });
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#4ADE80] flex items-center gap-2"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Finalizar actividad</span>
          </button>
          {editable && (
            <button
              disabled={isCompleted||isSaving}
              onClick={() => {
                closeContextMenu();
                setEditDay(mexicoDate(activity.start || new Date()));
                setEditStart(calendarTime(activity.start || '08:00'));
                setEditEnd(calendarTime(activity.end || '09:00'));
                setEditError('');
                setShowEditDateModal(true);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#FDE047] flex items-center gap-2"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Editar fecha y horario...</span>
            </button>
          )}
          {editable&&!isCompleted&&<QuickScheduleActions activity={activity} currentUser={currentUser} disabled={isSaving} onClose={closeContextMenu} onSave={updates=>onUpdateActivity?.(activity.pageId,updates)}/>}
          <button
            onClick={() => {
              openNotionPage(notionPageUrl(activity));
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#94A3B8] flex items-center gap-2 border-t border-[#1E2836] mt-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir en Notion (según preferencia)</span>
          </button>
        </ViewportMenu>
      )}

      {/* Modal de selección de integrante para revisión */}
      {showHandoff&&<ReassignActivityModal activity={activity} onClose={()=>setShowHandoff(false)} onConfirm={async updates=>await onUpdateActivity?.(activity.pageId,updates)}/>}
      {showReviewModal && (
        <SendToReviewModal
          activity={activity}
          currentUser={currentUser}
          onClose={() => setShowReviewModal(false)}
          onConfirm={async (targetReviewer, leaveVisualCopy) => {
            const saved = await onUpdateActivity?.(activity.pageId, {
              status: "rtuzREVISION",
              reviewer: targetReviewer,
              leaveVisualCopy,
            } as any);
            if (saved === false) return false;
            setShowReviewModal(false);
          }}
        />
      )}

      {/* Modal interactivo: Editar fecha y hora */}
      {showEditDateModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-[#1E2E40] bg-[#0A0E15] text-[#CBD5E1] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E2836] bg-[#0E1520]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Editar Fecha y Hora</h3>
                  <p className="text-[10.5px] text-[#64748B] truncate max-w-[260px]">{cleanTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditDateModal(false)}
                disabled={editSaving}
                className="p-1 rounded-md text-[#94A3B8] hover:text-white hover:bg-[#192433] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              className="p-5 space-y-4 text-xs"
              onSubmit={async (e) => {
                e.preventDefault();
                if (editSaving) return;
                if (!editDay || !editStart || !editEnd || editEnd <= editStart) {
                  setEditError('Por favor especifica una fecha y horario de fin posterior al inicio.');
                  return;
                }
                setEditSaving(true);
                setEditError('');
                try {
                  const newStart = `${editDay}T${editStart}:00-06:00`;
                  const newEnd = `${editDay}T${editEnd}:00-06:00`;
                  const saved = await onUpdateActivity?.(activity.pageId, {
                    start: newStart,
                    end: newEnd,
                  });
                  if (saved === false) {
                    setEditError('No se pudo guardar el horario en Notion.');
                  } else {
                    setShowEditDateModal(false);
                  }
                } catch (err) {
                  setEditError(err instanceof Error ? err.message : 'Error al guardar horario');
                } finally {
                  setEditSaving(false);
                }
              }}
            >
              {editError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-2.5 text-xs text-rose-300">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={editDay}
                  onChange={(e) => setEditDay(e.target.value)}
                  className="w-full bg-[#121A26] border border-[#22354A] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#38BDF8] [color-scheme:dark]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                    Hora Inicio
                  </label>
                  <input
                    type="time"
                    min="08:00"
                    max="22:00"
                    step={900}
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full bg-[#121A26] border border-[#22354A] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#38BDF8] [color-scheme:dark]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                    Hora Fin
                  </label>
                  <input
                    type="time"
                    min="08:00"
                    max="22:00"
                    step={900}
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full bg-[#121A26] border border-[#22354A] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#38BDF8] [color-scheme:dark]"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1C2838]">
                <button
                  type="button"
                  onClick={() => setShowEditDateModal(false)}
                  disabled={editSaving}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#15202E] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {editSaving ? 'Guardando...' : 'Guardar Horario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
