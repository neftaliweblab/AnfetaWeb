"use client";

import React, { useState, useMemo, useEffect } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { CalendarTopControls } from "./CalendarTopControls";
import { CalendarColHeader } from "./CalendarColHeader";
import { ActivityCard } from "./ActivityCard";
import { CalendarPeoplePickerModal } from "./CalendarPeoplePickerModal";
import { CalendarPersonPreviewPanel } from "./CalendarPersonPreviewPanel";
import { CalendarTemplatesModal } from "./CalendarTemplatesModal";
import { AutomationReportModal } from "../DailyProgressPanel/AutomationReportModal";
import { normalizePerson } from "@/services/identityNormalizer";
import { computeActivityOverlaps } from "@/utils/calendarLayout";

interface CalendarHostProps {
  activities: NotionCalendarActivity[];
  currentDate: string;
  onSelectDate: (date: string) => void;
  availableDates: string[];
  onBackToSearch?: () => void;
  automationReport?: any;
  searchFilterQuery?: string;
  onClearSearchFilter?: () => void;
  onOpenStandaloneWindow?: () => void;
  onRunAutomation?: () => void;
  onOpenDailyProgress?: () => void;
  onRefresh?: () => void;
}

const DEFAULT_COLLABORATORS = [
  "John",
  "Karla",
  "Isaias",
  "Sotelo",
  "Acalli",
  "Andrade",
  "Brian",
  "Genaro",
  "Neftali",
  "Sin asignar",
];

