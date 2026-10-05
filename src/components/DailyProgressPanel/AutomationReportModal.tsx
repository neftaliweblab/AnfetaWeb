"use client";

import React from "react";
import { Sparkles, X, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";

interface AutomationReportModalProps {
  report: any;
  onClose: () => void;
}

export function AutomationReportModal({
  report,
  onClose,
}: AutomationReportModalProps) {
  if (!report) return null;

  const movements = report.Movements || report.movements || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0F141A] border border-[#26323E] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#26323E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00A8FF]" />
            <h3 className="text-xs font-bold text-[#F1F5F9]">
              Reporte de Automatización Diaria (05:00 AM)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#F1F5F9] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats summary */}
        <div className="p-4 grid grid-cols-4 gap-3 border-b border-[#26323E] bg-[#080B0F]">
          <div className="text-center">
            <span className="text-[10px] text-[#64748B] block">REVISADAS</span>
            <span className="text-base font-mono font-bold text-[#F1F5F9]">
              {report.Reviewed || report.reviewed || 0}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-[#00A8FF] block">MOVIDAS A HOY</span>
            <span className="text-base font-mono font-bold text-[#00A8FF]">
              {report.Moved || report.moved || 0}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-[#4ADE80] block">FINALIZADAS (OMITIDAS)</span>
            <span className="text-base font-mono font-bold text-[#4ADE80]">
              {report.SkippedCompleted || report.skippedCompleted || 0}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-[#FB7185] block">FALLIDAS</span>
            <span className="text-base font-mono font-bold text-[#FB7185]">
              {report.Failed || report.failed || 0}
            </span>
          </div>
        </div>

        {/* Movements list */}
        <div className="p-4 max-h-80 overflow-y-auto space-y-2 scrollbar-thin">
          <h4 className="text-xs font-semibold text-[#E2E8F0] mb-2">
            Movimientos y Reprogramaciones:
          </h4>
          {movements.length === 0 ? (
            <p className="text-xs text-[#64748B] text-center py-6">
              No hubo movimientos pendientes de días anteriores para reprogramar
            </p>
          ) : (
            movements.map((m: any, idx: number) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-[#131A22] border border-[#223848] text-xs flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[#F1F5F9] truncate">
                    {m.Title || m.title || "Actividad"}
                  </p>
                  <span className="text-[10px] font-mono text-[#64748B]">
                    {m.Reason || m.reason || "Reprogramada a la jornada de hoy"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#38BDF8] flex-shrink-0">
                  <span>{m.OriginalDate || m.originalDate || "Ayer"}</span>
                  <ArrowRight className="w-3 h-3 text-[#64748B]" />
                  <span className="text-[#4ADE80] font-bold">Hoy</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#26323E] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#00A8FF] hover:bg-[#1FB6FF] text-[#080B0F] text-xs font-bold rounded"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
