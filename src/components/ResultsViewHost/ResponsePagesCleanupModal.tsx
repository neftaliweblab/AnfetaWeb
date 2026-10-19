"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, RefreshCw, Trash2, CheckSquare, Square, AlertTriangle, ExternalLink, Loader2, Sparkles, Filter, CheckCircle2 } from "lucide-react";
import { ResponseScanItem } from "@/services/reviewNotifications";

interface ResponsePagesCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: (deletedIds: string[]) => void;
  localItems?: any[];
}

export function ResponsePagesCleanupModal({
  isOpen,
  onClose,
  onDeleted,
  localItems = [],
}: ResponsePagesCleanupModalProps) {
  const [items, setItems] = useState<ResponseScanItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTab, setFilterTab] = useState<"all" | "expired" | "recent" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const fetchScan = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      let clientToken = "";
      if (typeof window !== "undefined") {
        try {
          const s = localStorage.getItem("anfeta_settings");
          if (s) clientToken = JSON.parse(s).notionToken || "";
        } catch {}
      }

      const res = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "x-notion-token": clientToken } : {}),
        },
        body: JSON.stringify({
          action: "scan-response-pages",
          payload: {
            items: localItems.slice(0, 1000),
            token: clientToken,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Error en escaneo (${res.status})`);
      }

      const data = await res.json();
      const scannedList: ResponseScanItem[] = Array.isArray(data.items) ? data.items : [];
      setItems(scannedList);

      // Pre-seleccionar automáticamente las páginas que cumplen la regla de expiración (>24h finalizadas)
      const defaultSelected = new Set<string>();
      for (const it of scannedList) {
        if (it.isExpired) {
          defaultSelected.add(it.id);
        }
      }
      setSelectedIds(defaultSelected);

      if (scannedList.length === 0) {
        setFeedback({
          type: "info",
          message: "No se encontraron páginas con estructura [RESPUESTA]. Tu espacio está limpio.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: `Error al escanear: ${err.message || "Fallo de conexión"}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScan();
    } else {
      setFeedback(null);
      setSearchQuery("");
    }
  }, [isOpen]);

  // Contadores
  const counts = useMemo(() => {
    let expired = 0;
    let recent = 0;
    let pending = 0;
    for (const it of items) {
      if (it.isPending) pending++;
      else if (it.isExpired) expired++;
      else recent++;
    }
    return { all: items.length, expired, recent, pending };
  }, [items]);

  // Filtrado de la lista
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Filtro por pestaña
      if (filterTab === "expired" && !it.isExpired) return false;
      if (filterTab === "recent" && (!it.isFinalized || it.isExpired || it.isPending)) return false;
      if (filterTab === "pending" && !it.isPending) return false;

      // Filtro por búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const full = (it.name + " " + it.statusName + " " + (it.recipient || "") + " " + (it.sender || "")).toLowerCase();
        if (!full.includes(q)) return false;
      }

      return true;
    });
  }, [items, filterTab, searchQuery]);

  // Manejo de selecciones
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectRecommended = () => {
    const next = new Set<string>();
    for (const it of items) {
      if (it.isExpired) next.add(it.id);
    }
    setSelectedIds(next);
  };

  const handleSelectAllFinalized = () => {
    const next = new Set<string>();
    for (const it of items) {
      if (it.isFinalized && !it.isPending) next.add(it.id);
    }
    setSelectedIds(next);
  };

  const handleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const it of filteredItems) next.add(it.id);
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Identificar si hay items pendientes seleccionados
  const selectedPendingCount = useMemo(() => {
    let count = 0;
    for (const id of selectedIds) {
      const found = items.find((it) => it.id === id);
      if (found?.isPending) count++;
    }
    return count;
  }, [selectedIds, items]);

  // Eliminación confirmada
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    if (selectedPendingCount > 0) {
      const proceed = window.confirm(
        `⚠️ ATENCIÓN: Has marcado ${selectedPendingCount} página(s) que aún están EN REVISIÓN o PENDIENTES.\n\n¿Estás seguro de que deseas archivarlas de todos modos?`
      );
      if (!proceed) return;
    } else {
      const proceed = window.confirm(
        `¿Deseas archivar permanentemente en Notion ${selectedIds.size} página(s) de [RESPUESTA] seleccionada(s)?`
      );
      if (!proceed) return;
    }

    setIsDeleting(true);
    setFeedback(null);

    const targetList = items.filter((it) => selectedIds.has(it.id));
    try {
      let clientToken = "";
      if (typeof window !== "undefined") {
        try {
          const s = localStorage.getItem("anfeta_settings");
          if (s) clientToken = JSON.parse(s).notionToken || "";
        } catch {}
      }

      const res = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "x-notion-token": clientToken } : {}),
        },
        body: JSON.stringify({
          action: "delete-items",
          payload: {
            items: targetList.map((it) => ({
              id: it.id,
              name: it.name,
              source: "Revisiones",
              sourceName: "Revisiones",
              token: clientToken,
            })),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo completar la eliminación en Notion.");
      }

      const deletedIdsArray = Array.from(selectedIds);
      // Actualizar estado local del modal
      setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)));
      setSelectedIds(new Set());
      setFeedback({
        type: "success",
        message: `✅ Se eliminaron ${data.count || deletedIdsArray.length} página(s) exitosamente en Notion.`,
      });

      // Notificar a ResultsViewHost
      onDeleted?.(deletedIdsArray);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: `❌ Error al eliminar en Notion: ${err.message || "Fallo inesperado"}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#0B0F15] border border-[#253549] rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#F1F5F9]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E2836] bg-[#0E1520]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Limpieza y Escaneo de Páginas [RESPUESTA]
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/50">
                  Notion Revisiones
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Escanea páginas de avisos generadas durante revisiones. Selecciona cuáles borrar y conserva las que prefieras.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchScan}
              disabled={isLoading || isDeleting}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-[#26354A] bg-[#141B26] hover:bg-[#1E2836] text-[#CBD5E1] transition-colors disabled:opacity-50 cursor-pointer"
              title="Volver a escanear Notion y caché local"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
              <span>{isLoading ? "Escaneando..." : "Re-escanear"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[#94A3B8] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra de Filtros por Estado */}
        <div className="px-5 py-2.5 border-b border-[#1A2332] bg-[#0A0D12] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                filterTab === "all"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-[#141B26] text-[#94A3B8] hover:bg-[#1A2433] hover:text-white"
              }`}
            >
              Todas ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("expired")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                filterTab === "expired"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/50"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Recomendadas &gt;24h ({counts.expired})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("recent")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                filterTab === "recent"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-amber-950/40 text-amber-400 border border-amber-800/40 hover:bg-amber-900/50"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>Finalizadas recientes ({counts.recent})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("pending")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                filterTab === "pending"
                  ? "bg-rose-700 text-white shadow-sm"
                  : "bg-rose-950/40 text-rose-400 border border-rose-800/40 hover:bg-rose-900/50"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              <span>Pendientes ({counts.pending})</span>
            </button>
          </div>

          {/* Campo de búsqueda rápida */}
          <div className="relative min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en resultados..."
              className="w-full bg-[#141B26] border border-[#253549] rounded px-2.5 py-1 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1.5 text-xs text-[#94A3B8] hover:text-white"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Barra de Acciones de Selección Rápida */}
        <div className="px-5 py-2 border-b border-[#1A2332] bg-[#0E131A] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-[#94A3B8]">
            <span className="font-medium text-white">Selección:</span>
            <button
              type="button"
              onClick={handleSelectRecommended}
              className="text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
            >
              Recomendadas (&gt;24h)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={handleSelectAllFinalized}
              className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
            >
              Todas las aprobadas
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="text-sky-400 hover:text-sky-300 underline cursor-pointer"
            >
              Marcar visibles ({filteredItems.length})
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-[#94A3B8] hover:text-white underline cursor-pointer"
            >
              Deseleccionar todo
            </button>
          </div>

          <div className="text-xs font-semibold">
            <span className={selectedIds.size > 0 ? "text-indigo-300" : "text-[#64748B]"}>
              {selectedIds.size} de {items.length} seleccionada{selectedIds.size === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Mensaje de feedback si existe */}
        {feedback && (
          <div
            className={`px-5 py-2 text-xs flex items-center justify-between ${
              feedback.type === "success"
                ? "bg-emerald-950/60 text-emerald-300 border-b border-emerald-800/40"
                : feedback.type === "error"
                ? "bg-rose-950/60 text-rose-300 border-b border-rose-800/40"
                : "bg-blue-950/60 text-blue-300 border-b border-blue-800/40"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Lista de Resultados con Previsualización */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#090D13]">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#94A3B8] space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
              <p className="text-xs">Escaneando base de datos Notion y caché local...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-[#64748B] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto" />
              <p className="text-sm font-medium text-[#94A3B8]">
                {items.length === 0
                  ? "No se encontraron páginas de notificación [RESPUESTA]."
                  : "No hay páginas que coincidan con el filtro actual."}
              </p>
              <p className="text-xs text-[#64748B]">
                {items.length === 0
                  ? "Tu espacio de Notion está completamente optimizado."
                  : "Prueba seleccionando otra pestaña o limpiando el texto de búsqueda."}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isChecked = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleSelect(item.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    isChecked
                      ? "bg-[#141B28] border-indigo-500/60 shadow-[0_0_12px_rgba(99,102,241,0.12)]"
                      : "bg-[#0E141D] border-[#1C2635] hover:border-[#2C3D55] hover:bg-[#121A25]"
                  }`}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelect(item.id)}
                      className="w-4 h-4 rounded bg-[#1A2332] border-[#2E3C4E] text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Contenido principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {/* Badge de Estado */}
                      {item.isExpired ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Recomendada borrar (&gt;24h)</span>
                        </span>
                      ) : item.isPending ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-950/80 border border-rose-600/60 text-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>Pendiente de revisión</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/60 text-amber-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          <span>Finalizada reciente ({item.ageHours}h)</span>
                        </span>
                      )}

                      {/* Tag de Respuesta */}
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950 border border-purple-600/40 text-purple-300">
                        [RESPUESTA]
                      </span>

                      {/* Persona remitente / destinatario si existe */}
                      {item.recipient && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1A2230] text-[#93C5FD]">
                          @{item.recipient}
                        </span>
                      )}
                      {item.sender && (
                        <span className="text-[10px] text-[#94A3B8]">
                          de: <strong className="text-white">{item.sender}</strong>
                        </span>
                      )}

                      {/* Fecha y Antigüedad */}
                      <span className="text-[10px] text-[#64748B] ml-auto">
                        {item.dateFormatted} ({item.ageHours}h atrás)
                      </span>
                    </div>

                    {/* Nombre completo de la página */}
                    <p className="text-xs font-medium text-[#E2E8F0] break-words line-clamp-2 leading-relaxed">
                      {item.name}
                    </p>

                    {/* Estado propiedad */}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#94A3B8]">
                      <span>
                        Estado: <strong className="text-[#CBD5E1]">{item.statusName}</strong>
                      </span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline text-[10.5px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Ver en Notion</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Advertencia si hay pendientes seleccionados */}
        {selectedPendingCount > 0 && (
          <div className="px-5 py-2 bg-amber-950/70 border-t border-amber-800/60 text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Atención:</strong> Has marcado <strong>{selectedPendingCount}</strong> página(s) que aún están pendientes de revisión. Al borrarlas se archivará el aviso antes de que sea resuelto.
            </span>
          </div>
        )}

        {/* Pie de página con Botones de Acción */}
        <div className="px-5 py-3 border-t border-[#1E2836] bg-[#0E1520] flex items-center justify-between">
          <div className="text-xs text-[#94A3B8]">
            {items.length > 0 && (
              <span>
                Mostrando <strong className="text-white">{filteredItems.length}</strong> de{" "}
                <strong className="text-white">{items.length}</strong> páginas encontradas
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-3 py-1.5 rounded-lg border border-[#2E3C4E] hover:bg-[#1A2433] text-[#CBD5E1] text-xs font-medium transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || isDeleting}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg transition-all cursor-pointer ${
                selectedIds.size === 0 || isDeleting
                  ? "bg-rose-950/40 border border-rose-900/40 text-rose-400/50 cursor-not-allowed"
                  : selectedPendingCount > 0
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
              }`}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Archivando en Notion...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    Archivar seleccionadas ({selectedIds.size})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