export function CalendarHost({
  activities: initialActivities,
  currentDate,
  onSelectDate,
  availableDates,
  onBackToSearch,
  automationReport,
  searchFilterQuery = "",
  onClearSearchFilter,
  onOpenStandaloneWindow,
  onRunAutomation,
  onOpenDailyProgress,
  onRefresh,
}: CalendarHostProps) {
  const [activitiesList, setActivitiesList] = useState<NotionCalendarActivity[]>(initialActivities);
  const [pixelsPerHour, setPixelsPerHour] = useState(72);
  const [extraHours, setExtraHours] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [filterCobros, setFilterCobros] = useState(false);
  const [filterPagos, setFilterPagos] = useState(false);
  const [visiblePeople, setVisiblePeople] = useState<string[]>(DEFAULT_COLLABORATORS);
  const [selectedPersonPreview, setSelectedPersonPreview] = useState<string | null>(null);

  useEffect(() => {
    setActivitiesList(initialActivities);
  }, [initialActivities]);

  const handleChangeZoom = (delta: number) => {
    setPixelsPerHour((prev) => Math.min(120, Math.max(48, prev + delta)));
  };

  const handleUpdateActivity = async (pageId: string, updates: Partial<NotionCalendarActivity>) => {
    setActivitiesList((prev) =>
      prev.map((a) => (a.pageId === pageId ? { ...a, ...updates } : a))
    );
    if (updates.status) {
      try {
        await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update-activity-status",
            pageId,
            status: updates.status,
          }),
        });
      } catch (err) {
        console.error("Error al sincronizar estado de actividad con la API:", err);
      }
    }
  };

  const startHour = 8;
  const endHour = extraHours ? 22 : 21;
  const totalHours = endHour - startHour;
  const canvasHeight = totalHours * pixelsPerHour;

  const hoursList = useMemo(() => {
    const list = [];
    for (let h = startHour; h <= endHour; h++) {
      list.push(`${h.toString().padStart(2, "0")}:00`);
    }
    return list;
  }, [startHour, endHour]);

  const filteredActivities = useMemo(() => {
    return activitiesList.filter((act) => {
      const text = `${act.title} ${act.status} ${act.project} ${act.domain || ""} ${act.person || ""}`.toLowerCase();
      if (filterCobros && !text.includes("cobro") && !text.includes("cobrar")) return false;
      if (filterPagos && !text.includes("pago") && !text.includes("pagar")) return false;
      if (searchFilterQuery && searchFilterQuery.trim()) {
        const terms = searchFilterQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const matchesAll = terms.every((t) => text.includes(t));
        if (!matchesAll) return false;
      }
      return true;
    });
  }, [activitiesList, filterCobros, filterPagos, searchFilterQuery]);

  const activitiesByPerson = useMemo(() => {
    const map: Record<string, NotionCalendarActivity[]> = {};
    visiblePeople.forEach((p) => {
      map[p] = [];
    });
    filteredActivities.forEach((act) => {
      const canonical = normalizePerson(act.person);
      if (!map[canonical]) map[canonical] = [];
      map[canonical].push(act);
    });
    return map;
  }, [filteredActivities, visiblePeople]);

  const handleDropOnColumn = (e: React.DragEvent, colPerson: string) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const { pageId, durationHours = 1 } = JSON.parse(dataStr);
      const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const dropY = Math.max(0, e.clientY - colRect.top);
      const minutesFromStart = Math.round(((dropY / pixelsPerHour) * 60) / 15) * 15;
      const targetHour = Math.min(21, Math.max(8, 8 + Math.floor(minutesFromStart / 60)));
      const targetMinute = Math.min(45, Math.max(0, minutesFromStart % 60));
      const hourStr = targetHour.toString().padStart(2, "0");
      const minStr = targetMinute.toString().padStart(2, "0");
      const endH = Math.min(22, targetHour + Math.ceil(durationHours)).toString().padStart(2, "0");

      handleUpdateActivity(pageId, {
        person: colPerson,
        start: `${currentDate}T${hourStr}:${minStr}:00-06:00`,
        end: `${currentDate}T${endH}:${minStr}:00-06:00`,
      });
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B0F]">
      <CalendarTopControls
        currentDate={currentDate}
        onSelectDate={onSelectDate}
        availableDates={availableDates}
        extraHours={extraHours}
        onToggleExtraHours={() => setExtraHours(!extraHours)}
        onOpenPeoplePicker={() => setShowPeoplePicker(true)}
        totalActivitiesCount={filteredActivities.length}
        pixelsPerHour={pixelsPerHour}
        onChangeZoom={handleChangeZoom}
        filterCobros={filterCobros}
        onToggleCobros={() => setFilterCobros(!filterCobros)}
        filterPagos={filterPagos}
        onTogglePagos={() => setFilterPagos(!filterPagos)}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenReport={() => setShowReport(true)}
        onBackToSearch={() => onBackToSearch?.()}
        searchFilterQuery={searchFilterQuery}
        onClearSearchFilter={onClearSearchFilter}
        onRunAutomation={onRunAutomation}
        onOpenDailyProgress={onOpenDailyProgress}
        onRefresh={onRefresh}
        onOpenStandaloneWindow={onOpenStandaloneWindow}
      />

      <div className="flex-1 flex overflow-auto scrollbar-thin relative select-none">
        {/* Sticky Left Time Rail */}
        <div
          className="w-16 bg-[#0F141A] border-r border-[#26323E] flex-shrink-0 sticky left-0 z-45"
          style={{ height: `${canvasHeight + 56}px` }}
        >
          <div className="h-14 border-b border-[#26323E] flex items-center justify-center text-[10px] font-mono text-[#64748B]">
            HORA
          </div>
          <div className="relative" style={{ height: `${canvasHeight}px` }}>
            {hoursList.map((hour, idx) => (
              <div
                key={hour}
                style={{ top: `${idx * pixelsPerHour}px` }}
                className="absolute w-full text-right pr-2 text-[10px] font-mono text-[#64748B] -translate-y-2"
              >
                {hour}
              </div>
            ))}
          </div>
        </div>

        {/* Collaborators Columns - Fluid and Auto-expanding */}
        <div className="flex-1 flex min-w-fit">
          {visiblePeople.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#64748B]">
              <p className="text-sm font-medium text-[#94A3B8]">No hay colaboradores visibles en el calendario</p>
              <p className="text-xs text-[#64748B] mt-1">Haz clic en el selector para activar columnas</p>
              <button
                onClick={() => setShowPeoplePicker(true)}
                className="mt-3 px-3 py-1.5 rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848] text-xs font-medium"
              >
                Configurar colaboradores
              </button>
            </div>
          ) : (
            visiblePeople.map((person) => {
              const personActivities = activitiesByPerson[person] || [];
              const positioned = computeActivityOverlaps(personActivities);
              return (
                <div
                  key={person}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnColumn(e, person)}
                  className="flex-1 min-w-[200px] border-r border-[#26323E] flex flex-col"
                  style={{ height: `${canvasHeight + 56}px` }}
                >
                  <CalendarColHeader
                    personName={person}
                    activityCount={personActivities.length}
                    onSelectPerson={(p) => setSelectedPersonPreview(p)}
                  />
                  <div className="relative flex-1 bg-[#080B0F]" style={{ height: `${canvasHeight}px` }}>
                    {hoursList.map((_, idx) => (
                      <div
                        key={idx}
                        style={{ top: `${idx * pixelsPerHour}px` }}
                        className="absolute w-full h-px bg-[#161F2B]"
                      />
                    ))}
                    {positioned.map(({ activity: act, overlapIndex, overlapTotal }, idx) => (
                      <ActivityCard
                        key={act.pageId || idx}
                        activity={act}
                        pixelsPerHour={pixelsPerHour}
                        overlapIndex={overlapIndex}
                        overlapTotal={overlapTotal}
                        onUpdateActivity={handleUpdateActivity}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showPeoplePicker && (
        <CalendarPeoplePickerModal
          allPeople={DEFAULT_COLLABORATORS}
          visiblePeople={visiblePeople}
          onTogglePerson={(p) => {
            setVisiblePeople((prev) =>
              prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
            );
          }}
          onClose={() => setShowPeoplePicker(false)}
        />
      )}

      {selectedPersonPreview && (
        <CalendarPersonPreviewPanel
          personName={selectedPersonPreview}
          activities={activitiesByPerson[selectedPersonPreview] || []}
          currentDate={currentDate}
          onClose={() => setSelectedPersonPreview(null)}
        />
      )}

      {showTemplates && (
        <CalendarTemplatesModal
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          currentDate={currentDate}
          onActivitiesCreated={(created) => {
            setActivitiesList((prev) => [...prev, ...created]);
          }}
        />
      )}

      {showReport && (
        <AutomationReportModal report={automationReport} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
