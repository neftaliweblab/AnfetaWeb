"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Users,
  Clock,
  Zap,
  FileText,
  Search,
  Calendar,
  ExternalLink,
  TrendingUp,
  RotateCw,
  X, Plus, CalendarRange, Banknote, CreditCard,
} from "lucide-react";
import { formatLongCalendarDate, shiftDayString, getTodayDateString } from "@/lib/dateUtils";

interface CalendarTopControlsProps {
  phaseFilter?:string;
  onPhaseFilter?:(phase:string)=>void;
  extraHours?:boolean;
  onExtraHours?:()=>void;
  onOpenBatch?: () => void;
  reviewNotifications?: React.ReactNode;
  onCreateActivity: () => void;
  currentDate: string;
  onSelectDate: (date: string) => void;
  availableDates: string[];
  onOpenPeoplePicker: () => void;
  totalActivitiesCount: number;
  pixelsPerHour: number;
  onChangeZoom: (delta: number) => void;
  onResetZoom?: () => void;
  filterCobros: boolean;
  onToggleCobros: () => void;
  filterPagos: boolean;
  onTogglePagos: () => void;
  onOpenTemplates: () => void;
  onOpenReport: () => void;
  onBackToSearch: () => void;
  searchFilterQuery?: string;
  onClearSearchFilter?: () => void;
  onRunAutomation?: () => void;
  onOpenDailyProgress?: () => void;
  onRefresh?: () => void;
  onOpenStandaloneWindow?: () => void;
}

