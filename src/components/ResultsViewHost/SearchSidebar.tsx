"use client";

import React, { useState } from "react";
import { PendingTaskItem, ActiveProjectItem } from "@/types/anfeta";
import { formatSmartDate } from "@/lib/dateUtils";
import {
  ChevronDown,
  Flame,
  Bookmark,
  Plus,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface SearchSidebarProps {
  pendingTasks: PendingTaskItem[];
  onTogglePendingTask: (id: string) => void;
  activeProjects: ActiveProjectItem[];
  onSelectSearch: (query: string) => void;
  onFilterNotionBase?: (base: string) => void;
  onFilterPerson?: (person: string) => void;
  onFilterStatus?: (status: string) => void;
  onFilterFileType?: (type: string) => void;
}

const DEFAULT_SAVED_SEARCHES = [
  "mhad.com.mx",
  "rtuzrevision",
  "prueba nneft guardar",
];

export function SearchSidebar({
  pendingTasks,
  onTogglePendingTask,
  activeProjects,
  onSelectSearch,
  onFilterNotionBase,
  onFilterPerson,
  onFilterStatus,
  onFilterFileType,
}: SearchSidebarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<string[]>(DEFAULT_SAVED_SEARCHES);
  const [showProjectsList, setShowProjectsList] = useState(false);

  const toggleMenu = (menu: string) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const handleAddSaved = () => {
    const q = prompt("Nombre de la búsqueda rápida a guardar:");
    if (q && q.trim()) {
      setSavedSearches((prev) => [...prev, q.trim()]);
    }
  };

  return (
    <aside className="w-[260px] shrink-0 h-full bg-[#0B0F15] border-r border-[#1E2633] flex flex-col text-[12px] text-[#CBD5E1] select-none overflow-y-auto scrollbar-thin p-2.5 space-y-3">
      {/* 1. TARJETA PENDIENTES */}
      <div className="bg-[#121822] border border-[#232F42] rounded-lg p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] text-[#FACC15] tracking-wider uppercase font-mono">
            PENDIENTES
          </span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/30">
            {pendingTasks.filter((t) => !t.isCompleted).length}
          </span>
        </div>

        <div className="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-thin pr-1">
          {pendingTasks.slice(0, 6).map((t) => (
            <div
              key={t.id}
              onClick={() => onTogglePendingTask(t.id)}
              className="flex items-start gap-1.5 cursor-pointer hover:bg-[#1A2332] p-1 rounded transition-colors group"
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                  t.isCompleted ? "text-[#4ADE80]" : "text-[#475569] group-hover:text-[#FACC15]"
                }`}
              />
              <div className="min-w-0 flex-1 leading-tight">
                <span className="text-[11px] text-[#E2E8F0] block truncate">
                  {t.title}
                </span>
                <span className="text-[9.5px] font-mono text-[#F59E0B]">
                  {formatSmartDate(t.scheduledDate)}
                </span>
              </div>
            </div>
          ))}
          {pendingTasks.length === 0 && (
            <span className="text-[10px] text-[#64748B] block py-1">
              Sin pendientes activos
            </span>
          )}
        </div>
      </div>

      {/* 2. TARJETA BÚSQUEDAS RÁPIDAS */}
      <div className="bg-[#121822] border border-[#232F42] rounded-lg p-2.5 space-y-2 relative">
        <span className="font-bold text-[11px] text-[#38BDF8] tracking-wider uppercase font-mono block">
          BÚSQUEDAS RÁPIDAS
        </span>

        {/* Rejilla 2x2 */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* Archivos */}
          <div className="relative">
            <button
              onClick={() => toggleMenu("archivos")}
              className="w-full h-7 px-2 bg-[#16202C] hover:bg-[#1D2B3A] border border-[#2A3E54] rounded text-[11px] text-[#CBD5E1] flex items-center justify-between font-medium"
            >
              <span>Archivos</span>
              <ChevronDown className="w-3 h-3 text-[#38BDF8]" />
            </button>
            {openMenu === "archivos" && (
              <div className="absolute left-0 top-8 z-30 w-36 bg-[#16202C] border border-[#2A3E54] rounded shadow-xl py-1 text-[11px]">
                {["PDF", "Excel", "Word", "Imágenes", "Código", "Todos"].map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      onFilterFileType?.(f.toLowerCase());
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-[#22354A] text-[#CBD5E1]"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Personas */}
          <div className="relative">
            <button
              onClick={() => toggleMenu("personas")}
              className="w-full h-7 px-2 bg-[#16202C] hover:bg-[#1D2B3A] border border-[#2A3E54] rounded text-[11px] text-[#CBD5E1] flex items-center justify-between font-medium"
            >
              <span>Personas</span>
              <ChevronDown className="w-3 h-3 text-[#38BDF8]" />
            </button>
            {openMenu === "personas" && (
              <div className="absolute right-0 top-8 z-30 w-36 bg-[#16202C] border border-[#2A3E54] rounded shadow-xl py-1 text-[11px] max-h-48 overflow-y-auto">
                {["John", "Karla", "Isaias", "Sotelo", "Acalli", "Andrade", "Brian", "Genaro", "Neftali"].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      onFilterPerson?.(p);
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-[#22354A] text-[#CBD5E1]"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Proyectos */}
          <button
            onClick={() => setShowProjectsList(!showProjectsList)}
            className="w-full h-7 px-2 bg-[#16202C] hover:bg-[#1D2B3A] border border-[#2A3E54] rounded text-[11px] text-[#CBD5E1] flex items-center justify-between font-medium"
          >
            <span>Proyectos</span>
            <ChevronDown className="w-3 h-3 text-[#38BDF8]" />
          </button>

          {/* Notion */}
          <div className="relative">
            <button
              onClick={() => toggleMenu("notion")}
              className="w-full h-7 px-2 bg-[#16202C] hover:bg-[#1D2B3A] border border-[#2A3E54] rounded text-[11px] text-[#CBD5E1] flex items-center justify-between font-medium"
            >
              <span>Notion</span>
              <ChevronDown className="w-3 h-3 text-[#38BDF8]" />
            </button>
            {openMenu === "notion" && (
              <div className="absolute right-0 top-8 z-30 w-44 bg-[#16202C] border border-[#2A3E54] rounded shadow-xl py-1 text-[11px]">
                {[
                  { label: "Revisiones", tag: "revisiones" },
                  { label: "zClientes", tag: "clientes" },
                  { label: "zDominios", tag: "dominios" },
                  { label: "zProyectos", tag: "proyectos" },
                  { label: "Cobrar y Pagar", tag: "cobrar" },
                  { label: "zCorreos", tag: "correo" },
                ].map((b) => (
                  <button
                    key={b.tag}
                    onClick={() => {
                      onFilterNotionBase?.(b.tag);
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-[#22354A] text-[#CBD5E1]"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Botón ancho: Estados / Flujo */}
        <div className="relative">
          <button
            onClick={() => toggleMenu("estados")}
            className="w-full h-7 px-2 bg-[#16202C] hover:bg-[#1D2B3A] border border-[#2A3E54] rounded text-[11px] text-[#CBD5E1] flex items-center justify-between font-medium"
          >
            <span>Estados / Flujo</span>
            <ChevronDown className="w-3 h-3 text-[#38BDF8]" />
          </button>
          {openMenu === "estados" && (
            <div className="absolute left-0 top-8 z-30 w-full bg-[#16202C] border border-[#2A3E54] rounded shadow-xl py-1 text-[11px]">
              {[
                { label: "● PENDIENTE (prtuz)", val: "prtuz" },
                { label: "● EN REVISIÓN (rtuz)", val: "rtuz" },
                { label: "● TERMINADA (zREVISION)", val: "zREVISION" },
                { label: "● SUSPENDIDA (sprtuz)", val: "sprtuz" },
                { label: "● URGENTE (00)", val: "00" },
              ].map((s) => (
                <button
                  key={s.val}
                  onClick={() => {
                    onFilterStatus?.(s.val);
                    setOpenMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1 hover:bg-[#22354A] text-[#CBD5E1]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tarjeta interna: 🔥 PROYECTOS ACTIVOS HOY */}
        <div className="bg-[#0E1520] border border-[#1E3048] rounded-md p-2 space-y-1.5 mt-2">
          <div className="flex items-center gap-1.5 text-[#F97316] font-bold text-[10.5px]">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>PROYECTOS ACTIVOS HOY</span>
          </div>
          <span className="text-[10px] text-[#94A3B8] block">
            {activeProjects.length > 0
              ? `${activeProjects.length} dominios con actividad hoy`
              : "Cargando proyectos del día..."}
          </span>
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              onClick={() => setShowProjectsList(!showProjectsList)}
              className="flex-1 py-1 rounded bg-[#1B2735] hover:bg-[#233548] text-[#38BDF8] text-[10px] font-medium transition-colors"
            >
              &gt; Desplegar todos
            </button>
            <button
              onClick={() => alert("Resumen IA generado para la jornada.")}
              className="flex-1 py-1 rounded bg-[#1B2735] hover:bg-[#233548] text-[#A78BFA] text-[10px] font-medium flex items-center justify-center gap-1 transition-colors"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Resumen IA</span>
            </button>
          </div>

          {showProjectsList && activeProjects.length > 0 && (
            <div className="max-h-28 overflow-y-auto pt-1 space-y-0.5 border-t border-[#1E3048] mt-1 scrollbar-thin">
              {activeProjects.map((p) => (
                <div
                  key={p.domain}
                  onClick={() => onSelectSearch(p.domain)}
                  className="px-1.5 py-0.5 hover:bg-[#1E293B] rounded text-[10px] font-mono text-[#7DD3FC] cursor-pointer truncate"
                >
                  {p.domain}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. SECCIÓN GUARDADAS (+) */}
      <div className="bg-[#121822] border border-[#232F42] rounded-lg p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] text-[#94A3B8] tracking-wider uppercase font-mono flex items-center gap-1">
            <Bookmark className="w-3 h-3 text-[#38BDF8]" />
            Guardadas
          </span>
          <button
            onClick={handleAddSaved}
            className="p-1 hover:bg-[#1D2B3A] rounded text-[#38BDF8]"
            title="Guardar búsqueda actual"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {savedSearches.map((s) => (
            <button
              key={s}
              onClick={() => onSelectSearch(s)}
              className="w-full text-left px-2 py-1 rounded bg-[#0E1520] hover:bg-[#1A2535] text-[11px] text-[#CBD5E1] font-mono truncate transition-colors block"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
