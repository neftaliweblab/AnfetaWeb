"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Mic,
  Volume2,
  Key,
  Folder,
  Database,
  X,
  Check,
  RotateCw,
} from "lucide-react";
import {
  getWindowsAudioDevices,
  playTestChime,
  WindowsAudioDevice,
  openWindowsSoundSettings,
} from "@/services/windowsIntegration";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
  onSaveCurrentUser: (u: string) => void;
}

const USERS_LIST = [
  { tag: "jjohn", name: "John", role: "Supervisor / Dirección" },
  { tag: "kkarl", name: "Karla", role: "Diseño & Web" },
  { tag: "nneft", name: "Neftali", role: "Desarrollo & Automatización" },
  { tag: "iisai", name: "Isaias", role: "SEO & Contenido" },
  { tag: "aandr", name: "Andrade", role: "ADS & Campañas" },
  { tag: "bbria", name: "Brian", role: "Desarrollo & Soporte" },
  { tag: "ggena", name: "Genaro", role: "Operaciones & Medios" },
  { tag: "ssote", name: "Sotelo", role: "Diseño & Creativo" },
  { tag: "aacal", name: "Acalli", role: "Gestión & Contenido" },
  { tag: "eemma", name: "Emmanuel", role: "Sistemas & Datos" },
  { tag: "__all__", name: "Todos los usuarios", role: "Modo Administrador Global" },
];

