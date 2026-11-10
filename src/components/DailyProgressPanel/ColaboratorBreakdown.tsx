"use client";
import React, { useState, useMemo } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { dailyActivityChecks } from "@/lib/dailyChecklist";
import { calendarDisplayTitle } from "@/services/calendarPresentation";
import { evaluateLagStatus, getForecastStatus } from "@/services/progressKpis";
import { normalizePerson, getPersonColor } from "@/services/identityNormalizer";
import { workflowState } from "@/services/activityWorkflow";
import {
  CheckSquare,
  AlertTriangle,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Square,
  Users,
  List,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Globe,
} from "lucide-react";
import { openNotionPage } from "@/services/windowsIntegration";
import { formatSmartDate } from "@/lib/dateUtils";

interface ColaboratorBreakdownProps {
  activities: NotionCalendarActivity[];
}

type StatusFilter = "all" | "lagging" | "inProgress" | "completed";
type ViewMode = "byPerson" | "flatList";

export function ColaboratorBreakdown({ activities }: ColaboratorBreakdownProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("byPerson");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedPeople, setCollapsedPeople] = useState<Set<string>>(new Set());
  const [expandedActIds, setExpandedActIds] = useState<Set<string>>(new Set());
  const [liveChecks, setLiveChecks] = useState<Record<string, any[]>>({});
  const [loadingChecks, setLoadingChecks] = useState<Record<string, boolean>>({});

  // Desplegar o colapsar grupo de un colaborador
  const togglePersonCollapse = (personName: string) => {
    setCollapsedPeople((prev) => {
      const next = new Set(prev);
      if (next.has(personName)) next.delete(personName);
      else next.add(personName);
      return next;
    });
  };

  const collapseAll = () => {
    const allPeople = new Set(activities.map((a) => normalizePerson(a.person)));
    setCollapsedPeople(allPeople);
  };

  const expandAll = () => {
    setCollapsedPeople(new Set());
  };

  // Desplegar checklist interno de una actividad bajo demanda
  const toggleExpand = async (pageId: string) => {
    const isExpanding = !expandedActIds.has(pageId);
    setExpandedActIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });

    if (isExpanding && !liveChecks[pageId]) {
      setLoadingChecks((prev) => ({ ...prev, [pageId]: true }));
      try {
        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-checklist", payload: { pageId } }),
        });
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          setLiveChecks((prev) => ({ ...prev, [pageId]: data.items }));
        }
      } catch {
        // Red tolerante
      } finally {
        setLoadingChecks((prev) => ({ ...prev, [pageId]: false }));
      }
    }
  };

  // Cálculo de conteos globales para los tabs
  const counts = useMemo(() => {
    let lagging = 0;
    let completed = 0;
    let inProgress = 0;

    for (const act of activities) {
      const lag = evaluateLagStatus(act);
      const wf = workflowState(act.status, act.title);
      if (lag.isLagging) lagging++;
      if (wf === "completed" || act.isFinalized) completed++;
      else inProgress++;
    }

    return { all: activities.length, lagging, inProgress, completed };
  }, [activities]);

  // Filtrado por estado y búsqueda de texto
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const lag = evaluateLagStatus(act);
      const wf = workflowState(act.status, act.title);
      const isComp = wf === "completed" || act.isFinalized;

      if (statusFilter === "lagging" && !lag.isLagging) return false;
      if (statusFilter === "completed" && !isComp) return false;
      if (statusFilter === "inProgress" && (isComp || lag.isLagging)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullTitle = (act.title || "").toLowerCase();
        const short = (act.shortTitle || "").toLowerCase();
        const dom = (act.domain || "").toLowerCase();
        const person = normalizePerson(act.person).toLowerCase();
        if (!fullTitle.includes(q) && !short.includes(q) && !dom.includes(q) && !person.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [activities, statusFilter, searchQuery]);

  // Agrupación por persona
  const peopleGroups = useMemo(() => {
    const map = new Map<string, NotionCalendarActivity[]>();
    for (const act of filteredActivities) {
      const person = normalizePerson(act.person);
      if (!map.has(person)) map.set(person, []);
      map.get(person)!.push(act);
    }
    // Ordenar alfabéticamente
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredActivities]);

  const getForecastBadge = (forecast: string) => {
    if (forecast === "Terminada según avance actual") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm">
          <CheckCircle className="w-2.5 h-2.5" />
          <span>Terminada</span>
        </span>
      );
    }
    if (forecast === "Sí puede terminar hoy dentro de su horario") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-500/40 font-semibold shadow-sm">
          <Clock className="w-2.5 h-2.5" />
          <span>A tiempo</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-500/50 font-bold shadow-sm">
        <AlertCircle className="w-2.5 h-2.5" />
        <span>En riesgo hoy</span>
      </span>
    );
  };

  // Renderizador individual de tarjeta de actividad
  const renderActivityCard = (act: NotionCalendarActivity) => {
    const daily = dailyActivityChecks(act);
    const lagStatus = evaluateLagStatus(act);
    const forecast = getForecastStatus(act);
    const person = normalizePerson(act.person);
    const color = getPersonColor(person);
    const isExpanded = expandedActIds.has(act.pageId);
    const wf = workflowState(act.status, act.title);
    const isCompleted = wf === "completed" || act.isFinalized;
    const isReview = wf === "review";
    const cleanName = calendarDisplayTitle(act.title, act.domain) || act.shortTitle || act.title;

    const pct =
      daily.total > 0
        ? Math.round((daily.done / daily.total) * 100)
        : act.isFinalized
        ? 100
        : 0;

    const hasCheckDetails = act.completedChecks && act.completedChecks.length > 0;

    return (
      <div
        key={act.pageId}
        className={`rounded-xl border transition-all duration-200 overflow-hidden ${
          lagStatus.isLagging
            ? "bg-[#180E13] border-rose-600/50 shadow-[0_0_15px_rgba(244,63,94,0.12)] hover:border-rose-500"
            : isCompleted
            ? "bg-[#0A120E]/60 border-emerald-950/40 hover:border-emerald-800/60 opacity-80 hover:opacity-100"
            : isReview
            ? "bg-[#0E1724] border-cyan-800/50 hover:border-cyan-600/70"
            : "bg-[#0D131C] border-[#1C2938] hover:border-[#2D3E52]"
        }`}
      >
        <div className="p-3.5 space-y-2.5">
          {/* Top Line: Tags, Dominio, Horario, Alerta de Rezago */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Persona Tag */}
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold text-slate-200 bg-slate-900 border border-slate-700/60 shadow-sm"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>{person}</span>
              </span>

              {/* Dominio */}
              <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded font-bold shadow-sm">
                <Globe className="w-2.5 h-2.5 text-cyan-400" />
                <span>{act.domain || "DOMINIO"}</span>
              </span>

              {/* Horario */}
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                <Clock className="w-2.5 h-2.5 text-slate-400" />
                <span>{act.start ? act.start.slice(11, 16) : "--:--"} – {act.end ? act.end.slice(11, 16) : "--:--"}</span>
              </span>
            </div>

            {/* Badges de Estado & Pronóstico */}
            <div className="flex items-center gap-1.5">
              {lagStatus.isLagging && (
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-600 font-bold shadow-[0_0_8px_rgba(244,63,94,0.3)]">
                  <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" />
                  <span>REZAGO</span>
                </span>
              )}
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Finalizada</span>
                </span>
              ) : isReview ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-600/60 font-semibold">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>En Revisión</span>
                </span>
              ) : (
                getForecastBadge(forecast)
              )}
            </div>
          </div>

          {/* Título de la actividad limpio y legible */}
          <div>
            <h4
              className={`text-xs leading-snug break-words ${
                isCompleted
                  ? "text-slate-400/80 font-normal line-through decoration-slate-500/50"
                  : "font-semibold text-slate-100"
              }`}
              title={act.title}
            >
              {cleanName}
            </h4>
            {act.title && act.title !== cleanName && (
              <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                {act.title}
              </p>
            )}
          </div>

          {/* Barra de Progreso y Botones de Acción */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
            {/* Barra y porcentaje */}
            <div className="flex-1 min-w-[160px] max-w-sm space-y-1">
              <div className="flex items-center justify-between text-[10.5px] font-mono">
                <span className="text-slate-300 flex items-center gap-1 font-medium">
                  <CheckSquare className="w-3 h-3 text-emerald-400" />
                  <span>{daily.done}/{daily.total} checks</span>
                </span>
                <span className={`font-bold ${isCompleted ? "text-emerald-400" : pct > 50 ? "text-cyan-300" : "text-amber-300"}`}>
                  {pct}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCompleted
                      ? "bg-emerald-500"
                      : pct > 50
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-400"
                      : "bg-gradient-to-r from-amber-500 to-rose-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => toggleExpand(act.pageId)}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  isExpanded
                    ? "bg-cyan-950/80 text-cyan-300 border-cyan-700/80"
                    : "bg-slate-900 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800"
                }`}
                title="Ver lista de verificación detallada de Notion"
              >
                <span>Checks ({daily.total})</span>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={() => openNotionPage(act.pageUrl)}
                className="px-2 py-1 text-slate-300 hover:text-cyan-300 hover:bg-slate-800 rounded-md border border-slate-700 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                title="Abrir página en Notion"
              >
                <span>Notion</span>
                <ExternalLink className="w-3 h-3 text-cyan-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Desglose de Checklist Expandido */}
        {isExpanded && (
          <div className="border-t border-slate-800 bg-[#090D13] p-3 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="font-semibold text-slate-300">ITEMS DE CHECKLIST DE NOTION</span>
              <span>{daily.done} de {daily.total} completados hoy</span>
            </div>

            {loadingChecks[act.pageId] ? (
              <div className="p-4 text-center text-xs text-cyan-300 flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>Consultando items de checklist en Notion...</span>
              </div>
            ) : (liveChecks[act.pageId] && liveChecks[act.pageId].length > 0) || hasCheckDetails ? (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {(liveChecks[act.pageId] || act.completedChecks!).map((check, idx) => (
                  <div
                    key={check.id || check.blockId || idx}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs transition-colors ${
                      check.isChecked
                        ? "bg-emerald-950/20 border-emerald-900/50 text-slate-200"
                        : "bg-slate-900/60 border-slate-800 text-slate-400"
                    }`}
                  >
                    <span className="mt-0.5">
                      {check.isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`break-words ${check.isChecked ? "line-through opacity-75" : ""}`}>
                        {check.text}
                      </p>
                      {check.editedAt && (
                        <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                          {check.editedAt.slice(11, 16)} hrs
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-slate-400 bg-slate-900/60 rounded-lg border border-slate-800">
                {daily.total > 0
                  ? `Esta actividad tiene ${daily.total} checks en Notion (${daily.done} marcados hoy). Haz clic en Notion ↗ para verlos directamente.`
                  : "Esta actividad no tiene lista de tareas o checklist registrada en su contenido."}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3 select-none">
      {/* Barra de Control Ejecutiva: Tabs de Estado + Buscador + Modo de Agrupación */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#0D141F] border border-slate-800/90 rounded-xl p-2 shrink-0 shadow-sm">
        {/* Tabs de Filtro por Estado */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "all"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
            }`}
          >
            <span>Todas</span>
            <span className="font-mono text-[11px] opacity-80">({counts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("lagging")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "lagging"
                ? "bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                : "bg-slate-900 text-rose-300 hover:bg-rose-950/40 border border-rose-900/50"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Rezagadas</span>
            <span className="font-mono text-[11px] bg-rose-950/80 px-1 rounded border border-rose-700/60 font-bold">
              {counts.lagging}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("inProgress")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "inProgress"
                ? "bg-sky-500 text-slate-950 shadow-[0_0_10px_rgba(14,165,233,0.3)]"
                : "bg-slate-900 text-sky-300 hover:bg-sky-950/40 border border-sky-900/50"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>En Proceso</span>
            <span className="font-mono text-[11px] bg-sky-950/80 px-1 rounded border border-sky-700/60">
              {counts.inProgress}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "completed"
                ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                : "bg-slate-900 text-emerald-300 hover:bg-emerald-950/40 border border-emerald-900/50"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Finalizadas</span>
            <span className="font-mono text-[11px] bg-emerald-950/80 px-1 rounded border border-emerald-700/60">
              {counts.completed}
            </span>
          </button>
        </div>

        {/* Buscador + Modo de Agrupación */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Buscador rápido */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar actividad o dominio…"
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 pl-8 pr-2.5 py-1 rounded-lg w-44 focus:w-60 transition-all focus:border-cyan-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Toggle Modo de Vista */}
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("byPerson")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                viewMode === "byPerson"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Agrupar actividades por colaborador"
            >
              <Users className="w-3 h-3" />
              <span>Por Colaborador</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flatList")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                viewMode === "flatList"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Ver todas en lista directa"
            >
              <List className="w-3 h-3" />
              <span>Lista Directa</span>
            </button>
          </div>

          {viewMode === "byPerson" && (
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={expandAll}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                Expandir
              </button>
              <span className="text-slate-600">/</span>
              <button
                type="button"
                onClick={collapseAll}
                className="text-slate-400 hover:underline cursor-pointer"
              >
                Colapsar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contenedor Principal de Actividades */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
        {viewMode === "byPerson" ? (
          /* Modo Agrupado por Colaborador */
          peopleGroups.map(([personName, personActivities]) => {
            const isCollapsed = collapsedPeople.has(personName);
            const color = getPersonColor(personName);
            const personLagCount = personActivities.filter((a) => evaluateLagStatus(a).isLagging).length;
            const personCompletedCount = personActivities.filter((a) => workflowState(a.status, a.title) === "completed" || a.isFinalized).length;
            const totalChecks = personActivities.reduce((sum, a) => sum + dailyActivityChecks(a).total, 0);
            const doneChecks = personActivities.reduce((sum, a) => sum + dailyActivityChecks(a).done, 0);
            const personPct = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0;

            return (
              <div
                key={personName}
                className="rounded-2xl border border-slate-800 bg-[#0A0F16]/90 overflow-hidden shadow-md"
              >
                {/* Header del Colaborador */}
                <div
                  onClick={() => togglePersonCollapse(personName)}
                  className="p-3 bg-gradient-to-r from-[#0E1520] to-[#0A0F16] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-slate-800"
                      style={{ backgroundColor: color }}
                    >
                      {personName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-100">{personName}</h3>
                        <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.2 rounded-full">
                          {personActivities.length} {personActivities.length === 1 ? "actividad" : "actividades"}
                        </span>
                        {personLagCount > 0 && (
                          <span className="text-[10.5px] font-mono text-rose-300 bg-rose-950/80 border border-rose-600/70 px-2 py-0.2 rounded-full font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            <span>{personLagCount} con rezago</span>
                          </span>
                        )}
                        {personCompletedCount > 0 && (
                          <span className="text-[10.5px] font-mono text-emerald-300 bg-emerald-950/70 border border-emerald-700/60 px-2 py-0.2 rounded-full font-medium">
                            ✓ {personCompletedCount} finalizadas
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {doneChecks}/{totalChecks} checks del día completados ({personPct}%)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Mini barra de avance */}
                    <div className="w-32 hidden sm:block space-y-1">
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                          style={{ width: `${personPct}%` }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-700/80"
                      title={isCollapsed ? "Desplegar actividades" : "Colapsar actividades"}
                    >
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Actividades del colaborador */}
                {!isCollapsed && (
                  <div className="p-3 grid grid-cols-1 gap-2.5">
                    {personActivities.map(renderActivityCard)}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* Modo Lista Directa */
          <div className="grid grid-cols-1 gap-2.5">
            {filteredActivities.map(renderActivityCard)}
          </div>
        )}

        {filteredActivities.length === 0 && (
          <div className="p-12 text-center rounded-2xl border border-slate-800 bg-[#0C1118] text-slate-400 space-y-2">
            <Filter className="w-8 h-8 text-slate-500 mx-auto opacity-60" />
            <p className="text-sm font-semibold text-slate-300">No hay actividades para mostrar</p>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? `No se encontraron coincidencias para "${searchQuery}".`
                : statusFilter !== "all"
                ? "No hay actividades en este estado para la selección actual."
                : "No se registran actividades en esta fecha."}
            </p>
            {(searchQuery || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="mt-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium cursor-pointer"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
