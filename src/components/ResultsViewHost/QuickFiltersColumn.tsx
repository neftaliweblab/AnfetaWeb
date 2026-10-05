"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  User,
  Globe,
  BookOpen,
  Clock,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { ActiveProjectItem } from "@/types/anfeta";

interface QuickFiltersColumnProps {
  onQuickSearch: (term: string) => void;
  activeTodayProjects: ActiveProjectItem[];
  onFilterByProject: (domain: string) => void;
  onOpenProjectNotion?: (domain: string) => void;
  onGenerateDailyAiSummary?: () => void;
}

// 1. Opciones de Archivos (ext:...)
const ARCHIVOS_ITEMS = [
  { label: "📕 PDF (.pdf)", tag: "ext:pdf" },
  { label: "📘 Word / DOCX (.docx)", tag: "ext:doc;docx" },
  { label: "📊 Excel / XLSX (.xlsx)", tag: "ext:xls;xlsx" },
  { label: "🖼 Imágenes (PNG, JPG, WebP)", tag: "ext:png;jpg;jpeg;webp;gif;bmp" },
  { label: "🔗 Enlaces y accesos directos (.url)", tag: "ext:url" },
  { isSeparator: true },
  { label: "📁 Solo carpetas (.folder)", tag: ".folder" },
  { label: "📋 Todos los documentos", tag: "ext:doc;docx;pdf;xls;xlsx;txt" },
];

// 2. Opciones de Personas
const PERSONAS_ITEMS = [
  { label: "👤 Neftali (nneft)", tag: "nneft" },
  { label: "👤 John (jjohn)", tag: "jjohn" },
  { label: "👤 Karla (kkarl)", tag: "kkarl" },
  { label: "👤 Brian (bbria)", tag: "bbria" },
  { label: "👤 Genaro (ggena)", tag: "ggena" },
  { label: "👤 Isaias (iisai)", tag: "iisai" },
  { label: "👤 Sotelo (eedua)", tag: "eedua" },
  { label: "👤 Acalli (aacal)", tag: "aacal" },
  { label: "👤 Andrade (aandr)", tag: "aandr" },
  { label: "👤 Emmanuel (eemma)", tag: "eemma" },
];

// 3. Opciones de Proyectos (Tipos de Proyecto)
const PROYECTOS_ITEMS = [
  { label: "🌐 WEB (wwebs)", tag: "wwebs" },
  { label: "🔍 SEO (sseo)", tag: "sseo" },
  { label: "📢 ADS (aads)", tag: "aads" },
  { label: "💼 Cotización (ccoti)", tag: "ccoti" },
  { label: "📍 Google Maps (mmaps)", tag: "mmaps" },
  { label: "📱 Redes Sociales (rrede)", tag: "rrede" },
  { label: "💻 Aplicaciones (aapli)", tag: "aapli" },
  { label: "⚙ Programas (pprog)", tag: "pprog" },
  { label: "📚 Bibliotecas (bbibl)", tag: "bbibl" },
];

// 4. Opciones de Notion (Bases de Datos)
const NOTION_ITEMS = [
  { label: "🔄 Revisiones", tag: "revisiones" },
  { label: "👥 zClientes", tag: "zclientes" },
  { label: "🌐 zDominios", tag: "zdominios" },
  { label: "📂 zProyectos", tag: "zproyectos" },
  { label: "💳 zPAGAR", tag: "zpagar" },
  { label: "💰 zCOBRAR", tag: "zcobrar" },
  { label: "✉ zCorreos", tag: "zcorreos" },
];

// 5. Opciones de Estados / Flujo
const ESTADOS_ITEMS = [
  { label: "⏳ Pendientes (prtuzREVISION)", tag: "prtuzREVISION" },
  { label: "🔍 En Revisión (rtuzREVISION)", tag: "rtuzREVISION" },
  { label: "✅ Terminados (zREVISION)", tag: "zREVISION" },
  { label: "💬 Con Respuesta ([RESPUESTA])", tag: "[RESPUESTA]" },
];

