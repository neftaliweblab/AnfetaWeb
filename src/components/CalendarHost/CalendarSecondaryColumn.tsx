"use client";

import React, { useMemo, useState } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { CalendarHourGrid } from "./CalendarHourGrid";
import { ActivityCard } from "./ActivityCard";
import { computeActivityOverlaps } from "@/utils/calendarLayout";
import { calendarDisplayTitle, calendarDomain, calendarTime } from "@/services/calendarPresentation";
import { getPersonColor, getPersonInitials, normalizePerson } from "@/services/identityNormalizer";

interface CalendarSecondaryColumnProps {
  items: NotionCalendarActivity[];
  width: number;
  height: number;
  pixelsPerHour: number;
  gridInterval: number;
  date: string;
  currentUser: string;
  palette: "web" | "desktop";
  selectedPageId?: string | null;
  pendingIds: Set<string>;
  onSelectActivity: (activity: NotionCalendarActivity) => void;
  onUpdateActivity: (pageId: string, updates: Partial<NotionCalendarActivity> & Record<string, unknown>) => Promise<boolean | void>;
  onChecklistUpdated: (pageId: string, updates: Partial<NotionCalendarActivity>) => void;
  onClose: () => void;
}

/**
 * Columna dedicada para actividades secundarias (prioridad 22),
 * manteniéndolas separadas del calendario principal cuando está activa.
 */
export function CalendarSecondaryColumn({
  items,
  width,
  height,
  pixelsPerHour,
  gridInterval,
  date,
  currentUser,
  palette,
  selectedPageId,
  pendingIds,
  onSelectActivity,
  onUpdateActivity,
  onChecklistUpdated,
  onClose,
}: CalendarSecondaryColumnProps) {
  const [personFilter, setPersonFilter] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const peopleInSecondary = useMemo(
    () => [...new Set(items.map((a) => normalizePerson(a.person)).filter((p) => p && p !== "Sin asignar"))].sort(),
    [items]
  );

  const visible = useMemo(
    () =>
      items
        .filter((a) => !personFilter || normalizePerson(a.person) === personFilter)
        .sort((a, b) => (a.start || "").localeCompare(b.start || "")),
    [items, personFilter]
  );

  const positioned = useMemo(() => computeActivityOverlaps(visible, date), [visible, date]);

  return (
    <div
      className="min-w-0 border-r border-[#202832] flex flex-col"
      style={{ order: 998, height: `${height + 56}px`, flex: `1 0 ${width}px`, width }}
    >
      <div className="h-14 shrink-0 bg-[#101724] border-b border-[#25364a] px-2.5 flex items-center justify-between gap-1.5 text-xs text-sky-200 select-none sticky top-0 z-40">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold truncate">📌 SECUNDARIAS (22)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 border border-sky-400/40 text-[10px] font-mono text-sky-200">
              {visible.length}/{items.length}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <select
              aria-label="Filtrar persona en secundarias"
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="rounded bg-slate-900 border border-slate-700 px-1 py-0.2 text-[9.5px] text-slate-200 max-w-[110px]"
            >
              <option value="">Todo el equipo</option>
              {peopleInSecondary.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setViewMode((v) => (v === "calendar" ? "list" : "calendar"))}
              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.2 text-[9.5px] text-sky-300 hover:bg-slate-800 cursor-pointer"
              title="Alternar vista horario / lista"
            >
              {viewMode === "calendar" ? "Lista" : "Horario"}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white px-1 cursor-pointer"
          title="Volver a mostrar secundarias dentro de cada columna"
          aria-label="Ocultar columna de secundarias"
        >
          ×
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto overflow-x-hidden bg-[#080C12]" style={{ height }}>
        <CalendarHourGrid pixelsPerHour={pixelsPerHour} interval={gridInterval} />
        {!visible.length ? (
          <p className="relative z-10 p-3 text-xs text-slate-500">
            Sin actividades secundarias (22) para esta fecha.
          </p>
        ) : viewMode === "list" ? (
          <div className="relative z-10 p-2 space-y-2">
            {visible.map((act) => {
              const owner = normalizePerson(act.person);
              const domain = calendarDomain(act.title, act.project);
              const title = calendarDisplayTitle(act.title, domain);
              return (
                <button
                  key={act.pageId}
                  type="button"
                  onClick={() => onSelectActivity(act)}
                  className="w-full text-left rounded-lg border border-sky-700/40 bg-[#0d1726]/90 hover:border-sky-400 p-2 space-y-1 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span
                      className="px-1.5 py-0.2 rounded font-bold text-[#080B0F]"
                      style={{ backgroundColor: getPersonColor(owner) }}
                    >
                      {getPersonInitials(owner)} · {owner}
                    </span>
                    <span className="font-mono text-sky-300">
                      {calendarTime(act.start)} – {calendarTime(act.end)}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-cyan-300 truncate">{domain}</div>
                  <div className="text-xs font-medium text-slate-100 line-clamp-2">{title}</div>
                </button>
              );
            })}
          </div>
        ) : (
          positioned.map(({ activity: act, overlapIndex, overlapTotal }, idx) => (
            <ActivityCard
              key={act.pageId || idx}
              activity={act}
              isSaving={pendingIds.has(act.pageId)}
              onChecklistUpdated={onChecklistUpdated}
              displayDate={date}
              currentUser={currentUser}
              pixelsPerHour={pixelsPerHour}
              overlapIndex={overlapIndex}
              overlapTotal={overlapTotal}
              palette={palette}
              isSelected={selectedPageId === act.pageId}
              activeViewer={null}
              onSelectActivity={onSelectActivity}
              onUpdateActivity={onUpdateActivity}
            />
          ))
        )}
      </div>
    </div>
  );
}
