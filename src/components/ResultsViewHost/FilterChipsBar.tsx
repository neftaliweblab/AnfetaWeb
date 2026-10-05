"use client";

import React, { useState } from "react";
import { Star, Columns, Layers, Check, RefreshCw } from "lucide-react";

interface FilterChipsBarProps {
  selectedPerson: string | null;
  onSelectPerson: (person: string | null) => void;
  totalCount: number;
  filterFavorites?: boolean;
  onToggleFavorites?: () => void;
  groupBy?: string;
  onSelectGroupBy?: (g: string) => void;
  visibleCols?: { path: boolean; status: boolean; scheduledDate: boolean; modifiedDate: boolean };
  onToggleCol?: (col: "path" | "status" | "scheduledDate" | "modifiedDate") => void;
  onMaximizeNameCol?: () => void;
  onResetCols?: () => void;
}

const COLLABORATORS = [
  "John",
  "Karla",
  "Isaias",
  "Sotelo",
  "Acalli",
  "Andrade",
  "Brian",
  "Genaro",
  "Neftali",
];

export function FilterChipsBar({
  selectedPerson,
  onSelectPerson,
  totalCount,
  filterFavorites,
  onToggleFavorites,
  groupBy = "none",
  onSelectGroupBy,
  visibleCols = { path: true, status: true, scheduledDate: true, modifiedDate: true },
  onToggleCol,
  onMaximizeNameCol,
  onResetCols,
}: FilterChipsBarProps) {
  const [showColsMenu, setShowColsMenu] = useState(false);

  return (
    <div className="h-9 bg-[#0B0F15] border-b border-[#1E2633] px-3 flex items-center justify-between gap-3 text-xs flex-shrink-0 select-none overflow-x-auto scrollbar-none">
      {/* 1. Izquierda: Favoritos y Contador */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Chip ⭐ Favoritos */}
        <button
          onClick={onToggleFavorites}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
            filterFavorites
              ? "bg-[#FBBF24] text-[#080B0F] font-bold shadow-[0_0_8px_rgba(251,191,36,0.4)]"
              : "bg-[#131A22] text-[#94A3B8] hover:text-[#FBBF24] border border-[#223848]"
          }`}
          title="Filtrar solo elementos favoritos"
        >
          <Star className={`w-3 h-3 ${filterFavorites ? "fill-current" : ""}`} />
          <span>Favoritos</span>
        </button>

        <span className="text-[11px] font-mono text-[#64748B]">
          {totalCount.toLocaleString()} {totalCount === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      {/* 2. Derecha: Integrantes, Agrupar y Menú Columnas */}
      <div className="flex items-center gap-2 relative flex-shrink-0">
        {/* Selector Integrantes */}
        <select
          value={selectedPerson || ""}
          onChange={(e) => onSelectPerson(e.target.value || null)}
          className="bg-[#131A22] text-[#94A3B8] border border-[#223848] rounded px-2 py-1 text-[11px] focus:outline-none focus:border-[#00A8FF]"
        >
          <option value="">Todos los integrantes</option>
          {COLLABORATORS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Desplegable Agrupar */}
        <div className="flex items-center gap-1 bg-[#131A22] border border-[#223848] rounded px-2 py-1">
          <Layers className="w-3 h-3 text-[#38BDF8]" />
          <select
            value={groupBy}
            onChange={(e) => onSelectGroupBy?.(e.target.value)}
            className="bg-transparent text-[#94A3B8] text-[11px] focus:outline-none cursor-pointer"
          >
            <option value="none" className="bg-[#0F141A]">Sin agrupar</option>
            <option value="domain" className="bg-[#0F141A]">Por Dominio</option>
            <option value="month" className="bg-[#0F141A]">Por Mes</option>
            <option value="person" className="bg-[#0F141A]">Por Persona</option>
          </select>
        </div>

        {/* Botón y Menú Desplegable "Columnas" */}
        <div className="relative">
          <button
            onClick={() => setShowColsMenu(!showColsMenu)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#223848] text-[11px] font-medium"
            title="Configurar visibilidad de columnas"
          >
            <Columns className="w-3 h-3 text-[#38BDF8]" />
            <span>Columnas</span>
          </button>

          {showColsMenu && (
            <div className="absolute right-0 top-8 z-50 w-56 bg-[#0F141A] border border-[#26323E] rounded-lg shadow-2xl p-2 space-y-1 text-[11px] animate-in fade-in">
              <span className="text-[10px] font-mono text-[#64748B] uppercase px-1 block mb-1">
                Columnas visibles
              </span>

              {[
                { key: "path", label: "Path / Base Notion" },
                { key: "status", label: "Estado actualización" },
                { key: "scheduledDate", label: "Fecha por hacer" },
                { key: "modifiedDate", label: "Fecha modificada" },
              ].map(({ key, label }) => {
                const isVis = visibleCols[key as keyof typeof visibleCols];
                return (
                  <button
                    key={key}
                    onClick={() => onToggleCol?.(key as any)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-[#18212B] text-left text-[#CBD5E1]"
                  >
                    <span>{label}</span>
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                        isVis
                          ? "bg-[#00A8FF] border-[#00A8FF] text-[#080B0F]"
                          : "border-[#475569]"
                      }`}
                    >
                      {isVis && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}

              <div className="pt-1 border-t border-[#26323E] mt-1 space-y-1">
                <button
                  onClick={() => {
                    onMaximizeNameCol?.();
                    setShowColsMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#18212B] text-[#38BDF8] text-[10.5px] font-medium"
                >
                  Maximizar columna Nombre
                </button>
                <button
                  onClick={() => {
                    onResetCols?.();
                    setShowColsMenu(false);
                  }}
                  className="w-full flex items-center gap-1.5 text-left px-2 py-1 rounded hover:bg-[#18212B] text-[#94A3B8] hover:text-[#CBD5E1] text-[10.5px]"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Restablecer todas las columnas</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
