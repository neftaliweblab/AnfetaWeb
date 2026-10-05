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
import { playTickSound } from "@/utils/soundAndFx";

interface DailyProgressPanelProps {
  activities: NotionCalendarActivity[];
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
  activities,
  currentDate,
  automationReport,
}: DailyProgressPanelProps) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [scope, setScope] = useState<"day" | "week">("day");
  const [weekActivities, setWeekActivities] = useState<NotionCalendarActivity[]>([]);
  const [copied, setCopied] = useState(false);
  const [showAutoReport, setShowAutoReport] = useState(false);

  // Load weekly activities when switching to "week"
  useEffect(() => {
    if (scope === "week") {
      let isMounted = true;
      fetch(`/api/data?type=calendar&scope=week&date=${currentDate}`)
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && data.activities) {
            setWeekActivities(data.activities);
          }
        })
        .catch((err) => console.error("Error fetching week activities:", err));
      return () => {
        isMounted = false;
      };
    }
  }, [scope, currentDate]);

  const activeActivities = useMemo(() => {
    if (scope === "week" && weekActivities.length > 0) {
      return weekActivities;
    }
    return activities;
  }, [scope, weekActivities, activities]);

  // Compute KPIs
  const kpis = useMemo(() => {
    return computeDailyKPIs(activeActivities, currentDate);
  }, [activeActivities, currentDate]);

  // Filter activities by collaborator if selected
  const displayedActivities = useMemo(() => {
    if (!selectedPerson) return activeActivities;
    return activeActivities.filter(
      (a) => normalizePerson(a.person) === selectedPerson
    );
  }, [activeActivities, selectedPerson]);

  const handleCopyReport = () => {
    const md = generateMarkdownReport(kpis, displayedActivities);
    navigator.clipboard.writeText(md);
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

        <div className="flex items-center gap-2">
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
