"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  Plus,
  RotateCw,
  X,
  Globe,
  Users,
  MessageCircle,
  Link as LinkIcon,
  Trash2,
  Edit2,
  Download,
  Upload,
  AlertCircle,
  Sparkles,
  ClipboardPaste,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import {
  WhatsappGroupItem,
  getLocalWhatsappGroups,
  saveLocalWhatsappGroups,
  fetchRemoteWhatsappGroups,
  persistWhatsappGroups,
  detectGroupDomain,
  cleanInviteUrl,
  mergeWhatsappGroups,
} from "@/lib/whatsappDirectory";
import { playCopyChime } from "@/services/windowsIntegration";
import { WhatsAppIcon } from "./WhatsAppIcon";

export { WhatsAppIcon };

export const SYNC_EXTRACTOR_SCRIPT = `(async()=>{
  try {
    const openReq = indexedDB.open('model-storage');
    openReq.onerror = () => alert('No se pudo abrir el almacenamiento de WhatsApp Web.');
    openReq.onsuccess = async () => {
      const db = openReq.result;
      const metadataMap = new Map();
      const messageLinksMap = new Map();

      const findInviteLink = (val) => {
        if (!val) return undefined;
        try {
          const text = typeof val === 'object' ? JSON.stringify(val) : String(val);
          const match = text.match(/https:\\/\\/chat\\.whatsapp\\.com\\/[a-zA-Z0-9_-]+/i);
          return match ? match[0] : undefined;
        } catch { return undefined; }
      };

      // 1. Escanear mensajes en busca de enlaces compartidos en el chat
      if (db.objectStoreNames.contains('message')) {
        try {
          const msgTx = db.transaction('message', 'readonly');
          const msgStore = msgTx.objectStore('message');
          const msgReq = msgStore.getAll();
          await new Promise((res) => {
            msgReq.onsuccess = () => {
              for (const m of msgReq.result || []) {
                const rawRemote = m.id?.remote || m.chatId || m.to || m.from;
                const remote = String(rawRemote?._serialized || (typeof rawRemote === 'string' ? rawRemote : '')).trim();
                if (!remote.includes('@g.us')) continue;
                const link = findInviteLink(m.body) || findInviteLink(m.caption) || findInviteLink(m.text) || findInviteLink(m.quotedMsg);
                if (link && !messageLinksMap.has(remote)) {
                  messageLinksMap.set(remote, link);
                }
              }
              res();
            };
            msgReq.onerror = () => res();
          });
        } catch {}
      }

      // 2. Leer metadatos de grupos
      if (db.objectStoreNames.contains('group-metadata')) {
        try {
          const metaTx = db.transaction('group-metadata', 'readonly');
          const metaStore = metaTx.objectStore('group-metadata');
          const metaReq = metaStore.getAll();
          await new Promise((res) => {
            metaReq.onsuccess = () => {
              for (const m of metaReq.result || []) {
                if (m && m.id) {
                  const mid = String(m.id?._serialized || (typeof m.id === 'string' ? m.id : '')).trim();
                  if (mid) metadataMap.set(mid, m);
                }
              }
              res();
            };
            metaReq.onerror = () => res();
          });
        } catch {}
      }

      // 3. Cruzar datos de chats y resolver enlaces
      try {
        const tx = db.transaction('chat', 'readonly');
        const store = tx.objectStore('chat');
        const chatReq = store.getAll();
        chatReq.onsuccess = async () => {
          const rows = chatReq.result || [];
          const groups = [];

          for (const c of rows) {
            const rawId = c.id;
            const id = String(rawId?._serialized || (typeof rawId === 'string' ? rawId : '')).trim();
            const isGroup = c.isGroup === true || id.endsWith('@g.us') || id.includes('@g.us');
            if (!isGroup) continue;

            const name = String(c.formattedTitle || c.name || c.contact?.name || '').trim();
            if (!name) continue;

            const meta = metadataMap.get(id) || metadataMap.get(rawId?._serialized) || metadataMap.get(rawId?.user);

            // A) Código directo
            let inviteUrl = undefined;
            const rawCode = meta?.inviteCode || meta?.groupMetadata?.inviteCode || meta?.invite || c?.inviteCode;
            if (rawCode && typeof rawCode === 'string') {
              inviteUrl = 'https://chat.whatsapp.com/' + rawCode.replace(/^https:\\/\\/chat\\.whatsapp\\.com\\//i, '');
            }

            // B) Enlace en descripción profunda
            if (!inviteUrl) {
              inviteUrl = findInviteLink(meta?.desc) || findInviteLink(meta?.description) || findInviteLink(c?.desc);
            }

            // C) Enlace compartido en mensajes
            if (!inviteUrl) {
              inviteUrl = messageLinksMap.get(id) || messageLinksMap.get(rawId?._serialized);
            }

            // D) Inspección del objeto meta completo
            if (!inviteUrl && meta) {
              inviteUrl = findInviteLink(meta);
            }

            groups.push({
              id: id || ('group_' + Math.random().toString(36).slice(2, 8) + '@g.us'),
              name,
              inviteUrl,
              participantsCount: Array.isArray(meta?.participants) ? meta.participants.length : undefined,
              owner: meta?.owner ? String(meta.owner?._serialized || meta.owner) : undefined,
              unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : 0,
              lastSynced: new Date().toISOString()
            });
          }

          const withLinks = groups.filter(g => g.inviteUrl).length;
          const dataStr = JSON.stringify({ groups, total: groups.length }, null, 2);

          // 1. Descarga automática de respaldo
          try {
            const blob = new Blob([dataStr], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'anfeta-whatsapp-grupos.json';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 1000);
          } catch {}

          // 2. Tarjeta flotante en WhatsApp Web
          const oldBox = document.getElementById('anfeta-sync-overlay');
          if (oldBox) oldBox.remove();
          const overlay = document.createElement('div');
          overlay.id = 'anfeta-sync-overlay';
          overlay.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
            '<b style="color:#00A884;font-size:15px;">✅ ¡' + groups.length + ' grupos extraídos!</b>' +
            '<button id="anfeta-close-ov" style="background:transparent;border:none;color:#8696A0;cursor:pointer;font-size:18px;line-height:1;">✕</button>' +
            '</div>' +
            '<p style="margin:0 0 12px 0;font-size:12px;color:#AEBAC1;line-height:1.4;">' +
            'Se detectaron <b>' + withLinks + ' grupos con enlace directo</b>.<br>' +
            'Se descargó <b>anfeta-whatsapp-grupos.json</b> automáticamente.' +
            '</p>' +
            '<button id="anfeta-copy-btn" style="width:100%;padding:10px;background:#00A884;color:#111B21;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:13px;margin-bottom:8px;">' +
            '📋 Copiar datos al portapapeles' +
            '</button>';
          document.body.appendChild(overlay);

          document.getElementById('anfeta-close-ov').onclick = () => overlay.remove();
          document.getElementById('anfeta-copy-btn').onclick = async () => {
            try {
              await navigator.clipboard.writeText(dataStr);
            } catch {
              const ta = document.createElement('textarea');
              ta.value = dataStr;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              ta.remove();
            }
            const btn = document.getElementById('anfeta-copy-btn');
            if (btn) btn.textContent = '✓ ¡Copiado con éxito!';
            alert('✅ ¡Copiado al portapapeles!\\n\\nAhora ve a ANFETA y pulsa "Pegar Portapapeles" (o sube el archivo descargado).');
          };

          alert('✅ ¡' + groups.length + ' grupos extraídos (' + withLinks + ' con enlace directo)!\\n\\n1. Se descargó el archivo "anfeta-whatsapp-grupos.json".\\n2. Da clic en "Copiar datos al portapapeles" en la tarjeta verde de tu pantalla.\\n3. Ve a ANFETA y pulsa "Pegar Portapapeles" o "Importar JSON".');
        };
      } catch (e) {
        alert('Error leyendo chats: ' + e.message);
      }
    };
  } catch (e) {
    alert('Error al extraer grupos: ' + e.message);
  }
})();`;

