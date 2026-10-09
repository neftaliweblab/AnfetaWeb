"use client";

import {calendarTime, calendarDisplayTitle} from '@/services/calendarPresentation';
import {workflowState} from '@/services/activityWorkflow';
import React, { useState, useMemo } from "react";
import { X, CheckCircle2, AlertTriangle, Calendar, CheckSquare, Clock, ExternalLink } from "lucide-react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { PERSON_METADATA, getPersonColor, getPersonInitials } from "@/services/identityNormalizer";
import { evaluateLagStatus } from "@/services/progressKpis";
import { openNotionPage } from "@/services/windowsIntegration";
import { formatLongCalendarDate } from "@/lib/dateUtils";

interface CalendarPersonPreviewPanelProps {
  initialTab?:"checks"|"activities";
  personName: string;
  activities: NotionCalendarActivity[];
  currentDate: string;
  onClose: () => void;
}

export function CalendarPersonPreviewPanel({
  personName,
  activities,
  currentDate,
  onClose,initialTab="checks",
}: CalendarPersonPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<"checks" | "activities">(initialTab);

  const meta = PERSON_METADATA[personName];
  const color = getPersonColor(personName);
  const initials = getPersonInitials(personName);

  // Compute collaborator KPIs
  const stats = useMemo(() => {
    let completedCount = 0;
    let laggingCount = 0;
    let totalScheduledMin = 0;
    let progressMin = 0;
    let totalChecksToday = 0;

    activities.filter(act=>!act.isReviewMirror).forEach((act) => {
      const startD = act.start ? new Date(act.start).getTime() : 0;
      const endD = act.end ? new Date(act.end).getTime() : 0;
      const dur = endD > startD ? Math.round((endD - startD) / 60000) : 60;
      totalScheduledMin += dur;

      if (workflowState(act.status,act.title) === "completed") {
        completedCount++;
      }
      if (evaluateLagStatus(act).isLagging) {
        laggingCount++;
      }

      const checks = act.todayChecklistCompleted || 0;
      totalChecksToday += checks;

      const pct =
        act.checklistTotal > 0
          ? Math.min(100, (checks / act.checklistTotal) * 100)
          : act.isFinalized
          ? 100
          : 0;

      progressMin += dur * (pct / 100);
    });

    const coveragePct =
      totalScheduledMin > 0 ? Math.round((progressMin / totalScheduledMin) * 100) : 0;

    return {
      total: activities.length,
      completed: completedCount,
      lagging: laggingCount,
      coverage: coveragePct,
      totalChecksToday,
    };
  }, [activities]);

  // Feed de checks completados hoy
  const completedChecksFeed = useMemo(() => {
    const list: Array<{
      id: string;
      domain: string;
      activityTitle: string;
      text: string;
      timeStr: string;
      url: string;
    }> = [];

    activities.filter(act=>!act.isReviewMirror).forEach(act => {
      for (const item of act.completedChecks || []) list.push({id:item.id,domain:act.domain || 'general',activityTitle:calendarDisplayTitle(act.title,act.domain),text:item.text,timeStr:calendarTime(item.markedAt || item.editedAt || ''),url:act.pageUrl});
    });

    return list;
  }, [activities]);

  return (
    <aside
      className="fixed top-14 right-0 bottom-7 z-50 w-full max-w-[840px] bg-[#0A1017] border-l border-[#26323E] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="h-16 px-6 bg-[#0F141A] border-b border-[#26323E] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-[#080B0F] shadow-md"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#F1F5F9]">{personName}</h3>
              <span className="text-[10px] font-mono text-[#38BDF8] px-2 py-0.5 rounded bg-[#131A22] border border-[#223848]">
                {meta?.role || "Integrante"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-[#94A3B8] font-medium">
                {formatLongCalendarDate(currentDate).fullText}
              </span>
              {formatLongCalendarDate(currentDate).relativeBadge && (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded font-bold font-mono bg-[#0369A1]/30 text-[#38BDF8] border border-[#0284C7]/50">
                  {formatLongCalendarDate(currentDate).relativeBadge}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#18212B] rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="p-4 grid grid-cols-4 gap-3 bg-[#080B0F] border-b border-[#26323E]">
        <div className="p-2.5 rounded bg-[#0F141A] border border-[#26323E] text-center">
          <span className="text-[10px] text-[#64748B] block font-mono">COBERTURA</span>
          <span className="text-lg font-bold font-mono text-[#00A8FF]">
            {stats.coverage}%
          </span>
        </div>
        <div className="p-2.5 rounded bg-[#0F141A] border border-[#26323E] text-center">
          <span className="text-[10px] text-[#64748B] block font-mono">TOTAL TAREAS</span>
          <span className="text-lg font-bold font-mono text-[#F1F5F9]">
            {stats.total}
          </span>
        </div>
        <div className="p-2.5 rounded bg-[#2B1419] border border-[#FB7185]/40 text-center">
          <span className="text-[10px] text-[#FB7185] block font-mono">REZAGADAS</span>
          <span className="text-lg font-bold font-mono text-[#FB7185]">
            {stats.lagging}
          </span>
        </div>
        <div className="p-2.5 rounded bg-[#10251B] border border-[#4ADE80]/40 text-center">
          <span className="text-[10px] text-[#4ADE80] block font-mono">FINALIZADAS</span>
          <span className="text-lg font-bold font-mono text-[#4ADE80]">
            {stats.completed}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="h-11 px-6 bg-[#0F141A] border-b border-[#26323E] flex items-center gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("checks")}
          className={`h-full border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "checks"
              ? "border-[#00A8FF] text-[#00A8FF]"
              : "border-transparent text-[#94A3B8] hover:text-[#E2E8F0]"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Checklists completados hoy ({completedChecksFeed.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("activities")}
          className={`h-full border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "activities"
              ? "border-[#00A8FF] text-[#00A8FF]"
              : "border-transparent text-[#94A3B8] hover:text-[#E2E8F0]"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Todas las actividades ({activities.length})</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin">
        {activeTab === "checks" ? (
          completedChecksFeed.length === 0 ? (
            <p className="text-xs text-[#64748B] text-center py-12">
              Sin checks completados registrados para esta fecha
            </p>
          ) : (
            completedChecksFeed.map((chk) => (
              <div
                key={chk.id}
                className="p-3.5 rounded-lg bg-[#0F141A] border border-[#26323E] hover:border-[#00A8FF]/40 transition-colors flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#10251B] text-[#4ADE80] border border-[#4ADE80]/30">
                      ✓ Hecho
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#0C2233] text-[#38BDF8] border border-[#0EA5E9]/30 uppercase">
                      {chk.domain}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-[#CBD5E1] bg-[#18212B] border border-[#2A3E50] truncate max-w-xs">
                      {chk.activityTitle}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#64748B] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#38BDF8]" /> {chk.timeStr}
                  </span>
                </div>
                <p className="text-xs text-[#E2E8F0] pl-1 font-medium">{chk.text}</p>
              </div>
            ))
          )
        ) : (
          activities.map((act) => (
            <div
              key={act.pageId}
              className="p-3.5 rounded-lg bg-[#0F141A] border border-[#26323E] flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-mono uppercase text-[#38BDF8]">
                  {act.domain}
                </span>
                <h4 className="text-xs font-semibold text-[#F1F5F9] truncate">
                  {act.shortTitle || act.title}
                </h4>
                <span className="text-[10px] font-mono text-[#64748B]">
                  {calendarTime(act.start)} – {calendarTime(act.end)} · Estado: {act.status}
                </span>
              </div>
              <button
                onClick={() => openNotionPage(act.pageUrl)}
                className="p-2 text-[#94A3B8] hover:text-[#00A8FF] rounded border border-[#223848]"
                title="Abrir en Notion"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
