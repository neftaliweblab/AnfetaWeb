"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Check, X, Globe, Calendar, Tag, AlertCircle, Loader2, Sparkles } from 'lucide-react';

export interface ParsedActivityTitle {
  status: string;
  month: string;
  code: string;
  domain: string;
  name: string;
  tags: string;
}

export function parseActivityTitleParts(rawTitle: string): ParsedActivityTitle {
  const title = (rawTitle || '').trim();
  let remaining = title;

  // 1. Extract status / prefix
  let status = '';
  const statusMatch = remaining.match(/^(?:\[([^\]]+)\]\s*)?(sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION|sprtuz|aprtuz|prtuz|rtuz|tuzR|rtuzR|zCOBRAR|zPAGAR|eed11|ed11|nne11|bbria)\b/i);
  if (statusMatch) {
    status = statusMatch[1] || statusMatch[0];
    remaining = remaining.replace(statusMatch[0], '').trim();
  }

  // 2. Extract Code / Phase / Order first (to prevent sub-parts being treated as isolated months)
  let code = '';
  const codeMatch = remaining.match(/(?<![a-z0-9])(\d{1,2}\.[a-z0-9.]+|ffase\d+|fase\d+|0\d\.\d{2})(?![a-z0-9])/i);
  if (codeMatch) {
    code = codeMatch[1];
    remaining = remaining.replace(codeMatch[0], '').trim();
  }

  // 3. Extract Month (from legacy tag, standalone 2-digit number, or extracted from code if missing)
  let month = '';
  const legacyMonthMatch = remaining.match(/(?:\d{2}-)?\[?(\d{2})[A-ZÁÉÍÓÚ]{3,4}\]?/i);
  if (legacyMonthMatch) {
    month = legacyMonthMatch[1];
    remaining = remaining.replace(legacyMonthMatch[0], '').trim();
  } else {
    const numMonthMatch = remaining.match(/(?<![a-z0-9.])(0[1-9]|1[0-2])(?![a-z0-9.])/);
    if (numMonthMatch) {
      month = numMonthMatch[1];
      remaining = remaining.replace(numMonthMatch[0], '').trim();
    } else if (code && /^\d{2}\./.test(code)) {
      month = code.slice(0, 2);
    }
  }

  // 4. Extract Domain
  let domain = '';
  const domainMatch = remaining.match(/\b([pd]\.[a-z0-9.-]+|(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|vip|app|edu|gob|co|ai|dev|info|biz|us|es|online|site))\b/i);
  if (domainMatch) {
    domain = domainMatch[1];
    remaining = remaining.replace(domainMatch[0], '').trim();
  }

  // 5. Extract Tags / Suffixes
  let tags = '';
  const tagMatches = remaining.match(/(?:#[a-z0-9_\-]+|\b(?:jjohn|nneft|nnetf|kkarl|bbria|iisai|aandr|ggena|ssote|aacal|eemma|eedwin|edwin)(?:\d+)?\b)/gi);
  if (tagMatches) {
    tags = tagMatches.join(' ');
    for (const tm of tagMatches) {
      remaining = remaining.replace(tm, '');
    }
  }

  // 6. Whatever is left is the Name / Description
  let name = remaining.replace(/\s+/g, ' ').replace(/^[\s·|—–-]+|[\s·|—–-]+$/g, '').trim();
  if (!name) name = title;

  return { status, month, code, domain, name, tags };
}

export function assembleActivityTitle(parts: ParsedActivityTitle): string {
  const list: string[] = [];
  if (parts.status?.trim()) list.push(parts.status.trim());
  if (parts.month?.trim()) list.push(parts.month.trim());
  if (parts.code?.trim()) list.push(parts.code.trim());
  if (parts.domain?.trim()) list.push(parts.domain.trim());
  if (parts.name?.trim()) list.push(parts.name.trim());
  if (parts.tags?.trim()) list.push(parts.tags.trim());
  return list.join(' ');
}

const COMMON_STATUS_PRESETS = [
  'tuzR',
  'rtuzR',
  'sprtuz',
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

      // Notify application of change
      try {
        window.dispatchEvent(
          new CustomEvent('anfeta_page_content_changed', {
            detail: { pageId: pageId.replace(/-/g, '') },
          })
        );
        window.dispatchEvent(new CustomEvent('anfeta_review_saved'));
        window.dispatchEvent(new CustomEvent('anfeta_calendar_refresh'));
      } catch {}

      setSavedSuccess(true);
      setTimeout(() => {
        onSaveSuccess?.(reconstructed);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-purple-500/50 bg-[#120B22] p-4 text-slate-200 shadow-xl select-text ${
        compact ? 'text-xs' : 'text-sm'
      }`}
      onClick={e => e.stopPropagation()}
    >
      <header className="mb-3 flex items-center justify-between border-b border-purple-800/60 pb-2">
        <h4 className="flex items-center gap-1.5 font-semibold text-purple-200">
          <Sparkles className="h-4 w-4 text-purple-400" />
          Renombrar actividad por campos (Ficha)
        </h4>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded p-1 text-slate-400 hover:bg-purple-900/40 hover:text-white"
            title="Cancelar edición"
          >
            <X size={15} />
          </button>
        )}
      </header>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/60 p-2 text-xs text-rose-200">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/60 p-2 text-xs text-emerald-200">
          <Check size={14} className="shrink-0" />
          <span>¡Título actualizado en Notion con éxito!</span>
        </div>
      )}

      <div className="space-y-3">
        {/* Renglón 1: Prefijo / Estatus */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-purple-300">
            <span>1. Prefijo / Estatus</span>
            <span className="text-[10px] text-slate-400">Selecciona o escribe</span>
          </div>
          <div className="mb-1.5 flex flex-wrap gap-1">
            {COMMON_STATUS_PRESETS.map(preset => (
              <button
                type="button"
                key={preset}
                disabled={saving}
                onClick={() => setParts(prev => ({ ...prev, status: preset }))}
                className={`rounded px-2 py-0.5 text-[11px] font-mono transition-colors ${
                  parts.status.toLowerCase() === preset.toLowerCase()
                    ? 'border border-cyan-400 bg-cyan-900/60 text-cyan-100 font-bold'
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
            placeholder="ej. tuzR, rtuzR, ed11..."
            className="w-full rounded border border-purple-800/60 bg-slate-950 px-2.5 py-1 font-mono text-xs text-cyan-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Renglón 2: Mes */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-purple-300">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              2. Mes (chips rápidos)
            </span>
            <span className="text-[10px] text-slate-400">Actual: {parts.month || '(sin mes)'}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {MONTH_PRESETS.map(m => (
              <button
                type="button"
                key={m}
                disabled={saving}
                onClick={() => setParts(prev => ({ ...prev, month: m }))}
                className={`rounded px-2 py-0.5 text-[11px] font-mono transition-colors ${
                  parts.month === m
                    ? 'border border-amber-400 bg-amber-900/60 text-amber-100 font-bold'
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
          <label className="mb-1 block text-[11px] font-medium text-purple-300">
            3. Código / Fase / Orden
          </label>
          <input
            type="text"
            disabled={saving}
            value={parts.code}
            onChange={e => setParts(prev => ({ ...prev, code: e.target.value }))}
            placeholder="ej. 11.a.01.00, ffase37, 01.00..."
            className="w-full rounded border border-purple-800/60 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Renglón 4: Dominio con Predictivo */}
        <div ref={domainWrapperRef} className="relative">
          <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-purple-300">
            <Globe size={12} />
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
            className="w-full rounded border border-purple-800/60 bg-slate-950 px-2.5 py-1 font-mono text-xs text-amber-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          {showDomainDropdown && domainSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-purple-700 bg-[#0E071A] p-1 shadow-2xl">
              {domainSuggestions.map(d => (
                <button
                  type="button"
                  key={d}
                  onClick={() => {
                    setParts(prev => ({ ...prev, domain: d }));
                    setShowDomainDropdown(false);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left font-mono text-xs text-slate-300 hover:bg-purple-900/60 hover:text-cyan-200"
                >
                  <span>{d}</span>
                  <span className="text-[10px] text-purple-400">Seleccionar</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Renglón 5: Nombre limpio / Descripción */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-purple-300">
            5. Nombre / Descripción de la actividad
          </label>
          <textarea
            rows={2}
            disabled={saving}
            value={parts.name}
            onChange={e => setParts(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Descripción clara de la actividad..."
            className="w-full rounded border border-purple-800/60 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Renglón 6: Tags / Sufijos */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-purple-300">
            <Tag size={12} />
            6. Tags complementarios / Sufijo (opcional)
          </label>
          <input
            type="text"
            disabled={saving}
            value={parts.tags}
            onChange={e => setParts(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="ej. #webs, #diseño, neft0000..."
            className="w-full rounded border border-purple-800/60 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-300 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Vista previa en vivo del título reconstruido */}
        <div className="rounded-lg border border-purple-700/50 bg-[#1e1338] p-2.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-purple-300">
            Vista previa del título resultante:
          </div>
          <div className="break-all font-mono text-xs text-cyan-200 selection:bg-cyan-900">
            {reconstructed || <span className="text-slate-500 italic">Título vacío</span>}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2 pt-1">
          {onCancel && (
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={saving || !reconstructed.trim() || savedSuccess}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Guardando en Notion…</span>
              </>
            ) : savedSuccess ? (
              <>
                <Check size={13} />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Check size={13} />
                <span>Guardar en Notion</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
