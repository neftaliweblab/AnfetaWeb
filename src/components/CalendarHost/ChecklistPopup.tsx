"use client";
import { calendarTime } from "@/services/calendarPresentation";


import React from "react";
import { CheckSquare, MessageSquare, Clock } from "lucide-react";
import { NotionCalendarActivity } from "@/types/anfeta";

interface ChecklistPopupProps {
  activity: NotionCalendarActivity;
  onClose: () => void;
  onToggle?: (item:any)=>void;
  disabled?:boolean;
  message?:string;
}

export function ChecklistPopup({ activity, onClose,onToggle,disabled=false,message='' }: ChecklistPopupProps) {
  const [size, setSize] = React.useState<"small" | "medium" | "large">("medium");
  const total = activity?.checklistTotal ?? 0;
  const completed = activity?.checklistCompleted ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const title = activity?.shortTitle || activity?.title || (activity as any)?.Title || "Actividad";
  const domain = activity?.domain || (activity as any)?.ParsedDomain || "Actividad";

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Checklist de actividad"
      className={`relative z-50 max-h-[90dvh] overflow-y-auto bg-[#111822] border border-[#253549] rounded-xl shadow-2xl p-3.5 text-xs text-[#E2E8F0] space-y-2.5 animate-in fade-in zoom-in-95 duration-100 transition-all ${
        size === "small" ? "w-72 max-w-[90vw]" : size === "large" ? "w-[440px] max-w-[95vw]" : "w-80 max-w-[92vw]"
      }`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={e=>{if(e.key==='Escape')onClose();}}
    >
      <div className="flex items-start justify-between gap-2 border-b border-[#253549] pb-2">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-mono text-[#38BDF8] uppercase truncate block">
            {domain}
          </span>
          <h4 className="font-semibold text-[#F1F5F9] line-clamp-2">
            {title}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center rounded border border-[#253549] bg-[#0E1520] p-0.5 text-[9px] font-mono">
            {(["small", "medium", "large"] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setSize(sz)}
                className={`px-1 py-0.5 rounded cursor-pointer ${
                  size === sz ? "bg-[#0C4A6E] text-[#38BDF8] font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {sz === "small" ? "S" : sz === "large" ? "L" : "M"}
              </button>
            ))}
          </div>
          <button
            autoFocus
            aria-label="Cerrar checklist"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F1F5F9] text-xs font-mono p-1 rounded hover:bg-[#1A2634] cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Checklist Stats */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#94A3B8] flex items-center gap-1">
            <CheckSquare className="w-3.5 h-3.5 text-[#4ADE80]" />
            Checklist v9:
          </span>
          <span className="font-mono text-[#4ADE80]">
            {total > 0 ? `${completed} / ${total} (${pct}%)` : "Sin tareas"}
          </span>
        </div>
        {total > 0 && (
          <div className="w-full h-1.5 bg-[#1B2735] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00A8FF] to-[#4ADE80] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Checklist Items list if available */}
      {activity.checklistItems && activity.checklistItems.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-1 pt-1.5 border-t border-[#253549]/60 scrollbar-thin">
          {activity.checklistItems.map((chk: any, idx: number) => {
            const isDone = Boolean(chk.isChecked);
            return (
              <div key={chk.id || chk.blockId || idx} className="flex items-start gap-1.5 p-1 rounded bg-[#0E1520]/60 text-[10.5px]">
                <input type="checkbox" checked={isDone} disabled={disabled||!onToggle} onChange={()=>onToggle?.(chk)} aria-label={'Completar '+(chk.text||'tarea')} className="shrink-0 mt-0.5 accent-emerald-400"/>
                <span className={`leading-tight ${isDone ? "text-slate-400 line-through opacity-80" : "text-slate-200"}`}>
                  {chk.text || "Tarea sin título"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Time and Status */}
      {message&&<p role="status" className="text-amber-200">{message}</p>}
      <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-mono pt-1">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#38BDF8]" />
          {calendarTime(activity.start)} – {calendarTime(activity.end)}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#18212B] text-[#CBD5E1]">
          {activity.status || "Pendiente"}
        </span>
      </div>
    </div>
  );
}
