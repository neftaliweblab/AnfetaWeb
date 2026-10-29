"use client";
import {runActivityDetailRequest} from '@/lib/activityDetailQueue';
import {dailyChecklist,checklistTotals} from '@/lib/dailyChecklist';
import {ActivityContentPanel} from './ActivityContentPanel';
import {WorkflowStageBadge} from '../WorkflowStageBadge';
import {ActivityWhatsappGroups} from '../ActivityWhatsappGroups';
import {anfetaSync} from '@/lib/anfetaBroadcastSync';
import {ReassignActivityModal} from './ReassignActivityModal';
import {QuickAssigneeSelect} from './QuickAssigneeSelect';
import {ActivityQuickEntry} from './ActivityQuickEntry';
import {requestActivityRecording} from '@/lib/activityRecording';
import {offlineAwareFetch} from '@/services/offlineQueue';

import { calendarDisplayTitle, calendarTime, mexicoDate } from "@/services/calendarPresentation";
import React, { useState, useEffect } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { workflowState } from "@/services/activityWorkflow";
import { openNotionPage } from "@/services/windowsIntegration";
import {notionPageUrl} from '@/lib/notionPageUrl';
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
  embedded?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  currentUser: string;
  onActivityUpdated?: (updates: Partial<NotionCalendarActivity> & { [key: string]: any }) => Promise<boolean | void> | void;
  onChecklistUpdated?: (updates: Partial<NotionCalendarActivity>) => void;
  allActivities?: NotionCalendarActivity[];
  onSelectActivity?: (activity: NotionCalendarActivity) => void;
}

