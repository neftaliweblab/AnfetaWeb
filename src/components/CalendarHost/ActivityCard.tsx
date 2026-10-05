"use client";

import React, { useState } from "react";
import { Eye, CheckSquare, Copy, History, Tag, ExternalLink } from "lucide-react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { openNotionPage } from "@/services/windowsIntegration";
import { ChecklistPopup } from "./ChecklistPopup";

interface ActivityCardProps {
  activity: NotionCalendarActivity;
  pixelsPerHour: number;
  overlapIndex: number;
  overlapTotal: number;
  onUpdateActivity?: (pageId: string, updates: Partial<NotionCalendarActivity>) => void;
}

export function ActivityCard({
  activity,
  pixelsPerHour,
  overlapIndex,
  overlapTotal,
  onUpdateActivity,
}: ActivityCardProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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
  const durationHours = Math.max(0.5, endHour - startHour);

  const top = Math.max(0, (startHour - 8) * pixelsPerHour);
  const height = Math.max(28, durationHours * pixelsPerHour);

  // Styles
  const isUrgent = !!(activity?.isUrgent || title.includes("00"));
  const isCompleted = !!(activity?.isFinalized || status.includes("zREVISION") || title.includes("zREVISION"));
  const isReview = !!(activity?.isCompletedForReview || status.includes("rtuzREVISION") || title.includes("rtuzREVISION"));
  const isSuspended = !!(activity?.isSuspended || status.includes("sprtuzREVISION") || title.includes("sprtuzREVISION"));

  let borderColor = "border-[#2A3E50]";
  let bgColor = "bg-[#11161C]";
  let accentColor = "#00A8FF";

  if (isUrgent) {
    borderColor = "border-[#FB7185] shadow-[0_0_10px_rgba(251,113,133,0.3)]";
    bgColor = "bg-[#2B1419]";
    accentColor = "#FB7185";
  } else if (isCompleted) {
    borderColor = "border-[#4ADE80]/70";
    bgColor = "bg-[#10251B]";
    accentColor = "#4ADE80";
  } else if (isReview) {
    borderColor = "border-[#0EA5E9]/70";
    bgColor = "bg-[#0C2233]";
    accentColor = "#38BDF8";
  } else if (isSuspended) {
    borderColor = "border-[#A855F7]/70";
    bgColor = "bg-[#1F142B]";
    accentColor = "#A855F7";
  }

  const widthPct = 100 / Math.max(1, overlapTotal);
  const leftPct = overlapIndex * widthPct;

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

  return (
    <>
      <div
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", JSON.stringify({
            pageId: activity.pageId,
            person: activity.person,
            durationHours,
          }));
        }}
        onContextMenu={handleContextMenu}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          width: `calc(${widthPct}% - 4px)`,
          left: `calc(${leftPct}% + 2px)`,
        }}
        onDoubleClick={() => openNotionPage(activity?.pageUrl || (activity as any)?.PageUrl)}
        className={`absolute rounded border p-1.5 flex flex-col justify-between cursor-grab active:cursor-grabbing transition-all hover:z-30 select-none overflow-hidden ${bgColor} ${borderColor}`}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <span
              className="font-mono text-[9px] uppercase font-bold truncate block"
              style={{ color: accentColor }}
            >
              {domain}
            </span>
            <h5 className="text-[11px] font-medium text-[#F1F5F9] line-clamp-2 leading-tight">
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
          <span title={startStr && endStr ? `${startStr.slice(11, 16)} – ${endStr.slice(11, 16)}` : startStr?.slice(11, 16)}>
            {startStr?.slice(11, 16) || "08:00"}{endStr ? ` – ${endStr.slice(11, 16)}` : ""}
          </span>
          {activity.checklistTotal > 0 && (
            <span className="flex items-center gap-0.5 text-[#4ADE80]">
              <CheckSquare className="w-2.5 h-2.5" />
              {activity.checklistCompleted}/{activity.checklistTotal}
            </span>
          )}
          {isUrgent && <span className="text-[#FB7185] font-bold">URGENTE</span>}
        </div>
      </div>

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
          <button
            onClick={() => {
              onUpdateActivity?.(activity.pageId, { status: "rtuzREVISION", isCompletedForReview: true });
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#38BDF8] flex items-center gap-2"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Mover a Revisión (rtuz)</span>
          </button>
          <button
            onClick={() => {
              onUpdateActivity?.(activity.pageId, { status: "zREVISION", isFinalized: true });
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#4ADE80] flex items-center gap-2"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Aprobar (zREVISION)</span>
          </button>
          <button
            onClick={() => {
              onUpdateActivity?.(activity.pageId, { status: "sprtuzREVISION", isSuspended: true });
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#A855F7] flex items-center gap-2"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Suspender (sprtuz)</span>
          </button>
          <button
            onClick={() => {
              onUpdateActivity?.(activity.pageId, { isUrgent: !activity.isUrgent });
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] text-[#FB7185] flex items-center gap-2"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Hacer Urgente (00)</span>
          </button>

          <div className="h-px bg-[#1E2836] my-1" />

          <button
            onClick={() => {
              navigator.clipboard.writeText(activity.pageUrl || "");
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span>Copiar enlace de Notion</span>
          </button>

          <button
            onClick={() => {
              alert(
                `Historial de movimientos para "${shortTitle}":\n` +
                `- Movimientos: ${activity.moveCount || 0}\n` +
                `- Fechas recorridas: ${activity.routeDates?.join(", ") || "Sin movimientos registrados"}`
              );
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1E2836] flex items-center gap-2 text-[#CBD5E1]"
          >
            <History className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span>Ver historial ({activity.moveCount || 0} movs)</span>
          </button>
        </div>
      )}
    </>
  );
}
