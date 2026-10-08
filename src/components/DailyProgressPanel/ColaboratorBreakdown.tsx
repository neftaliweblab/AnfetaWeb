"use client";

import React, { useState } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import {
  evaluateLagStatus,
  getForecastStatus,
} from "@/services/progressKpis";
import { normalizePerson, getPersonColor } from "@/services/identityNormalizer";
import {
  CheckSquare,
  AlertTriangle,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Square,
} from "lucide-react";
import { openNotionPage } from "@/services/windowsIntegration";
import { formatSmartDate } from "@/lib/dateUtils";

interface ColaboratorBreakdownProps {
  activities: NotionCalendarActivity[];
}

export function ColaboratorBreakdown({ activities }: ColaboratorBreakdownProps) {
  // Estado para expandir/colapsar el detalle de checklists por actividad
  const [expandedActIds, setExpandedActIds] = useState<Set<string>>(new Set());

  const toggleExpand = (pageId: string) => {
    setExpandedActIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

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
    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 select-none scrollbar-thin">
      {activities.map((act) => {
        const lagStatus = evaluateLagStatus(act);
        const forecast = getForecastStatus(act);
        const person = normalizePerson(act.person);
        const color = getPersonColor(person);
        const isExpanded = expandedActIds.has(act.pageId);

        const pct =
          act.checklistTotal > 0
            ? Math.round(
                (act.todayChecklistCompleted / act.checklistTotal) * 100
              )
            : act.isFinalized
            ? 100
            : 0;

        const hasCheckDetails = act.completedChecks && act.completedChecks.length > 0;

        return (
          <div
            key={act.pageId}
            className={`rounded-xl border transition-all ${
              lagStatus.isLagging
                ? "bg-[#1F1015]/95 border-[#FB7185]/60 shadow-[0_0_12px_rgba(251,113,133,0.1)]"
                : "bg-[#0E141D] border-[#1E2B3A] hover:border-[#293B4E]"
            }`}
          >
            {/* Cabecera de la Actividad */}
            <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Left info */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span
                  className="w-2 h-10 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10.5px] text-[#38BDF8] bg-[#0A1A28] border border-[#193B57] px-2 py-0.5 rounded uppercase font-bold">
                      {act.domain || "DOMINIO"}
                    </span>
                    <span className="text-[11px] text-[#CBD5E1] font-semibold">
                      · {person}
                    </span>
                    {lagStatus.isLagging && (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#FB7185]/20 text-[#FB7185] border border-[#FB7185]/40 font-bold">
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
                      🕒 Horario: {act.start?.slice(11, 16) || "—"} – {act.end?.slice(11, 16) || "—"}
                    </span>
                    {act.currentScheduledDate && (
                      <span>· Fecha: {formatSmartDate(act.currentScheduledDate)}</span>
                    )}
                    {act.workedMinutes ? (
                      <span className="text-[#38BDF8]">· Trabajado: {act.workedMinutes}m</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Right progress & Actions */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-36 space-y-1">
                  <div className="flex items-center justify-between text-[10.5px] font-mono">
                    <span className="text-[#94A3B8] flex items-center gap-1 font-medium">
                      <CheckSquare className="w-3.5 h-3.5 text-[#4ADE80]" />
                      <span>{act.todayChecklistCompleted}/{act.checklistTotal} checks</span>
                    </span>
                    <span className="text-[#F1F5F9] font-bold">{pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#172230] rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-[#0284C7] via-[#38BDF8] to-[#4ADE80] rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Botón para expandir/ver checks desglosados */}
                <button
                  type="button"
                  onClick={() => toggleExpand(act.pageId)}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    isExpanded
                      ? "bg-[#182B3E] text-[#38BDF8] border-[#0284C7]/60"
                      : "bg-[#121A24] text-[#94A3B8] hover:text-white border-[#202E40]"
                  }`}
                  title="Ver desglose de elementos de checklist"
                >
                  <span className="text-[11px] hidden sm:inline">Desglose</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => openNotionPage(act.pageUrl)}
                  className="p-1.5 text-[#94A3B8] hover:text-[#38BDF8] hover:bg-[#162232] rounded-lg border border-[#202E40] transition-colors cursor-pointer"
                  title="Abrir página en Notion"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Desglose de Checklist Expandido (Paridad 1:1 con WPF) */}
            {isExpanded && (
              <div className="border-t border-[#1C2736] bg-[#0A0E15] p-3 space-y-2 rounded-b-xl animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono">
                  <span>ELEMENTOS DE CHECKLIST DE NOTION</span>
                  <span>{act.todayChecklistCompleted} de {act.checklistTotal} completados hoy</span>
                </div>

                {hasCheckDetails ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                    {act.completedChecks!.map((check, idx) => (
                      <div
                        key={check.id || check.blockId || idx}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs transition-colors ${
                          check.isChecked
                            ? "bg-[#0F1E1B] border-[#103D2E] text-[#E2E8F0]"
                            : "bg-[#10151E] border-[#1A2433] text-[#94A3B8]"
                        }`}
                      >
                        <span className="mt-0.5">
                          {check.isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[#4ADE80]" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-[#64748B]" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`break-words ${check.isChecked ? "line-through opacity-80" : ""}`}>
                            {check.text}
                          </p>
                          {check.editedAt && (
                            <span className="text-[10px] font-mono text-[#64748B] block mt-0.5">
                              Última edición: {check.editedAt.slice(11, 16)} hrs
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-[#64748B] bg-[#0F141C] rounded-lg border border-[#1A2534]">
                    {act.checklistTotal > 0
                      ? `Esta actividad tiene ${act.checklistTotal} items de checklist en Notion (${act.todayChecklistCompleted} marcados hoy). Haz clic en Notion ↗ para interactuar con ellos.`
                      : "Esta actividad no tiene lista de tareas o checklist registrada en su contenido."}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {activities.length === 0 && (
        <div className="p-12 text-center text-xs text-[#64748B]">
          No hay actividades para mostrar en este criterio
        </div>
      )}
    </div>
  );
}
