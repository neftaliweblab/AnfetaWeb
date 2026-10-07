"use client";

import { calendarDisplayTitle, calendarTime } from "@/services/calendarPresentation";
import React, { useState, useEffect } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { workflowState } from "@/services/activityWorkflow";
import { openNotionPage } from "@/services/windowsIntegration";
import { isReviewer, isDirection, canEditActivity } from "@/services/activityPermissions";
import { CheckSquare, ExternalLink, Clock, User, Shield, Check, Loader2, ArrowRight, CheckCircle2, Send, ListChecks, Calendar as CalendarIcon } from "lucide-react";
import { CalendarActivityTools } from './CalendarActivityTools';
import { normalizePerson } from '@/services/identityNormalizer';
import { SendToReviewModal } from "./SendToReviewModal";

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
  onActivityUpdated?: (updates: Partial<NotionCalendarActivity>) => Promise<boolean | void> | void;
  onChecklistUpdated?: (updates: Partial<NotionCalendarActivity>) => void;
  allActivities?: NotionCalendarActivity[];
  onSelectActivity?: (activity: NotionCalendarActivity) => void;
}

export function CalendarDetailPanel({
  activity,
  onClose,
  currentUser,
  onActivityUpdated,
  onChecklistUpdated,
  allActivities = [],
  onSelectActivity,
}: CalendarDetailPanelProps) {
  const [items, setItems] = useState<NotionTodoItem[]>([]);
  const [checklistError, setChecklistError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [projectActivities,setProjectActivities] = useState<NotionCalendarActivity[]>([]);
  const [projectError,setProjectError] = useState('');
  const [projectLoading,setProjectLoading]=useState(false);
  const [activeTab, setActiveTab] = useState<"checklist" | "project">("checklist");
  const [showReviewModal, setShowReviewModal] = useState(false);

  const title = activity.title || (activity as any)?.Title || "Sin título";
  const domain = activity.domain || (activity as any)?.ParsedDomain || "DOMINIO";
  const status = activity.status || (activity as any)?.Status || "Pendiente";
  const person = activity.person || (activity as any)?.Person || "Sin asignar";

  // Limpiar título de prefijos y tecnicismos repetitivos
  const cleanTitle = calendarDisplayTitle(title, domain);
  const editable = canEditActivity(currentUser, activity);
  const userCanReview = isReviewer(currentUser) && editable && (activity.reviewFlow?.State !== 'pending' || normalizePerson(currentUser) === normalizePerson(activity.reviewFlow.ReviewAssignee));

  // Actividades del mismo dominio (1:1 paridad con ANFETA WPF Actividades del Proyecto)
  const domainActivities = (projectActivities.length ? projectActivities : allActivities || []).filter((a) => {
    if (!a.domain || a.domain === "general") return false;
    const cleanD = a.domain.trim().toLowerCase();
    const targetD = domain.trim().toLowerCase();
    return cleanD.replace(/^www\./,'') === targetD.replace(/^www\./,'');
  });

  useEffect(()=>{
    if(activeTab !== 'project' || domain === 'general') return;
    const controller=new AbortController();setProjectLoading(true);setProjectError('');setProjectActivities([]);
    fetch('/api/data?type=calendar-project&domain='+encodeURIComponent(domain),{cache:'no-store',signal:controller.signal}).then(async res=>{const data=await res.json();if(!res.ok)throw new Error(data.error);setProjectActivities(data.activities || []);}).catch(e=>{if(!controller.signal.aborted)setProjectError(e.message);}).finally(()=>{if(!controller.signal.aborted)setProjectLoading(false);});
    return()=>controller.abort();
  },[activeTab,domain]);
  const startStr = activity.start || (activity as any)?.Start;
  const endStr = activity.end || (activity as any)?.End;
  const timeLabel = startStr && endStr ? `${calendarTime(startStr)} – ${calendarTime(endStr)}` : startStr ? calendarTime(startStr) : "08:00";

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

  const checklistTotal = items.length;
  const checklistDone = items.filter((i) => i.isChecked).length;
  const pct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  useEffect(() => {
    const controller = new AbortController();
    setItems([]); setLoading(true); setChecklistError(''); setStatusMessage('');
    let busy = false;
    async function load() {
      if (busy || document.hidden || updating.current) return;
      busy = true;
      try {
        const pageId = activity.isReviewMirror ? activity.pageId.replace(/^review-mirror-/, '') : activity.pageId;
        const res = await fetch('/api/data', {method:'POST',headers:{'Content-Type':'application/json'}, signal:AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]), body:JSON.stringify({action:'get-checklist',payload:{pageId}})});
        const data = await res.json();
        if (!res.ok || !data.success || !Array.isArray(data.items)) throw new Error(data.error || 'No se pudieron cargar las tareas de Notion.');
        if (!controller.signal.aborted && !updating.current) {
          setChecklistError('');
          setItems(data.items);
          onChecklistUpdated?.({checklistTotal:data.items.length,checklistCompleted:data.items.filter((i: NotionTodoItem) => i.isChecked).length,checklistScanned:true});
        }
      } catch (error) {
        if (!controller.signal.aborted) setChecklistError(error instanceof Error ? error.message : 'No se pudieron cargar las tareas.');
      } finally { busy = false; if (!controller.signal.aborted) setLoading(false); }
    }
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => {controller.abort();clearInterval(timer);window.removeEventListener('focus', load);document.removeEventListener('visibilitychange', load);};
  }, [activity.pageId, activity.isReviewMirror, retry]);

  const updating = React.useRef(false);
  const activePage = React.useRef(activity.pageId);
  activePage.current = activity.pageId;
  const handleToggle = async (item: NotionTodoItem) => {
    if (!editable || updating.current || loading || item.isUpdating) return;
    const pageId = activity.pageId;
    updating.current = true; setChecklistError(''); setStatusMessage('');
    setItems(prev => prev.map(i => i.id === item.id ? {...i,isUpdating:true} : i));
    try {
      const response = await fetch('/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(60000),
        body:JSON.stringify({action:'toggle-checklist',payload:{pageId,blockId:item.blockId || item.id,checked:!item.isChecked,expectedChecked:item.isChecked,currentUser}}) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Notion no confirmó el cambio.');
      if (activePage.current !== pageId) return;
      const updated = items.map(i => i.id === item.id ? {...i,isChecked:data.checked,isUpdating:false} : i);
      setItems(updated);
      const completed = updated.filter(i => i.isChecked).length;
      onChecklistUpdated?.({checklistTotal:updated.length,checklistCompleted:completed,checklistScanned:true,...data.stats});
      setStatusMessage(data.warning||'Checklist guardado en Notion.');
    } catch (error) { if (activePage.current === pageId) setChecklistError(error instanceof Error ? error.message : 'No se pudo guardar el checklist.'); }
    finally { updating.current = false; if (activePage.current === pageId) setItems(prev => prev.map(i => ({...i,isUpdating:false}))); }
  };

  return (
    <aside
      aria-label="Detalle de actividad"
      className="fixed top-14 bottom-0 right-0 w-full max-w-[380px] xl:static xl:w-[380px] shrink-0 shadow-2xl border-l border-[#27272A] bg-[#141416] p-4 flex flex-col justify-between overflow-y-auto select-none z-50 text-slate-200"
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

        {/* Descripción / Título Limpio */}
        <div>
          <h3 className="text-xs font-semibold text-slate-100 leading-snug break-words">
            {cleanTitle}
          </h3>
          {cleanTitle !== title && (
            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1 truncate font-mono">
              {title}
            </p>
          )}
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
              disabled={!editable}
              value={status}
              onChange={async (e) => {
                const nextStatus = e.target.value;
                if (workflowState(nextStatus) === "review") { setShowReviewModal(true); return; }
                if (await onActivityUpdated?.({status:nextStatus}) !== false) setStatusMessage(`Estado guardado: ${nextStatus}`);
              }}
              className="bg-[#121215] border border-[#3A3A44] text-[#E2E8F0] text-[11px] rounded px-2 py-0.5 focus:outline-none focus:border-cyan-400"
            >
              {!["POR HACER","EN REVISIÓN","rtuzREVISION","zREVISION","TERMINADA","SUSPENDIDA"].includes(status) && <option value={status}>{status}</option>}
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
            disabled={!editable}
            onClick={() => setShowReviewModal(true)}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[#162235] hover:bg-[#1E3A5F] text-[#38BDF8] border border-[#223848] text-xs font-semibold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar a revisión...</span>
          </button>

          <button
            disabled={!userCanReview}
            onClick={async () => {
              if (await onActivityUpdated?.({ status: "zREVISION" }) !== false) setStatusMessage("Actividad terminada y guardada en Notion.");
            }}
            title={userCanReview ? "Terminar actividad (Revisores: John / Isaías / Genaro)" : "Solo John, Isaías o Genaro pueden terminar actividades en revisión"}
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

        {onActivityUpdated && <CalendarActivityTools activity={activity} currentUser={currentUser} onSave={onActivityUpdated} />}
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
            {checklistError && <div role="alert" className="rounded-lg border border-rose-400/40 bg-rose-950/40 p-3 text-sm text-rose-100"><p>{checklistError}</p><button onClick={() => setRetry(n => n + 1)} className="mt-2 underline font-semibold">Volver a cargar</button></div>}
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-slate-400 italic">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                Cargando tareas de Notion...
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs italic text-slate-500 py-2">
                Esta actividad no contiene tareas de checklist.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {items.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => handleToggle(item)}
                    role="checkbox" aria-checked={item.isChecked} aria-disabled={!editable || item.isUpdating}
                    tabIndex={editable ? 0 : -1}
                    onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); handleToggle(item); } }}
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
              <p className="text-xs text-cyan-200 pt-1">{statusMessage}</p>
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
                {projectLoading && <p className="text-xs text-slate-400">Cargando historial del proyecto…</p>}
              {projectError && <p role="alert" className="text-xs text-rose-300">{projectError}</p>}
              {domainActivities.map((act) => {
                  const isCurrent = act.pageId === activity.pageId;
                  const actStart = act.start ? calendarTime(act.start) : "";
                  const actEnd = act.end ? calendarTime(act.end) : "";
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

      {/* Modal de selección de Revisor (John, Isaías, Genaro) */}
      {showReviewModal && (
        <SendToReviewModal
          activity={activity}
          currentUser={currentUser}
          onClose={() => setShowReviewModal(false)}
          onConfirm={async (targetReviewer, leaveVisualCopy) => {
            const saved = await onActivityUpdated?.({
              status: "rtuzREVISION",
              reviewer: targetReviewer,
              leaveVisualCopy,
            } as any);
            if (saved === false) return false;
            setShowReviewModal(false);
            setStatusMessage(`Actividad enviada a REVISIÓN para ${targetReviewer}`);
          }}
        />
      )}
    </aside>
  );
}
