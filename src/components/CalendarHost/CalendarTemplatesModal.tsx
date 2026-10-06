"use client";
import { mexicoDate } from "@/services/calendarPresentation";


import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  X,
  Plus,
  ExternalLink,
  Search,
  Check,
  CheckSquare,
  Square,
  Clock,
  User,
  Globe,
  Calendar,
  Layers,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { openNotionPage } from "@/services/windowsIntegration";
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

interface CalendarTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: string;
  currentDate?: string;
  onApplyTemplate?: (templateTitle: string) => void;
  onActivitiesCreated?: (createdActivities: any[]) => void;
}

const COLLABORATORS = [
  "John",
  "Karla",
  "Isaias",
  "Sotelo",
  "Acalli",
  "Andrade",
  "Brian",
  "Genaro",
  "Neftali",
];

const REVIEWERS = [
  { name: "John", tag: "john" },
  { name: "Karla", tag: "karl" },
  { name: "Isaias", tag: "isai" },
  { name: "Sotelo", tag: "edua" },
  { name: "Acalli", tag: "acal" },
  { name: "Andrade", tag: "andr" },
  { name: "Brian", tag: "bria" },
  { name: "Genaro", tag: "gena" },
  { name: "Neftali", tag: "neft" },
];

export function CalendarTemplatesModal({
  isOpen,
  onClose,
  currentDate = mexicoDate(), currentUser,
  onApplyTemplate,
  onActivitiesCreated,
}: CalendarTemplatesModalProps) {
  // Estado general
  const [templates, setTemplates] = useState<any[]>([]);
  const [creationError, setCreationError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CalendarQuickTemplateDefinition>(
    CALENDAR_QUICK_TEMPLATES[0] // "todos"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estado del paso de configuración (Paso 2)
  const [isConfigStep, setIsConfigStep] = useState(false);
  const [configPerson, setConfigPerson] = useState("");
  const [configReviewer, setConfigReviewer] = useState("");
  const [configDomain, setConfigDomain] = useState("");
  const [configDate, setConfigDate] = useState(currentDate);
  const [configTime, setConfigTime] = useState("10:00");
  const [configDuration, setConfigDuration] = useState(60);
  const [configSequential, setConfigSequential] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carga inicial de plantillas desde /api/data?type=templates
  const loadTemplates = () => {
    setLoading(true);
    fetch("/api/data?type=templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) {
          setTemplates(data.items);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando plantillas:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      setIsConfigStep(false);
      setConfigDate(currentDate);
      loadTemplates();
    }
  }, [isOpen, currentDate]);

  // Lista filtrada según categoría y texto de búsqueda
  const filteredTemplates = useMemo(() => {
    return filterTemplatesByCategory(templates, selectedCategory, searchQuery);
  }, [templates, selectedCategory, searchQuery]);

  // Manejo de selecciones
  const handleToggleSelect = (pageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredTemplates.map((t) => t.PageId || t.pageId)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Abrir configuración con las seleccionadas o con una individual
  const handleStartConfig = (singleItem?: any) => {
    const targetItems = singleItem
      ? [singleItem]
      : filteredTemplates.filter((t) => selectedIds.has(t.PageId || t.pageId));

    if (targetItems.length === 0) return;

    // Intentar extraer dominio sugerido del primer elemento si existe
    const firstTitle = targetItems[0]?.Title || targetItems[0]?.title || "";
    const suggestedDomain = extractCalendarQuickTemplateDomain(firstTitle);
    setConfigDomain(suggestedDomain || "");

    // Duración por defecto según la categoría
    setConfigDuration(selectedCategory.defaultDurationMinutes || 60);

    if (singleItem) {
      setSelectedIds(new Set([singleItem.PageId || singleItem.pageId]));
    }
    setIsConfigStep(true);
  };

  // Plantillas seleccionadas para el paso 2
  const selectedTemplatesList = useMemo(() => {
    return templates.filter((t) => selectedIds.has(t.PageId || t.pageId));
  }, [templates, selectedIds]);

  // Títulos generados en tiempo real para la vista previa
  const previewGeneratedTitles = useMemo(() => {
    if (!isConfigStep) return [];
    const dateObj = new Date(configDate + "T12:00:00");

    return selectedTemplatesList.map((tpl) => {
      const rawTitle = tpl.Title || tpl.title || "";
      const order = extractCalendarQuickTemplateOrder(rawTitle);
      const cleanDesc = cleanCalendarQuickTemplateActivityTitle(
        rawTitle,
        selectedCategory.projectToken
      );

      return buildCalendarQuickTemplateFinalTitle({
        projectToken: selectedCategory.projectToken,
        selectedDate: dateObj,
        orderToken: order,
        description: cleanDesc,
        domain: configDomain,
        personName: configPerson,
        reviewerName: configReviewer,
        templateOriginalTitle: rawTitle,
      });
    });
  }, [
    isConfigStep,
    selectedTemplatesList,
    configDate,
    configDomain,
    configPerson,
    configReviewer,
    selectedCategory,
  ]);

  // Crear actividades y persistir en backend
  const handleExecuteCreation = async () => {
    if (selectedTemplatesList.length === 0) return;
    setIsSubmitting(true);

    try {
      const dateParts = configDate.split("-").map(Number);
      const timeParts = configTime.split(":").map(Number);
      const baseStart = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);

      let runningStart = new Date(baseStart);

      const requests = selectedTemplatesList.map((tpl, idx) => {
        const rawTitle = tpl.Title || tpl.title || "";
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
          sourcePageId: tpl.PageId || tpl.pageId,
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
            currentUser,
            date: configDate,
            requests,
          },
        }),
      });

      const data = await res.json();
      if (data.createdActivities?.length) onActivitiesCreated?.(data.createdActivities);
      if (res.ok && data.success) onClose();
      else {
        const successful = new Set((data.results || []).filter((item:any)=>item.success).map((item:any)=>requests[item.index]?.sourcePageId));
        setSelectedIds(prev=>new Set([...prev].filter(id=>!successful.has(id))));
        setCreationError(data.error || 'No se confirmó la creación en Notion.');
      }
    } catch (err: any) {
      console.error("Error al aplicar plantillas:", err);
      setCreationError(err.message || "No se pudo conectar con Notion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#0B0F15] border border-[#223848] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera modal */}
        {creationError && <p role="alert" className="m-3 rounded border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">{creationError}</p>}
        <div className="h-12 px-4 border-b border-[#1E2836] flex items-center justify-between bg-[#0F141C]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#38BDF8]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#F1F5F9] flex items-center gap-2">
                <span>Catálogo de Plantillas ANFETA</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#182836] text-[#38BDF8] border border-[#224460]">
                  Plantilla Fase1
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTemplates}
              disabled={loading}
              className="p-1.5 text-[#94A3B8] hover:text-[#38BDF8] hover:bg-[#131A22] rounded transition-colors"
              title="Recargar catálogo desde Notion"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#38BDF8]" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] rounded transition-colors"
              title="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CONTENIDO: PASO 1 (Explorador y selector) */}
        {!isConfigStep && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Categorías ANFETA en barra horizontal deslizable */}
            <div className="px-3 py-2 bg-[#0C1118] border-b border-[#1E2836] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              {CALENDAR_QUICK_TEMPLATES.map((cat) => {
                const isActive = selectedCategory.key === cat.key;
                const catCount = filterTemplatesByCategory(templates, cat).length;
                return (
                  <button
                    key={cat.key}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSelectedIds(new Set());
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#0369A1]/30 text-[#38BDF8] border border-[#0284C7]/60 shadow-[0_0_8px_rgba(56,189,248,0.2)]"
                        : "bg-[#111721] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#16202C] border border-[#1E2836]"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span
                      className={`text-[9.5px] font-mono px-1 py-0.1 rounded ${
                        isActive ? "bg-[#38BDF8]/20 text-[#38BDF8]" : "bg-[#1B2735] text-[#64748B]"
                      }`}
                    >
                      {catCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Barra de Búsqueda y Selección masiva */}
            <div className="p-3 bg-[#0E141E] border-b border-[#1E2836] flex items-center justify-between gap-3">
              <div className="flex-1 flex items-center gap-2 bg-[#121A26] border border-[#223348] rounded px-3 py-1.5 focus-within:border-[#38BDF8]">
                <Search className="w-3.5 h-3.5 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Buscar en ${selectedCategory.label} (título, orden 6.00, responsable, dominio)...`}
                  className="bg-transparent text-xs text-white placeholder-[#64748B] focus:outline-none flex-1"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-[#64748B] hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Botones de selección masiva */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 rounded bg-[#131B26] hover:bg-[#182332] text-[#38BDF8] border border-[#22364C] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  title="Marcar todas las visibles"
                >
                  <CheckSquare className="w-3 h-3 text-[#38BDF8]" />
                  <span>Seleccionar todas</span>
                </button>
                <button
                  onClick={handleClearSelection}
                  className="px-2.5 py-1 rounded bg-[#131B26] hover:bg-[#182332] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#22364C] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  title="Limpiar selección"
                >
                  <Square className="w-3 h-3 text-[#64748B]" />
                  <span>Limpiar</span>
                </button>
                <span className="text-[11px] font-mono text-[#38BDF8] font-bold px-1.5">
                  {selectedIds.size} seleccionadas
                </span>
              </div>
            </div>

            {/* Sub-opciones de Redes si la categoría es redes */}
            {selectedCategory.subOptions && (
              <div className="px-3 py-1.5 bg-[#0A0E15] border-b border-[#1E2836] flex items-center gap-2">
                <span className="text-[10px] text-[#64748B] font-mono uppercase">Canales:</span>
                {selectedCategory.subOptions.map((sub) => (
                  <button
                    key={sub.token}
                    onClick={() => setSearchQuery(sub.token === "rrede" ? "" : sub.token)}
                    className="px-2 py-0.5 rounded text-[10px] bg-[#121924] hover:bg-[#182332] text-[#CBD5E1] border border-[#1E2B3C] flex items-center gap-1 cursor-pointer"
                  >
                    <span>{sub.icon}</span>
                    <span>{sub.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Lista de plantillas */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
              {loading && (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#94A3B8]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#38BDF8]" />
                  <span>Cargando catálogo oficial de Plantilla Fase1...</span>
                </div>
              )}

              {!loading && filteredTemplates.length === 0 && (
                <div className="py-12 text-center text-xs text-[#64748B]">
                  No se encontraron plantillas en la categoría &quot;{selectedCategory.label}&quot; con los filtros actuales.
                </div>
              )}

              {!loading &&
                filteredTemplates.map((tpl, idx) => {
                  const pageId = tpl.PageId || tpl.pageId;
                  const rawTitle = tpl.Title || tpl.title || "";
                  const isChecked = selectedIds.has(pageId);
                  const order = extractCalendarQuickTemplateOrder(rawTitle);
                  const cleanTitle = cleanCalendarQuickTemplateActivityTitle(
                    rawTitle,
                    selectedCategory.projectToken
                  );
                  const suggestedDomain = extractCalendarQuickTemplateDomain(rawTitle);

                  return (
                    <div
                      key={pageId || idx}
                      onClick={() => handleToggleSelect(pageId)}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 transition-colors cursor-pointer group ${
                        isChecked
                          ? "bg-[#0B1E2D] border-[#0284C7]/60 shadow-[0_0_10px_rgba(2,132,199,0.15)]"
                          : "bg-[#111722] hover:bg-[#151D2A] border-[#1C2736]"
                      }`}
                    >
                      {/* Izquierda: Checkbox + Orden + Títulos */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? "bg-[#0284C7] border-[#38BDF8] text-white"
                              : "bg-[#182230] border-[#33465C] group-hover:border-[#38BDF8]"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        {/* Badge de Orden */}
                        <div className="px-2 py-0.5 rounded-full font-mono font-bold text-[10px] bg-[#162536] text-[#38BDF8] border border-[#214360] shrink-0">
                          {order || String(idx + 1).padStart(2, "0")}
                        </div>

                        {/* Textos */}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-semibold text-[#F1F5F9] truncate group-hover:text-[#38BDF8]">
                            {cleanTitle}
                          </h4>
                          <p className="text-[10px] font-mono text-[#64748B] truncate mt-0.5">
                            {rawTitle}
                          </p>
                        </div>

                        {suggestedDomain && (
                          <span className="hidden md:inline text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[#132230] text-[#93C5FD] border border-[#1E3A52] shrink-0">
                            {suggestedDomain}
                          </span>
                        )}
                      </div>

                      {/* Derecha: Acciones rápidas */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {tpl.PageUrl || tpl.url ? (
                          <button
                            type="button"
                            onClick={() => openNotionPage(tpl.PageUrl || tpl.url)}
                            className="p-1 rounded text-[#64748B] hover:text-[#38BDF8] hover:bg-[#182332]"
                            title="Abrir plantilla original en Notion"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleStartConfig(tpl)}
                          className="px-2 py-1 rounded bg-[#132233] hover:bg-[#0284C7] text-[#38BDF8] hover:text-white border border-[#234262] text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Configurar y crear actividad desde esta plantilla"
                        >
                          <span>Crear esta</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Barra inferior de acciones (Paso 1) */}
            <div className="h-13 px-4 bg-[#0A0E15] border-t border-[#1E2836] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => openNotionPage(selectedCategory.sourceUrl || CALENDAR_TEMPLATE_HUB_URL)}
                className="text-xs text-[#38BDF8] hover:underline flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Abrir vista en Notion ({selectedCategory.label})</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded bg-[#131B26] hover:bg-[#192433] text-[#94A3B8] text-xs font-medium border border-[#223348] cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => handleStartConfig()}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-1.5 rounded bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <span>
                    {selectedIds.size === 0
                      ? "Selecciona plantillas"
                      : `Continuar con ${selectedIds.size} seleccionada${selectedIds.size === 1 ? "" : "s"}`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO: PASO 2 (Configuración e instanciación de actividades) */}
        {isConfigStep && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0B0F15]">
            {/* Cabecera del paso 2 */}
            <div className="p-3 bg-[#0E1520] border-b border-[#1E2836] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigStep(false)}
                  className="p-1 rounded bg-[#141C28] hover:bg-[#1A2536] text-[#38BDF8] border border-[#23354C] flex items-center gap-1 text-xs cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a lista</span>
                </button>
                <h4 className="text-xs font-bold text-[#F1F5F9]">
                  Crear proyecto desde Plantilla Fase1 · {selectedCategory.label}
                </h4>
              </div>

              <span className="text-xs font-mono font-bold text-[#38BDF8]">
                {selectedTemplatesList.length} actividad{selectedTemplatesList.length === 1 ? "" : "es"} a crear
              </span>
            </div>

            {/* Formulario y Previsualización */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {/* Notificación informativa estilo ANFETA */}
              <div className="p-3 rounded-lg bg-[#0B2538] border border-[#0284C7]/50 text-xs text-[#7DD3FC] flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">Duplicación exacta sin contenido (Paridad 1:1 ANFETA):</strong>
                  Se creará una nueva actividad en Notion heredando toda la estructura y propiedades de la plantilla seleccionada.
                  El <strong className="text-white">cuerpo/body</strong> de la página se creará limpio y vacío para que tú escribas tu contenido directamente.
                </div>
              </div>

              {/* Grid de campos: Dominio, Responsable, Revisor */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    <span>Responsable (opcional)</span>
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
                    <span>Revisor (opcional)</span>
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

              {/* Grid de Horario: Fecha, Hora Base, Duración, Secuencial */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg bg-[#0E1520] border border-[#1E293B]">
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
                    className="w-full bg-[#121A26] border border-[#22354A] rounded px-3 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#38BDF8] [color-scheme:dark]"
                  />
                </div>

                {/* Hora base */}
                <div>
                  <label className="text-[11px] font-semibold text-[#94A3B8] mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#38BDF8]" />
                    <span>Hora base de inicio</span>
                  </label>
                  <input
                    type="time"
                    value={configTime}
                    onChange={(e) => setConfigTime(e.target.value)}
                    className="w-full bg-[#121A26] border border-[#22354A] rounded px-3 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#38BDF8] [color-scheme:dark]"
                  />
                </div>

                {/* Duración */}
                <div>
                  <label className="text-[11px] font-semibold text-[#94A3B8] mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#F59E0B]" />
                    <span>Duración por actividad</span>
                  </label>
                  <select
                    value={configDuration}
                    onChange={(e) => setConfigDuration(Number(e.target.value))}
                    className="w-full bg-[#121A26] border border-[#22354A] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hora (60 min)</option>
                    <option value={90}>1 hora 30 min (90 min)</option>
                    <option value={120}>2 horas (120 min)</option>
                  </select>
                </div>
              </div>

              {/* Checkbox Secuencial */}
              {selectedTemplatesList.length > 1 && (
                <div className="flex items-center gap-2 px-1">
                  <input
                    type="checkbox"
                    id="chkSequential"
                    checked={configSequential}
                    onChange={(e) => setConfigSequential(e.target.checked)}
                    className="rounded bg-[#121A26] border-[#38BDF8] text-[#0284C7] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="chkSequential" className="text-xs text-[#CBD5E1] cursor-pointer">
                    Distribuir actividades secuencialmente una tras otra (desactivado: todas inician a la misma hora base)
                  </label>
                </div>
              )}

              {/* Vista previa en tiempo real de títulos generados */}
              <div>
                <label className="text-[11px] font-mono uppercase font-bold text-[#64748B] mb-1.5 block">
                  Vista previa de títulos generados ({previewGeneratedTitles.length} actividades):
                </label>
                <div className="p-3 rounded-lg bg-[#0A0E15] border border-[#1E2836] max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px] scrollbar-thin">
                  {previewGeneratedTitles.map((title, i) => (
                    <div
                      key={i}
                      className="p-1.5 rounded bg-[#111722] border border-[#192434] text-[#E2E8F0] break-all leading-tight"
                    >
                      <span className="text-[#38BDF8] font-bold mr-1.5">[{i + 1}]</span>
                      <span>{title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Barra inferior de acciones (Paso 2) */}
            <div className="h-13 px-4 bg-[#0A0E15] border-t border-[#1E2836] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsConfigStep(false)}
                className="px-3.5 py-1.5 rounded bg-[#131B26] hover:bg-[#192433] text-[#94A3B8] hover:text-white text-xs font-medium border border-[#223348] cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Modificar selección</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteCreation}
                disabled={isSubmitting || selectedTemplatesList.length === 0}
                className="px-5 py-1.5 rounded bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando actividades en Notion...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>
                      Crear {selectedTemplatesList.length} actividad
                      {selectedTemplatesList.length === 1 ? "" : "es"} en Calendario
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