export function CalendarTopControls({
  currentDate, onCreateActivity, reviewNotifications, onOpenBatch, phaseFilter, onPhaseFilter, extraHours, onExtraHours,
  onSelectDate,
  availableDates,
  onOpenPeoplePicker,
  totalActivitiesCount,
  pixelsPerHour,
  onChangeZoom,
  onResetZoom,
  filterCobros,
  onToggleCobros,
  filterPagos,
  onTogglePagos,
  onOpenTemplates,
  onOpenReport,
  onBackToSearch,
  searchFilterQuery = "",
  onClearSearchFilter,
  onRunAutomation,
  onOpenDailyProgress,
  onRefresh,
  onOpenStandaloneWindow,
}: CalendarTopControlsProps) {
  const shiftDay = (offset: number) => {
    onSelectDate(shiftDayString(currentDate, offset));
  };

  const calendarHeader = formatLongCalendarDate(currentDate);
  const isTodayActive = calendarHeader.relativeBadge === "Hoy";
  const zoomPercent = Math.round((pixelsPerHour / 72) * 100);

  return (
    <div className="min-h-11 h-auto min-w-0 max-w-full bg-[#0F141A] border-b border-[#26323E] px-2 py-1.5 flex flex-wrap items-center gap-1 text-[11px] select-none flex-shrink-0">
      <button onClick={onCreateActivity} title="Nueva actividad" aria-label="Nueva actividad" className="shrink-0 flex items-center gap-1 rounded border border-cyan-400/40 bg-cyan-500/15 px-2 py-1 text-cyan-300"><Plus className="w-3.5 h-3.5"/><span className="hidden sm:inline">Nueva</span></button>
      {/* 1. Date Navigation: Ayer, Hoy, Mañana, ‹ ›, Título largo con Badge */}
      <div className="flex flex-wrap items-center gap-1 min-w-0 max-w-full">
        <button
          onClick={() => onSelectDate(getTodayDateString())}
          className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer transition-colors ${
            isTodayActive
              ? "bg-[#0369A1]/30 text-[#38BDF8] border-[#0284C7]/60 shadow-[0_0_8px_rgba(56,189,248,0.2)]"
              : "bg-[#131A22] hover:bg-[#18212B] text-[#94A3B8] hover:text-[#38BDF8] border-[#223848]"
          }`}
          title="Ir a Hoy"
        >
          Hoy
        </button>
        <div className="flex items-center bg-[#131A22] border border-[#223848] rounded">
          <button
            onClick={() => shiftDay(-1)}
            className="px-1.5 py-0.5 text-[#94A3B8] hover:text-[#F1F5F9] text-sm cursor-pointer"
            title="Día anterior"
          >
            ‹
          </button>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && onSelectDate(e.target.value)}
            className="w-[112px] min-w-0 bg-transparent text-[11px] font-mono font-semibold text-[#F1F5F9] border-none px-1 py-0.5 focus:outline-none cursor-pointer [color-scheme:dark]"
            aria-label="Seleccionar fecha" title={calendarHeader.fullText}
          />
          <button
            onClick={() => shiftDay(1)}
            className="px-1.5 py-0.5 text-[#94A3B8] hover:text-[#F1F5F9] text-sm cursor-pointer"
            title="Día siguiente"
          >
            ›
          </button>
        </div>

        {availableDates.length > 0 && (
          <select
            value={currentDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="bg-[#131A22] text-[#94A3B8] border border-[#223848] rounded max-w-[112px] px-1 py-1 text-[10px] focus:outline-none focus:border-[#00A8FF] cursor-pointer"
            aria-label="Fechas con actividades" title="Fechas con actividades en Notion"
          >
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        <span className="text-[10px] font-mono text-[#64748B] px-1 hidden xl:inline">
          {totalActivitiesCount} act.
        </span>

        {/* Badge de filtro activo de búsqueda sincronizada */}
        {searchFilterQuery && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0369A1]/20 border border-[#0284C7]/40 text-[#38BDF8] text-[10.5px]">
            <Search className="w-3 h-3 text-[#38BDF8]" />
            <span className="font-semibold max-w-[130px] truncate" title={`Filtrado por: ${searchFilterQuery}`}>
              “{searchFilterQuery}”
            </span>
            {onClearSearchFilter && (
              <button
                onClick={onClearSearchFilter}
                className="hover:text-white p-0.5 cursor-pointer ml-0.5"
                title="Limpiar filtro de búsqueda"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Zoom Controls: − [100%] + */}
      <div className="flex items-center gap-1 bg-[#131A22] border border-[#223848] rounded px-1.5 py-0.5">
        <button
          onClick={() => onChangeZoom(-12)}
          disabled={pixelsPerHour <= 48}
          className="text-[#94A3B8] hover:text-[#F1F5F9] disabled:opacity-30 p-0.5 text-xs font-bold cursor-pointer"
          title="Reducir zoom horario (-)"
        >
          −
        </button>
        <button
          onClick={() => onResetZoom?.()}
          className="font-mono text-[11px] text-[#38BDF8] hover:text-white px-1 font-semibold min-w-[38px] text-center cursor-pointer transition-colors"
          title="Restablecer zoom a 100%"
        >
          {zoomPercent}%
        </button>
        <button
          onClick={() => onChangeZoom(12)}
          disabled={pixelsPerHour >= 120}
          className="text-[#94A3B8] hover:text-[#F1F5F9] disabled:opacity-30 p-0.5 text-xs font-bold cursor-pointer"
          title="Aumentar zoom horario (+)"
        >
          +
        </button>
      </div>

      {onOpenBatch && <button onClick={onOpenBatch} title="Reprogramar / planificar" aria-label="Reprogramar / planificar" className="flex items-center gap-1 shrink-0 rounded border border-cyan-900 px-2 py-1 text-cyan-200"><CalendarRange className="w-3.5 h-3.5"/><span className="hidden xl:inline">Planificar</span></button>}
      {reviewNotifications}
      {/* 3. Action Toggles and Buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Toggle Cobros */}
        <button
          onClick={onToggleCobros}
          className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
            filterCobros
              ? "bg-[#18212B] text-[#4ADE80] border-[#4ADE80]/50 shadow-[0_0_8px_rgba(74,222,128,0.2)]"
              : "bg-[#131A22] text-[#94A3B8] border-[#223848] hover:text-[#E2E8F0]"
          }`}
          aria-label="Mostrar columna de cobros" aria-pressed={filterCobros} title="Mostrar columna de cobros"
        >
          <Banknote className="w-3.5 h-3.5 inline"/><span className="hidden xl:inline ml-1">Cobros</span>
        </button>

        {/* Toggle Pagos */}
        <button
          onClick={onTogglePagos}
          className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
            filterPagos
              ? "bg-[#18212B] text-[#FB923C] border-[#FB923C]/50 shadow-[0_0_8px_rgba(251,146,60,0.2)]"
              : "bg-[#131A22] text-[#94A3B8] border-[#223848] hover:text-[#E2E8F0]"
          }`}
          aria-label="Mostrar columna de pagos" aria-pressed={filterPagos} title="Mostrar columna de pagos"
        >
          <CreditCard className="w-3.5 h-3.5 inline"/><span className="hidden xl:inline ml-1">Pagos</span>
        </button>

        {/* Botón Plantillas */}
        <button
          onClick={onOpenTemplates}
          className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#FBBF24] border border-[#223848] text-[11px] font-medium flex items-center gap-1"
          title="Plantillas rápidas en Notion"
        >
          <Zap className="w-3 h-3 text-[#FBBF24]" />
          <span className="hidden xl:inline">Plantillas</span>
        </button>

        {/* Botón Reporte 05:00 */}
        <button
          onClick={onOpenReport}
          className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
          title="Reporte diario de la corrida de las 05:00 AM"
        >
          <FileText className="w-3 h-3 text-[#38BDF8]" />
          <span className="hidden xl:inline">Reporte</span>
        </button>

        {/* Botón ⏩ Robot 05:00 */}
        {onRunAutomation && (
          <button
            onClick={onRunAutomation}
            className="p-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848] text-xs font-bold cursor-pointer"
            title="⏩ Mover pendientes de ayer a hoy y registrar reporte"
          >
            ⏩
          </button>
        )}

        {/* Botón 📈 Avance Diario */}
        {onOpenDailyProgress && (
          <button
            onClick={onOpenDailyProgress}
            className="p-1.5 rounded bg-[#131A22] hover:bg-[#18212B] text-[#4ADE80] border border-[#223848] cursor-pointer"
            title="📈 Abrir Feed de Avance Diario y KPIs"
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
        )}

        <select aria-label="Filtrar fase" value={phaseFilter || ''} onChange={e=>onPhaseFilter?.(e.target.value)} className="min-w-0 max-w-[112px] rounded border border-slate-700 bg-slate-900 p-1 text-[10px] text-slate-300"><option value="">Todas las fases</option><option value="pending">Por hacer</option><option value="review">En revisión</option><option value="completed">Terminadas</option><option value="suspended">Suspendidas</option></select>
        <button onClick={onExtraHours} aria-pressed={!!extraHours} className="shrink-0 rounded border border-slate-700 p-1 text-[11px] text-cyan-300" title="Mostrar tramo extra de 21:00 a 22:00">{extraHours?'08–22h':'08–21h'}</button>

        {/* People Picker */}
        <button
          onClick={onOpenPeoplePicker}
          className="p-1.5 rounded bg-[#131A22] hover:bg-[#18212B] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#223848] cursor-pointer"
          title="Configurar colaboradores visibles"
        >
          <Users className="w-3.5 h-3.5 text-[#38BDF8]" />
        </button>

        {/* Botón ↻ Refrescar Notion */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 rounded bg-[#131A22] hover:bg-[#18212B] text-[#CBD5E1] hover:text-[#38BDF8] border border-[#223848] cursor-pointer"
            title="↻ Actualización rápida incremental Notion"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Botón ⧉ Ventana independiente Multi-Monitor */}
        {onOpenStandaloneWindow && (
          <button
            onClick={onOpenStandaloneWindow}
            className="p-1.5 rounded bg-[#131A22] hover:bg-[#18212B] text-[#CBD5E1] hover:text-[#38BDF8] border border-[#223848] cursor-pointer"
            title="⧉ Abrir Calendario en ventana independiente (Multi-Monitor vinculado en tiempo real)"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Botón ⌕ volver a buscador */}
        <button
          onClick={onBackToSearch}
          className="px-2 py-1 rounded bg-[#18212B] hover:bg-[#223848] text-[#00A8FF] border border-[#00A8FF]/40 text-xs font-bold cursor-pointer"
          title="Volver al buscador de resultados"
        >
          ⌕
        </button>
      </div>
    </div>
  );
}
