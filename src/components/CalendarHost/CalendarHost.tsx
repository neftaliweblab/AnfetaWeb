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

import { canEditActivity, scheduleAtDrop, isDirection } from '@/services/activityPermissions';
import { CreateActivityModal } from './CreateActivityModal';
import { CalendarDetailPanel } from './CalendarDetailPanel';
interface CalendarHostProps {
  currentUser: string;
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
  activities: initialActivities, currentUser,
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
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const pending = React.useRef(new Set<string>());
  const [pixelsPerHour, setPixelsPerHour] = useState(72);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [filterCobros, setFilterCobros] = useState(false);
  const [filterPagos, setFilterPagos] = useState(false);
  const [visiblePeople, setVisiblePeople] = useState<string[]>(DEFAULT_COLLABORATORS);
  const [selectedPersonPreview, setSelectedPersonPreview] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<NotionCalendarActivity | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    setActivitiesList(initialActivities);
  }, [initialActivities]);

  const handleChangeZoom = (delta: number) => {
    setPixelsPerHour((prev) => Math.min(120, Math.max(48, prev + delta)));
  };

  const handleUpdateActivity = async (pageId: string, updates: Partial<NotionCalendarActivity>) => {
    const original = activitiesList.find(a => a.pageId === pageId);
    if (!original || !canEditActivity(currentUser, original) || pending.current.has(pageId)) return;
    if (updates.person && normalizePerson(updates.person) !== normalizePerson(original.person) && !isDirection(currentUser)) return;
    pending.current.add(pageId); setError('');
    try {
      const response = await fetch('/api/data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: updates.start ? 'update-activity-schedule' : updates.person ? 'update-activity-assignee' : 'update-activity-status',
          payload: { id: pageId, currentUser, ...updates } }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo guardar la actividad.');
      setActivitiesList(prev => prev.map(a => a.pageId === pageId ? { ...a, ...updates } : a));
      setSelectedActivity(prev => prev && prev.pageId === pageId ? { ...prev, ...updates } : prev);
      onRefresh?.();
    } catch (error) { setError(error instanceof Error ? error.message : 'Error de conexión'); }
    finally { pending.current.delete(pageId); }
  };

  const startHour = 8;
  const endHour = 22;
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
      const { pageId, offsetY = 0 } = JSON.parse(e.dataTransfer.getData('text/plain'));
      const activity = activitiesList.find(a => a.pageId === pageId);
      if (!activity || !canEditActivity(currentUser, activity) || normalizePerson(activity.person) !== colPerson) return;
      const y = e.clientY - e.currentTarget.getBoundingClientRect().top - 56 - offsetY;
      void handleUpdateActivity(pageId, scheduleAtDrop(activity, currentDate, y / pixelsPerHour * 60));
    } catch (error) { setError(error instanceof Error ? error.message : 'Movimiento inválido'); }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B0F]">
      {error && <div role="alert" className="px-3 py-2 text-sm text-rose-300">{error}</div>}
      {showCreate && <CreateActivityModal currentUser={currentUser} date={currentDate} onClose={() => setShowCreate(false)} onCreated={activity => { setActivitiesList(prev => [...prev, activity]); setShowCreate(false); onRefresh?.(); }} />}
      <CalendarTopControls
        onCreateActivity={() => setShowCreate(true)}
        currentDate={currentDate}
        onSelectDate={onSelectDate}
        availableDates={availableDates}
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

      <div className="flex-1 flex overflow-hidden relative">
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
                          currentUser={currentUser}
                          pixelsPerHour={pixelsPerHour}
                          overlapIndex={overlapIndex}
                          overlapTotal={overlapTotal}
                          isSelected={selectedActivity?.pageId === act.pageId && isDetailOpen}
                          onSelectActivity={(selected) => {
                            setSelectedActivity(selected);
                            setIsDetailOpen(true);
                          }}
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

        {/* Panel Lateral de Detalle y Checklist (WPF Parity) */}
        {selectedActivity && isDetailOpen && (
          <CalendarDetailPanel
            activity={selectedActivity}
            currentUser={currentUser}
            onClose={() => setIsDetailOpen(false)}
            onActivityUpdated={(updates) => handleUpdateActivity(selectedActivity.pageId, updates)}
          />
        )}
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
