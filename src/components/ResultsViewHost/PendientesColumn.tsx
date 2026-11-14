"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Check,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  Archive,
  Bell,
  CheckCircle2,
  ArrowRight,
  FastForward,
  RotateCcw,
  Sparkles,
  UserCheck,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Settings,
  CopyPlus,
  X,
  ExternalLink,
  Utensils,
  Star,
  StickyNote,
  Eye,
  EyeOff,
  GripVertical,
  Repeat,
} from "lucide-react";
import { PendingTaskItem } from "@/types/anfeta";
import { formatSmartDate } from "@/lib/dateUtils";
import { normalizePerson } from "@/services/identityNormalizer";
import { calendarTime, mexicoDate } from "@/services/calendarPresentation";
import { shiftMexicoDay } from "@/lib/dailyChecklist";
import { buildAttendedStatePatch, isFtfPendingBlock, isRecurringPendingTask } from "@/lib/pendingRecurrence";
import { isReviewOrSentPending, isVideoPendingTask } from "@/lib/pendingAlerts";
import { playCheckChime, sendWindowsNotification } from "@/services/windowsIntegration";
import {
  parseTaskTime,
  shiftTaskSchedule,
  moveTaskToMinutes,
  computeCatchUpSchedule,
  simplifyReviewSearchQuery,
  stripLeadingScheduleTime,
} from "@/lib/scheduleHelpers";
import { MealBreakModal } from "../CalendarHost/MealBreakModal";
import {
  MealBreakConfig,
  getMealBreakConfig,
  MEAL_BREAK_EVENT,
  formatHour12,
} from "@/services/mealBreakService";

export function getCurrentMexicoMinutes(): number {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    return hour * 60 + minute;
  } catch {
    return now.getHours() * 60 + now.getMinutes();
  }
}

export function formatTimeMinutes(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  const dispH = h % 12 || 12;
  const meridian = h >= 12 ? "PM" : "AM";
  return `${dispH}:${String(min).padStart(2, "0")} ${meridian}`;
}

