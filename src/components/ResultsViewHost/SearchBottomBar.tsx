"use client";

import {MeetQuickLinks} from './MeetQuickLinks';
import React, { useState, useRef, useEffect } from "react";
import { Info, MoreHorizontal, ExternalLink, FolderOpen, Copy, Trash2, Upload, Clipboard } from "lucide-react";

interface SearchBottomBarProps {
  currentPage: number;
  pageSize: number;
  onChangePageSize: (size: number) => void;
  statusText: string;
  selectedItem: any | null;
  selectedCount?: number;
  onOpenItem: (item: any) => void;
  onOpenLocation: (item: any) => void;
  onCopyName: (item: any) => void;
  onCopyContent: (item: any) => void;
  onDeleteSelected?: () => void;
  onOpenUploadDropbox?: () => void;
  onOpenGlobalPaste?: () => void;
  textScale?: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];

export function SearchBottomBar({
  currentPage,
  pageSize,
  onChangePageSize,
  statusText,
  selectedItem,
  selectedCount = 0,
  onOpenItem,
  onOpenLocation,
  onCopyName,
  onCopyContent,
  onDeleteSelected,
  onOpenUploadDropbox,
  onOpenGlobalPaste,
  textScale = "100%",
}: SearchBottomBarProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      style={{
        minHeight: `${Math.round(36 * scale)}px`,
        fontSize: `${(11 * scale).toFixed(1)}px`,
      }}
      className="bg-[#11161D] border-t border-[#1E2836] px-3 flex items-center justify-between select-none transition-all"
    >
      {/* Izquierda: (i) Página 1  Tamaño ▾ */}
      <div style={{ gap: `${Math.round(8 * scale)}px` }} className="flex items-center">
        <div
          style={{ width: `${Math.round(16 * scale)}px`, height: `${Math.round(16 * scale)}px`, fontSize: `${(9.5 * scale).toFixed(1)}px` }}
          className="rounded-full bg-[#162235] border border-[#253549] flex items-center justify-center font-bold text-[#38BDF8]"
        >
          i
        </div>
        <span style={{ fontSize: `${(10.5 * scale).toFixed(1)}px` }} className="text-[#94A3B8]">Página</span>
        <span style={{ fontSize: `${(10.5 * scale).toFixed(1)}px` }} className="font-semibold text-[#F1F5F9] mr-2">
          {currentPage}
        </span>

        <span style={{ fontSize: `${(10.5 * scale).toFixed(1)}px` }} className="text-[#94A3B8]">Tamaño</span>
        <select
          value={pageSize}
          onChange={(e) => onChangePageSize(Number(e.target.value))}
          style={{
            fontSize: `${(10.5 * scale).toFixed(1)}px`,
            padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
            minHeight: `${Math.round(24 * scale)}px`,
          }}
          className="bg-[#141B26] text-[#F1F5F9] border border-[#26354A] rounded focus:outline-none cursor-pointer"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {/* Centro: StatusText y Contador */}
      <div
        style={{ fontSize: `${(10 * scale).toFixed(1)}px`, gap: `${Math.round(8 * scale)}px` }}
        className="flex-1 text-center truncate px-4 text-[#64748B] flex items-center justify-center"
      >
        <span>{statusText}</span>
        {selectedCount > 0 && (
          <span
            style={{ fontSize: `${(9.5 * scale).toFixed(1)}px` }}
            className="text-[#38BDF8] font-semibold bg-[#0C4A6E]/50 px-2 py-0.5 rounded border border-[#38BDF8]/40"
          >
            {selectedCount} seleccionada{selectedCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Derecha: Borrar seleccionados | Abrir | Ubicación | Copiar | ⋯ */}
      <div style={{ gap: `${Math.round(6 * scale)}px` }} className="flex items-center">
        <MeetQuickLinks />
        {selectedCount > 0 && onDeleteSelected && (
          <button
            type="button"
            onClick={onDeleteSelected}
            style={{
              fontSize: `${(10.5 * scale).toFixed(1)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
              gap: `${Math.round(4 * scale)}px`,
            }}
            className="flex items-center rounded bg-[#EF4444]/20 border border-[#EF4444]/40 hover:bg-[#EF4444]/30 text-[#FCA5A5] font-semibold transition-colors mr-1 cursor-pointer"
            title={`Borrar ${selectedCount} páginas seleccionadas`}
          >
            <Trash2 style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }} />
            <span>Borrar ({selectedCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => selectedItem && onOpenItem(selectedItem)}
          disabled={!selectedItem}
          className="flex items-center gap-1 px-3 py-1 rounded bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 text-white font-semibold text-[10.5px] transition-colors"
          title="Abrir página directamente en Notion"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Abrir</span>
        </button>

        <button
          type="button"
          onClick={() => selectedItem && onOpenLocation(selectedItem)}
          disabled={!selectedItem}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#161F2C] border border-[#26354A] hover:bg-[#1E2836] text-[#CBD5E1] disabled:opacity-40 text-[10.5px] transition-colors"
          title="Abrir ubicación o URL"
        >
          <FolderOpen className="w-3 h-3" />
          <span>Ubicación</span>
        </button>

        <button
          type="button"
          onClick={() => selectedItem && onCopyName(selectedItem)}
          disabled={!selectedItem}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#161F2C] border border-[#26354A] hover:bg-[#1E2836] text-[#CBD5E1] disabled:opacity-40 text-[10.5px] transition-colors"
          title="Copiar texto / título al portapapeles"
        >
          <Copy className="w-3 h-3" />
          <span>Copiar</span>
        </button>

        {/* Botón ⋯ Más opciones */}
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            disabled={!selectedItem}
            className="p-1 rounded bg-[#161F2C] border border-[#26354A] hover:bg-[#1E2836] text-[#CBD5E1] disabled:opacity-40 text-[10.5px] transition-colors"
            title="Más opciones"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMoreMenu && (
            <div className="absolute right-0 bottom-8 z-50 w-44 bg-[#111822] border border-[#253549] rounded-lg shadow-2xl p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  if (selectedItem) onOpenItem(selectedItem);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[10.5px]"
              >
                Información de página
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  if (selectedItem) onCopyName(selectedItem);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[10.5px]"
              >
                Copiar nombre
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  if (selectedItem) onCopyContent(selectedItem);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[10.5px]"
              >
                Copiar contenido
              </button>
              <div className="h-px bg-[#26354A] my-1" />
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenUploadDropbox?.();
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-[#1E2836] text-[#38BDF8] text-[10.5px] flex items-center gap-1.5"
              >
                <Upload className="w-3 h-3" />
                <span>Subir a Dropbox...</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  if (onOpenGlobalPaste) onOpenGlobalPaste();
                  else onOpenUploadDropbox?.();
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-[#1E2836] text-[#93C5FD] text-[10.5px] flex items-center gap-1.5"
              >
                <Clipboard className="w-3 h-3" />
                <span>Pegar captura (Ctrl+V)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
