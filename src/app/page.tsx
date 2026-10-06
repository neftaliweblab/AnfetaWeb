"use client";
import { mexicoDate } from "@/services/calendarPresentation";


import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TopBar } from "@/components/TopBar";
import { ResultsViewHost } from "@/components/ResultsViewHost/ResultsViewHost";
import { CalendarHost } from "@/components/CalendarHost/CalendarHost";
import { DailyProgressPanel } from "@/components/DailyProgressPanel/DailyProgressPanel";
import { MessagesHost } from "@/components/MessagesHost/MessagesHost";
import { RemindersCalendarHost } from "@/components/RemindersCalendarHost/RemindersCalendarHost";
import { SettingsModal } from "@/components/SettingsModal/SettingsModal";
import { LoginModal } from "@/components/LoginModal/LoginModal";
import { StatusBar } from "@/components/StatusBar";
import {
  ActiveHostView,
  SearchResultRow,
  NotionCalendarActivity,
  PendingTaskItem,
  ActiveProjectItem,
} from "@/types/anfeta";
import { parseAdvancedQuery, evaluateQueryAST, matchesFlexibleOrQuotedQuery } from "@/services/advancedQuery";
import {runCalendarAutomation} from '@/services/runCalendarAutomation';
import {mexicoMinutes} from '@/services/calendarPresentation';
import { CalendarAutomationModal } from "@/components/CalendarHost/CalendarAutomationModal";
import { anfetaSync, AnfetaSyncMessage } from "@/lib/anfetaBroadcastSync";

