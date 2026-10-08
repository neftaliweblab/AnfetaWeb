"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  Search,
  ExternalLink,
  Copy,
  Check,
  X,
  RefreshCw,
  Loader2,
  Calendar,
  Clock,
  User,
  Globe,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import {
  CALENDAR_QUICK_TEMPLATES,
  CALENDAR_TEMPLATE_HUB_URL,
  CalendarQuickTemplateDefinition,
  cleanCalendarQuickTemplateActivityTitle,
  extractCalendarQuickTemplateOrder,
  extractCalendarQuickTemplateDomain,
  buildCalendarQuickTemplateFinalTitle,
  filterTemplatesByCategory,
} from "@/lib/templateCatalog";
import { openNotionPage } from "@/services/windowsIntegration";
import { PreProjectGeneratorService } from "@/services/preProjectGenerator";

interface NotionTemplate {
  PageId: string;
  Title: string;
  PageUrl: string;
}

interface NotionTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate?: (title: string) => void;
  onActivitiesCreated?: (createdActivities: any[]) => void;
  currentDate?: string;
}

const COLLABORATORS = [
  "John",
  "Karla",
  "Isaias",
  "Sotelo",
  "Acalli",
  "Andrade",
  "Brian",
  "Pedro",
  "Neft",
];

const REVIEWERS = [
  { name: "John", tag: "john" },
  { name: "Karla", tag: "k-karl" },
  { name: "Neft", tag: "n-neft" },
];

