"use client";

import React from "react";
import { Star, Globe, Folder, FileText, Settings, Database, Search, Layers } from "lucide-react";

interface ScopePillsRowProps {
  selectedScope: string;
  onSelectScope: (scope: string) => void;
  filterFavorites: boolean;
  onToggleFavorites: () => void;
  onOpenSettings?: () => void;
  textScale?: string;
}

export type ScopeCategory = "general" | "database" | "filter";

export interface ScopeItem {
  id: string;
  label: string;
  category: ScopeCategory;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null;
  badge?: string;
  tooltip: string;
}

const GENERAL_SCOPES: ScopeItem[] = [
  { id: "Todo", label: "Todo", category: "general", icon: null, tooltip: "Ver todos los resultados (Notion y Dropbox)" },
  { id: "Notion", label: "Notion", category: "general", icon: Globe, tooltip: "Todas las actividades y páginas de Notion" },
  { id: "Dropbox", label: "Dropbox", category: "general", icon: Folder, tooltip: "Archivos sincronizados en Dropbox" },
  { id: "Carpetas", label: "Carpetas", category: "general", icon: Folder, tooltip: "Carpetas y directorios locales/Dropbox" },
  { id: "Contenido", label: "Contenido", category: "general", icon: FileText, tooltip: "Búsqueda en texto y contenido interno" },
  { id: "Todas bases", label: "Todas bases", category: "general", icon: Layers, tooltip: "Consolida todas las bases de datos de Notion" },
];

const DATABASE_SCOPES: ScopeItem[] = [
  { id: "Revisiones", label: "Revisiones", category: "database", icon: Database, badge: "BD", tooltip: "Base de datos real · Muestra todos los registros de la base Revisiones" },
  { id: "zClientes", label: "zClientes", category: "database", icon: Database, badge: "BD", tooltip: "Base de datos real · Catálogo completo de Clientes" },
  { id: "zDominios", label: "zDominios", category: "database", icon: Database, badge: "BD", tooltip: "Base de datos real · Catálogo completo de Dominios" },
  { id: "zProyectos", label: "zProyectos", category: "database", icon: Database, badge: "BD", tooltip: "Base de datos real · Catálogo de Programas y Proyectos" },
  { id: "zCorreos", label: "zCorreos", category: "database", icon: Database, badge: "BD", tooltip: "Base de datos real · Catálogo de Correos y Contraseñas" },
];

const FILTER_SCOPES: ScopeItem[] = [
  { id: "Programas", label: "Software", category: "filter", icon: Search, badge: "Filtro", tooltip: "Búsqueda dentro de base · Filtra actividades de Software / Desarrollo (PROG)" },
  { id: "zPAGAR", label: "zPAGAR", category: "filter", icon: Search, badge: "Filtro", tooltip: "Búsqueda dentro de base · Filtra actividades de pagos pendientes" },
  { id: "zCOBRAR", label: "zCOBRAR", category: "filter", icon: Search, badge: "Filtro", tooltip: "Búsqueda dentro de base · Filtra actividades de cobros pendientes" },
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

  const renderScopeButton = (item: ScopeItem) => {
    const isSelected = selectedScope === item.id;
    const Icon = item.icon;

    let baseClass = "";
    if (item.category === "database") {
      baseClass = isSelected
        ? "bg-[#0284C7] border-cyan-300 text-white font-bold shadow-[0_0_8px_rgba(2,132,199,0.5)]"
        : "bg-[#0C1B2B] border-cyan-800/60 text-cyan-100 hover:border-cyan-400 hover:bg-[#11263C] hover:text-white";
    } else if (item.category === "filter") {
      baseClass = isSelected
        ? "bg-[#D97706] border-amber-300 text-white font-bold shadow-[0_0_8px_rgba(217,119,6,0.5)]"
        : "bg-[#1C160B] border-amber-800/60 text-amber-100 hover:border-amber-400 hover:bg-[#281F0E] hover:text-white";
    } else {
      baseClass = isSelected
        ? "bg-[#0C4A6E] border-[#38BDF8] text-[#38BDF8] font-bold shadow-[0_0_6px_rgba(56,189,248,0.25)]"
        : "bg-[#161F2C] border-[#26354A] text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#FFFFFF]";
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectScope(item.id)}
        style={{
          fontSize: `${(10.5 * scale).toFixed(1)}px`,
          padding: `${Math.max(2, Math.round(3 * scale))}px ${Math.round(8 * scale)}px`,
          gap: `${Math.round(4 * scale)}px`,
        }}
        className={`flex items-center rounded border transition-all shrink-0 cursor-pointer ${baseClass}`}
        title={item.tooltip}
      >
        {Icon && (
          <Icon
            style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
            className={`shrink-0 ${
              isSelected
                ? "text-white"
                : item.category === "database"
                ? "text-cyan-400"
                : item.category === "filter"
                ? "text-amber-400"
                : ""
            }`}
          />
        )}
        <span>{item.label}</span>
        {item.badge && (
          <span
            style={{ fontSize: `${Math.max(7, 7.5 * scale).toFixed(1)}px` }}
            className={`px-1 py-0.2 rounded font-extrabold uppercase shrink-0 tracking-wider ${
              isSelected
                ? "bg-white/25 text-white border border-white/40"
                : item.category === "database"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/50"
                : "bg-amber-950 text-amber-300 border border-amber-500/50"
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      style={{
        paddingTop: `${Math.max(2, Math.round(3 * scale))}px`,
        paddingBottom: `${Math.max(2, Math.round(3 * scale))}px`,
      }}
      className="flex items-center justify-between px-3 bg-[#0A0E17] select-none gap-2 transition-all border-b border-[#1E2836]/60"
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
          title="Filtrar solo elementos favoritos"
        >
          <Star
            style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
            className={`${filterFavorites ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#94A3B8]"}`}
          />
          <span>Favoritos</span>
        </button>

        {/* 1. Ámbitos generales */}
        {GENERAL_SCOPES.map(renderScopeButton)}

        {/* Separador hacia Bases de Datos Reales */}
        <div className="flex items-center gap-1 shrink-0 px-1 border-l border-slate-700/60 pl-2">
          <span
            style={{ fontSize: `${(9.5 * scale).toFixed(1)}px` }}
            className="font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1 select-none"
            title="Bases de datos reales de Notion · Muestran todos los registros de cada base"
          >
            <Database
              style={{ width: `${Math.round(11 * scale)}px`, height: `${Math.round(11 * scale)}px` }}
              className="text-cyan-400"
            />
            Bases:
          </span>
        </div>

        {/* 2. Bases de Datos Reales de Notion */}
        {DATABASE_SCOPES.map(renderScopeButton)}

        {/* Separador hacia Filtros / Búsquedas por tipo */}
        <div className="flex items-center gap-1 shrink-0 px-1 border-l border-slate-700/60 pl-2">
          <span
            style={{ fontSize: `${(9.5 * scale).toFixed(1)}px` }}
            className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1 select-none"
            title="Filtros y búsquedas por tipo o categoría dentro de la base de datos"
          >
            <Search
              style={{ width: `${Math.round(11 * scale)}px`, height: `${Math.round(11 * scale)}px` }}
              className="text-amber-400"
            />
            Filtros:
          </span>
        </div>

        {/* 3. Filtros dentro de Base */}
        {FILTER_SCOPES.map(renderScopeButton)}
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
