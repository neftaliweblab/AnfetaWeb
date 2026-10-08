"use client";

import React from "react";
import { Calendar, ListTodo } from "lucide-react";
import {
  PERSON_METADATA,
  JOHN_SECONDARY_ACTIVITIES_URL,
  getPersonColor,
  getPersonInitials,
} from "@/services/identityNormalizer";
import { openNotionPage } from "@/services/windowsIntegration";

interface CalendarColHeaderProps {
  onAction?:(action:string)=>void;
  personName: string;
  activityCount: number;
  checklistPercent?: number;
  totalChecklistItems?: number;
  completedChecklistItems?: number;
  coverageHours?: number;
  onSelectPerson?: (person: string) => void;
}

export function CalendarColHeader({
  personName,
  activityCount,
  checklistPercent = 0,
  totalChecklistItems = 0,
  completedChecklistItems = 0,
  coverageHours = 0,
  onSelectPerson,onAction,
}: CalendarColHeaderProps) {
  const color = getPersonColor(personName);
  const initials = getPersonInitials(personName);
  const meta = PERSON_METADATA[personName];

  const handleOpenNotion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (meta?.notionUrl) openNotionPage(meta.notionUrl);
  };

  return (
    <div
      onClick={() => onSelectPerson?.(personName)}
      className="h-14 bg-[#0F141A] border-b border-[#26323E] px-2.5 flex items-center justify-between flex-shrink-0 select-none sticky top-0 z-40 shadow-md cursor-pointer hover:bg-[#131A22] transition-colors"
      title={`Ver detalles de actividades y checks de ${personName}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Avatar badge with count badge */}
        <div className="relative flex-shrink-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-[#080B0F] shadow-sm"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
          {activityCount > 0 && (
            <span className="absolute -bottom-1 -right-1 px-1 min-w-[15px] h-[15px] rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
              {activityCount}
            </span>
          )}
        </div>

        {/* Name and KPI badges */}
        <div className="min-w-0 flex flex-col justify-center">
          <h4 className="text-xs font-bold text-[#F1F5F9] truncate hover:text-[#00A8FF]">
            {personName}
          </h4>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#162235] border border-[#234261] text-[#38BDF8] font-semibold"
              title={`Checklist: ${completedChecklistItems}/${totalChecklistItems} (${checklistPercent}%)`}
            >
              C: {checklistPercent}%
            </span>
            <span
              className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#1A261E] border border-[#235332] text-[#4ADE80] font-semibold"
              title={`Carga horaria: ${coverageHours.toFixed(1)}h programadas`}
            >
              A: {Math.round((coverageHours / 8) * 100)}%
            </span>
          </div>
        </div>
      </div>

      <details onClick={e=>e.stopPropagation()} className="relative ml-auto" onContextMenu={e=>e.stopPropagation()}><summary aria-label={'Opciones de '+personName} title={'Opciones de '+personName} className="list-none cursor-pointer rounded px-2 py-1 text-slate-300 hover:bg-slate-800">⋯</summary><div className="absolute right-0 top-full z-[100] max-h-[70dvh] w-64 overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-1 shadow-xl">{[['activities','Ver actividades'],['summary','Resumen de '+personName],['team','Resumen general del día'],['return','Devolver actividades al día anterior…'],['progress','Avance diario rápido'],['left','Mover a la izquierda'],['right','Mover a la derecha'],['first','Mover al inicio'],['last','Mover al final'],['small','Ancho pequeño'],['normal','Ancho normal'],['large','Ancho grande'],['reset','Restablecer ancho'],['hide','Ocultar columna']].map(([action,label])=><button key={action} className="block w-full rounded px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800" onClick={e=>{const details=e.currentTarget.closest('details');if(details)details.open=false;onAction?.(action);}}>{label}</button>)}</div></details>
      {/* Action button: Notion */}
      <div className="flex items-center gap-1 shrink-0">
        {meta?.notionUrl && <button
          onClick={handleOpenNotion}
          className="p-1.5 text-[#94A3B8] hover:text-[#00A8FF] hover:bg-[#18212B] rounded transition-colors"
          title={`Abrir calendario Notion de ${personName}`}
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>}
        {personName === "John" && <a href={JOHN_SECONDARY_ACTIVITIES_URL} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 text-[#94A3B8] hover:text-[#38BDF8] rounded" title="Actividades secundarias de John"><ListTodo className="w-3.5 h-3.5" /></a>}
      </div>
    </div>
  );
}
