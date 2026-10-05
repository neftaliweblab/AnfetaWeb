"use client";

import React from "react";
import { Calendar } from "lucide-react";
import {
  PERSON_METADATA,
  getPersonColor,
  getPersonInitials,
} from "@/services/identityNormalizer";
import { openNotionPage } from "@/services/windowsIntegration";

interface CalendarColHeaderProps {
  personName: string;
  activityCount: number;
  onSelectPerson?: (person: string) => void;
}

export function CalendarColHeader({
  personName,
  activityCount,
  onSelectPerson,
}: CalendarColHeaderProps) {
  const color = getPersonColor(personName);
  const initials = getPersonInitials(personName);
  const meta = PERSON_METADATA[personName];

  const handleOpenNotion = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = meta?.notionUrl || "https://notion.so/";
    openNotionPage(url);
  };

  return (
    <div
      onClick={() => onSelectPerson?.(personName)}
      className="h-14 bg-[#0F141A] border-b border-[#26323E] px-3 flex items-center justify-between flex-shrink-0 select-none sticky top-0 z-40 shadow-md cursor-pointer hover:bg-[#131A22] transition-colors"
      title={`Ver detalles de actividades y checks de ${personName}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Avatar badge */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-[#080B0F] shadow-sm flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>

        {/* Name and count */}
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-[#F1F5F9] truncate hover:text-[#00A8FF]">
            {personName}
          </h4>
          <span className="text-[10px] font-mono text-[#64748B]">
            {activityCount} {activityCount === 1 ? "tarea" : "tareas"}
          </span>
        </div>
      </div>

      {/* Action button: Notion */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleOpenNotion}
          className="p-1.5 text-[#94A3B8] hover:text-[#00A8FF] hover:bg-[#18212B] rounded transition-colors"
          title={`Abrir calendario Notion de ${personName}`}
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
