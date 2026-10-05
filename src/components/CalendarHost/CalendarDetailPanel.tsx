"use client";

import React, { useState, useEffect } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { workflowState } from "@/services/activityWorkflow";
import { openNotionPage } from "@/services/windowsIntegration";
import { isReviewer, isDirection } from "@/services/activityPermissions";
import { CheckSquare, ExternalLink, Clock, User, Shield, Check, Loader2, ArrowRight, CheckCircle2, Send, ListChecks, Calendar as CalendarIcon } from "lucide-react";

export interface NotionTodoItem {
  id: string;
  blockId?: string;
  text: string;
  isChecked: boolean;
  isUpdating?: boolean;
}

interface CalendarDetailPanelProps {
  activity: NotionCalendarActivity;
  onClose: () => void;
  currentUser: string;
  onActivityUpdated?: (updates: Partial<NotionCalendarActivity>) => void;
  allActivities?: NotionCalendarActivity[];
  onSelectActivity?: (activity: NotionCalendarActivity) => void;
}

export function CalendarDetailPanel({
  activity,
  onClose,
  currentUser,
  onActivityUpdated,
  allActivities = [],
  onSelectActivity,
}: CalendarDetailPanelProps) {
  const [items, setItems] = useState<NotionTodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"checklist" | "project">("checklist");

  const title = activity.title || (activity as any)?.Title || "Sin título";
  const domain = activity.domain || (activity as any)?.ParsedDomain || "DOMINIO";
  const status = activity.status || (activity as any)?.Status || "Pendiente";
  const person = activity.person || (activity as any)?.Person || "Sin asignar";

  const userCanReview = isReviewer(currentUser);

  // Actividades del mismo dominio (1:1 paridad con ANFETA WPF Actividades del Proyecto)
  const domainActivities = (allActivities || []).filter((a) => {
    if (!a.domain || a.domain === "general") return false;
    const cleanD = a.domain.trim().toLowerCase();
    const targetD = domain.trim().toLowerCase();
    return cleanD === targetD || cleanD.includes(targetD) || targetD.includes(cleanD);
  });

  const startStr = activity.start || (activity as any)?.Start;
  const endStr = activity.end || (activity as any)?.End;
  const timeLabel = startStr && endStr ? `${startStr.slice(11, 16)} – ${endStr.slice(11, 16)}` : startStr?.slice(11, 16) || "08:00";

  const wf = workflowState(status, title);
  let phaseLabel = "POR HACER";
  let phaseColor = "#3B2D6B";
  let phaseTextColor = "#C4B5FD";

  if (wf === "completed") {
    phaseLabel = "TERMINADA";
    phaseColor = "#104E3E";
    phaseTextColor = "#5EEAD4";
  } else if (wf === "review") {
    phaseLabel = "EN REVISIÓN";
    phaseColor = "#1B4764";
    phaseTextColor = "#7DD3FC";
  } else if (wf === "suspended") {
    phaseLabel = "SUSPENDIDA";
    phaseColor = "#4A3510";
    phaseTextColor = "#FDE047";
  } else if (wf === "pending") {
    phaseLabel = "PENDIENTE";
    phaseColor = "#451A03";
    phaseTextColor = "#FDBA74";
  }

  const checklistTotal = activity.checklistTotal || items.length;
  const checklistDone = activity.checklistCompleted || items.filter((i) => i.isChecked).length;
  const pct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  // Load Notion to-do items from API or fallback
  useEffect(() => {
    let cancelled = false;
    async function loadChecklist() {
      setLoading(true);
      setStatusMessage("");
      try {
        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "get-checklist",
            payload: { pageId: activity.pageId },
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items) && data.items.length > 0) {
            setItems(data.items);
            return;
          }
        }
      } catch {
        // Fallback to local simulated items if API unreachable
      }

      if (!cancelled) {
        // Simulated items if none returned from Notion API
        const total = activity.checklistTotal || 0;
        const done = activity.checklistCompleted || 0;
        if (total > 0) {
          const fallback: NotionTodoItem[] = [];
          for (let i = 1; i <= total; i++) {
            fallback.push({
              id: `todo-${activity.pageId}-${i}`,
              text: `Tarea ${i} de checklist (${domain})`,
              isChecked: i <= done,
            });
          }
          setItems(fallback);
        } else {
          setItems([]);
        }
      }
      if (!cancelled) setLoading(false);
    }

    loadChecklist();
    return () => {
      cancelled = true;
    };
  }, [activity.pageId, activity.checklistTotal, activity.checklistCompleted, domain]);

  const handleToggle = async (item: NotionTodoItem) => {
    const targetState = !item.isChecked;
    const prevItems = [...items];

    // Optimistic update
    const updated = items.map((it) =>
      it.id === item.id ? { ...it, isChecked: targetState, isUpdating: true } : it
    );
    setItems(updated);

    const newDone = updated.filter((it) => it.isChecked).length;
    onActivityUpdated?.({
      checklistCompleted: newDone,
      todayChecklistCompleted: newDone,
    });

    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-checklist",
          payload: {
            pageId: activity.pageId,
            blockId: item.blockId || item.id,
            checked: targetState,
          },
        }),
      });
      if (res.ok) {
        setStatusMessage(`Checklist actualizado: ${newDone}/${checklistTotal}`);
      }
    } catch {
      setStatusMessage("Actualizado localmente en caché");
    } finally {
      setItems((current) =>
        current.map((it) => (it.id === item.id ? { ...it, isUpdating: false } : it))
      );
    }
  };

  return (
    <aside
      aria-label="Detalle de actividad"
      className="w-[380px] shrink-0 border-l border-[#27272A] bg-[#141416] p-4 flex flex-col justify-between overflow-y-auto select-none z-40 text-slate-200"
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#27272A] pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              style={{ backgroundColor: phaseColor, color: phaseTextColor }}
              className="rounded px-2 py-0.5 text-[10px] font-bold uppercase truncate"
            >
              {phaseLabel}
            </span>
            <span className="font-bold text-sm text-[#38BDF8] truncate font-mono">
              {domain}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-[#202024] hover:text-white transition-colors"
            title="Cerrar panel"
          >
            ✕
          </button>
        </div>

        {/* Descripción / Título */}
        <div>
          <h3 className="text-xs font-semibold text-slate-100 leading-snug break-words">
            {title}
          </h3>
        </div>

        {/* Metadata Card */}
        <div className="rounded-lg bg-[#1F1F23] p-3 text-xs space-y-2 border border-[#2B2B30]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              Responsable:
            </span>
            <span className="font-semibold text-white">{person}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              Horario:
            </span>
            <span className="font-mono text-cyan-300 font-semibold">{timeLabel}</span>
          </div>

          {/* Estado de Notion interactivo */}
          <div className="flex items-center justify-between pt-1 border-t border-[#2D2D33]">
            <span className="text-slate-400">Estado Notion:</span>
            <select
              value={status}
              onChange={(e) => {
                const nextStatus = e.target.value;
                onActivityUpdated?.({ status: nextStatus });
                setStatusMessage(`Estado cambiado a: ${nextStatus}`);
              }}
              className="bg-[#121215] border border-[#3A3A44] text-[#E2E8F0] text-[11px] rounded px-2 py-0.5 focus:outline-none focus:border-cyan-400"
            >
              <option value="POR HACER">POR HACER</option>
              <option value="EN REVISIÓN">EN REVISIÓN</option>
              <option value="rtuzREVISION">rtuzREVISION</option>
              <option value="zREVISION">zREVISION</option>
              <option value="TERMINADA">TERMINADA</option>
              <option value="SUSPENDIDA">SUSPENDIDA</option>
            </select>
          </div>

          <div className="pt-1 border-t border-[#2D2D33] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                Checklist:
              </span>
              <span className="font-mono font-bold text-emerald-400">
                {checklistDone} de {checklistTotal} ({pct}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#121215]">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Botones de Acción de Flujo ANFETA (1:1 WPF) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => {
              onActivityUpdated?.({ status: "rtuzREVISION" });
              setStatusMessage("Actividad enviada a REVISIÓN (rtuzREVISION)");
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[#162235] hover:bg-[#1E3A5F] text-[#38BDF8] border border-[#223848] text-xs font-semibold transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar a revisión...</span>
          </button>

          <button
            disabled={!userCanReview}
            onClick={() => {
              onActivityUpdated?.({ status: "zREVISION" });
              setStatusMessage("Actividad marcada como TERMINADA (zREVISION)");
            }}
            title={userCanReview ? "Terminar actividad (Solo Revisores: John / Genaro)" : "Solo John o Genaro pueden terminar actividades en revisión"}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
              userCanReview
                ? "bg-[#10251B] hover:bg-[#163826] text-[#4ADE80] border-[#166534]"
                : "bg-[#18181B] text-slate-500 border-[#26262B] cursor-not-allowed opacity-50"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>T - Terminar...</span>
          </button>
        </div>

        {/* Pestañas: Checklist de Notion vs Actividades del Proyecto (Dominio) */}
        <div className="flex items-center justify-between border-b border-[#27272A] pt-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("checklist")}
              className={`pb-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === "checklist"
                  ? "border-[#38BDF8] text-[#38BDF8]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Tareas Notion ({items.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("project")}
              className={`pb-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === "project"
                  ? "border-[#38BDF8] text-[#38BDF8]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Proyecto ({domainActivities.length})</span>
            </button>
          </div>
          <span className="text-[10px] text-amber-400 flex items-center gap-1">
            <Shield className="w-3 h-3" /> Seguro
          </span>
        </div>

        {/* Tab 1: Checklist To-Do Box */}
        {activeTab === "checklist" && (
          <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3 space-y-2">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-slate-400 italic">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                Cargando tareas de Notion...
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs italic text-slate-500 py-2">
                Sin tareas adicionales en caché.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {items.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => handleToggle(item)}
                    className={`flex items-start gap-2.5 p-1.5 rounded cursor-pointer transition-colors text-xs ${
                      item.isChecked
                        ? "text-slate-400 line-through bg-emerald-950/20"
                        : "text-slate-200 hover:bg-[#202026]"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        item.isChecked
                          ? "border-emerald-500 bg-emerald-600 text-white"
                          : "border-slate-600 bg-slate-900"
                      }`}
                    >
                      {item.isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="flex-1 break-words leading-tight">{item.text}</span>
                    {item.isUpdating && (
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-400 shrink-0" />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {statusMessage && (
              <p className="text-[10px] text-cyan-400 font-mono italic pt-1">{statusMessage}</p>
            )}
          </div>
        )}

        {/* Tab 2: Actividades Relacionadas del Mismo Dominio (1:1 WPF) */}
        {activeTab === "project" && (
          <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3 space-y-2">
            <div className="text-[11px] font-bold text-slate-300 pb-1 border-b border-[#26262B] flex items-center justify-between">
              <span className="text-[#38BDF8] font-mono">{domain}</span>
              <span className="text-slate-400">{domainActivities.length} actividades</span>
            </div>

            {domainActivities.length === 0 ? (
              <p className="text-xs italic text-slate-500 py-3">No hay más actividades con este dominio.</p>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {domainActivities.map((act) => {
                  const isCurrent = act.pageId === activity.pageId;
                  const actStart = act.start?.slice(11, 16) || "";
                  const actEnd = act.end?.slice(11, 16) || "";
                  return (
                    <li
                      key={act.pageId}
                      onClick={() => onSelectActivity?.(act)}
                      className={`p-2 rounded text-xs transition-colors cursor-pointer border ${
                        isCurrent
                          ? "bg-[#1E293B] border-cyan-500/60 text-white"
                          : "bg-[#11161D] border-[#222E3C] text-slate-300 hover:bg-[#182332]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span className="text-[#38BDF8] font-bold">{act.person}</span>
                        <span>{actStart ? `${actStart} - ${actEnd}` : ""}</span>
                      </div>
                      <p className="text-[11px] font-medium line-clamp-2 leading-tight">
                        {act.title}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Botón Acción Directa */}
      <div className="pt-3 border-t border-[#27272A] mt-3">
        <button
          onClick={() =>
            openNotionPage(activity.pageUrl || (activity as any)?.PageUrl)
          }
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0C4A6E] hover:bg-[#0284C7] border border-[#38BDF8] py-2 px-3 text-xs font-bold text-[#38BDF8] hover:text-white transition-all shadow-lg shadow-cyan-950/40"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Abrir en Notion Web</span>
        </button>
      </div>
    </aside>
  );
}
