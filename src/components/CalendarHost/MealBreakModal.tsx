"use client";
import React, { useState } from "react";
import { Utensils, X, Clock, Check, Sparkles } from "lucide-react";
import {
  MealBreakConfig,
  formatHour12,
  saveMealBreakConfig,
} from "@/services/mealBreakService";

interface MealBreakModalProps {
  currentUser: string;
  config: MealBreakConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (nextConfig: MealBreakConfig) => void;
}

export function MealBreakModal({
  currentUser,
  config: initialConfig,
  isOpen,
  onClose,
  onSaved,
}: MealBreakModalProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [startHour, setStartHour] = useState(initialConfig.startHour);
  const [startMinute, setStartMinute] = useState(initialConfig.startMinute || 0);
  const [endHour, setEndHour] = useState(initialConfig.endHour);
  const [endMinute, setEndMinute] = useState(initialConfig.endMinute || 0);
  const [label, setLabel] = useState(initialConfig.label || "Horario Especial · Comida");

  if (!isOpen) return null;

  const handlePreset = (sH: number, sM: number, eH: number, eM: number) => {
    setStartHour(sH);
    setStartMinute(sM);
    setEndHour(eH);
    setEndMinute(eM);
    setEnabled(true);
  };

  const handleSave = () => {
    const updated: MealBreakConfig = {
      enabled,
      startHour,
      startMinute,
      endHour,
      endMinute,
      label: label.trim() || "Horario Especial · Comida",
    };
    saveMealBreakConfig(currentUser, updated);
    onSaved(updated);
    onClose();
  };

  const handleDisable = () => {
    const updated: MealBreakConfig = {
      ...initialConfig,
      enabled: false,
    };
    saveMealBreakConfig(currentUser, updated);
    onSaved(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configurar Horario Especial o Comida"
        className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#0C121D] shadow-[0_12px_45px_rgba(0,0,0,0.85)] p-5 text-slate-200 space-y-4"
      >
        {/* Encabezado */}
        <header className="flex items-center justify-between border-b border-[#1E293B] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <Utensils className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-300 flex items-center gap-1.5 font-sans">
                <span>Horario Especial / Comida</span>
                <span className="text-[9.5px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.2 rounded border border-amber-500/30">
                  {currentUser}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Reserva visualmente tu bloque de comida en el calendario.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Interruptor de Activación */}
        <div className="flex items-center justify-between bg-[#121A26] border border-amber-500/30 rounded-xl p-3">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-100 block">
              Mostrar en calendario
            </span>
            <span className="text-[10px] text-slate-400 block">
              Visualiza una franja reservada en tu columna sin bloquear tareas.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((prev) => !prev)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer border ${
              enabled
                ? "bg-amber-500 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)] justify-end"
                : "bg-slate-800 border-slate-700 justify-start"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full transition-transform ${
                enabled ? "bg-black" : "bg-slate-400"
              }`}
            />
          </button>
        </div>

        {/* Accesos Rápidos de Horario */}
        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider block">
            Horarios frecuentes
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "1:00 PM – 2:00 PM", sH: 13, sM: 0, eH: 14, eM: 0, sub: "13:00 a 14:00 (Por defecto)" },
              { label: "2:00 PM – 3:00 PM", sH: 14, sM: 0, eH: 15, eM: 0, sub: "14:00 a 15:00" },
              { label: "1:30 PM – 2:30 PM", sH: 13, sM: 30, eH: 14, eM: 30, sub: "13:30 a 14:30" },
              { label: "12:00 PM – 1:00 PM", sH: 12, sM: 0, eH: 13, eM: 0, sub: "12:00 a 13:00" },
            ].map((preset) => {
              const isSelected =
                startHour === preset.sH &&
                startMinute === preset.sM &&
                endHour === preset.eH &&
                endMinute === preset.eM;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset.sH, preset.sM, preset.eH, preset.eM)}
                  className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      : "bg-[#111823] border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-[#16202E]"
                  }`}
                >
                  <div className="text-[11px] font-bold">{preset.label}</div>
                  <div className="text-[9px] text-slate-400">{preset.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ajuste Fino de Horas */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-[10px] text-slate-400 font-semibold mb-1 block">
              Hora de Inicio
            </label>
            <div className="flex items-center gap-1 bg-[#111823] border border-slate-700 rounded-lg p-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                aria-label="Hora de inicio de comida"
                value={`${startHour}:${startMinute}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  setStartHour(h);
                  setStartMinute(m);
                  if (h > endHour || (h === endHour && m >= endMinute)) {
                    setEndHour(Math.min(22, h + 1));
                    setEndMinute(m);
                  }
                }}
                className="bg-transparent text-xs text-amber-200 font-mono w-full focus:outline-hidden cursor-pointer"
              >
                {[11, 12, 13, 14, 15, 16].flatMap((h) => [
                  <option key={`${h}:0`} value={`${h}:0`} className="bg-slate-900 text-white">
                    {formatHour12(h, 0)} ({h.toString().padStart(2, "0")}:00)
                  </option>,
                  <option key={`${h}:30`} value={`${h}:30`} className="bg-slate-900 text-white">
                    {formatHour12(h, 30)} ({h.toString().padStart(2, "0")}:30)
                  </option>,
                ])}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-semibold mb-1 block">
              Hora de Fin
            </label>
            <div className="flex items-center gap-1 bg-[#111823] border border-slate-700 rounded-lg p-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                aria-label="Hora de fin de comida"
                value={`${endHour}:${endMinute}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  setEndHour(h);
                  setEndMinute(m);
                }}
                className="bg-transparent text-xs text-amber-200 font-mono w-full focus:outline-hidden cursor-pointer"
              >
                {[12, 13, 14, 15, 16, 17].flatMap((h) => [
                  <option key={`${h}:0`} value={`${h}:0`} className="bg-slate-900 text-white">
                    {formatHour12(h, 0)} ({h.toString().padStart(2, "0")}:00)
                  </option>,
                  <option key={`${h}:30`} value={`${h}:30`} className="bg-slate-900 text-white">
                    {formatHour12(h, 30)} ({h.toString().padStart(2, "0")}:30)
                  </option>,
                ])}
              </select>
            </div>
          </div>
        </div>

        {/* Nombre / Etiqueta del bloque */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-semibold block">
            Texto visible en el calendario
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Horario Especial · Comida"
            maxLength={40}
            className="w-full rounded-lg bg-[#111823] border border-slate-700 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-400 focus:outline-hidden"
          />
        </div>

        {/* Vista Previa */}
        <div className="rounded-xl border border-dashed border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-orange-950/20 to-amber-950/30 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-500/30 border border-amber-500/50 flex items-center justify-center text-amber-300">
              <Utensils className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-200 block">
                {label.trim() || "Horario Especial · Comida"}
              </span>
              <span className="text-[9.5px] font-mono text-amber-400/80 block">
                {formatHour12(startHour, startMinute)} – {formatHour12(endHour, endMinute)}
              </span>
            </div>
          </div>
          <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30">
            {enabled ? "Activo" : "Inactivo"}
          </span>
        </div>

        {/* Botones de Acción */}
        <footer className="flex items-center justify-between pt-2 border-t border-[#1E293B]">
          <button
            type="button"
            onClick={handleDisable}
            className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
          >
            Desactivar por hoy
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-4 py-1.5 text-xs font-bold text-black shadow-[0_0_12px_rgba(245,158,11,0.4)] transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Guardar horario</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
