"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  X,
  Save,
  Zap,
  RotateCw,
  ChevronDown,
  MoreHorizontal,
  Sparkles,
  Calendar,
  ExternalLink,
  MessageSquare,
  MessageCircle,
  Bell,
  ClipboardList,
} from "lucide-react";
import { SearchQueryTools } from "./SearchQueryTools";
import { IndexSyncStatus } from "./IndexSyncStatus";
import { FavoritesBackup } from "./FavoritesBackup";
import { SavedSearches } from "./SavedSearches";
import { SearchMatchOptions } from "@/services/advancedQuery";
import {
  ActiveSearchCriterion,
  InlineSearchSuggestion,
  computeInlineSuggestions,
} from "@/lib/inlinePredictiveEngine";

interface SearchInputBarProps {
  shortcutControl?: React.ReactNode;
  currentUser?: string;
  onSubmitSearch?: () => void;
  query: string;
  onChangeQuery: (q: string) => void;
  searchOptions?: SearchMatchOptions;
  onToggleSearchOption?: (key: keyof SearchMatchOptions) => void;
  onSaveSearch?: () => void;
  onOpenTemplates?: () => void;
  onRefreshIndex?: () => void;
  isSyncingNotion?: boolean;
  onSelectSavedView?: (view: string) => void;
  onOpenHelp?: () => void;
  onSelectThemeBg?: (theme: string) => void;
  textScale?: string;
  searchIndex?: any[];
  filteredItems?: any[];
  activeCriteria?: ActiveSearchCriterion[];
  onRemoveCriterion?: (id: string) => void;
  onSelectSuggestion?: (sug: InlineSearchSuggestion) => void;
  onExcludeSuggestion?: (sug: InlineSearchSuggestion) => void;
  onSaveToPending?: () => void;
  onToggleCalendarView?: () => void;
  isCalendarActive?: boolean;
  onOpenStandaloneCalendar?: () => void;
  onToggleMessagesView?: () => void;
  isMessagesActive?: boolean;
  messagesCount?: number;
  onToggleRemindersView?: () => void;
  isRemindersActive?: boolean;
  remindersCount?: number;
  onOpenWhatsappGroups?: () => void;
  onOpenResponseCleanup?: () => void;
}

