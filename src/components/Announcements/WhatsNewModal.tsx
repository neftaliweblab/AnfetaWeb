"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, X, Check, Clock, ExternalLink } from "lucide-react";
import { normalizePerson } from "@/services/identityNormalizer";

export interface AnnouncementPayload {
  id?: string;
  title?: string;
  version?: string;
  date?: string;
  image?: string;
  changes?: string[];
  author?: string;
  seenBy?: Record<string, string>;
  active?: boolean;
}

interface WhatsNewModalProps {
  currentUser: string;
  previewData?: AnnouncementPayload | null;
  onClosePreview?: () => void;
}

export function WhatsNewModal({
  currentUser,
  previewData,
  onClosePreview,
}: WhatsNewModalProps) {
  const [announcement, setAnnouncement] = useState<AnnouncementPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  const isPreview = Boolean(previewData);

  useEffect(() => {
    if (previewData) {
      setAnnouncement(previewData);
      setIsOpen(true);
      return;
    }

    if (!currentUser) return;
    const checkAnnouncement = async () => {
      try {
        const res = await fetch(`/api/announcements?currentUser=${encodeURIComponent(currentUser)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!data.success || !data.announcement || !data.announcement.active) {
          return;
        }

        const item = data.announcement;
        const canonical = normalizePerson(currentUser);

        // 1. Check if already marked seen in server data
        if (item.seenBy && item.seenBy[canonical]) {
          return;
        }

        // 2. Check if marked seen in local storage
        if (localStorage.getItem(`anfeta_seen_update_${item.id}`)) {
          return;
        }

        // 3. Check snooze
        const snoozeUntil = Number(localStorage.getItem(`anfeta_snooze_update_${item.id}`) || 0);
        if (snoozeUntil > Date.now()) {
          return;
        }

        setAnnouncement(item);
        setIsOpen(true);
      } catch (e) {
        console.warn("[WhatsNewModal] No se pudieron cargar las novedades:", e);
      }
    };

    void checkAnnouncement();
    window.addEventListener("anfeta_announcement_published", checkAnnouncement);
    return () => {
      window.removeEventListener("anfeta_announcement_published", checkAnnouncement);
    };
  }, [currentUser, previewData]);

  const handleMarkUnderstood = async () => {
    if (isPreview) {
      onClosePreview?.();
      setIsOpen(false);
      return;
    }

    if (!announcement?.id) return;
    setMarking(true);

    try {
      localStorage.setItem(`anfeta_seen_update_${announcement.id}`, "1");
      await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark-seen",
          id: announcement.id,
          person: currentUser,
        }),
      });
    } catch (e) {
      console.warn("[WhatsNewModal] Error al confirmar lectura en backend:", e);
    } finally {
      setMarking(false);
      setIsOpen(false);
    }
  };

  const handleSnooze = (hours = 4) => {
    if (isPreview) {
      onClosePreview?.();
      setIsOpen(false);
      return;
    }
    if (announcement?.id) {
      const snoozeMs = hours * 3600 * 1000;
      localStorage.setItem(`anfeta_snooze_update_${announcement.id}`, String(Date.now() + snoozeMs));
    }
    setIsOpen(false);
  };

  if (!isOpen || !announcement) return null;

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-[#0F1726] to-[#0A0E17] text-slate-200 shadow-2xl shadow-cyan-950/40 overflow-hidden">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between border-b border-cyan-900/50 bg-gradient-to-r from-cyan-950/40 via-sky-950/20 to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {isPreview ? "Vista previa · Novedades" : "Novedades en ANFETA"}
            </span>
            {announcement.version && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-700/80 text-cyan-200">
                {announcement.version}
              </span>
            )}
          </div>
          <button
            onClick={() => handleSnooze(2)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar y recordar después"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            {announcement.date && (
              <p className="text-[11px] font-semibold text-slate-400 mb-1">
                {announcement.date}
              </p>
            )}
            <h2 className="text-lg font-black tracking-tight text-white leading-snug">
              {announcement.title || "Nueva actualización"}
            </h2>
          </div>

          {/* Illustrative Image (if provided) */}
          {announcement.image && (
            <div className="rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-inner max-h-60 flex items-center justify-center">
              <img
                src={announcement.image}
                alt={announcement.title}
                className="w-full h-full object-contain max-h-60"
              />
            </div>
          )}

          {/* List of changes */}
          {announcement.changes && announcement.changes.length > 0 && (
            <div className="space-y-2 pt-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">
                ¿Qué hay de nuevo?
              </h3>
              <div className="space-y-2">
                {announcement.changes.map((item, idx) => {
                  let badge = null;
                  let text = item;

                  if (item.startsWith("+") || item.toLowerCase().includes("nuevo") || item.toLowerCase().includes("agreg")) {
                    badge = <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">NUEVO</span>;
                    text = item.replace(/^[+\s]+/, "");
                  } else if (item.startsWith("-") || item.toLowerCase().includes("correg") || item.toLowerCase().includes("fix")) {
                    badge = <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-950/80 text-sky-300 border border-sky-800">CORRECCIÓN</span>;
                    text = item.replace(/^[-–\s]+/, "");
                  } else if (item.startsWith("*") || item.toLowerCase().includes("mejora") || item.toLowerCase().includes("optim")) {
                    badge = <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">MEJORA</span>;
                    text = item.replace(/^[*•\s]+/, "");
                  }

                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 text-xs text-slate-200"
                    >
                      {badge}
                      <span className="leading-relaxed flex-1">{text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-[#0C121A] px-5 py-3.5">
          {!isPreview ? (
            <button
              type="button"
              onClick={() => handleSnooze(4)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 py-1.5 px-2 rounded hover:bg-slate-800/60 transition-colors"
              title="Volver a mostrar en 4 horas"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recordarme en 4h</span>
            </button>
          ) : (
            <span className="text-[11px] text-amber-400 font-medium">Modo de vista previa</span>
          )}

          <button
            type="button"
            disabled={marking}
            onClick={handleMarkUnderstood}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer ml-auto"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{marking ? "Guardando…" : isPreview ? "Cerrar prueba" : "¡Entendido!"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
