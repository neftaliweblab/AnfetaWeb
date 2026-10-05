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
import { anfetaSync } from '@/lib/anfetaBroadcastSync';
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

  // Listener en tiempo real multi-ventana y multi-pestaña
  useEffect(() => {
    const unsubscribe = anfetaSync.subscribe((msg) => {
      if (msg.type === "ACTIVITY_UPDATED" && msg.pageId && msg.updates) {
        setActivitiesList((prev) =>
          prev.map((a) => (a.pageId === msg.pageId ? { ...a, ...msg.updates } : a))
        );
        setSelectedActivity((prev) =>
          prev && prev.pageId === msg.pageId ? { ...prev, ...msg.updates } : prev
        );
      } else if (msg.type === "ACTIVITY_CREATED" && msg.activity) {
        setActivitiesList((prev) => {
          if (prev.some((a) => a.pageId === msg.activity.pageId)) return prev;
          return [...prev, msg.activity];
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleChangeZoom = (delta: number) => {
    setPixelsPerHour((prev) => Math.min(120, Math.max(48, prev + delta)));
  };

  const handleUpdateActivity = async (pageId: string, updates: Partial<NotionCalendarActivity>) => {
    const original = activitiesList.find(a => a.pageId === pageId);
    if (!original || !canEditActivity(currentUser, original) || pending.current.has(pageId)) return;
    if (updates.person && normalizePerson(updates.person) !== normalizePerson(original.person) && !isDirection(currentUser)) return;
    pending.current.add(pageId); setError('');

    // Actualización reactiva instantánea local
    setActivitiesList(prev => prev.map(a => a.pageId === pageId ? { ...a, ...updates } : a));
    setSelectedActivity(prev => prev && prev.pageId === pageId ? { ...prev, ...updates } : prev);

    // Difusión instantánea en tiempo real
    anfetaSync.broadcast({
      type: "ACTIVITY_UPDATED",
      pageId,
      updates,
    });

    try {
      const response = await fetch('/api/data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: updates.start ? 'update-activity-schedule' : updates.person ? 'update-activity-assignee' : 'update-activity-status',
          payload: { id: pageId, currentUser, ...updates } }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo guardar la actividad.');
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

  const [createSlotSeed, setCreateSlotSeed] = useState<{
    person: string;
    start: string;
    end: string;
  } | null>(null);

  // Current time tracking
  const [currentDateMinutes, setCurrentDateMinutes] = useState<number | null>(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (currentDate === todayStr) {
      return (now.getHours() - startHour) * 60 + now.getMinutes();
    }
    return null;
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (currentDate === todayStr) {
        setCurrentDateMinutes((now.getHours() - startHour) * 60 + now.getMinutes());
      } else {
        setCurrentDateMinutes(null);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [currentDate, startHour]);

  // Click on empty slot in column
  const handleColumnCanvasClick = (e: React.MouseEvent<HTMLDivElement>, colPerson: string) => {
    // Only trigger if clicking on the background canvas, not a child card
    if ((e.target as HTMLElement).closest('[data-activity-card="true"]')) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = Math.max(0, e.clientY - rect.top);
    const rawMinutes = (offsetY / pixelsPerHour) * 60;
    // Round to nearest 15 minutes
    let snappedMinutes = Math.round(rawMinutes / 15) * 15;
    const maxStartMinutes = (endHour - startHour) * 60 - 15;
    snappedMinutes = Math.min(Math.max(0, snappedMinutes), maxStartMinutes);

    const startTotalMinutes = startHour * 60 + snappedMinutes;
    const startH = Math.floor(startTotalMinutes / 60);
    const startM = startTotalMinutes % 60;

    // Default duration 60 mins (or up to 22:00)
    const endTotalMinutes = Math.min(endHour * 60, startTotalMinutes + 60);
    const endH = Math.floor(endTotalMinutes / 60);
    const endM = endTotalMinutes % 60;

    const startFormatted = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
    const endFormatted = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    setCreateSlotSeed({
      person: colPerson,
      start: startFormatted,
      end: endFormatted,
    });
    setShowCreate(true);
  };

  const handleDropOnColumn = (e: React.DragEvent, colPerson: string) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { pageId, offsetY = 0 } = JSON.parse(dataStr);
      const activity = activitiesList.find(a => a.pageId === pageId);
      if (!activity || !canEditActivity(currentUser, activity) || normalizePerson(activity.person) !== colPerson) return;

      const columnRect = e.currentTarget.getBoundingClientRect();
      // 56px es la altura del CalendarColHeader
      const y = Math.max(0, e.clientY - columnRect.top - 56 - offsetY);
      const newSchedule = scheduleAtDrop(activity, currentDate, (y / pixelsPerHour) * 60);

      // 1. Optimistic Update inmediato para fluidez absoluta
      setActivitiesList(prev => prev.map(a => a.pageId === pageId ? { ...a, ...newSchedule } : a));
      setSelectedActivity(prev => prev && prev.pageId === pageId ? { ...prev, ...newSchedule } : prev);

      // 2. Persistir en Notion API / backend en segundo plano
      void handleUpdateActivity(pageId, newSchedule);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Movimiento inválido');
    }
  };

  // Red line Y position
  const currentTimeTop = currentDateMinutes !== null && currentDateMinutes >= 0 && currentDateMinutes <= totalHours * 60
    ? (currentDateMinutes / 60) * pixelsPerHour
    : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B0F]">
      {error && <div role="alert" className="px-3 py-2 text-sm text-rose-300">{error}</div>}
      {showCreate && (
        <CreateActivityModal
          currentUser={currentUser}
          date={currentDate}
          initialPerson={createSlotSeed?.person}
          initialStart={createSlotSeed?.start}
          initialEnd={createSlotSeed?.end}
          onClose={() => {
            setShowCreate(false);
            setCreateSlotSeed(null);
          }}
          onCreated={(activity) => {
            setActivitiesList((prev) => [...prev, activity]);
            anfetaSync.broadcast({
              type: "ACTIVITY_CREATED",
              activity,
            });
            setShowCreate(false);
            setCreateSlotSeed(null);
            onRefresh?.();
          }}
        />
      )}
      <CalendarTopControls
        onCreateActivity={() => {
          setCreateSlotSeed(null);
          setShowCreate(true);
        }}
        currentDate={currentDate}
        onSelectDate={onSelectDate}
        availableDates={availableDates}
        onOpenPeoplePicker={() => setShowPeoplePicker(true)}
        totalActivitiesCount={filteredActivities.length}
        pixelsPerHour={pixelsPerHour}
        onChangeZoom={handleChangeZoom}
        onResetZoom={() => setPixelsPerHour(72)}
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
              {/* Current time red tag on time rail */}
              {currentTimeTop !== null && (
                <div
                  style={{ top: `${currentTimeTop}px` }}
                  className="absolute right-0 -translate-y-1/2 z-50 flex items-center"
                >
                  <span className="bg-[#EF4444] text-white text-[8.5px] font-bold px-1 rounded-l shadow-sm font-mono">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Collaborators Columns - Fluid and Auto-expanding with min width guarantee */}
          <div className="flex min-w-full w-max relative">
            {/* Global red line across all columns */}
            {currentTimeTop !== null && (
              <div
                style={{ top: `${currentTimeTop + 56}px` }}
                className="absolute left-0 right-0 h-[2px] bg-[#EF4444] z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.7)]"
              >
                <div className="w-2 h-2 rounded-full bg-[#EF4444] -translate-y-[3px] -translate-x-1" />
              </div>
            )}

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

                // Compute person KPIs
                let totalChecks = 0;
                let doneChecks = 0;
                let totalCoverageHours = 0;

                personActivities.forEach((act) => {
                  totalChecks += act.checklistTotal || 0;
                  doneChecks += act.checklistCompleted || 0;
                  if (act.start && act.end) {
                    const st = new Date(act.start).getTime();
                    const en = new Date(act.end).getTime();
                    if (en > st) {
                      totalCoverageHours += (en - st) / 3600000;
                    }
                  }
                });

                const checklistPercent = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0;

                return (
                  <div
                    key={person}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnColumn(e, person)}
                    className="flex-1 min-w-[220px] max-w-[320px] border-r border-[#26323E] flex flex-col"
                    style={{ height: `${canvasHeight + 56}px` }}
                  >
                    <CalendarColHeader
                      personName={person}
                      activityCount={personActivities.length}
                      checklistPercent={checklistPercent}
                      totalChecklistItems={totalChecks}
                      completedChecklistItems={doneChecks}
                      coverageHours={totalCoverageHours}
                      onSelectPerson={(p) => setSelectedPersonPreview(p)}
                    />
                    <div
                      onClick={(e) => handleColumnCanvasClick(e, person)}
                      className="relative flex-1 bg-[#080B0F] cursor-pointer"
                      style={{ height: `${canvasHeight}px` }}
                      title={`Haz clic en un hueco vacío para crear actividad para ${person}`}
                    >
                      {hoursList.map((_, idx) => (
                        <div
                          key={idx}
                          style={{ top: `${idx * pixelsPerHour}px` }}
                          className="absolute w-full h-px bg-[#161F2B] pointer-events-none"
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
            allActivities={activitiesList}
            onSelectActivity={(act) => setSelectedActivity(act)}
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
