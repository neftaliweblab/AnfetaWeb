"use client";
import {SearchChoice,type SearchChoiceOption} from './SearchChoice';
import {SEARCH_SORTS,SEARCH_SORT_DESCRIPTIONS} from "@/lib/searchPresentation";

import {normalizePerson,PERSON_ALIASES} from '@/services/identityNormalizer';
import React, { useState, useRef, useEffect } from "react";
import { Check, Columns, RefreshCw, User, Loader2, Cloud, Sparkles } from "lucide-react";

export interface UserOption {
  code: string;
  name: string;
  email?: string;
}

interface SearchConfigRowProps {
  resultSort?:string;
  onChangeResultSort?:(value:string)=>void;
  currentUser?: string;
  onChangeCurrentUser?: (user: string) => void;
  onSyncNotion?: () => Promise<void> | void;
  isSyncingNotion?: boolean;
  onOpenResponseCleanup?: () => void;
  onSyncDropbox?: () => Promise<void> | void;
  isSyncingDropbox?: boolean;
  selectedTag: string;
  onChangeTag: (tag: string) => void;
  customTag?: string;
  onChangeCustomTag?: (tag: string) => void;
  textScale: string;
  onChangeTextScale: (scale: string) => void;
  classification?:string;onChangeClassification?:(value:string)=>void;
  databaseScope?:string;
  databaseOptions?:SearchChoiceOption[];
  onChangeDatabaseScope?:(value:string)=>void;
  groupBy: string;
  onChangeGroupBy: (group: string) => void;
  selectedMonth: string;
  currentMonth?: string;
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
  hasNotionToken?: boolean;
  hasDropboxToken?: boolean;
  onOpenSettings?: () => void;
  onOpenDropboxConnect?: () => void;
  notification?: { type: 'info' | 'success' | 'warning' | 'error'; text: string } | null;
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

function SearchConfigRowComponent({
  resultSort="scheduled-today",onChangeResultSort,
  currentUser,
  onChangeCurrentUser,
  onSyncNotion,
  isSyncingNotion = false,
  onOpenResponseCleanup,
  onSyncDropbox,
  isSyncingDropbox = false,
  selectedTag,
  onChangeTag,
  customTag,
  onChangeCustomTag,
  textScale,
  onChangeTextScale,
  classification='all',onChangeClassification,
  databaseScope='Notion',databaseOptions=[],onChangeDatabaseScope,
  groupBy,
  onChangeGroupBy,
  selectedMonth,
  currentMonth,
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
  hasNotionToken,
  hasDropboxToken,
  onOpenSettings,
  onOpenDropboxConnect,
  notification,
  onDismissNotification,
}: SearchConfigRowProps) {
  const [showColsMenu, setShowColsMenu] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  const TEAM_USERS = [
 {code:"eedwin",name:"Edwin"},
    { code: "nneft", name: "Neftali" },
    { code: "jjohn", name: "John" },
    { code: "kkarl", name: "Karla" },
    { code: "bbria", name: "Brian" },
    { code: "ggena", name: "Genaro" },
    { code: "iisai", name: "Isaias" },
    { code: "ssote", name: "Sotelo" },
    { code: "aacal", name: "Acalli" },
    { code: "aandr", name: "Andrade" },
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
      className="flex flex-wrap items-center justify-between px-3 bg-[#0F141C] border-y border-[#1E2836] select-none gap-2 transition-all"
    >
      {/* Controles Izquierda */}
      <div
        style={{ gap: `${Math.round(8 * scale)}px` }}
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 flex-1 min-w-0"
      >
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-cyan-300">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }}>Ordenar:</span>
          <SearchChoice label="Orden de resultados" value={resultSort} onChange={value=>onChangeResultSort?.(value)} scale={scale} description="Fecha por hacer es el horario del calendario. Última modificación indica cuándo se editó la página. Las agrupaciones y las terminadas al final se conservan." options={SEARCH_SORTS.map(([value,label])=>({value,label,description:SEARCH_SORT_DESCRIPTIONS[value],group:value.startsWith('scheduled')?'Horario de trabajo':value.startsWith('modified')?'Edición de páginas':'Otros órdenes'}))}/>

          <button
            type="button"
            onClick={() => {
              if (resultSort === 'name-asc') onChangeResultSort?.('name-desc');
              else if (resultSort === 'name-desc') onChangeResultSort?.('name-asc');
              else onChangeResultSort?.('name-asc');
            }}
            style={{
              minHeight: `${Math.round(24 * scale)}px`,
              fontSize: `${(10 * scale).toFixed(1)}px`,
              padding: `0 ${Math.round(6 * scale)}px`,
            }}
            className="rounded border border-[#25466A] bg-[#14233A] text-cyan-300 hover:border-cyan-400 font-mono font-bold cursor-pointer transition-colors"
            title="Alternar orden rápido por Título (A-Z / Z-A)"
          >
            {resultSort === 'name-desc' ? 'Z→A' : 'A→Z'}
          </button>
        </div>
        {/* Selector de Usuario Activo Dinámico */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }} className="text-[#38BDF8] font-semibold flex items-center gap-1">
            <User style={{ width: `${Math.round(13 * scale)}px`, height: `${Math.round(13 * scale)}px` }} className="text-[#38BDF8]" />
            Filtrar persona:
          </span>
          <select
            value={currentUser==="__all__"?"__all__":PERSON_ALIASES[normalizePerson(currentUser||"")]?.[0]||""}
            onChange={(e) => onChangeCurrentUser?.(e.target.value)}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
            }}
            className="bg-[#141B26] text-[#38BDF8] font-bold border border-[#38BDF8]/60 hover:border-[#38BDF8] rounded focus:outline-none cursor-pointer"
            title="Filtrar resultados por persona; no cambia la sesión activa"
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
          <div className="flex items-center gap-1 shrink-0">
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
            {hasNotionToken === false ? (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Token de Notion no detectado. Haz clic para configurarlo en ⚙️ Configuración"
                style={{ fontSize: `${(9.5 * scale).toFixed(1)}px`, minHeight: `${Math.round(22 * scale)}px` }}
                className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 flex items-center gap-1 hover:bg-amber-500/20 cursor-pointer transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>Falta Token</span>
              </button>
            ) : hasNotionToken === true ? (
              <span
                title="Token de Notion configurado"
                style={{ fontSize: `${(9.5 * scale).toFixed(1)}px` }}
                className="px-1 py-0.5 rounded text-emerald-400 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Notion OK</span>
              </span>
            ) : null}
          </div>
        )}

        {/* Botón Limpiar Páginas [RESPUESTA] */}
        {onOpenResponseCleanup && (
          <button
            type="button"
            onClick={onOpenResponseCleanup}
            style={{
              gap: `${Math.round(4 * scale)}px`,
              minHeight: `${Math.round(26 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
            }}
            className="rounded font-medium border flex items-center shrink-0 cursor-pointer transition-all bg-[#171A2E] border-[#4338CA] hover:border-[#818CF8] text-[#A5B4FC] hover:bg-[#202544]"
            title="Escanear y previsualizar páginas de [RESPUESTA] para eliminarlas en Notion"
          >
            <Sparkles
              style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
              className="text-[#818CF8]"
            />
            <span>Limpiar [RESPUESTA]</span>
          </button>
        )}

        {/* Botón Sincronizar Dropbox Cloud en Vivo */}
        {onSyncDropbox && (
          <div className="flex items-center gap-1 shrink-0">
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
            {hasDropboxToken === true ? (
              <button
                type="button"
                onClick={onOpenDropboxConnect || onOpenSettings}
                title="Dropbox conectado mediante OAuth - Clic para ver estado o cambiar cuenta"
                style={{ fontSize: `${(9.5 * scale).toFixed(1)}px`, minHeight: `${Math.round(22 * scale)}px` }}
                className="px-1.5 py-0.5 rounded border border-cyan-500/20 bg-cyan-950/20 text-cyan-400 flex items-center gap-1 hover:bg-cyan-900/30 cursor-pointer transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>Dropbox OK</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenDropboxConnect || onOpenSettings}
                title="Conectar con Dropbox mediante código de autorización (OAuth)"
                style={{ fontSize: `${(9.5 * scale).toFixed(1)}px`, minHeight: `${Math.round(22 * scale)}px` }}
                className="px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 flex items-center gap-1.5 hover:bg-cyan-500/20 hover:border-cyan-400 cursor-pointer transition-colors"
              >
                <Cloud
                  style={{ width: `${Math.round(11 * scale)}px`, height: `${Math.round(11 * scale)}px` }}
                  className="text-cyan-400"
                />
                <span>Conectar Dropbox</span>
              </button>
            )}
          </div>
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

        {onChangeDatabaseScope&&<div className="flex shrink-0 items-center gap-1.5"><span style={{fontSize:11*scale}} className="text-slate-400">Base:</span><SearchChoice label="Filtrar por base de datos" value={databaseScope} onChange={onChangeDatabaseScope} scale={scale} options={[
          {value:'Notion',label:'Todas las bases de Notion'},
          ...(!['Notion','Todas bases'].includes(databaseScope)&&!databaseScope.startsWith('base:')?[{value:databaseScope,label:'Ámbito actual: '+databaseScope}]:[]),
          ...(databaseScope==='Todas bases'?[{value:'Todas bases',label:'Todas las bases'}]:[]),
          ...databaseOptions
        ]}/></div>}

        {onChangeClassification&&<SearchChoice label="Proyecto o documentación" value={classification} onChange={onChangeClassification} scale={scale} options={[{value:'all',label:'Proyecto + documentación'},{value:'project',label:'P · Proyecto'},{value:'documentation',label:'D · Documentación'},{value:'unclassified',label:'Sin clasificar'}]}/>}
        {/* Agrupar */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }} className="text-[#94A3B8]">
            Agrupar:
          </span>
          <SearchChoice label="Agrupar resultados" value={groupBy} onChange={onChangeGroupBy} scale={scale} options={[
            {value:'none',label:'Ninguno',description:'Lista continua, con actividades activas primero.'},
            {value:'database',label:'Base de datos',description:'Separa Revisiones, Clientes, Dominios y las demás bases.'},
            {value:'domain',label:'Dominio y estado'},
            {value:'domain_nobilling',label:'Dominio y estado · sin cobros/pagos'},
            {value:'project_suffix',label:'Proyecto / Sufijo (.webs, .ads...)'},
            {value:'month',label:'Mes',description:'Conserva todos los meses; el actual aparece primero.'},
            {value:'name',label:'Responsable'},
            {value:'name_noterminated',label:'Responsable · activas primero'},
            {value:'area',label:'Área de trabajo (WEB, ADS, SEO…)'},
            {value:'area_nobilling',label:'Tipo / área (sin cobrar/pagar)'}
          ]}/>

        </div>

        {/* Mes */}
        <div style={{ gap: `${Math.round(4 * scale)}px` }} className="flex items-center shrink-0">
          <span style={{ fontSize: `${(11 * scale).toFixed(1)}px` }} className="text-[#94A3B8]">
            Mes:
          </span>
          <SearchChoice label="Filtrar por mes" value={selectedMonth} onChange={onChangeMonth} scale={scale} options={[
            {value:'Actual',label:'Todos · actual primero'+(currentMonth?' ('+currentMonth+')':''),description:'No oculta los demás meses.'},
            ...MONTHS.map(m=>({value:m,label:m}))
          ]}/>

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
      {notification && (
        <div
          role="status"
          className={`mt-1.5 px-3 py-1.5 rounded text-xs font-medium flex items-center justify-between gap-2 transition-all animate-in fade-in duration-200 ${
            notification.type === 'error'
              ? 'bg-rose-950/90 border border-rose-500/50 text-rose-200'
              : notification.type === 'warning'
              ? 'bg-amber-950/90 border border-amber-500/50 text-amber-200'
              : notification.type === 'success'
              ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-200'
              : 'bg-sky-950/90 border border-sky-500/50 text-sky-200'
          }`}
        >
          {notification.type === 'warning' ? (
            <div className="flex-1 min-w-0">
              {(() => {
                const parts = [...new Set(notification.text.split(' · ').map(t => t.trim()).filter(Boolean))];
                if (parts.length > 1) {
                  return (
                    <details className="min-w-0">
                      <summary className="cursor-pointer select-none font-semibold">
                        Avisos de sincronización · Ver detalles ({parts.length})
                      </summary>
                      <ul className="mt-1.5 max-h-32 overflow-y-auto space-y-1 text-[11px] font-normal break-words">
                        {parts.map((p, idx) => (
                          <li key={idx}>• {p}</li>
                        ))}
                      </ul>
                    </details>
                  );
                }
                return <span>{notification.text}</span>;
              })()}
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span>{notification.text}</span>
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {notification.type === 'warning' && onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="underline hover:text-white text-[11px] cursor-pointer"
              >
                Abrir Configuración ⚙️
              </button>
            )}
            {onDismissNotification && (
              <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={onDismissNotification}
                className="hover:text-white px-1 text-sm cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export const SearchConfigRow = React.memo(SearchConfigRowComponent);
