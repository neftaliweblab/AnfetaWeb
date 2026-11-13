"use client";

import {createPortal} from "react-dom";
import React, { useState, useRef, useEffect } from "react";
import { Star, Globe, Folder, FileText, Database, Search, Layers, ChevronDown, LayoutGrid } from "lucide-react";

interface ScopePillsRowProps {
  selectedScope: string;
  onSelectScope: (scope: string) => void;
  filterFavorites: boolean;
  onToggleFavorites: () => void;
  onOpenSettings?: () => void;
  textScale?: string;
}

export type ScopeCategory = "source" | "database" | "filter";

export interface ScopeItem {
  id: string;
  label: string;
  category: ScopeCategory;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null;
  badge?: string;
  tooltip: string;
}

// 1. Fuentes principales (Notion es fuente, NO BD)
const SOURCE_SCOPES: ScopeItem[] = [
  { id: "Todo", label: "Todo", category: "source", icon: null, tooltip: "Ver todos los resultados (Notion y Dropbox)" },
  { id: "Notion", label: "Notion", category: "source", icon: Globe, tooltip: "Fuente principal Notion: todas las páginas y actividades" },
  { id: "Dropbox", label: "Dropbox", category: "source", icon: Folder, tooltip: "Fuente Dropbox: archivos y carpetas sincronizados en la nube" },
  { id: "Carpetas", label: "Carpetas", category: "source", icon: Folder, tooltip: "Directorios locales y carpetas Dropbox" },
  { id: "Contenido", label: "Contenido", category: "source", icon: FileText, tooltip: "Búsqueda interna profunda en texto de notas y documentos" },
];

// 2. Bases de datos reales (identificadas con BD)
const DATABASE_SCOPES: ScopeItem[] = [
  { id: "Revisiones", label: "Revisiones", category: "database", icon: Database, badge: "BD", tooltip: "Base real Revisiones · conserva la búsqueda y los filtros activos" },
  { id: "zClientes", label: "Clientes", category: "database", icon: Database, badge: "BD", tooltip: "Base real Clientes · conserva la búsqueda y los filtros activos" },
  { id: "zDominios", label: "Dominios", category: "database", icon: Database, badge: "BD", tooltip: "Base real Dominios · sitios web y servidores" },
  { id: "zProyectos", label: "zProyectos", category: "database", icon: Database, badge: "BD", tooltip: "Base real de Catálogo de Programas y Proyectos" },
  { id: "zCorreos", label: "zCorreos", category: "database", icon: Database, badge: "BD", tooltip: "Base real de Cuentas y Accesos" },
];

// 3. Búsquedas especiales dentro de bases (identificadas con FILTRO)
const FILTER_SCOPES: ScopeItem[] = [
  { id: "Programas", label: "Software", category: "filter", icon: Search, badge: "FILTRO", tooltip: "Filtro de Software / Desarrollo dentro de base Revisiones" },
  { id: "Plantillas", label: "Plantillas", category: "filter", icon: FileText, badge: "FILTRO", tooltip: "Plantillas operativas en Revisiones (#ffase00, aaprtuz, ee-d11 / nn-e11)" },
  { id: "Vistas", label: "Vistas", category: "filter", icon: LayoutGrid, badge: "FILTRO", tooltip: "Vistas y tableros de Notion (vvist, vvsz, ttabl, Egresos / Ingresos)" },
  { id: "zPAGAR", label: "zPAGAR", category: "filter", icon: Search, badge: "FILTRO", tooltip: "Filtro de cuentas y actividades de pago por realizar" },
  { id: "zCOBRAR", label: "zCOBRAR", category: "filter", icon: Search, badge: "FILTRO", tooltip: "Filtro de cobranzas y cobros pendientes" },
];

export function ScopePillsRow({
  selectedScope,
  onSelectScope,
  filterFavorites,
  onToggleFavorites,
  onOpenSettings,
  textScale = "100%",
}: ScopePillsRowProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null),menuRef=useRef<HTMLDivElement>(null);
  const [menuPosition,setMenuPosition]=useState({left:12,top:80,width:240,maxHeight:320});
  useEffect(()=>{
    if(!showMoreMenu)return;
    const place=()=>{const button=moreRef.current?.querySelector('button');if(!button)return;const rect=button.getBoundingClientRect(),width=Math.min(260,window.innerWidth-24);setMenuPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:Math.min(rect.bottom+6,window.innerHeight-100),width,maxHeight:Math.max(80,window.innerHeight-rect.bottom-24)});};
    place();const frame=requestAnimationFrame(()=>menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[showMoreMenu]);

  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          className={`flex items-center rounded border transition-colors shrink-0 cursor-pointer ${
            filterFavorites
              ? "bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B] font-bold shadow-[0_0_8px_rgba(245,158,11,0.3)]"
              : "bg-[#161F2C] border-[#26354A] text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#FFFFFF]"
          }`}
          title="Ver únicamente elementos marcados como Favoritos (⭐)"
        >
          <Star
            style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
            className={filterFavorites ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#64748B]"}
          />
          <span>Favoritos</span>
        </button>

        <div className="h-4 w-px bg-[#26354A] mx-0.5 shrink-0" />

        {/* 1. Fuentes Principales */}
        {SOURCE_SCOPES.map(renderScopeButton)}

        <div className="h-4 w-px bg-[#26354A] mx-0.5 shrink-0" />

        {/* 2. Bases Reales (BD) */}
        {DATABASE_SCOPES.slice(0, 3).map(renderScopeButton)}

        <div className="h-4 w-px bg-[#26354A] mx-0.5 shrink-0" />

        {/* 3. Filtros Especiales (FILTRO) */}
        {FILTER_SCOPES.map(renderScopeButton)}

        {/* Botón "Más ▾" para agrupar accesos restantes */}
        <div ref={moreRef} className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="menu" aria-expanded={showMoreMenu}
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              padding: `${Math.max(2, Math.round(3 * scale))}px ${Math.round(8 * scale)}px`,
            }}
            className="flex items-center gap-1 rounded border border-[#26354A] bg-[#141B26] text-slate-300 hover:text-white hover:bg-[#1A2536] cursor-pointer"
            title="Ver más bases y fuentes secundarias"
          >
            <span>Más</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showMoreMenu && typeof document!=="undefined" && createPortal(
            <div ref={menuRef} role="menu" aria-label="Bases adicionales" style={{position:'fixed',...menuPosition,zIndex:6000}} className="overflow-y-auto bg-[#111722] border border-cyan-800 rounded-lg shadow-2xl p-1.5 space-y-1" onKeyDown={event=>{
                const buttons=Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button')||[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
                if(event.key==='Escape'){event.preventDefault();setShowMoreMenu(false);moreRef.current?.querySelector('button')?.focus();}
                if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
              }}>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 border-b border-[#1E293B]">
                Bases adicionales (BD)
              </div>
              {DATABASE_SCOPES.slice(3).map((item) => (
                <button
                  key={item.id}
                  role="menuitem" type="button"
                  onClick={() => {
                    onSelectScope(item.id);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded text-xs text-slate-300 hover:bg-[#1A2536] hover:text-white flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  <span className="text-[9px] bg-cyan-950 text-cyan-300 px-1 rounded border border-cyan-700">BD</span>
                </button>
              ))}
            </div>
          ,document.body)}
        </div>
      </div>
    </div>
  );
}
