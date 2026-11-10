"use client";
import { UnifiedActivityModal } from './UnifiedActivityModal';
import { getModalPositionConfig } from '@/lib/modalPosition';
import { ReturnedObservations } from './ReturnedObservations';
import { ReturnToOwnerModal } from './ReturnToOwnerModal';
import { parseVisualParts } from "@/lib/visualTitleParser";
import {WorkflowStageBadge} from '../WorkflowStageBadge';
import {dailyChecklist,checklistTotals,dailyActivityChecks} from '@/lib/dailyChecklist';
import {ActivityContentPanel} from './ActivityContentPanel';
import {ReassignActivityModal} from './ReassignActivityModal';
import {QuickAssigneeSelect} from './QuickAssigneeSelect';
import {titlePriority} from '@/services/activityTags';

import { calendarDomain, calendarDisplayTitle, calendarType, calendarUrgent, calendarInterval, calendarTime, mexicoDate } from "@/services/calendarPresentation";
import {isFtfReminder} from '@/services/progressKpis';
import React, { useState, useRef, useMemo } from "react";
import {createPortal} from 'react-dom';
import {offlineAwareFetch} from '@/services/offlineQueue';
import { Eye, CheckSquare, Tag, ExternalLink, Calendar, Clock, CheckCircle2, ListTodo, Maximize2, Minimize2, ChevronDown, ChevronUp, X, Edit3, Sparkles } from "lucide-react";
import { ActivityTitleFieldEditor } from '../ActivityTitleFieldEditor';
import { formatSmartDate } from "@/lib/dateUtils";
import { NotionCalendarActivity } from "@/types/anfeta";
import { openNotionPage } from "@/services/windowsIntegration";
import {notionPageUrl} from '@/lib/notionPageUrl';
import {ViewportMenu} from './ViewportMenu';
import {QuickScheduleActions} from './QuickScheduleModal';
import { ChecklistPopup } from "./ChecklistPopup";
import { workflowState } from "@/services/activityWorkflow";
import { detectActivityConflict } from "@/services/activityConflict";
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
const MAX_CHECKLIST_CACHE = 250;
function setChecklistCache(key: string, entry: ChecklistCardCacheEntry) {
  checklistMemoryCache.set(key, entry);
  if (checklistMemoryCache.size > MAX_CHECKLIST_CACHE) {
    const oldest = checklistMemoryCache.keys().next().value;
    if (oldest) checklistMemoryCache.delete(oldest);
  }
}
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

