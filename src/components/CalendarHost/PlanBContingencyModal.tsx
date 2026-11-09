"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ShieldAlert,
  ExternalLink,
  Calendar,
  Clock,
  WifiOff,
  ServerCrash,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { PERSON_METADATA, normalizePerson } from "@/services/identityNormalizer";
import { openNotionPage } from "@/services/windowsIntegration";

interface PlanBContingencyModalProps {
  currentUser: string;
  onClose: () => void;
  lastSyncTime?: number | string | null;
  cachedActivitiesCount?: number;
  outageReason?: "offline" | "api_error" | "hosting_outage" | "manual";
}

export function PlanBContingencyModal({
  currentUser,
  onClose,
  lastSyncTime,
  cachedActivitiesCount = 0,
  outageReason = "manual",
}: PlanBContingencyModalProps) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Calcular antigüedad del respaldo local
  const syncTimestamp = lastSyncTime
    ? typeof lastSyncTime === "number"
      ? lastSyncTime
      : Date.parse(lastSyncTime)
    : null;

  const dataAgeText = syncTimestamp
    ? formatDataAge(Date.now() - syncTimestamp)
    : "Sin sincronización previa en este dispositivo";

  const isNewDeviceWithoutCache = !syncTimestamp && cachedActivitiesCount === 0;

  // Filtrar integrantes con enlaces confirmados a Notion
  const teamMembersWithNotion = Object.entries(PERSON_METADATA)
    .filter(([name, meta]) => name !== "Sin asignar" && meta.notionUrl)
    .map(([name, meta]) => ({
      name,
      role: meta.role || "Integrante del equipo",
      color: meta.color,
      avatar: meta.avatar,
      notionUrl: meta.notionUrl!,
    }));

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[500] grid place-items-center bg-[#020609]/85 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="contingency-plan-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-600/40 bg-[#0c141e] text-slate-200 shadow-[0_24px_100px_#000a] outline-none"
      >
        {/* Encabezado */}
        <header className="flex items-center justify-between border-b border-amber-500/20 bg-gradient-to-r from-amber-950/40 to-transparent px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <ShieldAlert size={22} />
            </span>
            <div>
              <h2 id="contingency-plan-title" className="text-base font-bold text-white flex items-center gap-2">
                Plan B de ANFETA · Contingencia
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-500/30 uppercase">
                  Solo Lectura
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Directorio independiente y respaldo local protegido
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        {/* Cuerpo scrollable */}
        <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6 space-y-4">
          {/* Diagnóstico del estado del sistema */}
          <div className="rounded-xl border border-slate-700/60 bg-[#111c29] p-3.5 space-y-2">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <ServerCrash size={14} className="text-cyan-400" />
              Estado de los Canales y Respaldo
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 rounded-lg bg-[#0e1722] p-2 border border-slate-800">
                {isOnline ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                ) : (
                  <WifiOff size={16} className="text-rose-400 shrink-0" />
                )}
                <span>
                  Conexión local:{" "}
                  <strong className={isOnline ? "text-emerald-300" : "text-rose-300"}>
                    {isOnline ? "En línea" : "Desconectado"}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-[#0e1722] p-2 border border-slate-800">
                <Clock size={16} className="text-amber-400 shrink-0" />
                <span className="truncate">
                  Última sincronización:{" "}
                  <strong className="text-slate-200">{dataAgeText}</strong>
                </span>
              </div>
            </div>

            {/* Aviso de bloqueo de escritura */}
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-600/40 bg-amber-950/20 p-2.5 text-xs text-amber-200">
              <Lock size={15} className="mt-0.5 shrink-0 text-amber-400" />
              <div>
                <strong>Acciones de escritura deshabilitadas:</strong> En modo contingencia, para evitar sobrescrituras accidentales o pérdida de datos, las modificaciones en la agenda de ANFETA quedan temporalmente bloqueadas hasta restablecer la conexión confirmada.
              </div>
            </div>

            {isNewDeviceWithoutCache && (
              <div className="flex items-start gap-2.5 rounded-lg border border-sky-600/40 bg-sky-950/20 p-2.5 text-xs text-sky-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-sky-400" />
                <div>
                  <strong>Dispositivo nuevo sin copia previa:</strong> Este equipo aún no tiene una copia en caché. Utiliza los enlaces directos a Notion a continuación para acceder a tu calendario en tiempo real sin depender del servidor de ANFETA.
                </div>
              </div>
            )}
          </div>

          {/* Directorio de Calendarios en Notion */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Calendar size={14} className="text-cyan-400" />
                Calendarios Directos de Notion (Acceso Independiente)
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {teamMembersWithNotion.length} accesos verificados
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {teamMembersWithNotion.map((member) => {
                const isCurrentUser = normalizePerson(member.name) === normalizePerson(currentUser);
                return (
                  <div
                    key={member.name}
                    className={`flex items-center justify-between rounded-xl border p-3 transition ${
                      isCurrentUser
                        ? "border-cyan-400/80 bg-cyan-950/20 ring-1 ring-cyan-400/30"
                        : "border-slate-700/60 bg-[#101b27] hover:border-slate-500 hover:bg-[#142332]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        style={{
                          color: member.color,
                          backgroundColor: `${member.color}18`,
                          borderColor: `${member.color}55`,
                        }}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold"
                      >
                        {member.avatar}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {member.name}
                          {isCurrentUser && (
                            <span className="ml-1.5 rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan-300 border border-cyan-500/30">
                              Tú
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">
                          {member.role}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openNotionPage(member.notionUrl)}
                      className="ml-2 flex items-center gap-1 rounded-lg border border-cyan-700/60 bg-cyan-950/40 px-2.5 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/60 hover:text-white shrink-0 transition"
                      title={`Abrir calendario Notion de ${member.name} en ventana independiente`}
                    >
                      <ExternalLink size={12} />
                      <span>Abrir</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pie de modal */}
        <footer className="flex items-center justify-between border-t border-white/10 bg-[#0a121c] px-5 py-3 sm:px-6">
          <span className="text-[11px] text-slate-500">
            Usuario activo: <strong className="text-slate-300">{currentUser || "Sin identificar"}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Entendido / Cerrar
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

function formatDataAge(ms: number): string {
  if (ms < 0) return "Sincronizado recientemente";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "Hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days > 1 ? "s" : ""}`;
}