interface WhatsappDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function WhatsappDirectoryModal({
  isOpen,
  onClose,
  initialQuery = "",
}: WhatsappDirectoryModalProps) {
  const [groups, setGroups] = useState<WhatsappGroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [filterType, setFilterType] = useState<"all" | "with_link" | "without_link">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editLinkValue, setEditLinkValue] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupLink, setNewGroupLink] = useState("");
  const [showSyncHelper, setShowSyncHelper] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [manualPasteText, setManualPasteText] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load groups on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialQuery);
      const local = getLocalWhatsappGroups();
      setGroups(local);
      setLoading(true);
      fetchRemoteWhatsappGroups().then((rem) => {
        if (rem && rem.length > 0) {
          setGroups(rem);
        } else if (local && local.length > 0) {
          setGroups(local);
        }
        setLoading(false);
      });
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialQuery]);

  // Handle ESC key to close and Ctrl+V to paste clipboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (showHelpModal) {
          setShowHelpModal(false);
        } else if (showManualPaste) {
          setShowManualPaste(false);
        } else if (editingGroupId) {
          setEditingGroupId(null);
        } else if (isAddingNew) {
          setIsAddingNew(false);
        } else if (showSyncHelper) {
          setShowSyncHelper(false);
        } else {
          onClose();
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
        e.preventDefault();
        handlePasteClipboard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, editingGroupId, isAddingNew, showSyncHelper, showHelpModal, showManualPaste, groups, onClose]);

  // Filtered and sorted groups
  const filteredGroups = useMemo(() => {
    let result = groups;
    const q = searchQuery.trim().toLowerCase();

    if (filterType === "with_link") {
      result = result.filter((g) => Boolean(g.inviteUrl));
    } else if (filterType === "without_link") {
      result = result.filter((g) => !g.inviteUrl);
    }

    if (q) {
      result = result.filter((g) => {
        const nameMatch = g.name.toLowerCase().includes(q);
        const domainMatch = (g.domain || "").toLowerCase().includes(q);
        const linkMatch = (g.inviteUrl || "").toLowerCase().includes(q);
        return nameMatch || domainMatch || linkMatch;
      });
    }

    return result;
  }, [groups, searchQuery, filterType]);

  const handleCopyLink = (group: WhatsappGroupItem) => {
    const url = group.inviteUrl || `https://web.whatsapp.com/`;
    navigator.clipboard.writeText(url);
    playCopyChime?.();
    setCopiedId(group.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenGroup = (group: WhatsappGroupItem) => {
    if (group.inviteUrl) {
      window.open(group.inviteUrl, "_blank", "noopener,noreferrer");
    } else {
      // Abre WhatsApp Web copiando el nombre del grupo para pegarlo en el buscador
      try {
        navigator.clipboard.writeText(group.name);
        playCopyChime?.();
        setStatusMessage(`Copiado: "${group.name}". Pega con Ctrl+V en WhatsApp Web para abrirlo.`);
        setTimeout(() => setStatusMessage(null), 4000);
      } catch {}
      const searchUrl = `https://web.whatsapp.com/`;
      window.open(searchUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleSaveInviteUrl = async (groupId: string) => {
    const valid = cleanInviteUrl(editLinkValue);
    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return { ...g, inviteUrl: valid || editLinkValue.trim() || undefined };
      }
      return g;
    });
    setGroups(updated);
    setEditingGroupId(null);
    setEditLinkValue("");
    await persistWhatsappGroups(updated);
    setStatusMessage("Enlace actualizado correctamente.");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) return;
    const detected = detectGroupDomain(newGroupName);
    const validLink = cleanInviteUrl(newGroupLink);
    const newItem: WhatsappGroupItem = {
      id: `manual_${Date.now()}`,
      name: newGroupName.trim(),
      domain: detected,
      inviteUrl: validLink || newGroupLink.trim() || undefined,
      lastSynced: new Date().toISOString(),
    };

    const updated = [newItem, ...groups];
    setGroups(updated);
    setIsAddingNew(false);
    setNewGroupName("");
    setNewGroupLink("");
    await persistWhatsappGroups(updated);
    setStatusMessage(`Grupo "${newItem.name}" agregado.`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDeleteGroup = async (groupId: string) => {
    const updated = groups.filter((g) => g.id !== groupId);
    setGroups(updated);
    await persistWhatsappGroups(updated);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify({ groups, exportedAt: new Date().toISOString() }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anfeta-whatsapp-grupos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const incoming = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.groups) ? parsed.groups : [];
        if (incoming.length > 0) {
          const result = mergeWhatsappGroups(groups, incoming);
          setGroups(result.groups);
          saveLocalWhatsappGroups(result.groups);
          await persistWhatsappGroups(result.groups);
          playCopyChime?.();

          const parts: string[] = [];
          if (result.addedCount > 0) parts.push(`${result.addedCount} nuevos`);
          if (result.updatedCount > 0) parts.push(`${result.updatedCount} actualizados`);
          if (result.unchangedCount > 0) parts.push(`${result.unchangedCount} sin cambios`);
          const detail = parts.length > 0 ? parts.join(", ") : "sin novedades";

          setStatusMessage(`¡Catálogo actualizado! (${detail}). Total: ${result.groups.length} grupos.`);
          setTimeout(() => setStatusMessage(null), 4000);
        }
      } catch {
        alert("El archivo no tiene un formato JSON válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePasteClipboard = async (pastedText?: string) => {
    let text = pastedText;
    if (!text) {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText) {
        try {
          text = await navigator.clipboard.readText();
        } catch {
          setShowManualPaste(true);
          return;
        }
      } else {
        setShowManualPaste(true);
        return;
      }
    }

    if (!text || !text.trim()) {
      setShowManualPaste(true);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const incoming = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.groups) ? parsed.groups : [];
      if (incoming.length === 0) {
        setShowManualPaste(true);
        return;
      }

      const result = mergeWhatsappGroups(groups, incoming);
      setGroups(result.groups);
      saveLocalWhatsappGroups(result.groups);
      await persistWhatsappGroups(result.groups);
      setShowManualPaste(false);
      setManualPasteText("");
      playCopyChime?.();

      const parts: string[] = [];
      if (result.addedCount > 0) parts.push(`${result.addedCount} nuevos`);
      if (result.updatedCount > 0) parts.push(`${result.updatedCount} actualizados`);
      if (result.unchangedCount > 0) parts.push(`${result.unchangedCount} sin cambios`);
      const detail = parts.length > 0 ? parts.join(", ") : "sin novedades";

      setStatusMessage(`¡Sincronización completada! (${detail}). Total: ${result.groups.length} grupos.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setShowManualPaste(true);
    }
  };

  const copySyncScript = () => {
    navigator.clipboard.writeText(SYNC_EXTRACTOR_SCRIPT.trim());
    playCopyChime?.();
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 3500);
    setStatusMessage("¡Script copiado al portapapeles! Abre WhatsApp Web y presiona F12.");
    setTimeout(() => setStatusMessage(null), 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-4xl h-[88vh] max-h-[820px] bg-[#0B0F17] border border-[#202E42] rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#0F1622] border-b border-[#1E293B] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#25D366]/15 border border-[#25D366]/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(37,211,102,0.25)]">
              <WhatsAppIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide truncate">
                  Grupos de WhatsApp de Proyectos
                </h2>
                <span className="whitespace-nowrap shrink-0 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#1E293B] border border-slate-700 text-[#38BDF8]">
                  {groups.length} grupos
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Acceso directo a grupos de empresas y clientes sin salir de ANFETA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0284C7]/20 hover:bg-[#0284C7]/30 border border-[#38BDF8]/60 text-[#7DD3FC] text-xs font-semibold cursor-pointer transition-colors shadow-sm"
              title="Guía detallada paso a paso para sincronizar los grupos"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>¿Cómo sincronizar?</span>
            </button>
            <button
              onClick={() => handlePasteClipboard()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20BD5A] text-slate-950 text-xs font-bold cursor-pointer transition-colors shadow-[0_0_10px_rgba(37,211,102,0.25)]"
              title="Pegar los grupos copiados desde WhatsApp Web (o pulsa Ctrl+V)"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-slate-950" />
              <span>Pegar Portapapeles</span>
            </button>
            <button
              onClick={() => setIsAddingNew(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162232] hover:bg-[#1E3046] border border-[#263A52] text-slate-200 text-xs font-semibold cursor-pointer transition-colors shadow-sm"
              title="Registrar un nuevo grupo manualmente"
            >
              <Plus className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Nuevo Grupo</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors ml-1"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Full Step-by-Step Guide Modal Dialog */}
        {showHelpModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-150">
            <div className="bg-[#0B121C] border border-[#223952] rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-[#0F1826] border-b border-[#1E2E42] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#25D366]/15 border border-[#25D366]/40 flex items-center justify-center text-[#25D366] shrink-0 shadow-[0_0_10px_rgba(37,211,102,0.2)]">
                    <WhatsAppIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Guía de Sincronización Paso a Paso</h3>
                    <p className="text-[11px] text-slate-400">Importa o actualiza tus grupos de WhatsApp en ANFETA sin complicaciones</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Cerrar guía (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body with clear steps */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs scrollbar-thin">
                {/* Paso 1 */}
                <div className="bg-[#101A28] border border-[#1E2E42] rounded-xl p-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#0284C7] text-white font-bold flex items-center justify-center text-xs">1</span>
                      <span className="font-bold text-white text-sm">Copiar el script extractor</span>
                    </div>
                    <button
                      onClick={copySyncScript}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                        scriptCopied
                          ? "bg-[#22C55E] text-slate-900 border border-[#4ADE80]"
                          : "bg-[#0284C7] hover:bg-[#0369A1] text-white border border-[#38BDF8]/50"
                      }`}
                    >
                      {scriptCopied ? <Check className="w-4 h-4 text-slate-900" /> : <Copy className="w-4 h-4" />}
                      <span>{scriptCopied ? "✓ ¡Script copiado al portapapeles!" : "📋 Copiar Script al Portapapeles"}</span>
                    </button>
                  </div>
                  <p className="text-slate-400 text-[11.5px] leading-relaxed">
                    Este script extrae tus grupos directamente en WhatsApp Web de forma 100% segura (solo lectura en memoria local, sin bots ni riesgo de bloqueo).
                  </p>
                  <div>
                    <button
                      onClick={() => setShowScriptCode(!showScriptCode)}
                      className="text-[11px] text-[#38BDF8] hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                    >
                      <span>{showScriptCode ? "▲ Ocultar código del script" : "▼ Ver código completo del script"}</span>
                    </button>
                    {showScriptCode && (
                      <pre className="mt-2 max-h-40 overflow-y-auto p-3 bg-black/60 rounded-lg border border-slate-700 text-[10.5px] font-mono text-emerald-400 leading-snug">
                        <code>{SYNC_EXTRACTOR_SCRIPT}</code>
                      </pre>
                    )}
                  </div>
                </div>

                {/* Paso 2 */}
                <div className="bg-[#101A28] border border-[#1E2E42] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#1E3A5F] text-[#38BDF8] border border-[#38BDF8]/40 font-bold flex items-center justify-center text-xs">2</span>
                      <span className="font-bold text-white text-sm">Abrir WhatsApp Web</span>
                    </div>
                    <a
                      href="https://web.whatsapp.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#162536] hover:bg-[#1E344C] border border-[#2C4A6B] text-[#7DD3FC] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#38BDF8]" />
                      <span>Ir a web.whatsapp.com</span>
                    </a>
                  </div>
                  <p className="text-slate-400 text-[11.5px] leading-relaxed">
                    Abre tu sesión de WhatsApp Web en otra pestaña de este navegador y asegúrate de ver la lista de chats.
                  </p>
                </div>

                {/* Paso 3 */}
                <div className="bg-[#101A28] border border-[#1E2E42] rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#1E3A5F] text-[#38BDF8] border border-[#38BDF8]/40 font-bold flex items-center justify-center text-xs">3</span>
                    <span className="font-bold text-white text-sm">Abrir la Consola de Desarrollador</span>
                  </div>
                  <div className="text-slate-300 text-[11.5px] leading-relaxed space-y-1">
                    <p>En la pestaña de WhatsApp Web:</p>
                    <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                      <li>Presiona la tecla <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[#7DD3FC] font-mono font-bold">F12</kbd> (o <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[#7DD3FC] font-mono font-bold">Ctrl + Shift + I</kbd>).</li>
                      <li>O da clic derecho en cualquier espacio vacío y selecciona <b className="text-slate-200">Inspeccionar</b>.</li>
                      <li>Haz clic en la pestaña superior que dice <b className="text-[#38BDF8]">Consola</b> (o <i>Console</i>).</li>
                    </ul>
                  </div>
                </div>

                {/* Paso 4 */}
                <div className="bg-[#101A28] border border-[#1E2E42] rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#1E3A5F] text-[#38BDF8] border border-[#38BDF8]/40 font-bold flex items-center justify-center text-xs">4</span>
                    <span className="font-bold text-white text-sm">Pegar el script y presionar Enter</span>
                  </div>
                  <p className="text-slate-400 text-[11.5px] leading-relaxed">
                    Haz clic en el renglón inferior de la consola, pega el script con <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[#7DD3FC] font-mono font-bold">Ctrl + V</kbd> y presiona la tecla <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[#7DD3FC] font-mono font-bold">Enter</kbd>.
                  </p>
                </div>

                {/* Paso 5 */}
                <div className="bg-[#101A28] border border-[#1E2E42] rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#25D366] text-slate-900 font-bold flex items-center justify-center text-xs">5</span>
                    <span className="font-bold text-white text-sm">Copiar datos en WhatsApp Web</span>
                  </div>
                  <p className="text-slate-400 text-[11.5px] leading-relaxed">
                    Verás aparecer una tarjeta verde en WhatsApp Web con el conteo de grupos extraídos. Haz clic en el botón verde <b className="text-[#4ADE80]">"📋 Copiar datos al portapapeles"</b>.<br/>
                    <span className="text-slate-500 text-[11px]">(Como respaldo, también se descargará automáticamente a tu carpeta de Descargas el archivo <i>anfeta-whatsapp-grupos.json</i>).</span>
                  </p>
                </div>

                {/* Paso 6 */}
                <div className="bg-[#0D2419] border border-[#1E523A] rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#22C55E] text-slate-900 font-bold flex items-center justify-center text-xs">6</span>
                      <span className="font-bold text-white text-sm">Guardar en ANFETA</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowHelpModal(false);
                        handlePasteClipboard();
                      }}
                      className="px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                    >
                      <ClipboardPaste className="w-4 h-4 text-slate-950" />
                      <span>Pegar Portapapeles Ahora</span>
                    </button>
                  </div>
                  <p className="text-emerald-300/80 text-[11.5px] leading-relaxed">
                    Vuelve a esta ventana de ANFETA y pulsa el botón verde para registrar todo de inmediato.
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-[#1B4230] text-[11px] text-emerald-400/70">
                    <span>¿Prefieres subir el archivo descargado?</span>
                    <label className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0A1A12] hover:bg-[#112E20] border border-[#1E523A] text-emerald-300 font-semibold cursor-pointer transition-colors">
                      <Upload className="w-3 h-3 text-[#22C55E]" />
                      <span>Subir anfeta-whatsapp-grupos.json</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          handleImportJson(e);
                          setShowHelpModal(false);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Nota informativa de sincronización incremental */}
                <div className="p-3.5 rounded-lg bg-[#111927] border border-[#1E2E42] text-[11px] text-slate-400 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <b className="text-white">Sincronización Inteligente:</b> Si ya tienes grupos registrados en ANFETA, esta sincronización solo agregará los grupos que falten y actualizará los nuevos datos (enlaces descubiertos o cambios en miembros), conservando tus notas y configuraciones previas sin borrar nada.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-[#0F1826] border-t border-[#1E2E42] flex items-center justify-end shrink-0">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs cursor-pointer transition-colors"
                >
                  Entendido, cerrar guía
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Paste Modal Dialog */}
        {showManualPaste && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
            <div className="bg-[#0F1622] border border-[#2B4058] rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4 text-[#38BDF8]" />
                  <span className="text-sm font-bold text-white">Pegar catálogo de grupos de WhatsApp</span>
                </div>
                <button
                  onClick={() => setShowManualPaste(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                El navegador bloqueó la lectura automática del portapapeles. Pega el texto aquí abajo (<kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Ctrl + V</kbd>) o sube el archivo descargado:
              </p>
              <textarea
                value={manualPasteText}
                onChange={(e) => setManualPasteText(e.target.value)}
                placeholder='Presiona Ctrl + V aquí para pegar el JSON de grupos...'
                className="w-full h-40 bg-[#070B11] border border-[#223348] focus:border-[#38BDF8] rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none resize-none"
                autoFocus
              />
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#162232] hover:bg-[#1E3046] border border-[#263A52] text-xs text-slate-300 font-medium cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Subir anfeta-whatsapp-grupos.json</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      handleImportJson(e);
                      setShowManualPaste(false);
                    }}
                    className="hidden"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManualPaste(false)}
                    className="px-3 py-1.5 rounded border border-slate-700 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handlePasteClipboard(manualPasteText)}
                    disabled={!manualPasteText.trim()}
                    className="px-4 py-1.5 rounded bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
                  >
                    Guardar grupos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sync Helper Drawer (if opened) */}
        {showSyncHelper && (
          <div className="bg-[#0B1522] border-b border-[#254160] px-5 py-4 text-xs text-slate-300 animate-in slide-in-from-top duration-200">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3 max-w-3xl">
                <div className="flex items-center gap-2 font-bold text-[#38BDF8] text-sm">
                  <Sparkles className="w-4 h-4 text-[#38BDF8]" />
                  <span>Pasos para sincronizar tus grupos de WhatsApp con ANFETA</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-1">
                  {/* Paso 1 */}
                  <div className="bg-[#111C2B] border border-[#1E3048] rounded-lg p-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#0284C7] text-white font-bold text-[10px] flex items-center justify-center">1</span>
                        <span className="font-bold text-white text-[11px]">Copiar script</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Copia el código extractor preparado para WhatsApp Web.
                      </p>
                    </div>
                    <button
                      onClick={copySyncScript}
                      className="mt-2.5 w-full py-1.5 px-2 rounded bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Script</span>
                    </button>
                  </div>

                  {/* Paso 2 */}
                  <div className="bg-[#111C2B] border border-[#1E3048] rounded-lg p-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#1E3A5F] text-[#38BDF8] font-bold text-[10px] flex items-center justify-center border border-[#38BDF8]/40">2</span>
                        <span className="font-bold text-white text-[11px]">Pegar en WhatsApp</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Abre <b className="text-slate-200">web.whatsapp.com</b>, presiona <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[#7DD3FC] font-mono text-[10px]">F12</kbd> (Consola), pega con <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[#7DD3FC] font-mono text-[10px]">Ctrl+V</kbd> y da <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[#7DD3FC] font-mono text-[10px]">Enter</kbd>.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] text-slate-500 font-mono">web.whatsapp.com</span>
                  </div>

                  {/* Paso 3 */}
                  <div className="bg-[#111C2B] border border-[#1E3048] rounded-lg p-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#1E3A5F] text-[#38BDF8] font-bold text-[10px] flex items-center justify-center border border-[#38BDF8]/40">3</span>
                        <span className="font-bold text-white text-[11px]">Copiar datos</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Saldrá una tarjeta verde en WhatsApp. Pulsa <b className="text-[#4ADE80]">Copiar datos</b> (también se descarga el JSON).
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] text-[#4ADE80] font-semibold">✓ Extracción lista</span>
                  </div>

                  {/* Paso 4 */}
                  <div className="bg-[#111C2B] border border-[#1E3048] rounded-lg p-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#25D366] text-[#0B141A] font-bold text-[10px] flex items-center justify-center">4</span>
                        <span className="font-bold text-white text-[11px]">Guardar en ANFETA</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Regresa a esta ventana y pulsa el botón abajo para guardar todo.
                      </p>
                    </div>
                    <button
                      onClick={() => handlePasteClipboard()}
                      className="mt-2.5 w-full py-1.5 px-2 rounded bg-[#25D366] hover:bg-[#20BD5A] text-[#0A1319] font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>Pegar Portapapeles</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#1E2D40] text-[11px] text-slate-400">
                  <span>¿Prefieres subir el archivo descargado directamente?</span>
                  <label className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#162232] hover:bg-[#1E3046] border border-[#263A52] text-[#7DD3FC] font-medium cursor-pointer transition-colors">
                    <Upload className="w-3 h-3 text-[#38BDF8]" />
                    <span>Importar anfeta-whatsapp-grupos.json</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportJson}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <button
                onClick={() => setShowSyncHelper(false)}
                className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                title="Cerrar guía"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Status Toast */}
        {statusMessage && (
          <div className="bg-[#064E3B]/80 border-b border-[#059669] px-4 py-1.5 text-xs text-[#6EE7B7] flex items-center gap-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Search & Filters */}
        <div className="px-5 py-3 bg-[#0E1520] border-b border-[#1A2636] flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por empresa, proyecto (ej. apartallante.com, webs), o nombre de grupo…"
              className="w-full bg-[#131D2A] border border-[#223348] rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 text-xs">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                filterType === "all"
                  ? "bg-[#1E3046] border-[#38BDF8] text-[#38BDF8] font-bold"
                  : "bg-[#131D2A] border-[#223348] text-slate-400 hover:text-white"
              }`}
            >
              Todos ({groups.length})
            </button>
            <button
              onClick={() => setFilterType("with_link")}
              className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                filterType === "with_link"
                  ? "bg-[#1E3046] border-[#38BDF8] text-[#38BDF8] font-bold"
                  : "bg-[#131D2A] border-[#223348] text-slate-400 hover:text-white"
              }`}
            >
              Con enlace directo ({groups.filter((g) => g.inviteUrl).length})
            </button>
            <button
              onClick={() => setFilterType("without_link")}
              className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                filterType === "without_link"
                  ? "bg-[#1E3046] border-[#38BDF8] text-[#38BDF8] font-bold"
                  : "bg-[#131D2A] border-[#223348] text-slate-400 hover:text-white"
              }`}
            >
              Sin enlace ({groups.filter((g) => !g.inviteUrl).length})
            </button>
          </div>
        </div>

        {/* Modal Inline Add New Group */}
        {isAddingNew && (
          <div className="bg-[#121E2E] border-b border-[#254160] px-5 py-3 animate-in slide-in-from-top duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#38BDF8]">Registrar nuevo grupo de proyecto</span>
              <button
                onClick={() => setIsAddingNew(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nombre del grupo (ej. Apartallante - Web & Ads)"
                className="bg-[#0B131E] border border-[#223348] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8]"
                autoFocus
              />
              <input
                type="text"
                value={newGroupLink}
                onChange={(e) => setNewGroupLink(e.target.value)}
                placeholder="Enlace de invitación (https://chat.whatsapp.com/...)"
                className="bg-[#0B131E] border border-[#223348] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAddingNew(false)}
                className="px-3 py-1 rounded border border-slate-700 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateNewGroup}
                className="px-3 py-1 rounded bg-[#0284C7] hover:bg-[#0369A1] text-xs text-white font-bold"
              >
                Guardar grupo
              </button>
            </div>
          </div>
        )}

        {/* Group Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/35 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(37,211,102,0.2)]">
                <WhatsAppIcon className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">
                {searchQuery ? "No se encontraron grupos que coincidan" : "No hay grupos registrados todavía"}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                {searchQuery
                  ? "Prueba buscando por otra palabra o registra el grupo manualmente."
                  : "Sincroniza tus grupos directamente desde WhatsApp Web o regístralos a mano para vincularlos con tus proyectos y calendario."}
              </p>
              {!searchQuery && (
                <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
                  <button
                    onClick={() => handlePasteClipboard()}
                    className="px-3.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20BD5A] text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(37,211,102,0.3)] cursor-pointer transition-all"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-slate-950" />
                    <span>Pegar Portapapeles (Ctrl+V)</span>
                  </button>
                  <button
                    onClick={() => setShowHelpModal(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0284C7]/20 hover:bg-[#0284C7]/30 border border-[#38BDF8]/50 text-[#7DD3FC] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#38BDF8] inline mr-1" />
                    <span>Ver cómo sincronizar paso a paso</span>
                  </button>
                  <button
                    onClick={() => setIsAddingNew(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#162232] hover:bg-[#1E3046] border border-[#263A52] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#38BDF8] inline mr-1" />
                    <span>Registrar grupo a mano</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredGroups.map((group) => {
              const hasLink = Boolean(group.inviteUrl);
              const isEditing = editingGroupId === group.id;

              return (
                <div
                  key={group.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-[#111824] hover:bg-[#141E2E] border border-[#1E2C3E] hover:border-[#2D435E] transition-all gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#182638] border border-[#2B3F58] flex items-center justify-center text-[#38BDF8] shrink-0 font-bold text-xs">
                      {group.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white truncate max-w-md">
                          {group.name}
                        </span>
                        {group.domain && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1E3A5F]/60 border border-[#38BDF8]/40 text-[#7DD3FC]">
                            <Globe className="w-2.5 h-2.5 text-[#38BDF8]" />
                            <span>{group.domain}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
                        {hasLink ? (
                          <span className="text-[#34D399] flex items-center gap-1 font-mono text-[10.5px] truncate max-w-xs">
                            <Check className="w-3 h-3 shrink-0" />
                            <span className="truncate">{group.inviteUrl}</span>
                          </span>
                        ) : (
                          <span className="text-amber-400/80 flex items-center gap-1 text-[10.5px]">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>Sin enlace directo guardado</span>
                          </span>
                        )}
                        {typeof group.participantsCount === "number" && group.participantsCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-slate-400 text-[10.5px]">
                            <Users className="w-2.5 h-2.5 text-slate-500" />
                            <span>{group.participantsCount} miembros</span>
                          </span>
                        )}
                        {group.id && (
                          <span className="text-[10px] font-mono text-slate-600 truncate max-w-[140px]" title={`ID WhatsApp: ${group.id}`}>
                            {group.id.replace(/@g\.us$/, "")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Inline edit link */}
                    {isEditing ? (
                      <div className="flex items-center gap-1 bg-[#0B131E] p-1 rounded border border-[#38BDF8]">
                        <input
                          type="text"
                          value={editLinkValue}
                          onChange={(e) => setEditLinkValue(e.target.value)}
                          placeholder="https://chat.whatsapp.com/..."
                          className="w-48 bg-transparent text-xs text-white px-1.5 focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveInviteUrl(group.id);
                            if (e.key === "Escape") setEditingGroupId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveInviteUrl(group.id)}
                          className="px-2 py-0.5 rounded bg-[#0284C7] text-white text-[11px] font-bold"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingGroupId(null)}
                          className="px-1.5 py-0.5 text-slate-400 hover:text-white text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingGroupId(group.id);
                            setEditLinkValue(group.inviteUrl || "");
                          }}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-[#38BDF8] transition-colors"
                          title={hasLink ? "Editar enlace" : "Agregar enlace de invitación"}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {hasLink && (
                          <button
                            onClick={() => handleCopyLink(group)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-[#38BDF8] transition-colors"
                            title="Copiar enlace de invitación"
                          >
                            {copiedId === group.id ? (
                              <Check className="w-3.5 h-3.5 text-[#34D399]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenGroup(group)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm ${
                            hasLink
                              ? "bg-[#25D366] hover:bg-[#20BD5A] text-slate-950 font-bold shadow-[0_0_10px_rgba(37,211,102,0.3)]"
                              : "bg-[#1E293B] hover:bg-[#334155] text-slate-200"
                          }`}
                          title={hasLink ? "Abrir directamente en WhatsApp" : "Buscar en WhatsApp Web (copia el nombre)"}
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{hasLink ? "Abrir Grupo" : "Abrir Web"}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1.5 rounded hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors"
                          title="Eliminar del directorio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#0F1622] border-t border-[#1E293B] text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-slate-500">
              Mostrando {filteredGroups.length} de {groups.length} grupos
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#162232] hover:bg-[#1E3046] border border-[#263A52] text-slate-300 text-xs font-medium cursor-pointer transition-colors">
              <Upload className="w-3 h-3 text-[#38BDF8]" />
              <span>Importar JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>

            {groups.length > 0 && (
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#162232] hover:bg-[#1E3046] border border-[#263A52] text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                title="Exportar respaldo de grupos en archivo JSON"
              >
                <Download className="w-3 h-3 text-[#34D399]" />
                <span>Exportar</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
