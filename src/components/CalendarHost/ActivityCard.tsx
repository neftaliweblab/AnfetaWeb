"use client";

import React, { useState, useRef, useMemo } from "react";
import { Eye, CheckSquare, Tag, ExternalLink } from "lucide-react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { openNotionPage } from "@/services/windowsIntegration";
import { ChecklistPopup } from "./ChecklistPopup";
import { workflowState } from "@/services/activityWorkflow";
import { canEditActivity, isActivityLocked, isDirection } from "@/services/activityPermissions";
import { PERSON_ALIASES, normalizePerson } from "@/services/identityNormalizer";
import { SendToReviewModal } from "./SendToReviewModal";

interface ActivityCardProps {
  currentUser: string;
  activity: NotionCalendarActivity;
  pixelsPerHour: number;
  overlapIndex: number;
  overlapTotal: number;
  isSelected?: boolean;
  onSelectActivity?: (activity: NotionCalendarActivity) => void;
  onUpdateActivity?: (pageId: string, updates: Partial<NotionCalendarActivity>) => void;
}

export function ActivityCard({
  activity,
  currentUser,
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

  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Safe titles & metadata
  const title = activity?.title || (activity as any)?.Title || "";
  const shortTitle = activity?.shortTitle || (activity as any)?.ShortTitle || title;
  const status = activity?.status || (activity as any)?.Status || "";
  const domain = activity?.domain || (activity as any)?.ParsedDomain || "DOMINIO";

  // Limpiar título de tecnicismos redundantes como prtuzREVISION, nneft, jjohn, fechas [10OCT], etc.
  const cleanTitle = useMemo(() => {
    let t = shortTitle || title || "";
    // Remover prefijos de fase al inicio (prtuzREVISION, rtuzREVISION, zREVISION, sprtuzREVISION)
    t = t.replace(/^(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION|TERMINADO|TERMINADA|PENDIENTE)\s*/i, "");
    // Remover usuario tag duplicado al inicio (ej. aads 26-, webs 26-)
    t = t.replace(/^(?:aads|webs|seo|maps)\s+\d+[-–]\s*/i, "");
    // Remover tokens de persona o códigos repetitivos
    t = t.replace(/\b(?:jjohn|nneft|nnetf|kkarl|bbria|iisai|iisaia|aandr|ggena|ssote|aacal|eemma)(?:0{2,4}|00[1-3])?\b/gi, "");
    // Limpiar corchetes de fecha si vienen pegados como [10OCT] 8.00 Recurrente -> Recurrente
    t = t.replace(/\[\d+[A-Z]+\]\s*/gi, "");
    t = t.replace(/^\d+(?:\.\d+)?\s+/g, ""); // Remover prefijos numéricos como 8.00 o 15.00
    t = t.replace(/\s+00\s*$/g, ""); // Quitar sufijo 00 de urgente
    t = t.trim();
    return t || shortTitle || title;
  }, [shortTitle, title]);

  // Detección del Tipo de Proyecto (ADS, WEBS, SEO, MAPS, DISENO, SOPORTE, etc.)
  const typeLabel = useMemo(() => {
    const raw = `${title} ${activity?.project || ""}`.toLowerCase();
    if (/\b(?:google\s*ads|ads|campaña|campañas|aads)\b/i.test(raw)) return "ADS";
    if (/\b(?:seo|posicionamiento|keywords|articulos|blog)\b/i.test(raw)) return "SEO";
    if (/\b(?:web|sitio\s*web|wordpress|landing|elementor|hosting|webs)\b/i.test(raw)) return "WEBS";
    if (/\b(?:maps|google\s*maps|ficha|gmb)\b/i.test(raw)) return "MAPS";
    if (/\b(?:diseño|diseno|branding|logo|flyer|grafico)\b/i.test(raw)) return "DISEÑO";
    if (/\b(?:cobranza|cobro|pago|factura)\b/i.test(raw)) return "COBRO";
    if (/\b(?:soporte|ticket|correo|mantenimiento)\b/i.test(raw)) return "SOPORTE";
    return null;
  }, [title, activity?.project]);

  // Parseo horario seguro y exacto (evita descuadre de zona horaria o UTC)
  const startStr = activity?.start || (activity as any)?.Start || "";
  const endStr = activity?.end || (activity as any)?.End || "";

  let startH = 8;
  let startM = 0;
  let endH = 9;
  let endM = 0;

  const startMatch = startStr.match(/T(\d{2}):(\d{2})/);
  if (startMatch) {
    startH = parseInt(startMatch[1], 10);
    startM = parseInt(startMatch[2], 10);
  } else if (startStr) {
    const d = new Date(startStr);
    if (!isNaN(d.getTime())) {
      startH = d.getHours();
      startM = d.getMinutes();
    }
  }

  const endMatch = endStr.match(/T(\d{2}):(\d{2})/);
  if (endMatch) {
    endH = parseInt(endMatch[1], 10);
    endM = parseInt(endMatch[2], 10);
  } else if (endStr) {
    const d = new Date(endStr);
    if (!isNaN(d.getTime())) {
      endH = d.getHours();
      endM = d.getMinutes();
    }
  } else {
    endH = startH + 1;
    endM = startM;
  }

  const startMinute = startH * 60 + startM;
  let endMinute = endH * 60 + endM;
  if (endMinute <= startMinute) endMinute = startMinute + 60;

  const durationMinutes = Math.max(15, endMinute - startMinute);
  const durationHours = durationMinutes / 60;
  const hours = Math.floor(durationHours);
  const minutes = durationMinutes % 60;
  const durationFormatted = hours > 0 ? (minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`) : `${minutes}m`;

  const top = Math.max(0, ((startMinute - 8 * 60) / 60) * pixelsPerHour);
  const height = Math.max(34, (durationMinutes / 60) * pixelsPerHour);

  // Workflow, Letra Insignia y Estilos sobrios con colores balanceados (sin saturación chillona)
  const isUrgent = !!(activity?.isUrgent || title.includes("00"));
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

  // Hover handlers with 150ms gentle delay
  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const left =
          rect.right + 12 + 320 > window.innerWidth
            ? Math.max(10, rect.left - 330)
            : rect.right + 12;
        const top = Math.min(window.innerHeight - 240, Math.max(12, rect.top));
        setHoverPos({ x: left, y: top });
        setShowHover(true);
      }
    }, 150);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setShowHover(false);
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

  return (
    <>
      <div
        ref={cardRef}
        draggable={editable}
        title={
          editable
            ? undefined
            : isActivityLocked(activity)
            ? "Actividad bloqueada"
            : "Solo el responsable asignado puede mover esta actividad"
        }
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
              {!editable && <span aria-label="Bloqueada" className="text-[10px]">🔒 </span>}
              {domain}
            </span>

            {/* Indicador de colisión de horario */}
            {overlapTotal > 1 && (
              <span
                className="shrink-0 px-1 py-0.2 rounded text-[8px] font-bold bg-[#3B0764] border border-[#C084FC] text-[#E9D5FF]"
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
              className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#14532D] border border-[#22C55E]/50 text-[#86EFAC] hover:bg-[#166534] transition-colors cursor-pointer"
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
            {cleanTitle}
          </h5>
        </div>

        {/* Fila Inferior: Horario + Duración (ej: 09:00 - 10:00 · 1H) */}
        <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400 pt-0.5 border-t border-[#26262B]/50">
          <span className="truncate">
            {startMatch ? `${startMatch[1]}:${startMatch[2]}` : startStr.slice(11, 16) || "08:00"}
            {endMatch ? ` - ${endMatch[1]}:${endMatch[2]}` : endStr ? ` - ${endStr.slice(11, 16)}` : ""}
            <span className="text-slate-500 ml-1">· {durationFormatted.toUpperCase()}</span>
          </span>
          {isUrgent && <span className="text-[#FB7185] font-black text-[9px] tracking-wide">00 URGENTE</span>}
        </div>
      </div>

      {/* Hover Preview Popover */}
      {showHover && hoverPos && (
        <div
          style={{ top: `${hoverPos.y}px`, left: `${hoverPos.x}px` }}
          className="fixed z-[100] w-80 rounded-xl border border-[#2B3B4E] bg-[#0E1520]/95 backdrop-blur-md p-3.5 shadow-2xl text-xs text-[#E2E8F0] space-y-2.5 pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95"
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
            <div className="flex items-center gap-1 shrink-0">
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

          {/* Metadata */}
          <div className="rounded-lg bg-[#141E2B] p-2 space-y-1.5 text-[11px] border border-[#1E2E40]">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Responsable:</span>
              <span className="font-medium text-slate-100">
                {activity.person || "Sin asignar"}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Horario:</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {startStr?.slice(11, 16) || "08:00"}
                {endStr ? ` – ${endStr.slice(11, 16)}` : ""} ({durationFormatted})
              </span>
            </div>
            {totalChecklist > 0 && (
              <div className="pt-1 border-t border-[#1E2E40] space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <CheckSquare className="w-3 h-3 text-emerald-400" />
                    Checklist:
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {completedChecklist} / {totalChecklist} ({pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0D1520]">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Tips */}
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-0.5">
            <span>💡 Clic para ver tareas</span>
            <span className="text-sky-400 font-medium">↗ Doble clic Notion</span>
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
          onConfirm={(targetReviewer, leaveVisualCopy) => {
            setShowReviewModal(false);
            onUpdateActivity?.(activity.pageId, {
              status: "rtuzREVISION",
              reviewer: targetReviewer,
              leaveVisualCopy,
            } as any);
          }}
        />
      )}
    </>
  );
}