export function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  onSaveCurrentUser,
}: SettingsModalProps) {
  const [userTag, setUserTag] = useState(currentUser);
  const [devices, setDevices] = useState<WindowsAudioDevice[]>([]);
  const [volume, setVolume] = useState(80);
  const [dictateToasts, setDictateToasts] = useState(true);
  const [micTesting, setMicTesting] = useState(false);
  const [vuLevel, setVuLevel] = useState(0);
  const [dropboxPath, setDropboxPath] = useState("C:\\Users\\nanoc\\Dropbox");
  const [dropboxToken, setDropboxToken] = useState("");
  const [notionToken, setNotionToken] = useState("");
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingDropbox, setIsSyncingDropbox] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getWindowsAudioDevices().then(setDevices);

      // 1. Leer inmediatamente de localStorage (para persistencia 100% confiable en la web/Vercel)
      try {
        const stored = localStorage.getItem("anfeta_settings");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.notionToken) setNotionToken(parsed.notionToken);
          if (parsed.dropboxToken) setDropboxToken(parsed.dropboxToken);
          if (parsed.dropboxPath) setDropboxPath(parsed.dropboxPath);
          if (parsed.currentUser) setUserTag(parsed.currentUser);
        }
      } catch (err) {
        console.warn("Error leyendo localStorage anfeta_settings:", err);
      }

      // 2. Complementar con datos del backend si faltan
      fetch("/api/data?type=settings")
        .then((res) => res.json())
        .then((data) => {
          try {
            const stored = localStorage.getItem("anfeta_settings");
            const parsed = stored ? JSON.parse(stored) : {};
            if (!parsed.notionToken && data.notionToken) setNotionToken(data.notionToken);
            if (!parsed.dropboxToken && data.dropboxToken) setDropboxToken(data.dropboxToken);
            if (!parsed.dropboxPath && data.dropboxPath) setDropboxPath(data.dropboxPath);
            if (!parsed.currentUser && data.currentUser) setUserTag(data.currentUser);
          } catch {
            if (data.notionToken) setNotionToken(data.notionToken);
            if (data.dropboxToken) setDropboxToken(data.dropboxToken);
            if (data.dropboxPath) setDropboxPath(data.dropboxPath);
            if (data.currentUser) setUserTag(data.currentUser);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleTestMic = () => {
    setMicTesting(true);
    let count = 0;
    const interval = setInterval(() => {
      const level = Math.floor(Math.random() * 85) + 15;
      setVuLevel(level);
      count++;
      if (count > 15) {
        clearInterval(interval);
        setMicTesting(false);
        setVuLevel(0);
      }
    }, 200);
  };

  const handleTestToken = async () => {
    if (!notionToken.trim()) {
      setTestStatus({ ok: false, msg: "Ingresa el token de Notion antes de probar" });
      return;
    }
    setIsTestingToken(true);
    setTestStatus(null);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-notion-token", payload: { token: notionToken.trim() } }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus({ ok: true, msg: `✓ Conectado: ${data.bot}` });
      } else {
        setTestStatus({ ok: false, msg: `✕ Error: ${data.error}` });
      }
    } catch (e: any) {
      setTestStatus({ ok: false, msg: `✕ ${e.message}` });
    } finally {
      setIsTestingToken(false);
    }
  };

  const handleSyncNotion = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-notion", payload: { token: notionToken.trim() } }),
      });
      const data = await res.json();
      if (data.success) {
        // Disparar evento para que la vista recargue los datos actualizados de Notion
        window.dispatchEvent(new CustomEvent("anfeta_data_refreshed", { detail: data }));
        alert(data.message || `Sincronizadas ${data.count} páginas con Notion.`);
      } else {
        alert(`Error al sincronizar con Notion: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error de red: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    const savedConfig = {
      notionToken: notionToken.trim(),
      dropboxToken: dropboxToken.trim(),
      dropboxPath: dropboxPath.trim(),
      currentUser: userTag,
    };

    // 1. Guardar en localStorage inmediatamente (persistencia cliente)
    try {
      localStorage.setItem("anfeta_settings", JSON.stringify(savedConfig));
    } catch (err) {
      console.warn("Error guardando anfeta_settings en localStorage:", err);
    }

    // 2. Notificar globalmente cambios de configuración
    window.dispatchEvent(new CustomEvent("anfeta_settings_changed", { detail: savedConfig }));

    // 3. Persistir en backend
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-settings",
        payload: savedConfig,
      }),
    }).catch(() => {});

    onSaveCurrentUser(userTag);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0F141A] border border-[#26323E] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-12 px-5 border-b border-[#26323E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#00A8FF]" />
            <h3 className="text-sm font-bold text-[#F1F5F9]">
              Configuración e Integraciones Windows
            </h3>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#F1F5F9] p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4 text-xs text-[#CBD5E1] scrollbar-thin">
          {/* Identidad de Usuario en Windows */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#F1F5F9] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-[#38BDF8]" />
                Usuario Activo en este Equipo
              </span>
              <span className="text-[10px] font-mono text-[#38BDF8] bg-[#111822] px-2 py-0.5 rounded border border-[#223848]">
                Tag: {userTag}
              </span>
            </label>

            <select
              value={userTag}
              onChange={(e) => setUserTag(e.target.value)}
              className="w-full h-8 px-3 bg-[#080B0F] border border-[#26323E] rounded text-[#F1F5F9] text-xs focus:outline-none focus:border-[#00A8FF] cursor-pointer"
            >
              {USERS_LIST.map((u) => (
                <option key={u.tag} value={u.tag} className="bg-[#0F141A] text-[#F1F5F9] py-1">
                  {u.name} ({u.tag}) — {u.role}
                </option>
              ))}
            </select>
          </div>

          {/* Dropbox & Notion Config */}
          <div className="space-y-2.5 pt-2 border-t border-[#1C2735]">
            <span className="font-semibold text-[#F1F5F9] flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-[#A855F7]" />
              Integración Notion & Token Secreto
            </span>
            <div className="space-y-1">
              <label className="text-[10.5px] text-[#94A3B8] block">
                Token de Integración Notion (Internal Integration Secret):
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={notionToken}
                  onChange={(e) => setNotionToken(e.target.value)}
                  placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 h-8 px-3 bg-[#080B0F] border border-[#26323E] rounded text-[#F1F5F9] font-mono text-[11px] focus:outline-none focus:border-[#38BDF8]"
                />
                <button
                  type="button"
                  onClick={handleTestToken}
                  disabled={isTestingToken}
                  className="px-3 h-8 bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] text-[#38BDF8] text-[11px] font-semibold rounded shrink-0 transition-colors"
                >
                  {isTestingToken ? "Probando..." : "Probar"}
                </button>
                <button
                  type="button"
                  onClick={handleSyncNotion}
                  disabled={isSyncing}
                  className="px-3 h-8 bg-[#0C4A6E] hover:bg-[#0284C7] border border-[#38BDF8] text-white text-[11px] font-semibold rounded shrink-0 flex items-center gap-1 transition-colors"
                >
                  <RotateCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>Sync</span>
                </button>
              </div>
              {testStatus && (
                <div
                  className={`p-2 rounded text-[11px] font-medium ${
                    testStatus.ok
                      ? "bg-[#10251B] border border-[#4ADE80]/40 text-[#4ADE80]"
                      : "bg-[#2B1419] border border-[#FB7185]/40 text-[#FB7185]"
                  }`}
                >
                  {testStatus.msg}
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[10.5px] text-[#94A3B8] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Folder className="w-3 h-3 text-[#F59E0B]" />
                  Ruta Local de Dropbox (Windows):
                </span>
                <span className="text-[10px] text-[#64748B]">
                  Compatible con Explorador y Selector Nativo
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dropboxPath}
                  onChange={(e) => setDropboxPath(e.target.value)}
                  placeholder="C:\Users\...\Dropbox"
                  className="flex-1 h-8 px-3 bg-[#080B0F] border border-[#26323E] rounded text-[#F1F5F9] font-mono text-[11px] focus:outline-none focus:border-[#F59E0B]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
                        const dirHandle = await (window as any).showDirectoryPicker();
                        if (dirHandle?.name) {
                          // En navegadores con File System Access API podemos sugerir o confirmar la ruta
                          const guessed = `C:\\Users\\nanoc\\Dropbox\\${dirHandle.name}`;
                          setDropboxPath(guessed);
                        }
                      } else {
                        // Fallback con input file webkitdirectory
                        const input = document.createElement("input");
                        input.type = "file";
                        input.setAttribute("webkitdirectory", "true");
                        input.setAttribute("directory", "true");
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const relPath = file.webkitRelativePath || "";
                            const rootName = relPath.split("/")[0] || "";
                            if (rootName) setDropboxPath(`C:\\Users\\nanoc\\Dropbox\\${rootName}`);
                          }
                        };
                        input.click();
                      }
                    } catch (err: any) {
                      if (err?.name !== "AbortError") {
                        console.warn("Selector de carpeta cancelado o no soportado:", err);
                      }
                    }
                  }}
                  className="px-2.5 h-8 bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] text-[#F59E0B] text-[11px] font-semibold rounded shrink-0 flex items-center gap-1 transition-colors"
                  title="Abrir selector de carpetas de Windows"
                >
                  <Folder className="w-3 h-3" />
                  <span>Examinar...</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSyncingDropbox(true);
                    try {
                      const res = await fetch("/api/data", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "sync-dropbox",
                          payload: { dropboxPath: dropboxPath.trim(), dropboxToken: dropboxToken.trim() },
                        }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        window.dispatchEvent(new CustomEvent("anfeta_data_refreshed", { detail: data }));
                        alert(data.message || `Indexados ${data.count} elementos.`);
                      } else {
                        alert(`Error al indexar Dropbox: ${data.error}`);
                      }
                    } catch (e: any) {
                      alert(`Error: ${e.message}`);
                    } finally {
                      setIsSyncingDropbox(false);
                    }
                  }}
                  disabled={isSyncingDropbox}
                  className="px-2.5 h-8 bg-[#854D0E]/60 hover:bg-[#A16207] border border-[#F59E0B] text-amber-200 text-[11px] font-semibold rounded shrink-0 flex items-center gap-1 transition-colors"
                  title="Escanear y actualizar índice de archivos locales de Dropbox"
                >
                  <RotateCw className={`w-3 h-3 ${isSyncingDropbox ? "animate-spin" : ""}`} />
                  <span>Indexar</span>
                </button>
              </div>
            </div>

            {/* Token Secreto de Dropbox Cloud API */}
            <div className="space-y-1 pt-1">
              <label className="text-[10.5px] text-[#94A3B8] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-[#38BDF8]" />
                  Token de Dropbox API (Cloud / Web):
                </span>
                <span className="text-[10px] text-[#64748B]">
                  Opcional si usas DROPBOX_ACCESS_TOKEN en .env
                </span>
              </label>
              <input
                type="password"
                value={dropboxToken}
                onChange={(e) => setDropboxToken(e.target.value)}
                placeholder="sl.u.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full h-8 px-3 bg-[#080B0F] border border-[#26323E] rounded text-[#F1F5F9] font-mono text-[11px] focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
          </div>

          {/* Audio WASAPI & Notifications */}
          <div className="space-y-2 pt-2 border-t border-[#1C2735]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#F1F5F9] flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-[#4ADE80]" />
                Audio de Windows & Notificaciones
              </span>
              <button onClick={openWindowsSoundSettings} className="text-[10px] text-[#38BDF8] hover:underline">
                Panel Windows
              </button>
            </div>
            <div className="flex items-center justify-between bg-[#131A22] p-2 rounded border border-[#223848]">
              <span className="text-[11px]">Volumen Chime ({volume}%)</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-20 accent-[#00A8FF]"
                />
                <button
                  type="button"
                  onClick={() => playTestChime(volume / 100)}
                  className="px-2 py-0.5 bg-[#18212B] text-[#38BDF8] border border-[#2A3E50] rounded text-[10px]"
                >
                  Probar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#26323E] flex justify-end gap-2 bg-[#080B0F]">
          <button onClick={onClose} className="px-4 py-1.5 rounded text-[#94A3B8] hover:bg-[#131A22] text-xs">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#00A8FF] hover:bg-[#1FB6FF] text-[#080B0F] text-xs font-bold rounded flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Guardar Configuración</span>
          </button>
        </div>
      </div>
    </div>
  );
}
