"use client";

import React, { useState, useEffect } from "react";
import { X, Edit2, Copy, FolderPlus } from "lucide-react";

// Modal para Renombrar
interface RenameModalProps {
  isOpen: boolean;
  item: any | null;
  onClose: () => void;
  onConfirm: (item: any, newName: string) => void;
}

export function RenameModal({ isOpen, item, onClose, onConfirm }: RenameModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (item) {
      setName(item.name || "");
    }
  }, [item]);

  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-[480px] bg-[#0F151C] border border-[#2A526B] rounded-xl shadow-2xl p-5 space-y-4 text-[#F1F5F9]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1E2836] pb-3">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-[#A78BFA]" />
            <h3 className="font-bold text-sm">Renombrar elemento</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#1E2836] text-[#94A3B8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[#94A3B8] font-medium block">
            Nuevo nombre para {item.source === "Notion" ? "la página en Notion" : "el archivo"}:
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onConfirm(item, name.trim());
                onClose();
              }
            }}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-[#0A0E17] border border-[#2E3C4E] focus:border-[#38BDF8] text-white text-xs outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1E2836]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] text-xs font-medium cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              if (name.trim()) {
                onConfirm(item, name.trim());
                onClose();
              }
            }}
            className="px-4 py-1.5 rounded-lg bg-[#0C4A6E] hover:bg-[#0284C7] border border-[#38BDF8] text-[#38BDF8] hover:text-white text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors"
          >
            Renombrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal para Duplicar
interface DuplicateModalProps {
  isOpen: boolean;
  item: any | null;
  onClose: () => void;
  onConfirm: (item: any, newTitle: string) => void;
}

export function DuplicateModal({ isOpen, item, onClose, onConfirm }: DuplicateModalProps) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (item) {
      setTitle(`${item.name || ""} (Copia)`);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-[480px] bg-[#0F151C] border border-[#2A526B] rounded-xl shadow-2xl p-5 space-y-4 text-[#F1F5F9]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1E2836] pb-3">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-[#818CF8]" />
            <h3 className="font-bold text-sm">Duplicar elemento</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#1E2836] text-[#94A3B8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[#94A3B8] font-medium block">
            Título para el nuevo duplicado:
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) {
                onConfirm(item, title.trim());
                onClose();
              }
            }}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-[#0A0E17] border border-[#2E3C4E] focus:border-[#38BDF8] text-white text-xs outline-none"
          />
          <p className="text-[11px] text-[#64748B] pt-1">
            Conservará las mismas propiedades editables (asignación, Fecha POR Hacer, estado, etc.). El contenido/body e instrucciones de la página quedarán limpios para que ingreses tu propio contenido.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1E2836]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] text-xs font-medium cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!title.trim()}
            onClick={() => {
              if (title.trim()) {
                onConfirm(item, title.trim());
                onClose();
              }
            }}
            className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] hover:bg-[#0284C7] border border-[#38BDF8] text-[#38BDF8] hover:text-white text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors"
          >
            Duplicar ahora
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal para Crear Carpeta en Dropbox
interface CreateFolderModalProps {
  isOpen: boolean;
  targetDir?: string;
  onClose: () => void;
  onConfirm: (folderName: string, targetDir: string) => void;
}

export function CreateFolderModal({ isOpen, targetDir = "C:\\Users\\nanoc\\Dropbox\\DRX", onClose, onConfirm }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState("");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-[460px] bg-[#0F151C] border border-[#2A526B] rounded-xl shadow-2xl p-5 space-y-4 text-[#F1F5F9]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1E2836] pb-3">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[#00C8FF]" />
            <h3 className="font-bold text-sm">Crear nueva carpeta en Dropbox</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#1E2836] text-[#94A3B8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-[#64748B] block font-mono truncate">
            Ubicación: {targetDir}
          </span>
          <label className="text-xs text-[#94A3B8] font-medium block pt-1">
            Nombre de la carpeta:
          </label>
          <input
            type="text"
            placeholder="Ej. Documentos Cliente"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && folderName.trim()) {
                onConfirm(folderName.trim(), targetDir);
                onClose();
              }
            }}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-[#0A0E17] border border-[#2E3C4E] focus:border-[#38BDF8] text-white text-xs outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1E2836]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] text-xs font-medium cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!folderName.trim()}
            onClick={() => {
              if (folderName.trim()) {
                onConfirm(folderName.trim(), targetDir);
                onClose();
              }
            }}
            className="px-4 py-1.5 rounded-lg bg-[#0C4A6E] hover:bg-[#0284C7] border border-[#38BDF8] text-[#38BDF8] hover:text-white text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors"
          >
            Crear carpeta
          </button>
        </div>
      </div>
    </div>
  );
}
