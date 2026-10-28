"use client";

import React, { useState, useEffect } from "react";
import { Clock, Sparkles, StickyNote } from "lucide-react";
import { TeamPresence } from "./TeamPresence";
import { DiagnosticsLogs } from "./Diagnostics/DiagnosticsLogs";
import { normalizePerson } from "@/services/identityNormalizer";

export interface TopBarUtilitiesProps {
  currentUser?: string;
  onTriggerAutomation?: () => void;
  onOpenAnnouncements?: () => void;
  className?: string;
}

export function TopBarUtilities({
  currentUser,
  onTriggerAutomation,
  onOpenAnnouncements,
  className = "",
}: TopBarUtilitiesProps) {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("es-MX", {
          timeZone: "America/Mexico_City",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={`flex items-center gap-1.5 sm:gap-2 text-[10px] text-slate-300 select-none ${className}`}
    >
      {/* Equipo en línea y avatares */}
      <TeamPresence />

      {currentUser&&<button type="button" title="Notas · texto e imágenes" aria-label="Abrir notas" onClick={()=>window.dispatchEvent(new CustomEvent('anfeta_open_notes',{detail:{owner:currentUser}}))} className="rounded border border-amber-700 bg-amber-950/40 p-1 text-amber-200"><StickyNote size={15}/></button>}

      {/* Visor de Logs y Diagnósticos */}
      <DiagnosticsLogs owner={currentUser || ""} />

      {/* Disparador de automatización de rezagadas */}
      {onTriggerAutomation && (
        <button
          type="button"
          onClick={onTriggerAutomation}
          title="Ejecutar robot de rezagadas de las 05:00 AM"
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848] transition-colors shadow-sm"
        >
          <Sparkles className="w-3 h-3 text-[#00A8FF]" />
          <span className="hidden sm:inline font-medium">Robot 05:00</span>
        </button>
      )}

      {/* Reloj en tiempo real CDMX */}
      <div
        className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-[#080B0F] border border-[#26323E] rounded font-mono text-[#94A3B8]"
        title="Hora oficial CDMX"
      >
        <Clock className="w-3 h-3 text-[#38BDF8]" />
        <span>{timeStr}</span>
      </div>

      {/* Panel de Novedades (solo Neftali) */}
      {normalizePerson(currentUser) === "Neftali" && onOpenAnnouncements && (
        <button
          type="button"
          onClick={onOpenAnnouncements}
          title="Publicar novedades y ver lecturas del equipo (Solo visible para ti)"
          className="flex items-center gap-1 px-2 py-0.5 font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-700/60 rounded transition-colors shadow-sm"
        >
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span className="hidden sm:inline">Novedades</span>
        </button>
      )}
    </div>
  );
}
