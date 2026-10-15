"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Sparkles, Image as ImageIcon, CheckCircle, Clock, Trash2, Eye, Send, AlertCircle } from "lucide-react";
import { normalizePerson } from "@/services/identityNormalizer";

interface TeamPerson {
  name: string;
  avatar: string;
  color: string;
  role: string;
}

interface AnnouncementData {
  id: string;
  title: string;
  version: string;
  date: string;
  image?: string;
  changes: string[];
  author: string;
  createdAt: string;
  seenBy: Record<string, string>;
  active: boolean;
}

interface PublishAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
  onPreview?: (announcement: Partial<AnnouncementData>) => void;
}

export function PublishAnnouncementModal({
  isOpen,
  onClose,
  currentUser,
  onPreview,
}: PublishAnnouncementModalProps) {
  const [tab, setTab] = useState<"stats" | "compose">("stats");
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementData | null>(null);
  const [allPeople, setAllPeople] = useState<TeamPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [changesText, setChangesText] = useState("");
  const [publishing, setPublishing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user is Neftali
  const isNeftali = normalizePerson(currentUser) === "Neftali";

  const fetchAnnouncement = async () => {
    if (!isNeftali) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/announcements?currentUser=${encodeURIComponent(currentUser)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) {
        setActiveAnnouncement(data.announcement || null);
        setAllPeople(data.allPeople || []);
        if (!data.announcement?.active) {
          setTab("compose");
        } else {
          setTab("stats");
        }
      } else {
        setError(data.error || "No se pudo cargar la información.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isNeftali) {
      void fetchAnnouncement();
      // Set default date & version
      const now = new Date();
      setDateStr(
        now.toLocaleDateString("es-MX", {
          timeZone: "America/Mexico_City",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      );
      setVersion(`v2.${now.getMonth() + 1}.${now.getDate()}`);
    }
  }, [isOpen, isNeftali, currentUser]);

  // Handle paste image from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      // Resize image using canvas to avoid huge base64 payloads
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 1000;
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const resized = canvas.toDataURL("image/jpeg", 0.85);
          setImageUrl(resized);
        } else {
          setImageUrl(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Por favor escribe un título para la actualización.");
      return;
    }
    const changes = changesText
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    if (!changes.length) {
      setError("Agrega al menos un cambio o punto en la lista.");
      return;
    }

    setPublishing(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          currentUser,
          title: title.trim(),
          version: version.trim(),
          date: dateStr.trim(),
          image: imageUrl.trim(),
          changes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo publicar la novedad.");
      }

      setSuccessMsg("¡Novedad publicada con éxito! Ya le aparecerá a todo el equipo.");
      setActiveAnnouncement(data.announcement);
      setTab("stats");
      // Notify current window and other tabs
      window.dispatchEvent(new Event("anfeta_announcement_published"));
      try {
        localStorage.setItem("anfeta_announcement_ping", String(Date.now()));
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("¿Deseas ocultar esta actualización para que no vuelva a salirle a nadie?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", currentUser }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Actualización desactivada.");
        window.dispatchEvent(new Event("anfeta_announcement_published"));
        try {
          localStorage.setItem("anfeta_announcement_ping", String(Date.now()));
        } catch {}
        await fetchAnnouncement();
      } else {
        setError(data.error || "No se pudo desactivar.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al desactivar.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPreview = () => {
    const changes = changesText
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    onPreview?.({
      title: title || "Título de la actualización de prueba",
      version: version || "v2.x.x",
      date: dateStr || "Hoy",
      image: imageUrl,
      changes: changes.length ? changes : ["Ejemplo de nueva función agregada", "Ejemplo de corrección realizada"],
      author: "Neftali",
    });
  };

  if (!isOpen || !isNeftali) return null;

  // Calculate seen statistics
  const seenMap = activeAnnouncement?.seenBy || {};
  const seenPeople = allPeople.filter((p) => seenMap[p.name]);
  const pendingPeople = allPeople.filter((p) => !seenMap[p.name]);
  const totalCount = allPeople.length || 1;
  const seenCount = seenPeople.length;
  const percent = Math.round((seenCount / totalCount) * 100);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        onPaste={handlePaste}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-cyan-800/80 bg-[#0C121A] text-slate-200 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-900/60 bg-[#0F1724] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Panel de Novedades y Avisos
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
                  Solo Neftali
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Publica avisos que aparecerán a todos los colaboradores al entrar a ANFETA.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-[#0A0E15] px-5 text-xs">
          <button
            type="button"
            onClick={() => setTab("stats")}
            className={`py-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "stats"
                ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Novedad activa & Quién la vio</span>
            {activeAnnouncement?.active && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-900/70 text-cyan-200 border border-cyan-700">
                {seenCount}/{totalCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("compose")}
            className={`py-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "compose"
                ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Redactar / Publicar nueva</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === "stats" && (
            <div className="space-y-4">
              {activeAnnouncement?.active ? (
                <>
                  {/* Current Active Announcement Card */}
                  <div className="p-4 rounded-xl border border-cyan-900/70 bg-gradient-to-br from-cyan-950/25 to-slate-900/60 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] text-cyan-300 font-medium mb-1">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                            {activeAnnouncement.version}
                          </span>
                          <span>·</span>
                          <span className="text-slate-400">{activeAnnouncement.date}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-100">
                          {activeAnnouncement.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeactivate}
                        disabled={loading}
                        className="px-2.5 py-1 text-[11px] rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Desactivar aviso</span>
                      </button>
                    </div>

                    {activeAnnouncement.image && (
                      <div className="rounded-lg overflow-hidden border border-slate-800 max-h-40">
                        <img
                          src={activeAnnouncement.image}
                          alt="Previsualización"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <ul className="space-y-1 text-xs text-slate-300">
                      {activeAnnouncement.changes.map((change, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-cyan-400 font-bold">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Reading Status Breakdown */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-[#0F1622] space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Progreso de lectura del equipo</span>
                      </h4>
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {seenCount} de {totalCount} ({percent}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Team Members List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {allPeople.map((person) => {
                        const seenAt = seenMap[person.name];
                        return (
                          <div
                            key={person.name}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                              seenAt
                                ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-200"
                                : "border-slate-800 bg-slate-900/40 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white"
                                style={{ backgroundColor: person.color }}
                              >
                                {person.avatar}
                              </span>
                              <span className="font-medium text-slate-200">{person.name}</span>
                            </div>

                            {seenAt ? (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                                <CheckCircle className="w-3 h-3" />
                                <span>
                                  {new Date(seenAt).toLocaleTimeString("es-MX", {
                                    timeZone: "America/Mexico_City",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">
                                Pendiente
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 space-y-3">
                  <p className="text-sm text-slate-400">
                    No hay ninguna actualización activa en este momento.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("compose")}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors"
                  >
                    Redactar una nueva actualización
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "compose" && (
            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Título de la actualización *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Enlaces directos en Revisiones y nueva grabación"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Versión / Tag
                  </label>
                  <input
                    type="text"
                    placeholder="v2.4.1"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fecha visible
                  </label>
                  <input
                    type="text"
                    placeholder="15 de octubre de 2026"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Image upload / paste */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Imagen o captura ilustrativa (Opcional)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative cursor-pointer rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-slate-900/50 p-4 text-center transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processImageFile(file);
                    }}
                  />

                  {imageUrl ? (
                    <div className="relative inline-block">
                      <img
                        src={imageUrl}
                        alt="Previsualización"
                        className="max-h-48 rounded-lg object-contain shadow-md mx-auto"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageUrl("");
                        }}
                        className="absolute -top-2 -right-2 p-1.5 rounded-full bg-rose-600 text-white shadow-lg hover:bg-rose-500 transition-colors"
                        title="Quitar imagen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 py-3">
                      <ImageIcon className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                      <p className="text-xs font-medium text-slate-300">
                        Haz clic para subir imagen o <strong className="text-cyan-300">pega con Ctrl+V</strong>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Capturas de pantalla o diagramas (se optimizan automáticamente)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Changes Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Puntos y cambios explicados *
                </label>
                <p className="text-[10px] text-slate-400 mb-1.5">
                  Escribe un cambio por línea. Usa <strong>+</strong> para nuevo, <strong>-</strong> para corrección, o <strong>*</strong> para mejora.
                </p>
                <textarea
                  required
                  rows={5}
                  placeholder={`+ Nuevo acceso directo a la actividad original en Notion y Calendario\n+ Grabación de pantalla vinculada directamente a la actividad\n- Corregida la reprogramación para proteger actividades terminadas`}
                  value={changesText}
                  onChange={(e) => setChangesText(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Probar vista previa</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 rounded-lg text-slate-400 hover:text-white text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={publishing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/30 disabled:opacity-50 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{publishing ? "Publicando…" : "Publicar para todos"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