// 6. Colores de chips según el área/tipo detectado (1:1 ANFETA WinUI)
function getAreaChipStyle(type?: string) {
  const t = (type || "").trim().toUpperCase();
  if (t.includes("ADS")) return { bg: "rgba(14, 165, 233, 0.2)", border: "rgba(56, 189, 248, 0.55)", text: "#BAE6FD" };
  if (t.includes("SEO")) return { bg: "rgba(16, 185, 129, 0.2)", border: "rgba(52, 211, 153, 0.55)", text: "#A7F3D0" };
  if (t.includes("WEB")) return { bg: "rgba(139, 92, 246, 0.2)", border: "rgba(167, 139, 250, 0.55)", text: "#DDD6FE" };
  if (t.includes("COTI") || t.includes("COTIZ")) return { bg: "rgba(245, 158, 11, 0.2)", border: "rgba(251, 191, 36, 0.55)", text: "#FEF3C7" };
  if (t.includes("MAP")) return { bg: "rgba(244, 63, 94, 0.2)", border: "rgba(251, 113, 133, 0.55)", text: "#FECDDA" };
  if (t.includes("RED")) return { bg: "rgba(236, 72, 153, 0.2)", border: "rgba(244, 114, 182, 0.55)", text: "#FCE7F3" };
  if (t.includes("APP") || t.includes("PROG")) return { bg: "rgba(99, 102, 241, 0.2)", border: "rgba(129, 140, 248, 0.55)", text: "#E0E7FF" };
  if (t.includes("BIBL")) return { bg: "rgba(168, 85, 247, 0.2)", border: "rgba(192, 132, 252, 0.55)", text: "#F3E8FF" };
  if (t.includes("DISE")) return { bg: "rgba(234, 88, 12, 0.2)", border: "rgba(251, 146, 60, 0.55)", text: "#FFEDD5" };
  return { bg: "rgba(71, 85, 105, 0.2)", border: "rgba(148, 163, 184, 0.5)", text: "#E2E8F0" };
}

