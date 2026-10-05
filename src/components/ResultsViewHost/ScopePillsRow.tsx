"use client";

import React from "react";
import { Star, Globe, Folder, FileText, Settings } from "lucide-react";

interface ScopePillsRowProps {
  selectedScope: string;
  onSelectScope: (scope: string) => void;
  filterFavorites: boolean;
  onToggleFavorites: () => void;
  onOpenSettings?: () => void;
  textScale?: string;
}

const SCOPES = [
  { id: "Todo", label: "Todo", icon: null },
  { id: "Notion", label: "Notion", icon: Globe },
  { id: "Dropbox", label: "Dropbox", icon: Folder },
  { id: "Carpetas", label: "Carpetas", icon: Folder },
  { id: "Contenido", label: "Contenido", icon: FileText },
  { id: "Todas bases", label: "Todas bases", icon: null },
  { id: "Revisiones", label: "Revisiones", icon: null },
  { id: "zClientes", label: "zClientes", icon: null },
  { id: "zDominios", label: "zDominios", icon: null },
  { id: "zProyectos", label: "zProyectos", icon: null },
  { id: "Programas", label: "Programas", icon: null },
  { id: "zPAGAR", label: "zPAGAR", icon: null },
  { id: "zCOBRAR", label: "zCOBRAR", icon: null },
  { id: "zCorreos", label: "zCorreos", icon: null },
];

export function ScopePillsRow({
  selectedScope,
  onSelectScope,
  filterFavorites,
  onToggleFavorites,
  onOpenSettings,
  textScale = "100%",
}: ScopePillsRowProps) {
  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  return (
    <div
      style={{
        paddingTop: `${Math.max(2, Math.round(3 * scale))}px`,
        paddingBottom: `${Math.max(2, Math.round(3 * scale))}px`,
      }}
      className="flex items-center justify-between px-3 bg-[#0A0E17] select-none gap-2 transition-all"
    >
      {/* Pills de Ámbitos / Bases con scroll horizontal */}
      <div
        style={{ gap: `${Math.round(4 * scale)}px` }}
        className="flex items-center overflow-x-auto scrollbar-none flex-1 py-0.5"
      >
        {/* ⭐ Favoritos */}
        <button
          type="button"
          onClick={onToggleFavorites}
          style={{
            fontSize: `${(10.5 * scale).toFixed(1)}px`,
            padding: `${Math.max(2, Math.round(3 * scale))}px ${Math.round(8 * scale)}px`,
            gap: `${Math.round(5 * scale)}px`,
          }}
          className={`flex items-center rounded font-medium border transition-colors shrink-0 cursor-pointer ${
            filterFavorites
              ? "bg-[#D97706]/30 border-[#F59E0B] text-[#FDE68A] font-bold shadow-[0_0_8px_rgba(245,158,11,0.3)]"
              : "bg-[#161F2C] border-[#26354A] text-[#CBD5E1] hover:bg-[#1E2836] hover:text-[#FFFFFF]"
          }`}
        >
          <Star
            style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
            className={`${filterFavorites ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#94A3B8]"}`}
          />
          <span>Favoritos</span>
        </button>

        {/* Lista de Pills */}
        {SCOPES.map(({ id, label, icon: Icon }) => {
          const isSelected = selectedScope === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectScope(id)}
              style={{
                fontSize: `${(10.5 * scale).toFixed(1)}px`,
                padding: `${Math.max(2, Math.round(3 * scale))}px ${Math.round(8 * scale)}px`,
                gap: `${Math.round(4 * scale)}px`,
              }}
              className={`flex items-center rounded border transition-colors shrink-0 cursor-pointer ${
                isSelected
                  ? "bg-[#0C4A6E] border-[#38BDF8] text-[#38BDF8] font-bold shadow-[0_0_6px_rgba(56,189,248,0.25)]"
                  : "bg-[#161F2C] border-[#26354A] text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#FFFFFF]"
              }`}
            >
              {Icon && (
                <Icon
                  style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
                  className="shrink-0"
                />
              )}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Botón Accesorios Derecha (Configuración) */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onOpenSettings}
          style={{ padding: `${Math.round(4 * scale)}px` }}
          className="rounded bg-[#161F2C] border border-[#26354A] text-[#94A3B8] hover:text-[#38BDF8] hover:border-[#38BDF8] transition-colors cursor-pointer"
          title="Configuración"
        >
          <Settings style={{ width: `${Math.round(14 * scale)}px`, height: `${Math.round(14 * scale)}px` }} />
        </button>
      </div>
    </div>
  );
}
