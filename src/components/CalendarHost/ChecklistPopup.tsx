"use client";

import React from "react";
import { CheckSquare, MessageSquare, Clock } from "lucide-react";
import { NotionCalendarActivity } from "@/types/anfeta";

interface ChecklistPopupProps {
  activity: NotionCalendarActivity;
  onClose: () => void;
}

export function ChecklistPopup({ activity, onClose }: ChecklistPopupProps) {
  const total = activity?.checklistTotal ?? 0;
  const completed = activity?.checklistCompleted ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const title = activity?.shortTitle || activity?.title || (activity as any)?.Title || "Actividad";
  const domain = activity?.domain || (activity as any)?.ParsedDomain || "Actividad";

  return (
    <div
      className="absolute z-50 w-72 bg-[#111822] border border-[#253549] rounded-lg shadow-2xl p-3 text-xs text-[#E2E8F0] space-y-2.5 animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 border-b border-[#253549] pb-2">
        <div>
          <span className="text-[10px] font-mono text-[#38BDF8] uppercase">
            {domain}
          </span>
          <h4 className="font-semibold text-[#F1F5F9] line-clamp-2">
            {title}
          </h4>
        </div>
        <button
          onClick={onClose}
          className="text-[#64748B] hover:text-[#F1F5F9] text-xs font-mono p-0.5"
        >
          ✕
        </button>
      </div>

      {/* Checklist Stats */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#94A3B8] flex items-center gap-1">
            <CheckSquare className="w-3.5 h-3.5 text-[#4ADE80]" />
            Checklist v9:
          </span>
          <span className="font-mono text-[#4ADE80]">
            {activity.checklistCompleted} / {activity.checklistTotal} ({pct}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#1B2735] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00A8FF] to-[#4ADE80] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Time and Status */}
      <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-mono pt-1">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#38BDF8]" />
          {activity.start?.slice(11, 16)} – {activity.end?.slice(11, 16)}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#18212B] text-[#CBD5E1]">
          {activity.status || "Pendiente"}
        </span>
      </div>
    </div>
  );
}