export function formatSlotHour(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function formatSlotRange(startMin: number, endMin: number): string {
  return `${formatSlotHour(startMin)} - ${formatSlotHour(endMin)}`;
}

export function formatRelativePriorityHour(rankOneBased: number): string {
  const hour24 = ((rankOneBased - 1) % 24) + 1;
  if (hour24 === 24) return "12:00 AM";
  if (hour24 === 12) return "12:00 PM";
  return hour24 > 12 ? `${hour24 - 12}:00 PM` : `${hour24}:00 AM`;
}

export function extractTaskTime(
  task: PendingTaskItem,
  defaultDurationMinutes = 60
): {
  hasTime: boolean;
  timeMinutes: number;
  endMinutes: number;
  timeBadge: string;
  isPassed: boolean;
  isActive: boolean;
} {
  const currentMin = getCurrentMexicoMinutes();
  const parsed = parseTaskTime(task, defaultDurationMinutes);
  if (!parsed.hasTime) {
    return { hasTime: false, timeMinutes: 99999, endMinutes: 99999, timeBadge: "", isPassed: false, isActive: false };
  }
  return {
    ...parsed,
    isPassed: currentMin >= parsed.endMinutes,
    isActive: currentMin >= parsed.timeMinutes && currentMin < parsed.endMinutes,
  };
}

// Estilos Bento temáticos para tarjetas de horario
function getRoutineCardColorStyle(title: string, index: number, customColor?: string) {
  if (customColor) {
    return {
      bg: "bg-[#101824]/90",
      border: "border-cyan-500/50",
      accent: "text-cyan-300",
      badge: "bg-cyan-950/80 text-cyan-200 border-cyan-700/60",
    };
  }
  const lower = title.toLowerCase();
  if (lower.includes("creaci") || lower.includes("web") || lower.includes("setup")) {
    return {
      bg: "bg-[#082F49]/80",
      border: "border-[#00E5FF]/50",
      accent: "text-[#00E5FF]",
      badge: "bg-[#00E5FF]/20 text-[#38BDF8] border-[#00E5FF]/40",
    };
  }
  if (lower.includes("email") || lower.includes("correo") || lower.includes("mensaj")) {
    return {
      bg: "bg-[#1E293B]/80",
      border: "border-[#94A3B8]/40",
      accent: "text-[#E2E8F0]",
      badge: "bg-slate-800 text-slate-300 border-slate-600",
    };
  }
  if (lower.includes("almuer") || lower.includes("comida") || lower.includes("break")) {
    return {
      bg: "bg-[#064E3B]/80",
      border: "border-[#10B981]/50",
      accent: "text-[#34D399]",
      badge: "bg-emerald-950 text-emerald-300 border-emerald-600",
    };
  }
  if (lower.includes("promo") || lower.includes("market") || lower.includes("redes")) {
    return {
      bg: "bg-[#3B0764]/80",
      border: "border-[#C084FC]/50",
      accent: "text-[#E879F9]",
      badge: "bg-purple-950 text-purple-300 border-purple-600",
    };
  }
  if (lower.includes("educa") || lower.includes("curso") || lower.includes("estud") || lower.includes("cierre")) {
    return {
      bg: "bg-[#451A03]/80",
      border: "border-[#F59E0B]/50",
      accent: "text-[#FBBF24]",
      badge: "bg-amber-950 text-amber-300 border-amber-600",
    };
  }
  if (lower.includes("ftf") || lower.includes("bitac") || lower.includes("revisi")) {
    return {
      bg: "bg-[#1E1B4B]/80",
      border: "border-[#818CF8]/50",
      accent: "text-[#A5B4FC]",
      badge: "bg-indigo-950 text-indigo-300 border-indigo-600",
    };
  }

  // Paleta cíclica por defecto
  const palette = [
    { bg: "bg-[#082F49]/80", border: "border-[#00E5FF]/40", accent: "text-[#00E5FF]", badge: "bg-cyan-950 text-cyan-300 border-cyan-700" },
    { bg: "bg-[#1E1B4B]/80", border: "border-[#818CF8]/40", accent: "text-[#A5B4FC]", badge: "bg-indigo-950 text-indigo-300 border-indigo-700" },
    { bg: "bg-[#3B0764]/80", border: "border-[#C084FC]/40", accent: "text-[#E879F9]", badge: "bg-purple-950 text-purple-300 border-purple-700" },
    { bg: "bg-[#064E3B]/80", border: "border-[#10B981]/40", accent: "text-[#34D399]", badge: "bg-emerald-950 text-emerald-300 border-emerald-700" },
    { bg: "bg-[#451A03]/80", border: "border-[#F59E0B]/40", accent: "text-[#FBBF24]", badge: "bg-amber-950 text-amber-300 border-amber-700" },
  ];
  return palette[index % palette.length];
}

interface PendientesColumnProps {
  onClose?: () => void;
  pendingTasks: PendingTaskItem[];
  currentUser?: string;
  onToggleTask: (id: string) => void;
  onToggleAttended?: (id: string) => void;
  onOpenNewTaskModal: () => void;
  onOpenNewTaskModalWithTime?: (timeStr: string) => void;
  onEditTask?: (task: PendingTaskItem) => void;
  onUpdateTask?: (id: string, patch: Partial<PendingTaskItem>) => void;
  onBatchUpdateTasks?: (patches: Array<{ id: string; patch: Partial<PendingTaskItem> }>) => void;
  onDeleteTask: (id: string) => void;
  onDeleteAllTasks?: () => void;
  onSelectTaskQuery?: (query: string) => void;
  onReorderTasks?: (ids: string[]) => void;
  onDuplicateTask?: (task: PendingTaskItem) => void;
}

function PendientesColumnComponent({
  onClose,
  pendingTasks,
  currentUser = "Neftali",
  onToggleTask,
  onToggleAttended,
  onOpenNewTaskModal,
  onOpenNewTaskModalWithTime,
  onEditTask,
  onUpdateTask,
  onBatchUpdateTasks,
  onDeleteTask,
  onDeleteAllTasks,
  onSelectTaskQuery,
  onReorderTasks,
  onDuplicateTask,
}: PendientesColumnProps) {
  const [contextMenu, setContextMenu] = useState<{ task: PendingTaskItem; x: number; y: number } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverSlotStart, setDragOverSlotStart] = useState<number | null>(null);
  const [hideEmptySlots, setHideEmptySlots] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_pendientes_hide_empty");
        if (saved === "0") return false;
        if (saved === "1") return true;
      } catch {}
    }
    return true;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(getCurrentMexicoMinutes());

  // Configuración de Cuadrícula Personalizable: Inicio, Fin e Intervalo
  const [customStartHour, setCustomStartHour] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_pendientes_start_hour");
        if (saved !== null) {
          const num = parseInt(saved, 10);
          if (num >= 0 && num <= 23) return num;
        }
      } catch {}
    }
    return 8;
  });

  const [customEndHour, setCustomEndHour] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_pendientes_end_hour");
        if (saved !== null) {
          const num = parseInt(saved, 10);
          if (num >= 1 && num <= 24) return num;
        }
      } catch {}
    }
    return 19;
  });

  const [gridInterval, setGridInterval] = useState<30 | 60>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_pendientes_grid_interval");
        if (saved === "30" || saved === "60") return parseInt(saved, 10) as 30 | 60;
      } catch {}
    }
    return 60; // 1 hora por defecto (ej. 9 a 10, 10 a 11)
  });

  const [showGridConfig, setShowGridConfig] = useState(false);

  // Horario Especial / Comida
  const isNeftali = normalizePerson(currentUser) === "Neftali";
  const [mealBreak, setMealBreak] = useState<MealBreakConfig>(() => getMealBreakConfig(currentUser));
  const [showMealModal, setShowMealModal] = useState(false);

  useEffect(() => {
    setMealBreak(getMealBreakConfig(currentUser));
  }, [currentUser]);

  useEffect(() => {
    const onMealBreakUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.user === normalizePerson(currentUser)) {
        setMealBreak(getMealBreakConfig(currentUser));
      }
    };
    window.addEventListener(MEAL_BREAK_EVENT, onMealBreakUpdate);
    return () => window.removeEventListener(MEAL_BREAK_EVENT, onMealBreakUpdate);
  }, [currentUser]);

  const saveCustomHours = (startH: number, endH: number) => {
    try {
      localStorage.setItem("anfeta_pendientes_start_hour", String(startH));
      localStorage.setItem("anfeta_pendientes_end_hour", String(endH));
    } catch {}
    setFeedback(`Rango: ${String(startH).padStart(2, "0")}:00 a ${String(endH).padStart(2, "0")}:00`);
  };

  const handleToggleInterval = (interval: 30 | 60) => {
    setGridInterval(interval);
    try {
      localStorage.setItem("anfeta_pendientes_grid_interval", String(interval));
    } catch {}
  };

  const handleToggleHideEmptySlots = () => {
    setHideEmptySlots((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("anfeta_pendientes_hide_empty", next ? "1" : "0");
      } catch {}
      setFeedback(next ? "Huecos vacíos ocultos" : "Mostrando todos los horarios");
      return next;
    });
  };

  // Actualizar hora cada 30 segundos para animar la línea de tiempo y transparencias en vivo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMinutes(getCurrentMexicoMinutes());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const [columnWidth, setColumnWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_pendientes_width");
        if (saved) {
          const num = parseInt(saved, 10);
          if (num >= 240 && num <= 700) return num;
        }
      } catch {}
    }
    return 290;
  });

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = columnWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(240, Math.min(650, startWidth + delta));
      setColumnWidth(newWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      const finalDelta = upEvent.clientX - startX;
      const finalWidth = Math.max(240, Math.min(650, startWidth + finalDelta));
      try {
        localStorage.setItem("anfeta_pendientes_width", String(finalWidth));
      } catch {}
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("anfeta_pendientes_collapsed") === "1");
    } catch {}
  }, []);

  const togglePanel = () =>
    setCollapsed((old) => {
      try {
        localStorage.setItem("anfeta_pendientes_collapsed", old ? "0" : "1");
      } catch {}
      return !old;
    });

  const [dismissedNotification, setDismissedNotification] = useState(false);

  // Helper para saber si un pendiente fue asignado directamente a mí por otro compañero
  const isDirectlyAssignedToMe = (t: PendingTaskItem) => {
    const normCurrent = normalizePerson(currentUser || "");
    return Boolean(
      t.assignedTo &&
      normalizePerson(t.assignedTo) === normCurrent &&
      t.assignedBy &&
      normalizePerson(t.assignedBy) !== normCurrent &&
      !t.isAttended &&
      !t.isCompleted
    );
  };

  // Active tasks: Asignados directos hasta arriba
  const activeTasks = useMemo(() => {
    const raw = pendingTasks.filter((t) => !t.isArchived);
    return [...raw].sort((a, b) => {
      const aDirect = isDirectlyAssignedToMe(a) ? 1 : 0;
      const bDirect = isDirectlyAssignedToMe(b) ? 1 : 0;
      if (aDirect !== bDirect) return bDirect - aDirect;
      return 0;
    });
  }, [pendingTasks, currentUser]);

  const archivedTasks = useMemo(() => pendingTasks.filter((t) => Boolean(t.isArchived)), [pendingTasks]);

  // Timed tasks: Bloques de horario (Siempre ordenados cronológicamente por hora)
  const timedTasks = useMemo(() => {
    const raw = pendingTasks.filter((t) => extractTaskTime(t, gridInterval).hasTime && !t.isArchived);
    return [...raw].sort((a, b) => {
      const aInfo = extractTaskTime(a, gridInterval);
      const bInfo = extractTaskTime(b, gridInterval);
      return aInfo.timeMinutes - bInfo.timeMinutes;
    });
  }, [pendingTasks, gridInterval]);

  // Free tasks: Pendientes libres / normales (Asignados directos hasta arriba)
  const freeTasks = useMemo(() => {
    const raw = pendingTasks.filter((t) => !extractTaskTime(t, gridInterval).hasTime && !t.isArchived);
    return [...raw].sort((a, b) => {
      const aDirect = isDirectlyAssignedToMe(a) ? 1 : 0;
      const bDirect = isDirectlyAssignedToMe(b) ? 1 : 0;
      if (aDirect !== bDirect) return bDirect - aDirect;
      return 0;
    });
  }, [pendingTasks, currentUser, gridInterval]);

  // Tareas asignadas a mí por otro compañero no atendidas (con normalización canónica robusta)
  const assignedToMeUnattended = useMemo(() => {
    const normCurrent = normalizePerson(currentUser || "");
    return activeTasks.filter(
      (t) =>
        t.assignedTo &&
        normalizePerson(t.assignedTo) === normCurrent &&
        t.assignedBy &&
        normalizePerson(t.assignedBy) !== normCurrent &&
        !t.isAttended &&
        !t.isCompleted
    );
  }, [activeTasks, currentUser]);

  // Pendientes enviados / con video / que requieren revisión para completar
  const reviewPendingTasks = useMemo(
    () => activeTasks.filter((t) => !t.isCompleted && !t.isAttended && isReviewOrSentPending(t)),
    [activeTasks]
  );

  const handleDuplicateTask = (task: PendingTaskItem) => {
    if (onDuplicateTask) {
      onDuplicateTask(task);
    } else {
      onOpenNewTaskModal();
    }
    setFeedback("Pendiente duplicado");
  };

  // Notificar al usuario con Toast nativo y sonido si llega una tarea asignada nueva
  const notifiedTasksRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (assignedToMeUnattended.length > 0) {
      const newlyArrived = assignedToMeUnattended.filter((t) => !notifiedTasksRef.current.has(t.id));
      if (newlyArrived.length > 0) {
        newlyArrived.forEach((t) => notifiedTasksRef.current.add(t.id));
        playCheckChime();
        const first = newlyArrived[0];
        sendWindowsNotification(
          "Nuevo pendiente asignado",
          `${first.assignedBy || "Un compañero"} te asignó: ${first.title}`
        );
      }
    }
  }, [assignedToMeUnattended]);

  // Avisos directos de revisión recibidos para el revisor actual (sin duplicar tarjeta en calendario)
  const [incomingReviews, setIncomingReviews] = useState<Array<{ id: string; activityTitle: string; title: string; authorName?: string; updated?: string }>>([]);
  const [dismissedReviewIds, setDismissedReviewIds] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const normCurrent = normalizePerson(currentUser || "");
    if (!normCurrent || normCurrent === "Sin asignar") {
      setIncomingReviews([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const fetchReviews = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(`/api/data?type=review-notifications&person=${encodeURIComponent(normCurrent)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data.items) ? data.items : [];
        const pendingForMe = list.filter((item: any) => {
          const isIncoming = !item.authorName || normalizePerson(item.authorName) !== normCurrent;
          const isReviewAction = /lista para revisi[oó]n|revisi[oó]n/i.test(item.actionLabel || item.title || "");
          return isIncoming && isReviewAction && item.kind !== "ftf";
        });
        setIncomingReviews(pendingForMe);
      } catch {}
    };
    void fetchReviews();
    const timer = setInterval(fetchReviews, 60000);
    window.addEventListener("anfeta_review_saved", fetchReviews);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("anfeta_review_saved", fetchReviews);
    };
  }, [currentUser]);
  const visibleIncomingReviews = incomingReviews.filter((r) => !dismissedReviewIds[r.id]);

  const [pendingSubTab, setPendingSubTab] = useState<"all" | "free" | "timed" | "archived">("all");
  const [allViewMode, setAllViewMode] = useState<"strip" | "grid">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_pendientes_all_view");
        if (saved === "grid" || saved === "strip") return saved;
      } catch {}
    }
    return "strip";
  });
  const handleToggleAllViewMode = (mode: "strip" | "grid") => {
    setAllViewMode(mode);
    try {
      localStorage.setItem("anfeta_pendientes_all_view", mode);
    } catch {}
  };

  const [scheduleViewMode, setScheduleViewMode] = useState<"relative" | "clock">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_pendientes_schedule_mode");
        if (saved === "clock" || saved === "relative") return saved;
      } catch {}
    }
    return "relative";
  });
  const handleToggleScheduleViewMode = (mode: "relative" | "clock") => {
    setScheduleViewMode(mode);
    try {
      localStorage.setItem("anfeta_pendientes_schedule_mode", mode);
    } catch {}
  };

  const todayDateStr = mexicoDate();
  const tomorrowDateStr = shiftMexicoDay(todayDateStr, 1);

  const orderedStripTasks = useMemo(
    () => pendingTasks.filter((t) => !t.isArchived),
    [pendingTasks]
  );

  const stripSections = useMemo(() => {
    const overdueStrip = orderedStripTasks.filter((t) => {
      const d = t.scheduledDate ? String(t.scheduledDate).slice(0, 10) : "";
      return Boolean(d && d < todayDateStr && !t.isCompleted && !t.isAttended);
    });
    const todayStrip = orderedStripTasks.filter((t) => {
      const d = t.scheduledDate ? String(t.scheduledDate).slice(0, 10) : "";
      return !d || d === todayDateStr || (d < todayDateStr && (t.isCompleted || t.isAttended));
    });
    const tomorrowStrip = orderedStripTasks.filter((t) => {
      const d = t.scheduledDate ? String(t.scheduledDate).slice(0, 10) : "";
      return d === tomorrowDateStr;
    });
    const laterStrip = orderedStripTasks.filter((t) => {
      const d = t.scheduledDate ? String(t.scheduledDate).slice(0, 10) : "";
      return Boolean(d && d > tomorrowDateStr);
    });

    return [
      ...(overdueStrip.length > 0
        ? [
            {
              key: "overdue",
              label: "⚠️ ATRASADOS",
              badge: "border-rose-500/60 bg-rose-950/70 text-rose-200",
              headerBorder: "border-rose-500/40",
              tasks: overdueStrip,
            },
          ]
        : []),
      ...(todayStrip.length > 0
        ? [
            {
              key: "today",
              label: `🔥 HOY · ${todayDateStr.slice(8, 10)}/${todayDateStr.slice(5, 7)}`,
              badge: "border-cyan-500/60 bg-cyan-950/70 text-cyan-200",
              headerBorder: "border-cyan-500/40",
              tasks: todayStrip,
            },
          ]
        : []),
      ...(tomorrowStrip.length > 0
        ? [
            {
              key: "tomorrow",
              label: `📆 MAÑANA · ${tomorrowDateStr.slice(8, 10)}/${tomorrowDateStr.slice(5, 7)}`,
              badge: "border-indigo-500/60 bg-indigo-950/70 text-indigo-200",
              headerBorder: "border-indigo-500/40",
              tasks: tomorrowStrip,
            },
          ]
        : []),
      ...(laterStrip.length > 0
        ? [
            {
              key: "later",
              label: "🗓️ PRÓXIMOS DÍAS",
              badge: "border-amber-500/60 bg-amber-950/70 text-amber-200",
              headerBorder: "border-amber-500/40",
              tasks: laterStrip,
            },
          ]
        : []),
    ];
  }, [orderedStripTasks, todayDateStr, tomorrowDateStr]);

  const moveTask = (taskId: string, direction: "up" | "down", customList?: PendingTaskItem[]) => {
    if (!onReorderTasks) return;
    const currentList =
      customList ||
      (pendingSubTab === "timed"
        ? scheduleViewMode === "relative"
          ? orderedStripTasks
          : timedTasks
        : pendingSubTab === "free"
        ? freeTasks
        : pendingSubTab === "archived"
        ? archivedTasks
        : allViewMode === "strip" || scheduleViewMode === "relative"
        ? orderedStripTasks
        : activeTasks);
    const idx = currentList.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;

    const targetId = currentList[targetIdx].id;
    const pIdx = pendingTasks.findIndex((t) => t.id === taskId);
    const pTargetIdx = pendingTasks.findIndex((t) => t.id === targetId);
    if (pIdx === -1 || pTargetIdx === -1) return;

    const list = [...pendingTasks];
    const [moved] = list.splice(pIdx, 1);
    list.splice(pTargetIdx, 0, moved);
    onReorderTasks(list.map((t) => t.id));
  };

  const handleSortTimedByHour = () => {
    if (!onReorderTasks) return;
    const timed = [...timedTasks].sort((a, b) => extractTaskTime(a, gridInterval).timeMinutes - extractTaskTime(b, gridInterval).timeMinutes);
    const others = pendingTasks.filter((t) => !extractTaskTime(t, gridInterval).hasTime || t.isArchived);
    onReorderTasks([...others, ...timed].map((t) => t.id));
    setFeedback("✓ Ordenado por hora");
  };

  // Función para desfasar el horario en cadena (+30 min / -30 min) sin brincar a las 00:00 de la mañana
  const handleShiftSchedule = (deltaMinutes: number) => {
    const patches: Array<{ id: string; patch: Partial<PendingTaskItem> }> = [];
    timedTasks.forEach((t) => {
      const shifted = shiftTaskSchedule(t, deltaMinutes, gridInterval);
      if (shifted) {
        patches.push({
          id: t.id,
          patch: {
            title: shifted.title,
            isPostMidnight: shifted.isPostMidnight,
            startTime: shifted.startTime,
            endTime: shifted.endTime,
          },
        });
      }
    });
    if (patches.length === 0) return;
    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(patches);
    } else if (onUpdateTask) {
      patches.forEach(({ id, patch }) => onUpdateTask(id, patch));
    } else if (onEditTask) {
      patches.forEach(({ id, patch }) => {
        const orig = timedTasks.find((t) => t.id === id);
        if (orig) onEditTask({ ...orig, ...patch });
      });
    }
    setFeedback(`Horario desfasado ${deltaMinutes > 0 ? `+${deltaMinutes}` : deltaMinutes} min`);
  };

  const overdueTimedCount = useMemo(
    () =>
      timedTasks.filter((t) => {
        if (t.isCompleted || t.isAttended || t.isArchived) return false;
        const info = extractTaskTime(t, gridInterval);
        return info.hasTime && info.endMinutes <= currentTimeMinutes;
      }).length,
    [timedTasks, currentTimeMinutes, gridInterval]
  );

  // Mover una tarjeta específica a una hora destino (Drag & Drop o botón rápido)
  const applyTaskScheduleMove = (task: PendingTaskItem, targetStartMinutes: number) => {
    const moved = moveTaskToMinutes(task, targetStartMinutes, gridInterval);
    const patch: Partial<PendingTaskItem> = {
      title: moved.title,
      isPostMidnight: moved.isPostMidnight,
      startTime: moved.startTime,
      endTime: moved.endTime,
    };
    if (onUpdateTask) {
      onUpdateTask(task.id, patch);
    } else if (onBatchUpdateTasks) {
      onBatchUpdateTasks([{ id: task.id, patch }]);
    } else if (onEditTask) {
      onEditTask({ ...task, ...patch });
    }
    setFeedback(`✓ Movido a ${formatTimeMinutes(moved.timeMinutes)}`);
  };

  const handleDropOnSlot = (e: React.DragEvent, targetStartMinutes: number) => {
    e.preventDefault();
    const sourceId = draggedTaskId || e.dataTransfer.getData("text/plain");
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverSlotStart(null);
    if (!sourceId) return;
    const task = pendingTasks.find((t) => t.id === sourceId);
    if (!task) return;
    applyTaskScheduleMove(task, targetStartMinutes);
  };

  // Recoger bloques atrasados: mode 'all' mueve todos juntos en lote; mode 'last' mueve solo el último atrasado al siguiente hueco libre
  const handleCatchUpOverdue = (mode: "all" | "last" = "all") => {
    const updates = computeCatchUpSchedule(timedTasks, currentTimeMinutes, gridInterval, { mode });
    if (updates.length === 0) {
      setFeedback("Sin bloques atrasados por recoger");
      return;
    }
    const patches = updates.map(({ task, newTitle, startTime, endTime, isPostMidnight }) => ({
      id: task.id,
      patch: {
        title: newTitle,
        isPostMidnight,
        startTime,
        endTime,
      } as Partial<PendingTaskItem>,
    }));
    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(patches);
    } else if (onUpdateTask) {
      patches.forEach(({ id, patch }) => onUpdateTask(id, patch));
    } else if (onEditTask) {
      updates.forEach(({ task }, idx) => onEditTask({ ...task, ...patches[idx].patch }));
    }
    setFeedback(
      mode === "last"
        ? `✓ Último atrasado movido a ${formatTimeMinutes(updates[0].newStartMinutes)}`
        : `✓ ${updates.length} atrasado${updates.length > 1 ? "s" : ""} recogido${updates.length > 1 ? "s" : ""} desde ${formatTimeMinutes(updates[0].newStartMinutes)}`
    );
  };

  const pendingCount = activeTasks.filter((t) => !t.isCompleted).length;

  const handleContextMenu = (e: React.MouseEvent, task: PendingTaskItem) => {
    e.preventDefault();
    setContextMenu({ task, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverSlotStart(null);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverTaskId !== id) setDragOverTaskId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedTaskId || e.dataTransfer.getData("text/plain");
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    if (!sourceId || sourceId === targetId || !onReorderTasks) return;

    const sIdx = pendingTasks.findIndex((t) => t.id === sourceId);
    const tIdx = pendingTasks.findIndex((t) => t.id === targetId);
    if (sIdx === -1 || tIdx === -1) return;

    const list = [...pendingTasks];
    const [moved] = list.splice(sIdx, 1);
    list.splice(tIdx, 0, moved);
    onReorderTasks(list.map((t) => t.id));
  };

  const toggleAttendedState = (task: PendingTaskItem) => {
    const nextAttended = !task.isAttended;
    const patch = buildAttendedStatePatch(task, nextAttended, new Date());
    if (onToggleAttended) {
      onToggleAttended(task.id);
    } else if (onUpdateTask) {
      onUpdateTask(task.id, patch);
    } else if (onEditTask) {
      onEditTask({ ...task, ...patch });
    }
    const timeLabel = nextAttended && patch.completedAt ? calendarTime(patch.completedAt) : "";
    setFeedback(
      nextAttended
        ? isRecurringPendingTask(task)
          ? `✓ Atendido (${timeLabel || "hoy"}) · Se reinicia mañana`
          : `✓ Marcado como atendido${timeLabel ? ` (${timeLabel})` : ""}`
        : "Marcado como pendiente"
    );
  };

  // Render para Pendiente Normal (Arriba, en Ristra Única o dentro del Calendario relativo 1am/2am)
  const renderNormalTaskCard = (
    task: PendingTaskItem,
    options?: { priorityRank?: number; stripList?: PendingTaskItem[]; calendarSlotMode?: boolean }
  ) => {
    const isAttended = Boolean(task.isAttended);
    const isCompleted = Boolean(task.isCompleted);
    const isDimmed = isAttended || isCompleted;
    const isDraggedOver = dragOverTaskId === task.id;
    const isDirect = isDirectlyAssignedToMe(task);
    const isReviewPending = !isAttended && !isCompleted && isReviewOrSentPending(task);
    const isVideoPending = isVideoPendingTask(task);
    const isStarActive = task.isStarred ?? isDirect;
    const timeInfo = extractTaskTime(task, gridInterval);
    const cleanTaskTitle = timeInfo.hasTime
      ? stripLeadingScheduleTime(task.title) || task.title
      : task.title;
    const rank = options?.priorityRank;
    const taskDay = task.scheduledDate ? String(task.scheduledDate).slice(0, 10) : "";

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, task.id)}
        onDrop={(e) => handleDrop(e, task.id)}
        onClick={() => {
          if (task.query || task.title) {
            onSelectTaskQuery?.(task.query || task.title);
          }
        }}
        onDoubleClick={() => {
          onEditTask?.(task);
        }}
        onContextMenu={(e) => handleContextMenu(e, task)}
        className={`p-2 rounded-lg border transition-all relative group flex flex-col gap-1.5 cursor-pointer ${
          isDraggedOver
            ? "border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400/60"
            : isReviewPending
            ? "border-amber-400/85 bg-gradient-to-r from-amber-500/20 via-rose-500/10 to-[#141B26] shadow-[0_0_14px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50 hover:from-amber-500/25"
            : isDirect
            ? "border-sky-300/85 bg-gradient-to-r from-sky-400/20 via-sky-500/10 to-[#141B26] shadow-[0_0_14px_rgba(125,211,252,0.22)] ring-1 ring-sky-300/50 hover:from-sky-400/25"
            : "border-[#1E2836] bg-[#141B26] hover:bg-[#1A2332] hover:border-cyan-500/40"
        } ${isDimmed ? "opacity-40 bg-[#0C121A] grayscale-[30%]" : ""}`}
        title="Clic: filtrar en buscador · Doble clic: editar · Clic derecho: opciones · Arrastra para mover de prioridad"
      >
        {/* Franja superior: Prioridad relativa (#1 · 1:00 AM) + Hora real (si aplica) + Badges */}
        {((rank !== undefined && !options?.calendarSlotMode) || timeInfo.hasTime || isDirect || isReviewPending || task.isStarred) && (
          <div className="flex items-center justify-between gap-1 mb-0.5 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {rank !== undefined && !isDimmed && !options?.calendarSlotMode && (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/90 text-cyan-200 border border-cyan-500/60 flex items-center gap-1 shadow-xs"
                  title={`Prioridad #${rank} en tu ristra (hora relativa simulada ${formatRelativePriorityHour(rank)})`}
                >
                  <span>#{rank}</span>
                  <span className="text-cyan-400/80">·</span>
                  <span>{formatRelativePriorityHour(rank)}</span>
                </span>
              )}
              {timeInfo.hasTime && (
                <span
                  className="px-1.5 py-0.5 rounded text-[8.5px] font-mono font-semibold bg-indigo-950/80 text-indigo-200 border border-indigo-500/50"
                  title={`Horario programado: ${timeInfo.timeBadge}`}
                >
                  🕒 {timeInfo.timeBadge}
                </span>
              )}
              {isReviewPending ? (
                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-amber-500/25 text-amber-100 border border-amber-400/80 flex items-center gap-1 shadow-xs">
                  <Bell className="w-2.5 h-2.5 text-amber-300 animate-bounce shrink-0" />
                  <span>
                    {isVideoPending
                      ? `🎥 VIDEO${task.assignedBy ? ` DE ${task.assignedBy.toUpperCase()}` : ""} · REVISAR`
                      : `ENVIADO${task.assignedBy ? ` POR ${task.assignedBy.toUpperCase()}` : ""} · REVISAR`}
                  </span>
                </span>
              ) : isDirect ? (
                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-sky-400/25 text-sky-100 border border-sky-300/70 flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-2.5 h-2.5 text-sky-200 animate-pulse" />
                  <span>DE {task.assignedBy || "COMPAÑERO"}</span>
                </span>
              ) : null}
            </div>
            {(onUpdateTask || onEditTask) && (isDirect || isReviewPending || task.isStarred) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onUpdateTask) onUpdateTask(task.id, { isStarred: !isStarActive });
                  else onEditTask?.({ ...task, isStarred: !isStarActive });
                  setFeedback(!isStarActive ? "★ Destacado" : "Estrella quitada");
                }}
                className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
                  isStarActive ? "text-amber-300 hover:text-amber-100" : "text-slate-500 hover:text-amber-300"
                }`}
                title={isStarActive ? "Quitar estrella una vez revisado" : "Destacar con estrella"}
              >
                <Star className="w-3 h-3" fill={isStarActive ? "currentColor" : "none"} />
              </button>
            )}
          </div>
        )}

        <div className="flex items-start gap-2">
          {/* Checkbox circular de completado */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTask(task.id);
            }}
            className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center transition-colors cursor-pointer ${
              isCompleted
                ? "bg-[#10B981] border-[#10B981] text-black scale-105"
                : "border-[#475569] hover:border-cyan-400 bg-transparent"
            }`}
            title={isCompleted ? "Marcar como no terminado" : "Marcar como completado"}
            role="checkbox"
            aria-checked={isCompleted}
          >
            {isCompleted && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </button>

          {/* Título y Badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span
                className={`text-[11.5px] font-semibold text-[#F1F5F9] leading-snug break-words ${
                  isCompleted ? "line-through !text-emerald-400" : isAttended ? "line-through !text-cyan-300" : ""
                }`}
              >
                {cleanTaskTitle}
              </span>
            </div>

            {/* Nota visible independiente de la búsqueda */}
            {task.note && (
              <div className="flex items-start gap-1 text-[10px] text-amber-200 my-0.5 bg-amber-500/10 px-1.5 py-1 rounded border border-amber-400/35 font-sans">
                <StickyNote className="w-2.5 h-2.5 text-amber-300 shrink-0 mt-0.5" />
                <span className="break-words">{task.note}</span>
              </div>
            )}

            {/* Descripción opcional */}
            {task.description && (
              <p className="text-[10px] text-slate-400 line-clamp-2 my-0.5 bg-black/20 p-1 rounded border border-slate-800/60 font-sans">
                {task.description}
              </p>
            )}

            {/* Link de Entrega si fue proporcionado */}
            {task.url && (
              <div className="mt-1">
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[9px] text-cyan-300 hover:text-cyan-100 bg-cyan-950/90 px-1.5 py-0.5 rounded border border-cyan-700/60 font-mono truncate max-w-full"
                  title={`Abrir entrega: ${task.url}`}
                >
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{task.url.replace(/^https?:\/\//, '')}</span>
                </a>
              </div>
            )}

            {/* Badges de Asignación, Recurrencia y Fecha */}
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {isRecurringPendingTask(task) && (
                <span
                  className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-cyan-950/90 text-cyan-200 border border-cyan-500/50 flex items-center gap-0.5"
                  title="Bloque recurrente diario: al palomearlo hoy, mañana se reinicia automáticamente"
                >
                  <Repeat className="w-2.5 h-2.5 text-cyan-300" />
                  <span>{isFtfPendingBlock(task) ? "FTF Diario" : "Diario"}</span>
                </span>
              )}
              {isAttended && task.completedAt && (
                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50">
                  ✓ {calendarTime(task.completedAt)}
                </span>
              )}
              {task.assignedTo && (
                <span
                  className="px-1.5 py-0.2 rounded text-[8.5px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 flex items-center gap-0.5"
                  title={`Asignado a: ${task.assignedTo}${task.assignedBy ? ` por ${task.assignedBy}` : ""}`}
                >
                  <UserCheck className="w-2.5 h-2.5 text-cyan-400" />
                  <span>Para: {task.assignedTo}</span>
                  {task.assignedBy && <span className="opacity-75">· De: {task.assignedBy}</span>}
                </span>
              )}
              {task.scheduledDate && (
                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-[#26D97706] text-[#FDE68A] border border-[#F59E0B]/40 font-mono">
                  {formatSmartDate(task.scheduledDate)}
                </span>
              )}
              {task.query && (
                <span className="text-[9px] text-slate-500 truncate max-w-[140px]">
                  🔍 {task.query}
                </span>
              )}
            </div>
          </div>

          {/* Botón Atendido */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleAttendedState(task);
            }}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
              isAttended
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm"
                : "bg-slate-800/80 text-slate-400 hover:text-cyan-200 hover:bg-slate-700 border border-slate-700"
            }`}
            title={isAttended ? "Atendido (clic para desmarcar)" : "Marcar como atendido (se transparenta)"}
          >
            <CheckCircle2 className={`w-2.5 h-2.5 ${isAttended ? "text-cyan-400" : "text-slate-400"}`} />
            <span>{isAttended ? "Atendido" : "Atender"}</span>
          </button>
        </div>

        {/* Acciones Rápidas (Prioridad + Hoy/Mañana + Acciones) */}
        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity border-t border-[#1C2634] pt-1">
          {onReorderTasks && (
            <div className="flex items-center gap-0.5 mr-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  moveTask(task.id, "up", options?.stripList);
                }}
                className="text-[9px] text-slate-300 hover:text-cyan-300 px-1 py-0.5 rounded hover:bg-cyan-950/60 cursor-pointer"
                title="Subir prioridad"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  moveTask(task.id, "down", options?.stripList);
                }}
                className="text-[9px] text-slate-300 hover:text-cyan-300 px-1 py-0.5 rounded hover:bg-cyan-950/60 cursor-pointer"
                title="Bajar prioridad"
              >
                ▼
              </button>
              {(onUpdateTask || onEditTask) && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const patch = { scheduledDate: todayDateStr };
                      if (onUpdateTask) onUpdateTask(task.id, patch);
                      else onEditTask?.({ ...task, ...patch });
                      setFeedback("Movido a Hoy");
                    }}
                    className={`ml-1 px-1 py-0.2 rounded text-[8.5px] font-mono border cursor-pointer transition-colors ${
                      taskDay === todayDateStr
                        ? "border-cyan-400/70 bg-cyan-950/70 text-cyan-200 font-bold"
                        : "border-slate-700 bg-slate-900/70 text-slate-400 hover:text-cyan-200 hover:border-cyan-600"
                    }`}
                    title="Mover a Hoy"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const patch = { scheduledDate: tomorrowDateStr };
                      if (onUpdateTask) onUpdateTask(task.id, patch);
                      else onEditTask?.({ ...task, ...patch });
                      setFeedback("Movido a Mañana");
                    }}
                    className={`px-1 py-0.2 rounded text-[8.5px] font-mono border cursor-pointer transition-colors ${
                      taskDay === tomorrowDateStr
                        ? "border-indigo-400/70 bg-indigo-950/70 text-indigo-200 font-bold"
                        : "border-slate-700 bg-slate-900/70 text-slate-400 hover:text-indigo-200 hover:border-indigo-600"
                    }`}
                    title="Mover a Mañana"
                  >
                    Mañ.
                  </button>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            aria-label="Copiar pendiente"
            className="p-1 text-slate-400 hover:text-cyan-300 cursor-pointer"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await navigator.clipboard.writeText(task.title + (task.description ? `\n${task.description}` : ""));
                setFeedback("Copiado al portapapeles");
              } catch {
                setFeedback("No se pudo copiar");
              }
            }}
            title="Copiar texto"
          >
            📋
          </button>
          {(onUpdateTask || onEditTask) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextReview = !task.needsReview && !task.isReviewNotice;
                const patch: Partial<PendingTaskItem> = {
                  needsReview: nextReview,
                  isReviewNotice: nextReview,
                  ...(nextReview ? { color: "amber" } : {}),
                };
                if (onUpdateTask) onUpdateTask(task.id, patch);
                else onEditTask?.({ ...task, ...patch });
                setFeedback(nextReview ? "🔔 Marcado: Revisar para completar" : "Alerta de revisión quitada");
              }}
              className={`p-1 cursor-pointer transition-colors ${
                isReviewPending ? "text-amber-300 hover:text-amber-100" : "text-slate-400 hover:text-amber-300"
              }`}
              title={isReviewPending ? "Quitar campana / alerta de revisión" : "Marcar con campana: Revisar para completar"}
            >
              <Bell className="w-3 h-3" />
            </button>
          )}
          {onEditTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              className="p-1 text-slate-400 hover:text-cyan-300 cursor-pointer"
              title="Editar pendiente"
            >
              <Edit2 className="w-3 h-3 text-cyan-400" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicateTask(task);
            }}
            className="p-1 text-slate-400 hover:text-cyan-300 cursor-pointer"
            title="Duplicar pendiente"
          >
            <CopyPlus className="w-3 h-3 text-cyan-400" />
          </button>
          {(onUpdateTask || onEditTask) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onUpdateTask) onUpdateTask(task.id, { isArchived: !task.isArchived });
                else onEditTask?.({ ...task, isArchived: !task.isArchived });
                setFeedback(task.isArchived ? "Restaurado" : "Archivado");
              }}
              className="p-1 text-slate-400 hover:text-cyan-400 cursor-pointer"
              title={task.isArchived ? "Restaurar" : "Archivar"}
            >
              <Archive className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(task.id);
            }}
            className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
            title="Eliminar pendiente"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  // Render para Tarjeta de Bloque de Horario (Bento Style) con Transparencia
  const renderTimedScheduleCard = (task: PendingTaskItem, index: number) => {
    const timeInfo = extractTaskTime(task, gridInterval);
    const isAttended = Boolean(task.isAttended);
    const isCompleted = Boolean(task.isCompleted);
    const isPassed = timeInfo.isPassed;
    const isActive = timeInfo.isActive;
    const isReviewPending = !isAttended && !isCompleted && isReviewOrSentPending(task);

    // Regla de transparencia:
    // Si ya pasó la hora -> se transparenta
    // Si lo marca como atendido -> se transparenta inmediatamente, aun así NO haya pasado la hora
    const isTransparent = isAttended || isCompleted || isPassed;

    const colorStyle = getRoutineCardColorStyle(task.title, index, task.color);

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (task.query || task.title) {
            onSelectTaskQuery?.(task.query || task.title);
          }
        }}
        onContextMenu={(e) => handleContextMenu(e, task)}
        className={`p-2.5 rounded-xl border transition-all relative group cursor-pointer ${colorStyle.bg} ${
          isReviewPending
            ? "border-amber-400/85 shadow-[0_0_12px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/50"
            : isActive
            ? "border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.35)] ring-1 ring-cyan-400/50"
            : colorStyle.border
        } ${isTransparent ? "opacity-35 grayscale-[20%]" : "opacity-95 hover:opacity-100 shadow-sm"} ${
          draggedTaskId === task.id ? "opacity-40 ring-1 ring-cyan-400/60" : ""
        }`}
        title={`Horario: ${timeInfo.timeBadge} · Arrastra a otro horario para mover · Clic para buscar · Clic derecho para opciones`}
      >
        {/* Cabecera del Bloque: Hora + Estado */}
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-cyan-300 shrink-0"
              title="Arrastrar a otra hora"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-3 h-3" />
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono border shrink-0 ${colorStyle.badge}`}>
              ⏱️ {timeInfo.timeBadge}
            </span>
            {isRecurringPendingTask(task) && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[8.5px] font-bold border shrink-0 flex items-center gap-0.5 ${
                  isFtfPendingBlock(task)
                    ? "bg-emerald-950/80 text-emerald-200 border-emerald-500/60"
                    : "bg-cyan-950/80 text-cyan-200 border-cyan-500/50"
                }`}
                title="Bloque recurrente diario: mañana vuelve a desmarcarse solo"
              >
                <Repeat className="w-2.5 h-2.5" />
                <span>{isFtfPendingBlock(task) ? "FTF" : "Diario"}</span>
              </span>
            )}
            {isActive && !isAttended && (
              <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-cyan-400 text-black animate-pulse shrink-0">
                ● En curso
              </span>
            )}
            {isPassed && !isAttended && (
              <span className="text-[8.5px] text-slate-400 font-medium shrink-0">Pasado</span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Mover este bloque individual hacia adelante */}
            {timeInfo.hasTime && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  applyTaskScheduleMove(task, timeInfo.timeMinutes + gridInterval);
                }}
                className="px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold bg-slate-900/70 text-cyan-300 hover:bg-cyan-950 hover:text-cyan-200 border border-cyan-700/50 transition-colors cursor-pointer"
                title={`Mover solo esta tarjeta +${gridInterval} min adelante`}
              >
                +{gridInterval}m
              </button>
            )}

            {/* Botón Atendido específico de horario */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleAttendedState(task);
              }}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isAttended
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-sm"
                  : "bg-black/40 text-slate-300 hover:text-white hover:bg-black/60 border border-slate-700/60"
              }`}
              title={isAttended ? "Atendido (clic para desmarcar)" : "Marcar como atendido"}
            >
              <CheckCircle2 className={`w-3 h-3 ${isAttended ? "text-emerald-400" : "text-slate-400"}`} />
              <span>
                {isAttended
                  ? `Atendido${task.completedAt ? ` ${calendarTime(task.completedAt)}` : ""}`
                  : "Marcar atendido"}
              </span>
            </button>
          </div>
        </div>
        {isAttended && isRecurringPendingTask(task) && (
          <div className="mb-1 text-[9px] font-mono text-emerald-300/90 flex items-center gap-1">
            <Repeat className="w-2.5 h-2.5" />
            <span>Completado hoy{task.completedAt ? ` a las ${calendarTime(task.completedAt)}` : ""} · Mañana se reactiva solo</span>
          </div>
        )}
        {isReviewPending && (
          <div className="mb-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/70 text-[9px] font-bold text-amber-200 flex items-center gap-1">
            <Bell className="w-2.5 h-2.5 text-amber-300 animate-bounce shrink-0" />
            <span>
              {isVideoPendingTask(task) ? "🎥 Video enviado · Revisar para completar" : "Enviado · Revisar para completar"}
            </span>
          </div>
        )}

        {/* Título del Bloque (sin prefijo redundante de hora/AM/PM; la hora se muestra en el badge) */}
        <div className="font-bold text-[11.5px] text-white tracking-wide mb-1 leading-snug">
          <span className={isAttended || isCompleted ? "line-through text-slate-300" : ""}>
            {stripLeadingScheduleTime(task.title) || task.query || task.title}
          </span>
        </div>

        {/* Nota visible (no altera la búsqueda) */}
        {task.note && (
          <div className="flex items-start gap-1 text-[10px] text-amber-200 my-1 bg-amber-500/10 px-1.5 py-1 rounded border border-amber-400/35 font-sans">
            <StickyNote className="w-2.5 h-2.5 text-amber-300 shrink-0 mt-0.5" />
            <span className="break-words">{task.note}</span>
          </div>
        )}

        {/* Descripción o notas */}
        {task.description && (
          <p className="text-[10px] text-slate-300/90 line-clamp-2 my-1 bg-black/30 p-1.5 rounded border border-white/5 font-sans">
            {task.description}
          </p>
        )}

        {/* Link de Entrega si fue proporcionado */}
        {task.url && (
          <div className="mt-1">
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[8.5px] text-cyan-200 hover:text-white bg-black/40 px-1 py-0.5 rounded border border-white/10 font-mono truncate max-w-full"
              title={`Abrir entrega: ${task.url}`}
            >
              <ExternalLink className="w-2 h-2 shrink-0" />
              <span className="truncate">{task.url.replace(/^https?:\/\//, '')}</span>
            </a>
          </div>
        )}

        {/* Footer del Bloque con acciones */}
        <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1 pt-1 border-t border-white/10">
          <div className="flex items-center gap-1 truncate">
            {task.assignedTo && (
              <span className="text-cyan-300 font-medium">
                👤 {task.assignedTo}
              </span>
            )}
            {task.query && (
              <span className="truncate opacity-75">🔍 {task.query}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await navigator.clipboard.writeText(task.title);
                  setFeedback("Copiado");
                } catch {}
              }}
              className="hover:text-cyan-300 cursor-pointer p-0.5"
              title="Copiar texto"
            >
              📋
            </button>
            {(onUpdateTask || onEditTask) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextReview = !task.needsReview && !task.isReviewNotice;
                const patch: Partial<PendingTaskItem> = {
                  needsReview: nextReview,
                  isReviewNotice: nextReview,
                  ...(nextReview ? { color: "amber" } : {}),
                };
                if (onUpdateTask) onUpdateTask(task.id, patch);
                else onEditTask?.({ ...task, ...patch });
                setFeedback(nextReview ? "🔔 Marcado: Revisar para completar" : "Alerta de revisión quitada");
              }}
              className={`p-1 cursor-pointer transition-colors ${
                isReviewPending ? "text-amber-300 hover:text-amber-100" : "text-slate-400 hover:text-amber-300"
              }`}
              title={isReviewPending ? "Quitar campana / alerta de revisión" : "Marcar con campana: Revisar para completar"}
            >
              <Bell className="w-3 h-3" />
            </button>
          )}
          {onEditTask && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTask(task);
                }}
                className="hover:text-cyan-300 cursor-pointer p-0.5"
                title="Editar bloque"
              >
                <Edit2 className="w-2.5 h-2.5 text-cyan-300" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicateTask(task);
              }}
              className="hover:text-cyan-300 cursor-pointer p-0.5"
              title="Duplicar bloque"
            >
              <CopyPlus className="w-2.5 h-2.5 text-cyan-300" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(task.id);
              }}
              className="hover:text-red-400 cursor-pointer p-0.5"
              title="Eliminar bloque"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Línea del tiempo en vivo con hora actual del sistema (Color Cian #00E5FF, NO rojo)
  const renderLiveTimelineBar = () => {
    const liveTimeStr = formatTimeMinutes(currentTimeMinutes);

    return (
      <div className="relative my-1.5 py-0.5 flex items-center group select-none">
        {/* Glow horizontal vibrante */}
        <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent shadow-[0_0_10px_#00E5FF]" />
        {/* Badge flotante con la hora en vivo */}
        <div className="relative z-10 mx-auto px-2.5 py-0.5 rounded-full bg-[#071E2F] border border-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.4)] flex items-center gap-1.5 text-[9.5px] font-mono font-bold text-[#00E5FF]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-ping" />
          <span>● {liveTimeStr}</span>
          <span className="text-[8px] uppercase tracking-wider text-cyan-300 font-sans">EN VIVO</span>
        </div>
      </div>
    );
  };

  // Cálculo de los Bloques de Horas para la Cuadrícula Personalizable
  const gridSlots = useMemo(() => {
    let minH = customStartHour;
    let maxH = customEndHour;

    // Asegurar que si hay tareas programadas fuera de las horas elegidas (incluyendo post-medianoche hasta 04:00 +1d), se incluyan para no ocultarlas
    timedTasks.forEach((t) => {
      const info = extractTaskTime(t, gridInterval);
      if (info.hasTime) {
        const h1 = Math.floor(info.timeMinutes / 60);
        const h2 = Math.ceil(info.endMinutes / 60);
        if (h1 < minH) minH = Math.max(0, h1);
        if (h2 > maxH) maxH = Math.min(28, h2);
      }
    });

    const slots: Array<{
      slotStart: number;
      slotEnd: number;
      label: string;
      rangeLabel: string;
      tasks: PendingTaskItem[];
      isPassed: boolean;
      isActive: boolean;
    }> = [];

    const step = gridInterval;
    for (let m = minH * 60; m < maxH * 60; m += step) {
      const sStart = m;
      const sEnd = m + step;
      const slotTasks = timedTasks
        .filter((t) => {
          const info = extractTaskTime(t, gridInterval);
          if (!info.hasTime) return false;
          return info.timeMinutes >= sStart && info.timeMinutes < sEnd;
        })
        .sort((a, b) => extractTaskTime(a, gridInterval).timeMinutes - extractTaskTime(b, gridInterval).timeMinutes);

      const isPassed = currentTimeMinutes >= sEnd;
      const isActive = currentTimeMinutes >= sStart && currentTimeMinutes < sEnd;

      slots.push({
        slotStart: sStart,
        slotEnd: sEnd,
        label: formatSlotHour(sStart),
        rangeLabel: formatSlotRange(sStart, sEnd),
        tasks: slotTasks,
        isPassed,
        isActive,
      });
    }

    return slots;
  }, [timedTasks, currentTimeMinutes, gridInterval, customStartHour, customEndHour]);

  // Panel de Configuración de la Cuadrícula (100% Personalizable)
  const renderGridConfigPanel = () => {
    if (!showGridConfig) return null;

    return (
      <div className="p-2.5 mb-2 rounded-xl bg-[#121A24] border border-cyan-500/40 shadow-2xl space-y-2 select-none">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60">
          <span className="text-[10.5px] font-bold text-cyan-300 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            Configurar Horas de la Cuadrícula
          </span>
          <button
            type="button"
            onClick={() => setShowGridConfig(false)}
            className="text-slate-400 hover:text-white text-xs px-1"
          >
            ✕
          </button>
        </div>

        {/* Presets Rápidos */}
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => {
              setCustomStartHour(8);
              setCustomEndHour(18);
              saveCustomHours(8, 18);
            }}
            className={`px-2 py-0.5 rounded text-[9px] font-medium border transition-colors ${
              customStartHour === 8 && customEndHour === 18
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/60"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
            }`}
          >
            Jornada (08–18h)
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomStartHour(7);
              setCustomEndHour(20);
              saveCustomHours(7, 20);
            }}
            className={`px-2 py-0.5 rounded text-[9px] font-medium border transition-colors ${
              customStartHour === 7 && customEndHour === 20
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/60"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
            }`}
          >
            Extendida (07–20h)
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomStartHour(5);
              setCustomEndHour(23);
              saveCustomHours(5, 23);
            }}
            className={`px-2 py-0.5 rounded text-[9px] font-medium border transition-colors ${
              customStartHour === 5 && customEndHour === 23
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/60"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
            }`}
          >
            Completo (05–23h)
          </button>
        </div>

        {/* Selectores Inicio y Fin */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-[9.5px] font-semibold text-slate-300 mb-1">
              Hora de inicio:
            </label>
            <select
              value={customStartHour}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setCustomStartHour(val);
                saveCustomHours(val, customEndHour);
              }}
              className="w-full bg-[#182230] text-slate-200 border border-slate-700 rounded px-1.5 py-1 text-xs focus:border-cyan-400 focus:outline-none"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h} disabled={h >= customEndHour}>
                  {String(h).padStart(2, "0")}:00 ({h % 12 || 12} {h >= 12 ? "PM" : "AM"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9.5px] font-semibold text-slate-300 mb-1">
              Hora de fin:
            </label>
            <select
              value={customEndHour}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setCustomEndHour(val);
                saveCustomHours(customStartHour, val);
              }}
              className="w-full bg-[#182230] text-slate-200 border border-slate-700 rounded px-1.5 py-1 text-xs focus:border-cyan-400 focus:outline-none"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h + 1} value={h + 1} disabled={h + 1 <= customStartHour}>
                  {String(h + 1).padStart(2, "0")}:00 ({(h + 1) % 12 || 12} {h + 1 >= 12 && h + 1 < 24 ? "PM" : "AM"})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  // Barra compartida del calendario de pendientes (Prioridad 1am/2am vs Horas reales)
  const renderScheduleToolbar = (titleText: string, showMealButton: boolean) => (
    <div className="px-1 space-y-1.5">
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <span className="text-[10.5px] font-bold text-[#00E5FF] whitespace-nowrap">
          {titleText}{" "}
          <span className="text-[9px] text-slate-400 font-normal">
            ({scheduleViewMode === "relative" ? orderedStripTasks.length : timedTasks.length})
          </span>
        </span>
        <div className="flex items-center gap-1 bg-[#101722] p-0.5 rounded-md border border-[#1E2A38] text-[9px]">
          <button
            type="button"
            onClick={() => handleToggleScheduleViewMode("relative")}
            className={`px-1.5 py-0.5 rounded font-semibold transition cursor-pointer ${
              scheduleViewMode === "relative"
                ? "bg-cyan-950/90 text-cyan-200 border border-cyan-500/60"
                : "text-slate-400 hover:text-white"
            }`}
            title="Calendario continuo con horas relativas (1:00 AM, 2:00 AM...) y prioridad móvil para todos tus pendientes"
          >
            📅 1am, 2am ({orderedStripTasks.length})
          </button>
          <button
            type="button"
            onClick={() => handleToggleScheduleViewMode("clock")}
            className={`px-1.5 py-0.5 rounded font-semibold transition cursor-pointer ${
              scheduleViewMode === "clock"
                ? "bg-[#1E293B] text-amber-200 border border-amber-500/60"
                : "text-slate-400 hover:text-white"
            }`}
            title="Cuadrícula por hora real del reloj (8h–19h)"
          >
            ⏱️ Horario ({timedTasks.length})
          </button>
        </div>
      </div>

      {scheduleViewMode === "relative" ? (
        <div className="flex items-center justify-between gap-1 text-[9px] text-slate-400 font-mono">
          <span>Hoy, Mañana y Próximos en calendario por prioridad</span>
          <span title="Arrastra o usa ▲/▼ para cambiar prioridad">Arrastra / ▲▼</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {showMealButton && isNeftali && (
                <button
                  type="button"
                  onClick={() => setShowMealModal(true)}
                  className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    mealBreak.enabled
                      ? "bg-amber-950/70 text-amber-300 border-amber-600/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                  }`}
                  title={`Horario especial · Comida: ${mealBreak.enabled ? `${formatHour12(mealBreak.startHour, mealBreak.startMinute)} – ${formatHour12(mealBreak.endHour, mealBreak.endMinute)}` : "Desactivada"}`}
                >
                  <Utensils className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-[8.5px] font-mono font-bold">Comida</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCatchUpOverdue("all")}
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  overdueTimedCount > 0
                    ? "bg-amber-500/20 text-amber-200 border-amber-400/60 hover:bg-amber-500/30"
                    : "bg-slate-800/70 text-slate-400 border-slate-700 hover:text-white"
                }`}
                title="Recoger TODOS los bloques atrasados juntos en horarios consecutivos"
              >
                Recoger{overdueTimedCount > 0 ? ` (${overdueTimedCount})` : ""}
              </button>
              <button
                type="button"
                onClick={() => handleCatchUpOverdue("last")}
                disabled={overdueTimedCount === 0}
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors whitespace-nowrap ${
                  overdueTimedCount > 0
                    ? "bg-amber-950/60 text-amber-300 border-amber-500/50 hover:bg-amber-900/50 cursor-pointer"
                    : "bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed"
                }`}
                title="Recoger SOLO el último bloque atrasado al siguiente horario libre"
              >
                Último
              </button>
              {onReorderTasks && timedTasks.length > 1 && (
                <button
                  type="button"
                  onClick={handleSortTimedByHour}
                  className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-950/30 text-[9px] font-semibold text-amber-300 hover:bg-amber-900/40 hover:text-amber-100 cursor-pointer whitespace-nowrap"
                  title="Ordenar cronológicamente por hora"
                >
                  Ordenar
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleShiftSchedule(-30)}
                className="px-1.5 py-0.5 rounded bg-[#131D2A] text-[9px] text-cyan-300 hover:bg-cyan-950 border border-cyan-800/60 whitespace-nowrap"
                title="Desfasar todo -30 min"
              >
                -30m
              </button>
              <button
                type="button"
                onClick={() => handleShiftSchedule(30)}
                className="px-1.5 py-0.5 rounded bg-[#131D2A] text-[9px] text-cyan-300 hover:bg-cyan-950 border border-cyan-800/60 whitespace-nowrap"
                title="Desfasar todo +30 min"
              >
                +30m
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded p-0.5">
                <button
                  type="button"
                  onClick={() => handleToggleInterval(60)}
                  className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold transition-colors ${
                    gridInterval === 60 ? "bg-cyan-500/30 text-cyan-300 border border-cyan-600/50" : "text-slate-400 hover:text-white"
                  }`}
                  title="Ver en bloques de 1 hora (ej. 9 a 10, 10 a 11)"
                >
                  1h
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleInterval(30)}
                  className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold transition-colors ${
                    gridInterval === 30 ? "bg-cyan-500/30 text-cyan-300 border border-cyan-600/50" : "text-slate-400 hover:text-white"
                  }`}
                  title="Ver en bloques de media hora (cada 30 min)"
                >
                  30m
                </button>
              </div>
              <button
                type="button"
                onClick={handleToggleHideEmptySlots}
                className={`px-1.5 py-0.5 rounded border text-[8.5px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  hideEmptySlots
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/60"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                }`}
                title={hideEmptySlots ? "Mostrando solo horarios con actividad (clic para ver huecos vacíos)" : "Ocultar horarios vacíos sin actividad"}
              >
                {hideEmptySlots ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{hideEmptySlots ? "Sin vacíos" : "Ver todos"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGridConfig((prev) => !prev)}
                className={`p-1 rounded border transition-colors cursor-pointer ${
                  showGridConfig ? "bg-cyan-500/30 text-cyan-300 border-cyan-500" : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                }`}
                title="Personalizar rango horario (de qué hora empieza a qué hora termina)"
              >
                <SlidersHorizontal className="w-3 h-3" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Calendario relativo continuo (1:00 AM = #1, 2:00 AM = #2, ...) con todos los pendientes Hoy/Mañana
  const renderRelativeCalendarGrid = () => {
    if (orderedStripTasks.length === 0) {
      return (
        <div className="p-3 text-center text-slate-500 text-[10px] bg-slate-900/30 rounded-lg border border-slate-800/40">
          Sin pendientes activos. Presiona &apos;+&apos; para crear uno.
        </div>
      );
    }

    let runningRank = 0;
    return (
      <div className="space-y-3 pt-1">
        {stripSections.map((sec) => (
          <div key={sec.key} className="space-y-1.5">
            <div className={`flex items-center justify-between px-2 py-1 rounded-md border-l-2 bg-[#0E1622] ${sec.headerBorder}`}>
              <span className="text-[10px] font-bold tracking-wide text-slate-200">{sec.label}</span>
              <span className={`px-1.5 py-0.2 rounded border text-[9px] font-mono font-bold ${sec.badge}`}>
                {sec.tasks.length}
              </span>
            </div>

            <div className="space-y-1.5">
              {sec.tasks.map((task) => {
                const isDimmed = Boolean(task.isAttended || task.isCompleted);
                const rank = isDimmed ? undefined : ++runningRank;
                const relHourLabel = rank !== undefined ? formatRelativePriorityHour(rank) : "✓";
                const isDropTarget = dragOverTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    onDragOver={(e) => handleDragOver(e, task.id)}
                    onDrop={(e) => handleDrop(e, task.id)}
                    className={`flex items-stretch gap-2 p-1.5 rounded-xl border transition-all ${
                      isDropTarget
                        ? "border-cyan-400 bg-cyan-950/35 ring-1 ring-cyan-400/60"
                        : isDimmed
                        ? "border-slate-800/40 bg-black/20 opacity-60"
                        : "border-slate-800/80 bg-[#0E141D]/60"
                    }`}
                  >
                    {/* Columna izquierda de Hora Relativa simulada (1:00 AM, 2:00 AM...) */}
                    <div
                      className="w-12 shrink-0 pt-1 flex flex-col items-center select-none"
                      title={
                        rank !== undefined
                          ? `Prioridad #${rank} · Hora relativa simulada ${relHourLabel}`
                          : "Pendiente completado"
                      }
                    >
                      <span
                        className={`font-mono text-[9.5px] font-bold leading-tight text-center ${
                          rank === 1
                            ? "text-[#00E5FF]"
                            : rank !== undefined
                            ? "text-cyan-200"
                            : "text-emerald-400"
                        }`}
                      >
                        {relHourLabel}
                      </span>
                      {rank !== undefined && (
                        <span className="mt-0.5 px-1 rounded bg-cyan-950/90 border border-cyan-600/50 text-[8px] font-mono font-bold text-cyan-300">
                          #{rank}
                        </span>
                      )}
                      <div
                        className={`w-0.5 flex-1 min-h-[14px] my-1 rounded-full ${
                          rank !== undefined ? "bg-cyan-500/40" : "bg-slate-800/60"
                        }`}
                      />
                    </div>

                    {/* Carril de Tarjeta */}
                    <div className="flex-1 min-w-0">
                      {renderNormalTaskCard(task, {
                        priorityRank: rank,
                        stripList: sec.tasks,
                        calendarSlotMode: true,
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Renderizado de la Cuadrícula Completa de Horas
  const renderScheduleGrid = () => {
    if (scheduleViewMode === "relative") {
      return renderRelativeCalendarGrid();
    }

    const isEarlierThanGrid = gridSlots.length > 0 && currentTimeMinutes < gridSlots[0].slotStart;
    const isLaterThanGrid = gridSlots.length > 0 && currentTimeMinutes >= gridSlots[gridSlots.length - 1].slotEnd;
    const currentBucketStart = Math.floor(currentTimeMinutes / gridInterval) * gridInterval;

    const slotsWithMeta = gridSlots.map((slot) => {
      const isMealBreakSlot = isNeftali && mealBreak.enabled && (() => {
        const mealStart = mealBreak.startHour * 60 + (mealBreak.startMinute || 0);
        const mealEnd = mealBreak.endHour * 60 + (mealBreak.endMinute || 0);
        return slot.slotStart >= mealStart && slot.slotStart < mealEnd;
      })();
      const hasContent = slot.tasks.length > 0 || slot.isActive || isMealBreakSlot;
      const allowAsDragTarget = draggedTaskId !== null && slot.slotStart >= currentBucketStart;
      const isVisible = !hideEmptySlots || hasContent || allowAsDragTarget;
      return { slot, isMealBreakSlot, isVisible };
    });

    const visibleSlots = slotsWithMeta.filter((s) => s.isVisible);
    const hiddenEmptyCount = slotsWithMeta.length - visibleSlots.length;

    return (
      <div className="space-y-1.5 pt-1">
        {/* Panel de Configuración Personalizable si está abierto */}
        {renderGridConfigPanel()}

        {hiddenEmptyCount > 0 && (
          <button
            type="button"
            onClick={handleToggleHideEmptySlots}
            className="w-full py-1 px-2 rounded-lg border border-dashed border-slate-700/70 bg-slate-900/40 hover:bg-slate-800/60 hover:border-cyan-500/40 text-[9px] text-slate-400 hover:text-cyan-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Mostrar todos los bloques de horas vacíos"
          >
            <Eye className="w-3 h-3" />
            <span>{hiddenEmptyCount} {hiddenEmptyCount === 1 ? "bloque vacío oculto" : "bloques vacíos ocultos"} · Mostrar todos</span>
          </button>
        )}

        {/* Si la hora actual es anterior a la primera hora del grid */}
        {isEarlierThanGrid && renderLiveTimelineBar()}

        {visibleSlots.map(({ slot, isMealBreakSlot }) => {
          const isDropTarget = dragOverSlotStart === slot.slotStart;
          return (
            <div key={slot.slotStart} className="space-y-1">
              {/* Si la hora en vivo cae dentro de este intervalo */}
              {slot.isActive && renderLiveTimelineBar()}

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverSlotStart !== slot.slotStart) {
                    setDragOverSlotStart(slot.slotStart);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverSlotStart === slot.slotStart) {
                    setDragOverSlotStart(null);
                  }
                }}
                onDrop={(e) => handleDropOnSlot(e, slot.slotStart)}
                className={`flex items-start gap-2 p-1.5 rounded-xl border transition-all ${
                  isDropTarget
                    ? "border-cyan-400 bg-cyan-950/40 shadow-[0_0_12px_rgba(0,229,255,0.28)] ring-1 ring-cyan-400/70"
                    : slot.isActive
                    ? "border-cyan-500/50 bg-cyan-950/20 shadow-[0_0_10px_rgba(0,229,255,0.15)] ring-1 ring-cyan-500/30"
                    : slot.isPassed
                    ? "border-slate-800/40 bg-black/20 opacity-45"
                    : "border-slate-800/70 bg-[#0E141D]/50"
                }`}
              >
                {/* Columna de Hora / Cuadrícula (Izquierda) */}
                <div className="w-10 shrink-0 pt-1 flex flex-col items-center select-none">
                  <span
                    className={`font-mono text-[9.5px] font-bold ${
                      isDropTarget || slot.isActive
                        ? "text-[#00E5FF]"
                        : slot.isPassed
                        ? "text-slate-500"
                        : "text-slate-300"
                    }`}
                  >
                    {slot.label}
                  </span>
                  {slot.slotStart >= 1440 && (
                    <span className="text-[7.5px] font-mono font-bold text-indigo-300 bg-indigo-950/70 px-1 rounded border border-indigo-500/40 mt-0.5">
                      +1d
                    </span>
                  )}
                  <div
                    className={`w-0.5 flex-1 min-h-[20px] my-1 rounded-full ${
                      isDropTarget || slot.isActive ? "bg-cyan-500/60" : "bg-slate-800/70"
                    }`}
                  />
                  <span className="font-mono text-[8px] text-slate-600">
                    {gridInterval === 30 ? ":30" : ""}
                  </span>
                </div>

                {/* Carril de Actividades de la Cuadrícula (Derecha) */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {(() => {
                    if (slot.tasks.length > 0) {
                      return (
                        <>
                          {isMealBreakSlot && (
                            <div className="flex items-center gap-1 text-[8.5px] text-amber-300 bg-amber-950/50 border border-amber-600/40 px-1.5 py-0.5 rounded font-mono">
                              <Utensils className="w-2.5 h-2.5 text-amber-400" />
                              <span>{mealBreak.label} ({slot.rangeLabel})</span>
                            </div>
                          )}
                          {isDropTarget && (
                            <div className="text-[9px] font-mono text-cyan-300 bg-cyan-950/60 border border-dashed border-cyan-400/60 rounded px-2 py-1 text-center">
                              Soltar aquí para mover a {slot.label}
                            </div>
                          )}
                          {slot.tasks.map((task, idx) => renderTimedScheduleCard(task, idx))}
                        </>
                      );
                    }

                    if (isMealBreakSlot) {
                      return (
                        <div
                          onClick={() => setShowMealModal(true)}
                          className="min-h-[38px] rounded-lg border border-dashed border-amber-500/60 bg-gradient-to-r from-amber-950/35 via-orange-950/20 to-amber-950/35 p-2 flex items-center justify-between cursor-pointer hover:bg-amber-950/45 transition-all group/meal shadow-[0_0_12px_rgba(245,158,11,0.12)]"
                          title={`${mealBreak.label} (${slot.rangeLabel}) · Clic para configurar horario`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                              <Utensils className="w-3 h-3" />
                            </div>
                            <div>
                              <span className="text-[10.5px] font-bold text-amber-200 block font-sans">
                                {mealBreak.label}
                              </span>
                              <span className="text-[8.5px] font-mono text-amber-400/80 block">
                                {slot.rangeLabel} · Horario especial reservado
                              </span>
                            </div>
                          </div>
                          <span className="text-[8.5px] text-amber-400/80 group-hover/meal:text-amber-200 font-mono bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                            Ajustar
                          </span>
                        </div>
                      );
                    }

                    /* Bloque Vacío de la Cuadrícula visible como tal */
                    return (
                      <div
                        onClick={() => {
                          const timeStr = formatSlotHour(slot.slotStart);
                          if (onOpenNewTaskModalWithTime) {
                            onOpenNewTaskModalWithTime(timeStr);
                          } else {
                            onOpenNewTaskModal();
                          }
                        }}
                        className={`min-h-[36px] rounded-lg border border-dashed transition-all p-2 flex items-center justify-between cursor-pointer group/empty ${
                          slot.isPassed
                            ? "border-slate-800/50 bg-black/10 hover:border-slate-700 hover:bg-slate-900/30"
                            : slot.isActive
                            ? "border-cyan-500/40 bg-cyan-950/20 hover:border-cyan-400"
                            : "border-slate-800/80 bg-[#0C121A]/40 hover:bg-[#141C28]/80 hover:border-cyan-500/40"
                        }`}
                        title={`Espacio de ${slot.rangeLabel} · Clic para programar actividad`}
                      >
                        <span className="font-mono text-[9px] text-slate-500 group-hover/empty:text-slate-300 transition-colors">
                          {slot.rangeLabel}
                        </span>
                        <span className="opacity-0 group-hover/empty:opacity-100 text-[9px] text-cyan-400 font-medium flex items-center gap-1 transition-opacity">
                          <Plus className="w-2.5 h-2.5" />
                          <span>Agregar bloque</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}

        {/* Si la hora actual es posterior a la última hora del grid */}
        {isLaterThanGrid && renderLiveTimelineBar()}
      </div>
    );
  };

  if (collapsed)
    return (
      <div className="w-10 shrink-0 rounded border border-slate-700 flex flex-col items-center gap-3 py-3 bg-[#0F141C]">
        <button type="button" onClick={togglePanel} aria-label="Expandir pendientes" className="text-cyan-300 font-bold">
          ›
        </button>
        <button
          type="button"
          aria-label="Nuevo pendiente"
          onClick={onOpenNewTaskModal}
          className="text-cyan-400 font-bold"
        >
          +
        </button>
        {onClose && (
          <button type="button" aria-label="Cerrar columna de pendientes" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        )}
        <span>📋</span>
        <span className="rounded-full bg-amber-950 px-1.5 text-[10px] text-amber-300 font-mono">{pendingCount}</span>
      </div>
    );

  return (
    <div
      style={{ width: `${columnWidth}px` }}
      className={`relative shrink-0 h-full bg-[#0B0F15] border border-[#1E2836] rounded-xl p-2.5 flex flex-col select-none text-xs transition-all ${
        isResizing ? "select-none" : ""
      }`}
    >
      {/* Resizer Handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-cyan-500/50 active:bg-cyan-400 z-30 transition-colors flex items-center justify-center group"
        title="Arrastra para ajustar el ancho de la columna"
      >
        <div className="w-0.5 h-12 bg-slate-600 group-hover:bg-cyan-400 rounded-full transition-colors" />
      </div>

      {/* Header General con botón Cerrar y Nuevo */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1E2836] mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={togglePanel} aria-label="Colapsar pendientes" className="text-cyan-300 font-bold hover:text-white">
            ‹
          </button>
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="w-5 h-5 flex items-center justify-center rounded bg-[#161F2C] border border-[#38BDF8] text-[#38BDF8] hover:bg-[#1E293B] text-xs font-bold transition-colors cursor-pointer"
            title="Guardar nuevo pendiente con fecha (+)"
          >
            <Plus className="w-3 h-3" />
          </button>
          <span className="font-bold text-[11px] text-[#F59E0B] tracking-wide">📋 PENDIENTES</span>
        </div>
        <div className="flex items-center gap-1.5">
          {reviewPendingTasks.length + visibleIncomingReviews.length > 0 && (
            <span
              className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/25 text-amber-200 border border-amber-400/70 font-mono flex items-center gap-0.5 animate-pulse"
              title="Pendientes enviados o con video que requieren revisión para completar"
            >
              <Bell className="w-2.5 h-2.5 text-amber-300" />
              <span>{reviewPendingTasks.length + visibleIncomingReviews.length} rev</span>
            </span>
          )}
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#78350F] text-[#FDE68A] border border-[#F59E0B]/50 font-mono">
            {pendingCount}
          </span>
          {onClose && (
            <button
              type="button"
              aria-label="Cerrar columna de pendientes"
              title="Cerrar pendientes"
              onClick={onClose}
              className="rounded px-1 text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Banner de Notificación de Pendientes Asignados por Compañero (Con Entrar y Quitar) */}
      {assignedToMeUnattended.length > 0 && !dismissedNotification && (
        <div className="mb-2 p-2 rounded-lg bg-gradient-to-r from-cyan-950/95 to-blue-950/80 border border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.2)] shrink-0 animate-in fade-in">
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 text-cyan-400 animate-bounce shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-[10.5px] font-bold text-cyan-200 block">
                ¡Tienes {assignedToMeUnattended.length} nuevo{assignedToMeUnattended.length > 1 ? "s" : ""} pendiente{assignedToMeUnattended.length > 1 ? "s" : ""} asignado{assignedToMeUnattended.length > 1 ? "s" : ""}!
              </span>
              <p className="text-[9.5px] text-slate-300 line-clamp-2">
                Asignado por:{" "}
                <span className="font-semibold text-cyan-300">
                  {Array.from(new Set(assignedToMeUnattended.map((t) => t.assignedBy || "Compañero"))).join(", ")}
                </span>
              </p>
              {/* Botón Entrar */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const first = assignedToMeUnattended[0];
                    setDismissedNotification(true);
                    if (first) {
                      if (first.query) onSelectTaskQuery?.(first.query);
                      onEditTask?.(first);
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                  title="Abrir y atender el pendiente asignado"
                >
                  <span>Entrar al pendiente →</span>
                </button>
              </div>
            </div>
            {/* Botón Quitar / Descartar */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDismissedNotification(true);
              }}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition cursor-pointer shrink-0"
              title="Quitar / Descartar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Banner de Revisiones / Videos pendientes por revisar para completar */}
      {reviewPendingTasks.length > 0 && (
        <div className="mb-2 p-2 rounded-lg bg-gradient-to-r from-amber-950/90 to-rose-950/75 border border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.2)] shrink-0">
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 text-amber-300 animate-bounce shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-[10.5px] font-bold text-amber-200 block">
                {reviewPendingTasks.length} pendiente{reviewPendingTasks.length > 1 ? "s" : ""} enviado{reviewPendingTasks.length > 1 ? "s" : ""} por revisar
              </span>
              <p className="text-[9.5px] text-amber-100/80 truncate">
                {reviewPendingTasks[0].title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const first = reviewPendingTasks[0];
                if (first?.query || first?.title) onSelectTaskQuery?.(first.query || first.title);
              }}
              className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9.5px] font-bold shrink-0 cursor-pointer"
              title="Buscar pendiente por revisar"
            >
              Revisar
            </button>
          </div>
        </div>
      )}

      {/* Tabs Selector: Todos, Libres, Horario, Archivados */}
      <div className="flex items-center gap-1 bg-[#141B24] p-0.5 rounded-lg border border-[#1E2836] mb-2 shrink-0">
        <button
          type="button"
          onClick={() => setPendingSubTab("all")}
          className={`flex-1 py-0.5 rounded text-[10px] font-medium transition cursor-pointer text-center ${
            pendingSubTab === "all"
              ? "bg-[#1E293B] text-cyan-300 font-bold border border-cyan-700/60"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Todos ({activeTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setPendingSubTab("free")}
          className={`flex-1 py-0.5 rounded text-[10px] font-medium transition cursor-pointer text-center ${
            pendingSubTab === "free"
              ? "bg-[#1E293B] text-slate-200 font-bold border border-slate-600"
              : "text-slate-400 hover:text-white"
          }`}
          title="Pendientes sin hora fija"
        >
          Libres ({freeTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setPendingSubTab("timed")}
          className={`flex-1 py-0.5 rounded text-[10px] font-medium transition cursor-pointer text-center flex items-center justify-center gap-0.5 ${
            pendingSubTab === "timed"
              ? "bg-[#1E293B] text-amber-300 font-bold border border-amber-600/60"
              : "text-slate-400 hover:text-white"
          }`}
          title="Cuadrícula de Horas y Rutina"
        >
          <span>⏱️</span>
          <span>Horario ({timedTasks.length})</span>
        </button>
        {archivedTasks.length > 0 && (
          <button
            type="button"
            onClick={() => setPendingSubTab("archived")}
            className={`py-0.5 px-1.5 rounded text-[10px] font-medium transition cursor-pointer text-center flex items-center gap-0.5 ${
              pendingSubTab === "archived"
                ? "bg-[#1E293B] text-cyan-300 font-bold border border-cyan-700/60"
                : "text-slate-400 hover:text-white"
            }`}
            title="Archivados"
          >
            <span>📦</span>
            <span>({archivedTasks.length})</span>
          </button>
        )}
      </div>

      {feedback && (
        <div role="status" className="mb-1.5 px-2 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-[10px] flex items-center justify-between gap-1 shrink-0">
          <span className="truncate">{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback("")}
            className="text-emerald-300/70 hover:text-white cursor-pointer"
            title="Ocultar aviso"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      {/* Contenido Principal Scrolleable */}
      <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin pr-0.5 min-h-0">
        {/* VISTA FILTRADA: SOLO LIBRES */}
        {pendingSubTab === "free" && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-300 px-1 flex items-center justify-between">
              <span>📋 PENDIENTES LIBRES ({freeTasks.length})</span>
            </div>
            {freeTasks.map((t) => renderNormalTaskCard(t))}
          </div>
        )}

        {/* VISTA FILTRADA: SOLO HORARIOS / CALENDARIO DE PENDIENTES */}
        {pendingSubTab === "timed" && (
          <div className="space-y-2">
            {renderScheduleToolbar("📅 CALENDARIO DE PENDIENTES", true)}
            {renderScheduleGrid()}
          </div>
        )}

        {/* VISTA FILTRADA: ARCHIVADOS */}
        {pendingSubTab === "archived" && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-400 px-1 py-0.5 flex items-center justify-between">
              <span>📦 PENDIENTES ARCHIVADOS</span>
              <span className="text-[9px] text-slate-500">Pulsa 📦 para restaurar</span>
            </div>
            {archivedTasks.map((t) => renderNormalTaskCard(t))}
          </div>
        )}

        {/* VISTA COMPLETA (ALL): UNA SOLA RISTRA PRIORIZADA (HOY · MAÑANA · PRÓXIMOS) O CUADRÍCULA CLÁSICA */}
        {pendingSubTab === "all" && (
          <>
            <div className="flex items-center justify-between gap-1 px-1 pb-1 border-b border-[#1C2634]">
              <div className="flex items-center gap-1 bg-[#101722] p-0.5 rounded-md border border-[#1E2A38] text-[9.5px]">
                <button
                  type="button"
                  onClick={() => handleToggleAllViewMode("strip")}
                  className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                    allViewMode === "strip"
                      ? "bg-cyan-950/90 text-cyan-200 border border-cyan-500/60"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Ver todos los pendientes en una sola ristra por prioridad y orden relativo (1am, 2am...)"
                >
                  🔢 Una ristra ({orderedStripTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllViewMode("grid")}
                  className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                    allViewMode === "grid"
                      ? "bg-[#1E293B] text-amber-200 border border-amber-500/60"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Ver libres arriba y cuadrícula de horas abajo"
                >
                  ⏱️ Cuadrícula
                </button>
              </div>
              {allViewMode === "strip" && (
                <span className="text-[9px] font-mono text-slate-400" title="Arrastra o usa ▲/▼ para cambiar prioridad">
                  Arrastra / ▲▼
                </span>
              )}
            </div>

            {allViewMode === "strip" ? (
              orderedStripTasks.length > 0 ? (() => {
                let runningRank = 0;
                return (
                  <div className="space-y-3">
                    {stripSections.map((sec) => (
                      <div key={sec.key} className="space-y-1.5">
                        <div className={`flex items-center justify-between px-2 py-1 rounded-md border-l-2 bg-[#0E1622] ${sec.headerBorder}`}>
                          <span className="text-[10px] font-bold tracking-wide text-slate-200">
                            {sec.label}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded border text-[9px] font-mono font-bold ${sec.badge}`}>
                            {sec.tasks.length}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {sec.tasks.map((task) => {
                            const isDimmed = Boolean(task.isAttended || task.isCompleted);
                            const rank = isDimmed ? undefined : ++runningRank;
                            return renderNormalTaskCard(task, {
                              priorityRank: rank,
                              stripList: sec.tasks,
                            });
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })() : (
                <div className="p-3 text-center text-slate-500 text-[10px] bg-slate-900/30 rounded-lg border border-slate-800/40">
                  Sin pendientes activos. Presiona &apos;+&apos; para crear uno.
                </div>
              )
            ) : (
          <>
            {/* 1. SECCIÓN SUPERIOR: LISTA DE PENDIENTES LIBRES Y ASIGNACIONES */}
            {scheduleViewMode === "clock" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-200 px-1 pb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span>📋 PENDIENTES Y ASIGNACIONES</span>
                    <span className="text-[9px] text-slate-400 font-normal">({freeTasks.length})</span>
                  </div>
                </div>
                {freeTasks.length > 0 ? (
                  freeTasks.map((t) => renderNormalTaskCard(t))
                ) : (
                  <div className="p-2.5 text-center text-slate-500 text-[10px] bg-slate-900/30 rounded-lg border border-slate-800/40">
                    Sin tareas libres. Presiona &apos;+&apos; para crear una.
                  </div>
                )}
              </div>
            )}

            {/* 2. SECCIÓN CALENDARIO DE PENDIENTES */}
            <div className={scheduleViewMode === "clock" ? "pt-2 border-t border-[#1C2634] space-y-2" : "space-y-2"}>
              {renderScheduleToolbar("📅 HORARIO & CALENDARIO", true)}
              {renderScheduleGrid()}
            </div>
          </>
            )}
          </>
        )}

        {pendingTasks.length === 0 && visibleIncomingReviews.length === 0 && (
          <div className="h-40 flex flex-col items-center justify-center p-4 text-center text-[#64748B] text-[10.5px]">
            <Calendar className="w-6 h-6 text-[#475569] mb-2 opacity-60" />
            <span>No hay pendientes guardados.</span>
            <span className="mt-1 text-[#94A3B8]">Presiona &apos;+&apos; para programar uno con fecha.</span>
          </div>
        )}

        {/* Revisiones pendientes directas (clic carga el buscador limpio sin duplicar en calendario) */}
        {visibleIncomingReviews.length > 0 && (
          <div className="mt-2 pt-2 border-t border-indigo-500/30 space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                <Bell className="w-3 h-3 text-indigo-300" />
                <span>REVISIONES PENDIENTES ({visibleIncomingReviews.length})</span>
              </span>
            </div>
            {visibleIncomingReviews.slice(0, 6).map((rev) => {
              const cleanQuery = simplifyReviewSearchQuery(rev.activityTitle || rev.title || "");
              return (
                <div
                  key={rev.id}
                  onClick={() => {
                    if (cleanQuery) {
                      onSelectTaskQuery?.(cleanQuery);
                      setFeedback(`🔍 Buscando revisión: ${cleanQuery}`);
                    }
                  }}
                  className="p-2 rounded-lg border border-indigo-400/50 bg-indigo-950/35 hover:bg-indigo-900/45 transition-all cursor-pointer group flex items-start justify-between gap-1.5"
                  title={`Clic para cargar "${cleanQuery}" en el buscador`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-200 block">
                      Tienes una revisión pendiente{rev.authorName ? ` · De ${rev.authorName}` : ""}
                    </span>
                    <span className="text-[11px] font-semibold text-white block truncate mt-0.5">
                      {cleanQuery || rev.activityTitle || rev.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissedReviewIds((prev) => ({ ...prev, [rev.id]: true }));
                    }}
                    className="p-0.5 text-slate-400 hover:text-white rounded cursor-pointer shrink-0"
                    title="Ocultar aviso"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu Flotante */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-50 bg-[#111822] border border-[#253549] rounded-lg shadow-2xl p-1 text-xs min-w-[130px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {onEditTask && (
            <button
              type="button"
              onClick={() => {
                onEditTask(contextMenu.task);
                setContextMenu(null);
              }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] hover:text-[#38BDF8] text-[10.5px] flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3 h-3 text-[#38BDF8]" />
              <span>Editar</span>
            </button>
          )}

          {(onUpdateTask || onEditTask) && (
            <button
              type="button"
              onClick={() => {
                const task = contextMenu.task;
                const nextReview = !task.needsReview && !task.isReviewNotice;
                const patch: Partial<PendingTaskItem> = {
                  needsReview: nextReview,
                  isReviewNotice: nextReview,
                  ...(nextReview ? { color: "amber" } : {}),
                };
                if (onUpdateTask) onUpdateTask(task.id, patch);
                else onEditTask?.({ ...task, ...patch });
                setContextMenu(null);
              }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1E2836] text-amber-300 text-[10.5px] flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3 h-3 text-amber-300" />
              <span>{contextMenu.task.needsReview || contextMenu.task.isReviewNotice ? "Quitar alerta revisión" : "Marcar por revisar 🔔"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              toggleAttendedState(contextMenu.task);
              setContextMenu(null);
            }}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1E2836] text-cyan-300 text-[10.5px] flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            <span>{contextMenu.task.isAttended ? "Desmarcar atendido" : "Marcar atendido"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDeleteTask(contextMenu.task.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-[#EF4444]/20 text-[#EF4444] text-[10.5px] flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3 h-3 text-[#EF4444]" />
            <span>Eliminar</span>
          </button>

          {onDeleteAllTasks && pendingTasks.length > 1 && (
            <>
              <div className="h-px bg-[#26354A] my-1" />
              <button
                type="button"
                onClick={() => {
                  if (confirm("¿Estás seguro de que deseas borrar todos los pendientes?")) {
                    onDeleteAllTasks();
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#EF4444]/20 text-[#EF4444] text-[10.5px] flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-[#EF4444]" />
                <span>Borrar todos</span>
              </button>
            </>
          )}
        </div>
      )}

      {showMealModal && (
        <MealBreakModal
          currentUser={currentUser}
          config={mealBreak}
          isOpen={showMealModal}
          onClose={() => setShowMealModal(false)}
          onSaved={(cfg) => setMealBreak(cfg)}
        />
      )}
    </div>
  );
}

export const PendientesColumn = React.memo(PendientesColumnComponent);
