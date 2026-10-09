"use client";

import { calendarDisplayTitle, calendarType, calendarUrgent, calendarInterval, calendarTime } from "@/services/calendarPresentation";
import React, { useState, useRef, useMemo } from "react";
import { Eye, CheckSquare, Tag, ExternalLink, Calendar, Clock, CheckCircle2, ListTodo, Maximize2, Minimize2, ChevronDown, ChevronUp } from "lucide-react";
import { formatSmartDate } from "@/lib/dateUtils";
import { NotionCalendarActivity } from "@/types/anfeta";
import { openNotionPage } from "@/services/windowsIntegration";
import { ChecklistPopup } from "./ChecklistPopup";
import { workflowState } from "@/services/activityWorkflow";
import { canEditActivity, isActivityLocked, isDirection, isReviewer } from "@/services/activityPermissions";
import { PERSON_ALIASES, normalizePerson } from "@/services/identityNormalizer";
import { SendToReviewModal } from "./SendToReviewModal";

interface ActivityCardProps {
  currentUser: string;
  displayDate?: string;
  activity: NotionCalendarActivity;
  pixelsPerHour: number;
  overlapIndex: number;
  overlapTotal: number;
  isSelected?: boolean;
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
  isSelected,
  onSelectActivity,
  onUpdateActivity,
}: ActivityCardProps) {
  const editable = canEditActivity(currentUser, activity);
  const [showPopup, setShowPopup] = useState(false);
  const [showHover, setShowHover] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
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

  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

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
  const height = Math.max(34, (durationMinutes / 60) * pixelsPerHour);

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

  const widthPct = 100 / Math.max(1, overlapTotal);
  const leftPct = overlapIndex * widthPct;

  const totalChecklist = activity.checklistTotal ?? 0;
  const completedChecklist = activity.checklistCompleted ?? 0;
  const pct = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  // Hover handlers with gentle delay and bridge support so the user can mouse over the modal without it disappearing
  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const expectedWidth = popoverSize === "small" ? 340 : popoverSize === "large" ? 520 : popoverSize === "xl" ? 640 : 420;
        const fitsRight = rect.right + 14 + expectedWidth <= window.innerWidth;
        const left = fitsRight
          ? rect.right + 12
          : Math.max(12, rect.left - expectedWidth - 12);
        const top = Math.min(Math.max(12, window.innerHeight - 440), Math.max(12, rect.top - 20));
        setHoverPos({ x: left, y: top });
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
    if (!editable) return;
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
        draggable={editable}
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
        onDoubleClick={() =>
          openNotionPage(activity?.pageUrl || (activity as any)?.PageUrl)
        }
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        data-activity-card="true"
        style={{
          top: `${top}px`,
          height: `${height}px`,
          width: `calc(${widthPct}% - 4px)`,
          left: `calc(${leftPct}% + 2px)`,
        }}
        className={`absolute rounded-md border p-2 flex flex-col justify-between ${
          editable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        } transition-all select-none overflow-hidden ${cardBg} ${cardBorder} ${
          isSelected
            ? "ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.4)] z-30"
            : "hover:z-20 hover:border-slate-500 shadow-sm"
        }`}
      >
        {/* Fila Superior: Badge P/R/T/S + Dominio + Overlap + Checklist Pill */}
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
              <span className="shrink-0 px-1 py-0.2 rounded text-[8.5px] font-bold font-mono bg-[#1E293B] border border-[#38BDF8]/40 text-[#38BDF8] tracking-wider">
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
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
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
            {activity.isReviewMirror && <span className="mr-1 rounded border border-cyan-800 bg-cyan-950/50 px-1 text-[9px] font-semibold text-cyan-200" title="Copia visual de seguimiento. La actividad original está con el revisor; esta copia no se puede mover ni editar.">COPIA REVISIÓN</span>}
            {cleanTitle}
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
          style={{ top: `${hoverPos.y}px`, left: `${hoverPos.x}px` }}
          className={`fixed z-[100] rounded-xl border border-[#2B3B4E] bg-[#0E1520]/95 backdrop-blur-md p-4 shadow-2xl text-xs text-[#E2E8F0] space-y-2.5 pointer-events-auto transition-all duration-150 animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto scrollbar-thin ${
            popoverSize === "small"
              ? "w-80 max-w-[92vw]"
              : popoverSize === "large"
              ? "w-[480px] max-w-[94vw]"
              : popoverSize === "xl"
              ? "w-[620px] max-w-[96vw]"
              : "w-96 max-w-[93vw]"
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
              <span className="font-medium text-slate-100">
                {activity.person || "Sin asignar"}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Horario programado:</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {calendarTime(startStr)}
                {endStr ? ` – ${calendarTime(endStr)}` : ""} ({durationFormatted})
              </span>
            </div>

            {/* Resumen de Checks e Historial Hoy (Anfeta Original Parity) */}
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
                    {(activity.todayChecklistCompleted ?? 0) > 0 && (
                      <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                        +{activity.todayChecklistCompleted} hoy
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
                {((activity.checklistItems && activity.checklistItems.length > 0) || (activity.completedChecks && activity.completedChecks.length > 0)) && (
                  <div className={`mt-2 pt-1.5 border-t border-[#1E2E40]/60 space-y-1 overflow-y-auto pr-0.5 scrollbar-thin ${
                    showAllChecks || popoverSize === "xl" ? "max-h-72" : "max-h-40"
                  }`}>
                    {(activity.checklistItems || activity.completedChecks || []).slice(0, showAllChecks || popoverSize === "xl" ? undefined : 6).map((chk: any, idx: number) => {
                      const isDone = Boolean(chk.isChecked);
                      const addedDate = chk.createdAt ? formatSmartDate(chk.createdAt) : null;
                      const doneDate = chk.markedAt || chk.editedAt ? formatSmartDate(chk.markedAt || chk.editedAt) : null;

                      return (
                        <div
                          key={chk.id || chk.blockId || idx}
                          className="flex items-start justify-between gap-2 p-1.5 rounded bg-[#0D1520]/70 border border-[#1E2A38]/60 text-[10.5px]"
                        >
                          <div className="flex items-start gap-1.5 min-w-0 flex-1">
                            {isDone ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <ListTodo className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            )}
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
                openNotionPage(activity?.pageUrl || (activity as any)?.PageUrl);
              }}
              className="text-sky-400 hover:underline font-medium cursor-pointer"
            >
              ↗ Abrir en Notion
            </button>
          </div>
        </div>
      )}

      {showPopup && (
        <div
          style={{ top: `${top + 10}px`, left: `calc(${leftPct}% + 10px)` }}
          className="fixed z-50"
        >
          <ChecklistPopup activity={activity} onClose={() => setShowPopup(false)} />
        </div>
      )}

      {/* Right Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-56 bg-[#111822] border border-[#253549] rounded-lg shadow-2xl py-1 text-xs text-[#E2E8F0] select-none"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-mono text-[#64748B] border-b border-[#1E2836]">
            ACCIONES DE ACTIVIDAD
          </div>
          {isDirection(currentUser) && (
            <label className="block px-3 py-2 text-[10px] text-cyan-300">
              Reasignar responsable
              <select
                aria-label="Reasignar responsable"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-xs"
                value={normalizePerson(activity.person)}
                onChange={(e) => {
                  onUpdateActivity?.(activity.pageId, { person: e.target.value });
                  closeContextMenu();
                }}
              >
                {Object.keys(PERSON_ALIASES).map((person) => (
                  <option key={person}>{person}</option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={() => {
              closeContextMenu();
              setShowReviewModal(true);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#38BDF8] flex items-center gap-2"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Mover a Revisión (rtuz)...</span>
          </button>
          <button
            disabled={!editable || !isReviewer(currentUser) || (activity.reviewFlow?.State === 'pending' && normalizePerson(currentUser) !== normalizePerson(activity.reviewFlow.ReviewAssignee))}
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
            <span>Finalizar Actividad (zREVISION)</span>
          </button>
          <button
            onClick={() => {
              openNotionPage(activity?.pageUrl || (activity as any)?.PageUrl);
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#94A3B8] flex items-center gap-2 border-t border-[#1E2836] mt-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir en Notion Web</span>
          </button>
        </div>
      )}

      {/* Modal de selección de Revisor (John, Isaías, Genaro) */}
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
    </>
  );
}
