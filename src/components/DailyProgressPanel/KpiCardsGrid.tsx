"use client";

import React from "react";
import { DailyProgressKPIs } from "@/types/anfeta";
import { TrendingUp, AlertTriangle, Eye, CheckCircle2, HelpCircle } from "lucide-react";

interface KpiCardsGridProps {
  kpis: DailyProgressKPIs;
}

export function KpiCardsGrid({ kpis }: KpiCardsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 select-none">
      {/* Cobertura Ponderada */}
      <div className="p-3 rounded-lg bg-[#0F141A] border border-[#26323E] flex flex-col justify-between">
        <div className="flex items-center justify-between text-[#94A3B8] text-[11px]">
          <span>Cobertura Total</span>
          <TrendingUp className="w-3.5 h-3.5 text-[#00A8FF]" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-[#00A8FF]">
            {kpis.coveragePercentage}%
          </div>
          <div className="w-full h-1.5 bg-[#1B2735] rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-[#00A8FF]"
              style={{ width: `${Math.min(100, kpis.coveragePercentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actividades Totales */}
      <div className="p-3 rounded-lg bg-[#0F141A] border border-[#26323E] flex flex-col justify-between">
        <span className="text-[#94A3B8] text-[11px]">Actividades</span>
        <div className="mt-2 text-xl font-bold font-mono text-[#F1F5F9]">
          {kpis.totalActivities}
        </div>
        <span className="text-[10px] font-mono text-[#64748B]">
          {kpis.scheduledMinutes} min programados · Actual: {kpis.currentProgressPercentage ?? 0}%
        </span>
      </div>

      {/* Rezagos Detectados */}
      <div className="p-3 rounded-lg bg-[#2B1419] border border-[#FB7185]/40 flex flex-col justify-between">
        <div className="flex items-center justify-between text-[#FB7185] text-[11px] font-semibold">
          <span>Rezagadas</span>
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
        <div className="mt-2 text-xl font-bold font-mono text-[#FB7185]">
          {kpis.laggingCount}
        </div>
        <span className="text-[10px] font-mono text-[#FB7185]/80">
          Avance &lt;33% tras límite
        </span>
      </div>

      {/* En Revisión */}
      <div className="p-3 rounded-lg bg-[#0C2233] border border-[#0EA5E9]/40 flex flex-col justify-between">
        <div className="flex items-center justify-between text-[#38BDF8] text-[11px] font-semibold">
          <span>En Revisión</span>
          <Eye className="w-3.5 h-3.5" />
        </div>
        <div className="mt-2 text-xl font-bold font-mono text-[#38BDF8]">
          {kpis.reviewCount}
        </div>
        <span className="text-[10px] font-mono text-[#38BDF8]/80">
          rtuzREVISION
        </span>
      </div>

      {/* Finalizadas */}
      <div className="p-3 rounded-lg bg-[#10251B] border border-[#4ADE80]/40 flex flex-col justify-between">
        <div className="flex items-center justify-between text-[#4ADE80] text-[11px] font-semibold">
          <span>Finalizadas</span>
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
        <div className="mt-2 text-xl font-bold font-mono text-[#4ADE80]">
          {kpis.completedCount}
        </div>
        <span className="text-[10px] font-mono text-[#4ADE80]/80">
          zREVISION
        </span>
      </div>

      {/* Datos Faltantes */}
      <div className="p-3 rounded-lg bg-[#0F141A] border border-[#26323E] flex flex-col justify-between">
        <div className="flex items-center justify-between text-[#94A3B8] text-[11px]">
          <span>Sin Checklist</span>
          <HelpCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
        </div>
        <div className="mt-2 text-xl font-bold font-mono text-[#F59E0B]">
          {kpis.missingChecklistCount}
        </div>
        <span className="text-[10px] font-mono text-[#64748B]">
          Dato no computable
        </span>
      </div>
    </div>
  );
}
