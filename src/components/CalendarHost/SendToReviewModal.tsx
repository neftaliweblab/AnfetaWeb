"use client";

import React, { useState } from "react";
import { Send, X, UserCheck, ShieldCheck, Check } from "lucide-react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { PERSON_METADATA } from "@/services/identityNormalizer";

interface SendToReviewModalProps {
  activity: NotionCalendarActivity;
  currentUser: string;
  onClose: () => void;
  onConfirm: (targetReviewer: string, leaveVisualCopy: boolean) => void;
}

const REVIEWERS = [
  { id: "John", name: "John", alias: "jjohn", role: "Supervisor / Dirección", avatar: "JO", color: "#38BDF8" },
  { id: "Isaias", name: "Isaías", alias: "iisai", role: "SEO & Contenido", avatar: "IS", color: "#4ADE80" },
  { id: "Genaro", name: "Genaro", alias: "ggena", role: "Desarrollo & Sistemas", avatar: "GE", color: "#E879F9" },
];

export function SendToReviewModal({
  activity,
  currentUser,
  onClose,
  onConfirm,
}: SendToReviewModalProps) {
  const [selectedReviewer, setSelectedReviewer] = useState<string>("John");
  const [leaveCopy, setLeaveCopy] = useState<boolean>(true);

  const title = activity.title || (activity as any)?.Title || "Actividad";
  const domain = activity.domain || (activity as any)?.ParsedDomain || "DOMINIO";

  const handleSend = () => {
    onConfirm(selectedReviewer, leaveCopy);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#2B3B4E] bg-[#0E1520] p-5 shadow-2xl text-slate-200 space-y-4 select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-[#38BDF8]">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Enviar a Revisión</h3>
              <p className="text-[11px] text-slate-400">Flujo oficial de revisión ANFETA (rtuzREVISION)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumen de la Actividad */}
        <div className="rounded-lg bg-[#141E2E]/80 border border-[#22354A] p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-[#38BDF8] text-[11px]">{domain}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {activity.checklistCompleted ?? 0}/{activity.checklistTotal ?? 0} checklist
            </span>
          </div>
          <p className="text-slate-300 font-medium line-clamp-2 leading-snug">{title}</p>
        </div>

        {/* Selector de Revisor: John, Isaias, Genaro */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Selecciona al Revisor Encargado:</span>
            <span className="text-[10px] text-sky-400 font-normal">Revisores Autorizados</span>
          </label>
          <div className="grid grid-cols-1 gap-2">
            {REVIEWERS.map((rev) => {
              const isSelected = selectedReviewer === rev.id;
              return (
                <div
                  key={rev.id}
                  onClick={() => setSelectedReviewer(rev.id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#1E293B] border-sky-400/80 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                      : "bg-[#111822] border-[#223246] hover:border-slate-600 hover:bg-[#162232]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{ backgroundColor: `${rev.color}25`, borderColor: rev.color, color: rev.color }}
                      className="w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs font-mono shadow-sm"
                    >
                      {rev.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{rev.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">(@{rev.alias})</span>
                      </div>
                      <span className="text-[10.5px] text-slate-400">{rev.role}</span>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-sky-400 bg-sky-500 text-slate-950 font-bold"
                        : "border-slate-600 bg-transparent"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Opción de copia visual / historial */}
        <div
          onClick={() => setLeaveCopy(!leaveCopy)}
          className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#111822] border border-[#223246] cursor-pointer hover:border-slate-600 transition-colors"
        >
          <div
            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              leaveCopy ? "border-sky-400 bg-sky-500 text-slate-950 font-bold" : "border-slate-600 bg-slate-800"
            }`}
          >
            {leaveCopy && <Check className="w-3 h-3 stroke-[3]" />}
          </div>
          <div className="text-xs">
            <span className="font-semibold text-white block leading-tight">
              Dejar copia visual en mi columna
            </span>
            <span className="text-[11px] text-slate-400 leading-tight">
              Permite ver que ya mandaste a revisión esta tarea mientras el revisor la califica.
            </span>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E293B]">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#2B3B4E] text-xs font-semibold text-slate-300 hover:bg-[#1E293B] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar a {selectedReviewer}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
