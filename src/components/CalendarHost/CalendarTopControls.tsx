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
  X,
} from "lucide-react";
import { formatLongCalendarDate, shiftDayString, getTodayDateString } from "@/lib/dateUtils";

interface CalendarTopControlsProps {
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
  currentDate, onCreateActivity, reviewNotifications,
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
    <div className="h-11 bg-[#0F141A] border-b border-[#26323E] px-3 flex items-center justify-between gap-2 text-xs select-none flex-shrink-0 overflow-x-auto scrollbar-none">
      <button onClick={onCreateActivity} className="shrink-0 rounded border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-cyan-300">+ Nueva Actividad</button>
      {/* 1. Date Navigation: Ayer, Hoy, Mañana, ‹ ›, Título largo con Badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => shiftDay(-1)}
          className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#223848] text-[11px] cursor-pointer"
          title="Día anterior"
        >
          Ayer
        </button>
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
        <button
          onClick={() => shiftDay(1)}
          className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#223848] text-[11px] cursor-pointer"
          title="Día siguiente"
        >
          Mañana
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
            className="bg-transparent text-xs font-mono font-semibold text-[#F1F5F9] border-none px-1 py-0.5 focus:outline-none cursor-pointer [color-scheme:dark]"
            title="Seleccionar fecha"
          />
          <button
            onClick={() => shiftDay(1)}
            className="px-1.5 py-0.5 text-[#94A3B8] hover:text-[#F1F5F9] text-sm cursor-pointer"
            title="Día siguiente"
          >
            ›
          </button>
        </div>

        {/* Título largo formateado en español (dddd, d de MMMM de yyyy) */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[#131A22] border border-[#223848] rounded">
          <Calendar className="w-3 h-3 text-[#38BDF8]" />
          <span className="font-semibold text-[11px] text-[#F1F5F9]">
            {calendarHeader.fullText}
          </span>
          {calendarHeader.relativeBadge && (
            <span
              className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold font-mono ${
                calendarHeader.relativeBadge === "Hoy"
                  ? "bg-[#0369A1]/30 text-[#38BDF8] border border-[#0284C7]/50"
                  : "bg-[#1E293B] text-[#94A3B8] border border-[#334155]"
              }`}
            >
              {calendarHeader.relativeBadge}
            </span>
          )}
        </div>

        {availableDates.length > 0 && (
          <select
            value={currentDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="bg-[#131A22] text-[#94A3B8] border border-[#223848] rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-[#00A8FF] cursor-pointer"
            title="Fechas con actividades en Notion"
          >
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        <span className="text-[10px] font-mono text-[#64748B] px-1 hidden md:inline">
          {totalActivitiesCount} {totalActivitiesCount === 1 ? "actividad" : "actividades"}
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
          title="Filtrar actividades de cobro"
        >
          💰 Cobros
        </button>

        {/* Toggle Pagos */}
        <button
          onClick={onTogglePagos}
          className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
            filterPagos
              ? "bg-[#18212B] text-[#FB923C] border-[#FB923C]/50 shadow-[0_0_8px_rgba(251,146,60,0.2)]"
              : "bg-[#131A22] text-[#94A3B8] border-[#223848] hover:text-[#E2E8F0]"
          }`}
          title="Filtrar pagos programados"
        >
          💳 Pagos
        </button>

        {/* Botón Plantillas */}
        <button
          onClick={onOpenTemplates}
          className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#FBBF24] border border-[#223848] text-[11px] font-medium flex items-center gap-1"
          title="Plantillas rápidas en Notion"
        >
          <Zap className="w-3 h-3 text-[#FBBF24]" />
          <span>Plantillas</span>
        </button>

        {/* Botón Reporte 05:00 */}
        <button
          onClick={onOpenReport}
          className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
          title="Reporte diario de la corrida de las 05:00 AM"
        >
          <FileText className="w-3 h-3 text-[#38BDF8]" />
          <span>▤ Reporte</span>
        </button>

        {/* Botón ⏩ Robot 05:00 */}
        {onRunAutomation && (
          <button
            onClick={onRunAutomation}
            className="p-1.5 rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848] text-xs font-bold cursor-pointer"
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

        <span className="shrink-0 text-[11px] text-cyan-300" title="Jornada de 08:00 a 22:00">08–22h</span>

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
