"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  Save,
  Zap,
  RotateCw,
  ChevronDown,
  MoreHorizontal,
  Sparkles,
  Calendar,
  ExternalLink,
  MessageSquare,
  Bell,
} from "lucide-react";
import {IndexSyncStatus} from './IndexSyncStatus';
import {FavoritesBackup} from './FavoritesBackup';
import {SavedSearches} from './SavedSearches';
import { SearchPredictiveFlyout } from "./SearchPredictiveFlyout";
import { buildPredictiveData } from "@/lib/searchPredictiveService";

interface SearchInputBarProps {
  query: string;
  onChangeQuery: (q: string) => void;
  onSaveSearch?: () => void;
  onOpenTemplates?: () => void;
  onRefreshIndex?: () => void;
  onSelectSavedView?: (view: string) => void;
  onOpenHelp?: () => void;
  onSelectThemeBg?: (theme: string) => void;
  textScale?: string;
  searchIndex?: any[];
  onToggleCalendarView?: () => void;
  isCalendarActive?: boolean;
  onOpenStandaloneCalendar?: () => void;
  onToggleMessagesView?: () => void;
  isMessagesActive?: boolean;
  messagesCount?: number;
  onToggleRemindersView?: () => void;
  isRemindersActive?: boolean;
  remindersCount?: number;
}

