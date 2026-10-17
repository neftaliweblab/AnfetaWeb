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
} from "lucide-react";
import {
  WhatsappGroupItem,
  getLocalWhatsappGroups,
  saveLocalWhatsappGroups,
  fetchRemoteWhatsappGroups,
  persistWhatsappGroups,
  detectGroupDomain,
  cleanInviteUrl,
} from "@/lib/whatsappDirectory";
import { playCopyChime } from "@/services/windowsIntegration";

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load groups on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialQuery);
      setGroups(getLocalWhatsappGroups());
      setLoading(true);
      fetchRemoteWhatsappGroups().then((rem) => {
        setGroups(rem);
        setLoading(false);
      });
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialQuery]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (editingGroupId) {
          setEditingGroupId(null);
        } else if (isAddingNew) {
          setIsAddingNew(false);
        } else if (showSyncHelper) {
          setShowSyncHelper(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, editingGroupId, isAddingNew, showSyncHelper, onClose]);

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
      // Abre WhatsApp Web para buscar el grupo por nombre
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
          const map = new Map<string, WhatsappGroupItem>();
          for (const g of groups) map.set(g.id || g.name, g);
          for (const item of incoming) {
            if (!item.name) continue;
            const id = item.id || `imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            map.set(id, {
              id,
              name: item.name,
              domain: item.domain || detectGroupDomain(item.name),
              inviteUrl: cleanInviteUrl(item.inviteUrl) || item.inviteUrl,
              lastSynced: new Date().toISOString(),
            });
          }
          const finalArr = Array.from(map.values());
          setGroups(finalArr);
          await persistWhatsappGroups(finalArr);
          setStatusMessage(`Se importaron ${incoming.length} grupos.`);
          setTimeout(() => setStatusMessage(null), 3000);
        }
      } catch {
        alert("El archivo no tiene un formato JSON válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const copySyncScript = () => {
    const script = `(async()=>{
  try {
    const chats = [];
    const openReq = indexedDB.open('model-storage');
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction('chat', 'readonly');
      const store = tx.objectStore('chat');
      const req = store.getAll();
      req.onsuccess = async () => {
        const rows = req.result || [];
        for (const c of rows) {
          if (c.id && (c.id.includes('@g.us') || c.isGroup)) {
            chats.push({ id: c.id, name: c.formattedTitle || c.name || 'Grupo sin nombre', unreadCount: c.unreadCount || 0 });
          }
        }
        await fetch('http://localhost:3000/api/whatsapp-directory', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ groups: chats })
        });
        alert('✅ ' + chats.length + ' grupos sincronizados con ANFETA exitosamente!');
      };
    };
  } catch(e) {
    alert('Error al leer grupos: ' + e.message);
  }
})();`;
    navigator.clipboard.writeText(script.trim());
    playCopyChime?.();
    alert("Script copiado al portapapeles. Abre WhatsApp Web, presiona F12 (Consola), pega el código y presiona Enter.");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-4xl h-[88vh] max-h-[820px] bg-[#0B0F17] border border-[#202E42] rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#0F1622] border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#25D366]/15 border border-[#25D366]/40 flex items-center justify-center text-[#25D366] shadow-[0_0_12px_rgba(37,211,102,0.25)]">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Grupos de WhatsApp de Proyectos
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1E293B] border border-slate-700 text-[#38BDF8]">
                  {groups.length} grupos
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Acceso directo a grupos de empresas y clientes sin salir de ANFETA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSyncHelper(!showSyncHelper)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#162232] hover:bg-[#1E3046] border border-[#263A52] text-[#38BDF8] text-xs font-medium cursor-pointer transition-colors"
              title="Sincronizar o conectar con WhatsApp Web"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sincronizar</span>
            </button>
            <button
              onClick={() => setIsAddingNew(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm"
              title="Registrar un nuevo grupo manualmente"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Grupo</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync Helper Drawer (if opened) */}
        {showSyncHelper && (
          <div className="bg-[#0D1826] border-b border-[#254160] px-5 py-3 text-xs text-slate-300 animate-in slide-in-from-top duration-200">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-[#38BDF8]">
                  <Sparkles className="w-4 h-4" />
                  <span>Sincronización segura desde WhatsApp Web (Cero riesgo de ban)</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Para obtener automáticamente todos tus grupos, puedes usar la extensión de ANFETA en tu navegador con WhatsApp Web abierto, o copiar el script rápido de 1 clic:
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={copySyncScript}
                    className="px-3 py-1 rounded bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#4ADE80] font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar script de 1 clic para WhatsApp Web</span>
                  </button>
                  <span className="text-[10px] text-slate-500">
                    (Se ejecuta directamente en tu sesión de WhatsApp Web en el navegador)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowSyncHelper(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
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
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-12 h-12 rounded-full bg-[#162232] flex items-center justify-center text-slate-500 mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">
                {searchQuery ? "No se encontraron grupos que coincidan" : "No hay grupos registrados todavía"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                {searchQuery
                  ? "Prueba buscando por otra palabra o registra el grupo manualmente."
                  : "Pulsa 'Sincronizar' o 'Nuevo Grupo' para agregar los grupos de tus empresas y proyectos."}
              </p>
              {!searchQuery && (
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => setShowSyncHelper(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#4ADE80] text-xs font-semibold"
                  >
                    Ver cómo sincronizar
                  </button>
                  <button
                    onClick={() => setIsAddingNew(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold"
                  >
                    Agregar grupo a mano
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
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        {hasLink ? (
                          <span className="text-[#34D399] flex items-center gap-1 font-mono text-[10px] truncate max-w-xs">
                            <Check className="w-3 h-3 shrink-0" />
                            <span className="truncate">{group.inviteUrl}</span>
                          </span>
                        ) : (
                          <span className="text-amber-400/80 flex items-center gap-1 text-[10.5px]">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>Sin enlace directo guardado</span>
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
                          title={hasLink ? "Abrir directamente en WhatsApp" : "Buscar en WhatsApp Web"}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
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
