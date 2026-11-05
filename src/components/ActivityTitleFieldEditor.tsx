"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Check, X, Globe, Calendar, Tag, AlertCircle, Loader2, Sparkles, User, Trash2 } from 'lucide-react';

export interface ParsedActivityTitle {
  status: string;
  month: string;
  code: string;
  domain: string;
  name: string;
  tags: string;
  statusPosition?: 'start' | 'before_blocks';
}

export const COLLABORATOR_TAGS: Record<
  string,
  { label: string; active: string; templateRegex: RegExp; activeRegex: RegExp }
> = {
  Neftali: { label: 'Neftali', active: 'nne11', templateRegex: /#?nn-e\d{2}\b/gi, activeRegex: /#?nne\d{2}\b/gi },
  Edwin: { label: 'Edwin', active: 'eed11', templateRegex: /#?ee-d\d{2}\b/gi, activeRegex: /#?eed\d{2}\b/gi },
  John: { label: 'John', active: 'jjo11', templateRegex: /#?jj-o\d{2}\b/gi, activeRegex: /#?jjo\d{2}\b/gi },
  Karla: { label: 'Karla', active: 'kka11', templateRegex: /#?kk-a\d{2}\b/gi, activeRegex: /#?kka\d{2}\b/gi },
  Genaro: { label: 'Genaro', active: 'gge11', templateRegex: /#?gg-e\d{2}\b/gi, activeRegex: /#?gge\d{2}\b/gi },
  Andrade: { label: 'Andrade', active: 'aan11', templateRegex: /#?aa-n\d{2}\b/gi, activeRegex: /#?aan\d{2}\b/gi },
  Isai: { label: 'Isai', active: 'iis11', templateRegex: /#?ii-s\d{2}\b/gi, activeRegex: /#?iis\d{2}\b/gi },
  Brian: { label: 'Brian', active: 'bbr11', templateRegex: /#?bb-r\d{2}\b/gi, activeRegex: /#?bbr\d{2}\b/gi },
};

export function parseActivityTitleParts(rawTitle: string): ParsedActivityTitle {
  const title = (rawTitle || '').trim();
  let remaining = title;

  // 1. Detect Status Token ANYWHERE in the string
  let status = '';
  let statusPosition: 'start' | 'before_blocks' = 'start';
  const statusMatch = remaining.match(
    /(?<![\w@.\/-])(?:(saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)([rRsS]?)|(sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION|zCOBRAR|zPAGAR|eed11|ed11|nne11|bbria))(?![\w@.\/-])/i
  );

  if (statusMatch) {
    status = statusMatch[0];
    const matchIndex = statusMatch.index || 0;
    if (remaining.includes('|') && matchIndex > 0) {
      statusPosition = 'before_blocks';
    } else {
      statusPosition = 'start';
    }
    remaining = (remaining.slice(0, matchIndex) + ' ' + remaining.slice(matchIndex + status.length)).trim();
  }

  // 2. Extract Code / Phase / Order
  let code = '';
  const codeMatch = remaining.match(/(?<![a-z0-9])(\d{1,2}\.[a-z0-9.]+|ffase\d+|fase\d+|0\d\.\d{2})(?![a-z0-9])/i);
  if (codeMatch) {
    code = codeMatch[1];
    remaining = remaining.replace(codeMatch[0], ' ').trim();
  }

  // 3. Extract Month (legacy format, code prefix, or standalone 2-digit number)
  let month = '';
  const legacyMonthMatch = remaining.match(/(?:\d{2}-)?\[?(\d{2})[A-ZÁÉÍÓÚ]{3,4}\]?/i);
  const numMonthMatch = remaining.match(/(?<![a-z0-9.])(0[1-9]|1[0-2])(?![a-z0-9.])/);

  if (legacyMonthMatch) {
    month = legacyMonthMatch[1];
    remaining = remaining.replace(legacyMonthMatch[0], ' ').trim();
  } else if (numMonthMatch) {
    month = numMonthMatch[1];
    remaining = remaining.replace(numMonthMatch[0], ' ').trim();
  } else if (code && /^\d{2}\./.test(code)) {
    month = code.slice(0, 2);
  }

  // 4. Extract Domain
  let domain = '';
  const domainMatch = remaining.match(
    /\b([pd]\.[a-z0-9.-]+|(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|vip|app|edu|gob|co|ai|dev|info|biz|us|es|online|site))\b/i
  );
  if (domainMatch) {
    domain = domainMatch[1];
    remaining = remaining.replace(domainMatch[0], ' ').trim();
  }

  // 5. Extract Tags / Suffixes
  let tags = '';
  const tagMatches = remaining.match(
    /(?:#[a-z0-9_\-]+|\b(?:jjohn|nneft|nnetf|kkarl|bbria|iisai|aandr|ggena|ssote|aacal|eemma|eedwin|edwin)(?:\d+)?\b)/gi
  );
  if (tagMatches) {
    tags = tagMatches.join(' ');
    for (const tm of tagMatches) {
      remaining = remaining.replace(tm, ' ');
    }
  }

  // 6. Name is the remaining content (including pipe blocks)
  let name = remaining.replace(/\s+/g, ' ').replace(/^[\s·|—–-]+|[\s·|—–-]+$/g, '').trim();
  if (remaining.trim().startsWith('|')) {
    name = remaining.trim();
  }
  if (!name) name = title;

  return { status, month, code, domain, name, tags, statusPosition };
}

export function assembleActivityTitle(parts: ParsedActivityTitle): string {
  const list: string[] = [];
  const hasMonthInCode = parts.code && /^\d{2}\./.test(parts.code);
  const codeMonth = hasMonthInCode ? parts.code.slice(0, 2) : '';

  let effectiveCode = parts.code?.trim() || '';
  if (hasMonthInCode && parts.month && parts.month !== codeMonth) {
    effectiveCode = parts.month + effectiveCode.slice(2);
  }

  if (parts.statusPosition === 'before_blocks') {
    if (!hasMonthInCode && parts.month?.trim()) list.push(parts.month.trim());
    if (effectiveCode) list.push(effectiveCode);
    if (parts.domain?.trim()) list.push(parts.domain.trim());
    if (parts.status?.trim()) list.push(parts.status.trim());
    if (parts.name?.trim()) list.push(parts.name.trim());
    if (parts.tags?.trim()) list.push(parts.tags.trim());
  } else {
    if (parts.status?.trim()) list.push(parts.status.trim());
    if (!hasMonthInCode && parts.month?.trim()) list.push(parts.month.trim());
    if (effectiveCode) list.push(effectiveCode);
    if (parts.domain?.trim()) list.push(parts.domain.trim());
    if (parts.name?.trim()) list.push(parts.name.trim());
    if (parts.tags?.trim()) list.push(parts.tags.trim());
  }

  return list.join(' ');
}

const COMMON_STATUS_PRESETS = [
  'tuzR',
  'rtuzR',
  'sprtuz',
  'aaprtuzS',
  'nne11',
  'ed11',
  'zCOBRAR',
  'zPAGAR',
];

const MONTH_PRESETS = ['11', '12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

const KNOWN_DOMAINS = [
  'p.anfeta.com',
  'p.agape',
  'p.aldalupe',
  'p.davela.mx',
  'anfeta.com',
  'novakid.com',
  'clinicaalfa.mx',
  'cqvpersa.mx',
  'fromm-pack.com.mx',
  'recorcholis.com.mx',
  'weblab.mx',
  'apantallante.com',
  'lcacalderas.com',
  'solucionesviales.mx',
  'cumbreseguros.com',
];

interface Props {
  pageId: string;
  initialTitle: string;
  compact?: boolean;
  onSaveSuccess?: (newTitle: string) => void;
  onCancel?: () => void;
}

export function ActivityTitleFieldEditor({
  pageId,
  initialTitle,
  compact = false,
  onSaveSuccess,
  onCancel,
}: Props) {
  const [parts, setParts] = useState<ParsedActivityTitle>(() => parseActivityTitleParts(initialTitle));
  const [domainSuggestions, setDomainSuggestions] = useState<string[]>([]);
  const [showDomainDropdown, setShowDomainDropdown] = useState(false);
  const [autoCleanInactiveTags, setAutoCleanInactiveTags] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const domainWrapperRef = useRef<HTMLDivElement>(null);

  // Cached domains from localStorage
  const allDomains = useMemo(() => {
    let extra: string[] = [];
    try {
      const stored = localStorage.getItem('anfeta_cached_domains');
      if (stored) extra = JSON.parse(stored);
    } catch {}
    return Array.from(new Set([...KNOWN_DOMAINS, ...extra]));
  }, []);

  // Filter domain suggestions as user types
  useEffect(() => {
    const query = parts.domain.trim().toLowerCase();
    if (!query) {
      setDomainSuggestions(allDomains.slice(0, 8));
    } else {
      const filtered = allDomains.filter(d => d.toLowerCase().includes(query));
      setDomainSuggestions(filtered.slice(0, 8));
    }
  }, [parts.domain, allDomains]);

  // Close domain dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (domainWrapperRef.current && !domainWrapperRef.current.contains(e.target as Node)) {
        setShowDomainDropdown(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, []);

  const reconstructed = useMemo(() => assembleActivityTitle(parts), [parts]);

  const handleMonthChange = (newMonth: string) => {
    setParts(prev => {
      let nextCode = prev.code;
      if (nextCode && /^\d{2}\./.test(nextCode)) {
        nextCode = newMonth + nextCode.slice(2);
      }
      return { ...prev, month: newMonth, code: nextCode };
    });
  };

  const handleSelectCollaborator = (personKey: string) => {
    const entry = COLLABORATOR_TAGS[personKey];
    if (!entry) return;

    setParts(prev => {
      let currentTags = prev.tags || '';

      // 1. If person has template placeholder tag (#nn-e11), replace it with active tag (nne11)
      if (entry.templateRegex.test(currentTags)) {
        currentTags = currentTags.replace(entry.templateRegex, entry.active);
      } else if (!entry.activeRegex.test(currentTags)) {
        currentTags = (currentTags + ' ' + entry.active).trim();
      }

      // 2. If autoClean is active, remove template tags and other active tags of others
      if (autoCleanInactiveTags) {
        for (const [key, other] of Object.entries(COLLABORATOR_TAGS)) {
          if (key !== personKey) {
            currentTags = currentTags.replace(other.templateRegex, '');
            currentTags = currentTags.replace(other.activeRegex, '');
          }
        }
      }

      return {
        ...prev,
        tags: currentTags.replace(/\s+/g, ' ').trim(),
      };
    });
  };

  const handleCleanInactiveTags = () => {
    setParts(prev => {
      let currentTags = prev.tags || '';
      // Find who is active if any
      let activeKey: string | null = null;
      for (const [key, entry] of Object.entries(COLLABORATOR_TAGS)) {
        if (entry.activeRegex.test(currentTags)) {
          activeKey = key;
          break;
        }
      }

      // Remove all template placeholder tags of everybody except active person
      for (const [key, other] of Object.entries(COLLABORATOR_TAGS)) {
        if (key !== activeKey) {
          currentTags = currentTags.replace(other.templateRegex, '');
        }
      }

      return {
        ...prev,
        tags: currentTags.replace(/\s+/g, ' ').trim(),
      };
    });
  };

  const handleSave = async () => {
    if (!reconstructed.trim()) {
      setError('El título no puede quedar vacío.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename-item',
          payload: {
            id: pageId,
            source: 'Notion',
            oldName: initialTitle,
            newName: reconstructed,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar el nuevo nombre en Notion.');
      }

      // Remember new domain if entered
      if (parts.domain.trim()) {
        try {
          const stored = localStorage.getItem('anfeta_cached_domains');
          const list = stored ? JSON.parse(stored) : [];
          if (!list.includes(parts.domain.trim())) {
            list.unshift(parts.domain.trim());
            localStorage.setItem('anfeta_cached_domains', JSON.stringify(list.slice(0, 30)));
          }
        } catch {}
      }

      // Broadcast update events across all open components and tables
      try {
        window.dispatchEvent(
          new CustomEvent('anfeta_item_renamed', {
            detail: { id: pageId, newName: reconstructed },
          })
        );
        window.dispatchEvent(
          new CustomEvent('anfeta_page_content_changed', {
            detail: { pageId: pageId.replace(/-/g, '') },
          })
        );
        window.dispatchEvent(new CustomEvent('anfeta_review_saved'));
        window.dispatchEvent(new CustomEvent('anfeta_calendar_refresh'));
        window.dispatchEvent(new CustomEvent('anfeta_data_refreshed'));
      } catch {}

      setSavedSuccess(true);
      setTimeout(() => {
        onSaveSuccess?.(reconstructed);
      }, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-purple-500/50 bg-[#120B22] p-5 sm:p-6 text-slate-200 shadow-2xl select-text ${
        compact ? 'text-xs' : 'text-sm'
      }`}
      onClick={e => e.stopPropagation()}
    >
      <header className="mb-4 flex items-center justify-between border-b border-purple-800/60 pb-3">
        <h4 className="flex items-center gap-2 font-bold text-base text-purple-200">
          <Sparkles className="h-5 w-5 text-purple-400" />
          Renombrar actividad por campos (Ficha)
        </h4>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-purple-900/40 hover:text-white transition-colors"
            title="Cancelar edición"
          >
            <X size={18} />
          </button>
        )}
      </header>

      {error && (
        <div className="mb-3.5 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/60 p-2.5 text-xs text-rose-200">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="mb-3.5 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/60 p-2.5 text-xs text-emerald-200">
          <Check size={15} className="shrink-0" />
          <span>¡Título actualizado en Notion con éxito!</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Renglón 1: Prefijo / Estatus */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-purple-300">
            <span>1. Prefijo / Estatus</span>
            <span className="text-[11px] font-normal text-slate-400">Selecciona chip o escribe libre</span>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {COMMON_STATUS_PRESETS.map(preset => (
              <button
                type="button"
                key={preset}
                disabled={saving}
                onClick={() => setParts(prev => ({ ...prev, status: preset }))}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono transition-colors ${
                  parts.status.toLowerCase() === preset.toLowerCase()
                    ? 'border border-cyan-400 bg-cyan-900/60 text-cyan-100 font-bold shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                    : 'border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-purple-900/40'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="text"
            disabled={saving}
            value={parts.status}
            onChange={e => setParts(prev => ({ ...prev, status: e.target.value }))}
            placeholder="ej. tuzR, rtuzR, aaprtuzS, ed11..."
            className="w-full rounded-lg border border-purple-800/60 bg-slate-950 px-3 py-2 font-mono text-xs text-cyan-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Renglón 2: Mes */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-purple-300">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              2. Mes (chips rápidos)
            </span>
            <span className="text-[11px] font-normal text-slate-400">Mes actual: {parts.month || '(sin mes)'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MONTH_PRESETS.map(m => (
              <button
                type="button"
                key={m}
                disabled={saving}
                onClick={() => handleMonthChange(m)}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono transition-colors ${
                  parts.month === m
                    ? 'border border-amber-400 bg-amber-900/60 text-amber-100 font-bold shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-purple-900/40'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Renglón 3: Código / Fase / Orden */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-purple-300">
            3. Código / Fase / Orden
          </label>
          <input
            type="text"
            disabled={saving}
            value={parts.code}
            onChange={e => setParts(prev => ({ ...prev, code: e.target.value }))}
            placeholder="ej. 11.r.01.00, ffase37, 01.00..."
            className="w-full rounded-lg border border-purple-800/60 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Renglón 4: Dominio con Predictivo */}
        <div ref={domainWrapperRef} className="relative">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-purple-300">
            <Globe size={14} />
            4. Dominio (predictivo en tiempo real)
          </label>
          <input
            type="text"
            disabled={saving}
            value={parts.domain}
            onFocus={() => setShowDomainDropdown(true)}
            onChange={e => {
              setParts(prev => ({ ...prev, domain: e.target.value }));
              setShowDomainDropdown(true);
            }}
            placeholder="ej. p.anfeta.com, p.agape, novakid.com..."
            className="w-full rounded-lg border border-purple-800/60 bg-slate-950 px-3 py-2 font-mono text-xs text-amber-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          {showDomainDropdown && domainSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-y-auto rounded-xl border border-purple-700 bg-[#0E071A] p-1.5 shadow-2xl">
              {domainSuggestions.map(d => (
                <button
                  type="button"
                  key={d}
                  onClick={() => {
                    setParts(prev => ({ ...prev, domain: d }));
                    setShowDomainDropdown(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-mono text-xs text-slate-300 hover:bg-purple-900/60 hover:text-cyan-200 transition-colors"
                >
                  <span>{d}</span>
                  <span className="text-[10px] text-purple-400">Seleccionar</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Renglón 5: Nombre limpio / Descripción (con slots de emojis preservados) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-purple-300">
            <span>5. Nombre / Descripción de la actividad</span>
            <span className="text-[11px] font-normal text-slate-400">Slots de emojis conservados</span>
          </div>
          <textarea
            rows={2}
            disabled={saving}
            value={parts.name}
            onChange={e => setParts(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Descripción de la actividad o bloques de plantilla..."
            className="w-full rounded-lg border border-purple-800/60 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Renglón 6: Tags y Responsable (activa tag y limpia inactivos) */}
        <div className="rounded-xl border border-purple-800/70 bg-[#160B2B]/70 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-200">
              <Tag size={13} className="text-purple-400" />
              6. Tags y Responsable
            </span>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCleanInactiveTags}
                  onChange={e => setAutoCleanInactiveTags(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 accent-cyan-500"
                />
                <span>Limpiar otros automáticamente</span>
              </label>

              <button
                type="button"
                onClick={handleCleanInactiveTags}
                disabled={saving}
                className="flex items-center gap-1 rounded bg-purple-900/70 border border-purple-600/60 px-2 py-0.5 text-[11px] font-medium text-purple-200 hover:bg-purple-800 transition-colors"
                title="Quita los tags de plantilla (#aa-n11, #ee-d11, etc.) de integrantes no asignados"
              >
                <Trash2 size={11} />
                <span>🧹 Limpiar tags inactivos</span>
              </button>
            </div>
          </div>

          {/* Chips de Integrantes para transformar a tag activo */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-0.5">Asignar tag activo:</span>
            {Object.entries(COLLABORATOR_TAGS).map(([key, col]) => {
              const isActive = col.activeRegex.test(parts.tags);
              const hasTemplate = col.templateRegex.test(parts.tags);
              return (
                <button
                  type="button"
                  key={key}
                  disabled={saving}
                  onClick={() => handleSelectCollaborator(key)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-mono transition-colors ${
                    isActive
                      ? 'border border-emerald-400 bg-emerald-950/80 text-emerald-200 font-bold shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                      : hasTemplate
                      ? 'border border-purple-700/80 bg-purple-950/50 text-purple-300 hover:bg-purple-900/70'
                      : 'border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800'
                  }`}
                  title={
                    isActive
                      ? `Tag ${col.active} está activo`
                      : hasTemplate
                      ? `Transformar plantilla #${key} a tag activo ${col.active}`
                      : `Agregar tag ${col.active}`
                  }
                >
                  <User size={11} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
                  <span>{col.label}</span>
                  <span className={`text-[10px] ${isActive ? 'text-emerald-300' : 'text-slate-500'}`}>
                    ({col.active})
                  </span>
                </button>
              );
            })}
          </div>

          <input
            type="text"
            disabled={saving}
            value={parts.tags}
            onChange={e => setParts(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="ej. #descripcion #ffase00 nne11..."
            className="w-full rounded-lg border border-purple-800/60 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Vista previa en vivo del título reconstruido */}
        <div className="rounded-xl border border-purple-700/60 bg-[#1e1338] p-3.5 shadow-inner">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-purple-300">
            Vista previa del título resultante:
          </div>
          <div className="break-all font-mono text-xs text-cyan-200 selection:bg-cyan-900 leading-relaxed">
            {reconstructed || <span className="text-slate-500 italic">Título vacío</span>}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          {onCancel && (
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={saving || !reconstructed.trim() || savedSuccess}
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition-colors disabled:opacity-50 shadow-md"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Guardando en Notion…</span>
              </>
            ) : savedSuccess ? (
              <>
                <Check size={14} />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Guardar en Notion</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
