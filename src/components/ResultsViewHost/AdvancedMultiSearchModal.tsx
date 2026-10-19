"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Search, Zap, SlidersHorizontal, Plus, Trash2, Copy, Check } from "lucide-react";
import { SearchResultRow } from "@/types/anfeta";
import { matchesFlexibleOrQuotedQuery } from "@/services/advancedQuery";
import { highlightMultiSearch, MULTI_SEARCH_PALETTE } from "@/lib/multiSearchHighlight";

interface AdvancedMultiSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyQuery: (query: string) => void;
  currentQuery?: string;
  items: SearchResultRow[];
}

interface SearchTermBlock {
  id: string;
  term: string;
  operator: "AND" | "OR" | "NOT";
}

export function AdvancedMultiSearchModal({
  isOpen,
  onClose,
  onApplyQuery,
  currentQuery = "",
  items = [],
}: AdvancedMultiSearchModalProps) {
  // Parse terms from initial query or use default example
  const [term1, setTerm1] = useState("jjo00");
  const [operator, setOperator] = useState<"AND" | "OR" | "NOT">("AND");
  const [term2, setTerm2] = useState("jjo1");
  const [extraTerms, setExtraTerms] = useState<SearchTermBlock[]>([]);
  const [copied, setCopied] = useState(false);

  // Inicializar con la consulta actual si tiene formato de múltiples términos
  useEffect(() => {
    if (!isOpen) return;
    const q = currentQuery.trim();
    if (!q) {
      setTerm1("jjo00");
      setOperator("AND");
      setTerm2("jjo1");
      setExtraTerms([]);
      return;
    }

    const parts = q.split(/\s+(AND|OR|NOT|and|or|not)\s+/i);
    if (parts.length >= 3) {
      setTerm1(parts[0].trim());
      const op = parts[1].toUpperCase() as "AND" | "OR" | "NOT";
      setOperator(op === "AND" || op === "OR" || op === "NOT" ? op : "AND");
      setTerm2(parts[2].trim());

      const extras: SearchTermBlock[] = [];
      for (let i = 3; i < parts.length; i += 2) {
        if (parts[i + 1]) {
          const extraOp = parts[i].toUpperCase() as "AND" | "OR" | "NOT";
          extras.push({
            id: `extra_${i}`,
            operator: extraOp === "AND" || extraOp === "OR" || extraOp === "NOT" ? extraOp : "AND",
            term: parts[i + 1].trim(),
          });
        }
      }
      setExtraTerms(extras);
    } else {
      const words = q.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        setTerm1(words[0]);
        setOperator("AND");
        setTerm2(words[1]);
        if (words.length > 2) {
          setExtraTerms(
            words.slice(2).map((w, idx) => ({
              id: `extra_${idx}`,
              operator: "AND",
              term: w,
            }))
          );
        } else {
          setExtraTerms([]);
        }
      } else if (words.length === 1) {
        setTerm1(words[0]);
        setOperator("AND");
        setTerm2("");
        setExtraTerms([]);
      }
    }
  }, [isOpen, currentQuery]);

  // Consulta compuesta final
  const constructedQuery = useMemo(() => {
    let result = term1.trim();
    if (term2.trim()) {
      result = `${result} ${operator} ${term2.trim()}`;
    }
    extraTerms.forEach((ex) => {
      if (ex.term.trim()) {
        result = `${result} ${ex.operator} ${ex.term.trim()}`;
      }
    });
    return result.trim();
  }, [term1, operator, term2, extraTerms]);

  // Coincidencias en vivo en la base de datos de ANFETA
  const liveMatches = useMemo(() => {
    if (!constructedQuery) return [];
    return items.filter((it) => matchesFlexibleOrQuotedQuery(it, constructedQuery));
  }, [items, constructedQuery]);

  // Datos de prueba interactivos (según captura de referencia del usuario) si no hay resultados reales
  const isSampleFallback = liveMatches.length === 0 && constructedQuery.length > 0;
  const sampleItems = useMemo(() => {
    const t1 = term1.trim() || "jjo00";
    const t2 = term2.trim() || "jjo1";
    return [
      {
        id: "sample-1",
        title: `Actividad ${t1} con referencia ${t2}`,
        source: "Notion · Revisiones",
      },
      {
        id: "sample-2",
        title: `Seguimiento ${t1} vinculado a ${t2}`,
        source: "Notion · Revisiones",
      },
      {
        id: "sample-3",
        title: `Reporte semanal de avance ${t1} y validación ${t2}`,
        source: "Dropbox · Documentos",
      },
    ];
  }, [term1, term2]);

  if (!isOpen) return null;

  const handleAddTerm = () => {
    if (extraTerms.length >= 4) return;
    setExtraTerms((prev) => [
      ...prev,
      {
        id: `extra_${Date.now()}`,
        term: "",
        operator: "AND",
      },
    ]);
  };

  const handleRemoveExtraTerm = (id: string) => {
    setExtraTerms((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateExtraTerm = (id: string, updates: Partial<SearchTermBlock>) => {
    setExtraTerms((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleCopyQuery = () => {
    if (!constructedQuery) return;
    navigator.clipboard.writeText(constructedQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (!constructedQuery) return;
    onApplyQuery(constructedQuery);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Simulación de búsqueda avanzada"
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0c141e] border border-[#22354A] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] text-[#CBD5E1]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado con estética de la captura de referencia */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-gradient-to-r from-sky-950/40 to-transparent">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[#38BDF8] uppercase block">
              Ejemplo de funcionamiento
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              <SlidersHorizontal className="w-4 h-4 text-[#38BDF8]" />
              <span>Simulación de búsqueda avanzada</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#192433] transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Asistente */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 scrollbar-thin">
          {/* Bloque de configuración de términos */}
          <div className="space-y-3 p-4 rounded-xl bg-[#0F1722] border border-[#1E293B]">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Primer término */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] inline-block shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                  <span>Primer término</span>
                </label>
                <input
                  type="text"
                  value={term1}
                  onChange={(e) => setTerm1(e.target.value)}
                  placeholder="ej. jjo00"
                  className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-3 py-2 text-sm text-white placeholder-[#64748B] font-mono focus:outline-none focus:border-[#38BDF8] transition-colors"
                />
              </div>

              {/* Operador lógico */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Operador
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as "AND" | "OR" | "NOT")}
                  className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-3 py-2 text-sm text-[#38BDF8] font-bold focus:outline-none focus:border-[#38BDF8] transition-colors cursor-pointer"
                >
                  <option value="AND">AND (y)</option>
                  <option value="OR">OR (o)</option>
                  <option value="NOT">NOT (no)</option>
                </select>
              </div>

              {/* Segundo término */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F472B6] inline-block shadow-[0_0_8px_rgba(244,114,182,0.6)]" />
                  <span>Segundo término</span>
                </label>
                <input
                  type="text"
                  value={term2}
                  onChange={(e) => setTerm2(e.target.value)}
                  placeholder="ej. jjo1"
                  className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-3 py-2 text-sm text-white placeholder-[#64748B] font-mono focus:outline-none focus:border-[#F472B6] transition-colors"
                />
              </div>
            </div>

            {/* Términos adicionales si los hubiera */}
            {extraTerms.map((extra, idx) => {
              const palette = MULTI_SEARCH_PALETTE[(idx + 2) % MULTI_SEARCH_PALETTE.length];
              return (
                <div key={extra.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-2 border-t border-[#1A2332]">
                  <div className="sm:col-span-3 sm:col-start-6">
                    <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                      Operador
                    </label>
                    <select
                      value={extra.operator}
                      onChange={(e) => handleUpdateExtraTerm(extra.id, { operator: e.target.value as "AND" | "OR" | "NOT" })}
                      className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-3 py-1.5 text-xs text-[#38BDF8] font-bold focus:outline-none focus:border-[#38BDF8] transition-colors cursor-pointer"
                    >
                      <option value="AND">AND (y)</option>
                      <option value="OR">OR (o)</option>
                      <option value="NOT">NOT (no)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1 flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${palette.text.replace("text-", "bg-")} inline-block`} />
                      <span>Término #{idx + 3}</span>
                    </label>
                    <input
                      type="text"
                      value={extra.term}
                      onChange={(e) => handleUpdateExtraTerm(extra.id, { term: e.target.value })}
                      placeholder="ej. cliente"
                      className="w-full rounded-lg bg-[#111823] border border-[#1E2A3A] px-3 py-1.5 text-xs text-white placeholder-[#64748B] font-mono focus:outline-none focus:border-[#38BDF8] transition-colors"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => handleRemoveExtraTerm(extra.id)}
                      className="p-2 rounded-lg text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors cursor-pointer"
                      title="Eliminar este término"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {extraTerms.length < 4 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAddTerm}
                  className="text-xs font-semibold text-[#38BDF8] hover:text-white flex items-center gap-1 transition-colors cursor-pointer px-2 py-1 rounded bg-[#132235] hover:bg-[#1A314D] border border-[#23456C]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Añadir otro término</span>
                </button>
              </div>
            )}
          </div>

          {/* Consulta sintetizada */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#090D14] border border-[#1A2636] font-mono text-xs">
            <div className="flex items-center gap-2 overflow-hidden truncate">
              <span className="text-[#64748B] font-sans font-semibold shrink-0">Consulta generada:</span>
              <span className="text-white font-bold tracking-wide truncate">
                {constructedQuery || "—"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyQuery}
              className="shrink-0 p-1 rounded text-[#94A3B8] hover:text-[#38BDF8] transition-colors cursor-pointer"
              title="Copiar consulta"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Sección Resultados (paridad visual exacta con la captura) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Resultados</h3>
              <span className="text-xs text-[#94A3B8] font-mono font-semibold">
                {isSampleFallback
                  ? `${sampleItems.length} coincidencias (muestra interactiva)`
                  : `${liveMatches.length} coincidencias`}
              </span>
            </div>

            <div className="rounded-xl bg-[#090E16] border border-[#1A2534] p-3 space-y-2">
              {(isSampleFallback ? sampleItems : liveMatches.slice(0, 10)).map((row: any, i: number) => {
                const titleText = isSampleFallback ? row.title : (row.name || row.displayName || "Sin título");
                return (
                  <div
                    key={row.id || i}
                    className="p-2.5 rounded-lg bg-[#0E1521] border border-[#1E2E40] hover:border-[#38BDF8]/60 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="font-medium text-[#E2E8F0] break-words flex-1">
                      {highlightMultiSearch(titleText, constructedQuery)}
                    </div>
                    {row.source && (
                      <span className="text-[10px] text-[#64748B] font-mono shrink-0">
                        {row.source}
                      </span>
                    )}
                  </div>
                );
              })}

              {isSampleFallback && (
                <p className="text-[11px] text-[#64748B] italic pt-1 pl-1">
                  Ejemplo interactivo con datos de prueba.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-3 border-t border-[#1E2836] bg-[#0A1018]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#202E40] bg-[#121A24] hover:bg-[#182332] text-xs font-semibold text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!constructedQuery}
            className="px-5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white shadow-[0_0_12px_rgba(2,132,199,0.3)] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Aplicar al buscador</span>
          </button>
        </div>
      </div>
    </div>
  );
}
