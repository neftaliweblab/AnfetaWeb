"use client";

import React, { useState, useMemo, useEffect } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import {
  computeDailyKPIs,
  generateMarkdownReport,
} from "@/services/progressKpis";
import { normalizePerson } from "@/services/identityNormalizer";
import { KpiCardsGrid } from "./KpiCardsGrid";
import { ColaboratorBreakdown } from "./ColaboratorBreakdown";
import { AutomationReportModal } from "./AutomationReportModal";
import { Copy, Check, Sparkles } from "lucide-react";
import {reportHtml,downloadProgressHtml,printProgressHtml} from '@/lib/progressReportExport';
import {readApiJson} from '@/lib/readApiJson';
import { playTickSound } from "@/utils/soundAndFx";

interface DailyProgressPanelProps {
  activities: NotionCalendarActivity[];
  currentUser: string;
  onSelectDate: (date: string) => void;
  currentDate: string;
  automationReport?: any;
}

const COLLABORATORS = [
  "John",
  "Karla",
  "Isaias",
  "Sotelo",
  "Acalli",
  "Andrade",
  "Brian",
  "Genaro",
  "Neftali",
];

export function DailyProgressPanel({
  activities, currentUser, onSelectDate,
  currentDate,
  automationReport,
}: DailyProgressPanelProps) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [scope, setScope] = useState<"day" | "week">("day");
  const [weekActivities, setWeekActivities] = useState<NotionCalendarActivity[]>([]);
  const [summary, setSummary] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const summaryAbort = React.useRef<AbortController | null>(null);
  useEffect(() => { summaryAbort.current?.abort(); setSummarizing(false); setSummary(''); setSummaryError(''); setWeekActivities([]); return () => summaryAbort.current?.abort(); }, [currentDate]);
  const [copied, setCopied] = useState(false);
  const [showAutoReport, setShowAutoReport] = useState(false);

  // Load weekly activities when switching to "week"
  useEffect(() => {
    if (scope === "week") {
      let isMounted = true;
      fetch(`/api/data?type=calendar&scope=week&date=${currentDate}`)
        .then(readApiJson)
        .then((data) => {
          if (isMounted && data.activities) {
            setWeekActivities(data.activities);
          }
        })
        .catch((err) => {if(isMounted)setSummaryError(err instanceof Error?err.message:"No se pudo cargar la semana.");});
      return () => {
        isMounted = false;
      };
    }
  }, [scope, currentDate]);

  const activeActivities = useMemo(() => {
    if (scope === "week") {
      return weekActivities;
    }
    return activities;
  }, [scope, weekActivities, activities]);

  // Compute KPIs
  const kpis = useMemo(() => {
    return computeDailyKPIs(selectedPerson?activeActivities.filter(a=>normalizePerson(a.person)===selectedPerson):activeActivities, currentDate);
  }, [activeActivities, currentDate, selectedPerson]);

  // Filter activities by collaborator if selected
  const displayedActivities = useMemo(() => {
    if (!selectedPerson) return activeActivities;
    return activeActivities.filter(
      (a) => normalizePerson(a.person) === selectedPerson
    );
  }, [activeActivities, selectedPerson]);

  const handleCopyReport = async () => {
    const md = summary || generateMarkdownReport(kpis, displayedActivities);
    try { await navigator.clipboard.writeText(md); } catch { setSummaryError('No se pudo copiar el reporte.'); return; }
    playTickSound();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B0F] p-4 space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0 select-none">
        <div>
          <h2 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
            <span>Avance Diario y KPIs Ejecutivos</span>
            <span className="text-xs font-mono text-[#00A8FF] bg-[#0F141A] px-2 py-0.5 rounded border border-[#223848]">
              {scope === "week" ? `Semana (${currentDate})` : currentDate}
            </span>
          </h2>
          <p className="text-xs text-[#64748B]">
            Cálculo matemático de rezago &lt;33%, cobertura ponderada de minutos y pronóstico
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input aria-label="Fecha del avance diario" type="date" value={currentDate} onChange={e => onSelectDate(e.target.value)} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs" />
          <button className="rounded border border-slate-700 px-3 py-2 text-xs" onClick={()=>downloadProgressHtml(reportHtml(displayedActivities,currentDate,scope,selectedPerson),currentDate)}>Exportar HTML</button><button className="rounded border border-slate-700 px-3 py-2 text-xs" onClick={()=>{try{printProgressHtml(reportHtml(displayedActivities,currentDate,scope,selectedPerson));}catch(e){setSummaryError(e instanceof Error?e.message:'No se pudo abrir el reporte.');}}}>Imprimir / PDF</button>
          <button disabled={summarizing} className="rounded border border-cyan-500/40 px-3 py-2 text-xs text-cyan-300 disabled:opacity-50" onClick={async () => {
            const controller = new AbortController(); summaryAbort.current = controller;
            setSummarizing(true); setSummaryError('');
            try {
              const response = await fetch('/api/data', { signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'daily-ai-summary', payload: { date: currentDate, currentUser } }) });
              const data = await response.json(); if (!response.ok) throw new Error(data.error); setSummary(data.summary);
            } catch (e) { if (!controller.signal.aborted) setSummaryError(e instanceof Error ? e.message : 'No se pudo generar el resumen.'); }
            finally { if (!controller.signal.aborted) setSummarizing(false); }
          }}>{summarizing ? 'Redactando…' : '✨ Redactar Resumen del Día con IA'}</button>
          {automationReport && (
            <button
              onClick={() => setShowAutoReport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848] text-xs font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00A8FF]" />
              <span>Reporte 05:00 AM</span>
            </button>
          )}

          <button
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00A8FF] hover:bg-[#1FB6FF] text-[#080B0F] text-xs font-bold transition-all shadow-[0_0_10px_rgba(0,168,255,0.2)]"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copiado al Portapapeles</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Reporte Markdown</span>
              </>
            )}
          </button>
        </div>
      </div>

      {activeActivities.some(a=>a.checklistUnknownCompleted||a.checklistTimingWarning||a.checklistTimingEstimated)&&<p className="text-xs text-amber-200">Los checks externos sin fecha verificada no se atribuyen al avance del día. En el modo anterior sin Supabase, la fecha sigue estimada por última edición.</p>}
      {summaryError && <p role="alert" className="text-sm text-rose-300">{summaryError}</p>}
      {summary && <article className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-cyan-500/25 bg-slate-900 p-4 text-sm text-slate-200">{summary}</article>}
      {/* KPI Cards Grid */}
      <KpiCardsGrid kpis={kpis} />

      {/* Scope and collaborator filter bar */}
      <div className="h-10 bg-[#0F141A] border border-[#26323E] rounded-lg px-3 flex items-center justify-between text-xs flex-shrink-0 select-none">
        {/* Collaborator pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          <button
            onClick={() => setSelectedPerson(null)}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              selectedPerson === null
                ? "bg-[#00A8FF] text-[#080B0F] font-bold"
                : "text-[#94A3B8] hover:bg-[#131A22]"
            }`}
          >
            Todos
          </button>
          {COLLABORATORS.map((p) => {
            const isSel = selectedPerson === p;
            return (
              <button
                key={p}
                onClick={() => setSelectedPerson(isSel ? null : p)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  isSel
                    ? "bg-[#18212B] text-[#00A8FF] border border-[#00A8FF]/40 font-semibold"
                    : "text-[#94A3B8] hover:bg-[#131A22] hover:text-[#E2E8F0]"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Scope selector */}
        <div className="flex items-center bg-[#131A22] border border-[#223848] rounded p-0.5 ml-2">
          <button
            onClick={() => setScope("day")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              scope === "day"
                ? "bg-[#00A8FF] text-[#080B0F] font-bold"
                : "text-[#64748B] hover:text-[#E2E8F0]"
            }`}
          >
            Día
          </button>
          <button
            onClick={() => setScope("week")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              scope === "week"
                ? "bg-[#00A8FF] text-[#080B0F] font-bold"
                : "text-[#64748B] hover:text-[#E2E8F0]"
            }`}
          >
            Semana
          </button>
        </div>
      </div>

      {/* Collaborator activities list */}
      <ColaboratorBreakdown activities={displayedActivities} />

      {/* Modal Report */}
      {showAutoReport && (
        <AutomationReportModal
          report={automationReport}
          onClose={() => setShowAutoReport(false)}
        />
      )}
    </div>
  );
}
