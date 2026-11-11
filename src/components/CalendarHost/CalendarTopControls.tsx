"use client";

import React from "react";
import {CALENDAR_GRID_INTERVALS,CALENDAR_HEIGHT_MAX,CALENDAR_HEIGHT_MIN} from '@/lib/calendarDisplayOptions';
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
  X, Plus, CalendarRange, ShieldAlert, Banknote, CreditCard, MessageCircle, Sparkles, Database,
} from "lucide-react";
import { formatLongCalendarDate, shiftDayString, getTodayDateString } from "@/lib/dateUtils";
import { WhatsAppIcon } from "@/components/WhatsappDirectoryModal/WhatsAppIcon";
import { openNotionPage } from "@/services/windowsIntegration";
import { personWorkQuery } from "@/components/ResultsViewHost/PersistentSearchAccess";

interface CalendarTopControlsProps {
  displayControls?:React.ReactNode;
  gridInterval?:number;
  onGridInterval?:(value:number)=>void;
  phaseFilter?:string;
  onPhaseFilter?:(phase:string)=>void;
  extraHours?:boolean;
  onExtraHours?:()=>void;
  onOpenBatch?: () => void;
  onOpenReorder?: () => void;
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
  onSearchCollaborator?: (query: string) => void;
  searchFilterQuery?: string;
  onClearSearchFilter?: () => void;
  onRunAutomation?: () => void;
  onOpenDailyProgress?: () => void;
  onRefresh?: () => void;
  onOpenStandaloneWindow?: () => void;
  onOpenPlanB?: () => void;
  calendarPalette?: "web" | "desktop";
  onTogglePalette?: () => void;
  onOpenWhatsappGroups?: () => void;
  visiblePeople?: string[];
  onSoloPerson?: (person: string) => void;
  onShowAllPeople?: () => void;
}