export function CalendarDetailPanel({
  activity,
  embedded = false,
  isSaving = false,
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
  const [showHandoff,setShowHandoff]=useState(false);

  const title = activity.title || (activity as any)?.Title || "Sin título";
  const domain = activity.domain || (activity as any)?.ParsedDomain || "DOMINIO";
  const status = activity.status || (activity as any)?.Status || "Pendiente";
  const person = activity.person || (activity as any)?.Person || "Sin asignar";

  // Limpiar título de prefijos y tecnicismos repetitivos
  const cleanTitle = calendarDisplayTitle(title, domain);
  const editable = canEditActivity(currentUser, activity) && !activity.isHandoffMirror && !isSaving;
  const userCanReview = editable && (activity.reviewFlow?.State==='pending'?normalizePerson(currentUser)===normalizePerson(activity.reviewFlow.ReviewAssignee):isReviewer(currentUser));
  const [ftfBusy,setFtfBusy]=useState(false);
  const ftfSaving=React.useRef(false);

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
  const cumulative=checklistTotals({checklistItems:items});
  const daily=dailyChecklist(items,mexicoDate(activity.start));
  const [showHistory,setShowHistory]=useState(false);
  const checklistTotal = daily.total;
  const checklistDone = daily.done;
  const pct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  useEffect(() => {
    if(activity.isHandoffMirror){setItems((activity.checklistItems||[]) as any);setLoading(false);setChecklistError('');setStatusMessage(activity.handoffNote||'Copia histórica: no se puede editar.');return;}
    const controller = new AbortController();
    setItems([]); setLoading(true); setChecklistError(''); setStatusMessage('');
    let busy = false;
    async function load() {
      if (busy || document.hidden || updating.current) return;
      busy = true;
      try {
        const pageId = activity.isReviewMirror ? activity.pageId.replace(/^review-mirror-/, '') : activity.pageId;
        const data = await runActivityDetailRequest(async()=>{
          const res = await fetch('/api/data', {method:'POST',headers:{'Content-Type':'application/json'}, signal:AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]), body:JSON.stringify({action:'get-checklist',payload:{pageId}})});
          const data = await res.json();
          if (!res.ok || !data.success || !Array.isArray(data.items)) throw new Error(data.error || 'No se pudieron cargar las tareas de Notion.');
          return data;
        },controller.signal);
        if (!controller.signal.aborted && !updating.current) {
          setChecklistError('');
          setItems(data.items);
          const updates={checklistTotal:data.items.length,checklistCompleted:data.items.filter((i: NotionTodoItem) => i.isChecked).length,checklistScanned:true,checklistItems:data.items};onChecklistUpdated?.(updates);anfetaSync.broadcast({type:'ACTIVITY_UPDATED',pageId:activity.pageId,updates});
        }
      } catch (error) {
        if (!controller.signal.aborted) setChecklistError(error instanceof Error ? error.message : 'No se pudieron cargar las tareas.');
      } finally { busy = false; if (!controller.signal.aborted) setLoading(false); }
    }
    load();

    const contentChanged=(event:Event)=>{const id=(event as CustomEvent).detail?.pageId;if(id&&id.replace(/-/g,'')===activity.pageId.replace(/^review-mirror-/,'').replace(/-/g,''))void load();};
    window.addEventListener('anfeta_page_content_changed',contentChanged);
    window.addEventListener('anfeta_data_refreshed',load);


    return () => {controller.abort();window.removeEventListener('anfeta_page_content_changed',contentChanged);window.removeEventListener('anfeta_data_refreshed',load);};
  }, [activity.pageId, activity.isReviewMirror, retry]);

  const updating = React.useRef(false);
  const activePage = React.useRef(activity.pageId);
  activePage.current = activity.pageId;
  useEffect(()=>{if(activity.checklistItems&&!updating.current)setItems(activity.checklistItems);},[activity.checklistItems]);
  const handleToggle = async (item: NotionTodoItem) => {
    if (!editable || updating.current || loading || item.isUpdating) return;
    const pageId = activity.pageId;
    updating.current = true; setChecklistError(''); setStatusMessage('');
    setItems(prev => prev.map(i => i.id === item.id ? {...i,isUpdating:true} : i));
    try {
      const response = await offlineAwareFetch('/api/data',{action:'toggle-checklist',payload:{pageId,blockId:item.blockId || item.id,checked:!item.isChecked,expectedChecked:item.isChecked,currentUser}});
      const data = await response.json();
      if(data.queued){setStatusMessage('Check pendiente guardado localmente. Se confirmará al volver la conexión.');return;}
      if (!response.ok || !data.success) throw new Error(data.error || 'Notion no confirmó el cambio.');
      if (activePage.current !== pageId) return;
      const updated = items.map(i => i.id === item.id ? {...i,isChecked:data.checked,isUpdating:false} : i);
      setItems(updated);
      const completed = updated.filter(i => i.isChecked).length;
      const updates={checklistTotal:updated.length,checklistCompleted:completed,checklistScanned:true,checklistItems:updated,...data.stats};onChecklistUpdated?.(updates);anfetaSync.broadcast({type:'ACTIVITY_UPDATED',confirmed:true,pageId,updates});
      setStatusMessage(data.warning||'Checklist guardado en Notion.');
    } catch (error) { if (activePage.current === pageId) setChecklistError(error instanceof Error ? error.message : 'No se pudo guardar el checklist.'); }
    finally { updating.current = false; if (activePage.current === pageId) setItems(prev => prev.map(i => ({...i,isUpdating:false}))); }
  };

  return (
    <aside
      aria-label="Detalle de actividad"
      className={embedded ? "min-w-0 rounded-lg border border-slate-700 bg-[#101720] p-3 text-slate-200" : "fixed top-14 bottom-0 right-0 w-full max-w-[380px] xl:static xl:w-[380px] shrink-0 shadow-2xl border-l border-[#27272A] bg-[#141416] p-4 flex flex-col justify-between overflow-y-auto select-none z-50 text-slate-200"}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#27272A] pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <WorkflowStageBadge status={activity.status} title={activity.title}/>
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

        {activity.financialFields?.length?<dl className="rounded border border-slate-700 p-2 text-xs">{activity.financialFields.map(field=><div key={field.name} className="flex justify-between gap-2"><dt>{field.name}</dt><dd className={field.value<0?'text-rose-300':'text-emerald-300'}>{field.value.toLocaleString('es-MX')}</dd></div>)}</dl>:null}
        <ActivityWhatsappGroups title={activity.title} currentUser={currentUser}/>
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

        {!embedded && <>
        {/* Metadata Card */}
        <label className={'flex items-start gap-3 rounded-xl border p-3 text-xs '+(activity.ftfVerified?'border-emerald-500/70 bg-emerald-950/40':'border-slate-700 bg-slate-900/40')}>
          <input type="checkbox" aria-label="Pasos FTF verificados para hoy" checked={!!activity.ftfVerified} disabled={!editable||!activity.ftfAvailable||ftfBusy||!onActivityUpdated} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400" onChange={async e=>{if(ftfSaving.current)return;const checked=e.target.checked;ftfSaving.current=true;setFtfBusy(true);try{const saved=await onActivityUpdated?.({ftfVerified:checked,expectedFtfVerified:!!activity.ftfVerified});setStatusMessage(saved===false?'No se confirmó la verificación FTF. Revisa el aviso del calendario.':checked?'Pasos verificados: la actividad ya está entendida.':'Se retiró la verificación FTF.');}catch(error){setStatusMessage(error instanceof Error?error.message:'No se pudo guardar la verificación FTF.');}finally{ftfSaving.current=false;setFtfBusy(false);}}}/>
          <span><span className={'block font-semibold '+(activity.ftfVerified?'text-emerald-300':'text-slate-200')}>{ftfBusy?'Guardando…':'Pasos revisados y actividad entendida'}</span><span className="mt-1 block leading-relaxed text-slate-400">{activity.ftfAvailable?'Activa la franja verde de verificación FTF.':'No se encontró la casilla “Check FTF Pasos Verificados Hoy” en esta página.'}</span></span>
        </label>
        {activity.reviewFlow?.State==='handoff'&&<div className="rounded border border-cyan-900 bg-cyan-950/30 p-2 text-xs"><p>Transferida por {String(activity.reviewFlow.FromPerson||activity.reviewFlow.UpdatedBy||'el equipo')}</p>{!!activity.reviewFlow.Note&&<p className="mt-1 whitespace-pre-wrap break-words">{String(activity.reviewFlow.Note)}</p>}</div>}
        <button type="button" disabled={!editable||(!isDirection(currentUser)&&normalizePerson(currentUser)!==normalizePerson(activity.person))||wf==='completed'||wf==='review'||activity.reviewFlow?.State==='pending'} onClick={()=>setShowHandoff(true)} className="w-full rounded border border-cyan-800 p-2 text-xs text-cyan-200 disabled:opacity-40">Reasignar actividad…</button>
        <a href={'/recording?page='+encodeURIComponent(activity.originalPageId||activity.pageId.replace(/^review-mirror-/,''))} target="_blank" rel="noreferrer" className="block w-full rounded border border-slate-700 p-2 text-center text-xs text-cyan-200 hover:bg-slate-800">▶ Ver grabaciones de esta actividad</a>
        <button type="button" disabled={!editable} onClick={()=>{if(!requestActivityRecording({id:activity.pageId,title:activity.title,type:'actividad',typeLabel:'Actividad'}))setStatusMessage('No se pudo abrir el grabador. Vuelve a abrir ANFETA e intenta de nuevo.');}} className="w-full rounded border border-cyan-800 bg-cyan-950/40 p-2 text-xs text-cyan-200 disabled:opacity-40">● Grabar para esta actividad</button>
        <div className="rounded-lg bg-[#1F1F23] p-3 text-xs space-y-2 border border-[#2B2B30]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              Responsable:
            </span>
            <QuickAssigneeSelect activity={activity} currentUser={currentUser} onConfirm={onActivityUpdated}/>
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
            <span>Enviar a revisión final…</span>
          </button>

          <button
            disabled={!userCanReview}
            onClick={async () => {
              if (await onActivityUpdated?.({ status: "zREVISION" }) !== false) setStatusMessage("Actividad terminada y guardada en Notion.");
            }}
            title={userCanReview ? "Terminar revisión asignada" : "Solo la persona asignada puede resolver esta revisión"}
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
        </>}



        {/* Pestañas: Contenido y Pasos vs Actividades del Proyecto (Dominio) */}
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
              <span>Contenido y pasos ({daily.total})</span>
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

        {/* Tab 1: Vista unificada de Contenido y Pasos de Notion */}
        {activeTab === "checklist" && (
          <div className="space-y-2.5">
            <p className="text-xs text-emerald-300">Marcados en Notion: {loading?'Cargando…':`${cumulative.done} / ${cumulative.total}`}</p>
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151c27] px-3 py-2 text-xs">
              <span className="text-slate-300 font-medium">Pasos verificados de hoy:</span>
              <span className="font-mono font-bold text-emerald-400">
                {loading ? "Cargando…" : `${checklistDone} / ${checklistTotal} (${pct}%)`}
              </span>
            </div>

            <details className="rounded-lg border border-slate-800 bg-[#12161f] p-2 text-xs text-slate-400">
              <summary className="cursor-pointer font-medium text-cyan-300 hover:text-cyan-200">
                + Agregar check o comentario rápido
              </summary>
              <div className="mt-2">
                <ActivityQuickEntry
                  key={activity.pageId}
                  pageId={activity.pageId}
                  disabled={!editable || loading}
                  onChecklistAdded={item => {
                    if (activePage.current === activity.pageId) {
                      setItems(old => [item, ...old]);
                      window.dispatchEvent(new CustomEvent('anfeta_page_content_changed', { detail: { pageId: activity.pageId } }));
                    }
                  }}
                />
              </div>
            </details>

            {checklistError && (
              <div role="alert" className="rounded-lg border border-rose-400/40 bg-rose-950/40 p-2 text-xs text-rose-100 flex items-center justify-between">
                <span>{checklistError}</span>
                <button onClick={() => setRetry(n => n + 1)} className="underline font-semibold text-rose-200">Reintentar</button>
              </div>
            )}

            {!!daily.unknown && (
              <p className="text-xs text-amber-300">
                {daily.unknown} checks completados sin fecha de marcado verificable: se conservan en historial y no se atribuyen a hoy.
              </p>
            )}
            {!!daily.history.length && (
              <p className="text-xs text-slate-400">
                Fuera del avance confirmado de hoy: {daily.history.length} checks ya marcados, de días anteriores o sin fecha verificable.
              </p>
            )}

            {statusMessage && (
              <p className="text-xs text-cyan-200 pt-1">{statusMessage}</p>
            )}

            {/* Vista unificada e interactiva: contenido enriquecido, multimedia y checks de Notion */}
            <ActivityContentPanel
              activity={activity}
              currentUser={currentUser}
              defaultOpen={true}
              onChecklistUpdated={onChecklistUpdated}
            />
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
            openNotionPage(notionPageUrl(activity))
          }
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0C4A6E] hover:bg-[#0284C7] border border-[#38BDF8] py-2 px-3 text-xs font-bold text-[#38BDF8] hover:text-white transition-all shadow-lg shadow-cyan-950/40"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Abrir en Notion Web</span>
        </button>
      </div>

      {/* Modal de selección de integrante para revisión */}
      {showHandoff&&<ReassignActivityModal activity={activity} onClose={()=>setShowHandoff(false)} onConfirm={async updates=>await onActivityUpdated?.(updates)}/>}
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
