"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Folder,
  Upload,
  Clipboard,
  Check,
  X,
  Plus,
  FileText,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { playCheckChime, playCopyChime, sendWindowsNotification } from "@/services/windowsIntegration";

interface DropboxFolder {
  name: string;
  path: string;
}

interface DropboxUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetDir?: string;
  onUploadSuccess: (newItem: any) => void;
}

export function DropboxUploadModal({
  isOpen,
  onClose,
  defaultTargetDir = "",
  onUploadSuccess,
}: DropboxUploadModalProps) {
  const [targetDir, setTargetDir] = useState(defaultTargetDir);
  const [folders, setFolders] = useState<DropboxFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFilename, setCustomFilename] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingFolders(true);
      fetch("/api/data?type=dropbox-folders")
        .then((res) => res.json())
        .then((data) => {
          if (data.folders) setFolders(data.folders);
          if (!targetDir && data.drxPath) {
            setTargetDir(defaultTargetDir || data.drxPath);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingFolders(false));
    }
  }, [isOpen, defaultTargetDir]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setCustomFilename(file.name);
      setStatusMsg(null);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const ext = type.split("/")[1] || "png";
            const filename = `Captura_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${ext}`;
            const file = new File([blob], filename, { type });
            setSelectedFile(file);
            setCustomFilename(filename);
            playCopyChime();
            setStatusMsg({ ok: true, text: `Imagen leída del portapapeles (${filename})` });
            return;
          }
        }
      }
      setStatusMsg({ ok: false, text: "No se encontró ninguna imagen en el portapapeles." });
    } catch {
      setStatusMsg({ ok: false, text: "Permiso de portapapeles no concedido o vacío." });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatusMsg({ ok: false, text: "Selecciona o pega un archivo para subir." });
      return;
    }

    setIsUploading(true);
    setStatusMsg(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const filename = customFilename.trim() || selectedFile.name;

        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload-to-dropbox",
            payload: {
              targetDir,
              filename,
              base64,
            },
          }),
        });

        const data = await res.json();
        setIsUploading(false);

        if (res.ok && data.success) {
          playCheckChime();
          sendWindowsNotification("Dropbox ANFETA", `Archivo guardado: ${filename}`);
          setStatusMsg({ ok: true, text: `✓ Archivo guardado con éxito en Dropbox: ${filename}` });
          onUploadSuccess({
            id: `dropbox-${Date.now()}`,
            name: filename,
            target: data.path,
            path: data.path,
            source: "Dropbox",
            sourceName: "Dropbox",
            sizeBytes: data.sizeBytes,
            serverModified: data.modifiedDate?.slice(0, 10),
            isFolder: false,
          });
          setTimeout(() => {
            onClose();
          }, 1200);
        } else {
          setStatusMsg({ ok: false, text: data.error || "Error al subir a Dropbox" });
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (err: any) {
      setIsUploading(false);
      setStatusMsg({ ok: false, text: err.message || "Error procesando archivo" });
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-dropbox-folder",
          payload: {
            targetDir,
            folderName: newFolderName.trim(),
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        playCheckChime();
        setTargetDir(data.path);
        setIsCreatingFolder(false);
        setNewFolderName("");
        setStatusMsg({ ok: true, text: `✓ Carpeta creada: ${data.folderName}` });
        // Recargar carpetas
        const refreshed = await fetch("/api/data?type=dropbox-folders").then((r) => r.json());
        if (refreshed.folders) setFolders(refreshed.folders);
      }
    } catch {
      setStatusMsg({ ok: false, text: "Error creando carpeta" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111822] border border-[#253549] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-[#16202C] border-b border-[#253549] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#0284C7]/20 border border-[#0284C7]/40 flex items-center justify-center text-[#38BDF8]">
              <Upload className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#F1F5F9]">Subir a Dropbox (Flujo ANFETA)</h3>
              <p className="text-[10px] text-[#64748B]">Soporta arrastrar, examinar o pegar con Ctrl+V</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#CBD5E1] p-1 rounded hover:bg-[#1E2836]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 text-xs">
          {/* Carpeta Destino */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-semibold text-[#CBD5E1] flex items-center gap-1.5">
                <Folder className="w-3 h-3 text-[#38BDF8]" />
                Carpeta Destino en Dropbox:
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                className="text-[10px] text-[#38BDF8] hover:underline flex items-center gap-0.5"
              >
                <Plus className="w-2.5 h-2.5" /> Nueva carpeta
              </button>
            </div>

            {isCreatingFolder && (
              <div className="flex items-center gap-1.5 mb-1.5 p-1.5 rounded bg-[#162232] border border-[#253B52]">
                <input
                  type="text"
                  placeholder="Nombre de la nueva carpeta (.carpeta)"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 bg-[#101722] border border-[#26354A] rounded px-2 py-1 text-[11px] text-[#F1F5F9] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="px-2.5 py-1 rounded bg-[#0284C7] hover:bg-[#0369A1] text-white font-semibold text-[10.5px]"
                >
                  Crear
                </button>
              </div>
            )}

            <select
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              className="w-full bg-[#141B26] border border-[#26354A] rounded p-1.5 text-[11px] text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
            >
              {targetDir && !folders.some((f) => f.path === targetDir) && (
                <option value={targetDir}>{targetDir}</option>
              )}
              {folders.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
            </select>
            <p className="text-[9.5px] text-[#64748B] mt-0.5 font-mono truncate">{targetDir}</p>
          </div>

          {/* Zona Drag & Drop o Pegar */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#253549] hover:border-[#38BDF8] rounded-xl p-5 text-center cursor-pointer transition-colors bg-[#0D131C] hover:bg-[#121A26]"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981]">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="font-semibold text-[11.5px] text-[#F1F5F9]">{selectedFile.name}</span>
                <span className="text-[10px] text-[#64748B]">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Haz clic para cambiar
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-[#162235] border border-[#253549] flex items-center justify-center text-[#38BDF8]">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="font-medium text-[#CBD5E1] text-[11.5px]">
                  Haz clic para examinar archivos o arrástralos aquí
                </span>
                <span className="text-[10px] text-[#64748B]">
                  PDF, imágenes PNG/JPG, XLSX, DOCX, ZIP
                </span>
              </div>
            )}
          </div>

          {/* Botón rápido Pegar Portapapeles (Ctrl+V) */}
          <div className="flex items-center justify-between p-2 rounded bg-[#141B26] border border-[#253549]">
            <div className="flex items-center gap-2">
              <Clipboard className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="text-[10.5px] text-[#CBD5E1]">
                ¿Tienes una captura o archivo copiado?
              </span>
            </div>
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="px-2.5 py-1 rounded bg-[#162235] border border-[#2B4365] hover:border-[#38BDF8] text-[#93C5FD] hover:text-white font-semibold text-[10.5px] flex items-center gap-1 transition-colors"
            >
              <Clipboard className="w-3 h-3" />
              Pegar (Ctrl+V)
            </button>
          </div>

          {/* Nombre final de archivo */}
          {selectedFile && (
            <div>
              <label className="text-[10.5px] font-semibold text-[#CBD5E1] block mb-1">
                Nombre de archivo en Dropbox:
              </label>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                className="w-full bg-[#141B26] border border-[#26354A] rounded px-2.5 py-1.5 text-[11px] text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
          )}

          {/* Feedback status */}
          {statusMsg && (
            <div
              className={`p-2 rounded text-[10.5px] ${
                statusMsg.ok
                  ? "bg-[#10B981]/20 border border-[#10B981]/40 text-[#6EE7B7]"
                  : "bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#FCA5A5]"
              }`}
            >
              {statusMsg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#141B26] border-t border-[#253549] flex items-center justify-between">
          <span className="text-[10px] text-[#64748B]">
            Presiona <kbd className="bg-[#1E2836] px-1 rounded text-[#CBD5E1]">Ctrl+V</kbd> en la tabla en cualquier momento
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded bg-[#161F2C] border border-[#26354A] hover:bg-[#1E2836] text-[#CBD5E1] text-[11px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="flex items-center gap-1 px-4 py-1 rounded bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 text-white font-semibold text-[11px] transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Subiendo...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir a Dropbox</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
