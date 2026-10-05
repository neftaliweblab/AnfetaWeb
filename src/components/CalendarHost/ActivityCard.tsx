"use client";

import React, { useState, useRef } from "react";
import { Eye, CheckSquare, Tag, ExternalLink } from "lucide-react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { openNotionPage } from "@/services/windowsIntegration";
import { ChecklistPopup } from "./ChecklistPopup";
import { workflowState } from "@/services/activityWorkflow";
import { canEditActivity, isActivityLocked, isDirection } from "@/services/activityPermissions";
import { PERSON_ALIASES, normalizePerson } from "@/services/identityNormalizer";

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
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Safe titles & metadata
  const title = activity?.title || (activity as any)?.Title || "";
  const shortTitle = activity?.shortTitle || (activity as any)?.ShortTitle || title;
  const status = activity?.status || (activity as any)?.Status || "";
  const domain = activity?.domain || (activity as any)?.ParsedDomain || "DOMINIO";

  // Calculate geometry
  const startStr = activity?.start || (activity as any)?.Start;
  const endStr = activity?.end || (activity as any)?.End;
  const startDate = startStr ? new Date(startStr) : new Date();
  const endDate = endStr ? new Date(endStr) : new Date(startDate.getTime() + 3600000);

  const startHour = startDate.getHours() + startDate.getMinutes() / 60;
  const endHour = endDate.getHours() + endDate.getMinutes() / 60;
  const durationHours = Math.max(0.25, (endDate.getTime() - startDate.getTime()) / 3600000);

  const hours = Math.floor(durationHours);
  const minutes = Math.round((durationHours - hours) * 60);
  const durationFormatted = hours > 0 ? (minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`) : `${minutes}m`;

  const top = Math.max(0, (startHour - 8) * pixelsPerHour);
  const height = Math.max(28, durationHours * pixelsPerHour);

  // Styles
  const isUrgent = !!(activity?.isUrgent || title.includes("00"));
  const wf = workflowState(status, title);
  const isCompleted = wf === "completed";
  const isReview = wf === "review";
  const isSuspended = wf === "suspended";

  let phaseLabel = "POR HACER";
  let phaseColor = "#3B2D6B";
  let phaseTextColor = "#C4B5FD";
  let borderColor = "border-[#2A3E50]";
  let bgColor = "bg-[#11161C]";
  let accentColor = "#00A8FF";

  if (isUrgent) {
    borderColor = "border-[#FB7185] shadow-[0_0_10px_rgba(251,113,133,0.3)]";
    bgColor = "bg-[#2B1419]";
    accentColor = "#FB7185";
  } else if (isCompleted) {
    phaseLabel = "TERMINADA";
    phaseColor = "#104E3E";
    phaseTextColor = "#5EEAD4";
    borderColor = "border-[#4ADE80]/70";
    bgColor = "bg-[#10251B]";
    accentColor = "#4ADE80";
  } else if (isReview) {
    phaseLabel = "EN REVISIÓN";
    phaseColor = "#1B4764";
    phaseTextColor = "#7DD3FC";
    borderColor = "border-[#0EA5E9]/70";
    bgColor = "bg-[#0C2233]";
    accentColor = "#38BDF8";
  } else if (isSuspended) {
    phaseLabel = "SUSPENDIDA";
    phaseColor = "#4A3510";
    phaseTextColor = "#FDE047";
    borderColor = "border-[#A855F7]/70";
    bgColor = "bg-[#1F142B]";
    accentColor = "#A855F7";
  } else {
    phaseLabel = "PENDIENTE";
    phaseColor = "#451A03";
    phaseTextColor = "#FDBA74";
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
        style={{
          top: `${top}px`,
          height: `${height}px`,
          width: `calc(${widthPct}% - 4px)`,
          left: `calc(${leftPct}% + 2px)`,
        }}
        className={`absolute rounded border p-1.5 flex flex-col justify-between ${
          editable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        } transition-all select-none overflow-hidden ${bgColor} ${borderColor} ${
          isSelected
            ? "ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30 z-30"
            : "hover:z-20"
        }`}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 overflow-hidden">
              <span
                className="font-mono text-[9px] uppercase font-bold truncate block"
                style={{ color: accentColor }}
              >
                {!editable && <span aria-label="Bloqueada">🔒 </span>}
                {domain}
              </span>
              {overlapTotal > 1 && (
                <span
                  className="shrink-0 px-1 py-0.2 rounded text-[8.5px] font-bold bg-[#3B0764] border border-[#C084FC] text-[#E9D5FF]"
                  title={`Empalme: ${overlapIndex + 1} de ${overlapTotal}`}
                >
                  {overlapIndex + 1}/{overlapTotal}
                </span>
              )}
            </div>
            <h5 className="text-[11px] font-medium text-[#F1F5F9] line-clamp-2 leading-tight mt-0.5">
              {shortTitle}
            </h5>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPopup(!showPopup);
            }}
            className="p-0.5 text-[#94A3B8] hover:text-[#00A8FF] flex-shrink-0"
            title="Ver checklist"
          >
            <Eye className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono text-[#64748B] pt-0.5">
          <span
            title={
              startStr && endStr
                ? `${startStr.slice(11, 16)} – ${endStr.slice(11, 16)}`
                : startStr?.slice(11, 16)
            }
          >
            {startStr?.slice(11, 16) || "08:00"}
            {endStr ? ` – ${endStr.slice(11, 16)}` : ""}
          </span>
          {totalChecklist > 0 && (
            <span className="flex items-center gap-0.5 text-[#4ADE80]">
              <CheckSquare className="w-2.5 h-2.5" />
              {completedChecklist}/{totalChecklist}
            </span>
          )}
          {isUrgent && <span className="text-[#FB7185] font-bold">URGENTE</span>}
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
              onUpdateActivity?.(activity.pageId, {
                status: "rtuzREVISION",
                isCompletedForReview: true,
              });
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#38BDF8] flex items-center gap-2"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Mover a Revisión (rtuz)</span>
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
    </>
  );
}
