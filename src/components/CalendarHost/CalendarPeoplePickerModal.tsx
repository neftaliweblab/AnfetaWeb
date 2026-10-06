"use client";

import React from "react";
import { Users, Check, X } from "lucide-react";
import { getPersonColor } from "@/services/identityNormalizer";

interface CalendarPeoplePickerModalProps {
  allPeople: string[];
  visiblePeople: string[];
  onTogglePerson: (person: string) => void;
  columnWidth: number;
  onChangeWidth: (width: number) => void;
  onMovePerson: (person: string, direction: number) => void;
  onClose: () => void;
}

export function CalendarPeoplePickerModal({
  allPeople,
  visiblePeople,
  onTogglePerson,
  onClose, columnWidth, onChangeWidth, onMovePerson,
}: CalendarPeoplePickerModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-label="Configurar columnas" className="w-full max-h-[90dvh] flex flex-col max-w-sm bg-[#0F141A] border border-[#26323E] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-11 px-4 border-b border-[#26323E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#00A8FF]" />
            <h3 className="text-xs font-bold text-[#F1F5F9]">
              Configurar Colaboradores Visibles
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#F1F5F9] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[#26323E] text-xs text-slate-300">
          <label className="flex justify-between" htmlFor="calendar-column-width"><span>Ancho de todas las columnas</span><span>{columnWidth}px</span></label>
          <div className="flex items-center gap-3 mt-2">
            <button type="button" aria-label="Reducir ancho de columnas" disabled={columnWidth <= 180} onClick={() => onChangeWidth(Math.max(180, columnWidth - 20))} className="px-2 py-1 rounded border border-slate-600 disabled:opacity-30">−</button>
            <input id="calendar-column-width" type="range" min="180" max="600" step="20" value={columnWidth} onChange={e => onChangeWidth(Number(e.target.value))} className="min-w-0 flex-1 accent-cyan-500" />
            <button type="button" aria-label="Aumentar ancho de columnas" disabled={columnWidth >= 600} onClick={() => onChangeWidth(Math.min(600, columnWidth + 20))} className="px-2 py-1 rounded border border-slate-600 disabled:opacity-30">+</button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Usa las flechas para ordenar. Tamaño, orden y personas visibles se guardan automáticamente en este navegador.</p>
        </div>
        <div className="p-3 min-h-0 max-h-72 overflow-y-auto space-y-1.5 scrollbar-thin">
          {allPeople.map((p, index) => {
            const isVisible = visiblePeople.includes(p);
            const color = getPersonColor(p);
            return (
              <div
                key={p}

                className={`flex items-center justify-between p-2 rounded cursor-pointer border transition-colors ${
                  isVisible
                    ? "bg-[#18212B] border-[#00A8FF]/40 text-[#F1F5F9]"
                    : "bg-[#11161C] border-[#223848] text-[#64748B]"
                }`}
              >
                <button type="button" aria-pressed={isVisible} onClick={() => onTogglePerson(p)} className="flex flex-1 items-center gap-2 text-left">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-medium">{p}</span>
                </button>
                <div className="flex items-center gap-1 mr-3">
                  <button type="button" aria-label={`Déplacer ${p} a la izquierda`} disabled={index === 0} onClick={() => onMovePerson(p, -1)} className="px-2 py-1 rounded hover:bg-slate-700 disabled:opacity-25">←</button>
                  <button type="button" aria-label={`Déplacer ${p} a la derecha`} disabled={index === allPeople.length - 1} onClick={() => onMovePerson(p, 1)} className="px-2 py-1 rounded hover:bg-slate-700 disabled:opacity-25">→</button>
                </div>
                <button type="button" aria-label={`${isVisible ? 'Ocultar' : 'Mostrar'} ${p}`} aria-pressed={isVisible} onClick={() => onTogglePerson(p)}
                  className={`w-4 h-4 rounded flex items-center justify-center border ${
                    isVisible
                      ? "bg-[#00A8FF] border-[#00A8FF] text-[#080B0F]"
                      : "border-[#64748B]"
                  }`}
                >
                  {isVisible && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-[#26323E] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#00A8FF] hover:bg-[#1FB6FF] text-[#080B0F] text-xs font-bold rounded"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
