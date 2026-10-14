"use client";
import {openCalendarWindow} from '@/services/windowsIntegration';
import {indexAvailability} from '@/lib/indexAvailability';
import {retainSearchResults} from '@/lib/retainSearchResults';
import {loadSearchIndex} from '@/lib/loadSearchIndex';
import {loadCachedIndex,saveCachedIndex} from '@/lib/clientIndexCache';

import {readApiJson} from '@/lib/readApiJson';
import { mexicoDate } from "@/services/calendarPresentation";


import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { TopBar } from "@/components/TopBar";
import { ResultsViewHost } from "@/components/ResultsViewHost/ResultsViewHost";
import { CalendarHost } from "@/components/CalendarHost/CalendarHost";
import { DailyProgressPanel } from "@/components/DailyProgressPanel/DailyProgressPanel";
import { MessagesHost } from "@/components/MessagesHost/MessagesHost";
import { RemindersCalendarHost } from "@/components/RemindersCalendarHost/RemindersCalendarHost";
import { SettingsModal } from "@/components/SettingsModal/SettingsModal";
import { normalizePerson } from "@/services/identityNormalizer";
import {PersonSelector} from '@/components/LoginModal/PersonSelector';
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

import {OfflineMutationQueue} from '@/services/offlineQueue';
import {authErrorMessage} from '@/lib/authErrorMessage';
export default function AnfetaApp() {
  const [sharedMode,setSharedMode]=useState(true),[personPickerOpen,setPersonPickerOpen]=useState(false);
  const [isAuthenticated,setIsAuthenticated]=useState(false),[authChecking,setAuthChecking]=useState(true),[authError,setAuthError]=useState('');
  const isAuthRef = useRef(false);
  isAuthRef.current = isAuthenticated;
  const refreshAuthRef = useRef<() => void>(() => {});

  useEffect(()=>{
    let stopped=false,busy=false,generation=0;
    let controller=new AbortController();
    const changed=()=>{generation++;controller.abort();controller=new AbortController();busy=false;};

    const refresh=async(manualRetry=false, isInitial=false)=>{
      if(stopped||(busy&&!manualRetry)||(!manualRetry&&document.hidden))return;
      busy=true;
      if(manualRetry){
        controller.abort();
        controller=new AbortController();
      }
      const request=++generation;
      for(let attempt=0;attempt<1;attempt++){
        try{
          const response=await fetch('/api/auth',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(28000)])});
          if(stopped||request!==generation)return;
          if([400,401,403].includes(response.status)){
            OfflineMutationQueue.setOwner('');
            setIsAuthenticated(false);
          }
          const data=await readApiJson(response);
          if(stopped||request!==generation)return;
          OfflineMutationQueue.setOwner(data.authenticated?data.ownerId||'':'');
          setIsAuthenticated(data.authenticated===true);
          setSharedMode(data.sharedMode===true);
          if(data.authenticated)setCurrentUser(data.user||'');
          setAuthError('');
          break;
        }catch(error){
          if(stopped||request!==generation)return;
          const msg=authErrorMessage(error);
          const isTransient=/tardó|timeout|network|503|fetch|abort/i.test(msg);
          if(isAuthRef.current&&!manualRetry&&isTransient){
            break;
          }
          setAuthError(msg);
        }
      }
      busy=false;
      if(!stopped)setAuthChecking(false);
    };

    refreshAuthRef.current=()=>{
      setAuthError('');
      if(!isAuthRef.current)setAuthChecking(true);
      void refresh(true);
    };

    void refresh(false,true);
    const timer=setInterval(()=>void refresh(false),120000);
    const onFocus=()=>void refresh(false);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onFocus);
    window.addEventListener('anfeta_auth_changed',changed);
    return()=>{
      stopped=true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus',onFocus);
      document.removeEventListener('visibilitychange',onFocus);
      window.removeEventListener('anfeta_auth_changed',changed);
    };
  },[]);

  const [activeView, setActiveView] = useState<ActiveHostView>(() => {
    if (typeof window === "undefined") return "results";
    try {
      if(new URLSearchParams(window.location.search).get('view')==='messages')return 'messages';
      const savedView = localStorage.getItem("anfeta_active_view") as ActiveHostView;
      if (savedView && ["results", "calendar", "dailyProgress", "messages", "reminders"].includes(savedView)) {
        return savedView;
      }
    } catch {}
    return "results";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [calendarPopupBlocked,setCalendarPopupBlocked]=useState(false);
  const [indexSyncLabel,setIndexSyncLabel]=useState('Iniciando catálogo...');
  useEffect(()=>{
    const update=(event:Event)=>{
      const data=(event as CustomEvent).detail||{};
      setIndexSyncLabel(indexAvailability(data));
    };
    window.addEventListener('anfeta_index_status',update);
    return()=>window.removeEventListener('anfeta_index_status',update);
  },[]);
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
  useEffect(()=>{let stopped=false;setSearchIndex([]);if(isAuthenticated&&currentUser)void loadCachedIndex(currentUser).then(cached=>{if(!stopped&&cached?.items){setSearchIndex(old=>old.length?old:cached.items);setIndexSyncLabel(indexAvailability(cached));}});return()=>{stopped=true;};},[isAuthenticated,currentUser]);
  const [calendarCacheMeta,setCalendarCacheMeta]=useState<any>(null);
  const [calendarLoadError, setCalendarLoadError] = useState("");
  const [calendarActivities, setCalendarActivities] = useState<NotionCalendarActivity[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(() => mexicoDate());
  const pendingRevision=useRef<number|undefined>(undefined),pendingItems=useRef<PendingTaskItem[]>([]),pendingQueue=useRef(Promise.resolve()),pendingOwner=useRef(currentUser);
  pendingOwner.current=currentUser;
  const [pendingError,setPendingError]=useState('');
  const [pendingTasks, setPendingTasks] = useState<PendingTaskItem[]>([]);
  useEffect(()=>{pendingRevision.current=undefined;pendingItems.current=[];setPendingTasks([]);setPendingError('');},[currentUser,isAuthenticated]);
  const [showAutomation, setShowAutomation] = useState(false);
  const [automationReport, setAutomationReport] = useState<any>(null);

  // Load local data from API route
  useEffect(() => {
    if(!isAuthenticated||!currentUser)return;
    let stopped=false,indexTimer:ReturnType<typeof setTimeout>|undefined,indexInterval:ReturnType<typeof setInterval>|undefined,indexFocus:(()=>void)|undefined,indexBusy=false,indexPolling=false,indexStarted=Date.now(),indexVersion:string|undefined;const initialController=new AbortController();
    let userToken = "";
    try {
      const savedSettings = localStorage.getItem("anfeta_settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);

        if (parsed.notionToken) userToken = parsed.notionToken;
      }
    } catch {}

    async function loadInitialData() {
      try {
        const loadIndex=async()=>{if(stopped||indexBusy||document.hidden)return;indexBusy=true;if(indexTimer)clearTimeout(indexTimer);try{const data=await loadSearchIndex({signal:initialController.signal,knownVersion:indexVersion,onPartial:(partial)=>{if(!stopped&&partial?.items?.length){setSearchIndex(previous=>retainSearchResults(previous,partial));setIndexSyncLabel(`Cargando catálogo (${partial.items.length.toLocaleString()}...`);}}});indexVersion=data.indexVersion;if(stopped)return;if(Array.isArray(data.items)){setSearchIndex(previous=>retainSearchResults(previous,data));void saveCachedIndex(data,currentUser);}window.dispatchEvent(new CustomEvent('anfeta_index_status',{detail:data}));if(data.cacheMeta?.syncing){if(!indexPolling){indexPolling=true;indexStarted=Date.now();}if(Date.now()-indexStarted<120000)indexTimer=setTimeout(()=>void loadIndex(),15000);else window.dispatchEvent(new CustomEvent('anfeta_index_status',{detail:{...data,warning:'La sincronización sigue pendiente. Usa Refrescar para consultar su estado.',cacheMeta:{...data.cacheMeta,syncing:false}}}));}else indexPolling=false;}catch(error){if(!stopped){window.dispatchEvent(new CustomEvent('anfeta_index_status',{detail:{warning:error instanceof Error?error.message:'No se pudo actualizar el índice.'}}));}}finally{indexBusy=false;}};
        void loadIndex();indexFocus=()=>void loadIndex();window.addEventListener('anfeta_settings_changed',indexFocus);indexInterval=setInterval(indexFocus,120000);window.addEventListener('focus',indexFocus);

        // Calendar dates and today's activities
        const calUrl = `/api/data?type=calendar&basic=1&date=${currentDate}`;
        const calRes = await fetch(calUrl, {
          headers: userToken ? { "x-notion-token": userToken } : {},
        });
        {
          const calData = await readApiJson(calRes);
          if(stopped)return;
          if (!calRes.ok || calData.error) throw new Error(calData.error || 'No se pudo cargar el calendario.');
          setCalendarLoadError(calData.warning || '');setCalendarCacheMeta(calData.cacheMeta||null);
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

        pendingRevision.current=undefined;pendingItems.current=[];setPendingTasks([]);
        try {const data=await readApiJson(await fetch('/api/data?type=pendientes',{cache:'no-store'}));if(stopped||pendingOwner.current!==currentUser)return;pendingRevision.current=data.revision;pendingItems.current=data.items||[];setPendingTasks(pendingItems.current);setPendingError('');}catch(e){setPendingError(e instanceof Error?e.message:'No se pudieron cargar los pendientes.');}
      } catch (err) {
        setCalendarLoadError(err instanceof Error ? err.message : "No se pudieron cargar los datos.");
      }
    }
    loadInitialData();

    const handleSettingsChanged = () => {
      // Configuraciones actualizadas sin forzar selector de persona
    };

    const handleDataRefreshed = async () => {
      try {
        let token = "";
        try {
          const s = localStorage.getItem("anfeta_settings");
          if (s) token = JSON.parse(s).notionToken || "";
        } catch {}

        const idxData=await loadSearchIndex({ token, onPartial:(p)=>{if(p?.items?.length){setSearchIndex(prev=>retainSearchResults(prev,p));setIndexSyncLabel(`Cargando catálogo (${p.items.length.toLocaleString()}...`);}} });if(Array.isArray(idxData.items)){setSearchIndex(previous=>retainSearchResults(previous,idxData));void saveCachedIndex(idxData,currentUser);}window.dispatchEvent(new CustomEvent('anfeta_index_status',{detail:idxData}));
        const calRes = await fetch(`/api/data?type=calendar&basic=1&date=${currentDate}`, {
          headers: token ? { "x-notion-token": token } : {},
        });
        {
          const calData = await readApiJson(calRes);
          if (!calRes.ok || calData.error) throw new Error(calData.error || 'No se pudo cargar el calendario.');
          setCalendarLoadError(calData.warning || '');setCalendarCacheMeta(calData.cacheMeta||null);
          if (calData.activities) setCalendarActivities(calData.activities);
        }
      } catch {}
    };

    window.addEventListener("anfeta_settings_changed", handleSettingsChanged);
    window.addEventListener("anfeta_data_refreshed", handleDataRefreshed);

    return () => {
      stopped = true;
      initialController.abort();
      if (indexTimer) clearTimeout(indexTimer);
      if (indexInterval) clearInterval(indexInterval);
      if (indexFocus) window.removeEventListener('focus', indexFocus);
      window.removeEventListener("anfeta_settings_changed", handleSettingsChanged);
      window.removeEventListener("anfeta_data_refreshed", handleDataRefreshed);
    };
  }, [currentDate,isAuthenticated,currentUser]);

  useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key==='anfeta_person_changed')window.location.reload();};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);

  // Fetch activities when date changes
  useEffect(() => {
    if(!isAuthenticated||!currentUser)return;
    const controller = new AbortController();
    setCalendarActivities([]);
    async function fetchCalendarForDate() {
      try {
        let token = "";
        try {
          const s = localStorage.getItem("anfeta_settings");
          if (s) token = JSON.parse(s).notionToken || "";
        } catch {}
        const res = await fetch(`/api/data?type=calendar&basic=1&date=${currentDate}`, {
          signal: controller.signal,
          headers: token ? { "x-notion-token": token } : {},
        });
        {
          const data = await readApiJson(res);
          if (!res.ok || data.error) throw new Error(data.error || 'No se pudo cargar el calendario.');
          setCalendarLoadError(data.warning || '');setCalendarCacheMeta(data.cacheMeta||null);
          if (data.activities) setCalendarActivities(data.activities);
        }
      } catch (err) {
        if (!controller.signal.aborted) setCalendarLoadError(err instanceof Error ? err.message : "No se pudo cargar el calendario.");
      }
    }
    fetchCalendarForDate();
    return () => controller.abort();
  }, [currentDate, isAuthenticated,currentUser]);

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
        const report=await runCalendarAutomation(currentUser,today,partial=>{if(!stopped)setAutomationReport(partial);},true);
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
    setCalendarPopupBlocked(openCalendarWindow(url)==='blocked');
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
    if(pendingRevision.current===undefined){setPendingError('Espera a que se carguen los pendientes de tu cuenta.');return;}
    const owner=currentUser;pendingItems.current=tasks;setPendingTasks(tasks);
    pendingQueue.current=pendingQueue.current.then(async()=>{
      if(pendingOwner.current!==owner||pendingRevision.current===undefined)return;
      try{const data=await readApiJson(await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save-pendientes',payload:tasks,expectedRevision:pendingRevision.current})}));if(pendingOwner.current!==owner)return;pendingRevision.current=data.revision;setPendingError('');}
      catch(e){if(pendingOwner.current!==owner)return;pendingRevision.current=undefined;setPendingError((e instanceof Error?e.message:'No se pudo guardar.')+' La lista se recuperará del servidor.');try{const data=await readApiJson(await fetch('/api/data?type=pendientes',{cache:'no-store'}));if(pendingOwner.current===owner){pendingItems.current=data.items||[];setPendingTasks(pendingItems.current);}}catch{} }
    });
  },[currentUser]);
  const handleTogglePendingTask=useCallback((id:string)=>persistPendingTasks(pendingItems.current.map(t=>t.id===id?{...t,isCompleted:!t.isCompleted}:t)),[persistPendingTasks]);
  const handleAddPendingTask=useCallback((task:Omit<PendingTaskItem,'id'>)=>persistPendingTasks([{...task,id:crypto.randomUUID(),createdAt:new Date().toISOString()},...pendingItems.current]),[persistPendingTasks]);
  const handleEditPendingTask=useCallback((id:string,data:Partial<PendingTaskItem>)=>persistPendingTasks(pendingItems.current.map(t=>t.id===id?{...t,...data}:t)),[persistPendingTasks]);
  const handleDeletePendingTask=useCallback((id:string)=>persistPendingTasks(pendingItems.current.filter(t=>t.id!==id)),[persistPendingTasks]);
  const handleDeleteAllPendingTasks=useCallback(()=>persistPendingTasks([]),[persistPendingTasks]);

  if(authChecking)return <main className="grid min-h-screen place-items-center bg-[#080B0F] text-cyan-200" role="status">Verificando acceso…</main>;
  if (!isAuthenticated) return <><div>{authError&&<p role="alert" className="fixed inset-x-4 top-4 z-[400] rounded border border-red-800 bg-red-950 p-3 text-sm text-red-100 flex items-center justify-between"><span>{authError}</span> <button onClick={()=>refreshAuthRef.current()} className="ml-2 underline font-medium">Reintentar conexión</button></p>}</div><LoginModal sharedMode={sharedMode} onSuccess={(userTag,options)=>{window.dispatchEvent(new Event("anfeta_auth_changed"));setCurrentUser(userTag);setSharedMode(options?.sharedMode===true);setAuthError("");setIsAuthenticated(true);}} /></>;

  if(sharedMode&&!currentUser)return <PersonSelector/>;
  return (
    <div className="flex flex-col h-screen w-screen bg-[#080B0F] text-[#F1F5F9] overflow-hidden select-none">
      {pendingError&&<div role="alert" className="bg-red-950 text-red-100 px-4 py-3 text-sm flex gap-3"><span>{pendingError}</span><button onClick={()=>{window.location.reload();}}>Recargar</button></div>}
      {calendarPopupBlocked&&<div role="alert" className="px-4 py-2 bg-amber-950 text-amber-100 text-sm">El navegador bloqueó la ventana del calendario. Permite ventanas emergentes para ANFETA. <a href={'/calendar?date='+encodeURIComponent(currentDate)} target="_blank" rel="noopener noreferrer" className="underline">Abrir en otra pestaña</a> <button onClick={()=>setCalendarPopupBlocked(false)}>Cerrar aviso</button></div>}
      {authError&&<div role="alert" className="bg-amber-950 text-amber-100 px-4 py-2 text-sm flex items-center justify-between"><span>{authError}</span> <button className="ml-2 underline font-medium" onClick={()=>refreshAuthRef.current()}>Reintentar conexión</button></div>}
      {sharedMode&&personPickerOpen&&<PersonSelector currentUser={currentUser} onClose={()=>setPersonPickerOpen(false)}/>}
      {/* Top Bar with Navigation and Global Search */}
      <TopBar
        activeView={activeView}
        onSelectView={handleSelectView}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={() => handleSearchChange("")}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onChangePerson={sharedMode?()=>setPersonPickerOpen(true):undefined}
        currentUser={currentUser}
        onLogout={async () => {
          try {
            OfflineMutationQueue.setOwner('');
            localStorage.removeItem("anfeta_auth_session");
            localStorage.removeItem("anfeta_settings");
            localStorage.removeItem("anfeta_last_user");
          } catch {}
          try {
            await fetch('/api/auth', { method: 'DELETE' });
          } catch {}
          setSearchIndex([]);
          setCalendarActivities([]);
          setIsAuthenticated(false);window.dispatchEvent(new Event("anfeta_auth_changed"));
          window.location.reload();
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
            onChangeCurrentUser={()=>setPersonPickerOpen(true)}
          />
        </div>

        {/* Layer 2: CalendarHost (Timeline Canvas) */}
        <div
          className={`absolute inset-0 z-20 transition-opacity ${
            activeView === "calendar" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {showAutomation && <CalendarAutomationModal currentUser={currentUser} date={currentDate} onClose={()=>setShowAutomation(false)} onComplete={report=>{setAutomationReport(report);try{localStorage.setItem('anfeta-calendar-automation-report',JSON.stringify(report));}catch{}window.dispatchEvent(new Event('anfeta_data_refreshed'));}} />}
          <CalendarHost active={activeView === "calendar"}
                loadError={calendarLoadError} initialCacheMeta={calendarCacheMeta}
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
                let token = "";
                try {
                  const s = localStorage.getItem("anfeta_settings");
                  if (s) token = JSON.parse(s).notionToken || "";
                } catch {}
                const res = await fetch(`/api/data?type=calendar&basic=1&date=${currentDate}`, {
                  headers: token ? { "x-notion-token": token } : {},
                });
                {
                  const data = await readApiJson(res);
          if (!res.ok || data.error) throw new Error(data.error || 'No se pudo cargar el calendario.');
          setCalendarLoadError(data.warning || '');setCalendarCacheMeta(data.cacheMeta||null);
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
        lastSyncTime={indexSyncLabel}
      />

      {/* Settings Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onSaveCurrentUser={async (tag) => {
          const person = normalizePerson(tag);
          if (person !== currentUser) {
            const confirmed=await readApiJson(await fetch('/api/auth',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({person}),signal:AbortSignal.timeout(30000)}));
            if(!confirmed.success||normalizePerson(confirmed.user)!==person)throw new Error('No se confirmó la persona.');
            OfflineMutationQueue.setOwner('');window.dispatchEvent(new Event('anfeta_auth_changed'));setCurrentUser(person);
            try {
              localStorage.setItem("anfeta_last_user", person);
              const prev = JSON.parse(localStorage.getItem("anfeta_settings") || "{}");
              localStorage.setItem("anfeta_settings", JSON.stringify({ ...prev, currentUser: person }));

            } catch {}
            window.location.reload();
          }
        }}
      />

      {/* Login Corporativo Modal */}
      {!isAuthenticated && (
        <LoginModal
          sharedMode={sharedMode}
          onSuccess={(userTag) => {
            const person = normalizePerson(userTag);
            setCurrentUser(person);
            setIsAuthenticated(true);
            try {
              localStorage.setItem("anfeta_last_user", person);
              const prev = JSON.parse(localStorage.getItem("anfeta_settings") || "{}");
              localStorage.setItem("anfeta_settings", JSON.stringify({ ...prev, currentUser: person }));
            } catch {}
          }}
        />
      )}
    </div>
  );
}
