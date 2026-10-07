"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  Calendar,
  MessageSquare,
  Bell,
  TrendingUp,
  Settings,
  X,
  Clock,
  Sparkles,
  LogOut,
} from "lucide-react";
import {TeamPresence} from './TeamPresence';
import { ActiveHostView } from "@/types/anfeta";
import { SearchPredictiveFlyout } from "./ResultsViewHost/SearchPredictiveFlyout";
import { buildPredictiveData } from "@/lib/searchPredictiveService";

interface TopBarProps {
  activeView: ActiveHostView;
  onSelectView: (view: ActiveHostView) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onClearSearch: () => void;
  onOpenSettings: () => void;
  onLogout?: () => void;
  onChangePerson?: () => void;
  currentUser?: string;
  unreadCount?: number;
  onTriggerAutomation?: () => void;
  searchIndex?: any[];
}

export function TopBar({
  activeView,
  onSelectView,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onOpenSettings,
  onLogout,
  onChangePerson,
  currentUser,
  unreadCount = 0,
  onTriggerAutomation,
  searchIndex = [],
}: TopBarProps) {
  const [timeStr, setTimeStr] = React.useState("");
  const [isPredictiveOpen, setIsPredictiveOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const predictiveData = useMemo(() => {
    return buildPredictiveData(searchQuery, searchIndex);
  }, [searchQuery, searchIndex]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsPredictiveOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-14 bg-[#0F141A] border-b border-[#26323E] px-4 flex items-center justify-between gap-4 select-none flex-shrink-0 z-50">
      <TeamPresence/>
      {onChangePerson&&<button onClick={onChangePerson} className="shrink-0 rounded border border-cyan-900 bg-slate-900 px-2 py-1 text-xs text-cyan-200" title="Cambiar persona activa">{currentUser||'Elegir persona'} ▾</button>}
      {/* Brand logo */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => onSelectView("results")}
          title="ANFETA - Productividad Ejecutiva"
        >
          <img
            src="/anfeta-logo.png"
            alt="ANFETA"
            className="w-7 h-7 rounded-md object-contain shadow-[0_0_12px_rgba(0,168,255,0.45)] group-hover:scale-105 transition-transform"
          />
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00A8FF] via-[#38BDF8] to-[#4ADE80] drop-shadow-[0_0_12px_rgba(0,168,255,0.45)]">
              ANFETA
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-[#131A22] text-[#38BDF8] border border-[#223848]">
              v2.0
            </span>
          </div>
        </div>
      </div>

      {/* Global Search Bar con Flyout Predictivo */}
      <div ref={searchContainerRef} className="flex-1 max-w-xl relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-[#94A3B8]" />
          <input
            id="anfeta-search-input"
            type="text"
            value={searchQuery}
            onFocus={() => setIsPredictiveOpen(true)}
            onClick={() => setIsPredictiveOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsPredictiveOpen(false);
              } else if (e.key === "Enter") {
                setIsPredictiveOpen(false);
              }
            }}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setIsPredictiveOpen(true);
              if (activeView !== "results") onSelectView("results");
            }}
            placeholder="Buscar por término, ext:pdf, folder:dropbox, dm:3, regex:, o *comodín* (Ctrl+Alt+B)..."
            className="w-full h-9 pl-9 pr-8 bg-[#080B0F] text-[#F1F5F9] text-xs placeholder-[#64748B] rounded border border-[#26323E] focus:border-[#00A8FF] focus:outline-none focus:ring-1 focus:ring-[#00A8FF] transition-all shadow-[0_0_10px_rgba(0,168,255,0.12)]"
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-2 p-1 text-[#94A3B8] hover:text-[#F1F5F9]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Panel Predictivo Flotante */}
        <SearchPredictiveFlyout
          isOpen={isPredictiveOpen}
          onClose={() => setIsPredictiveOpen(false)}
          headerText={predictiveData.headerText}
          suggestions={predictiveData.suggestions}
          savedSearches={predictiveData.savedSearches}
          hintText={predictiveData.hintText}
          currentQuery={searchQuery}
          onApplyQuery={(newQ) => {
            onSearchChange(newQ);
            if (activeView !== "results") onSelectView("results");
          }}
        />
      </div>

      {/* Navigation Host Buttons */}
      <nav className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onSelectView("results")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeView === "results"
              ? "bg-[#18212B] text-[#00A8FF] border border-[#00A8FF]/40 shadow-[0_0_8px_rgba(0,168,255,0.25)]"
              : "text-[#94A3B8] hover:bg-[#131A22] hover:text-[#E2E8F0]"
          }`}
          title="Buscador"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Buscador</span>
        </button>

        <button
          onClick={() => onSelectView("calendar")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeView === "calendar"
              ? "bg-[#18212B] text-[#00A8FF] border border-[#00A8FF]/40 shadow-[0_0_8px_rgba(0,168,255,0.25)]"
              : "text-[#94A3B8] hover:bg-[#131A22] hover:text-[#E2E8F0]"
          }`}
          title="Calendario"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Calendario</span>
        </button>

        <button
          onClick={() => onSelectView("dailyProgress")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeView === "dailyProgress"
              ? "bg-[#18212B] text-[#4ADE80] border border-[#4ADE80]/40 shadow-[0_0_8px_rgba(74,222,128,0.25)]"
              : "text-[#94A3B8] hover:bg-[#131A22] hover:text-[#E2E8F0]"
          }`}
          title="Avance Diario"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Avance Diario</span>
        </button>

        <button
          onClick={() => onSelectView("messages")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeView === "messages"
              ? "bg-[#18212B] text-[#00A8FF] border border-[#00A8FF]/40"
              : "text-[#94A3B8] hover:bg-[#131A22] hover:text-[#E2E8F0]"
          }`}
          title="Mensajes"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Mensajes</span>
        </button>

        <button
          onClick={() => onSelectView("reminders")}
          className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeView === "reminders"
              ? "bg-[#18212B] text-[#A855F7] border border-[#A855F7]/40 shadow-[0_0_8px_rgba(168,85,247,0.25)]"
              : "text-[#94A3B8] hover:bg-[#131A22] hover:text-[#E2E8F0]"
          }`}
          title="Recordatorios"
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Recordatorios</span>
          {unreadCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#FB7185] animate-pulse" />
          )}
        </button>
      </nav>

      {/* Right controls: clock, automation robot, settings */}
      <div className="flex items-center gap-2">
        {onTriggerAutomation && (
          <button
            onClick={onTriggerAutomation}
            title="Ejecutar robot de rezagadas de las 05:00 AM"
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-[#131A22] hover:bg-[#18212B] text-[#38BDF8] border border-[#223848]"
          >
            <Sparkles className="w-3 h-3 text-[#00A8FF]" />
            <span>Robot 05:00</span>
          </button>
        )}

        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-[#080B0F] border border-[#26323E] rounded text-xs font-mono text-[#94A3B8]">
          <Clock className="w-3 h-3 text-[#38BDF8]" />
          <span>{timeStr}</span>
        </div>

        <button
          onClick={onOpenSettings}
          title="Configuración general"
          className="p-2 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#131A22] rounded transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            title={currentUser ? `Cerrar sesión (${currentUser})` : "Cerrar sesión"}
            className="flex items-center gap-1 px-2 py-1 text-xs text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-900/40 rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline font-mono text-[11px]">{currentUser || "Salir"}</span>
          </button>
        )}
      </div>
    </header>
  );
}
