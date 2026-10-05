"use client";

import React from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import {
  evaluateLagStatus,
  getForecastStatus,
} from "@/services/progressKpis";
import { normalizePerson, getPersonColor } from "@/services/identityNormalizer";
import { CheckSquare, AlertTriangle, ExternalLink, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { openNotionPage } from "@/services/windowsIntegration";
import { formatSmartDate } from "@/lib/dateUtils";

interface ColaboratorBreakdownProps {
  activities: NotionCalendarActivity[];
}

export function ColaboratorBreakdown({ activities }: ColaboratorBreakdownProps) {
  const getForecastBadge = (forecast: string) => {
    if (forecast === "Terminada según avance actual") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#10251B] text-[#4ADE80] border border-[#4ADE80]/30 font-medium">
          <CheckCircle className="w-2.5 h-2.5" />
          {forecast}
        </span>
      );
    }
    if (forecast === "Sí puede terminar hoy dentro de su horario") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#0B1E2E] text-[#38BDF8] border border-[#38BDF8]/30 font-medium">
          <Clock className="w-2.5 h-2.5" />
          {forecast}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#2B1419] text-[#FB7185] border border-[#FB7185]/30 font-medium">
        <AlertCircle className="w-2.5 h-2.5" />
        {forecast}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none scrollbar-thin">
      {activities.map((act) => {
        const lagStatus = evaluateLagStatus(act);
        const forecast = getForecastStatus(act);
        const person = normalizePerson(act.person);
        const color = getPersonColor(person);

        const pct =
          act.checklistTotal > 0
            ? Math.round(
                (act.todayChecklistCompleted / act.checklistTotal) * 100
              )
            : act.isFinalized
            ? 100
            : 0;

        return (
          <div
            key={act.pageId}
            className={`p-3 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
              lagStatus.isLagging
                ? "bg-[#2B1419]/90 border-[#FB7185]/60"
                : "bg-[#0F141A] border-[#26323E] hover:border-[#2A3E50]"
            }`}
          >
            {/* Left info */}
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span
                className="w-2 h-10 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-mono text-[10px] text-[#38BDF8] uppercase font-semibold">
                    {act.domain || "DOMINIO"}
                  </span>
                  <span className="text-[10px] text-[#64748B] font-mono">
                    · {person}
                  </span>
                  {lagStatus.isLagging && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FB7185]/20 text-[#FB7185] font-bold">
                      <AlertTriangle className="w-3 h-3" /> REZAGO
                    </span>
                  )}
                  {getForecastBadge(forecast)}
                </div>
                <h4 className="text-xs font-semibold text-[#F1F5F9] truncate">
                  {act.shortTitle || act.title}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-[#64748B]">
                  <span>
                    Horario: {act.start?.slice(11, 16) || "—"} – {act.end?.slice(11, 16) || "—"}
                  </span>
                  {act.currentScheduledDate && (
                    <span>· Fecha: {formatSmartDate(act.currentScheduledDate)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right progress & Notion button */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="w-32 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[#94A3B8] flex items-center gap-1">
                    <CheckSquare className="w-3 h-3 text-[#4ADE80]" />
                    {act.todayChecklistCompleted}/{act.checklistTotal}
                  </span>
                  <span className="text-[#F1F5F9] font-bold">{pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#1B2735] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00A8FF] to-[#4ADE80]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => openNotionPage(act.pageUrl)}
                className="p-2 text-[#94A3B8] hover:text-[#00A8FF] hover:bg-[#18212B] rounded border border-[#223848] transition-colors"
                title="Abrir en Notion"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      {activities.length === 0 && (
        <div className="p-8 text-center text-xs text-[#64748B]">
          No hay actividades para mostrar en este criterio
        </div>
      )}
    </div>
  );
}