export default function AnfetaApp() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const auth = localStorage.getItem("anfeta_auth_session");
      if (auth) {
        const parsed = JSON.parse(auth);
        return !!parsed.authenticated;
      }
    } catch {}
    return false;
  });

  const [activeView, setActiveView] = useState<ActiveHostView>(() => {
    if (typeof window === "undefined") return "results";
    try {
      const savedView = localStorage.getItem("anfeta_active_view") as ActiveHostView;
      if (savedView && ["results", "calendar", "dailyProgress", "messages", "reminders"].includes(savedView)) {
        return savedView;
      }
    } catch {}
    return "results";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window === "undefined") return "nneft";
    try {
      const auth = localStorage.getItem("anfeta_auth_session");
      if (auth) {
        const parsed = JSON.parse(auth);
        if (parsed.user) return parsed.user;
      }
      const saved = localStorage.getItem("anfeta_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentUser) return parsed.currentUser;
      }
    } catch {}
    return "nneft";
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Data states
  const [searchIndex, setSearchIndex] = useState<SearchResultRow[]>([]);
  const [calendarLoadError, setCalendarLoadError] = useState("");
  const [calendarActivities, setCalendarActivities] = useState<NotionCalendarActivity[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(() => mexicoDate());
  const [pendingTasks, setPendingTasks] = useState<PendingTaskItem[]>([]);
  const [showAutomation, setShowAutomation] = useState(false);
  const [automationReport, setAutomationReport] = useState<any>(null);

  // Load local data from API route
  useEffect(() => {
    let userToken = "";
    try {
      const savedSettings = localStorage.getItem("anfeta_settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.currentUser) setCurrentUser(parsed.currentUser);
        if (parsed.notionToken) userToken = parsed.notionToken;
      }
    } catch {}

    async function loadInitialData() {
      try {
        // Search index con token en vivo si está configurado
        const idxUrl = `/api/data?type=search-index${userToken ? `&token=${encodeURIComponent(userToken)}` : ""}`;
        const idxRes = await fetch(idxUrl, {
          headers: userToken ? { "x-notion-token": userToken } : {},
        });
        if (idxRes.ok) {
          const idxData = await idxRes.json();
          if (idxData.items) setSearchIndex(idxData.items);
        }

        // Calendar dates and today's activities
        const calUrl = `/api/data?type=calendar&date=${currentDate}${userToken ? `&token=${encodeURIComponent(userToken)}` : ""}`;
        const calRes = await fetch(calUrl, {
          headers: userToken ? { "x-notion-token": userToken } : {},
        });
        {
          const calData = await calRes.json();
          if (!calRes.ok || calData.error) throw new Error(calData.error || 'No se pudo cargar el calendario.');
          setCalendarLoadError(calData.warning || '');
          if (calData.activities) setCalendarActivities(calData.activities);
          if (calData.availableDates?.length) {
            setAvailableDates(calData.availableDates);
          }
        }

        // Daily automation report
        const repRes = await fetch("/api/data?type=daily-report");
        if (repRes.ok) {
          const repData = await repRes.json();
          try {const local=JSON.parse(localStorage.getItem('anfeta-calendar-automation-report') || 'null');setAutomationReport(local && Date.parse(local.generatedAt)>Date.parse(repData.generatedAt || repData.GeneratedAt || '1970-01-01') ? local : repData);}catch{setAutomationReport(repData);}
        }

        // Pending tasks (manuales del usuario)
        try {
          const localSaved = localStorage.getItem("anfeta_pending_tasks");
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPendingTasks(parsed);
            }
          }
        } catch {}

        const penRes = await fetch("/api/data?type=pendientes");
        if (penRes.ok) {
          const penData = await penRes.json();
          if (Array.isArray(penData.items) && penData.items.length > 0) {
            setPendingTasks(penData.items);
          }
        }
      } catch (err) {
        setCalendarLoadError(err instanceof Error ? err.message : "No se pudieron cargar los datos.");
      }
    }
    loadInitialData();

    const handleSettingsChanged = (e: any) => {
      if (e.detail?.currentUser) {
        setCurrentUser(e.detail.currentUser);
      }
    };

    const handleDataRefreshed = async () => {
      try {
        let token = "";
        try {
          const s = localStorage.getItem("anfeta_settings");
          if (s) token = JSON.parse(s).notionToken || "";
        } catch {}

        const idxRes = await fetch(`/api/data?type=search-index${token ? `&token=${encodeURIComponent(token)}` : ""}`, {
          headers: token ? { "x-notion-token": token } : {},
        });
        if (idxRes.ok) {
          const idxData = await idxRes.json();
          if (idxData.items) setSearchIndex(idxData.items);
        }
        const calRes = await fetch(`/api/data?type=calendar&date=${currentDate}${token ? `&token=${encodeURIComponent(token)}` : ""}`, {
          headers: token ? { "x-notion-token": token } : {},
        });
        {
          const calData = await calRes.json();
          if (!calRes.ok || calData.error) throw new Error(calData.error || 'No se pudo cargar el calendario.');
          setCalendarLoadError(calData.warning || '');
          if (calData.activities) setCalendarActivities(calData.activities);
        }
      } catch {}
    };

    window.addEventListener("anfeta_settings_changed", handleSettingsChanged);
    window.addEventListener("anfeta_data_refreshed", handleDataRefreshed);

    return () => {
      window.removeEventListener("anfeta_settings_changed", handleSettingsChanged);
      window.removeEventListener("anfeta_data_refreshed", handleDataRefreshed);
    };
  }, [currentDate]);

  // Fetch activities when date changes
  useEffect(() => {
    const controller = new AbortController();
    setCalendarActivities([]);
    async function fetchCalendarForDate() {
      try {
        const res = await fetch(`/api/data?type=calendar&date=${currentDate}`, { signal: controller.signal });
        {
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || 'No se pudo cargar el calendario.');
          setCalendarLoadError(data.warning || '');
          if (data.activities) setCalendarActivities(data.activities);
        }
      } catch (err) {
        if (!controller.signal.aborted) setCalendarLoadError(err instanceof Error ? err.message : "No se pudo cargar el calendario.");
      }
    }
    fetchCalendarForDate();
    return () => controller.abort();
  }, [currentDate]);

  useEffect(()=>{
    if(!currentUser || !isAuthenticated) return;
    let running=false,stopped=false,lastAttempt=0;
    const check=async()=>{
      if(running||stopped||document.hidden||Date.now()-lastAttempt<300000) return;
      const today=mexicoDate(),key='anfeta-robot-confirmed:'+currentUser+':'+today;
      if(mexicoMinutes(new Date().toISOString())<300) return;
      try {if(localStorage.getItem(key)) return;} catch{}
      running=true;lastAttempt=Date.now();
      try {
        const report=await runCalendarAutomation(currentUser,today,partial=>{if(!stopped)setAutomationReport(partial);});
        if(!stopped){setAutomationReport(report);window.dispatchEvent(new Event('anfeta_data_refreshed'));}
        if(!report.failed)try{localStorage.setItem(key,'done');localStorage.setItem('anfeta-calendar-automation-report',JSON.stringify(report));}catch{}
        if(report.failed&&!stopped)setCalendarLoadError(report.errors.join(' · '));
      }catch(e){if(!stopped)setCalendarLoadError('Robot 05:00: '+(e instanceof Error?e.message:'No se pudo preparar la jornada.'));}
      finally{running=false;}
    };
    const timer=setInterval(check,60000);
    return()=>{stopped=true;clearInterval(timer);};
  },[currentUser,isAuthenticated]);

  // Global hotkeys (Ctrl+Alt+B, Ctrl+Shift+K, Ctrl+Shift+J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setActiveView("results");
        const el = document.getElementById("anfeta-search-input") as HTMLInputElement;
        if (el) {
          el.focus();
          el.select();
        }
      } else if (e.ctrlKey && e.shiftKey && (e.key === "K" || e.key === "k")) {
        e.preventDefault();
        setActiveView("calendar");
      } else if (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j")) {
        e.preventDefault();
        setActiveView("dailyProgress");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Persistir activeView en localStorage
  const handleSelectView = useCallback((view: ActiveHostView) => {
    setActiveView(view);
    try {
      localStorage.setItem("anfeta_active_view", view);
    } catch {}
  }, []);

  // Sincronización multi-monitor en tiempo real con la ventana independiente de Calendario y actividades
  useEffect(() => {
    const unsubscribe = anfetaSync.subscribe((msg: AnfetaSyncMessage) => {
      if (msg.type === "CALENDAR_REFRESHED" && msg.date === currentDate && msg.activities) {
        setCalendarActivities(msg.activities);
        const byId=new Map(msg.activities.filter((a:any)=>!a.isReviewMirror).map((a:any)=>[a.pageId.replace(/-/g,''),a]));
        setSearchIndex(prev=>prev.map(row=>{const a:any=byId.get((row.externalId || row.id || '').replace(/-/g,''));return a?{...row,name:a.title,assignedPerson:a.person,scheduledDate:mexicoDate(a.start),statusLabel:a.status}:row;}));
      } else if (msg.type === "ACTIVITY_UPDATED" && msg.pageId && msg.updates) {
        setSearchIndex(prev=>prev.map(row=>(row.externalId || row.id || '').replace(/-/g,'')===msg.pageId!.replace(/-/g,'') ? {...row,...(msg.updates.title?{name:msg.updates.title}:{}),...(msg.updates.person?{assignedPerson:msg.updates.person}:{}),...(msg.updates.status?{statusLabel:msg.updates.status}:{})}:row));
        setCalendarActivities((prev) =>
          prev.map((a) => (a.pageId === msg.pageId ? { ...a, ...msg.updates } : a))
        );
      } else if (msg.type === "ACTIVITY_CREATED" && msg.activity) {
        setCalendarActivities((prev) => {
          if (prev.some((a) => a.pageId === msg.activity.pageId)) return prev;
          return [...prev, msg.activity];
        });
      } else if (msg.sourceWindow === "calendar") {
        if (msg.type === "SYNC_QUERY" && typeof msg.query === "string") {
          setSearchQuery(msg.query);
        } else if (msg.type === "SYNC_DATE" && msg.date) {
          setCurrentDate(msg.date);
        }
      } else if (msg.type === "CALENDAR_STANDALONE_READY") {
        // Enviar estado actual a la ventana de calendario que acaba de abrirse
        anfetaSync.broadcast({
          type: "SYNC_QUERY",
          query: searchQuery,
          date: currentDate,
          sourceWindow: "main",
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [searchQuery, currentDate]);

  const handleSearchChange = useCallback((newQuery: string) => {
    setSearchQuery(newQuery);
    anfetaSync.broadcast({
      type: "SYNC_QUERY",
      query: newQuery,
      sourceWindow: "main",
    });
  }, []);

  const handleSelectDate = useCallback((newDate: string) => {
    setCurrentDate(newDate);
    anfetaSync.broadcast({
      type: "SYNC_DATE",
      date: newDate,
      sourceWindow: "main",
    });
  }, []);

  const handleOpenStandaloneCalendar = useCallback(() => {
    const url = `/calendar?standalone=true&q=${encodeURIComponent(searchQuery)}&date=${encodeURIComponent(currentDate)}`;
    window.open(url, "AnfetaCalendarStandalone", "width=1400,height=900,resizable=yes");
  }, [searchQuery, currentDate]);

  // Compute active projects today strictly from calendar (1:1 ANFETA WinUI)
  const activeProjects: ActiveProjectItem[] = useMemo(() => {
    const projectMap: Record<
      string,
      { count: number; activities: { title: string; rawTitle?: string; type: string; pageUrl?: string; activity?: any }[] }
    > = {};

    const domainPattern =
      /(?<![\w@])(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com\.mx|org\.mx|gob\.mx|edu\.mx|net\.mx|com|mx|org|net|io|co|app|dev|vip))(?=$|[/:?#\s)\]}>.,;!])/i;

    const isPlaceholderDomain = (d: string) => {
      if (!d) return true;
      const clean = d.trim().toLowerCase();
      return (
        [
          "dominio.com",
          "dominio.com.mx",
          "dominio.mx",
          "dominio.org",
          "dominio.net",
          "ejemplo.com",
          "ejemplo.com.mx",
          "ejemplo.mx",
          "example.com",
          "example.org",
          "example.net",
          "tudominio.com",
          "midominio.com",
          "midominio.com.mx",
          "general",
          "no content",
        ].includes(clean) || clean.includes("sin programas")
      );
    };

    const cleanProjectDomain = (rawDomain: string): { domain: string; detectedType: string } => {
      if (!rawDomain) return { domain: "", detectedType: "" };
      let d = rawDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
      if (d.startsWith("tzp.")) d = d.slice(4);
      else if (d.startsWith("tzs.")) d = d.slice(4);

      let detectedType = "";
      const prefixes = [
        { prefix: "ads.", area: "ADS" },
        { prefix: "ad.", area: "ADS" },
        { prefix: "aads.", area: "ADS" },
        { prefix: "seo.", area: "SEO" },
        { prefix: "sseo.", area: "SEO" },
        { prefix: "webs.", area: "WEB" },
        { prefix: "web.", area: "WEB" },
        { prefix: "wwebs.", area: "WEB" },
        { prefix: "maps.", area: "MAPS" },
        { prefix: "mmaps.", area: "MAPS" },
        { prefix: "app.", area: "APLICACION" },
        { prefix: "apli.", area: "APLICACION" },
        { prefix: "aapli.", area: "APLICACION" },
        { prefix: "software.", area: "PROGRAMAS" },
        { prefix: "prog.", area: "PROGRAMAS" },
        { prefix: "pprog.", area: "PROGRAMAS" },
        { prefix: "coti.", area: "COTIZACION" },
        { prefix: "ccoti.", area: "COTIZACION" },
        { prefix: "redes.", area: "REDES" },
        { prefix: "rrede.", area: "REDES" },
        { prefix: "bibl.", area: "BIBLIOTECA" },
        { prefix: "bbibl.", area: "BIBLIOTECA" },
      ];

      for (const p of prefixes) {
        if (d.startsWith(p.prefix)) {
          detectedType = p.area;
          d = d.slice(p.prefix.length);
          break;
        }
      }

      return { domain: d, detectedType };
    };

    const detectAreaFromTitle = (title: string): string => {
      const t = (title || "").toLowerCase();
      if (t.includes("seo") || t.includes("sseo")) return "SEO";
      if (t.includes("ads") || t.includes("aads")) return "ADS";
      if (t.includes("web") || t.includes("wweb")) return "WEB";
      if (t.includes("coti") || t.includes("cotiz")) return "COTI";
      if (t.includes("map") || t.includes("mmap")) return "MAPS";
      if (t.includes("red") || t.includes("rred") || t.includes("facebook") || t.includes("instagram")) return "REDES";
      if (t.includes("app") || t.includes("apli") || t.includes("aapli")) return "APP";
      if (t.includes("prog") || t.includes("pprog")) return "PROG";
      if (t.includes("bibl") || t.includes("bbibl")) return "BIBL";
      return "ACT";
    };

    const getCompactTitle = (title: string, domain: string): string => {
      if (!title) return "";
      let clean = title;
      if (domain) {
        const escapedDomain = domain.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        clean = clean.replace(new RegExp("(?:[a-z0-9_-]+\\.)*" + escapedDomain, "gi"), "").trim();
      }
      clean = clean.replace(/(?:a?prtuz|sprtuz|rtuz|z)REVISION/gi, "").trim();
      clean = clean.replace(/\d*-?\[[^\]]+\]/gi, "").trim();
      clean = clean.replace(/\b(?:tzp|tzs|ads|aads|seo|sseo|webs?|wwebs|maps?|mmaps|app|apli|aapli|prog|pprog|coti|redes)\.\s*/gi, "").trim();
      clean = clean.replace(/^[\s\-_:.]+|[\s\-_:.]+$/g, "").replace(/\s+/g, " ").trim();
      return clean || title;
    };

    // 1. Process ONLY calendar activities for the selected date
    calendarActivities.forEach((act) => {
      if (act.isReviewMirror) return;

      const title = act?.title || (act as any)?.Title || "";
      const rawDomainCandidate = act?.domain || (act as any)?.ParsedDomain || "";
      const pageUrl = act?.pageUrl || (act as any)?.PageUrl || "";

      let rawDomain = "";
      const matchDomain = rawDomainCandidate.match(domainPattern);
      const matchTitle = title.match(domainPattern);

      if (matchDomain) {
        rawDomain = matchDomain[1];
      } else if (matchTitle) {
        rawDomain = matchTitle[1];
      }

      if (!rawDomain) return;

      const { domain, detectedType } = cleanProjectDomain(rawDomain);
      if (isPlaceholderDomain(domain)) return;

      const area = detectedType && detectedType !== "ACT" ? detectedType : detectAreaFromTitle(title);
      const compactTitle = getCompactTitle(title, domain);

      if (!projectMap[domain]) {
        projectMap[domain] = { count: 0, activities: [] };
      }
      projectMap[domain].count += 1;
      projectMap[domain].activities.push({
        title: compactTitle,
        rawTitle: title,
        type: area,
        pageUrl,
        activity: act,
      });
    });

    return Object.entries(projectMap)
      .sort((a, b) => a[0].localeCompare(b[0], "es", { sensitivity: "base" }))
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        activities: data.activities,
      }));
  }, [calendarActivities]);

  // AST parsed query
  const queryAst = useMemo(() => {
    return parseAdvancedQuery(searchQuery);
  }, [searchQuery]);

  const searchFilter = useCallback(
    (item: SearchResultRow) => {
      return matchesFlexibleOrQuotedQuery(item, searchQuery);
    },
    [searchQuery]
  );

  // Pending tasks handlers
  // Persistent Pending tasks handlers (manuales del usuario)
  const persistPendingTasks = useCallback((tasks: PendingTaskItem[]) => {
    try {
      localStorage.setItem("anfeta_pending_tasks", JSON.stringify(tasks));
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-pendientes", payload: tasks }),
      }).catch((e) => console.warn("Error saving pendientes:", e));
    } catch (e) {
      console.warn("Error persisting pendientes:", e);
    }
  }, []);

  const handleTogglePendingTask = useCallback(
    (id: string) => {
      setPendingTasks((prev) => {
        const updated = prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
        persistPendingTasks(updated);
        return updated;
      });
    },
    [persistPendingTasks]
  );

  const handleAddPendingTask = useCallback(
    (newTask: Omit<PendingTaskItem, "id">) => {
      const item: PendingTaskItem = {
        ...newTask,
        id: `task_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setPendingTasks((prev) => {
        const updated = [item, ...prev];
        persistPendingTasks(updated);
        return updated;
      });
    },
    [persistPendingTasks]
  );

  const handleEditPendingTask = useCallback(
    (id: string, updatedData: Partial<PendingTaskItem>) => {
      setPendingTasks((prev) => {
        const updated = prev.map((t) => (t.id === id ? { ...t, ...updatedData } : t));
        persistPendingTasks(updated);
        return updated;
      });
    },
    [persistPendingTasks]
  );

  const handleDeletePendingTask = useCallback(
    (id: string) => {
      setPendingTasks((prev) => {
        const updated = prev.filter((t) => t.id !== id);
        persistPendingTasks(updated);
        return updated;
      });
    },
    [persistPendingTasks]
  );

  const handleDeleteAllPendingTasks = useCallback(() => {
    setPendingTasks([]);
    persistPendingTasks([]);
  }, [persistPendingTasks]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080B0F] text-[#F1F5F9] overflow-hidden select-none">
      {/* Top Bar with Navigation and Global Search */}
      <TopBar
        activeView={activeView}
        onSelectView={handleSelectView}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={() => handleSearchChange("")}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentUser={currentUser}
        onLogout={() => {
          try {
            localStorage.removeItem("anfeta_auth_session");
          } catch {}
          setIsAuthenticated(false);
        }}
        unreadCount={pendingTasks.filter((p) => !p.isCompleted).length}
        searchIndex={searchIndex}
        onTriggerAutomation={() => setShowAutomation(true)}
      />

      {/* Multi-Host Container (0ms latency, persistent in memory) */}
      <main className="flex-1 relative overflow-hidden">
        {/* Layer 1: ResultsViewHost (Search & Files) */}
        <div
          className={`absolute inset-0 z-10 transition-opacity ${
            activeView === "results" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          <ResultsViewHost
            isActive={activeView === "results"}
            items={searchIndex}
            pendingTasks={pendingTasks}
            activeProjects={activeProjects}
            onTogglePendingTask={handleTogglePendingTask}
            onAddPendingTask={handleAddPendingTask}
            onEditPendingTask={handleEditPendingTask}
            onDeletePendingTask={handleDeletePendingTask}
            onDeleteAllPendingTasks={handleDeleteAllPendingTasks}
            searchFilter={searchFilter}
            onSelectDomain={(domain) => handleSearchChange(domain)}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleCalendarView={() => setActiveView((prev) => (prev === "calendar" ? "results" : "calendar"))}
            isCalendarActive={activeView === "calendar"}
            onOpenStandaloneCalendar={handleOpenStandaloneCalendar}
            onToggleMessagesView={() => setActiveView((prev) => (prev === "messages" ? "results" : "messages"))}
            isMessagesActive={activeView === "messages"}
            messagesCount={0}
            onToggleRemindersView={() => setActiveView((prev) => (prev === "reminders" ? "results" : "reminders"))}
            isRemindersActive={activeView === "reminders"}
            remindersCount={0}
            currentUser={currentUser}
            onChangeCurrentUser={setCurrentUser}
          />
        </div>

        {/* Layer 2: CalendarHost (Timeline Canvas) */}
        <div
          className={`absolute inset-0 z-20 transition-opacity ${
            activeView === "calendar" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {showAutomation && <CalendarAutomationModal currentUser={currentUser} date={currentDate} onClose={()=>setShowAutomation(false)} onComplete={report=>{setAutomationReport(report);try{localStorage.setItem('anfeta-calendar-automation-report',JSON.stringify(report));}catch{}window.dispatchEvent(new Event('anfeta_data_refreshed'));}} />}
          <CalendarHost
                loadError={calendarLoadError}
            currentUser={currentUser}
            activities={calendarActivities}
            currentDate={currentDate}
            onSelectDate={handleSelectDate}
            availableDates={availableDates}
            onBackToSearch={() => setActiveView("results")}
            automationReport={automationReport}
            searchFilterQuery={searchQuery}
            onClearSearchFilter={() => handleSearchChange("")}
            onOpenStandaloneWindow={handleOpenStandaloneCalendar}
            onRunAutomation={() => setShowAutomation(true)}
            onOpenDailyProgress={() => setActiveView("dailyProgress")}
            onRefresh={async () => {
              try {
                const res = await fetch(`/api/data?type=calendar&date=${currentDate}`);
                {
                  const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || 'No se pudo cargar el calendario.');
          setCalendarLoadError(data.warning || '');
                  if (data.activities) setCalendarActivities(data.activities);
                }
              } catch (e) {
                setCalendarLoadError(e instanceof Error ? e.message : "No se pudo cargar el calendario.");
              }
            }}
          />
        </div>

        {/* Layer 3: DailyProgressPanel (KPIs & Lagging) */}
        <div
          className={`absolute inset-0 z-30 transition-opacity ${
            activeView === "dailyProgress" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          <DailyProgressPanel
            currentUser={currentUser}
            onSelectDate={handleSelectDate}
            activities={calendarActivities}
            currentDate={currentDate}
            automationReport={automationReport}
          />
        </div>

        {/* Layer 4: MessagesHost (Notes & Chat) */}
        <div
          className={`absolute inset-0 z-40 transition-opacity ${
            activeView === "messages" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          <MessagesHost />
        </div>

        {/* Layer 5: RemindersCalendarHost (24h Canvas) */}
        <div
          className={`absolute inset-0 z-45 transition-opacity ${
            activeView === "reminders" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          <RemindersCalendarHost />
        </div>
      </main>

      {/* Persistent Bottom Status Bar */}
      <StatusBar
        indexedCount={searchIndex.length}
        currentUser={currentUser}
        lastSyncTime="En línea (0ms)"
      />

      {/* Settings Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onSaveCurrentUser={setCurrentUser}
      />

      {/* Login Corporativo Modal */}
      {!isAuthenticated && (
        <LoginModal
          onSuccess={(userTag) => {
            setCurrentUser(userTag);
            setIsAuthenticated(true);
          }}
        />
      )}
    </div>
  );
}
