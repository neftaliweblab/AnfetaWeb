"use client";

import { SearchChoice, type SearchChoiceOption } from "./SearchChoice";
import { SEARCH_SORTS, SEARCH_SORT_DESCRIPTIONS } from "@/lib/searchPresentation";
import { normalizePerson, PERSON_ALIASES } from "@/services/identityNormalizer";
import React, { useState, useRef, useEffect } from "react";
import {
  Check,
  User,
  RefreshCw,
  Loader2,
  Sparkles,
  ChevronDown,
  Cloud,
  Layers,
  Calendar,
  X,
} from "lucide-react";

export interface UserOption {
  code: string;
  name: string;
  email?: string;
}

interface SearchConfigRowProps {
  onResetFilters?:()=>void;
  // Ordenar
  resultSort?: string;
  onChangeResultSort?: (value: string) => void;
  // Persona
  currentUser?: string;
  onChangeCurrentUser?: (user: string) => void;
  // Mes
  selectedMonth: string;
  currentMonth?: string;
  onChangeMonth: (m: string) => void;
  // Agrupar
  groupBy: string;
  onChangeGroupBy: (group: string) => void;
  // Ocultar terminadas (3 Estados: none, finished, all)
  hideTerminated?: boolean;
  onToggleHideTerminated?: () => void;
  hideTerminatedMode?: "none" | "finished" | "all";
  onChangeHideTerminatedMode?: (mode: "none" | "finished" | "all") => void;
  // Cobros y Pagos
  billingFilter?: "include" | "exclude" | "only";
  onChangeBillingFilter?: (val: "include" | "exclude" | "only") => void;
  paymentFilter?: "include" | "exclude" | "only";
  onChangePaymentFilter?: (val: "include" | "exclude" | "only") => void;
  // Herramientas
  onSyncNotion?: () => Promise<void> | void;
  isSyncingNotion?: boolean;
  onOpenResponseCleanup?: () => void;
  onSyncDropbox?: () => Promise<void> | void;
  isSyncingDropbox?: boolean;
  onOpenHelp?: () => void;
  hasNotionToken?: boolean;
  hasDropboxToken?: boolean;
  onOpenSettings?: () => void;
  onOpenDropboxConnect?: () => void;
  selectedTag?: string;
  onChangeTag?: (tag: string) => void;
  customTag?: string;
  onChangeCustomTag?: (tag: string) => void;
  // Toggles de paneles
  isPendientesOpen: boolean;
  onTogglePendientes: () => void;
  pendingCount: number;
  isFiltersOpen: boolean;
  onToggleFilters: () => void;
  isDetailsOpen: boolean;
  onToggleDetails: () => void;
  // Zoom & Vista
  viewZoom: "list" | "small" | "medium" | "large";
  onChangeViewZoom: (zoom: "list" | "small" | "medium" | "large") => void;
  textScale?: string;
  onChangeTextScale?: (scale: string) => void;
  notification?: { type: "info" | "success" | "warning" | "error"; text: string } | null;
  onDismissNotification?: () => void;
}

const MONTHS = [
  "Todos",
  "01ENE",
  "02FEB",
  "03MAR",
  "04ABR",
  "05MAY",
  "06JUN",
  "07JUL",
  "08AGO",
  "09SEP",
  "10OCT",
  "11NOV",
  "12DIC",
];

const VIEW_ZOOM_LEVELS: ("list" | "small" | "medium" | "large")[] = [
  "list",
  "small",
  "medium",
  "large",
];

const VIEW_ZOOM_LABELS: Record<string, string> = {
  list: "Lista",
  small: "Pequeña",
  medium: "Mediana",
  large: "Grande",
};

// 7 opciones de agrupación limpias, sin variantes híbridas ni exclusiones ocultas
const CLEAN_GROUP_OPTIONS = [
  { value: "none", label: "Ninguno", desc: "Lista continua ordenada por relevancia y activas primero" },
  { value: "database", label: "Base de datos", desc: "Separa Revisiones, Clientes, Dominios y demás bases" },
  { value: "domain", label: "Dominio", desc: "Agrupa por sitio web o proyecto raíz" },
  { value: "status", label: "Estado", desc: "Por hacer, En revisión, Terminadas, Suspendidas" },
  { value: "person", label: "Responsable", desc: "Separado por cada ejecutor asignado" },
  { value: "project_type", label: "Tipo de proyecto", desc: "WEB (.webs), ADS (.ads), SEO, APP, PROG..." },
  { value: "month", label: "Mes", desc: "Conserva todos los meses; actual primero" },
];