export function CalendarTopControls({
  displayControls,gridInterval=30,onGridInterval,
  currentDate, onCreateActivity, reviewNotifications, onOpenBatch, onOpenReorder, phaseFilter, onPhaseFilter, extraHours, onExtraHours,
  onSelectDate,
  availableDates,
  onOpenPeoplePicker,
  onOpenWhatsappGroups,
  visiblePeople,
  onSoloPerson,
  onShowAllPeople,
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
  onSearchCollaborator,
  searchFilterQuery = "",
  onClearSearchFilter,
  onRunAutomation,
  onOpenDailyProgress,
  onRefresh,
  onOpenStandaloneWindow,
  onOpenPlanB,
  calendarPalette = "web",
  onTogglePalette,
}: CalendarTopControlsProps) {
  const shiftDay = (offset: number) => {
    onSelectDate(shiftDayString(currentDate, offset));
  };

  const calendarHeader = formatLongCalendarDate(currentDate);
  const isTodayActive = calendarHeader.relativeBadge === "Hoy";
  const zoomPercent = Math.round((pixelsPerHour / 72) * 100);

  const [baseLinks, setBaseLinks] = React.useState([
    { id: 'Revisiones', name: 'Revisiones', url: 'https://www.notion.so/2eeabd7d91b781348ed5c537ec14962e' },
    { id: 'Clientes', name: 'Clientes', url: 'https://www.notion.so/2f0abd7d91b781a0993ed4d3129ea46f' },
    { id: 'Dominios', name: 'Dominios', url: 'https://www.notion.so/2f0abd7d91b781948d43d2627adf2212' },
    { id: 'Cobrar y pagar', name: 'Cobros/Pagos', url: 'https://www.notion.so/2eeabd7d91b781a5a2eec9a20d3d656a' },
    { id: 'Programas y proyectos', name: 'Proyectos', url: 'https://www.notion.so/3cdabd7d91b7835caf8781ca85181639' },
    { id: 'Correos Contraseñas', name: 'Correos', url: 'https://www.notion.so/2f1abd7d91b781f5bd6ef2b1ecad4838' },
  ]);

  React.useEffect(() => {
    let active = true;
    fetch('/api/data?type=notion-base-links', { signal: AbortSignal.timeout(15000) })
      .then(res => res.json())
      .then(data => {
        if (!active || !Array.isArray(data?.items) || data.items.length === 0) return;
        setBaseLinks(prev => {
          return prev.map(base => {
            const found = data.items.find((it: any) =>
              it.name?.toLowerCase().includes(base.name.toLowerCase()) ||
              it.id === base.id
            );
            return found ? { ...base, url: found.url } : base;
          });
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className="flex flex-col w-full bg-[#0F141A] border-b border-[#26323E] flex-shrink-0 select-none">
      <div className="min-h-11 h-auto min-w-0 max-w-full px-2 py-1.5 flex flex-wrap items-center gap-1 text-[11px]">
      <button onClick={onCreateActivity} title="Nueva actividad" aria-label="Nueva actividad" className="shrink-0 flex items-center gap-1 rounded border border-cyan-400/40 bg-cyan-500/15 px-2 py-1 text-cyan-300"><Plus className="w-3.5 h-3.5"/><span className="hidden sm:inline">Nueva</span></button>
      <label className="flex items-center gap-1 text-cyan-200" title="Separación visual de la cuadrícula; no modifica horarios"><span>Divisiones</span><select aria-label="Divisiones del calendario" value={gridInterval} onChange={e=>onGridInterval?.(Number(e.target.value))} className="rounded border border-slate-700 bg-slate-900 p-1">{CALENDAR_GRID_INTERVALS.map(value=><option key={value} value={value}>{value} min</option>)}</select></label>
      {displayControls}
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
          disabled={pixelsPerHour <= CALENDAR_HEIGHT_MIN}
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
          disabled={pixelsPerHour >= CALENDAR_HEIGHT_MAX}
          className="text-[#94A3B8] hover:text-[#F1F5F9] disabled:opacity-30 p-0.5 text-xs font-bold cursor-pointer"
          title="Aumentar zoom horario (+)"
        >
          +
        </button>
      </div>

      {onOpenBatch && <button onClick={onOpenBatch} title="Reprogramar / planificar" aria-label="Reprogramar / planificar" className="flex items-center gap-1 shrink-0 rounded border border-cyan-900 px-2 py-1 text-cyan-200"><CalendarRange className="w-3.5 h-3.5"/><span className="hidden xl:inline">Planificar</span></button>}
      {onOpenReorder && (
        <button
          onClick={onOpenReorder}
          title="⚡ Ordenar y desempalmar actividades amontonadas en la jornada con reglas de prioridad y congruencia temporal"
          aria-label="Ordenar actividades"
          className="flex items-center gap-1 shrink-0 rounded border border-cyan-700/60 bg-cyan-950/40 hover:bg-cyan-900/50 hover:border-cyan-400 px-2 py-1 text-cyan-300 font-semibold cursor-pointer transition-colors shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden xl:inline">Ordenar acts</span>
        </button>
      )}
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

        {/* Toggle Paleta Web / Escritorio */}
        {onTogglePalette && (
          <button
            onClick={onTogglePalette}
            className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              calendarPalette === "desktop"
                ? "bg-[#1E293B] text-[#FBBF24] border-[#FBBF24]/60 shadow-[0_0_8px_rgba(251,191,36,0.25)]"
                : "bg-[#131A22] text-[#94A3B8] border-[#223848] hover:text-[#38BDF8]"
            }`}
            aria-label="Alternar colores tipo aplicación"
            aria-pressed={calendarPalette === "desktop"}
            title={calendarPalette === "desktop" ? "Colores tipo escritorio activos · Clic para volver a colores web" : "Colores web activos · Clic para activar paleta tipo aplicación"}
          >
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{ backgroundColor: calendarPalette === "desktop" ? "#F59E0B" : "#06B6D4" }}
            />
            <span className="hidden xl:inline">{calendarPalette === "desktop" ? "Colores App" : "Colores Web"}</span>
            <span className="xl:hidden">{calendarPalette === "desktop" ? "App" : "Web"}</span>
          </button>
        )}

        {/* Botón Plantillas */}
        <button
          onClick={onOpenTemplates}
          className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#FBBF24] border border-[#223848] text-[11px] font-medium flex items-center gap-1"
          title="Plantillas rápidas en Notion"
        >
          <Zap className="w-3 h-3 text-[#FBBF24]" />
          <span className="hidden xl:inline">Plantillas</span>
        </button>

        <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('anfeta_open_daily_workspace',{detail:{day:currentDate}}))} className="rounded border border-cyan-700 bg-cyan-950/30 px-2 py-1 text-xs text-cyan-200">Jornada</button>
        {/* Botón Plan B Contingencia y Notion */}
        {onOpenPlanB && (
          <button
            type="button"
            onClick={onOpenPlanB}
            className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#1a2533] text-amber-400 border border-amber-600/40 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            title="Plan B · Contingencia y accesos directos a Notion"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Plan B</span>
          </button>
        )}

        {/* Botón Reporte 05:00 */}
        <button
          onClick={onOpenReport}
          className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
          title="Reporte diario de la corrida de las 05:00 AM"
        >
          <FileText className="w-3 h-3 text-[#38BDF8]" />
          <span className="hidden xl:inline">Reporte</span>
        </button>

        {/* Botón WhatsApp Grupos */}
        {onOpenWhatsappGroups && (
          <button
            onClick={onOpenWhatsappGroups}
            className="px-2 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#25D366] border border-[#1E382A] text-[11px] font-medium flex items-center gap-1.5 cursor-pointer"
            title="Directorio de Grupos de WhatsApp"
          >
            <WhatsAppIcon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">WhatsApp</span>
          </button>
        )}

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

        <select aria-label="Filtrar fase" value={phaseFilter || ''} onChange={e=>onPhaseFilter?.(e.target.value)} className="min-w-0 max-w-[124px] rounded border border-slate-700 bg-slate-900 p-1 text-[10px] text-slate-300"><option value="">Todas las fases</option><option value="pending">PH · Por hacer</option><option value="review">REV · En revisión</option><option value="terminated">TER · Terminadas</option><option value="finalized">FIN · Finalizadas</option><option value="suspended">SUS · Suspendidas</option></select>
        <span className="shrink-0 rounded border border-slate-700 p-1 text-[11px] text-cyan-300" title="Horario disponible de 08:00 a 22:00">08–22h</span>

        {/* Quick Collaborator Switcher: Todos, J, K, A, N, G, I, S */}
        {onSoloPerson && (
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-700/80 bg-slate-900/60 p-0.5">
            <button
              type="button"
              onClick={onShowAllPeople}
              title="Mostrar todos los colaboradores"
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all cursor-pointer ${
                visiblePeople && visiblePeople.length >= 7
                  ? "bg-cyan-500 font-bold text-slate-950"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Todos
            </button>
            {[
              { short: "J", name: "John" },
              { short: "K", name: "Karla" },
              { short: "A", name: "Andrade" },
              { short: "N", name: "Neftali" },
              { short: "G", name: "Genaro" },
              { short: "I", name: "Isaias" },
              { short: "S", name: "Sotelo" },
            ].map(({ short, name }) => {
              const isSolo = visiblePeople?.length === 1 && visiblePeople[0] === name;
              const isIncluded = visiblePeople?.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSoloPerson(name)}
                  title={`Ver solo ${name}`}
                  className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold transition-all cursor-pointer ${
                    isSolo
                      ? "bg-cyan-500 font-bold text-slate-950 shadow-sm"
                      : isIncluded
                      ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "text-slate-600 hover:bg-slate-800 hover:text-slate-400"
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>
        )}

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

      {/* Sub-franja: Accesos rápidos en forma de chips a Bases de Notion y Colaboradores */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[#1C2632] bg-[#0A0E13] px-2.5 py-1 text-[11px]">
        {/* Izquierda: Bases de Notion en forma de chips directos (NO desplegable) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mr-0.5">
            <Database className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Bases Notion:</span>
          </span>
          {baseLinks.map((base) => (
            <button
              key={base.id}
              type="button"
              onClick={() => openNotionPage(base.url)}
              title={`Abrir base de Notion «${base.name}» (Abre Notion directamente)`}
              className="flex items-center gap-1 rounded border border-cyan-900/80 bg-cyan-950/40 hover:bg-cyan-900/60 hover:border-cyan-400 px-2 py-0.5 text-[10.5px] font-medium text-cyan-200 transition-colors cursor-pointer shadow-sm"
            >
              <Database className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              <span>{base.name}</span>
              <span className="rounded bg-cyan-900/90 px-1 py-0.2 text-[8.5px] font-bold text-cyan-300 border border-cyan-700/60">
                BD
              </span>
            </button>
          ))}
        </div>

        {/* Derecha: Accesos rápidos de trabajo por colaborador (redirección a Buscador sin duplicar pestañas) */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-slate-400 font-medium mr-0.5 hidden md:inline">Trabajo:</span>
          {['Neftali', 'Genaro', 'Acalli', 'Karla', 'John', 'Isaias', 'Andrade', 'Brian', 'Sotelo', 'Edwin'].map((person) => (
            <button
              key={person}
              type="button"
              onClick={() => {
                const q = personWorkQuery(person, ['00', '11', '22', '33'], true);
                if (onSearchCollaborator) {
                  onSearchCollaborator(q);
                } else {
                  window.dispatchEvent(new CustomEvent('anfeta_open_search_query', { detail: { query: q } }));
                  onBackToSearch();
                }
              }}
              title={`${person} · Ver trabajo en buscador`}
              className="rounded border border-cyan-900/70 bg-cyan-950/30 hover:border-cyan-400 hover:bg-cyan-900/50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300 transition-colors cursor-pointer"
            >
              {person}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
