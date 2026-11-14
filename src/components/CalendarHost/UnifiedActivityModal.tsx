"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X,
  ExternalLink,
  Clock,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Edit3,
  GripHorizontal,
  Link2,
  Check,
  Video,
  ListTodo,
  FileText,
  FolderGit2,
  MessageSquare,
  AlertTriangle,
  RotateCcw,
  Pin,
  CheckCircle2,
  Bookmark,
  Share2
} from "lucide-react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { WorkflowStageBadge } from "../WorkflowStageBadge";
import { ActivityStatusSelect } from "./ActivityStatusSelect";
import { ActivityContentPanel } from "./ActivityContentPanel";
import { ReturnedObservations } from "./ReturnedObservations";
import { ReturnToOwnerModal } from "./ReturnToOwnerModal";
import { SendToReviewModal } from "./SendToReviewModal";
import { normalizePerson } from "@/services/identityNormalizer";
import { QuickAssigneeSelect } from "./QuickAssigneeSelect";
import { ActivityQuickEntry } from "./ActivityQuickEntry";
import { ActivityWhatsappGroups } from "../ActivityWhatsappGroups";
import { requestActivityRecording, recordingTarget } from "@/lib/activityRecording";
import { canonicalActivityUrl } from "@/lib/activityCanonicalLink";
import { offlineAwareFetch } from "@/services/offlineQueue";
import {
  getModalPositionConfig,
  MODAL_POSITION_EVENT,
} from "@/lib/modalPosition";
import {
  calendarDisplayTitle,
  calendarType,
  calendarUrgent,
  calendarTime,
  mexicoDate,
  calendarDomain
} from "@/services/calendarPresentation";
import { workflowState } from "@/services/activityWorkflow";
import { openNotionPage } from "@/services/windowsIntegration";
import { notionPageUrl } from "@/lib/notionPageUrl";
import { canEditActivity, isActivityLocked } from "@/services/activityPermissions";
import { activityDescription, editActivityDescription } from "@/services/activityTitleEdit";
import {
  activePersonTag,
  pendingReviewTag,
  titlePriority,
  currentReviewTagPerson
} from "@/services/activityTags";
import { dailyChecklist, checklistTotals, shiftMexicoDay } from "@/lib/dailyChecklist";
import { detectActivityConflict } from "@/services/activityConflict";
import { formatSmartDate } from "@/lib/dateUtils";
import { anfetaSync } from "@/lib/anfetaBroadcastSync";

export type ModalSize = "small" | "medium" | "large" | "xl";

