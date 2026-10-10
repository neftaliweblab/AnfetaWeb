"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, Columns, RefreshCw, User, Loader2, Cloud } from "lucide-react";

export interface UserOption {
  code: string;
  name: string;
  email?: string;
}

interface SearchConfigRowProps {
  currentUser?: string;
  onChangeCurrentUser?: (user: string) => void;
  onSyncNotion?: () => Promise<void> | void;
  isSyncingNotion?: boolean;
  onSyncDropbox?: () => Promise<void> | void;
  isSyncingDropbox?: boolean;
  selectedTag: string;
  onChangeTag: (tag: string) => void;
  customTag?: string;
  onChangeCustomTag?: (tag: string) => void;
  textScale: string;
  onChangeTextScale: (scale: string) => void;
  groupBy: string;
  onChangeGroupBy: (group: string) => void;
  selectedMonth: string;
  onChangeMonth: (m: string) => void;
  viewZoom: "list" | "small" | "medium" | "large";
  onChangeViewZoom: (zoom: "list" | "small" | "medium" | "large") => void;
  // Toggles
  isPendientesOpen: boolean;
  onTogglePendientes: () => void;
  pendingCount: number;
  isFiltersOpen: boolean;
  onToggleFilters: () => void;
  isDetailsOpen: boolean;
  onToggleDetails: () => void;
  // Columnas
  visibleCols: { path: boolean; status: boolean; scheduledDate: boolean; modifiedDate: boolean };
  onToggleCol: (col: "path" | "status" | "scheduledDate" | "modifiedDate") => void;
  onMaximizeNameCol: () => void;
  onResetCols: () => void;
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

export function SearchConfigRow({
  currentUser,
  onChangeCurrentUser,
  onSyncNotion,
  isSyncingNotion = false,
  onSyncDropbox,
  isSyncingDropbox = false,
  selectedTag,
  onChangeTag,
  customTag,
  onChangeCustomTag,
  textScale,
  onChangeTextScale,
  groupBy,
  onChangeGroupBy,
  selectedMonth,
  onChangeMonth,
  viewZoom,
  onChangeViewZoom,
  isPendientesOpen,
  onTogglePendientes,
  pendingCount,
  isFiltersOpen,
  onToggleFilters,
  isDetailsOpen,
  onToggleDetails,
  visibleCols,
  onToggleCol,
  onMaximizeNameCol,
  onResetCols,
}: SearchConfigRowProps) {
  const [showColsMenu, setShowColsMenu] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  const TEAM_USERS = [
    { code: "nneft", name: "Neftali" },
    { code: "jjohn", name: "John" },
    { code: "kkarl", name: "Karla" },
    { code: "bbria", name: "Brian" },
    { code: "ggena", name: "Genaro" },
    { code: "iisai", name: "Isaias" },
    { code: "ssote", name: "Sotelo" },
    { code: "aacal", name: "Acalli" },
    { code: "aandr", name: "Andrade" },
    { code: "eemma", name: "Emmanuel" },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colsRef.current && !colsRef.current.contains(event.target as Node)) {
        setShowColsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleZoomOut = () => {
    const idx = VIEW_ZOOM_LEVELS.indexOf(viewZoom);
    if (idx > 0) onChangeViewZoom(VIEW_ZOOM_LEVELS[idx - 1]);
  };

  const handleZoomIn = () => {
    const idx = VIEW_ZOOM_LEVELS.indexOf(viewZoom);
    if (idx < VIEW_ZOOM_LEVELS.length - 1) onChangeViewZoom(VIEW_ZOOM_LEVELS[idx + 1]);
  };

  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedTag === "Personalizado") {
      setTimeout(() => customInputRef.current?.focus(), 50);
    }
  }, [selectedTag]);

  return (
    <div
      style={{
        minHeight: `${Math.round(30 * scale)}px`,
        paddingTop: `${Math.max(2, Math.round(3 * scale))}px`,
        paddingBottom: `${Math.max(2, Math.round(3 * scale))}px`,
      }}
      className="flex items-center justify-between px-3 bg-[#0F141C] border-y border-[#1E2836] select-none gap-2 transition-all"
    >
      {/* Controles Izquierda */}
      <div
        style={{ gap: `${Math.round(8 * scale)}px` }}
        className="flex items-center overflow-x-auto scrollbar-none flex-1"
      >
        {/* Selector de Usuario Activo Dinámico */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }} className="text-[#38BDF8] font-semibold flex items-center gap-1">
            <User style={{ width: `${Math.round(13 * scale)}px`, height: `${Math.round(13 * scale)}px` }} className="text-[#38BDF8]" />
            Usuario:
          </span>
          <select
            value={currentUser || "nneft"}
            onChange={(e) => onChangeCurrentUser?.(e.target.value)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
            }}
            className="bg-[#141B26] text-[#38BDF8] font-bold border border-[#38BDF8]/60 hover:border-[#38BDF8] rounded focus:outline-none cursor-pointer"
            title="Seleccionar usuario activo del sistema"
          >
            {TEAM_USERS.map((u) => (
              <option key={u.code} value={u.code}>
                👤 {u.name} ({u.code})
              </option>
            ))}
            <option value="__all__">🌐 Todos (__all__)</option>
          </select>
        </div>

        {/* Botón Sincronizar Notion en Vivo */}
        {onSyncNotion && (
          <button
            type="button"
            onClick={() => onSyncNotion()}
            disabled={isSyncingNotion}
            style={{
              gap: `${Math.round(4 * scale)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
            }}
            className={`rounded font-medium border flex items-center shrink-0 cursor-pointer transition-all ${
              isSyncingNotion
                ? "bg-[#1E3A5F] border-[#38BDF8] text-[#38BDF8] opacity-80"
                : "bg-[#14233A] border-[#25466A] hover:border-[#38BDF8] text-[#38BDF8] hover:bg-[#1B2F4E]"
            }`}
            title="Sincronizar cambios en vivo desde Notion API"
          >
            {isSyncingNotion ? (
              <Loader2
                style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
                className="animate-spin text-[#38BDF8]"
              />
            ) : (
              <RefreshCw
                style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
                className="text-[#38BDF8]"
              />
            )}
            <span>{isSyncingNotion ? "Sincronizando Notion..." : "Sync Notion"}</span>
          </button>
        )}

        {/* Botón Sincronizar Dropbox Cloud en Vivo */}
        {onSyncDropbox && (
          <button
            type="button"
            onClick={() => onSyncDropbox()}
            disabled={isSyncingDropbox}
            style={{
              gap: `${Math.round(4 * scale)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
            }}
            className={`rounded font-medium border flex items-center shrink-0 cursor-pointer transition-all ${
              isSyncingDropbox
                ? "bg-[#0C4A6E] border-[#38BDF8] text-[#38BDF8] opacity-80"
                : "bg-[#0F1E30] border-[#1E3A5F] hover:border-[#38BDF8] text-cyan-200 hover:bg-[#132A45]"
            }`}
            title="Sincronizar e indexar archivos desde Dropbox Cloud (API)"
          >
            {isSyncingDropbox ? (
              <Loader2
                style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
                className="animate-spin text-cyan-300"
              />
            ) : (
              <Cloud
                style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
                className="text-cyan-400"
              />
            )}
            <span>{isSyncingDropbox ? "Indexando Dropbox..." : "Sync Dropbox"}</span>
          </button>
        )}

        {/* Tag inicial */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }} className="text-[#94A3B8]">
            Tag inicial:
          </span>
          <select
            value={selectedTag}
            onChange={(e) => onChangeTag(e.target.value)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
            }}
            className="bg-[#141B26] text-[#FFFFFF] border border-[#26354A] rounded focus:outline-none cursor-pointer"
          >
            <option value="Ninguno">Ninguno</option>
            <option value="prtuzREVISION">prtuzREVISION</option>
            <option value="zclientes">zclientes</option>
            <option value="zdominios">zdominios</option>
            <option value="zproyectos">zproyectos</option>
            <option value="zpagar">zpagar</option>
            <option value="zcorreos">zcorreos</option>
            <option value="Personalizado">Personalizado</option>
          </select>
          {selectedTag === "Personalizado" && (
            <input
              ref={customInputRef}
              type="text"
              value={customTag || ""}
              onChange={(e) => onChangeCustomTag?.(e.target.value)}
              placeholder="Tag personalizado"
              style={{
                fontSize: `${(10.5 * scale).toFixed(1)}px`,
                minHeight: `${Math.round(26 * scale)}px`,
                width: `${Math.round(135 * scale)}px`,
                padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
              }}
              className="bg-[#141B26] text-[#FFFFFF] border-2 border-[#38BDF8] focus:border-[#00A8FF] rounded focus:outline-none placeholder-[#64748B] shadow-[0_0_8px_rgba(56,189,248,0.25)]"
            />
          )}
        </div>

        {/* Texto Scale */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }} className="text-[#94A3B8]">
            Texto:
          </span>
          <select
            value={textScale}
            onChange={(e) => onChangeTextScale(e.target.value)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              width: `${Math.round(78 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
            }}
            className="bg-[#141B26] text-[#FFFFFF] border border-[#26354A] rounded focus:outline-none cursor-pointer"
          >
            {["70%", "80%", "90%", "100%", "110%", "120%", "130%", "140%", "150%"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Agrupar */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }} className="text-[#94A3B8]">
            Agrupar:
          </span>
          <select
            value={groupBy}
            onChange={(e) => onChangeGroupBy(e.target.value)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
            }}
            className="bg-[#141B26] text-[#FFFFFF] border border-[#26354A] rounded focus:outline-none cursor-pointer"
          >
            <option value="none">Ninguno</option>
            <option value="domain">Proyecto / estado</option>
            <option value="domain_nobilling">Proyecto / estado (sin cobrar/pagar)</option>
            <option value="project_suffix">📁 Proyecto / Sufijo (.webs, .ads...)</option>
            <option value="month">Mes</option>
            <option value="name">Nombre asignado</option>
            <option value="name_noterminated">Nombre asignado (sin terminadas)</option>
            <option value="area">Tipo / área</option>
            <option value="area_nobilling">Tipo / área (sin cobrar/pagar)</option>
          </select>
        </div>

        {/* Mes */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }} className="text-[#94A3B8]">
            Mes:
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => onChangeMonth(e.target.value)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
            }}
            className="bg-[#141B26] text-[#FFFFFF] border border-[#26354A] rounded focus:outline-none cursor-pointer"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Vista: − [Lista] + */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }} className="text-[#94A3B8]">
            Vista:
          </span>
          <button
            type="button"
            onClick={handleZoomOut}
            style={{
              width: `${Math.round(20 * scale)}px`,
              height: `${Math.round(22 * scale)}px`,
              fontSize: `${(11 * scale).toFixed(1)}px`,
            }}
            className="flex items-center justify-center rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] font-bold cursor-pointer"
            title="Reducir tamaño / volver a lista"
          >
            −
          </button>
          <span
            style={{
              fontSize: `${(10 * scale).toFixed(1)}px`,
              minWidth: `${Math.round(52 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
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
            title="Ampliar tamaño (Pequeña, Mediana, Grande)"
          >
            +
          </button>
        </div>
      </div>

      {/* Toggles y Botón Columnas Derecha */}
      <div style={{ gap: `${Math.round(6 * scale)}px` }} className="flex items-center shrink-0">
        {/* Toggle Pendientes con contador real */}
        <button
          type="button"
          onClick={onTogglePendientes}
          style={{
            fontSize: `${(10.5 * scale).toFixed(1)}px`,
            minHeight: `${Math.round(26 * scale)}px`,
            padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
            gap: `${Math.round(6 * scale)}px`,
          }}
          className={`flex items-center rounded border font-medium transition-colors cursor-pointer ${
            isPendientesOpen
              ? "bg-[#2E1E0F] border-[#F59E0B] text-[#FCD34D] shadow-[0_0_6px_rgba(245,158,11,0.25)]"
              : "bg-[#161F2C] border-[#26354A] text-[#CBD5E1] hover:border-[#F59E0B]"
          }`}
        >
          <span>📋 Pendientes</span>
          <span
            style={{ fontSize: `${(9 * scale).toFixed(1)}px` }}
            className="px-1.5 py-0.2 rounded-full font-bold bg-[#D97706] text-white"
          >
            {pendingCount}
          </span>
        </button>

        {/* Toggle Filtros */}
        <button
          type="button"
          onClick={onToggleFilters}
          style={{
            fontSize: `${(10.5 * scale).toFixed(1)}px`,
            minHeight: `${Math.round(26 * scale)}px`,
            padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
          }}
          className={`rounded border font-medium transition-colors cursor-pointer ${
            isFiltersOpen
              ? "bg-[#1E3A5F] border-[#38BDF8] text-[#38BDF8]"
              : "bg-[#161F2C] border-[#26354A] text-[#CBD5E1] hover:text-[#FFFFFF]"
          }`}
        >
          Filtros
        </button>

        {/* Toggle Detalles */}
        <button
          type="button"
          onClick={onToggleDetails}
          style={{
            fontSize: `${(10.5 * scale).toFixed(1)}px`,
            minHeight: `${Math.round(26 * scale)}px`,
            padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
          }}
          className={`rounded border font-medium transition-colors cursor-pointer ${
            isDetailsOpen
              ? "bg-[#1E3A5F] border-[#38BDF8] text-[#38BDF8]"
              : "bg-[#161F2C] border-[#26354A] text-[#CBD5E1] hover:text-[#FFFFFF]"
          }`}
        >
          Detalles
        </button>

        {/* Botón Columnas */}
        <div className="relative" ref={colsRef}>
          <button
            type="button"
            onClick={() => setShowColsMenu(!showColsMenu)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
              gap: `${Math.round(4 * scale)}px`,
            }}
            className="flex items-center rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-[#38BDF8] font-medium transition-colors cursor-pointer"
          >
            <Columns style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }} className="text-[#38BDF8]" />
            <span>Columnas</span>
          </button>

          {showColsMenu && (
            <div className="absolute right-0 top-8 z-50 w-56 bg-[#111822] border border-[#253549] rounded-lg shadow-2xl p-2 space-y-1 text-xs">
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
                    type="button"
                    onClick={() => onToggleCol(key as any)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-[#1E2836] text-left text-[#CBD5E1]"
                  >
                    <span>{label}</span>
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                        isVis ? "bg-[#38BDF8] border-[#38BDF8] text-black" : "border-[#475569]"
                      }`}
                    >
                      {isVis && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}

              <div className="pt-1 border-t border-[#26323E] mt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onMaximizeNameCol();
                    setShowColsMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#1E2836] text-[#38BDF8] text-[10.5px] font-medium"
                >
                  Maximizar columna Nombre
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetCols();
                    setShowColsMenu(false);
                  }}
                  className="w-full flex items-center gap-1.5 text-left px-2 py-1 rounded hover:bg-[#1E2836] text-[#94A3B8] hover:text-[#CBD5E1] text-[10.5px]"
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