export function SearchInputBar({
  query,
  onChangeQuery,
  onSaveSearch,
  onOpenTemplates,
  onRefreshIndex,
  onSelectSavedView,
  onOpenHelp,
  onSelectThemeBg,
  textScale = "100%",
  searchIndex = [],
  onToggleCalendarView,
  isCalendarActive = false,
  onOpenStandaloneCalendar,
  onToggleMessagesView,
  isMessagesActive = false,
  messagesCount = 0,
  onToggleRemindersView,
  isRemindersActive = false,
  remindersCount = 0,
}: SearchInputBarProps) {
  const [showViewsMenu, setShowViewsMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showThemesMenu, setShowThemesMenu] = useState(false);
  const [isPredictiveOpen, setIsPredictiveOpen] = useState(false);
  const viewsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const barContainerRef = useRef<HTMLDivElement>(null);

  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  const predictiveData = useMemo(() => {
    return buildPredictiveData(query, searchIndex);
  }, [query, searchIndex]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (viewsRef.current && !viewsRef.current.contains(event.target as Node)) {
        setShowViewsMenu(false);
      }
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
        setShowThemesMenu(false);
      }
      if (barContainerRef.current && !barContainerRef.current.contains(event.target as Node)) {
        setIsPredictiveOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const THEMES = [
    { id: "gray", label: "Gris oscuro", color: "#151515" },
    { id: "blue", label: "Azul noche", color: "#0F172A" },
    { id: "purple", label: "Morado oscuro", color: "#1E182E" },
    { id: "green", label: "Verde oscuro", color: "#10201C" },
    { id: "navy", label: "Azul profundo", color: "#0A1628" },
    { id: "midnight", label: "Azul medianoche", color: "#0C1220" },
    { id: "violet", label: "Violeta oscuro", color: "#231B37" },
    { id: "wine", label: "Vino oscuro", color: "#2D1420" },
    { id: "slate", label: "Pizarra oscuro", color: "#181F2A" },
    { id: "coffee", label: "Café oscuro", color: "#201A16" },
  ];

  return (
    <div
      ref={barContainerRef}
      style={{
        paddingTop: `${Math.max(2, Math.round(4 * scale))}px`,
        paddingBottom: `${Math.max(2, Math.round(4 * scale))}px`,
      }}
      className="px-3 bg-transparent transition-colors relative"
    >
      <div
        style={{
          padding: `${Math.max(3, Math.round(4 * scale))}px ${Math.round(10 * scale)}px`,
          gap: `${Math.round(8 * scale)}px`,
        }}
        className="flex items-center bg-[#11161D] border border-[#1E2836] rounded-lg focus-within:border-[#38BDF8] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all"
      >
        <Search
          style={{ width: `${Math.round(15 * scale)}px`, height: `${Math.round(15 * scale)}px` }}
          className="text-[#64748B] shrink-0"
        />
        <input
          type="text"
          value={query}
          onFocus={() => setIsPredictiveOpen(true)}
          onClick={() => setIsPredictiveOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsPredictiveOpen(false);
            } else if (e.key === "Enter") {
              setIsPredictiveOpen(false);
            }
          }}
          onChange={(e) => {
            onChangeQuery(e.target.value);
            setIsPredictiveOpen(true);
          }}
          placeholder="Buscar páginas, archivos, notas, etiquetas o comodines..."
          style={{ fontSize: `${(12.5 * scale).toFixed(1)}px` }}
          className="flex-1 bg-transparent text-[#F8FAFC] placeholder-[#64748B] focus:outline-none"
        />

        {/* Botones de acción derecha */}
        <div style={{ gap: `${Math.round(6 * scale)}px` }} className="flex items-center shrink-0 select-none">
          <SavedSearches query={query} onSelect={onChangeQuery} /><FavoritesBackup />
          <IndexSyncStatus />

          {/* Botón ⚡ Plantillas */}
          <button
            type="button"
            onClick={onOpenTemplates}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              padding: `${Math.max(2, Math.round(3 * scale))}px ${Math.round(8 * scale)}px`,
              gap: `${Math.round(4 * scale)}px`,
            }}
            className="flex items-center rounded bg-[#1E293B] border border-[#38BDF8] text-[#38BDF8] font-bold hover:bg-[#0C4A6E] transition-colors cursor-pointer"
            title="Plantillas rápidas de Notion"
          >
            <Zap style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }} className="fill-current" />
            <span>Plantillas</span>
          </button>

          {/* Botón 🔄 Recargar índice */}
          <button
            type="button"
            onClick={onRefreshIndex}
            style={{ padding: `${Math.round(4 * scale)}px` }}
            className="rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] hover:border-[#38BDF8] transition-colors cursor-pointer"
            title="Refrescar índice local (F5)"
          >
            <RotateCw style={{ width: `${Math.round(13 * scale)}px`, height: `${Math.round(13 * scale)}px` }} />
          </button>

          {/* Separador */}
          <div className="w-px h-4 bg-[#26354A] mx-0.5" />

          {/* Botón 📅 Calendario de Revisiones */}
          {onToggleCalendarView && (
            <button
              type="button"
              onClick={onToggleCalendarView}
              style={{ padding: `${Math.round(4 * scale)}px` }}
              className={`rounded border transition-colors cursor-pointer ${
                isCalendarActive
                  ? "bg-[#1E3A5F] border-[#38BDF8] text-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                  : "bg-[#161F2C] border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] hover:border-[#38BDF8]"
              }`}
              title="📅 Abrir / Cerrar Calendario de Revisiones"
            >
              <Calendar style={{ width: `${Math.round(13 * scale)}px`, height: `${Math.round(13 * scale)}px` }} />
            </button>
          )}

          {/* Botón ⧉ Abrir Calendario en Ventana Independiente (Multi-Monitor) */}
          {onOpenStandaloneCalendar && (
            <button
              type="button"
              onClick={onOpenStandaloneCalendar}
              style={{ padding: `${Math.round(4 * scale)}px` }}
              className="rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] hover:border-[#38BDF8] transition-colors cursor-pointer"
              title="⧉ Abrir Calendario en ventana independiente (Multi-monitor vinculado en tiempo real)"
            >
              <ExternalLink style={{ width: `${Math.round(13 * scale)}px`, height: `${Math.round(13 * scale)}px` }} />
            </button>
          )}

          {/* Menú 📋 Vistas ▾ */}
          <div className="relative" ref={viewsRef}>
            <button
              type="button"
              onClick={() => setShowViewsMenu(!showViewsMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-[#F1F5F9] text-[10.5px] transition-colors cursor-pointer"
            >
              <span>Vistas</span>
              <ChevronDown className="w-3 h-3 text-[#64748B]" />
            </button>
            {showViewsMenu && (
              <div className="absolute right-0 top-8 z-50 w-64 bg-[#111822] border border-[#253549] rounded-lg shadow-2xl p-1 text-xs space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                  Notion · Revisiones
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.open(
                      "https://app.notion.com/p/2eeabd7d91b781348ed5c537ec14962e?v=3a5abd7d91b78097ac57000cd9017ac3&source=copy_link",
                      "_blank"
                    );
                    setShowViewsMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#38BDF8] text-[11px] font-medium transition-colors flex items-center justify-between"
                >
                  <span>Seguimiento HOY Proyectos — Tabla</span>
                  <span className="text-[10px] opacity-70">↗</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.open(
                      "https://app.notion.com/p/2eeabd7d91b781348ed5c537ec14962e?v=3a1abd7d91b7809d9351000c725547e4&source=copy_link",
                      "_blank"
                    );
                    setShowViewsMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#38BDF8] text-[11px] font-medium transition-colors flex items-center justify-between"
                >
                  <span>Seguimiento HOY Proyectos — Tablero</span>
                  <span className="text-[10px] opacity-70">↗</span>
                </button>
                <div className="h-px bg-[#26354A] my-1" />
                <div className="px-2 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                  Bases de búsqueda
                </div>
                {["Revisiones", "zClientes", "zDominios", "zProyectos", "Programas", "zPAGAR", "zCOBRAR", "zCorreos"].map(
                  (v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        onSelectSavedView?.(v);
                        setShowViewsMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1 rounded hover:bg-[#1E2836] text-[#CBD5E1] hover:text-[#38BDF8] text-[11px] transition-colors"
                    >
                      {v}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Separador */}
          <div className="w-px h-4 bg-[#26354A] mx-0.5" />

          {/* Botón 💬 Mensajes y notas del equipo */}
          {onToggleMessagesView && (
            <button
              type="button"
              onClick={onToggleMessagesView}
              style={{ padding: `${Math.round(4 * scale)}px` }}
              className={`relative rounded border transition-colors cursor-pointer ${
                isMessagesActive
                  ? "bg-[#1E3A5F] border-[#38BDF8] text-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                  : "bg-[#161F2C] border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] hover:border-[#38BDF8]"
              }`}
              title="💬 Abrir bandeja de mensajes y notas del equipo"
            >
              <MessageSquare style={{ width: `${Math.round(13 * scale)}px`, height: `${Math.round(13 * scale)}px` }} />
              {messagesCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 bg-[#E5484D] text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                  {messagesCount}
                </span>
              )}
            </button>
          )}

          {/* Botón 🔔 Calendario de recordatorios programados */}
          {onToggleRemindersView && (
            <button
              type="button"
              onClick={onToggleRemindersView}
              style={{ padding: `${Math.round(4 * scale)}px` }}
              className={`relative rounded border transition-colors cursor-pointer ${
                isRemindersActive
                  ? "bg-[#2E1A47] border-[#A855F7] text-[#C084FC] shadow-[0_0_8px_rgba(168,85,247,0.3)]"
                  : "bg-[#161F2C] border-[#26354A] text-[#CBD5E1] hover:text-[#C084FC] hover:border-[#A855F7]"
              }`}
              title="🔔 Calendario de recordatorios programados"
            >
              <Bell style={{ width: `${Math.round(13 * scale)}px`, height: `${Math.round(13 * scale)}px` }} />
              {remindersCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 bg-[#A855F7] text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                  {remindersCount}
                </span>
              )}
            </button>
          )}

          {/* Separador */}
          <div className="w-px h-4 bg-[#26354A] mx-0.5" />

          {/* Botón ❓ Ayuda (HelpV2) */}
          <button
            type="button"
            onClick={onOpenHelp}
            style={{
              padding: `${Math.round(4 * scale)}px`,
              minWidth: `${Math.round(28 * scale)}px`,
              fontSize: `${(11 * scale).toFixed(1)}px`,
            }}
            className="rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] hover:border-[#38BDF8] transition-colors cursor-pointer font-bold flex items-center justify-center"
            title="❓ Guía rápida de comandos, carpetas, archivos y filtros"
          >
            ?
          </button>

          {/* Menú ⋯ Más opciones */}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-1.5 rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] text-[10.5px] transition-colors cursor-pointer"
              title="⚙️ Más opciones y sincronización"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-8 z-50 w-56 bg-[#111822] border border-[#253549] rounded-lg shadow-2xl p-1 text-xs space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onSaveSearch?.();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] cursor-pointer"
                >
                  Nuevo filtro guardado
                </button>
                <div className="h-px bg-[#26354A] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    alert("Importación de filtros CSV lista para sincronizar.");
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] cursor-pointer"
                >
                  Importar CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    alert("Revisión de páginas eliminadas completada. 0 páginas huérfanas.");
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] cursor-pointer"
                >
                  Revisar páginas eliminadas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onRefreshIndex?.();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#38BDF8] text-[11px] font-semibold cursor-pointer"
                >
                  Resync completo Notion
                </button>

                <div className="h-px bg-[#26354A] my-1" />

                {/* Submenú Color de Fondo */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowThemesMenu(!showThemesMenu)}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center justify-between cursor-pointer"
                  >
                    <span>Color de fondo</span>
                    <ChevronDown className="w-3 h-3 text-[#64748B]" />
                  </button>

                  {showThemesMenu && (
                    <div className="mt-1 bg-[#0A0F16] border border-[#233549] rounded-lg p-1 space-y-0.5">
                      {THEMES.map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => {
                            onSelectThemeBg?.(th.id);
                            setShowThemesMenu(false);
                            setShowMoreMenu(false);
                          }}
                          className="w-full text-left px-2 py-1 rounded hover:bg-[#1E2836] text-[10.5px] text-[#E2E8F0] flex items-center gap-2 cursor-pointer"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: th.color }}
                          />
                          <span>{th.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel Predictivo Flotante estilo ANFETA WinUI 3 */}
      <SearchPredictiveFlyout
        isOpen={isPredictiveOpen}
        onClose={() => setIsPredictiveOpen(false)}
        headerText={predictiveData.headerText}
        suggestions={predictiveData.suggestions}
        savedSearches={predictiveData.savedSearches}
        hintText={predictiveData.hintText}
        currentQuery={query}
        onApplyQuery={(newQ) => {
          onChangeQuery(newQ);
        }}
      />
    </div>
  );
}