function ActivityCardComponent({
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
  const [showReturn,setShowReturn]=useState(false);
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
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showEditDateModal, setShowEditDateModal] = useState(false);
  const [editDay, setEditDay] = useState(() => mexicoDate(activity.start || new Date()));
  const [editStart, setEditStart] = useState(() => calendarTime(activity.start || '08:00'));
  const [editEnd, setEditEnd] = useState(() => calendarTime(activity.end || '09:00'));
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const contentEditing=useRef(false);
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
        items: activity.checklistItems || [],
        completedChecks: activity.completedChecks || [],
      };
      setChecklistCache(key, entry);
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
      setChecklistCache(key,entry);setChecklistData(entry);
    } else if (checklistMemoryCache.has(key)) {
      setChecklistData(checklistMemoryCache.get(key)!);
    } else if (activity.checklistScanned || (activity.checklistTotal ?? 0) > 0 || (activity.checklistItems && activity.checklistItems.length > 0)) {
      const entry: ChecklistCardCacheEntry = {
        total: activity.checklistTotal ?? 0,
        completed: activity.checklistCompleted ?? 0,
        today: activity.todayChecklistCompleted ?? 0,
        items: activity.checklistItems || [],
        completedChecks: activity.completedChecks || [],
      };
      setChecklistCache(key, entry);
      setChecklistData(entry);
    }
  }, [activity.pageId, activity.checklistScanned, activity.checklistTotal, activity.checklistCompleted, activity.todayChecklistCompleted, activity.checklistItems, activity.completedChecks]);

  const fetchChecklistIfNeeded = React.useCallback(async (force = false) => {
    if(activity.isHandoffMirror||checkBusy.current)return;
    const rawId = activity.isReviewMirror ? activity.pageId.replace(/^review-mirror-/, "") : activity.pageId;
    if (!rawId || rawId.startsWith("act-")) return;
    const key = cleanCardId(rawId);

    if (!force) {
      if (checklistMemoryCache.has(key)) {
        setChecklistData(checklistMemoryCache.get(key)!);
        return;
      }

      if (activity.checklistScanned && ((activity.checklistTotal ?? 0) > 0 || activity.checklistItems?.length)) {
        const entry: ChecklistCardCacheEntry = {
          total: activity.checklistTotal ?? 0,
          completed: activity.checklistCompleted ?? 0,
          today: activity.todayChecklistCompleted ?? 0,
          items: activity.checklistItems || [],
          completedChecks: activity.completedChecks || [],
        };
        setChecklistCache(key, entry);
        setChecklistData(entry);
        return;
      }
    } else {
      checklistMemoryCache.delete(key);
      checklistInFlight.delete(key);
    }

    let promise = checklistInFlight.get(key);
    if (!promise || force) {
      setLoadingChecklist(true);
      promise = (async (): Promise<ChecklistCardCacheEntry | null> => {
        try {
          const res = await fetch("/api/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get-checklist", payload: { pageId: rawId, fresh: force } }),
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.items)) {
            const items = data.items;
            const total = items.length;
            const completed = items.filter((i: any) => i.isChecked).length;
            const todayStr = mexicoDate(activity.start || new Date());
            const completedChecks = items.filter((item: any) => item.isChecked && (item.markingSource === "verified" ? item.markedAt && mexicoDate(item.markedAt) === todayStr : item.markingSource === "estimated" && item.editedAt && mexicoDate(item.editedAt) === todayStr));
            const dayProgress=dailyChecklist(items,todayStr);
            const activeCompleted = dayProgress.completed;
            const today = dayProgress.done;
            const entry: ChecklistCardCacheEntry = {
              total,
              completed,
              today,
              items,
              completedChecks: activeCompleted,
            };
            setChecklistCache(key, entry);
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
  }, [activity.isHandoffMirror, activity.isReviewMirror, activity.pageId, activity.checklistScanned, activity.checklistTotal, activity.checklistItems, activity.completedChecks, activity.todayChecklistCompleted, activity.start]);

  // Safe titles & metadata
  const title = activity?.title || (activity as any)?.Title || "";
  const shortTitle = activity?.shortTitle || (activity as any)?.ShortTitle || title;
  const status = activity?.status || (activity as any)?.Status || "";
  const domain = calendarDomain(title, activity?.domain || (activity as any)?.ParsedDomain || "");

  // Limpiar título de tecnicismos redundantes como prtuzREVISION, nneft, jjohn, fechas [10OCT], etc.
  const cleanTitle = calendarDisplayTitle(title, domain);
  const visualParts = useMemo(() => parseVisualParts(title, status), [title, status]);
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

  const isFin = isCompleted && (/^(?:z|fin|finaliz)/i.test(activity.status || '') || /(?<![a-z])z[rdscp]?\b/i.test(activity.title || '') || /cobro\/documentacion|cobrado/i.test(activity.status || '') || Boolean(activity.isFinalized));

  // Badges y colores más tenues, profesionales y oscuros (WPF Parity)
  let badgeLetter = "P";
  let badgeBg = "#261A10";
  let badgeBorder = "#B45309";
  let badgeText = "#FDE68A";
  let cardBorder = "border-[#382818]";
  let cardBg = "bg-[#161516]";

  if (isUrgent) {
    badgeLetter = "!";
    badgeBg = "#300D15";
    badgeBorder = "#E11D48";
    badgeText = "#FDA4AF";
    cardBorder = "border-[#9F1239]/70 shadow-[0_0_10px_rgba(225,29,72,0.18)]";
    cardBg = "bg-[#181114]";
  } else if (isFin) {
    badgeLetter = "F";
    badgeBg = "#041B12";
    badgeBorder = "#059669";
    badgeText = "#10B981";
    cardBorder = "border-emerald-950/40";
    cardBg = "bg-[#060D0A]/60";
  } else if (isCompleted) {
    badgeLetter = "T";
    badgeBg = "#061A14";
    badgeBorder = "#064E3B";
    badgeText = "#34D399";
    cardBorder = "border-teal-950/30";
    cardBg = "bg-[#09110D]/50";
  } else if (isReview) {
    badgeLetter = "R";
    badgeBg = "#0C2E46";
    badgeBorder = "#0284C7";
    badgeText = "#7DD3FC";
    cardBorder = "border-[#075985]/70";
    cardBg = "bg-[#101720]";
  } else if (isSuspended) {
    badgeLetter = "S";
    badgeBg = "#240E3E";
    badgeBorder = "#9333EA";
    badgeText = "#D8B4FE";
    cardBorder = "border-[#6B21A8]/70";
    cardBg = "bg-[#15121E]";
  } else {
    // Pendiente
    badgeLetter = "P";
    badgeBg = "#261A10";
    badgeBorder = "#B45309";
    badgeText = "#FDE68A";
    cardBorder = "border-[#3D2614]/80";
    cardBg = "bg-[#171514]";
  }


  // Desktop palette customization (ANFETA Desktop parity)
  let priorityBorderColor = "#64748B";
  if (isUrgent || calendarUrgent(activity.title)) {
    priorityBorderColor = "#F87171";
  } else if (titlePriority(activity.title,activity.person)==='11') {
    priorityBorderColor = "#FBBF24";
  } else if (titlePriority(activity.title,activity.person)==='22') {
    priorityBorderColor = "#60A5FA";
  } else if (isCompleted) {
    priorityBorderColor = "#064E3B";
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
    desktopCardBg = "bg-[#0B1510]/55";
    desktopCardBorder = "border-[#14261D]/40";
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
    } else if (isCompleted) {
      badgeBg = "#14382A";
      badgeBorder = "#10B981";
      badgeText = "#A7F3D0";
    } else if (isReview) {
      badgeBg = "#12304A";
      badgeBorder = "#38BDF8";
      badgeText = "#BAE6FD";
    } else if (isSuspended) {
      badgeBg = "#301B42";
      badgeBorder = "#C084FC";
      badgeText = "#E9D5FF";
    } else {
      badgeBg = "#382914";
      badgeBorder = "#F59E0B";
      badgeText = "#FDE68A";
    }
  }

  const desktopArea = getDesktopAreaColors(typeLabel);

  const widthPct = 100 / Math.max(1, overlapTotal);
  const leftPct = overlapIndex * widthPct;

  const effectiveTotal = checklistData ? checklistData.total : (activity.checklistTotal ?? 0);
  const effectiveCompleted = checklistData ? checklistData.completed : (activity.checklistCompleted ?? 0);
  const effectiveToday = checklistData ? checklistData.today : (activity.todayChecklistCompleted ?? 0);
  const effectiveItems = checklistData ? checklistData.items : (activity.checklistItems || []);
  async function toggleCardCheck(chk:any){
    if(!editable||isSaving||checkBusy.current||!(chk.blockId||chk.id))return;
    checkBusy.current=true;setCheckSaving(true);setCheckMessage('');
    const previous=checklistData,items=effectiveItems.map((i:any)=>(i.id||i.blockId)===(chk.id||chk.blockId)?{...i,isChecked:!chk.isChecked,...(!chk.isChecked?{markedAt:new Date().toISOString(),markingSource:'verified'}:{})}:i);
    const optimistic={total:effectiveTotal,completed:Math.max(0,effectiveCompleted+(chk.isChecked?-1:1)),today:effectiveToday,items,completedChecks:previous?.completedChecks||[]};
    setChecklistData(optimistic);
    try{const response=await offlineAwareFetch('/api/data',{action:'toggle-checklist',payload:{pageId:activity.pageId,blockId:chk.blockId||chk.id,checked:!chk.isChecked,expectedChecked:!!chk.isChecked,currentUser}});const data=await response.json();
      if(data.queued){setChecklistData(previous);setCheckMessage('Pendiente local; se confirmará al recuperar conexión.');return;}
      if(!response.ok||!data.success||data.checked!==!chk.isChecked)throw Error(data.error||'Notion no confirmó el check.');
      const confirmed={...optimistic,items:data.stats?.checklistItems||items,total:data.stats?.checklistTotal??optimistic.total,completed:data.stats?.checklistCompleted??optimistic.completed,today:data.stats?.todayChecklistCompleted??effectiveToday,completedChecks:data.stats?.completedChecks||optimistic.completedChecks};
      setChecklistCache(cleanCardId(activity.pageId),confirmed);setChecklistData(confirmed);
      const updates={checklistScanned:true,checklistTotal:confirmed.total,checklistCompleted:confirmed.completed,checklistItems:confirmed.items,todayChecklistCompleted:confirmed.today,completedChecks:confirmed.completedChecks};onChecklistUpdated?.(activity.pageId,updates);anfetaSync.broadcast({type:'ACTIVITY_UPDATED',confirmed:true,pageId:activity.pageId,updates});setCheckMessage(data.warning||'Check guardado en Notion.');
    }catch(e){setChecklistData(previous);setCheckMessage(e instanceof Error?e.message:'No se pudo guardar.');}finally{checkBusy.current=false;setCheckSaving(false);}
  }
    const conflict = detectActivityConflict({
    name: activity.title,
    title: activity.title,
    updateStatus: activity.status,
    status: activity.status,
    assignedPerson: activity.person,
    person: activity.person,
  });
  const isScanned = !!(activity.checklistScanned || checklistData);
  const checklistDay=displayDate||mexicoDate(activity.start);
  const daily={...dailyChecklist(effectiveItems,checklistDay),...(!effectiveItems.length?dailyActivityChecks({...activity,checklistItems:effectiveItems,checklistTotal:effectiveTotal,todayChecklistCompleted:effectiveToday},checklistDay):{})};
  const cumulative=checklistTotals({checklistItems:effectiveItems,checklistTotal:effectiveTotal,checklistCompleted:effectiveCompleted});
  const totalChecklist = cumulative.total;
  const completedChecklist = cumulative.done;
  const pct = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  // Hover handlers con protección mejorada de zoom y colisiones en pantalla
  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const expectedWidth = popoverSize === "small" ? 360 : popoverSize === "large" ? 640 : popoverSize === "xl" ? 820 : 480;
        const fitsRight = rect.right + 14 + expectedWidth <= window.innerWidth;
        const left = fitsRight
          ? Math.min(window.innerWidth - expectedWidth - 14, rect.right + 12)
          : Math.max(12, rect.left - expectedWidth - 12);
        const posConfig = getModalPositionConfig();
        const top = posConfig.mode === "center"
          ? Math.min(Math.max(12, window.innerHeight - 560), Math.max(12, rect.top - 20))
          : Math.max(0, posConfig.topOffset);
        setHoverPos({ x: Math.max(12, left), y: Math.max(0, top) });
        setShowHover(true);
      }
      void fetchChecklistIfNeeded();
    }, 650);
  };

  const handleMouseLeave = () => {
    if(contentEditing.current)return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setShowHover(false);
    }, 280);
  };

  const handlePopoverMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  const handlePopoverMouseLeave = () => {
    if(contentEditing.current)return;
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
    if (!contextMenu) return;
    const handleClickOutside = () => closeContextMenu();
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [contextMenu]);

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
        className={`${['returned','handoff'].includes(activity.reviewFlow?.State||'')&&activity.reviewFlow?.Note?'ring-2 ring-amber-400 shadow-[0_0_14px_#fbbf2466]':''} absolute rounded-md border p-2 flex flex-col justify-between ${
          editable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        } transition-all select-none overflow-hidden ${isCompleted ? "opacity-45 hover:opacity-95 transition-opacity" : "opacity-100"} ${
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
              title={isFin ? "Finalizada (FIN definitivo · Sin vuelta atrás)" : isCompleted ? "Terminada (En espera de revisión · Aún se puede regresar con correcciones)" : isReview ? "En Revisión" : isSuspended ? "Suspendida" : "Pendiente"}
            >
              {badgeLetter}
            </span>
            {conflict && (
              <span
                title={conflict.description}
                className="shrink-0 text-amber-400 text-xs inline-flex items-center cursor-help animate-pulse"
                aria-label="Conflicto detectado"
              >
                ⚠️
              </span>
            )}

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

            {/* Badges de mes y código/fase de la actividad */}
            {visualParts.monthCode && (
              <span
                className="shrink-0 px-1 py-0.2 rounded text-[8.5px] font-bold font-mono bg-[#104E3E]/60 border border-[#2DD4BF]/70 text-[#5EEAD4]"
                title={`Mes: ${visualParts.monthCode}`}
              >
                {visualParts.monthCode}
              </span>
            )}
            {visualParts.orderCode && (
              <span
                className="shrink-0 px-1 py-0.2 rounded text-[8.5px] font-bold font-mono bg-[#3B2D6B]/60 border border-[#A78BFA]/70 text-[#C4B5FD]"
                title={`Fase / Orden: ${visualParts.orderCode}`}
              >
                {visualParts.orderCode}
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
              title={`Marcados en Notion: ${completedChecklist} de ${totalChecklist}. Confirmados para este día: ${daily.done}.${daily.unknown?` ${daily.unknown} marcados sin fecha verificable.`:''}`}
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
                void fetchChecklistIfNeeded(true);
                setShowPopup(!showPopup);
              }}
              className="p-0.5 text-slate-500 hover:text-[#38BDF8] shrink-0 opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
              title="Ver checklist (actualizar pasos)"
            >
              <Eye className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Título de la actividad limpio y legible */}
        <div className="my-auto py-0.5 min-w-0">
          <h5 className={`text-[11px] leading-[13px] break-words line-clamp-2 ${isCompleted ? "text-slate-400/70 font-normal" : "font-medium text-[#E2E8F0]"}`}>
            {activity.isReviewMirror && <span className="mr-1 rounded border border-cyan-800 bg-cyan-950/50 px-1 text-[9px] font-semibold text-cyan-200" title="Copia visual de seguimiento. La actividad original está con otro responsable; esta copia no se puede mover ni editar.">{activity.isHandoffMirror?'TRANSFERIDA':'COPIA REVISIÓN'}</span>}
            {isFtfReminder(activity)&&<span className="mr-1 rounded border border-cyan-800 px-1 text-[9px] text-cyan-200" title="Recordatorio FTF: visible, sin sumar actividades ni carga de trabajo">FTF · Recordatorio</span>}
            <span className={wf==='completed'?'text-slate-400 line-through decoration-slate-400/60 decoration-1 opacity-75':''}>{cleanTitle}</span>
          </h5>
        </div>

        {conflict && (
          <span
            title={conflict.description}
            className="mb-1 truncate rounded border border-amber-500/70 bg-amber-950/40 px-1 text-[9px] font-bold text-amber-300"
          >
            ⚠️ {conflict.label}
          </span>
        )}
        {['returned','handoff'].includes(activity.reviewFlow?.State||'')&&!!activity.reviewFlow?.Note&&<span title={String(activity.reviewFlow.Note)} className="mb-1 truncate rounded border border-amber-500/60 px-1 text-[9px] font-bold text-amber-200">↩ Con observaciones</span>}
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

      {/* Unified Hover Preview Popover */}
      {showHover && hoverPos && !isSelected && (
        <UnifiedActivityModal
          activity={activity}
          currentUser={currentUser}
          mode="hover"
          hoverPos={hoverPos}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          onPin={() => {
            setShowHover(false);
            onSelectActivity?.(activity);
          }}
          onClose={() => setShowHover(false)}
          onUpdateActivity={onUpdateActivity}
          onChecklistUpdated={onChecklistUpdated}
          displayDate={displayDate}
          overlapIndex={overlapIndex}
          overlapTotal={overlapTotal}
        />
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
          {editable && (
            <button
              disabled={isCompleted || isSaving}
              onClick={() => {
                closeContextMenu();
                setShowRenameModal(true);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-purple-300 flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Renombrar por campos (ficha)…</span>
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
      {showReturn&&<ReturnToOwnerModal activity={activity} onClose={()=>setShowReturn(false)} onConfirm={async updates=>await onUpdateActivity?.(activity.pageId,updates)}/>}
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

      {/* Modal interactivo: Renombrar por campos */}
      {showRenameModal && createPortal(
        <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl sm:max-w-3xl">
            <ActivityTitleFieldEditor
              pageId={activity.pageId}
              initialTitle={activity.title || ''}
              onSaveSuccess={(newTitle) => {
                setShowRenameModal(false);
                onUpdateActivity?.(activity.pageId, { title: newTitle });
              }}
              onCancel={() => setShowRenameModal(false)}
            />
          </div>
        </div>,
        document.body
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

export const ActivityCard = React.memo(ActivityCardComponent);
