'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { NotionCalendarActivity } from '@/types/anfeta';
import { normalizePerson } from '@/services/identityNormalizer';
import { isDirection, isReviewer } from '@/services/activityPermissions';
import {
  CALENDAR_QUICK_TEMPLATES,
  CalendarQuickTemplateDefinition,
  cleanCalendarQuickTemplateActivityTitle,
  extractCalendarQuickTemplateOrder,
  extractCalendarQuickTemplateDomain,
  filterTemplatesByCategory,
} from '@/lib/templateCatalog';
import {
  Zap,
  Search,
  Check,
  Clock,
  Sparkles,
  Layers,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const people = ['John', 'Neftali', 'Karla', 'Brian', 'Isaias', 'Andrade', 'Genaro', 'Sotelo', 'Acalli', 'Emmanuel'];

interface CreateActivityModalProps {
  currentUser: string;
  date: string;
  initialPerson?: string;
  initialStart?: string;
  initialEnd?: string;
  onOpenTemplates?: () => void;
  onClose: () => void;
  onCreated: (activity: NotionCalendarActivity) => void;
}

export function CreateActivityModal({
  currentUser,
  date,
  initialPerson,
  initialStart = '08:00',
  initialEnd = '09:00',
  onOpenTemplates,
  onClose,
  onCreated,
}: CreateActivityModalProps) {
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [person, setPerson] = useState(() => {
    if (initialPerson) return normalizePerson(initialPerson);
    return normalizePerson(currentUser);
  });
  const [day, setDay] = useState(date);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Selector de plantillas dentro del modal
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CalendarQuickTemplateDefinition>(
    CALENDAR_QUICK_TEMPLATES[0]
  );
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  // Carga diferida de plantillas al abrir el desplegable
  useEffect(() => {
    if (showTemplatePicker && templates.length === 0 && !loadingTemplates) {
      setLoadingTemplates(true);
      fetch('/api/data?type=templates')
        .then((res) => res.json())
        .then((data) => {
          if (data.items) setTemplates(data.items);
          setLoadingTemplates(false);
        })
        .catch(() => {
          setLoadingTemplates(false);
        });
    }
  }, [showTemplatePicker, templates.length, loadingTemplates]);

  // Plantillas filtradas
  const filteredTemplates = useMemo(() => {
    return filterTemplatesByCategory(templates, selectedCategory, templateSearch);
  }, [templates, selectedCategory, templateSearch]);

  const handleSelectTemplate = (tpl: any) => {
    setSelectedTemplate(tpl);
    const rawTitle = tpl.Title || tpl.title || '';
    const cleanTitle = cleanCalendarQuickTemplateActivityTitle(rawTitle, selectedCategory.projectToken);
    const order = extractCalendarQuickTemplateOrder(rawTitle);
    const extractedDomain = extractCalendarQuickTemplateDomain(rawTitle);

    const formattedTitle = order ? `${order} · ${cleanTitle}` : cleanTitle;
    setTitle(formattedTitle);

    if (extractedDomain && (!domain || domain === 'ejemplo.com')) {
      setDomain(extractedDomain);
    }

    if (selectedCategory.defaultDurationMinutes) {
      const parts = start.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const startTotal = parts[0] * 60 + parts[1];
        const endTotal = Math.min(22 * 60, startTotal + selectedCategory.defaultDurationMinutes);
        const eh = Math.floor(endTotal / 60);
        const em = endTotal % 60;
        setEnd(`${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`);
      }
    }

    setShowTemplatePicker(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xl flex flex-col max-h-[92vh] rounded-2xl border border-[#1E2E40] bg-[#0A0E15] text-[#CBD5E1] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header con botón para el asistente completo de plantillas */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E2836] bg-[#0E1520]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0284C7]/20 border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">+ Nueva Actividad</h2>
              <p className="text-[11px] text-[#64748B]">Crea en blanco o rellena rápido desde plantilla</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenTemplates && (
              <button
                type="button"
                onClick={onOpenTemplates}
                className="px-2.5 py-1 rounded-md bg-[#132235] hover:bg-[#1A314D] border border-[#23456C] text-[#38BDF8] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abrir el asistente completo de plantillas secuenciales y masivas (WPF Parity)"
              >
                <Zap className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span className="hidden sm:inline">Catálogo Completo</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-1 rounded-md text-[#94A3B8] hover:text-white hover:bg-[#192433] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Formulario */}
        <form
          className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            setSaving(true);
            setError('');
            try {
              const response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'create-activity',
                  payload: {
                    title,
                    domain,
                    person,
                    currentUser,
                    start: `${day}T${start}:00-06:00`,
                    end: `${day}T${end}:00-06:00`,
                  },
                }),
              });
              const data = await response.json();
              if (!response.ok || !data.success) {
                throw new Error(data.error || 'No se pudo crear la actividad');
              }
              onCreated(data.activity);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Error de conexión');
            } finally {
              setSaving(false);
            }
          }}
        >
          {/* Barra rápida de Selección de Plantilla */}
          <div className="rounded-xl border border-[#1E2E42] bg-[#0E1624] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#7DD3FC] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span>¿Usar una plantilla predefinida?</span>
              </span>
              <button
                type="button"
                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                className="text-xs text-[#38BDF8] hover:text-[#7DD3FC] font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>{showTemplatePicker ? 'Ocultar catálogo' : '⚡ Elegir plantilla'}</span>
                {showTemplatePicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Dropdown / Panel de selección interactivo */}
            {showTemplatePicker && (
              <div className="mt-2 pt-2 border-t border-[#1C2838] space-y-2 animate-in fade-in duration-150">
                {/* Categorías */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {CALENDAR_QUICK_TEMPLATES.map((cat) => {
                    const isActive = selectedCategory.key === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#0284C7] text-white'
                            : 'bg-[#141C28] text-[#94A3B8] hover:text-white border border-[#202E40]'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Buscador de plantillas */}
                <div className="flex items-center gap-2 bg-[#121A26] border border-[#22354A] rounded px-2.5 py-1">
                  <Search className="w-3 h-3 text-[#64748B]" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder={`Buscar en ${selectedCategory.label}...`}
                    className="bg-transparent text-xs text-white placeholder-[#64748B] focus:outline-none flex-1"
                  />
                  {templateSearch && (
                    <button type="button" onClick={() => setTemplateSearch('')} className="text-[#64748B] hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Lista desplazable de plantillas */}
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {loadingTemplates ? (
                    <div className="py-4 text-center text-xs text-[#64748B]">Cargando plantillas de Notion...</div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[#64748B]">No se encontraron plantillas en esta sección.</div>
                  ) : (
                    filteredTemplates.map((tpl, i) => {
                      const rawT = tpl.Title || tpl.title || '';
                      const ord = extractCalendarQuickTemplateOrder(rawT);
                      const cln = cleanCalendarQuickTemplateActivityTitle(rawT, selectedCategory.projectToken);
                      return (
                        <div
                          key={tpl.PageId || tpl.pageId || i}
                          onClick={() => handleSelectTemplate(tpl)}
                          className="px-2 py-1.5 rounded-md bg-[#131B26] hover:bg-[#1A283A] border border-[#1E2B3C] hover:border-[#38BDF8]/60 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {ord ? (
                              <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-[#1B293C] text-[#38BDF8] border border-[#243B52] shrink-0">
                                {ord}
                              </span>
                            ) : null}
                            <span className="text-xs text-[#E2E8F0] group-hover:text-[#38BDF8] truncate font-medium">
                              {cln}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#38BDF8] opacity-0 group-hover:opacity-100 font-semibold shrink-0">
                            Aplicar ↵
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {selectedTemplate && (
              <div className="text-[11px] text-[#38BDF8] flex items-center gap-1.5 pt-1">
                <Check className="w-3 h-3 text-[#38BDF8]" />
                <span>Plantilla activa: {selectedTemplate.Title || selectedTemplate.title}</span>
              </div>
            )}
          </div>

          {/* Campo Título */}
          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
              Título de la Actividad *
            </label>
            <input
              required
              autoFocus
              maxLength={1800}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. 1.00 · Revisión general de dominio"
              className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-3 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8] transition-colors"
            />
          </div>

          {/* Campos Dominio y Responsable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Dominio / Proyecto *
              </label>
              <input
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="ejemplo.com"
                className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-3 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Responsable
              </label>
              <select
                disabled={!isDirection(currentUser) && !isReviewer(currentUser)}
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#38BDF8] transition-colors cursor-pointer disabled:opacity-60"
              >
                {people.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Horario: Fecha, Inicio, Fin */}
          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Programación de Horario</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                aria-label="Fecha"
                required
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#38BDF8] [color-scheme:dark]"
              />
              <input
                aria-label="Inicio"
                required
                type="time"
                min="08:00"
                max="21:45"
                step={900}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#38BDF8] [color-scheme:dark]"
              />
              <input
                aria-label="Fin"
                required
                type="time"
                min="08:15"
                max="22:00"
                step={900}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#38BDF8] [color-scheme:dark]"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E2836]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-[#202E40] bg-[#121A24] hover:bg-[#182332] text-xs font-semibold text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !domain.trim()}
              className="px-5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white shadow-[0_0_12px_rgba(2,132,199,0.3)] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{saving ? 'Guardando en Notion…' : 'Crear en Notion'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
