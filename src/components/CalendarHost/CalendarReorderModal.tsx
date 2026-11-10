"use client";

import React, { useMemo, useState } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import {
  CALENDAR_REORDER_RULES,
  calculateCalendarReorder,
  ReorderPlanResult,
} from "@/services/calendarReorderEngine";
import { calendarDisplayTitle, calendarTime } from "@/services/calendarPresentation";
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Layers,
  Info,
} from "lucide-react";
import { showCreationResult } from "@/components/CreationFeedback";
import { playCheckChime, sendWindowsNotification } from "@/services/windowsIntegration";
import { anfetaSync } from "@/lib/anfetaBroadcastSync";

interface CalendarReorderModalProps {
  activities: NotionCalendarActivity[];
  date: string;
  currentUser: string;
  initialPerson?: string;
  availablePeople: string[];
  onClose: () => void;
  onSaved?: (updatedActivities: NotionCalendarActivity[]) => void;
}

export function CalendarReorderModal({
  activities,
  date,
  currentUser,
  initialPerson,
  availablePeople,
  onClose,
  onSaved,
}: CalendarReorderModalProps) {
  // Personas disponibles con actividades en la fecha seleccionada
  const peopleWithActivities = useMemo(() => {
    const set = new Set(
      activities
        .filter((a) => !a.isReviewMirror && a.person && a.start?.startsWith(date))
        .map((a) => a.person)
    );
    const list = availablePeople.filter((p) => set.has(p));
    return list.length > 0 ? list : availablePeople;
  }, [activities, date, availablePeople]);

  const [selectedPerson, setSelectedPerson] = useState<string>(
    initialPerson || peopleWithActivities[0] || "Neftali"
  );
  const [showRules, setShowRules] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>("");

  // Calcular propuesta de reordenamiento para la persona seleccionada
  const plan: ReorderPlanResult = useMemo(() => {
    try {
      return calculateCalendarReorder(activities, date, selectedPerson, currentUser);
    } catch (e: any) {
      return {
        proposals: [],
        changes: [],
        fixedCount: 0,
        totalDurationMinutes: 0,
        exceedsRegularCount: 0,
        exceedsMaxCount: 0,
        person: selectedPerson,
        day: date,
        startMinute: 540,
        endMinute: 540,
      };
    }
  }, [activities, date, selectedPerson, currentUser]);

  const handleApplyReorder = async () => {
    if (!plan.changes.length || isSaving) return;
    setIsSaving(true);
    setSaveError("");

    try {
      // Formato para /api/data calendar-batch-schedule
      const payloadChanges = plan.changes.map((item) => ({
        pageId: item.pageId,
        title: item.title,
        expectedTitle: item.expectedTitle,
        expectedStart: item.expectedStart,
        expectedEnd: item.expectedEnd,
        start: item.start,
        end: item.end,
        allowOverlap: true,
      }));

      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          action: "calendar-batch-schedule",
          payload: {
            currentUser,
            changes: payloadChanges,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo completar el reordenamiento en Notion.");
      }

      const results = data.results || [];
      const successful = results.filter((r: any) => r.success).map((r: any) => r.activity);

      if (successful.length > 0) {
        playCheckChime();
        sendWindowsNotification(
          "Jornada Reordenada",
          `Se reorganizaron ${successful.length} actividades para ${selectedPerson} sin empalmes`
        );

        anfetaSync.broadcast({
          type: "ACTIVITY_UPDATED",
          activities: successful,
        });

        // Toast ejecutivo en esquina inferior derecha
        showCreationResult(
          true,
          `Jornada de ${selectedPerson} reordenada`,
          `${successful.length} actividades desempalmadas con prioridad en Notion`
        );

        onSaved?.(successful);
      }

      const failed = results.filter((r: any) => !r.success);
      if (failed.length > 0) {
        setSaveError(
          `Se aplicaron ${successful.length} cambios, pero fallaron ${failed.length}: ${failed[0]?.error}`
        );
      } else {
        onClose();
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Error al reordenar jornada";
      setSaveError(msg);
      showCreationResult(false, "Error al ordenar actividades", msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ordenar actividades"
        className="w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-2xl border border-cyan-700/60 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Cabecera */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border-b border-cyan-800/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚡ Ordenar y Desempalmar Actividades</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-500/40 text-cyan-300">
                  {date}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Acomoda tareas amontonadas aplicando reglas de prioridad, sin empalmes y respetando la línea de tiempo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selector de Colaborador y Controles */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-cyan-300">Colaborador:</label>
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              disabled={isSaving}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none cursor-pointer"
            >
              {peopleWithActivities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">
              Inicio previsto:{" "}
              <strong className="text-cyan-300 font-mono">
                {String(Math.floor(plan.startMinute / 60)).padStart(2, "0")}:
                {String(plan.startMinute % 60).padStart(2, "0")} hrs
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setShowRules(!showRules)}
              className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline cursor-pointer ml-2"
            >
              <Info size={13} />
              <span>{showRules ? "Ocultar reglas" : "Ver reglas definidas"}</span>
              {showRules ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {/* Acordeón de Reglas Definidas */}
        {showRules && (
          <div className="p-3.5 bg-slate-900/70 border-b border-slate-800 text-xs shrink-0 max-h-48 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2 font-semibold text-cyan-300 text-[11.5px]">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Reglas de Ordenamiento Inteligente (Congruencia y Prioridad):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CALENDAR_REORDER_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex flex-col justify-start"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-slate-200 text-[11px]">{rule.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0">
                      {rule.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">{rule.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumen de Métricas */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-slate-300">
              Analizadas: <strong className="text-white">{plan.proposals.length}</strong>
            </span>
            <span className="text-slate-300">
              Cambian horario:{" "}
              <strong className={plan.changes.length > 0 ? "text-cyan-400" : "text-emerald-400"}>
                {plan.changes.length}
              </strong>
            </span>
            <span className="text-slate-300">
              Fijas / Respetadas: <strong className="text-slate-400">{plan.fixedCount}</strong>
            </span>
          </div>

          <div className="text-slate-400 font-mono text-[11px]">
            Carga total: {(plan.totalDurationMinutes / 60).toFixed(1)} hrs
          </div>
        </div>

        {/* Alerta de límite de jornada */}
        {plan.exceedsRegularCount > 0 && (
          <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-800/50 flex items-center gap-2 text-amber-200 text-xs shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Aviso de jornada:</strong> {plan.exceedsRegularCount} actividad(es) superan las 18:00 hrs.
              Terminarán a las {String(Math.floor(plan.endMinute / 60)).padStart(2, "0")}:
              {String(plan.endMinute % 60).padStart(2, "0")} hrs.
            </span>
          </div>
        )}

        {/* Lista de propuestas de actividades */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {plan.proposals.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay actividades pendientes para reordenar en este colaborador y fecha.</p>
            </div>
          ) : (
            plan.proposals.map((item) => (
              <div
                key={item.pageId}
                className={`p-2.5 rounded-xl border transition-all ${
                  item.hasChanged
                    ? "bg-slate-900/90 border-cyan-800/80 shadow-sm"
                    : "bg-slate-950/60 border-slate-800/60 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                        item.priority === "00"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : item.priority === "11"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : item.priority === "22"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {item.priority}
                    </span>
                    <span className="font-semibold text-xs text-white truncate" title={item.title}>
                      {calendarDisplayTitle(item.title)}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {item.durationMinutes} min
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-slate-400">
                      {calendarTime(item.expectedStart)} – {calendarTime(item.expectedEnd)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span
                      className={`font-semibold ${
                        item.hasChanged ? "text-cyan-300 font-bold" : "text-slate-400"
                      }`}
                    >
                      {calendarTime(item.start)} – {calendarTime(item.end)}
                    </span>
                  </div>

                  <div>
                    {item.hasChanged ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-medium">
                        Se ajusta
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-medium">
                        En orden
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Error message */}
        {saveError && (
          <div className="p-3 bg-rose-950/60 border-t border-rose-800 text-rose-300 text-xs shrink-0 flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{saveError}</span>
          </div>
        )}

        {/* Botones de Pie */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-400 hidden sm:block">
            {plan.changes.length > 0
              ? `Se aplicarán ${plan.changes.length} cambios en Notion de forma segura.`
              : "La jornada ya está perfectamente encadenada y ordenada."}
          </p>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSaving || plan.changes.length === 0}
              onClick={handleApplyReorder}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-2 ${
                isSaving || plan.changes.length === 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  : "bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white active:scale-95"
              }`}
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando en Notion...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>
                    {plan.changes.length > 0
                      ? `⚡ Aplicar orden en Notion (${plan.changes.length})`
                      : "Jornada en orden"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
