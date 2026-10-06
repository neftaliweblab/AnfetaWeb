"use client";
import { mexicoDate } from "@/services/calendarPresentation";


import React, { useState, useEffect, useCallback, useMemo } from "react";
import { NotionCalendarActivity } from "@/types/anfeta";
import { CalendarHost } from "@/components/CalendarHost/CalendarHost";
import { anfetaSync, AnfetaSyncMessage } from "@/lib/anfetaBroadcastSync";
import { Search, X, Sparkles, ExternalLink, Calendar, RefreshCw } from "lucide-react";

export default function StandaloneCalendarPage() {
  const [currentDate, setCurrentDate] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const urlDate = p.get("date");
      if (urlDate) return urlDate;
    }
    return mexicoDate();
  });

  const [currentUser, setCurrentUser] = useState('');
  useEffect(() => {
    const readUser = () => { try { setCurrentUser(JSON.parse(localStorage.getItem('anfeta_settings') || '{}').currentUser || 'nneft'); } catch { setCurrentUser('nneft'); } };
    readUser(); window.addEventListener('storage', readUser); window.addEventListener('anfeta_settings_changed', readUser);
    return () => { window.removeEventListener('storage', readUser); window.removeEventListener('anfeta_settings_changed', readUser); };
  }, []);
  const [calendarLoadError, setCalendarLoadError] = useState("");
  const [calendarActivities, setCalendarActivities] = useState<NotionCalendarActivity[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [searchFilterQuery, setSearchFilterQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<string>("Sincronizado con Buscador Principal");

  // Cargar actividades de la fecha
  const loadCalendarData = useCallback(async (dateToLoad: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/data?type=calendar&date=${dateToLoad}`);
      {
        const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || 'No se pudo cargar el calendario.');
          setCalendarLoadError(data.warning || '');
        if (data.activities) setCalendarActivities(data.activities);
        if (data.availableDates) setAvailableDates(data.availableDates);
      }
    } catch (err) {
      setCalendarLoadError(err instanceof Error ? err.message : "No se pudo cargar el calendario.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendarData(currentDate);
  }, [currentDate, loadCalendarData]);

  // Suscribirse a mensajes del Buscador Principal en tiempo real
  useEffect(() => {
    // Si viene filtro inicial por URL
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const initialQ = p.get("q") || p.get("filter");
      if (initialQ) setSearchFilterQuery(initialQ);
    }

    const unsubscribe = anfetaSync.subscribe((msg: AnfetaSyncMessage) => {
      if (msg.type === "SYNC_QUERY" && typeof msg.query === "string") {
        setSearchFilterQuery(msg.query);
        setSyncStatus(`Filtro sincronizado: "${msg.query}"`);
        setTimeout(() => setSyncStatus("Sincronizado con Buscador Principal"), 3000);
      } else if (msg.type === "SYNC_DATE" && msg.date) {
        setCurrentDate(msg.date);
      } else if (msg.type === "SYNC_SELECT_DOMAIN" && msg.domain) {
        setSearchFilterQuery(msg.domain);
      }
    });

    // Notificar que la ventana independiente está lista
    anfetaSync.broadcast({
      type: "CALENDAR_STANDALONE_READY",
      sourceWindow: "calendar",
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Al escribir en el buscador de la ventana de calendario, sincronizar de regreso al buscador principal
  const handleQueryChange = (q: string) => {
    setSearchFilterQuery(q);
    anfetaSync.broadcast({
      type: "SYNC_QUERY",
      query: q,
      sourceWindow: "calendar",
    });
  };

  const handleSelectDate = (newDate: string) => {
    setCurrentDate(newDate);
    anfetaSync.broadcast({
      type: "SYNC_DATE",
      date: newDate,
      sourceWindow: "calendar",
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080B0F] text-[#F1F5F9] overflow-hidden select-none">
      {/* Barra superior de Ventana Independiente / Multi-Monitor */}
      <header className="h-12 bg-[#0F141A] border-b border-[#26323E] px-3 flex items-center justify-between gap-3 flex-shrink-0 z-50">
        <div className="flex items-center gap-2.5">
          <img
            src="/anfeta-logo.png"
            alt="ANFETA"
            className="w-6 h-6 rounded object-contain shadow-[0_0_8px_rgba(0,168,255,0.4)]"
          />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00A8FF] via-[#38BDF8] to-[#4ADE80]">
              ANFETA
            </span>
            <span className="text-[9.5px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#131A22] text-[#38BDF8] border border-[#223848]">
              CALENDARIO · MULTI-MONITOR
            </span>
          </div>
        </div>

        {/* Buscador Sincronizado en Tiempo Real */}
        <div className="flex-1 max-w-md relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={searchFilterQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Filtrar actividades en el calendario (sincronizado con buscador principal)..."
            className="w-full h-7 pl-8 pr-7 bg-[#080B0F] text-[#F1F5F9] text-[11px] placeholder-[#64748B] rounded border border-[#26323E] focus:border-[#00A8FF] focus:outline-none transition-all"
          />
          {searchFilterQuery && (
            <button
              onClick={() => handleQueryChange("")}
              className="absolute right-1.5 p-0.5 text-[#94A3B8] hover:text-[#F1F5F9]"
              title="Limpiar filtro"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Estado de Enlace / Sincronización */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#10201C] border border-[#166534]/50 text-[#86EFAC] text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            <span>{syncStatus}</span>
          </div>

          <button
            onClick={() => loadCalendarData(currentDate)}
            className="p-1 rounded bg-[#131A22] hover:bg-[#18212B] text-[#94A3B8] hover:text-[#38BDF8] border border-[#223848] transition-colors"
            title="Recargar actividades del día"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#38BDF8]" : ""}`} />
          </button>
        </div>
      </header>

      {/* Canvas del Calendario */}
      <main className="flex-1 relative overflow-hidden">
        <CalendarHost
                loadError={calendarLoadError}
          currentUser={currentUser}
          activities={calendarActivities}
          currentDate={currentDate}
          onSelectDate={handleSelectDate}
          availableDates={availableDates}
          searchFilterQuery={searchFilterQuery}
          onClearSearchFilter={() => handleQueryChange("")}
          onRefresh={() => loadCalendarData(currentDate)}
        />
      </main>
    </div>
  );
}
