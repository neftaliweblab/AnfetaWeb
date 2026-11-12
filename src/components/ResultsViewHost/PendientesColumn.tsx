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
} from "lucide-react";
import { PendingTaskItem } from "@/types/anfeta";
import { formatSmartDate } from "@/lib/dateUtils";
import { normalizePerson } from "@/services/identityNormalizer";
import { playCheckChime, sendWindowsNotification } from "@/services/windowsIntegration";

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

export function extractTaskTime(task: PendingTaskItem): {
  hasTime: boolean;
  timeMinutes: number;
  endMinutes: number;
  timeBadge: string;
  isPassed: boolean;
  isActive: boolean;
} {
  const currentMin = getCurrentMexicoMinutes();
  const title = (task.title || "").trim();

  // 1. Detectar rangos como: "10:00 - 11:30", "10:00 a 11:30", "10 to 11", "5:00-7:00"
  const rangeMatch = title.match(
    /(?:^|\b)(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|a|al|to)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i
  );
  if (rangeMatch) {
    let h1 = parseInt(rangeMatch[1], 10);
    const m1 = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const mer1 = rangeMatch[3]?.toLowerCase();

    let h2 = parseInt(rangeMatch[4], 10);
    const m2 = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0;
    const mer2 = rangeMatch[6]?.toLowerCase() || mer1;

    if (mer1 === "pm" && h1 < 12) h1 += 12;
    if (mer1 === "am" && h1 === 12) h1 = 0;
    if (!mer1 && h1 >= 1 && h1 <= 6) h1 += 12;

    if (mer2 === "pm" && h2 < 12) h2 += 12;
    if (mer2 === "am" && h2 === 12) h2 = 0;
    if (!mer2 && h2 >= 1 && h2 <= 6) h2 += 12;

    const t1 = h1 * 60 + m1;
    let t2 = h2 * 60 + m2;
    if (t2 <= t1) t2 = t1 + 60;

    const b1 = `${h1 % 12 || 12}:${String(m1).padStart(2, "0")}`;
    const b2 = `${h2 % 12 || 12}:${String(m2).padStart(2, "0")} ${h2 >= 12 ? "PM" : "AM"}`;
    return {
      hasTime: true,
      timeMinutes: t1,
      endMinutes: t2,
      timeBadge: `${b1} - ${b2}`,
      isPassed: currentMin >= t2,
      isActive: currentMin >= t1 && currentMin < t2,
    };
  }

  // 2. Formato de hora única: 5.30, 5:30, 5pm, 17:00
  const match = title.match(/(?:^|\b)(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|hrs?|h)?\b/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const meridian = match[3]?.toLowerCase();

    if (hours >= 0 && hours <= 24 && minutes >= 0 && minutes < 60) {
      if (meridian === "pm" && hours < 12) {
        hours += 12;
      } else if (meridian === "am" && hours === 12) {
        hours = 0;
      } else if (!meridian) {
        if (hours >= 1 && hours <= 6) {
          hours += 12;
        }
      }

      const timeMinutes = hours * 60 + minutes;
      const endMinutes = timeMinutes + 60; // 1 hora por defecto
      const dispHours = hours % 12 || 12;
      const dispMeridian = hours >= 12 ? "PM" : "AM";
      const timeBadge = `${dispHours}:${String(minutes).padStart(2, "0")} ${dispMeridian}`;
      return {
        hasTime: true,
        timeMinutes,
        endMinutes,
        timeBadge,
        isPassed: currentMin >= endMinutes,
        isActive: currentMin >= timeMinutes && currentMin < endMinutes,
      };
    }
  }

  if (task.startTime) {
    const p = task.startTime.split(":");
    const h = parseInt(p[0] || "0", 10);
    const m = parseInt(p[1] || "0", 10);
    const startM = h * 60 + m;
    let endM = startM + 60;
    if (task.endTime) {
      const p2 = task.endTime.split(":");
      endM = parseInt(p2[0] || "0", 10) * 60 + parseInt(p2[1] || "0", 10);
    }
    const dispHours = h % 12 || 12;
    const dispMeridian = h >= 12 ? "PM" : "AM";
    return {
      hasTime: true,
      timeMinutes: startM,
      endMinutes: endM,
      timeBadge: `${dispHours}:${String(m).padStart(2, "0")} ${dispMeridian}`,
      isPassed: currentMin >= endM,
      isActive: currentMin >= startM && currentMin < endM,
    };
  }

  if (task.scheduledDate) {
    const timeMatch = task.scheduledDate.match(/T(\d{2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const dispHours = hours % 12 || 12;
      const dispMeridian = hours >= 12 ? "PM" : "AM";
      const tMin = hours * 60 + minutes;
      const eMin = tMin + 60;
      return {
        hasTime: true,
        timeMinutes: tMin,
        endMinutes: eMin,
        timeBadge: `${dispHours}:${String(minutes).padStart(2, "0")} ${dispMeridian}`,
        isPassed: currentMin >= eMin,
        isActive: currentMin >= tMin && currentMin < eMin,
      };
    }
  }

  return { hasTime: false, timeMinutes: 99999, endMinutes: 99999, timeBadge: "", isPassed: false, isActive: false };
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
    const raw = pendingTasks.filter((t) => extractTaskTime(t).hasTime && !t.isArchived);
    return [...raw].sort((a, b) => {
      const aInfo = extractTaskTime(a);
      const bInfo = extractTaskTime(b);
      return aInfo.timeMinutes - bInfo.timeMinutes;
    });
  }, [pendingTasks]);

  // Free tasks: Pendientes libres / normales (Asignados directos hasta arriba)
  const freeTasks = useMemo(() => {
    const raw = pendingTasks.filter((t) => !extractTaskTime(t).hasTime && !t.isArchived);
    return [...raw].sort((a, b) => {
      const aDirect = isDirectlyAssignedToMe(a) ? 1 : 0;
      const bDirect = isDirectlyAssignedToMe(b) ? 1 : 0;
      if (aDirect !== bDirect) return bDirect - aDirect;
      return 0;
    });
  }, [pendingTasks, currentUser]);

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

  const [pendingSubTab, setPendingSubTab] = useState<"all" | "free" | "timed" | "archived">("all");

  const moveTask = (taskId: string, direction: "up" | "down") => {
    if (!onReorderTasks) return;
    const currentList =
      pendingSubTab === "timed"
        ? timedTasks
        : pendingSubTab === "free"
        ? freeTasks
        : pendingSubTab === "archived"
        ? archivedTasks
        : activeTasks;
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
    const timed = [...timedTasks].sort((a, b) => extractTaskTime(a).timeMinutes - extractTaskTime(b).timeMinutes);
    const others = pendingTasks.filter((t) => !extractTaskTime(t).hasTime || t.isArchived);
    onReorderTasks([...others, ...timed].map((t) => t.id));
    setFeedback("Horario ordenado cronológicamente");
  };

  // Función para desfasar el horario en cadena (+30 min / -30 min)
  const handleShiftSchedule = (deltaMinutes: number) => {
    if (!onEditTask) return;
    timedTasks.forEach((t) => {
      const timeInfo = extractTaskTime(t);
      if (timeInfo.hasTime) {
        let newMin = timeInfo.timeMinutes + deltaMinutes;
        if (newMin < 0) newMin += 1440;
        if (newMin >= 1440) newMin -= 1440;
        const nh = Math.floor(newMin / 60);
        const nm = newMin % 60;
        const newTimeStr = `${nh % 12 || 12}:${String(nm).padStart(2, "0")} ${nh >= 12 ? "PM" : "AM"}`;
        const newTitle = t.title.replace(
          /(?:^|\b)(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|hrs?|h)?\b/i,
          newTimeStr
        );
        onEditTask({ ...t, title: newTitle });
      }
    });
    setFeedback(`Horario desfasado ${deltaMinutes > 0 ? `+${deltaMinutes}` : deltaMinutes} min`);
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
    setDraggedTaskId(id);
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
    if (onToggleAttended) {
      onToggleAttended(task.id);
    } else if (onEditTask) {
      onEditTask({ ...task, isAttended: !task.isAttended });
    }
    setFeedback(task.isAttended ? "Marcado como pendiente" : "✓ Marcado como atendido");
  };

  // Render para Pendiente Normal (Arriba)
  const renderNormalTaskCard = (task: PendingTaskItem) => {
    const isAttended = Boolean(task.isAttended);
    const isCompleted = Boolean(task.isCompleted);
    const isDimmed = isAttended || isCompleted;
    const isDraggedOver = dragOverTaskId === task.id;
    const isDirect = isDirectlyAssignedToMe(task);

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
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
            ? "border-cyan-400 bg-cyan-950/40"
            : isDirect
            ? "border-cyan-400/90 bg-gradient-to-r from-cyan-950/70 to-[#141B26] shadow-[0_0_12px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/50"
            : "border-[#1E2836] bg-[#141B26] hover:bg-[#1A2332] hover:border-cyan-500/40"
        } ${isDimmed ? "opacity-40 bg-[#0C121A] grayscale-[30%]" : ""}`}
        title="Clic: filtrar en buscador · Doble clic: editar · Clic derecho: opciones · Arrastra para reordenar"
      >
        {/* Badge distintivo de Asignado Directo */}
        {isDirect && (
          <div className="flex items-center gap-1 mb-0.5">
            <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400 flex items-center gap-1 shadow-xs">
              <Sparkles className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
              <span>ASIGNADO DIRECTO POR {task.assignedBy || "COMPAÑERO"}</span>
            </span>
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
                {task.title}
              </span>
            </div>

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

            {/* Badges de Asignación y Fecha */}
            <div className="flex flex-wrap items-center gap-1 mt-1">
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

        {/* Acciones Rápidas en Hover */}
        <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity border-t border-[#1C2634] pt-1">
          {onReorderTasks && (
            <div className="flex items-center gap-0.5 mr-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  moveTask(task.id, "up");
                }}
                className="text-[9px] text-slate-400 hover:text-cyan-300 px-1 py-0.5 cursor-pointer"
                title="Subir"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  moveTask(task.id, "down");
                }}
                className="text-[9px] text-slate-400 hover:text-cyan-300 px-1 py-0.5 cursor-pointer"
                title="Bajar"
              >
                ▼
              </button>
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
          {onEditTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditTask({ ...task, isArchived: !task.isArchived });
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
    const timeInfo = extractTaskTime(task);
    const isAttended = Boolean(task.isAttended);
    const isCompleted = Boolean(task.isCompleted);
    const isPassed = timeInfo.isPassed;
    const isActive = timeInfo.isActive;

    // Regla de transparencia:
    // Si ya pasó la hora -> se transparenta
    // Si lo marca como atendido -> se transparenta inmediatamente, aun así NO haya pasado la hora
    const isTransparent = isAttended || isCompleted || isPassed;

    const colorStyle = getRoutineCardColorStyle(task.title, index, task.color);

    return (
      <div
        key={task.id}
        onClick={() => {
          if (task.query || task.title) {
            onSelectTaskQuery?.(task.query || task.title);
          }
        }}
        onContextMenu={(e) => handleContextMenu(e, task)}
        className={`p-2.5 rounded-xl border transition-all relative group cursor-pointer ${colorStyle.bg} ${
          isActive
            ? "border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.35)] ring-1 ring-cyan-400/50"
            : colorStyle.border
        } ${isTransparent ? "opacity-35 grayscale-[20%]" : "opacity-95 hover:opacity-100 shadow-sm"}`}
        title={`Horario: ${timeInfo.timeBadge} · Clic para buscar · Clic derecho para opciones`}
      >
        {/* Cabecera del Bloque: Hora + Estado */}
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono border ${colorStyle.badge}`}>
              ⏱️ {timeInfo.timeBadge}
            </span>
            {isActive && !isAttended && (
              <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-cyan-400 text-black animate-pulse">
                ● En curso
              </span>
            )}
            {isPassed && !isAttended && (
              <span className="text-[8.5px] text-slate-400 font-medium">Pasado</span>
            )}
          </div>

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
            <span>{isAttended ? "Atendido" : "Marcar atendido"}</span>
          </button>
        </div>

        {/* Título del Bloque */}
        <div className="font-bold text-[11.5px] text-white tracking-wide mb-1 leading-snug">
          <span className={isAttended || isCompleted ? "line-through text-slate-300" : ""}>
            {task.title}
          </span>
        </div>

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

    // Asegurar que si hay tareas programadas fuera de las horas elegidas, se incluyan para no ocultarlas
    timedTasks.forEach((t) => {
      const info = extractTaskTime(t);
      if (info.hasTime) {
        const h1 = Math.floor(info.timeMinutes / 60);
        const h2 = Math.ceil(info.endMinutes / 60);
        if (h1 < minH) minH = Math.max(0, h1);
        if (h2 > maxH) maxH = Math.min(24, h2);
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
          const info = extractTaskTime(t);
          if (!info.hasTime) return false;
          return info.timeMinutes >= sStart && info.timeMinutes < sEnd;
        })
        .sort((a, b) => extractTaskTime(a).timeMinutes - extractTaskTime(b).timeMinutes);

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

  // Renderizado de la Cuadrícula Completa de Horas
  const renderScheduleGrid = () => {
    const isEarlierThanGrid = gridSlots.length > 0 && currentTimeMinutes < gridSlots[0].slotStart;
    const isLaterThanGrid = gridSlots.length > 0 && currentTimeMinutes >= gridSlots[gridSlots.length - 1].slotEnd;

    return (
      <div className="space-y-1.5 pt-1">
        {/* Panel de Configuración Personalizable si está abierto */}
        {renderGridConfigPanel()}

        {/* Si la hora actual es anterior a la primera hora del grid */}
        {isEarlierThanGrid && renderLiveTimelineBar()}

        {gridSlots.map((slot) => {
          return (
            <div key={slot.slotStart} className="space-y-1">
              {/* Si la hora en vivo cae dentro de este intervalo */}
              {slot.isActive && renderLiveTimelineBar()}

              <div
                className={`flex items-start gap-2 p-1.5 rounded-xl border transition-all ${
                  slot.isActive
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
                      slot.isActive
                        ? "text-[#00E5FF]"
                        : slot.isPassed
                        ? "text-slate-500"
                        : "text-slate-300"
                    }`}
                  >
                    {slot.label}
                  </span>
                  <div
                    className={`w-0.5 flex-1 min-h-[20px] my-1 rounded-full ${
                      slot.isActive ? "bg-cyan-500/60" : "bg-slate-800/70"
                    }`}
                  />
                  <span className="font-mono text-[8px] text-slate-600">
                    {gridInterval === 30 ? ":30" : ""}
                  </span>
                </div>

                {/* Carril de Actividades de la Cuadrícula (Derecha) */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {slot.tasks.length > 0 ? (
                    slot.tasks.map((task, idx) => renderTimedScheduleCard(task, idx))
                  ) : (
                    /* Bloque Vacío de la Cuadrícula visible como tal */
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
                  )}
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

      {feedback && <p role="status" className="text-emerald-300 text-[10px] pb-1 px-1">{feedback}</p>}

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

        {/* VISTA FILTRADA: SOLO HORARIOS (CUADRÍCULA COMPLETA) */}
        {pendingSubTab === "timed" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10.5px] font-bold text-[#00E5FF]">⏱️ CUADRÍCULA DE HORARIO</span>
              <div className="flex items-center gap-1">
                {/* Selector de División: 1h vs 30m */}
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded p-0.5 mr-0.5">
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
                {/* Botón de Ajustes de Rango */}
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
                <button
                  type="button"
                  onClick={() => handleShiftSchedule(-30)}
                  className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-cyan-300 hover:bg-slate-700 border border-slate-700"
                  title="Desfasar todo -30 min"
                >
                  -30m
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftSchedule(30)}
                  className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-cyan-300 hover:bg-slate-700 border border-slate-700"
                  title="Desfasar todo +30 min"
                >
                  +30m
                </button>
                <button
                  type="button"
                  onClick={handleSortTimedByHour}
                  className="text-[9px] text-amber-300 underline hover:text-amber-100"
                  title="Ordenar cronológicamente"
                >
                  Ordenar
                </button>
              </div>
            </div>
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

        {/* VISTA COMPLETA (ALL): ARRIBA PENDIENTES LIBRES, ABAJO CUADRÍCULA DE HORARIO Y LÍNEA DE TIEMPO */}
        {pendingSubTab === "all" && (
          <>
            {/* 1. SECCIÓN SUPERIOR: LISTA DE PENDIENTES LIBRES Y ASIGNACIONES */}
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

            {/* 2. SECCIÓN INFERIOR: CUADRÍCULA DE HORAS CON BLOQUES VACÍOS Y LLENOS */}
            <div className="pt-2 border-t border-[#1C2634] space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-bold text-[#00E5FF]">⏱️ HORARIO & RUTINA</span>
                  <span className="text-[9px] text-slate-400 font-normal">({timedTasks.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Selector de División: 1h vs 30m */}
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded p-0.5 mr-0.5">
                    <button
                      type="button"
                      onClick={() => handleToggleInterval(60)}
                      className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold transition-colors ${
                        gridInterval === 60 ? "bg-cyan-500/30 text-cyan-300 border border-cyan-600/50" : "text-slate-400 hover:text-white"
                      }`}
                      title="Intervalo de 1 hora (ej. 9 a 10, 10 a 11)"
                    >
                      1h
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleInterval(30)}
                      className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold transition-colors ${
                        gridInterval === 30 ? "bg-cyan-500/30 text-cyan-300 border border-cyan-600/50" : "text-slate-400 hover:text-white"
                      }`}
                      title="Intervalo de media hora (cada 30 min)"
                    >
                      30m
                    </button>
                  </div>
                  {/* Botón de Ajustes de Rango */}
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
                  <button
                    type="button"
                    onClick={() => handleShiftSchedule(-30)}
                    className="px-1.5 py-0.5 rounded bg-[#131D2A] text-[9px] text-cyan-300 hover:bg-cyan-950 border border-cyan-800/60"
                    title="Desfasar bloques -30 min"
                  >
                    -30m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftSchedule(30)}
                    className="px-1.5 py-0.5 rounded bg-[#131D2A] text-[9px] text-cyan-300 hover:bg-cyan-950 border border-cyan-800/60"
                    title="Desfasar bloques +30 min"
                  >
                    +30m
                  </button>
                  {onReorderTasks && timedTasks.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSortTimedByHour}
                      className="text-[9px] font-normal text-amber-300 hover:text-amber-100 cursor-pointer underline flex items-center gap-0.5"
                      title="Ordenar cronológicamente por hora"
                    >
                      <span>Ordenar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Cuadrícula de horas estructurada */}
              {renderScheduleGrid()}
            </div>
          </>
        )}

        {pendingTasks.length === 0 && (
          <div className="h-40 flex flex-col items-center justify-center p-4 text-center text-[#64748B] text-[10.5px]">
            <Calendar className="w-6 h-6 text-[#475569] mb-2 opacity-60" />
            <span>No hay pendientes guardados.</span>
            <span className="mt-1 text-[#94A3B8]">Presiona &apos;+&apos; para programar uno con fecha.</span>
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
    </div>
  );
}

export const PendientesColumn = React.memo(PendientesColumnComponent);
