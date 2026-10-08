"use client";

import React, { useState } from "react";
import { X, Edit3, Loader2 } from "lucide-react";

interface BatchRenameModalProps {
  isOpen: boolean;
  selectedItems: any[];
  onClose: () => void;
  onConfirm: (renames: Array<{ item: any; newName: string }>) => Promise<void>;
}

export function BatchRenameModal({
  isOpen,
  selectedItems,
  onClose,
  onConfirm,
}: BatchRenameModalProps) {
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const computeNewName = (originalName: string) => {
    let name = originalName || "";
    if (findText) {
      name = name.split(findText).join(replaceText);
    }
    if (prefix) {
      name = `${prefix.trim()} ${name}`.trim();
    }
    if (suffix) {
      name = `${name} ${suffix.trim()}`.trim();
    }
    return name;
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0 || busy) return;

    const list = selectedItems.map((item) => ({
      item,
      newName: computeNewName(item.name),
    }));

    setBusy(true);
    try {
      await onConfirm(list);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 select-none"
    >
      <form
        onSubmit={handleApply}
        className="w-full max-w-xl bg-[#0F141C] border border-[#26354A] rounded-xl shadow-2xl p-4 space-y-3 text-slate-200"
      >
        <header className="flex items-center justify-between border-b border-[#1E2836] pb-2">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#38BDF8]" />
            <h3 className="text-sm font-bold text-white">
              Renombrado Inteligente Masivo ({selectedItems.length} seleccionados)
            </h3>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="text-[#64748B]">Agregar Prefijo:</span>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Ej. [FINAL]"
              className="w-full rounded bg-[#16202C] border border-[#26354A] p-2 text-white text-xs focus:outline-none focus:border-[#38BDF8]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[#64748B]">Agregar Sufijo:</span>
            <input
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="Ej. - Aprobado"
              className="w-full rounded bg-[#16202C] border border-[#26354A] p-2 text-white text-xs focus:outline-none focus:border-[#38BDF8]"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="text-[#64748B]">Buscar texto:</span>
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Texto a buscar"
              className="w-full rounded bg-[#16202C] border border-[#26354A] p-2 text-white text-xs focus:outline-none focus:border-[#38BDF8]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[#64748B]">Reemplazar con:</span>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Texto de reemplazo"
              className="w-full rounded bg-[#16202C] border border-[#26354A] p-2 text-white text-xs focus:outline-none focus:border-[#38BDF8]"
            />
          </label>
        </div>

        {/* Vista previa de cambios */}
        <div className="space-y-1 pt-1">
          <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">
            Vista previa (primeros {Math.min(3, selectedItems.length)}):
          </span>
          <div className="max-h-28 overflow-y-auto space-y-1 bg-[#090D13] p-2 rounded border border-[#1E2836] text-[11px] font-mono">
            {selectedItems.slice(0, 3).map((it, idx) => (
              <div key={idx} className="truncate">
                <span className="text-slate-500 line-through mr-1">{it.name}</span>
                <span className="text-[#38BDF8]">→ {computeNewName(it.name)}</span>
              </div>
            ))}
          </div>
        </div>

        <footer className="flex justify-end gap-2 pt-2 border-t border-[#1E2836]">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || (!prefix && !suffix && !findText)}
            className="flex items-center gap-1.5 rounded bg-sky-800 hover:bg-sky-700 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{busy ? "Renombrando..." : "Aplicar renombrado masivo"}</span>
          </button>
        </footer>
      </form>
    </div>
  );
}