export function QuickFiltersColumn({
  onQuickSearch,
  activeTodayProjects,
  onFilterByProject,
  onOpenProjectNotion,
  onGenerateDailyAiSummary,
}: QuickFiltersColumnProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (isAllExpanded) {
      setIsAllExpanded(false);
      setExpandedDomains(new Set());
    } else {
      setIsAllExpanded(true);
      setExpandedDomains(new Set(activeTodayProjects.map((p) => p.domain)));
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectOption = (tag: string) => {
    onQuickSearch(tag);
    setOpenDropdown(null);
  };

  return (
    <div className="w-[235px] shrink-0 h-full bg-[#0F141C] border border-[#1E2836] rounded-lg p-2.5 flex flex-col select-none text-xs overflow-hidden">
      {/* 1. Header BÚSQUEDAS RÁPIDAS & Accesos rápidos (Paridad 1:1 ANFETA) */}
      <div className="shrink-0 mb-2 relative" ref={containerRef}>
        <div className="px-1 mb-2">
          <span className="text-[11px] font-semibold text-[#8B9BB4] tracking-wide block uppercase">
            BÚSQUEDAS RÁPIDAS
          </span>
          <span className="text-[11px] font-medium text-[#94A3B8] block mt-1">
            Accesos rápidos
          </span>
        </div>

        {/* Grid de 5 Accesos Rápidos */}
        <div className="grid grid-cols-2 gap-1.5 relative">
          {/* 1. Archivos */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "archivos" ? null : "archivos")}
              className={`w-full min-h-[28px] px-2 py-1 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                openDropdown === "archivos"
                  ? "bg-[#253549] border-[#38BDF8] text-white shadow-sm"
                  : "bg-[#1E293B] border-[#334155] hover:bg-[#27354A] hover:border-[#475569] text-[#E2E8F0]"
              }`}
              title="Filtrar por archivo o extensión (PDF, Word, Excel, imágenes, etc.)"
            >
              <Folder className="w-3.5 h-3.5 text-[#38BDF8] shrink-0 fill-[#38BDF8]/20" />
              <span className="truncate">Archivos</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#94A3B8] opacity-60 shrink-0" />
            </button>
            {openDropdown === "archivos" && (
              <div className="absolute left-0 top-full mt-1 w-[215px] bg-[#0F1722] border border-[#26354A] rounded-lg shadow-2xl p-1 z-50 max-h-[260px] overflow-y-auto scrollbar-thin">
                {ARCHIVOS_ITEMS.map((item, idx) =>
                  item.isSeparator ? (
                    <div key={idx} className="my-1 border-t border-[#1E293B]" />
                  ) : (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectOption(item.tag!)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1E293B] text-[10.5px] text-[#CBD5E1] hover:text-[#38BDF8] transition-colors cursor-pointer truncate"
                    >
                      {item.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* 2. Personas */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "personas" ? null : "personas")}
              className={`w-full min-h-[28px] px-2 py-1 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                openDropdown === "personas"
                  ? "bg-[#253549] border-[#A78BFA] text-white shadow-sm"
                  : "bg-[#1E293B] border-[#334155] hover:bg-[#27354A] hover:border-[#475569] text-[#E2E8F0]"
              }`}
              title="Filtrar por persona asignada en Notion"
            >
              <User className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
              <span className="truncate">Personas</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#94A3B8] opacity-60 shrink-0" />
            </button>
            {openDropdown === "personas" && (
              <div className="absolute right-0 top-full mt-1 w-[215px] bg-[#0F1722] border border-[#26354A] rounded-lg shadow-2xl p-1 z-50 max-h-[260px] overflow-y-auto scrollbar-thin">
                {PERSONAS_ITEMS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(item.tag)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1E293B] text-[10.5px] text-[#CBD5E1] hover:text-[#A78BFA] transition-colors cursor-pointer truncate"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Proyectos */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "proyectos" ? null : "proyectos")}
              className={`w-full min-h-[28px] px-2 py-1 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                openDropdown === "proyectos"
                  ? "bg-[#253549] border-[#34D399] text-white shadow-sm"
                  : "bg-[#1E293B] border-[#334155] hover:bg-[#27354A] hover:border-[#475569] text-[#E2E8F0]"
              }`}
              title="Filtrar por tipo o área de proyecto"
            >
              <Globe className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
              <span className="truncate">Proyectos</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#94A3B8] opacity-60 shrink-0" />
            </button>
            {openDropdown === "proyectos" && (
              <div className="absolute left-0 top-full mt-1 w-[215px] bg-[#0F1722] border border-[#26354A] rounded-lg shadow-2xl p-1 z-50 max-h-[260px] overflow-y-auto scrollbar-thin">
                {PROYECTOS_ITEMS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(item.tag)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1E293B] text-[10.5px] text-[#CBD5E1] hover:text-[#34D399] transition-colors cursor-pointer truncate"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. Notion */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "notion" ? null : "notion")}
              className={`w-full min-h-[28px] px-2 py-1 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                openDropdown === "notion"
                  ? "bg-[#253549] border-[#FBBF24] text-white shadow-sm"
                  : "bg-[#1E293B] border-[#334155] hover:bg-[#27354A] hover:border-[#475569] text-[#E2E8F0]"
              }`}
              title="Filtrar por bases de datos de Notion"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
              <span className="truncate">Notion</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#94A3B8] opacity-60 shrink-0" />
            </button>
            {openDropdown === "notion" && (
              <div className="absolute right-0 top-full mt-1 w-[215px] bg-[#0F1722] border border-[#26354A] rounded-lg shadow-2xl p-1 z-50 max-h-[260px] overflow-y-auto scrollbar-thin">
                {NOTION_ITEMS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(item.tag)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1E293B] text-[10.5px] text-[#CBD5E1] hover:text-[#FBBF24] transition-colors cursor-pointer truncate"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5. Estados / Flujo (Ancho Completo) */}
          <div className="col-span-2 relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "estados" ? null : "estados")}
              className={`w-full min-h-[28px] px-3 py-1 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                openDropdown === "estados"
                  ? "bg-[#253549] border-[#F472B6] text-white shadow-sm"
                  : "bg-[#1E293B] border-[#334155] hover:bg-[#27354A] hover:border-[#475569] text-[#E2E8F0]"
              }`}
              title="Filtrar por estado o flujo de actividades"
            >
              <Clock className="w-3.5 h-3.5 text-[#F472B6] shrink-0" />
              <span className="truncate">Estados / Flujo</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#94A3B8] opacity-60 shrink-0" />
            </button>
            {openDropdown === "estados" && (
              <div className="absolute left-0 right-0 top-full mt-1 w-full bg-[#0F1722] border border-[#26354A] rounded-lg shadow-2xl p-1 z-50 max-h-[260px] overflow-y-auto scrollbar-thin">
                {ESTADOS_ITEMS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(item.tag)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1E293B] text-[10.5px] text-[#CBD5E1] hover:text-[#F472B6] transition-colors cursor-pointer truncate"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. PROYECTOS ACTIVOS HOY (Card idéntico a ANFETA) */}
      <div className="bg-[#101A22] border border-[#27485B] rounded-[9px] p-2 flex flex-col flex-1 min-h-0">
        <div className="shrink-0 space-y-1.5 mb-2">
          {/* Cabecera del Card */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]">🔥</span>
              <span className="text-[9.5px] font-semibold text-[#E8F5FF] tracking-wide uppercase font-mono">
                PROYECTOS ACTIVOS HOY
              </span>
            </div>
            <div className="min-w-[20px] h-[18px] px-1.5 rounded-full flex items-center justify-center bg-[#24384A] border border-[#3D617A] text-[#BFE8FF] text-[8.5px] font-bold font-mono">
              {activeTodayProjects.length}
            </div>
          </div>

          <p className="text-[8.5px] text-[#64748B] leading-tight">
            {activeTodayProjects.length === 0
              ? "Cargando proyectos del día…"
              : "Proyectos con actividad hoy · clic para buscar"}
          </p>

          {/* Botones de acción: Desplegar todos / Resumen IA */}
          <div className="grid grid-cols-2 gap-1 pt-0.5">
            <button
              type="button"
              onClick={handleToggleAll}
              className="min-h-[25px] px-1.5 rounded-[6px] bg-[#1B2B38] border border-[#335670] hover:bg-[#24394A] text-[#E2E8F0] text-[8.5px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Desplegar o contraer las actividades de todos los proyectos de hoy"
            >
              <ChevronRight
                className={`w-2.5 h-2.5 text-[#38BDF8] transition-transform ${
                  isAllExpanded ? "rotate-90" : ""
                }`}
              />
              <span>{isAllExpanded ? "Contraer todos" : "Desplegar todos"}</span>
            </button>

            <button
              type="button"
              onClick={onGenerateDailyAiSummary}
              className="min-h-[25px] px-1.5 rounded-[6px] bg-[#1A332B] border border-[#245C4B] hover:bg-[#224439] text-[#86EFAC] text-[8.5px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Resumen local y análisis opcional con OpenAI de las actividades cargadas de hoy"
            >
              <span>Resumen IA</span>
            </button>
          </div>
        </div>

        {/* Lista de Proyectos Activos: ocupa todo el resto de la columna con scroll vertical */}
        <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-0.5">
          {activeTodayProjects.map((p) => {
            const isExpanded = isAllExpanded || expandedDomains.has(p.domain);
            return (
              <div key={p.domain} className="space-y-1">
                {/* Cabecera del Proyecto (Expand + Dominio + N) */}
                <div className="flex items-center gap-1">
                  {/* Botón Expansión Chevron */}
                  <button
                    type="button"
                    onClick={() => toggleDomain(p.domain)}
                    className="w-[22px] h-[29px] shrink-0 rounded-[6px] bg-[#38BDF8]/10 border border-[#38BDF8]/30 hover:bg-[#38BDF8]/20 flex items-center justify-center text-[#93C5FD] transition-colors cursor-pointer"
                    title={`Desplegar ${p.count} actividad(es) de ${p.domain} hoy`}
                  >
                    <ChevronRight
                      className={`w-2.5 h-2.5 text-[#38BDF8] transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {/* Botón Principal de Dominio + Badge */}
                  <button
                    type="button"
                    onClick={() => onFilterByProject(p.domain)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      window.open(`https://${p.domain}`, "_blank");
                    }}
                    className="flex-1 min-w-0 min-h-[29px] px-2 py-1 rounded-[7px] bg-[#38BDF8]/10 border border-[#38BDF8]/30 hover:border-[#38BDF8]/60 hover:bg-[#38BDF8]/15 transition-colors text-left flex items-center justify-between group cursor-pointer"
                    title={`${p.domain} · ${p.count} actividad(es) hoy · clic: buscar dominio · clic derecho: abrir sitio web`}
                  >
                    <span className="text-[9.5px] font-semibold text-[#DCF1FC] group-hover:text-[#38BDF8] truncate">
                      {p.domain}
                    </span>
                    <span className="ml-1 px-1.5 min-w-[20px] h-[18px] rounded-full text-[8.2px] font-mono font-bold bg-[#0EA5E9]/30 text-[#E0F2FE] border border-[#38BDF8]/50 flex items-center justify-center shrink-0">
                      {p.count}
                    </span>
                  </button>

                  {/* Botón Notion 'N' */}
                  <button
                    type="button"
                    onClick={() =>
                      onOpenProjectNotion
                        ? onOpenProjectNotion(p.domain)
                        : onFilterByProject(p.domain)
                    }
                    className="w-[26px] h-[29px] shrink-0 flex items-center justify-center rounded-[7px] bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#7DD3FC] hover:bg-[#38BDF8]/25 hover:border-[#38BDF8] text-[10px] font-bold font-mono transition-colors cursor-pointer"
                    title={`Abrir vista de ${p.domain} en Notion\nClic derecho: forzar actualización.`}
                  >
                    N
                  </button>
                </div>

                {/* Subactividades Desplegables del Proyecto */}
                {isExpanded && p.activities && p.activities.length > 0 && (
                  <div className="ml-4 pl-1 border-l border-[#26354A] space-y-1 my-1">
                    {p.activities.map((sub, sIdx) => {
                      const chip = getAreaChipStyle(sub.type);
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => onQuickSearch(sub.rawTitle || `${p.domain} ${sub.title}`)}
                          onContextMenu={(e) => {
                            if (sub.pageUrl) {
                              e.preventDefault();
                              window.open(sub.pageUrl, "_blank");
                            }
                          }}
                          className="w-full text-left px-1.5 py-1 rounded-[5px] bg-[#0F172A]/70 border border-[#38BDF8]/20 hover:border-[#38BDF8]/60 hover:bg-[#1E293B] transition-colors flex items-center gap-1.5 group cursor-pointer"
                          title={`${sub.type} · ${sub.title}\nClic: buscar actividad · Clic derecho: abrir en Notion`}
                        >
                          <span
                            className="text-[7.5px] font-bold px-1 py-0.5 rounded shrink-0 leading-none"
                            style={{ backgroundColor: chip.bg, borderColor: chip.border, borderWidth: 1, color: chip.text }}
                          >
                            {sub.type}
                          </span>
                          <span className="text-[8.5px] text-[#CBD5E1] group-hover:text-white truncate">
                            {sub.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {activeTodayProjects.length === 0 && (
            <div className="h-full flex items-center justify-center text-center text-[#64748B] text-[9.5px] p-4">
              No hay proyectos activos registrados hoy
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