export function SearchInputBar({
  shortcutControl,
  currentUser = "",
  onSubmitSearch,
  query,
  onChangeQuery,
  searchOptions,
  onToggleSearchOption,
  onSaveSearch,
  onOpenTemplates,
  onRefreshIndex,
  isSyncingNotion = false,
  onSelectSavedView,
  onOpenHelp,
  onSelectThemeBg,
  textScale = "100%",
  searchIndex = [],
  filteredItems = [],
  activeCriteria = [],
  onRemoveCriterion,
  onSelectSuggestion,
  onExcludeSuggestion,
  onSaveToPending,
  onToggleCalendarView,
  isCalendarActive = false,
  onOpenStandaloneCalendar,
  onToggleMessagesView,
  isMessagesActive = false,
  messagesCount = 0,
  onToggleRemindersView,
  isRemindersActive = false,
  remindersCount = 0,
  onOpenWhatsappGroups,
  onOpenResponseCleanup,
}: SearchInputBarProps) {
  const [showMoreSuggestions, setShowMoreSuggestions] = useState(false);
  const barContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputRowRef=useRef<HTMLDivElement>(null);
  const sizingRef=useRef<HTMLDivElement>(null);
  const [maxVisible,setMaxVisible]=useState(0);
  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  // Predictivo dentro de la misma barra calculado en memoria con base en los resultados actuales
  // Si filteredItems es 0, no sustituye por todo el índice (Punto 4)
  const suggestions = useMemo(() => {
    const dataset = filteredItems !== undefined ? filteredItems : searchIndex;
    return computeInlineSuggestions(query, dataset, activeCriteria);
  }, [query, filteredItems, searchIndex, activeCriteria]);

  useEffect(()=>{
    const row = inputRowRef.current;
    const sizing = sizingRef.current;
    if (!row || !sizing) return;
    let rafId: number | null = null;
    const measure=()=>{
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!row || !sizing) return;
        const rowWidth = row.clientWidth;
        if (!rowWidth) return;
        const fixed=Array.from(row.children).filter(el=>el!==inputRef.current&&!el.hasAttribute('data-inline-suggestions')).reduce((sum,el)=>sum+(el as HTMLElement).offsetWidth,0);
      const available=row.clientWidth-fixed-200-Array.from(row.children).length*8-20;
        const widths=Array.from(sizing.children).map(el=>(el as HTMLElement).offsetWidth+6);
      let count=0,used=0;
      for(let i=0;i<Math.min(3,widths.length);i++){const next=used+widths[i];if(next+(i+1<widths.length?44:0)>available)break;used=next;count++;}
        setMaxVisible(count);
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  },[suggestions.length,activeCriteria.length,scale]);

  const visibleSuggestions = suggestions.slice(0, maxVisible);
  const remainingSuggestions = suggestions.slice(maxVisible);

  return (
    <div
      ref={barContainerRef}
      style={{
        paddingTop: `${Math.max(2, Math.round(3 * scale))}px`,
        paddingBottom: `${Math.max(2, Math.round(3 * scale))}px`,
      }}
      className="px-3 bg-transparent transition-colors relative"
    >
      <div ref={inputRowRef}
        style={{
          padding: `${Math.max(3, Math.round(4 * scale))}px ${Math.round(8 * scale)}px`,
          gap: `${Math.round(6 * scale)}px`,
        }}
        className="flex items-center bg-[#11161D] border border-[#1E2836] rounded-lg focus-within:border-[#38BDF8] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all min-w-0"
      >
        {shortcutControl}

        <button
          type="button"
          onClick={onSubmitSearch}
          aria-label="Buscar"
          className="cursor-pointer text-[#64748B] hover:text-cyan-300 transition shrink-0"
        >
          <Search
            style={{ width: `${Math.round(15 * scale)}px`, height: `${Math.round(15 * scale)}px` }}
          />
        </button>

        {/* 1. Criterios Activos Seleccionados (Chips con X) */}
        {activeCriteria && activeCriteria.length > 0 && (
          <div className="flex max-w-[25%] items-center gap-1.5 overflow-x-auto shrink-0 select-none">
            {activeCriteria.map((crit) => (
              <span
                key={crit.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-950/80 border border-cyan-500/80 text-cyan-200 animate-in fade-in"
              >
                <span>{crit.icon || "🏷️"}</span>
                <span>{crit.label}</span>
                <button
                  type="button"
                  onClick={() => {
                    onRemoveCriterion?.(crit.id);
                    inputRef.current?.focus();
                  }}
                  className="text-cyan-400 hover:text-white hover:bg-cyan-800 rounded px-1 ml-0.5 transition cursor-pointer"
                  title="Quitar criterio"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 2. Campo de Texto Principal (Prioridad de Foco y Cursor) */}
        <input
          ref={inputRef}
          id="anfeta-search-input"
          data-search-query="true"
          aria-label="Buscar páginas y archivos. Tab selecciona el primer resultado"
          type="text"
          value={query}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onChangeQuery("");
            } else if (e.key === "Enter") {
              e.preventDefault();
              onSubmitSearch?.();
            }
          }}
          onChange={(e) => onChangeQuery(e.target.value)}
          placeholder={
            activeCriteria && activeCriteria.length > 0
              ? "Añadir más términos..."
              : "Buscar páginas, archivos, notas, etiquetas o comodines..."
          }
          style={{ fontSize: `${(12.5 * scale).toFixed(1)}px` }}
          className="bg-transparent text-[#F8FAFC] placeholder-[#64748B] focus:outline-none min-w-[140px] flex-shrink flex-1"
        />

        {/* 3. Sugerencias Predictivas DENTRO DEL CONTENEDOR EN LA MISMA FILA */}
        {query.trim().length > 0 && suggestions.length > 0 && (
          <div data-inline-suggestions className="flex items-center gap-1.5 shrink-0 select-none py-0.5">
            {visibleSuggestions.map((sug) => (
              <div
                key={sug.id}
                className="inline-flex items-center rounded text-[11px] bg-[#1A2536] border border-[#2A3B52] overflow-hidden shrink-0 transition"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectSuggestion?.(sug);
                    inputRef.current?.focus();
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-cyan-950 hover:text-cyan-300 text-slate-300 transition cursor-pointer"
                  title={`Incluir +${sug.label} (${sug.count} coincidencias)`}
                >
                  <span className="text-cyan-400 font-bold">+</span>
                  <span>{sug.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono bg-[#111824] px-1 rounded">
                    {sug.count}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onExcludeSuggestion) {
                      onExcludeSuggestion(sug);
                    } else {
                      const excludeToken = `-${sug.label.toLowerCase()}`;
                      const trimmed = (query || "").trim();
                      onChangeQuery(trimmed ? `${trimmed} ${excludeToken}` : excludeToken);
                    }
                    inputRef.current?.focus();
                  }}
                  className="px-1.5 py-0.5 text-rose-400 hover:text-white hover:bg-rose-900/70 border-l border-[#2A3B52] font-bold cursor-pointer transition text-xs"
                  title={`Excluir -${sug.label} de la búsqueda`}
                >
                  -
                </button>
              </div>
            ))}

            {/* Botón compacto +N con las sugerencias restantes */}
            {remainingSuggestions.length > 0 && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMoreSuggestions(!showMoreSuggestions)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#182333] hover:bg-[#202E42] text-slate-400 hover:text-cyan-300 border border-[#26374D] cursor-pointer"
                  title={`${remainingSuggestions.length} sugerencias más...`}
                >
                  +{remainingSuggestions.length}
                </button>
                {showMoreSuggestions && (
                  <div className="absolute right-0 mt-1 w-52 bg-[#111722] border border-cyan-800 rounded-lg shadow-2xl z-50 p-1 space-y-1">
                    {remainingSuggestions.map((sug) => (
                      <div
                        key={sug.id}
                        className="w-full flex items-center justify-between px-2 py-1 rounded text-xs text-slate-300 hover:bg-[#1A2536] group"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSuggestion?.(sug);
                            setShowMoreSuggestions(false);
                            inputRef.current?.focus();
                          }}
                          className="flex-1 text-left flex items-center gap-1.5 cursor-pointer"
                          title={`Incluir +${sug.label}`}
                        >
                          <span className="text-cyan-400 font-bold">+</span>
                          <span>{sug.icon || ""} {sug.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono bg-[#0D131D] px-1 rounded ml-auto mr-1">
                            {sug.count}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onExcludeSuggestion) {
                              onExcludeSuggestion(sug);
                            } else {
                              const excludeToken = `-${sug.label.toLowerCase()}`;
                              const trimmed = (query || "").trim();
                              onChangeQuery(trimmed ? `${trimmed} ${excludeToken}` : excludeToken);
                            }
                            setShowMoreSuggestions(false);
                            inputRef.current?.focus();
                          }}
                          className="px-1.5 py-0.5 text-rose-400 hover:text-white hover:bg-rose-900/80 rounded font-bold cursor-pointer"
                          title={`Excluir -${sug.label}`}
                        >
                          -
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Botón Limpiar Búsqueda */}
        {query && (
          <button
            type="button"
            onClick={() => {
              onChangeQuery("");
              inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-cyan-300 rounded-md transition-colors shrink-0 cursor-pointer"
            title="Limpiar búsqueda (Esc)"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 5. Modos de Coincidencia (Aa, "w", .*) */}
        {onToggleSearchOption && (
          <div style={{ gap: `${Math.round(2 * scale)}px` }} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onToggleSearchOption("matchCase")}
              style={{
                fontSize: `${(10 * scale).toFixed(1)}px`,
                padding: `${Math.max(1, Math.round(2 * scale))}px ${Math.round(4 * scale)}px`,
              }}
              className={`rounded font-mono font-bold transition-all border cursor-pointer ${
                searchOptions?.matchCase
                  ? "bg-[#0284C7]/20 border-[#38BDF8] text-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                  : "bg-transparent border-[#26354A] text-[#64748B] hover:text-[#94A3B8] hover:border-[#475569]"
              }`}
              title="Coincidir mayúsculas y minúsculas (Match Case)"
            >
              Aa
            </button>
            <button
              type="button"
              onClick={() => onToggleSearchOption("matchWholeWord")}
              style={{
                fontSize: `${(10 * scale).toFixed(1)}px`,
                padding: `${Math.max(1, Math.round(2 * scale))}px ${Math.round(4 * scale)}px`,
              }}
              className={`rounded font-mono font-bold transition-all border cursor-pointer ${
                searchOptions?.matchWholeWord
                  ? "bg-[#0284C7]/20 border-[#38BDF8] text-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                  : "bg-transparent border-[#26354A] text-[#64748B] hover:text-[#94A3B8] hover:border-[#475569]"
              }`}
              title="Palabra completa (Whole Word)"
            >
              "w"
            </button>
            <button
              type="button"
              onClick={() => onToggleSearchOption("matchRegex")}
              style={{
                fontSize: `${(10 * scale).toFixed(1)}px`,
                padding: `${Math.max(1, Math.round(2 * scale))}px ${Math.round(4 * scale)}px`,
              }}
              className={`rounded font-mono font-bold transition-all border cursor-pointer ${
                searchOptions?.matchRegex
                  ? "bg-[#0284C7]/20 border-[#38BDF8] text-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                  : "bg-transparent border-[#26354A] text-[#64748B] hover:text-[#94A3B8] hover:border-[#475569]"
              }`}
              title="Expresión Regular (Regex: .*)"
            >
              .*
            </button>
          </div>
        )}

        {/* 6. Utilidades Rápidas de Búsqueda */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0 select-none">
          {onOpenTemplates&&<button type="button" onClick={onOpenTemplates} title="Abrir catálogo de plantillas" aria-label="Crear con plantilla" className="flex items-center gap-1 rounded border border-cyan-700 bg-cyan-950/50 px-2 py-1 text-xs font-semibold text-cyan-200"><Zap className="h-3.5 w-3.5"/><span>Crear con plantilla</span></button>}
          {onSaveToPending && (
            <button
              type="button"
              onClick={onSaveToPending}
              title="Guardar búsqueda o texto actual como Pendiente"
              aria-label="Guardar en pendientes"
              className="flex items-center gap-1 rounded border border-amber-600/70 bg-amber-950/40 hover:bg-amber-900/60 px-2 py-1 text-xs font-semibold text-amber-200 transition cursor-pointer"
            >
              <ClipboardList className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">A Pendientes</span>
            </button>
          )}
          <SavedSearches query={query} onSelect={onChangeQuery} />
          <FavoritesBackup />
          <IndexSyncStatus owner={currentUser} />
        </div>
      </div>
      <div ref={sizingRef} aria-hidden="true" className="pointer-events-none invisible absolute flex whitespace-nowrap overflow-hidden" style={{top:0,left:0,width:1,height:1}}>{suggestions.map(sug=><span key={sug.id} className="flex shrink-0 items-center gap-1 border px-2 py-0.5 text-[11px]"><span>+</span><span>{sug.label}</span><span className="px-1 text-[10px] font-mono">{sug.count}</span></span>)}</div>
    </div>
  );
}