export function NotionTemplatesModal({
  isOpen,
  onClose,
  onApplyTemplate,
  onActivitiesCreated,
  currentDate,
}: NotionTemplatesModalProps) {
  const [templates, setTemplates] = useState<NotionTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CalendarQuickTemplateDefinition>(
    CALENDAR_QUICK_TEMPLATES[0] // "todas"
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Paso 2: Modal de Configuración e Instanciación
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [templatesToConfig, setTemplatesToConfig] = useState<NotionTemplate[]>([]);

  // Parámetros de configuración
  const [configDomain, setConfigDomain] = useState("");
  const [configPerson, setConfigPerson] = useState("");
  const [configReviewer, setConfigReviewer] = useState("john");
  const [configDate, setConfigDate] = useState(() => currentDate || new Date().toISOString().split("T")[0]);
  const [configTime, setConfigTime] = useState("10:00");
  const [configDuration, setConfigDuration] = useState<number>(30);
  const [configSequential, setConfigSequential] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creationSuccessMsg, setCreationSuccessMsg] = useState<string | null>(null);

  // Modo Preproyectos (Paridad 1:1 con PreProjectGeneratorService de Desktop)
  const [isPreProjectTab, setIsPreProjectTab] = useState(false);
  const [preProjectDomain, setPreProjectDomain] = useState("");
  const [preProjectPlan, setPreProjectPlan] = useState<any | null>(null);
  const [preProjectCopiedMsg, setPreProjectCopiedMsg] = useState(false);

  const loadTemplates = () => {
    setLoading(true);
    fetch("/api/data?type=templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setTemplates(data.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setIsConfigOpen(false);
      setSelectedIds(new Set());
      setCreationSuccessMsg(null);
      if (currentDate) setConfigDate(currentDate);
    }
  }, [isOpen, currentDate]);

  const filtered = useMemo(() => {
    return filterTemplatesByCategory(templates, selectedCategory, search);
  }, [templates, selectedCategory, search]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Toggle selección
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set<string>();
    filtered.forEach((t) => next.add(t.PageId));
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Abrir configuración para 1 sola plantilla
  const handleOpenConfigSingle = (tpl: NotionTemplate) => {
    setTemplatesToConfig([tpl]);
    const detected = extractCalendarQuickTemplateDomain(tpl.Title);
    setConfigDomain(detected);
    setIsConfigOpen(true);
  };

  // Abrir configuración para las seleccionadas
  const handleOpenConfigSelected = () => {
    const list = templates.filter((t) => selectedIds.has(t.PageId));
    if (list.length === 0) return;
    setTemplatesToConfig(list);
    const firstDetected = list.map((t) => extractCalendarQuickTemplateDomain(t.Title)).find(Boolean) || "";
    setConfigDomain(firstDetected);
    setIsConfigOpen(true);
  };

  // Previsualización en tiempo real de títulos
  const previewGeneratedTitles = useMemo(() => {
    return templatesToConfig.map((tpl) => {
      const rawTitle = tpl.Title || "";
      const cleanTitle = cleanCalendarQuickTemplateActivityTitle(rawTitle, selectedCategory.projectToken);
      const order = extractCalendarQuickTemplateOrder(rawTitle);

      return buildCalendarQuickTemplateFinalTitle({
        projectToken: selectedCategory.projectToken,
        selectedDate: new Date(configDate + "T12:00:00"),
        orderToken: order,
        description: cleanTitle,
        domain: configDomain,
        personName: configPerson,
        reviewerName: configReviewer,
        templateOriginalTitle: rawTitle,
      });
    });
  }, [
    templatesToConfig,
    configDomain,
    configPerson,
    configReviewer,
    configDate,
    selectedCategory,
  ]);

  // Ejecutar creación en backend (/api/data)
  const handleExecuteCreation = async () => {
    if (templatesToConfig.length === 0) return;
    setIsSubmitting(true);

    try {
      const dateParts = configDate.split("-").map(Number);
      const timeParts = configTime.split(":").map(Number);
      const baseStart = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);

      let runningStart = new Date(baseStart);

      const requests = templatesToConfig.map((tpl, idx) => {
        const rawTitle = tpl.Title || "";
        const finalTitle = previewGeneratedTitles[idx] || rawTitle;

        const startDt = configSequential ? new Date(runningStart) : new Date(baseStart);
        const endDt = new Date(startDt.getTime() + configDuration * 60000);

        if (configSequential) {
          runningStart = new Date(endDt);
        }

        const formatIso = (d: Date) => {
          const pad = (n: number) => String(n).padStart(2, "0");
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00-06:00`;
        };

        return {
          sourcePageId: tpl.PageId,
          title: finalTitle,
          shortTitle: cleanCalendarQuickTemplateActivityTitle(rawTitle, selectedCategory.projectToken),
          start: formatIso(startDt),
          end: formatIso(endDt),
          person: configPerson || "Sin asignar",
          domain: configDomain || "DOMINIO",
        };
      });

      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-from-template",
          payload: {
            date: configDate,
            requests,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const created = data.createdActivities || [];
        if (onActivitiesCreated) {
          onActivitiesCreated(created);
        }

        setCreationSuccessMsg(
          `¡Se ${created.length === 1 ? "creó 1 actividad" : `crearon ${created.length} actividades`} con éxito en Notion y Calendario! (Estructura duplicada sin contenido)`
        );
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        alert("Ocurrió un error al crear la actividad desde la plantilla.");
      }
    } catch (err) {
      console.error("Error creating activities:", err);
      alert("Error de conexión al crear actividades.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#0F141C] border border-[#26323E] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* PASO 1: EXPLORADOR DE PLANTILLAS                          */}
        {/* ======================================================== */}
        {!isConfigOpen && (
          <>
            {/* Header */}
            <div className="h-12 px-4 border-b border-[#1E2836] flex items-center justify-between bg-[#111822] shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#38BDF8]" />
                <h3 className="text-xs sm:text-sm font-bold text-[#F1F5F9]">
                  Plantillas Rápidas de Notion (Plantilla Fase1)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#0C4A6E] text-[#38BDF8] border border-[#38BDF8]/40">
                  {templates.length} disponibles
                </span>
                <div className="flex items-center ml-2 border border-[#26354A] rounded p-0.5 bg-[#0A0E15]">
                  <button
                    type="button"
                    onClick={() => setIsPreProjectTab(false)}
                    className={`px-2 py-0.5 text-[10px] rounded font-medium cursor-pointer transition-colors ${
                      !isPreProjectTab ? "bg-[#0284C7] text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Fase 1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPreProjectTab(true);
                      if (!preProjectPlan) {
                        setPreProjectPlan(PreProjectGeneratorService.generatePlan(preProjectDomain || "midominio.com"));
                      }
                    }}
                    className={`px-2 py-0.5 text-[10px] rounded font-medium cursor-pointer transition-colors ${
                      isPreProjectTab ? "bg-[#0284C7] text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🚀 Pre-Proyectos
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadTemplates}
                  disabled={loading}
                  className="p-1.5 text-[#94A3B8] hover:text-[#38BDF8] rounded transition-colors cursor-pointer"
                  title="Recargar catálogo"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#38BDF8]" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[#94A3B8] hover:text-[#F1F5F9] p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Categorías ANFETA: Scroll horizontal elegante sin flechas feas de Windows */}
            <div className="px-3 py-2 bg-[#0C1118] border-b border-[#1E2836] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              {CALENDAR_QUICK_TEMPLATES.map((cat) => {
                const isActive = selectedCategory.key === cat.key;
                const count = filterTemplatesByCategory(templates, cat).length;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-[#0369A1]/35 text-[#38BDF8] border border-[#0284C7]/70 shadow-[0_0_8px_rgba(56,189,248,0.25)] font-semibold"
                        : "bg-[#111721] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#16202C] border border-[#1E2836]"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span
                      className={`text-[9.5px] font-mono px-1 py-0.2 rounded ${
                        isActive ? "bg-[#38BDF8]/20 text-[#38BDF8]" : "bg-[#1B2735] text-[#64748B]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Buscador y Controles de Selección */}
            <div className="p-3 border-b border-[#1E2836] bg-[#0B0F15] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
              <div className="flex-1 flex items-center gap-2 bg-[#141B26] border border-[#26354A] rounded px-3 py-1.5 focus-within:border-[#38BDF8]">
                <Search className="w-3.5 h-3.5 text-[#64748B]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Buscar en ${selectedCategory.label} (nombre, orden 6.00, tag)...`}
                  className="bg-transparent text-xs text-white placeholder-[#64748B] focus:outline-none flex-1"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-[#64748B] hover:text-white cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Botones de selección masiva */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-1 rounded bg-[#161F2C] hover:bg-[#1E2836] text-[#CBD5E1] border border-[#26354A] text-xs font-medium flex items-center gap-1 cursor-pointer"
                  title="Marcar todas las visibles"
                >
                  <CheckSquare className="w-3 h-3 text-[#38BDF8]" />
                  <span>Todas</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-2 py-1 rounded bg-[#161F2C] hover:bg-[#1E2836] text-[#CBD5E1] border border-[#26354A] text-xs font-medium flex items-center gap-1 cursor-pointer"
                  title="Desmarcar todas"
                >
                  <Square className="w-3 h-3 text-[#94A3B8]" />
                  <span>Limpiar</span>
                </button>
                <span className="text-xs font-mono font-bold text-[#38BDF8] px-2 py-1 bg-[#132230] border border-[#203D52] rounded">
                  {selectedIds.size} marcadas
                </span>
              </div>
            </div>

            {/* Lista de plantillas con diseño responsivo */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
              {loading && (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#94A3B8]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#38BDF8]" />
                  <span>Cargando catálogo oficial de plantillas...</span>
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="py-12 text-center text-xs text-[#64748B]">
                  No se encontraron plantillas en &quot;{selectedCategory.label}&quot; con el filtro actual.
                </div>
              )}

              {!loading &&
                filtered.map((t, idx) => {
                  const rawTitle = t.Title || "";
                  const order = extractCalendarQuickTemplateOrder(rawTitle);
                  const clean = cleanCalendarQuickTemplateActivityTitle(rawTitle, selectedCategory.projectToken);
                  const suggestedDomain = extractCalendarQuickTemplateDomain(rawTitle);
                  const isChecked = selectedIds.has(t.PageId);

                  return (
                    <div
                      key={t.PageId || idx}
                      onClick={() => toggleSelect(t.PageId)}
                      onDoubleClick={() => handleOpenConfigSingle(t)}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded border transition-all gap-2.5 cursor-pointer group ${
                        isChecked
                          ? "bg-[#0F2233] border-[#38BDF8]/60 shadow-[0_0_8px_rgba(56,189,248,0.15)]"
                          : "bg-[#131A22] border-[#223848] hover:bg-[#18212B] hover:border-[#33465C]"
                      }`}
                      title="Haz doble clic para instanciar esta plantilla directamente"
                    >
                      {/* Lado izquierdo: Checkbox + Badge + Textos */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? "bg-[#0284C7] border-[#38BDF8] text-white"
                              : "bg-[#182230] border-[#33465C] group-hover:border-[#38BDF8]"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <div className="px-2 py-0.5 rounded-full font-mono font-bold text-[10px] bg-[#162536] text-[#38BDF8] border border-[#214360] shrink-0">
                          {order || String(idx + 1).padStart(2, "0")}
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-semibold text-[#E2E8F0] block truncate group-hover:text-[#38BDF8]">
                            {clean}
                          </span>
                          <span className="text-[9.5px] font-mono text-[#64748B] truncate block">
                            {rawTitle}
                          </span>
                        </div>

                        {suggestedDomain && (
                          <span className="hidden md:inline text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[#132230] text-[#93C5FD] border border-[#1E3A52] shrink-0">
                            {suggestedDomain}
                          </span>
                        )}
                      </div>

                      {/* Lado derecho: Botones de Acción (⚡ Usar destacado, Copiar, Filtrar, Notion) */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                        {/* Botón USAR (Destacado en Azul) */}
                        <button
                          type="button"
                          onClick={() => handleOpenConfigSingle(t)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0284C7] hover:bg-[#0369A1] text-white text-[11px] font-bold shadow-sm transition-colors cursor-pointer"
                          title="Duplicar estructura e instanciar en Notion (sin contenido de plantilla)"
                        >
                          <Zap className="w-3 h-3 text-white fill-white" />
                          <span>Usar</span>
                        </button>

                        {/* Botón Copiar */}
                        <button
                          type="button"
                          onClick={() => handleCopy(t.PageId, clean)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-[#161F2C] border border-[#26354A] hover:border-[#38BDF8] text-[#CBD5E1] text-[10.5px] cursor-pointer transition-colors"
                          title="Copiar título limpio"
                        >
                          {copiedId === t.PageId ? (
                            <Check className="w-3 h-3 text-[#4ADE80]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span className="hidden sm:inline">{copiedId === t.PageId ? "Copiado" : "Copiar"}</span>
                        </button>

                        {/* Botón Filtrar en tabla (icono Search) */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onApplyTemplate) onApplyTemplate(clean);
                            onClose();
                          }}
                          className="p-1 px-1.5 rounded bg-[#131F2E] border border-[#23425F] text-[#94A3B8] hover:text-[#38BDF8] text-[10.5px] font-medium hover:bg-[#1E3048] transition-colors cursor-pointer flex items-center gap-1"
                          title="Filtrar actividades de esta plantilla en la tabla de búsqueda"
                        >
                          <Search className="w-3 h-3 text-[#38BDF8]" />
                          <span className="hidden md:inline text-[10px]">Filtrar</span>
                        </button>

                        {/* Botón Ver en Notion */}
                        {t.PageUrl && (
                          <button
                            type="button"
                            onClick={() => openNotionPage(t.PageUrl)}
                            className="p-1 rounded bg-[#161F2C] border border-[#26354A] text-[#94A3B8] hover:text-[#38BDF8] cursor-pointer transition-colors"
                            title="Ver en Notion"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* VISTA DE PRE-PROYECTOS EN 1-CLIC */}
            {isPreProjectTab ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#090D13]">
                <div className="bg-[#111722] border border-[#1E2836] rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E2836] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>🚀 Generador Masivo de Pre-Proyectos</span>
                      </h4>
                      <p className="text-xs text-[#94A3B8]">
                        Crea el plan de 6 pasos, carpetas DRX y mensaje de WhatsApp en un solo clic.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={preProjectDomain}
                        onChange={(e) => {
                          setPreProjectDomain(e.target.value);
                          setPreProjectPlan(PreProjectGeneratorService.generatePlan(e.target.value));
                        }}
                        placeholder="dominio.com"
                        className="bg-[#16202C] border border-[#26354A] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                  </div>

                  {preProjectPlan && (
                    <div className="space-y-4">
                      {/* Pasos */}
                      <div>
                        <h5 className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider mb-2">
                          1. Pasos de Inducción / Notion:
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {preProjectPlan.steps.map((st: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded bg-[#16202C] border border-[#26354A] text-xs">
                              <span className="font-bold text-white block mb-0.5">{st.title}</span>
                              <span className="text-[11px] text-slate-400">{st.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Carpetas DRX */}
                      <div>
                        <h5 className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider mb-2">
                          2. Carpetas a generar en Dropbox DRX:
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {preProjectPlan.requiredDropboxFolders.map((f: string, idx: number) => (
                            <span key={idx} className="px-2.5 py-1 rounded bg-[#0A1628] border border-[#0284C7]/40 text-[#38BDF8] text-xs font-mono">
                              📁 {f}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* WhatsApp */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-bold text-[#22C55E] uppercase tracking-wider">
                            3. Mensaje de bienvenida para WhatsApp:
                          </h5>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(preProjectPlan.initialWhatsAppMessage);
                              setPreProjectCopiedMsg(true);
                              setTimeout(() => setPreProjectCopiedMsg(false), 2000);
                            }}
                            className="px-2.5 py-1 rounded bg-[#14532D] text-green-200 text-[11px] font-bold hover:bg-[#166534] transition-colors cursor-pointer flex items-center gap-1"
                          >
                            {preProjectCopiedMsg ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{preProjectCopiedMsg ? "Copiado" : "Copiar mensaje"}</span>
                          </button>
                        </div>
                        <pre className="p-3 rounded bg-[#061C14] border border-[#14532D] text-green-300 text-xs font-sans whitespace-pre-wrap">
                          {preProjectPlan.initialWhatsAppMessage}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Footer con Acción Masiva */}
            <div className="h-12 px-4 bg-[#0A0E15] border-t border-[#1E2836] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => openNotionPage(selectedCategory.sourceUrl || CALENDAR_TEMPLATE_HUB_URL)}
                className="text-xs text-[#38BDF8] hover:underline flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Abrir catálogo en Notion</span>
                <span className="sm:hidden">Notion</span>
              </button>

              <div className="flex items-center gap-2">
                {!isPreProjectTab && (
                  <button
                    type="button"
                    onClick={handleOpenConfigSelected}
                    disabled={selectedIds.size === 0}
                    className="px-3 py-1.5 rounded bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span>
                      {selectedIds.size === 0
                        ? "Selecciona para instanciar"
                        : `Usar ${selectedIds.size} seleccionada${selectedIds.size === 1 ? "" : "s"}`}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 bg-[#18212B] hover:bg-[#223848] text-[#CBD5E1] text-xs font-medium rounded cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* PASO 2: MODAL DE CONFIGURACIÓN E INSTANCIACIÓN           */}
        {/* ======================================================== */}
        {isConfigOpen && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0B0F15]">
            {/* Header del Paso 2 */}
            <div className="p-3 bg-[#0E1520] border-b border-[#1E2836] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-2 py-1 rounded bg-[#141C28] hover:bg-[#1A2536] text-[#38BDF8] border border-[#23354C] flex items-center gap-1 text-xs cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a lista</span>
                </button>
                <h4 className="text-xs sm:text-sm font-bold text-[#F1F5F9] flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-[#FACC15]" />
                  <span>Configurar e Instanciar Plantilla</span>
                </h4>
              </div>

              <span className="text-xs font-mono font-bold text-[#38BDF8] px-2 py-0.5 rounded bg-[#132230] border border-[#214360]">
                {templatesToConfig.length} actividad{templatesToConfig.length === 1 ? "" : "es"}
              </span>
            </div>

            {/* Formulario y Previsualización */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {/* Notificación informativa estilo ANFETA */}
              <div className="p-3 rounded-lg bg-[#0B2538] border border-[#0284C7]/50 text-xs text-[#7DD3FC] flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">Duplicación exacta sin contenido (Paridad 1:1 ANFETA):</strong>
                  Se creará una nueva actividad en Notion heredando todas las propiedades de la plantilla seleccionada (asignación, estado, base de datos, Fecha POR Hacer).
                  El <strong className="text-white">cuerpo/body</strong> de la página se creará limpio y vacío para que tú escribas tu contenido directamente.
                </div>
              </div>

              {creationSuccessMsg && (
                <div className="p-3 rounded-lg bg-[#0369A1]/30 border border-[#38BDF8] text-xs text-[#38BDF8] font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>{creationSuccessMsg}</span>
                </div>
              )}

              {/* Grid 1: Dominio, Responsable, Revisor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Dominio */}
                <div>
                  <label className="text-[11px] font-semibold text-[#94A3B8] mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-[#38BDF8]" />
                    <span>Dominio / Proyecto</span>
                  </label>
                  <input
                    type="text"
                    value={configDomain}
                    onChange={(e) => setConfigDomain(e.target.value)}
                    placeholder="ejemplo.com"
                    className="w-full bg-[#121A26] border border-[#22354A] rounded px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>

                {/* Responsable */}
                <div>
                  <label className="text-[11px] font-semibold text-[#94A3B8] mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-[#38BDF8]" />
                    <span>Responsable</span>
                  </label>
                  <select
                    value={configPerson}
                    onChange={(e) => setConfigPerson(e.target.value)}
                    className="w-full bg-[#121A26] border border-[#22354A] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                  >
                    <option value="">— Sin asignar —</option>
                    {COLLABORATORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Revisor */}
                <div>
                  <label className="text-[11px] font-semibold text-[#94A3B8] mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-[#A855F7]" />
                    <span>Revisor</span>
                  </label>
                  <select
                    value={configReviewer}
                    onChange={(e) => setConfigReviewer(e.target.value)}
                    className="w-full bg-[#121A26] border border-[#22354A] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                  >
                    <option value="">— Sin revisor —</option>
                    {REVIEWERS.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name} ({r.tag})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid 2: Horario, Fecha, Duración, Secuencial */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[#0E1520] border border-[#1E293B]">
                {/* Fecha */}
                <div>
                  <label className="text-[11px] font-semibold text-[#94A3B8] mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#38BDF8]" />
                    <span>Fecha programada</span>
                  </label>
                  <input
                    type="date"
                    value={configDate}
                    onChange={(e) => setConfigDate(e.target.value)}
                    className="w-full bg-[#121A26] border border-[#22354A] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8] [color-scheme:dark] cursor-pointer"
                  />
                </div>

                {/* Hora base */}
                <div>
                  <label className="text-[11px] font-semibold text-[#94A3B8] mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#38BDF8]" />
                    <span>Hora de inicio base</span>
                  </label>
                  <input
                    type="time"
                    value={configTime}
                    onChange={(e) => setConfigTime(e.target.value)}
                    className="w-full bg-[#121A26] border border-[#22354A] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8] [color-scheme:dark] cursor-pointer"
                  />
                </div>

                {/* Duración */}
                <div>
                  <label className="text-[11px] font-semibold text-[#94A3B8] mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#A855F7]" />
                    <span>Duración estimada</span>
                  </label>
                  <select
                    value={configDuration}
                    onChange={(e) => setConfigDuration(Number(e.target.value))}
                    className="w-full bg-[#121A26] border border-[#22354A] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                  >
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos (1 hora)</option>
                    <option value={90}>90 minutos (1.5 horas)</option>
                    <option value={120}>120 minutos (2 horas)</option>
                  </select>
                </div>
              </div>

              {/* Secuencial Checkbox si son múltiples */}
              {templatesToConfig.length > 1 && (
                <div className="flex items-center gap-2 p-2 rounded bg-[#101824] border border-[#1E2B3D]">
                  <input
                    type="checkbox"
                    id="seq-notion-check"
                    checked={configSequential}
                    onChange={(e) => setConfigSequential(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0284C7] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="seq-notion-check" className="text-xs text-[#CBD5E1] cursor-pointer select-none">
                    Distribuir secuencialmente en el calendario (+{configDuration} min por actividad consecutiva)
                  </label>
                </div>
              )}

              {/* Previsualización en Tiempo Real */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[#E2E8F0] tracking-wider uppercase font-mono block">
                  Vista Previa de Títulos a Crear en Notion ({previewGeneratedTitles.length}):
                </span>
                <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-thin p-2 rounded-lg bg-[#080B0F] border border-[#1E2836]">
                  {previewGeneratedTitles.map((title, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-[#0F1722] border border-[#203348] text-xs font-mono text-[#7DD3FC] flex items-center justify-between gap-2"
                    >
                      <span className="truncate flex-1">{title}</span>
                      <span className="text-[10px] text-[#64748B] shrink-0 font-sans">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer del Paso 2: Botón de Ejecución */}
            <div className="h-14 px-4 bg-[#0A0E15] border-t border-[#1E2836] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="px-3.5 py-1.5 bg-[#18212B] hover:bg-[#223848] text-[#CBD5E1] text-xs font-medium rounded cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecuteCreation}
                disabled={isSubmitting || templatesToConfig.length === 0}
                className="px-5 py-2 rounded bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando en Notion...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>
                      🚀 Crear {templatesToConfig.length === 1 ? "Actividad" : `${templatesToConfig.length} Actividades`} en Notion y Calendario
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