export interface UnifiedActivityModalProps {
  activity: NotionCalendarActivity;
  currentUser: string;
  mode: "hover" | "pinned";
  hoverPos?: { x: number; y: number } | null;
  onClose: () => void;
  onPin?: () => void;
  onUpdateActivity?: (pageId: string, updates: any) => Promise<boolean | any> | void;
  onChecklistUpdated?: (pageId: string, updates: any) => void;
  onDayPhaseCompleted?: (result: {
    movedActivity: NotionCalendarActivity;
    snapshotActivity: NotionCalendarActivity | null;
    originalPageId: string;
  }) => void;
  displayDate?: string;
  overlapIndex?: number;
  overlapTotal?: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function UnifiedActivityModal({
  activity,
  currentUser,
  mode,
  hoverPos,
  onClose,
  onPin,
  onUpdateActivity,
  onChecklistUpdated,
  onDayPhaseCompleted,
  displayDate,
  overlapIndex = 0,
  overlapTotal = 1,
  onMouseEnter,
  onMouseLeave,
}: UnifiedActivityModalProps) {
  const editable = canEditActivity(currentUser, activity) && !activity.isDaySnapshot;
  const isPinned = mode === "pinned";

  // Tab selection in modal
  const [activeTab, setActiveTab] = useState<"checklist" | "content" | "project" | "notes">("checklist");

  // Size state (S / M / L / XL) persisted in localStorage
  const [size, setSize] = useState<ModalSize>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_preview_size");
        if (saved === "small" || saved === "medium" || saved === "large" || saved === "xl") {
          return saved as ModalSize;
        }
      } catch {}
    }
    return "medium";
  });

  const handleSizeChange = (newSize: ModalSize) => {
    setSize(newSize);
    try {
      localStorage.setItem("anfeta_preview_size", newSize);
    } catch {}
  };

  // Dragging state in pinned mode
  const hasManuallyMoved = useRef(false);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      const posConfig = getModalPositionConfig();
      const defaultY =
        posConfig.mode === "center"
          ? Math.max(20, Math.round((window.innerHeight - 620) / 2))
          : Math.max(0, posConfig.topOffset);

      if (hoverPos) {
        return {
          x: Math.max(16, Math.min(window.innerWidth - 500, hoverPos.x)),
          y: posConfig.mode === "center"
            ? Math.max(16, Math.min(window.innerHeight - 600, hoverPos.y))
            : defaultY,
        };
      }
      return {
        x: Math.max(20, Math.round((window.innerWidth - 560) / 2)),
        y: defaultY,
      };
    }
    return { x: 100, y: 100 };
  });

  const isDragging = useRef(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Escuchar cambios de posición de modales en tiempo real desde Configuración
  useEffect(() => {
    const handlePosChange = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;
      if (!hasManuallyMoved.current) {
        const newY =
          detail.mode === "center"
            ? Math.max(20, Math.round((window.innerHeight - 620) / 2))
            : Math.max(0, detail.topOffset ?? 8);
        setPosition((prev) => ({ ...prev, y: newY }));
      }
    };
    window.addEventListener(MODAL_POSITION_EVENT, handlePosChange);
    return () => window.removeEventListener(MODAL_POSITION_EVENT, handlePosChange);
  }, []);

  // Al abrir otra actividad, posicionar según la configuración activa si no se arrastró manualmente
  useEffect(() => {
    if (!hasManuallyMoved.current) {
      const posConfig = getModalPositionConfig();
      const defaultY =
        posConfig.mode === "center"
          ? Math.max(20, Math.round((window.innerHeight - 620) / 2))
          : Math.max(0, posConfig.topOffset);
      setPosition((prev) => ({
        ...prev,
        y: hoverPos && posConfig.mode === "center" ? Math.max(16, Math.min(window.innerHeight - 600, hoverPos.y)) : defaultY,
      }));
    }
  }, [activity.pageId, hoverPos]);

  // Clamp position to viewport bounds
  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const modalEl = modalRef.current;
    const width = modalEl ? modalEl.offsetWidth : 480;
    const height = modalEl ? modalEl.offsetHeight : 500;
    const maxX = Math.max(10, window.innerWidth - width - 10);
    const maxY = Math.max(12, window.innerHeight - height - 12);
    return {
      x: Math.max(10, Math.min(maxX, x)),
      y: Math.max(12, Math.min(maxY, y)),
    };
  }, []);

  // Ajustar posición al redimensionar ventana o zoom
  useEffect(() => {
    const handleResize = () => {
      if (isPinned) {
        setPosition((prev) => clampPosition(prev.x, prev.y));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isPinned, clampPosition]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isPinned) return;
    // Don't drag if target is a button, input, or interactive element
    if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) return;
    isDragging.current = true;
    dragStartOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    hasManuallyMoved.current = true;
    const newX = e.clientX - dragStartOffset.current.x;
    const newY = e.clientY - dragStartOffset.current.y;
    setPosition(clampPosition(newX, newY));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  // Structured Title Editing
  const rawTitle = activity.title || "";
  const currentDescription = useMemo(() => activityDescription(rawTitle), [rawTitle]);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescriptionText, setEditedDescriptionText] = useState(currentDescription);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const contentEditingRef = useRef(false);

  useEffect(() => {
    setEditedDescriptionText(activityDescription(activity.title || ""));
    setIsEditingDescription(false);
    setEditError("");
  }, [activity.title, activity.pageId]);

  const previewRebuiltTitle = useMemo(() => {
    try {
      return editActivityDescription(rawTitle, editedDescriptionText || currentDescription);
    } catch {
      return rawTitle;
    }
  }, [rawTitle, editedDescriptionText, currentDescription]);

  const handleSaveDescription = async () => {
    if (!editedDescriptionText.trim()) {
      setEditError("Escribe una descripción.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const ok = await onUpdateActivity?.(activity.pageId, {
        titleDescription: editedDescriptionText.trim(),
        expectedEditedAt: (activity as any).serverModified || (activity as any).lastEditedTime,
      });
      if (ok === false) {
        setEditError("Notion no confirmó el guardado. Verifica si la actividad cambió en otro dispositivo.");
      } else {
        setIsEditingDescription(false);
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error al guardar el nombre.");
    } finally {
      setEditSaving(false);
    }
  };

  // Unsaved changes check on close
  const handleRequestClose = () => {
    if (isEditingDescription && editedDescriptionText.trim() !== currentDescription.trim()) {
      if (window.confirm("Tienes cambios sin guardar en la descripción. ¿Deseas descartarlos y cerrar?")) {
        setIsEditingDescription(false);
        onClose();
      }
      return;
    }
    onClose();
  };

  // Escuchar tecla Escape global para cerrar modal tanto fijado como en hover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleRequestClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleRequestClose]);

  // Direct Link Copy & Notion Save
  const [copiedLink, setCopiedLink] = useState(false);
  const [savingLinkToNotion, setSavingLinkToNotion] = useState(false);
  const [linkSaveMessage, setLinkSaveMessage] = useState("");

  const directAnfetaLink = useMemo(() => {
    return canonicalActivityUrl(activity.pageId);
  }, [activity.pageId]);

  const handleCopyDirectLink = async () => {
    try {
      if (navigator.clipboard && directAnfetaLink) {
        await navigator.clipboard.writeText(directAnfetaLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {
      setLinkSaveMessage("No se pudo copiar automáticamente al portapapeles.");
    }
  };

  const handleSaveLinkToNotion = async () => {
    if (!directAnfetaLink) return;
    setSavingLinkToNotion(true);
    setLinkSaveMessage("");
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-activity-link",
          payload: { pageId: activity.pageId, linkUrl: directAnfetaLink },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLinkSaveMessage(data.message || "Enlace guardado en Notion.");
      } else if (data.reason === "schema_missing") {
        setLinkSaveMessage("No hay propiedad URL en Notion; el enlace quedó en tu portapapeles.");
        await handleCopyDirectLink();
      } else {
        setLinkSaveMessage(data.error || "No se pudo guardar en Notion.");
      }
    } catch (e) {
      setLinkSaveMessage(e instanceof Error ? e.message : "Error al conectar con Notion.");
    } finally {
      setSavingLinkToNotion(false);
    }
  };

  // Checklist Data State
  const [showAllChecks, setShowAllChecks] = useState(false);
  const [checkFilter, setCheckFilter] = useState<"all" | "today" | "upcoming" | "backlog">("all");
  const [checkSaving, setCheckSaving] = useState(false);
  const [advancingPhase, setAdvancingPhase] = useState(false);
  const [checkMessage, setCheckMessage] = useState("");
  const checkBusy = useRef(false);

  const effectiveTotal = activity.checklistTotal ?? 0;
  const effectiveCompleted = activity.checklistCompleted ?? 0;
  const effectiveToday = activity.todayChecklistCompleted ?? 0;
  const effectiveItems = activity.checklistItems || [];

  const checklistDay = displayDate || (activity.start ? mexicoDate(activity.start) : mexicoDate());
  const tomorrowDay = shiftMexicoDay(checklistDay, 1);
  const daily = dailyChecklist(effectiveItems, checklistDay);
  const cumulative = checklistTotals({
    checklistItems: effectiveItems,
    checklistTotal: effectiveTotal,
    checklistCompleted: effectiveCompleted,
  });
  const totalChecks = cumulative.total;
  const completedChecks = cumulative.done;
  const remainingGlobalChecks = Math.max(0, totalChecks - completedChecks);
  const pct = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;
  const todayPlanPct = daily.plannedTotal > 0 ? Math.round((daily.plannedDone / daily.plannedTotal) * 100) : 0;

  const toggleCheckItem = async (chk: any) => {
    if (!editable || checkBusy.current || !(chk.blockId || chk.id)) return;
    checkBusy.current = true;
    setCheckSaving(true);
    setCheckMessage("");
    try {
      const response = await offlineAwareFetch("/api/data", {
        action: "toggle-checklist",
        payload: {
          pageId: activity.pageId,
          blockId: chk.blockId || chk.id,
          checked: !chk.isChecked,
          expectedChecked: !!chk.isChecked,
          workDate: checklistDay,
          currentUser,
        },
      });
      const data = await response.json();
      if (data.queued) {
        setCheckMessage("Guardado local; se sincronizará con Notion al conectar.");
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Notion rechazó el check.");
      }
      const nextItems = data.stats?.checklistItems || effectiveItems.map((i: any) => (i.id || i.blockId) === (chk.id || chk.blockId) ? { ...i, isChecked: !chk.isChecked } : i);
      const nextSummary = dailyChecklist(nextItems, checklistDay);
      const updates = {
        checklistScanned: true,
        checklistTotal: data.stats?.checklistTotal ?? effectiveTotal,
        checklistCompleted: data.stats?.checklistCompleted ?? (effectiveCompleted + (chk.isChecked ? -1 : 1)),
        checklistItems: nextItems,
        todayChecklistCompleted: data.stats?.todayChecklistCompleted ?? effectiveToday,
        completedChecks: data.stats?.completedChecks || activity.completedChecks || [],
        completedForDay: data.stats?.completedForDay ?? nextSummary.completedForDay,
        pendingFutureChecksCount: data.stats?.pendingFutureChecksCount ?? nextSummary.pendingFutureCount,
        pendingCheckValidation: data.stats?.pendingCheckValidation ?? nextSummary.pendingCheckValidation,
        nextPlannedChecklistDate: data.stats?.nextPlannedChecklistDate ?? nextSummary.nextPlannedDate,
      };
      onChecklistUpdated?.(activity.pageId, updates);
      anfetaSync.broadcast({ type: "ACTIVITY_UPDATED", confirmed: true, pageId: activity.pageId, updates });
    } catch (e) {
      setCheckMessage(e instanceof Error ? e.message : "Error al guardar el check.");
    } finally {
      checkBusy.current = false;
      setCheckSaving(false);
    }
  };

  const planChecklistItems = async (blockIds: string[], plannedDate: string | null) => {
    const cleanIds = blockIds.filter(Boolean);
    if (!editable || checkBusy.current || cleanIds.length === 0) return;
    checkBusy.current = true;
    setCheckSaving(true);
    setCheckMessage("");
    try {
      const response = await offlineAwareFetch("/api/data", {
        action: "plan-checklist-item",
        payload: {
          pageId: activity.pageId,
          blockIds: cleanIds,
          plannedDate,
          workDate: checklistDay,
          currentUser,
        },
      });
      const data = await response.json();
      if (data.queued) {
        setCheckMessage("Planificación guardada localmente; se sincronizará al conectar.");
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar la fecha del check.");
      }
      const nextItems = Array.isArray(data.items)
        ? data.items
        : effectiveItems.map((i: any) =>
            cleanIds.includes(i.blockId || i.id) ? { ...i, plannedDate: plannedDate || undefined } : i
          );
      const nextSummary = dailyChecklist(nextItems, checklistDay);
      const updates = {
        checklistScanned: true,
        checklistTotal: data.stats?.checklistTotal ?? effectiveTotal,
        checklistCompleted: data.stats?.checklistCompleted ?? effectiveCompleted,
        todayChecklistCompleted: data.stats?.todayChecklistCompleted ?? effectiveToday,
        checklistItems: nextItems,
        completedForDay: data.stats?.completedForDay ?? nextSummary.completedForDay,
        pendingFutureChecksCount: data.stats?.pendingFutureChecksCount ?? nextSummary.pendingFutureCount,
        pendingCheckValidation: data.stats?.pendingCheckValidation ?? nextSummary.pendingCheckValidation,
        nextPlannedChecklistDate: data.stats?.nextPlannedChecklistDate ?? nextSummary.nextPlannedDate,
      };
      onChecklistUpdated?.(activity.pageId, updates);
      anfetaSync.broadcast({ type: "ACTIVITY_UPDATED", confirmed: true, pageId: activity.pageId, updates });
      setCheckMessage(
        plannedDate
          ? `Programado ${cleanIds.length > 1 ? `${cleanIds.length} checks` : "check"} para ${plannedDate}.`
          : "Fecha del check limpiada."
      );
    } catch (e) {
      setCheckMessage(e instanceof Error ? e.message : "No se pudo programar el check.");
    } finally {
      checkBusy.current = false;
      setCheckSaving(false);
    }
  };

  const handleCompleteDayAndAdvance = async () => {
    if (!editable || checkBusy.current || advancingPhase) return;
    checkBusy.current = true;
    setAdvancingPhase(true);
    setCheckMessage("");
    try {
      const targetDate = daily.nextPlannedDate || tomorrowDay;
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete-day-and-advance",
          payload: {
            pageId: activity.pageId,
            workDate: checklistDay,
            targetDate,
            currentUser,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo cerrar la fase de hoy.");
      }
      if (data.movedActivity) {
        anfetaSync.broadcast({
          type: "ACTIVITY_UPDATED",
          confirmed: true,
          pageId: activity.pageId,
          updates: data.movedActivity,
        });
        onDayPhaseCompleted?.({
          movedActivity: data.movedActivity,
          snapshotActivity: data.snapshotActivity || null,
          originalPageId: activity.pageId,
        });
      }
      setCheckMessage(
        `Fase guardada en ${checklistDay} y actividad movida al ${data.targetDate || targetDate}.`
      );
    } catch (e) {
      setCheckMessage(e instanceof Error ? e.message : "No se pudo cerrar la fase de hoy.");
    } finally {
      checkBusy.current = false;
      setAdvancingPhase(false);
    }
  };

  // FTF Verification
  const [ftfSaving, setFtfSaving] = useState(false);
  const [ftfMessage, setFtfMessage] = useState("");
  const ftfBusy = useRef(false);

  const handleToggleFtf = async (checked: boolean) => {
    if (ftfBusy.current || !onUpdateActivity) return;
    ftfBusy.current = true;
    setFtfSaving(true);
    setFtfMessage("");
    try {
      const saved = await onUpdateActivity(activity.pageId, {
        ftfVerified: checked,
        expectedFtfVerified: !!activity.ftfVerified,
      });
      setFtfMessage(
        saved === false
          ? "No se confirmó la verificación FTF."
          : checked
          ? "Pasos revisados: actividad entendida."
          : "Se retiró la verificación FTF."
      );
    } catch (error) {
      setFtfMessage(error instanceof Error ? error.message : "Error al actualizar FTF.");
    } finally {
      ftfBusy.current = false;
      setFtfSaving(false);
    }
  };

  // Review & Return Modals
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Presentation metadata
  const typeLabel = calendarType(rawTitle, activity.domain);
  const isUrgent = calendarUrgent(rawTitle);
  const priority = titlePriority(rawTitle, activity.person) || "11";
  const priorityLabel = priority === "00" ? "Urgente" : priority === "11" ? "Primaria" : priority === "22" ? "Secundaria" : "Práctica";
  const domain = calendarDomain(rawTitle, activity.domain) || activity.domain || "general";
  const monthTagMatch = rawTitle.match(/\[?\d{2,4}(?:ENER|FEBR|MARZ|ABRI|MAYO|JUNI|JULI|AGOS|SEPT|OCTU|NOVI|DICI|ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\]?/i);
  const monthTag = monthTagMatch ? monthTagMatch[0].replace(/[\[\]]/g, "") : null;
  const isCompleted = workflowState(activity.status, rawTitle) === "completed";
  const isReview = workflowState(activity.status, rawTitle) === "review";
  const isSuspended = workflowState(activity.status, rawTitle) === "suspended";
  const reviewTarget = isReview
    ? (activity.reviewFlow?.ReviewAssignee && normalizePerson(String(activity.reviewFlow.ReviewAssignee)) !== "Sin asignar"
        ? normalizePerson(String(activity.reviewFlow.ReviewAssignee))
        : currentReviewTagPerson(rawTitle, activity.status || ""))
    : "";
  const conflict = detectActivityConflict({
    name: rawTitle,
    title: rawTitle,
    updateStatus: activity.status,
    status: activity.status,
    assignedPerson: activity.person,
    person: activity.person,
  });

  const durationMinutes = useMemo(() => {
    if (!activity.start || !activity.end) return null;
    const s = Date.parse(activity.start);
    const e = Date.parse(activity.end);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
    return Math.round((e - s) / 60000);
  }, [activity.start, activity.end]);

  const durationFormatted = durationMinutes !== null ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60 ? `${durationMinutes % 60}m` : ""}`.trim() : "";

  // Width classes according to S / M / L / XL
  const widthClass =
    size === "small"
      ? "w-80 sm:w-[380px]"
      : size === "large"
      ? "w-[620px] max-w-[94vw]"
      : size === "xl"
      ? "w-[820px] max-w-[96vw]"
      : "w-[490px] max-w-[92vw]";

  // Style positioning con clamp seguro a la pantalla
  const currentPosConfig = getModalPositionConfig();
  const fallbackTop = currentPosConfig.mode === "center" ? 80 : Math.max(12, currentPosConfig.topOffset);
  const clampedHoverY = hoverPos
    ? Math.min(Math.max(12, hoverPos.y), typeof window !== "undefined" ? Math.max(12, window.innerHeight - 120) : hoverPos.y)
    : fallbackTop;
  const clampedHoverX = hoverPos
    ? Math.min(Math.max(12, hoverPos.x), typeof window !== "undefined" ? Math.max(12, window.innerWidth - 350) : hoverPos.x)
    : 20;

  const stylePos: React.CSSProperties = isPinned
    ? { top: `${position.y}px`, left: `${position.x}px` }
    : hoverPos
    ? { top: `${clampedHoverY}px`, left: `${clampedHoverX}px` }
    : { top: `${fallbackTop}px`, left: "20px" };

  return (
    <>
      <div
        ref={modalRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={(e) => e.stopPropagation()}
        data-activity-card="true"
        data-activity-modal={isPinned ? "pinned" : "hover"}
        style={stylePos}
        className={`fixed z-[120] rounded-xl border border-[#2B3B4E] bg-[#0E1520]/95 backdrop-blur-md shadow-2xl text-xs text-[#E2E8F0] pointer-events-auto transition-all duration-150 animate-in fade-in zoom-in-95 max-h-[calc(100vh-24px)] flex flex-col overflow-hidden ${widthClass}`}
      >
        {/* ================= HEADER BAR (DRAGGABLE) ================= */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#223246] bg-[#121A26] select-none ${
            isPinned ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isPinned && (
              <span title="Arrastrar ventana desde aquí" className="text-slate-500 hover:text-cyan-400 shrink-0">
                <GripHorizontal className="w-4 h-4" />
              </span>
            )}
            <WorkflowStageBadge status={activity.status} title={rawTitle} />
            {typeLabel && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider border bg-[#1E293B] border-[#38BDF8]/40 text-[#38BDF8]">
                {typeLabel}
              </span>
            )}
            {monthTag && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {monthTag}
              </span>
            )}
            {isUrgent && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950 text-rose-200 border border-rose-800">
                URG
              </span>
            )}
            <span className="font-mono font-bold text-[11px] text-[#38BDF8] truncate min-w-0" title={domain}>
              {domain}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Size Selector S / M / L / XL */}
            <div className="flex items-center rounded border border-[#253549] bg-[#0E1520] p-0.5 text-[9.5px] font-mono">
              {(["small", "medium", "large", "xl"] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleSizeChange(sz)}
                  title={`Tamaño ${sz === "small" ? "S (Compacto)" : sz === "large" ? "L (Grande)" : sz === "xl" ? "XL (Extra)" : "M (Normal)"}`}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    size === sz
                      ? "bg-[#0C4A6E] text-[#38BDF8] font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {sz === "small" ? "S" : sz === "large" ? "L" : sz === "xl" ? "XL" : "M"}
                </button>
              ))}
            </div>

            {/* In hover mode: Pin button */}
            {!isPinned && onPin && (
              <button
                type="button"
                onClick={onPin}
                title="Fijar ventana flotante en el calendario"
                className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/80 border border-cyan-700 text-cyan-300 hover:bg-cyan-900 text-[10px] font-medium transition-colors cursor-pointer"
              >
                <Pin className="w-3 h-3" />
                <span>Fijar</span>
              </button>
            )}

            {/* Botón de cierre accesible en ambos modos (fijado y hover) */}
            <button
              type="button"
              aria-label="Cerrar ventana"
              onClick={handleRequestClose}
              title="Cerrar (Esc)"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= SCROLLABLE CONTENT BODY ================= */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin">
          {/* Conflict Alert Banner if any */}
          {conflict && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/70 border border-amber-600/60 text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="flex-1">{conflict.description}</span>
            </div>
          )}

                    {activity.isReviewMirror && (
            <div className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-xs shadow-sm ${
              activity.isDaySnapshot
                ? "bg-emerald-950/60 border-emerald-600/70 text-emerald-100"
                : "bg-cyan-950/60 border-cyan-600/70 text-cyan-200"
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded border text-[10px] uppercase ${
                  activity.isDaySnapshot
                    ? "bg-emerald-900 border-emerald-500 text-emerald-100"
                    : "bg-cyan-900 border-cyan-500 text-cyan-100"
                }`}>
                  {activity.isDaySnapshot ? "Fase del día" : activity.isHandoffMirror ? "Transferida" : "Copia Revisión"}
                </span>
                <span className="truncate">
                  {activity.isDaySnapshot
                    ? activity.daySnapshotSummary || `Copia visual de solo lectura (${activity.daySnapshotDate || checklistDay}).`
                    : "Copia visual de seguimiento. La actividad original está con su revisor."}
                </span>
              </div>
              {activity.pageUrl && (
                <a
                  href={activity.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 font-semibold text-cyan-300 hover:text-white underline text-[11px]"
                  title="Abrir la actividad original en Notion"
                >
                  <span>Ver original</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* ================= 4-LINE STRUCTURED PRESENTATION & EDITING ================= */}
          <div className="rounded-xl bg-[#131D2A] border border-[#213244] p-3 space-y-2 text-xs">
            {/* Line 1: State & Priority & Type */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1C2C3D] pb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Estado:</span>
                <ActivityStatusSelect
                  pageId={activity.pageId}
                  status={activity.status}
                  disabled={!editable || !!activity.isReviewMirror}
                  onReview={() => setShowReviewModal(true)}
                  onSave={async (newStatus: string) => {
                    await onUpdateActivity?.(activity.pageId, { status: newStatus });
                  }}
                />
                {isReview && !activity.isReviewMirror && (
                  <span
                    title={reviewTarget ? `Enviada a revisión con ${reviewTarget} (notificada en Pendientes)` : "Enviada a revisión"}
                    className="inline-flex items-center gap-1 rounded border border-sky-500/60 bg-sky-950/75 px-2 py-0.5 text-[10.5px] font-semibold text-sky-200"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span>{reviewTarget ? `En revisión → ${reviewTarget}` : "En revisión"}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">Prioridad:</span>
                <span
                  className={`font-semibold px-1.5 py-0.5 rounded font-mono ${
                    priority === "00"
                      ? "bg-rose-950 text-rose-300 border border-rose-800"
                      : priority === "11"
                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                      : priority === "22"
                      ? "bg-sky-950 text-sky-300 border border-sky-800"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {priorityLabel} ({priority})
                </span>
              </div>
            </div>

            {/* Line 2: Clean Name / Editable Description */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                  Descripción de la Actividad:
                </span>
                {editable && !activity.isReviewMirror && !isEditingDescription && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDescription(true)}
                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Editar nombre</span>
                  </button>
                )}
              </div>

              {!isEditingDescription ? (
                <div
                  onDoubleClick={() => editable && setIsEditingDescription(true)}
                  className="font-semibold text-slate-100 text-sm leading-snug break-words"
                  title="Doble clic para editar la descripción"
                >
                  {calendarDisplayTitle(rawTitle,domain)}
                </div>
              ) : (
                <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={editedDescriptionText}
                    onChange={(e) => setEditedDescriptionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveDescription();
                      if (e.key === "Escape") {
                        setEditedDescriptionText(currentDescription);
                        setIsEditingDescription(false);
                      }
                    }}
                    placeholder="Escribe la descripción de la actividad…"
                    className="w-full rounded-lg border border-cyan-700 bg-[#0B1119] px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    autoFocus
                  />
                  {previewRebuiltTitle && previewRebuiltTitle !== rawTitle && (
                    <div className="rounded bg-slate-900/80 p-1.5 text-[10px] font-mono text-cyan-300 border border-cyan-950">
                      <span className="text-slate-400">Vista previa del título: </span>
                      {previewRebuiltTitle}
                    </div>
                  )}
                  {editError && <p className="text-[11px] text-rose-300">{editError}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={() => {
                        setEditedDescriptionText(currentDescription);
                        setIsEditingDescription(false);
                      }}
                      className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white border border-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={handleSaveDescription}
                      className="px-3 py-1 rounded text-xs font-bold bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-50"
                    >
                      {editSaving ? "Guardando…" : "Guardar nombre"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Line 3: Assignee & Schedule & Notion Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#1C2C3D]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[10.5px]">Responsable:</span>
                <QuickAssigneeSelect
                  activity={activity}
                  currentUser={currentUser}
                  onConfirm={(updates) => onUpdateActivity?.(activity.pageId, updates)}
                />
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[10.5px]">Horario:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-cyan-300 font-semibold text-[11px]">
                    {activity.start ? (
                      <>
                        {calendarTime(activity.start)}
                        {activity.end ? ` – ${calendarTime(activity.end)}` : ""}
                        {durationFormatted ? ` (${durationFormatted})` : ""}
                      </>
                    ) : (
                      <span className="text-slate-400 font-sans italic text-[10.5px]">Sin fecha programada</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Line 4: Direct Link & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1C2C3D]/80 text-[10.5px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyDirectLink}
                  title="Copiar enlace único estable de esta actividad para abrir directamente en ANFETA"
                  className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors cursor-pointer ${
                    copiedLink
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold"
                      : "bg-[#182638] border-[#29425E] text-cyan-300 hover:bg-[#1E324A]"
                  }`}
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Link2 className="w-3 h-3" />}
                  <span>{copiedLink ? "¡Enlace copiado!" : "Copiar enlace de ANFETA"}</span>
                </button>

                <button
                  type="button"
                  disabled={savingLinkToNotion}
                  onClick={handleSaveLinkToNotion}
                  title="Guardar este enlace de ANFETA en una propiedad URL de la página de Notion"
                  className="flex items-center gap-1 px-2 py-1 rounded border border-[#23384D] bg-[#111A24] text-slate-300 hover:text-white text-[10px] cursor-pointer"
                >
                  <Bookmark className="w-3 h-3 text-sky-400" />
                  <span>{savingLinkToNotion ? "Guardando…" : "Guardar en Notion"}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => openNotionPage(notionPageUrl(activity))}
                className="flex items-center gap-1 text-sky-400 hover:text-sky-200 font-medium cursor-pointer"
              >
                <span>Abrir en Notion</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {linkSaveMessage && (
              <p className="text-[10px] text-cyan-200 font-mono pt-1">{linkSaveMessage}</p>
            )}
          </div>

          {/* ================= FTF PASOS VERIFICADOS CHECKBOX ================= */}
          <label
            className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
              activity.ftfVerified
                ? "border-emerald-500/70 bg-emerald-950/40"
                : "border-slate-700 bg-slate-900/40"
            }`}
          >
            <input
              type="checkbox"
              aria-label="Pasos FTF verificados para hoy"
              checked={!!activity.ftfVerified}
              disabled={!editable || !activity.ftfAvailable || ftfSaving || !onUpdateActivity}
              className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400"
              onChange={(e) => void handleToggleFtf(e.target.checked)}
            />
            <div className="flex-1 min-w-0">
              <span
                className={`block font-semibold text-xs ${
                  activity.ftfVerified ? "text-emerald-300" : "text-slate-200"
                }`}
              >
                {ftfSaving ? "Guardando…" : "Pasos revisados y actividad entendida"}
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-400 leading-relaxed">
                {activity.ftfAvailable
                  ? "Activa la verificación FTF diaria para marcar los pasos como comprendidos."
                  : "Esta página no cuenta con la casilla FTF en su esquema de Notion."}
              </span>
              {ftfMessage && <p className="text-[10px] text-cyan-200 pt-1">{ftfMessage}</p>}
            </div>
          </label>

          {/* ================= REVIEW FLOW CONTROLS ================= */}
          <ReturnedObservations activity={activity} />
          {isReview && !activity.isReviewMirror && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!editable}
                onClick={() => setShowReturnModal(true)}
                className="rounded border border-amber-600 bg-amber-950/60 p-2 text-xs font-semibold text-amber-200 hover:bg-amber-900 transition-colors disabled:opacity-40"
              >
                ↩ Regresar a responsable
              </button>
              <button
                type="button"
                disabled={!editable}
                onClick={() => void onUpdateActivity?.(activity.pageId, { status: "zREVISION" })}
                className="rounded border border-emerald-700 bg-emerald-950/60 p-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900 transition-colors disabled:opacity-40"
              >
                ✓ Terminar revisión (Aprobar)
              </button>
            </div>
          )}

          {/* ================= TABS NAVIGATION ================= */}
          <div className="flex items-center gap-1 border-b border-[#223246] pt-1">
            <button
              type="button"
              onClick={() => setActiveTab("checklist")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "checklist"
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Checklist ({totalChecks})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "content"
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Contenido & Medios</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "notes"
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Observaciones</span>
            </button>
          </div>

          {/* ================= TAB 1: CHECKLIST ================= */}
          {activeTab === "checklist" && (
            <div className="space-y-2.5">
              {totalChecks > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      Progreso de tareas en Notion:
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-emerald-400 font-bold">
                        {completedChecks} / {totalChecks} ({pct}%)
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

                  {/* Meta de hoy + Advertencia de checks futuros */}
                  {(daily.hasDailyPlan || activity.completedForDay || activity.isDaySnapshot) && (
                    <div className="rounded-lg border border-[#1E3448] bg-[#0B1420] p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[10.5px]">
                        <span className="font-semibold text-cyan-200">
                          Meta de hoy ({checklistDay}): {daily.plannedDone} / {daily.plannedTotal || daily.done} ({daily.hasDailyPlan ? `${todayPlanPct}%` : '100%'})
                        </span>
                        {(daily.completedForDay || activity.completedForDay || activity.isDaySnapshot) && (
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${
                              (daily.pendingFutureCount > 0 || activity.pendingCheckValidation)
                                ? "border-amber-500/60 bg-amber-950/70 text-amber-200"
                                : "border-emerald-500/60 bg-emerald-950/70 text-emerald-200"
                            }`}
                          >
                            {(daily.pendingFutureCount > 0 || activity.pendingCheckValidation)
                              ? `✓ Terminado por hoy · Pendiente validar ${daily.pendingFutureCount || activity.pendingFutureChecksCount || remainingGlobalChecks} futuros`
                              : "✓ Terminado por hoy"}
                          </span>
                        )}
                      </div>
                      {daily.hasDailyPlan && (
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[#132030]">
                          <div
                            className={`h-full transition-all duration-300 ${
                              daily.completedForDay ? "bg-emerald-400" : "bg-cyan-400"
                            }`}
                            style={{ width: `${todayPlanPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Filtros y ayuda rápida para planificar checks largos */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                    <div className="flex flex-wrap items-center gap-1">
                      {([
                        { id: "all", label: `Todos (${effectiveItems.length})` },
                        { id: "today", label: `Para hoy (${daily.plannedTotal})` },
                        { id: "upcoming", label: `Próximas (${daily.upcomingPending.length})` },
                        { id: "backlog", label: `Sin fecha (${daily.backlogPending.length})` },
                      ] as const).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setCheckFilter(tab.id)}
                          className={`px-2 py-0.5 rounded border font-mono transition-colors cursor-pointer ${
                            checkFilter === tab.id
                              ? "border-cyan-400 bg-cyan-950/80 text-cyan-200 font-semibold"
                              : "border-[#223549] bg-[#0D1622] text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {editable && !activity.isDaySnapshot && daily.backlogPending.length > 0 && (
                      <button
                        type="button"
                        disabled={checkSaving}
                        onClick={() =>
                          void planChecklistItems(
                            daily.backlogPending.slice(0, 5).map((i) => i.blockId),
                            checklistDay
                          )
                        }
                        className="px-2 py-0.5 rounded border border-cyan-700/70 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-200 font-mono transition-colors cursor-pointer disabled:opacity-40"
                        title="Asignar para hoy los primeros 5 checks pendientes sin fecha"
                      >
                        +5 a Hoy
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono">
                    Confirmados para hoy: {daily.done} de {daily.total}.
                  </p>

                  {checkMessage && <p className="text-xs text-amber-200">{checkMessage}</p>}

                  {/* List of Checklist items */}
                  {(() => {
                    const baseItems =
                      checkFilter === "today"
                        ? effectiveItems.filter((i: any) => i.plannedDate === checklistDay)
                        : checkFilter === "upcoming"
                          ? daily.upcomingPending
                          : checkFilter === "backlog"
                            ? daily.backlogPending
                            : showAllChecks || size === "xl"
                              ? [
                                  ...effectiveItems.filter((i: any) => i.plannedDate === checklistDay),
                                  ...daily.upcomingPending,
                                  ...daily.backlogPending,
                                  ...effectiveItems.filter(
                                    (i: any) =>
                                      Boolean(i.isChecked) &&
                                      i.plannedDate !== checklistDay &&
                                      !(i.plannedDate && i.plannedDate > checklistDay)
                                  ),
                                ]
                              : daily.items;
                    const visibleItems =
                      checkFilter !== "all" || showAllChecks || size === "xl"
                        ? baseItems
                        : baseItems.slice(0, 6);

                    return (
                      <div
                        className={`space-y-1 overflow-y-auto pr-0.5 scrollbar-thin ${
                          showAllChecks || size === "xl" || checkFilter !== "all" ? "max-h-72" : "max-h-48"
                        }`}
                      >
                        {visibleItems.length === 0 ? (
                          <div className="py-3 text-center text-[10.5px] text-slate-500 font-mono">
                            No hay checks en esta vista.
                          </div>
                        ) : (
                          visibleItems.map((chk: any, idx: number) => {
                            const isDone = Boolean(chk.isChecked);
                            const bid = chk.blockId || chk.id || "";
                            const planned = chk.plannedDate ? String(chk.plannedDate).slice(0, 10) : "";
                            const isTodayPlan = planned === checklistDay;
                            const isTomorrowPlan = planned === tomorrowDay;
                            const isCustomPlan = Boolean(planned && !isTodayPlan && !isTomorrowPlan);
                            const addedDate = chk.createdAt ? formatSmartDate(chk.createdAt) : null;
                            const doneDate = chk.markingSource === "verified" && chk.markedAt ? formatSmartDate(chk.markedAt) : null;

                            return (
                              <div
                                key={bid || idx}
                                className={`flex items-start justify-between gap-2 p-1.5 rounded border text-[11px] ${
                                  isTodayPlan
                                    ? "bg-[#0F1E2E]/90 border-cyan-700/60"
                                    : "bg-[#0D1520]/80 border-[#1E2A38]/70"
                                }`}
                              >
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <input
                                    type="checkbox"
                                    aria-label={`Completar ${chk.text || "tarea"}`}
                                    checked={isDone}
                                    disabled={!editable || checkSaving}
                                    onChange={() => void toggleCheckItem(chk)}
                                    className="mt-0.5 shrink-0 accent-emerald-400 cursor-pointer"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={`leading-tight block ${
                                        isDone ? "text-slate-400 line-through opacity-80" : "text-slate-100"
                                      }`}
                                    >
                                      {chk.text || "Tarea sin título"}
                                    </span>
                                    {(planned || (isDone && doneDate) || addedDate) && (
                                      <span className="mt-0.5 inline-flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-slate-400">
                                        {planned && (
                                          <span
                                            className={`px-1 rounded border ${
                                              isTodayPlan
                                                ? "border-cyan-500/60 bg-cyan-950/70 text-cyan-200"
                                                : isTomorrowPlan
                                                  ? "border-indigo-500/60 bg-indigo-950/70 text-indigo-200"
                                                  : "border-slate-600 bg-slate-900 text-slate-300"
                                            }`}
                                          >
                                            {isTodayPlan ? "Para hoy" : isTomorrowPlan ? "Mañana" : planned}
                                          </span>
                                        )}
                                        {isDone && doneDate ? (
                                          <span className="text-emerald-400 font-medium">✓ {doneDate}</span>
                                        ) : addedDate ? (
                                          <span className="text-slate-500">+{addedDate}</span>
                                        ) : null}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {editable && !activity.isDaySnapshot && bid && (
                                  <div className="shrink-0 flex items-center gap-1 font-mono text-[9px]">
                                    <button
                                      type="button"
                                      disabled={checkSaving}
                                      onClick={() => void planChecklistItems([bid], isTodayPlan ? null : checklistDay)}
                                      className={`px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                                        isTodayPlan
                                          ? "border-cyan-400 bg-cyan-900/80 text-cyan-100 font-bold"
                                          : "border-[#25384B] bg-[#0B131E] text-slate-300 hover:border-cyan-500"
                                      }`}
                                      title="Planear este check para hoy"
                                    >
                                      Hoy
                                    </button>
                                    <button
                                      type="button"
                                      disabled={checkSaving}
                                      onClick={() => void planChecklistItems([bid], isTomorrowPlan ? null : tomorrowDay)}
                                      className={`px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                                        isTomorrowPlan
                                          ? "border-indigo-400 bg-indigo-900/80 text-indigo-100 font-bold"
                                          : "border-[#25384B] bg-[#0B131E] text-slate-300 hover:border-indigo-500"
                                      }`}
                                      title="Planear este check para mañana"
                                    >
                                      Mañ.
                                    </button>
                                    <label
                                      className={`relative px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                                        isCustomPlan
                                          ? "border-amber-400 bg-amber-950/70 text-amber-200 font-bold"
                                          : "border-[#25384B] bg-[#0B131E] text-slate-300 hover:border-slate-400"
                                      }`}
                                      title="Elegir fecha específica para este check"
                                    >
                                      <span>{isCustomPlan ? planned.slice(5) : "📅"}</span>
                                      <input
                                        type="date"
                                        value={planned || checklistDay}
                                        disabled={checkSaving}
                                        onChange={(e) => {
                                          if (e.target.value) void planChecklistItems([bid], e.target.value);
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                      />
                                    </label>
                                    {planned && (
                                      <button
                                        type="button"
                                        disabled={checkSaving}
                                        onClick={() => void planChecklistItems([bid], null)}
                                        className="px-1 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-rose-300 hover:border-rose-500/60 cursor-pointer"
                                        title="Quitar fecha programada"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}

                        {checkFilter === "all" && totalChecks > 6 && size !== "xl" && (
                          <button
                            type="button"
                            onClick={() => setShowAllChecks((prev) => !prev)}
                            className="w-full py-1 text-[10px] text-cyan-300 bg-[#122132] hover:bg-[#182C42] border border-[#234360] rounded flex items-center justify-center gap-1 font-mono transition-colors cursor-pointer"
                          >
                            {showAllChecks ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                <span>Mostrar menos checks</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                <span>Ver todos los checks ({totalChecks})</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {editable && !activity.isDaySnapshot && remainingGlobalChecks > 0 && (daily.completedForDay || (!daily.hasDailyPlan && daily.done > 0)) && (
                    <div className="pt-1.5 border-t border-[#1D2D3E]">
                      <button
                        type="button"
                        disabled={advancingPhase || checkSaving}
                        onClick={() => void handleCompleteDayAndAdvance()}
                        className="w-full py-2 px-3 rounded-lg border border-emerald-500/70 bg-emerald-950/75 hover:bg-emerald-900/80 text-emerald-100 text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <span>
                          {advancingPhase
                            ? "Guardando fase y moviendo al siguiente día…"
                            : `✓ Guardar fase de hoy y pasar a ${daily.nextPlannedDate || tomorrowDay}`}
                        </span>
                        <span className="text-[10px] font-normal text-emerald-300/90">
                          Deja copia visual de solo lectura hoy y conserva el horario (permite empalme)
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center text-slate-400 font-mono text-xs">
                  Sin tareas en el checklist de esta actividad.
                </div>
              )}

              {/* Quick Entry to add checks */}
              {!activity.isDaySnapshot && (
                <ActivityQuickEntry
                  pageId={activity.pageId}
                  disabled={!editable}
                  onChecklistAdded={(newItem) => {
                    if (onChecklistUpdated) {
                      onChecklistUpdated(activity.pageId, {
                        checklistTotal: (activity.checklistTotal || 0) + 1,
                        checklistItems: [...(activity.checklistItems || []), newItem],
                      });
                    }
                  }}
                />
              )}
            </div>
          )}

          {/* ================= TAB 2: CONTENT & MEDIA ================= */}
          {activeTab === "content" && (
            <div className="space-y-3">
              <ActivityContentPanel
                cleanActivityTitle
                activity={activity}
                currentUser={currentUser}
                defaultOpen={true}
                onEditingChange={(isEd) => {
                  contentEditingRef.current = isEd;
                }}
              />

              {/* Recording Action Button */}
              <div className="pt-2 border-t border-[#1E2E40] flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                  const target = recordingTarget({ id: activity.pageId, title: rawTitle });
                  if (target) requestActivityRecording(target);
                }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Grabar video explicativo</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= TAB 3: NOTES & WHATSAPP ================= */}
          {activeTab === "notes" && (
            <div className="space-y-3">
              <ActivityWhatsappGroups title={rawTitle} currentUser={currentUser} />
              <div className="rounded-lg bg-[#141E2B] p-3 text-xs text-slate-300 border border-[#1E2E40] space-y-1">
                <h5 className="font-semibold text-slate-200">Historial de Revisiones</h5>
                <p className="text-[11px] text-slate-400">
                  {(activity.reviewFlow as any)?.Reviewer || (activity.reviewFlow as any)?.ReviewAssignee
                    ? `Revisor: ${String((activity.reviewFlow as any)?.Reviewer || (activity.reviewFlow as any)?.ReviewAssignee)}. Estado de flujo: ${String((activity.reviewFlow as any)?.State || "Normal")}.`
                    : "No hay ciclo de revisión pendiente en esta actividad."}
                </p>
                {Boolean((activity.reviewFlow as any)?.Note) && (
                  <div className="mt-2 rounded bg-amber-950/40 border border-amber-600/40 p-2 text-amber-200 font-mono text-[10.5px]">
                    {String((activity.reviewFlow as any)?.Note)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ================= FOOTER / STATUS BAR ================= */}
        <div className="flex items-center justify-between px-3.5 py-2 border-t border-[#1C2C3D] bg-[#0E1520] text-[10.5px] text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans font-medium transition-colors cursor-pointer border border-slate-700 shadow-sm"
              title="Cerrar ventana (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cerrar</span>
            </button>
            <span className="truncate hidden sm:inline">
              ID: {String(activity.pageId || "").slice(0, 16)}…
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyDirectLink}
              className="text-cyan-400 hover:underline cursor-pointer"
            >
              {copiedLink ? "✓ Copiado" : "Copiar enlace directo"}
            </button>
            <button
              type="button"
              onClick={() => openNotionPage(notionPageUrl(activity))}
              className="text-sky-400 hover:underline cursor-pointer"
            >
              ↗ Notion
            </button>
          </div>
        </div>
      </div>

      {/* Return to Owner Modal if active */}
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
      {showReturnModal && (
        <ReturnToOwnerModal
          activity={activity}
          onClose={() => setShowReturnModal(false)}
          onConfirm={async (updates) => {
            await onUpdateActivity?.(activity.pageId, updates);
            setShowReturnModal(false);
          }}
        />
      )}
    </>
  );
}