function SearchConfigRowComponent({
  onResetFilters,
  resultSort = "scheduled-today",
  onChangeResultSort,
  currentUser,
  onChangeCurrentUser,
  selectedMonth,
  currentMonth,
  onChangeMonth,
  groupBy,
  onChangeGroupBy,
  hideTerminated = false,
  onToggleHideTerminated,
  hideTerminatedMode = "none",
  onChangeHideTerminatedMode,
  billingFilter = "include",
  onChangeBillingFilter,
  paymentFilter = "include",
  onChangePaymentFilter,
  onSyncNotion,
  isSyncingNotion = false,
  onOpenResponseCleanup,
  onSyncDropbox,
  isSyncingDropbox = false,
  onOpenHelp,
  hasNotionToken,
  hasDropboxToken,
  onOpenSettings,
  onOpenDropboxConnect,
  selectedTag = "Ninguno",
  onChangeTag,
  customTag,
  onChangeCustomTag,
  isPendientesOpen,
  onTogglePendientes,
  pendingCount,
  isFiltersOpen,
  onToggleFilters,
  isDetailsOpen,
  onToggleDetails,
  viewZoom,
  onChangeViewZoom,
  textScale = "100%",
  onChangeTextScale,
  notification,
  onDismissNotification,
}: SearchConfigRowProps) {
  const [showAgruparMenu, setShowAgruparMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const agruparRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  const TEAM_USERS = [
    { code: "eed11", name: "Edwin" },
    { code: "nneft", name: "Neftali" },
    { code: "jjohn", name: "John" },
    { code: "kkarl", name: "Karla" },
    { code: "bbria", name: "Brian" },
    { code: "ggena", name: "Genaro" },
    { code: "iisai", name: "Isaias" },
    { code: "eedua", name: "Eduardo" },
    { code: "ssote", name: "Sotelo" },
    { code: "aacal", name: "Acalli" },
  ];

  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  // Cerrar menús al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (agruparRef.current && !agruparRef.current.contains(event.target as Node)) {
        setShowAgruparMenu(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setShowToolsMenu(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowAgruparMenu(false);
        setShowToolsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(()=>{if(showAgruparMenu){const frame=requestAnimationFrame(()=>agruparRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus());return()=>cancelAnimationFrame(frame);}},[showAgruparMenu]);
  const handleZoomOut = () => {
    const idx = VIEW_ZOOM_LEVELS.indexOf(viewZoom);
    if (idx > 0) onChangeViewZoom(VIEW_ZOOM_LEVELS[idx - 1]);
  };

  const handleZoomIn = () => {
    const idx = VIEW_ZOOM_LEVELS.indexOf(viewZoom);
    if (idx < VIEW_ZOOM_LEVELS.length - 1) onChangeViewZoom(VIEW_ZOOM_LEVELS[idx + 1]);
  };

  // Label amigable para la opción de agrupación actual
  const currentAgruparLabel =
    CLEAN_GROUP_OPTIONS.find((opt) => opt.value === groupBy)?.label ||
    (groupBy.includes("domain") ? "Dominio" : groupBy.includes("area") ? "Tipo de proyecto" : groupBy);

  return (
    <div
      style={{
        minHeight: `${Math.round(32 * scale)}px`,
        paddingTop: `${Math.max(2, Math.round(3 * scale))}px`,
        paddingBottom: `${Math.max(2, Math.round(3 * scale))}px`,
      }}
      className="flex flex-wrap items-center justify-between px-3 bg-[#0F141C] border-y border-[#1E2836] select-none gap-2 transition-all relative z-20"
    >
      {/* FRANJA D: Controles de Trabajo Principales */}
      <div
        style={{ gap: `${Math.round(6 * scale)}px` }}
        className="flex flex-wrap items-center flex-1 min-w-0"
      >
        {/* 1. Ordenar */}
        <div className="flex shrink-0 items-center gap-1 text-xs text-cyan-300">
          <span style={{ fontSize: `${(10.5 * scale).toFixed(1)}px` }} className="text-slate-400">
            Ordenar:
          </span>
          <SearchChoice
            label="Orden de resultados"
            value={resultSort}
            onChange={(value) => onChangeResultSort?.(value)}
            scale={scale}
            description="Fecha por hacer es el horario del calendario. Última modificación indica cuándo se editó la página."
            options={SEARCH_SORTS.map(([value, label]) => ({
              value,
              label,
              description: SEARCH_SORT_DESCRIPTIONS[value],
              group: value.startsWith("scheduled")
                ? "Horario de trabajo"
                : value.startsWith("modified")
                ? "Edición de páginas"
                : "Otros órdenes",
            }))}
          />
          <button
            type="button"
            onClick={() => {
              if (resultSort === "name-asc") onChangeResultSort?.("name-desc");
              else if (resultSort === "name-desc") onChangeResultSort?.("name-asc");
              else onChangeResultSort?.("name-asc");
            }}
            style={{
              minHeight: `${Math.round(24 * scale)}px`,
              fontSize: `${(9.5 * scale).toFixed(1)}px`,
              padding: `0 ${Math.round(5 * scale)}px`,
            }}
            className="rounded border border-[#25466A] bg-[#14233A] text-cyan-300 hover:border-cyan-400 font-mono font-bold cursor-pointer transition-colors"
            title="Alternar orden rápido por Título (A-Z / Z-A)"
          >
            {resultSort === "name-desc" ? "Z→A" : "A→Z"}
          </button>
        </div>

        <div className="h-4 w-px bg-[#26354A] mx-0.5 shrink-0" />

        {/* 2. Persona */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span
            style={{ fontSize: `${(10.5 * scale).toFixed(1)}px` }}
            className="text-slate-400 flex items-center gap-1"
          >
            <User style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }} className="text-cyan-400" />
            Persona:
          </span>
          <select
            value={currentUser === "__all__" ? "__all__" : PERSON_ALIASES[normalizePerson(currentUser || "")]?.[0] || ""}
            onChange={(e) => onChangeCurrentUser?.(e.target.value)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(25 * scale)}px`,
              padding: `${Math.round(1 * scale)}px ${Math.round(5 * scale)}px`,
            }}
            className="bg-[#141B26] text-[#38BDF8] font-bold border border-[#38BDF8]/60 hover:border-[#38BDF8] rounded focus:outline-none cursor-pointer"
            title="Filtrar resultados por persona; no cambia la sesión activa"
          >
            {TEAM_USERS.map((u) => (
              <option key={u.code} value={u.code}>
                👤 {u.name} ({u.code})
              </option>
            ))}
            <option value="__all__">🌐 Todas las personas</option>
          </select>
        </div>

        <div className="h-4 w-px bg-[#26354A] mx-0.5 shrink-0" />

        {/* 3. Mes */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(10.5 * scale).toFixed(1)}px` }} className="text-slate-400">
            Mes:
          </span>
          <SearchChoice
            label="Filtrar por mes"
            value={selectedMonth}
            onChange={onChangeMonth}
            scale={scale}
            options={[
              {
                value: "Todos",
                label: "Todos · actual primero" + (currentMonth ? " (" + currentMonth + ")" : ""),
                description: "Muestra todos los meses sin ocultar históricos; el mes en curso aparece primero.",
              },
              ...MONTHS.filter((m) => m !== "Todos").map((m) => ({ value: m, label: m })),
            ]}
          />
        </div>

        <div className="h-4 w-px bg-[#26354A] mx-0.5 shrink-0" />

        {onResetFilters&&<button type="button" onClick={onResetFilters} className="shrink-0 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300" title="Quitar filtros sin borrar la búsqueda">Restablecer filtros</button>}
        {/* 4. Agrupar (Menú Anclado Simplificado) */}
        <div ref={agruparRef} className="relative shrink-0" onKeyDown={event=>{
 if(!showAgruparMenu)return;
 const buttons=Array.from(agruparRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')||[]);
 const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
 if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setShowAgruparMenu(false);agruparRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();}
 }}>
          <button
            type="button"
            aria-haspopup="menu" aria-expanded={showAgruparMenu} onClick={() => setShowAgruparMenu(!showAgruparMenu)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(25 * scale)}px`,
              padding: `0 ${Math.round(7 * scale)}px`,
              gap: `${Math.round(4 * scale)}px`,
            }}
            className="flex items-center rounded bg-[#162232] hover:bg-[#1E2E42] border border-cyan-700/80 text-cyan-300 font-semibold cursor-pointer transition shadow-sm"
            title="Organizar resultados visualmente sin filtrar datos"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Agrupar:</span>
            <span className="text-white font-normal">{currentAgruparLabel}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {/* Popover Anclado */}
          {showAgruparMenu && (
            <div className="absolute left-0 mt-1 w-64 bg-[#111722] border border-cyan-700/90 rounded-lg shadow-2xl z-50 p-1.5 animate-in fade-in select-none">
              <div className="px-2 py-1 text-[10px] font-bold text-cyan-400 uppercase tracking-wider border-b border-[#1E2A3C] mb-1 flex items-center justify-between">
                <span>Organizar resultados</span>
                <span className="text-slate-500 font-mono text-[9px]">Esc para cerrar</span>
              </div>
              <div className="space-y-0.5">
                {CLEAN_GROUP_OPTIONS.map((opt) => {
                  const isSelected = groupBy === opt.value || (opt.value === "none" && (!groupBy || groupBy === "none"));
                  return (
                    <button
                      key={opt.value}
                      role="menuitemradio" aria-checked={isSelected}
                      type="button"
                      onClick={() => {
                        onChangeGroupBy(opt.value);
                        setShowAgruparMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-cyan-950/80 text-white font-semibold border border-cyan-800"
                          : "text-slate-300 hover:bg-[#1A2536] hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-[11px]">{opt.label}</div>
                        <div className="text-[10px] text-slate-400">{opt.desc}</div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#26354A] mx-0.5 shrink-0" />

        {/* 5. Control "Ocultar Terminadas / Finalizadas" (3 Estados) */}
        {(onChangeHideTerminatedMode || onToggleHideTerminated) && (
          <button
            type="button"
            onClick={() => {
              if (onChangeHideTerminatedMode) {
                const next =
                  hideTerminatedMode === "none"
                    ? "finished"
                    : hideTerminatedMode === "finished"
                    ? "all"
                    : "none";
                onChangeHideTerminatedMode(next);
              } else if (onToggleHideTerminated) {
                onToggleHideTerminated();
              }
            }}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(25 * scale)}px`,
              padding: `0 ${Math.round(8 * scale)}px`,
            }}
            className={`flex items-center gap-1 rounded font-medium border transition cursor-pointer ${
              hideTerminatedMode === "all" || (!hideTerminatedMode && hideTerminated)
                ? "bg-rose-950/80 text-rose-200 border-rose-600 shadow-sm"
                : hideTerminatedMode === "finished"
                ? "bg-amber-950/80 text-amber-200 border-amber-600 shadow-sm"
                : "bg-[#141B26] text-slate-300 hover:text-white border-[#24344A] hover:bg-[#1A2536]"
            }`}
            title="Alternar filtro: Mostrar todas -> Ocultar solo finalizadas (z / FIN) -> Ocultar todas las concluidas (TER + FIN)"
          >
            <span>
              {hideTerminatedMode === "all" || (!hideTerminatedMode && hideTerminated)
                ? "🚫"
                : hideTerminatedMode === "finished"
                ? "🔒"
                : "👁️"}
            </span>
            <span>
              {hideTerminatedMode === "all" || (!hideTerminatedMode && hideTerminated)
                ? "Ocultar todas (TER+FIN)"
                : hideTerminatedMode === "finished"
                ? "Ocultar finalizadas (z)"
                : "Mostrar todas"}
            </span>
          </button>
        )}

        {/* 6. Controles Cobros y Pagos Independientes (3 Estados) */}
        {onChangeBillingFilter && onChangePaymentFilter && (
          <div className="flex items-center gap-1 bg-[#101722] p-0.5 rounded border border-[#202E42] shrink-0">
            {/* Cobros */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-medium px-1">Cobros:</span>
              <button
                type="button"
                onClick={() => {
                  const next = billingFilter === "include" ? "only" : billingFilter === "only" ? "exclude" : "include";
                  onChangeBillingFilter(next);
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                  billingFilter === "only"
                    ? "bg-emerald-600 text-white border-emerald-400 shadow-sm"
                    : billingFilter === "exclude"
                    ? "bg-rose-950 text-rose-300 border-rose-800"
                    : "bg-[#16202E] text-emerald-300 border-[#22354A] hover:bg-[#1D2B3E]"
                }`}
                title="Alternar filtro de cobros: Incluir -> Solo -> Excluir"
              >
                {billingFilter === "only" ? "Solo" : billingFilter === "exclude" ? "Excluir" : "Incluir"}
              </button>
            </div>

            <div className="h-3 w-px bg-[#26354A] mx-0.5" />

            {/* Pagos */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-medium px-1">Pagos:</span>
              <button
                type="button"
                onClick={() => {
                  const next = paymentFilter === "include" ? "only" : paymentFilter === "only" ? "exclude" : "include";
                  onChangePaymentFilter(next);
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                  paymentFilter === "only"
                    ? "bg-amber-600 text-white border-amber-400 shadow-sm"
                    : paymentFilter === "exclude"
                    ? "bg-rose-950 text-rose-300 border-rose-800"
                    : "bg-[#16202E] text-amber-300 border-[#22354A] hover:bg-[#1D2B3E]"
                }`}
                title="Alternar filtro de pagos: Incluir -> Solo -> Excluir"
              >
                {paymentFilter === "only" ? "Solo" : paymentFilter === "exclude" ? "Excluir" : "Incluir"}
              </button>
            </div>
          </div>
        )}

        <div className="h-4 w-px bg-[#26354A] mx-0.5 shrink-0" />

        {/* 7. Menú Herramientas Técnicas Unificado */}
        <div ref={toolsRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowToolsMenu(!showToolsMenu)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(25 * scale)}px`,
              padding: `0 ${Math.round(7 * scale)}px`,
            }}
            className="flex items-center gap-1 rounded bg-[#141B26] hover:bg-[#1C283A] text-slate-300 hover:text-white border border-[#24344A] cursor-pointer transition"
            title="Herramientas técnicas de sincronización y diagnóstico"
          >
            <span>⚙ Herramientas</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showToolsMenu && (
            <div className="absolute right-0 mt-1 w-56 bg-[#111722] border border-cyan-800 rounded-lg shadow-2xl z-50 p-1.5 text-xs space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-cyan-400 border-b border-[#1E293B]">
                Acciones técnicas
              </div>
              {onSyncNotion && (
                <button
                  type="button"
                  onClick={() => {
                    onSyncNotion();
                    setShowToolsMenu(false);
                  }}
                  disabled={isSyncingNotion}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1A2536] text-slate-300 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    {isSyncingNotion ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{isSyncingNotion ? "Sincronizando..." : "Sincronizar Notion"}</span>
                  </span>
                  {hasNotionToken && <span className="text-[9px] text-emerald-400">OK</span>}
                </button>
              )}
              {onSyncDropbox && (
                <button
                  type="button"
                  onClick={() => {
                    onSyncDropbox();
                    setShowToolsMenu(false);
                  }}
                  disabled={isSyncingDropbox}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1A2536] text-slate-300 hover:text-white flex items-center gap-2"
                >
                  <Cloud className="w-3.5 h-3.5 text-sky-400" />
                  <span>Sincronizar Dropbox</span>
                </button>
              )}
              {onOpenResponseCleanup && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenResponseCleanup();
                    setShowToolsMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1A2536] text-slate-300 hover:text-white flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Limpiar páginas [RESPUESTA]</span>
                </button>
              )}
              {onOpenHelp && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenHelp();
                    setShowToolsMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1A2536] text-slate-300 hover:text-white flex items-center gap-2 border-t border-[#1E293B] mt-1 pt-1"
                >
                  <span>🩺</span>
                  <span>Diagnóstico y atajos</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lado Derecho: Conmutadores de Paneles y Nivel de Vista */}
      <div style={{ gap: `${Math.round(6 * scale)}px` }} className="flex items-center shrink-0">
        {/* Toggle Pendientes */}
        <button
          type="button"
          onClick={onTogglePendientes}
          style={{
            fontSize: `${(10.5 * scale).toFixed(1)}px`,
            minHeight: `${Math.round(25 * scale)}px`,
            padding: `0 ${Math.round(6 * scale)}px`,
          }}
          className={`flex items-center gap-1 rounded font-medium border transition cursor-pointer ${
            isPendientesOpen
              ? "bg-cyan-950 text-cyan-300 border-cyan-800 shadow-sm"
              : "bg-[#121822] text-slate-400 hover:text-white border-[#202E42]"
          }`}
          title="Abrir o cerrar panel de Pendientes"
        >
          <span>📌 Pendientes</span>
          <span className="text-[10px] font-bold bg-[#1C283A] text-slate-300 px-1 rounded font-mono">
            {pendingCount}
          </span>
        </button>

        {/* Toggle Filtros Rápidos */}
        <button
          type="button"
          onClick={onToggleFilters}
          style={{
            fontSize: `${(10.5 * scale).toFixed(1)}px`,
            minHeight: `${Math.round(25 * scale)}px`,
            padding: `0 ${Math.round(6 * scale)}px`,
          }}
          className={`flex items-center gap-1 rounded font-medium border transition cursor-pointer ${
            isFiltersOpen
              ? "bg-cyan-950 text-cyan-300 border-cyan-800 shadow-sm"
              : "bg-[#121822] text-slate-400 hover:text-white border-[#202E42]"
          }`}
          title="Abrir o cerrar panel de Filtros y Búsquedas Rápidas"
        >
          <span>⚡ Filtros</span>
        </button>

        {/* Toggle Detalles / Agenda */}
        <button
          type="button"
          onClick={onToggleDetails}
          style={{
            fontSize: `${(10.5 * scale).toFixed(1)}px`,
            minHeight: `${Math.round(25 * scale)}px`,
            padding: `0 ${Math.round(6 * scale)}px`,
          }}
          className={`flex items-center gap-1 rounded font-medium border transition cursor-pointer ${
            isDetailsOpen
              ? "bg-cyan-950 text-cyan-300 border-cyan-800 shadow-sm"
              : "bg-[#121822] text-slate-400 hover:text-white border-[#202E42]"
          }`}
          title="Abrir o cerrar panel de Detalles y Calendario Individual"
        >
          <span>📖 Detalles</span>
        </button>

        <div className="h-4 w-px bg-[#26354A] mx-0.5 shrink-0" />

        {/* Vista: - [Lista] + */}
        <div style={{ gap: `${Math.round(3 * scale)}px` }} className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleZoomOut}
            style={{
              width: `${Math.round(20 * scale)}px`,
              height: `${Math.round(22 * scale)}px`,
              fontSize: `${(11 * scale).toFixed(1)}px`,
            }}
            className="flex items-center justify-center rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] font-bold cursor-pointer"
            title="Reducir tamaño de lista"
          >
            −
          </button>
          <span
            style={{
              fontSize: `${(10 * scale).toFixed(1)}px`,
              minWidth: `${Math.round(48 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(4 * scale)}px`,
            }}
            className="rounded bg-[#161F2C] border border-[#26354A] text-[#FFFFFF] font-medium text-center"
          >
            {VIEW_ZOOM_LABELS[viewZoom] || "Lista"}
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            style={{
              width: `${Math.round(20 * scale)}px`,
              height: `${Math.round(22 * scale)}px`,
              fontSize: `${(11 * scale).toFixed(1)}px`,
            }}
            className="flex items-center justify-center rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] font-bold cursor-pointer"
            title="Aumentar tamaño de lista"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export const SearchConfigRow = React.memo(SearchConfigRowComponent);
