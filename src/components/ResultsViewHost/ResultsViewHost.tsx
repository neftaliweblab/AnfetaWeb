"use client";
import {applyNotionStates} from '@/lib/applyNotionStates';
import {useNotionPageWatch} from '@/components/useNotionPageWatch';
import {filterDeletedPages,rememberDeletedPages,pageIdentity,DELETED_PAGES_EVENT,deletedPages} from '@/lib/deletedPages';
import {scanActivityTags} from '@/services/activityTags';
import {resultAssignedPerson} from '@/services/activityTags';
import {QuickPendingCapture} from './QuickPendingCapture';
import {ScreenRecorder} from './ScreenRecorder';
import {readUploadDraft} from '@/lib/uploadDraft';
import {openNotionPage} from '@/services/windowsIntegration';
import {notionPageUrl} from '@/lib/notionPageUrl';
import {parseSearchTabs} from '@/lib/searchTabsStorage';
import {readSearchDefaults,searchDefaultsKey,newSearchQuery,replaceInitialSearchTag,currentSearchMonth,effectiveSearchMonth} from '@/lib/searchDefaults';
import {CompactSearchAccess} from './CompactSearchAccess';
import {workflowState} from '@/services/activityWorkflow';
import {SearchActivityActions,type SearchActivityAction} from './SearchActivityActions';
import {DiagnosticMessage} from '../Diagnostics/DiagnosticsLogs';
import {anfetaSync} from '@/lib/anfetaBroadcastSync';
import {PersonalAgendaPane} from './PersonalAgendaPane';
import {ExportResults} from './ExportResults';
import {NotionConnectionCheck} from './NotionConnectionCheck';
import {compareSearchRows,lastSearchTerm} from '@/lib/searchPresentation';
import {activeResultsFirst, orderSearchResults} from '@/lib/activeResultsFirst';
import {retainSearchResults} from '@/lib/retainSearchResults';
import {loadSearchIndex} from '@/lib/loadSearchIndex';
import {normalizePerson} from '@/services/identityNormalizer';


import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { SearchResultRow, PendingTaskItem, ActiveProjectItem } from "@/types/anfeta";
import { SearchTabsRow, SearchTab } from "./SearchTabsRow";
import { FolderOpen, ChevronRight, ArrowUpLeft, X } from "lucide-react";
import {loadAccountPreferences,saveAccountPreferences} from '@/lib/accountPreferences';
import { SearchInputBar } from "./SearchInputBar";
import { ScopePillsRow } from "./ScopePillsRow";
import { SearchConfigRow } from "./SearchConfigRow";
import { PendientesColumn } from "./PendientesColumn";
import { QuickFiltersColumn } from "./QuickFiltersColumn";
import { ResultsVirtualTable } from "./ResultsVirtualTable";
import { DetailsPane } from "./DetailsPane";
import { SearchBottomBar } from "./SearchBottomBar";
import { PendingTaskModal } from "./PendingTaskModal";
import { NotionTemplatesModal } from "./NotionTemplatesModal";
import {detectUpload} from '@/lib/drxUploadPlan';
import { DropboxUploadModal } from "./DropboxUploadModal";
import { DropboxConnectModal } from "@/components/DropboxConnectModal/DropboxConnectModal";
import { GlobalPasteModal, GlobalPasteImagePayload } from "./GlobalPasteModal";
import { filterByNotionBase } from "@/lib/notionFilters";
import { matchesFlexibleOrQuotedQuery } from "@/services/advancedQuery";
import { SearchHelpModal } from "./SearchHelpModal";
import { RenameModal, DuplicateModal, CreateFolderModal } from "./ActionDialogs";
import { BatchRenameModal } from "./BatchRenameModal";
import { WhatsappDirectoryModal } from "@/components/WhatsappDirectoryModal/WhatsappDirectoryModal";
import { ResponsePagesCleanupModal } from "./ResponsePagesCleanupModal";
import { isExpiredResponsePage } from "@/lib/responsePageRules";
import {
  playCheckChime,
  playCopyChime,
  playDeleteChime,
  sendWindowsNotification,
} from "@/services/windowsIntegration";

import { captureFromBlob, isTextEditing } from '@/services/globalPaste';
interface ResultsViewHostProps {
  isActive?: boolean;
  items: SearchResultRow[];
  pendingTasks: PendingTaskItem[];
  activeProjects: ActiveProjectItem[];
  onTogglePendingTask: (id: string) => void;
  onAddPendingTask: (task: Omit<PendingTaskItem, "id">) => void;
  onEditPendingTask?: (id: string, updatedData: Partial<PendingTaskItem>) => void;
  onDeletePendingTask: (id: string) => void;
  onDeleteAllPendingTasks?: () => void;
  searchFilter: (item: SearchResultRow) => boolean;
  onSelectDomain?: (domain: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onOpenSettings?: () => void;
  onShowResults?:()=>void;
  onToggleCalendarView?: () => void;
  isCalendarActive?: boolean;
  onOpenStandaloneCalendar?: () => void;
  onToggleMessagesView?: () => void;
  isMessagesActive?: boolean;
  messagesCount?: number;
  onToggleRemindersView?: () => void;
  isRemindersActive?: boolean;
  remindersCount?: number;
  currentUser?: string;
  onChangeCurrentUser?: (user: string) => void;
}

export function ResultsViewHost({
  items: initialItems, isActive = true,
  pendingTasks,
  activeProjects,
  onTogglePendingTask,
  onAddPendingTask,
  onEditPendingTask,
  onDeletePendingTask,
  onDeleteAllPendingTasks,
  searchFilter,
  onSelectDomain,
  searchQuery: externalQuery = "",
  onSearchChange,
  onOpenSettings,
  onShowResults,
  onToggleCalendarView,
  isCalendarActive = false,
  onOpenStandaloneCalendar,
  onToggleMessagesView,
  isMessagesActive = false,
  messagesCount = 0,
  onToggleRemindersView,
  isRemindersActive = false,
  remindersCount = 0,
  currentUser = "nneft",
  onChangeCurrentUser,
}: ResultsViewHostProps) {
  // Tabs state
  const [tabs, setTabs] = useState<SearchTab[]>([
    { id: "tab_1", query: externalQuery ?? "", canClose: false },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab_1");
  const [tabsOwner,setTabsOwner]=useState('');
  const tabsKey='anfeta_search_tabs_v1:'+normalizePerson(currentUser||'');
  useEffect(()=>{
    const owner=normalizePerson(currentUser||'');
    let defaults={selectedTag:'Ninguno',customTag:''};try{defaults=readSearchDefaults(localStorage,owner);}catch{}
    setSelectedTag(defaults.selectedTag);setCustomTag(defaults.customTag);
    let saved=null;try{saved=parseSearchTabs(localStorage.getItem(tabsKey));}catch{}
    const next=saved||{tabs:[{id:'tab_1',query:externalQuery||newSearchQuery(defaults.selectedTag,defaults.customTag),canClose:false}],activeTabId:'tab_1'};
    setTabs(next.tabs);setActiveTabId(next.activeTabId);const restored=next.tabs.find(t=>t.id===next.activeTabId)?.query||'';
    setQuery(restored);onSearchChange?.(restored);setTabsOwner(tabsKey);
  },[tabsKey]);
  useEffect(()=>{if(tabsOwner!==tabsKey)return;try{localStorage.setItem(tabsKey,JSON.stringify({tabs,activeTabId}));}catch{}},[tabs,activeTabId,tabsOwner,tabsKey]);

  // Search input & scopes
  const [query, setQuery] = useState(externalQuery || "");
  const [settledQuery,setSettledQuery]=useState(query);
  useEffect(()=>{const timer=setTimeout(()=>setSettledQuery(query),400);return()=>clearTimeout(timer);},[query]);
  const deferredQuery = useDeferredValue(settledQuery);
  const [resultPerson,setResultPerson]=useState("__all__");
  const [selectedScope, setSelectedScope] = useState("Notion");
  const [filterFavorites, setFilterFavorites] = useState(false);

  // Config & views (Deterministic initial states for SSR to prevent hydration errors)
  const [selectedTag, setSelectedTag] = useState("Ninguno");
  const [customTag, setCustomTag] = useState("");
  useEffect(()=>{if(tabsOwner!==tabsKey)return;try{localStorage.setItem(searchDefaultsKey(normalizePerson(currentUser||'')),JSON.stringify({selectedTag,customTag}));}catch{}},[selectedTag,customTag,tabsOwner,tabsKey,currentUser]);
  const [textScale, setTextScale] = useState("100%");
  const [groupBy, setGroupBy] = useState("none");
  const [monthSelection,setSelectedMonth]=useState('Actual');
  const [currentMonth,setCurrentMonth]=useState('');
  useEffect(()=>{const refresh=()=>setCurrentMonth(currentSearchMonth());refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
  const selectedMonth=effectiveSearchMonth(monthSelection,currentMonth,deferredQuery);
  const [viewZoom, setViewZoom] = useState<"list" | "small" | "medium" | "large">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_view_zoom");
        if (saved && ["list", "small", "medium", "large"].includes(saved)) {
          return saved as "list" | "small" | "medium" | "large";
        }
      } catch {}
    }
    return "list";
  });

  const handleChangeViewZoom = (newZoom: "list" | "small" | "medium" | "large") => {
    setViewZoom(newZoom);
    try {
      localStorage.setItem("anfeta_view_zoom", newZoom);
    } catch {}
  };

  const [resultSort,setResultSort]=useState("default");
  const [searchOptions, setSearchOptions] = useState<{
    matchCase: boolean;
    matchWholeWord: boolean;
    matchRegex: boolean;
  }>({
    matchCase: false,
    matchWholeWord: false,
    matchRegex: false,
  });

  const handleToggleSearchOption = (key: "matchCase" | "matchWholeWord" | "matchRegex") => {
    setSearchOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Panel toggles & task editing
  const [isPendientesOpen, setIsPendientesOpen] = useState(true);
  const [editingTask, setEditingTask] = useState<PendingTaskItem | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isSyncingNotion, setIsSyncingNotion] = useState(false);
  const [isSyncingDropbox, setIsSyncingDropbox] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isDropboxModalOpen, setIsDropboxModalOpen] = useState(false);
  const [dropboxTargetDir, setDropboxTargetDir] = useState("");
  const [isGlobalPasteOpen, setIsGlobalPasteOpen] = useState(false);
  const [isBatchRenameOpen, setIsBatchRenameOpen] = useState(false);
  const [isResponseCleanupOpen, setIsResponseCleanupOpen] = useState(false);
  const [globalFiles, setGlobalFiles] = useState<GlobalPasteImagePayload[]>([]);
  const [recordingUpload,setRecordingUpload]=useState(false);
  const [recordingDestination,setRecordingDestination]=useState<SearchResultRow|null>(null);
  const resultsRoot=useRef<HTMLDivElement>(null),keyboardStart=useRef(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [statusError, setStatusError] = useState('');
  useEffect(() => {
    if (!statusError) return;
    const timer = setTimeout(() => setStatusError(''), 5000);
    return () => clearTimeout(timer);
  }, [statusError]);

  const [appNotification, setAppNotification] = useState<{
    type: 'info' | 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!appNotification) return;
    if (appNotification.type === 'warning' || appNotification.type === 'error') return;
    const timer = setTimeout(() => setAppNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [appNotification]);

  const viewZoomRef = useRef(viewZoom);
  useEffect(() => {
    viewZoomRef.current = viewZoom;
  }, [viewZoom]);

  const lastGlobalWheelRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive) return;

    const handleWindowWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      // Prevenir el zoom completo del navegador
      e.preventDefault();

      const now = Date.now();
      if (now - lastGlobalWheelRef.current < 160) return;
      if (Math.abs(e.deltaY) < 5) return;

      lastGlobalWheelRef.current = now;

      const levels: ("list" | "small" | "medium" | "large")[] = ["list", "small", "medium", "large"];
      const current = viewZoomRef.current;
      const idx = levels.indexOf(current);

      if (e.deltaY < 0) {
        if (idx < levels.length - 1) {
          handleChangeViewZoom(levels[idx + 1]);
        }
      } else if (e.deltaY > 0) {
        if (idx > 0) {
          handleChangeViewZoom(levels[idx - 1]);
        }
      }
    };

    window.addEventListener("wheel", handleWindowWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWindowWheel);
    };
  }, [isActive]);

  const [hasNotionToken, setHasNotionToken] = useState<boolean | undefined>(undefined);
  const [hasDropboxToken, setHasDropboxToken] = useState<boolean | undefined>(undefined);
  const [isDropboxConnectOpen, setIsDropboxConnectOpen] = useState(false);

  useEffect(() => {
    const checkTokens = () => {
      try {
        const saved = localStorage.getItem("anfeta_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          setHasNotionToken(Boolean(parsed.notionToken?.trim()));
          setHasDropboxToken(Boolean(parsed.dropboxToken?.trim()));
        } else {
          setHasNotionToken(false);
          setHasDropboxToken(false);
        }
      } catch {
        setHasNotionToken(false);
        setHasDropboxToken(false);
      }
    };
    checkTokens();

    // Auto-detectar credenciales configuradas en el servidor
    fetch("/api/data?type=settings")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          if (typeof data.notionConfigured === "boolean") {
            setHasNotionToken((prev) => (prev !== undefined ? prev : data.notionConfigured));
          }
          if (data.dropboxToken || data.hasDropboxToken) {
            setHasDropboxToken(true);
            try {
              const prev = JSON.parse(localStorage.getItem("anfeta_settings") || "{}");
              if (!prev.dropboxToken && data.dropboxToken) {
                localStorage.setItem(
                  "anfeta_settings",
                  JSON.stringify({
                    ...prev,
                    dropboxToken: data.dropboxToken,
                    dropboxAccountName: data.dropboxAccountName || "",
                    dropboxAccountEmail: data.dropboxAccountEmail || "",
                  })
                );
              }
            } catch {}
          }
        }
      })
      .catch(() => {});

    window.addEventListener("anfeta_settings_changed", checkTokens);
    return () => window.removeEventListener("anfeta_settings_changed", checkTokens);
  }, []);
  const [globalPasteText, setGlobalPasteText] = useState("");
  const [globalPasteImage, setGlobalPasteImage] = useState<GlobalPasteImagePayload | null>(null);

  // Theme background (10 ANFETA themes)
  const [themeBg, setThemeBg] = useState("#080B0F");

  // Favorites / Bookmarks
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set<string>());

  // Carga e hidratación segura de configuraciones desde localStorage sin romper SSR
  useEffect(() => {
    try {
      const savedScale = localStorage.getItem("anfeta_text_scale");
      if (savedScale) setTextScale(savedScale);

      const savedGroup = localStorage.getItem("anfeta_group_by");
      if (savedGroup) setGroupBy(savedGroup);

      const savedBg = localStorage.getItem("anfeta_theme_bg");
      if (savedBg) setThemeBg(savedBg);

    } catch (e) {
      console.warn("Error leyendo preferencias de localStorage:", e);
    }
  }, []);

  const handleSelectThemeBg = (color: string) => {
    setThemeBg(color);
    if (typeof window !== "undefined") {
      localStorage.setItem("anfeta_theme_bg", color);
    }
  };

  const favoriteBusy=useRef(false);
  const favoriteKey=(item:any)=>String(item.externalId||item.path||item.id);
  useEffect(()=>{let stopped=false,loading=false;const refresh=async()=>{if(loading||favoriteBusy.current||!isActive||document.hidden)return;loading=true;try{const state=await loadAccountPreferences();if(!stopped)setFavorites(new Set((state.values?.favorites||[]).filter((id:any)=>typeof id==='string')));}catch(error){if(!stopped)setStatusError(error instanceof Error?error.message:'No se pudieron cargar los favoritos.');}finally{loading=false}};void refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);window.addEventListener('anfeta_preferences_changed',refresh);return()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('anfeta_preferences_changed',refresh)}},[isActive,currentUser]);
  const handleToggleBookmark=async(item:any)=>{if(favoriteBusy.current)return;favoriteBusy.current=true;try{const state=await loadAccountPreferences();const next=new Set<string>((state.values?.favorites||[]).filter((id:any)=>typeof id==='string'));const key=favoriteKey(item);if(next.has(key))next.delete(key);else next.add(key);const saved=await saveAccountPreferences({favorites:Array.from(next)},state.revision);setFavorites(new Set(saved.values.favorites));setStatusError('');playCheckChime();}catch(error){setStatusError(error instanceof Error?error.message:'No se pudo guardar el favorito.');}finally{favoriteBusy.current=false}};

  // Action Dialogs state
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameTargetItem, setRenameTargetItem] = useState<any | null>(null);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [duplicateTargetItem, setDuplicateTargetItem] = useState<any | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [createFolderTargetDir, setCreateFolderTargetDir] = useState("C:\\Users\\nanoc\\Dropbox\\DRX");

  // Columns visibility
  const [visibleCols, setVisibleCols] = useState({
    path: true,
    status: true,
    scheduledDate: true,
    modifiedDate: true,
  });

  const [activityAction,setActivityAction]=useState<{item:any;mode:SearchActivityAction;position:{x:number;y:number}}|null>(null);
  // Table selections
  const [items, setItems] = useState<SearchResultRow[]>(() => filterDeletedPages(initialItems,currentUser).filter((it) => !isExpiredResponsePage(it)));
  React.useEffect(() => {
    setItems(previous=>retainSearchResults(previous,{items:filterDeletedPages(initialItems,currentUser).filter(it=>!isExpiredResponsePage(it)),loadingIndex:true}));
  }, [initialItems,currentUser]);
  const deleteErrorIds=useRef<string[]>([]);
  const [deleteFeedback, setDeleteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pinnedDetail,setPinnedDetail]=useState<SearchResultRow|null>(null);
  useEffect(()=>{setPinnedDetail(old=>old?items.find(row=>row.id===old.id)||null:null);},[items]);
  const [selectedItem, setSelectedItem] = useState<SearchResultRow | null>(null);
  const [showPersonalAgenda,setShowPersonalAgenda]=useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  React.useEffect(() => {
    if (externalQuery !== undefined && externalQuery !== query) {
      setQuery(externalQuery);
      setTabs(prev=>prev.map(t=>t.id===activeTabId?{...t,query:externalQuery}:t));
    }
  }, [externalQuery]);

  const handleQueryChange = (newQ: string) => {
    setQuery(newQ);
    onSearchChange?.(newQ);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, query: newQ } : t))
    );
  };

  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId);
    const target = tabs.find((t) => t.id === tabId);
    if (target) {
      setQuery(target.query);
      onSearchChange?.(target.query);
    }
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[0].id);
      setQuery(nextTabs[0].query);
      onSearchChange?.(nextTabs[0].query);
    }
  };

  const handleNewTab = () => {
    if(tabs.length>=30){setStatusError('Puedes mantener hasta 30 búsquedas guardadas.');return;}
    const newId = `tab_${crypto.randomUUID()}`;
    const initialQuery=newSearchQuery(selectedTag,customTag);
    const newTab: SearchTab = { id: newId, query: initialQuery, canClose: true };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setQuery(initialQuery);
    onSearchChange?.(initialQuery);
  };

  const handleTagChange = (newTag: string) => {
    const next={selectedTag:newTag,customTag};
    setSelectedTag(newTag);
    handleQueryChange(replaceInitialSearchTag(query,{selectedTag,customTag},next));
  };

  const handleCustomTagChange = (newCustom: string) => {
    const next={selectedTag:'Personalizado',customTag:newCustom};
    setCustomTag(newCustom);
    setSelectedTag('Personalizado');
    handleQueryChange(replaceInitialSearchTag(query,{selectedTag,customTag},next));
  };

  const handleGroupByChange = (group: string) => {
    setGroupBy(group);
    if (typeof window !== "undefined") {
      localStorage.setItem("anfeta_group_by", group);
    }
  };

  const handleTextScaleChange = (scale: string) => {
    setTextScale(scale);
    if (typeof window !== "undefined") {
      localStorage.setItem("anfeta_text_scale", scale);
    }
  };

  // Selection logic: When row is selected, toggle check and update selection
  const handleSelectRow = (item: SearchResultRow) => {
    setShowPersonalAgenda(false);
    playCheckChime();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        // Deseleccionar: se desmarca el check
        next.delete(item.id);
        if (selectedItem?.id === item.id) {
          const remaining = Array.from(next);
          if (remaining.length > 0) {
            const nextItem = items.find((it) => it.id === remaining[remaining.length - 1]);
            setSelectedItem(nextItem || null);
          } else {
            setSelectedItem(null);
          }
        }
      } else {
        // Seleccionar: se marca el check
        next.add(item.id);
        setSelectedItem(item);
      }
      return next;
    });
  };

  const handleToggleCheck = (id: string) => {
    playCheckChime();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (selectedItem?.id === id) {
          const remaining = Array.from(next);
          if (remaining.length > 0) {
            const nextItem = items.find((it) => it.id === remaining[remaining.length - 1]);
            setSelectedItem(nextItem || null);
          } else {
            setSelectedItem(null);
          }
        }
      } else {
        next.add(id);
        const target = items.find((it) => it.id === id);
        if (target) setSelectedItem(target);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    playCheckChime();
    const visibleIds = pagedItems.map((it) => it.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
        if (selectedItem && visibleIds.includes(selectedItem.id)) {
          setSelectedItem(null);
        }
      } else {
        visibleIds.forEach((id) => next.add(id));
        if (!selectedItem && pagedItems.length > 0) {
          setSelectedItem(pagedItems[0]);
        }
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectedItem(null);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      if (selectedItem) {
        await handleDeleteItem(selectedItem);
      }
      return;
    }
    const count = selectedIds.size;
    const selectedItemsList = items.filter((it) => selectedIds.has(it.id));
    if (!window.confirm(`¿Deseas eliminar permanentemente ${count} página${count > 1 ? "s" : ""} seleccionada${count > 1 ? "s" : ""} en Notion / fuente original?`)) {
      return;
    }

    setIsDeleting(true);
    setDeleteFeedback({ type: 'success', message: `Eliminando ${count} página${count > 1 ? 's' : ''} en Notion...` });

    try {
      let clientToken = "";
      if (typeof window !== "undefined") {
        try {
          const s = localStorage.getItem("anfeta_settings");
          if (s) clientToken = JSON.parse(s).notionToken || "";
        } catch {}
      }

      const res = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "x-notion-token": clientToken } : {}),
        },
        body: JSON.stringify({
          action: "delete-items",
          payload: {
            items: selectedItemsList.map((it) => ({
              id: it.externalId || it.id,
              source: it.source || it.sourceName,
              sourceName: it.sourceName,
              path: it.path || it.target,
              name: it.name,
              token: clientToken,
            })),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo completar la eliminación en Notion.");
      }

      playDeleteChime();
      deleteErrorIds.current=selectedItemsList.filter(it=>!(data.removedIds||[]).map(pageIdentity).includes(pageIdentity(it))).map(it=>pageIdentity(it));
      const confirmed=new Set((data.removedIds||[]).map(pageIdentity));
      const removedIds = new Set(selectedItemsList.filter(it=>confirmed.has(pageIdentity(it))).map(it=>it.id));
      rememberDeletedPages(currentUser,data.removedIds||[]);
      setItems((prev) => prev.filter((it) => !removedIds.has(it.id)));
      if (selectedItem && removedIds.has(selectedItem.id)) {
        setSelectedItem(null);
      }
      setSelectedIds(new Set());
      setDeleteFeedback({
        type: data.failed?'error':'success',
        message: data.failed?(data.errors||[]).join(' · '):`✅ Se eliminaron ${data.count || count} página${count > 1 ? 's' : ''} exitosamente en Notion.`,
      });
      if(!data.failed)setTimeout(() => setDeleteFeedback(previous=>previous?.type==='success'?null:previous), 5000);
    } catch (err: any) {
      setDeleteFeedback({
        type: 'error',
        message: `❌ Error al eliminar en Notion: ${err.message || 'Fallo desconocido'}`,
      });
      deleteErrorIds.current=selectedItemsList.map(it=>pageIdentity(it));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!window.confirm(`¿Deseas eliminar permanentemente "${item.name}" en Notion / fuente original?`)) {
      return;
    }

    setIsDeleting(true);
    setDeleteFeedback({ type: 'success', message: `Eliminando "${item.name.slice(0, 30)}..." en Notion...` });

    try {
      let clientToken = "";
      if (typeof window !== "undefined") {
        try {
          const s = localStorage.getItem("anfeta_settings");
          if (s) clientToken = JSON.parse(s).notionToken || "";
        } catch {}
      }

      const res = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "x-notion-token": clientToken } : {}),
        },
        body: JSON.stringify({
          action: "delete-item",
          payload: {
            id: item.externalId || item.id,
            source: item.source || item.sourceName,
            sourceName: item.sourceName,
            path: item.path || item.target,
            name: item.name,
            token: clientToken,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar en Notion.");
      }

      playDeleteChime();
      rememberDeletedPages(currentUser,[item.externalId||item.id]);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      if (selectedItem?.id === item.id) setSelectedItem(null);
      setDeleteFeedback({
        type: 'success',
        message: `✅ Página eliminada exitosamente en Notion.`,
      });
      setTimeout(() => setDeleteFeedback(previous=>previous?.type==='success'?null:previous), 5000);
    } catch (err: any) {
      setDeleteFeedback({
        type: 'error',
        message: `❌ Error al eliminar en Notion: ${err.message || 'Fallo desconocido'}`,
      });
      deleteErrorIds.current=[pageIdentity(item)];
    } finally {
      setIsDeleting(false);
    }
  };

  // Atajos de Teclado Globales (F5 refrescar, Enter abrir, Delete borrar)
  React.useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGlobalPasteOpen || isDropboxModalOpen) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === "input" || activeTag === "textarea";

      if (e.key === "F5") {
        e.preventDefault();
        handleRefreshIndex();
        return;
      }

      if (e.key === "Enter" && !isInput && !(document.activeElement as HTMLElement)?.closest('button,a,select,[role="dialog"],[contenteditable="true"]') && selectedItem) {
        e.preventDefault();
        handleOpenItem(selectedItem);
        return;
      }

      if (e.key === "Delete" && !isInput) {
        if (selectedIds.size > 0 || selectedItem) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, selectedItem, items, isActive, isGlobalPasteOpen, isDropboxModalOpen]);

  const handleOpenDropboxUpload = (targetDir?: string) => {
    if (targetDir) {
      setDropboxTargetDir(targetDir);
    } else if (selectedItem?.target || selectedItem?.path) {
      setDropboxTargetDir(selectedItem.target || selectedItem.path);
    } else {
      setDropboxTargetDir("C:\\Users\\nanoc\\Dropbox\\DRX");
    }
    setIsDropboxModalOpen(true);
  };

  // Flujo Global de Pegar en ANFETA con Ctrl + V (Abre Modal en el centro)
  const triggerGlobalPaste = async (clipboardData?: DataTransfer | null) => {
    setGlobalFiles([]);
    try {
      if (clipboardData) {
        const image = Array.from(clipboardData.items).find(item => item.type.startsWith('image/'))?.getAsFile();
        if (image) { setGlobalPasteImage(await captureFromBlob(image)); setGlobalPasteText(''); setIsGlobalPasteOpen(true); playCopyChime(); return; }
        const text = clipboardData.getData('text/plain');
        if (text.trim()) { setGlobalPasteImage(null); setGlobalPasteText(text.trim()); setIsGlobalPasteOpen(true); playCopyChime(); return; }
      } else {
        if (navigator.clipboard?.read) {
          const entries = await navigator.clipboard.read();
          for (const entry of entries) {
            const type = entry.types.find(type => type.startsWith('image/'));
            if (type) { setGlobalPasteImage(await captureFromBlob(await entry.getType(type))); setGlobalPasteText(''); setIsGlobalPasteOpen(true); return; }
          }
        }
        const text = await navigator.clipboard.readText(); setGlobalPasteImage(null); setGlobalPasteText(text); setIsGlobalPasteOpen(true); return;
      }
    } catch (error) { setStatusError(error instanceof Error ? error.message : 'No se pudo leer el portapapeles.'); }
    setGlobalPasteImage(null); setGlobalPasteText(''); setIsGlobalPasteOpen(true);
  };

  React.useEffect(() => {
    if (!isActive) return;
    // Listener de Paste nativo
    const handlePaste = (e: ClipboardEvent) => {
      if (isTextEditing(document.activeElement)) return;
      if (e.clipboardData?.files.length && !Array.from(e.clipboardData.files).some(file => file.type.startsWith("image/"))) { e.preventDefault(); void handleDropFiles(Array.from(e.clipboardData.files)).catch(error => setStatusError(error.message)); return; }
      e.preventDefault();
      setGlobalFiles([]);
      void triggerGlobalPaste(e.clipboardData);
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [isActive]);

  // Arrastrar y soltar archivos directamente en la tabla (Drop Surface)
  const handleDropFiles = async (droppedFiles: File[]) => {
    if (!droppedFiles.length) return;
    if(droppedFiles.length>20)throw new Error('Selecciona hasta 20 archivos por lote.');
    const files:GlobalPasteImagePayload[] = droppedFiles.map(file=>({dataUrl:'',base64:'',filename:file.name,sizeBytes:file.size,contentType:file.type,blob:file}));
    setGlobalFiles(files); setGlobalPasteImage(null); setGlobalPasteText(''); setIsGlobalPasteOpen(true);
  };
  useEffect(() => {
    if (!isActive) return;
    const over = (event: DragEvent) => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); setDraggingFiles(true); } };
    const leave = (event: DragEvent) => { if (!event.relatedTarget) setDraggingFiles(false); };
    const drop = (event: DragEvent) => { if (!event.dataTransfer?.files.length) return; event.preventDefault(); event.stopPropagation(); setDraggingFiles(false); void handleDropFiles(Array.from(event.dataTransfer.files)).catch(e => setStatusError(e.message)); };
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop, true);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop, true); };
  }, [isActive]);

  const handleOpenItem = (item: any) => {
    if (!item) return;

    const isDropbox =
      selectedScope === "Dropbox" ||
      selectedScope === "Carpetas" ||
      item.source === "Dropbox" ||
      item.sourceName === "Dropbox" ||
      item.externalSourceName === "Dropbox" ||
      item.type === "FILE" ||
      item.type === "FOLDER" ||
      (item.target && (item.target.startsWith("/") || item.target.includes(":\\")));

    // 1. Si es Notion: abrir en Notion
    if (!isDropbox || item.source === "Notion") {
      const notionUrl = notionPageUrl(item);
      if (notionUrl) {
        openNotionPage(notionUrl);
        return;
      }
      setStatusError('Este registro no tiene un enlace o ID válido de Notion. Actualiza el catálogo.');return;
    }

    // 2. Si es carpeta de Dropbox: entrar en la carpeta
    if (item.isFolder || item.type === "FOLDER") {
      const folderTarget = (item.target || item.path || item.name || "").trim();
      const folderName = folderTarget.replace(/\\/g, "/").split("/").filter(Boolean).pop() || item.name || "";
      const queryValue = folderName.includes(" ") ? `folder:"${folderName}"` : `folder:${folderName}`;
      handleQueryChange(queryValue);
      return;
    }

    // 3. Si es archivo de Dropbox:
    const targetPath = (item.target || item.path || item.name || "").trim();
    if (targetPath.startsWith("http")) {
      window.open(targetPath, "_blank");
      return;
    }

    let clientToken = "";
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_settings");
        if (saved) clientToken = JSON.parse(saved).dropboxToken || "";
      } catch {}
    }
    const tokenQuery = clientToken ? `&token=${encodeURIComponent(clientToken)}` : "";

    // Si tiene ruta local con letra de disco Windows, intentar abrir en app nativa de Windows
    if (targetPath.includes(":\\")) {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open-file", payload: { path: targetPath } }),
      }).catch(() => {});
    }

    // Abrir vista previa / visor web en nueva pestaña
    const previewUrl = `/api/data?type=file-preview&path=${encodeURIComponent(targetPath)}${tokenQuery}`;
    window.open(previewUrl, "_blank");
  };

  const handleOpenLocation = (item: any) => {
    if (!item) return;

    const isDropbox =
      selectedScope === "Dropbox" ||
      selectedScope === "Carpetas" ||
      item.source === "Dropbox" ||
      item.sourceName === "Dropbox" ||
      item.externalSourceName === "Dropbox" ||
      item.type === "FILE" ||
      item.type === "FOLDER" ||
      (item.target && (item.target.startsWith("/") || item.target.includes(":\\")));

    // 1. Si es Notion: abrir la página en Notion
    if (!isDropbox || item.source === "Notion") {
      const notionUrl = notionPageUrl(item);
      if (notionUrl) {
        openNotionPage(notionUrl);
        return;
      }
    }

    // 2. Si es Dropbox: navegar a la carpeta en Anfeta o abrir en explorador Windows
    const targetPath = (item.target || item.path || "").trim();
    if (item.isFolder || item.type === "FOLDER") {
      const folderName = (item.name || targetPath).replace(/\\/g, "/").split("/").filter(Boolean).pop() || item.name;
      handleQueryChange(`folder:"${folderName}"`);
    } else {
      const folder = item.folder || (targetPath.includes("/") ? targetPath.split("/").slice(0, -1).join("/") : "");
      const folderName = folder.replace(/\\/g, "/").split("/").filter(Boolean).pop();
      if (folderName) {
        handleQueryChange(`folder:"${folderName}"`);
      }
    }

    if (targetPath && targetPath.includes(":\\")) {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open-explorer", payload: { path: targetPath } }),
      }).catch(() => {});
    }
  };

  const handleRefreshIndex = async () => {
    setIsSyncingNotion(true);
    let token = "";
    try {
      const saved = localStorage.getItem("anfeta_settings");
      if (saved) token = JSON.parse(saved).notionToken || "";
    } catch {}

    window.dispatchEvent(new CustomEvent('anfeta_index_status', { detail: { cacheMeta: { syncing: true } } }));

    try {
      setAppNotification({
        type: 'info',
        text: '⏳ Cargando catálogo actualizado...'
      });

      const data = await loadSearchIndex({
        fresh: true,
        token: token.trim()||undefined,
        onPartial: (p) => {
          if (p?.items?.length) setItems((prev) => retainSearchResults(prev, p));
        },
      });
      window.dispatchEvent(new CustomEvent('anfeta_index_status', { detail: data }));
      if (data.items && data.items.length > 0) {
        setItems(previous => retainSearchResults(previous, data));
        window.dispatchEvent(new CustomEvent('anfeta_data_refreshed', { detail: data }));
        setAppNotification({
          type: data.warning?'warning':data.cacheMeta?.syncing?'info':'success',
          text: data.warning?'Resultados disponibles; '+data.warning:data.cacheMeta?.syncing?`Actualización en curso; ${data.items.length} registros disponibles.`:`Índice cargado: ${data.total??data.items.length} registros disponibles.`
        });
        sendWindowsNotification('ANFETA', data.warning ? 'Resultados disponibles; actualización pendiente.' : 'Índice actualizado.');
      } else {
        setAppNotification({
          type: 'info',
          text: data.warning|| (data.cacheMeta?.syncing?'Sincronización iniciada; todavía no se recibieron registros de Notion.':'La consulta devolvió 0 registros. Revisa la base, la persona y los filtros.')
        });
      }
    } catch(error) {
      const msg = error instanceof Error ? error.message : "Error al sincronizar con Notion.";
      setAppNotification({
        type: 'error',
        text: `❌ ${msg} (Catálogo local preservado: ${items.length} elementos)`
      });
      setStatusError(msg);
    } finally {
      setIsSyncingNotion(false);
    }
  };

  useEffect(() => {
    const handleTrigger = () => {
      void handleRefreshIndex();
    };
    window.addEventListener('anfeta_trigger_refresh_index', handleTrigger);
    return () => window.removeEventListener('anfeta_trigger_refresh_index', handleTrigger);
  }, []);

  const handleSyncDropbox = async () => {
    setIsSyncingDropbox(true);
    setStatusError("");
    let cloudFolder = "/DRX";
    let dropboxToken = "";
    try {
      const saved = localStorage.getItem("anfeta_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cloudFolder) cloudFolder = parsed.cloudFolder;
        if (parsed.dropboxToken) dropboxToken = parsed.dropboxToken;
      }
    } catch {}

    if (!hasDropboxToken && !dropboxToken?.trim()) {
      setIsDropboxConnectOpen(true);
      setIsSyncingDropbox(false);
      return;
    }

    setAppNotification({
      type: 'info',
      text: '⏳ Conectando con Dropbox Cloud API...'
    });

    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync-dropbox",
          payload: { folder: cloudFolder, dropboxToken: dropboxToken.trim() || undefined },
        }),
      });
      const data = await res.json();
      if (data.success) {
        const fresh = await loadSearchIndex({ fresh: true });
        if (fresh?.items) {
          setItems((prev) => retainSearchResults(prev, fresh));
          window.dispatchEvent(new CustomEvent("anfeta_data_refreshed", { detail: fresh }));
        }
        setAppNotification({
          type: 'success',
          text: `✅ Dropbox sincronizado: ${data.count || 0} archivos indexados.`
        });
        sendWindowsNotification("ANFETA Dropbox", data.message || `Indexados ${data.count} elementos.`);
      } else {
        if (data.error && (data.error.includes("token") || data.error.includes("vinculad") || data.error.includes("OAuth"))) {
          setIsDropboxConnectOpen(true);
        }
        setAppNotification({
          type: 'error',
          text: `❌ Error en Dropbox: ${data.error || 'No se pudo sincronizar'}`
        });
        setStatusError(`Error al sincronizar Dropbox: ${data.error}`);
      }
    } catch (e: any) {
      const msg = e.message || "Error al conectar con Dropbox Cloud API";
      setAppNotification({
        type: 'error',
        text: `❌ ${msg}`
      });
      setStatusError(msg);
    } finally {
      setIsSyncingDropbox(false);
    }
  };

  useEffect(()=>anfetaSync.subscribe(message=>{
    if(message.type==='ACTIVITY_CREATED'&&message.activity){setItems(previous=>applyNotionStates(previous,[{id:message.activity.pageId,calendarActivity:message.activity}]));return;}
    if(message.type!=='ACTIVITY_UPDATED'||!message.pageId||!message.updates)return;
    const a=message.updates;
    if(a.title===undefined&&a.person===undefined&&a.status===undefined&&a.start===undefined)return;
    const states=[{id:message.pageId,name:a.title,assignedPerson:a.person,updateStatus:a.status,scheduledDate:a.start,serverModified:a.serverModified||new Date().toISOString()}];
    setItems(previous=>applyNotionStates(previous,states));
    setSelectedItem((previous:any)=>previous?applyNotionStates([previous],states)[0]:previous);
  }),[currentUser]);

  const handleUpdateStatus = async (item: any, newStatus: string) => {
    const state=workflowState(newStatus);if(state==='review'||state==='completed'){setActivityAction({item,mode:state==='review'?'review':'finish',position:{x:window.innerWidth/2,y:120}});return;}
    try {
      playCheckChime();
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-activity-status",
          payload: { id: item.externalId || item.id, status: newStatus, currentUser },
        }),
      });
      if (!res.ok) { const data = await res.json(); setStatusError(data.error || "No se pudo actualizar el estado"); return; }
      if (res.ok) {
        setStatusError("");
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  updateStatus: newStatus,
                  projectUpdateStatus: newStatus,
                  statusLabel: newStatus,
                }
              : it
          )
        );
        if (selectedItem?.id === item.id) {
          setSelectedItem((prev: any) =>
            prev
              ? {
                  ...prev,
                  updateStatus: newStatus,
                  projectUpdateStatus: newStatus,
                  statusLabel: newStatus,
                }
              : null
          );
        }
        sendWindowsNotification(
          "Estado actualizado",
          `Actividad "${item.name}" cambiada a ${newStatus} ✅`
        );
        window.dispatchEvent(new CustomEvent('anfeta_data_refreshed'));
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleRenameConfirm = async (item: any, newName: string) => {
    try {
      playCheckChime();
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename-item",
          payload: {
            id: item.externalId||item.id,
            source: item.source,
            oldName: item.name,
            newName,
            path: item.target || item.path,
          },
        }),
      });
      const data=await res.json();
      if(!res.ok||!data.success)throw Error(data.error||'No se confirmó el nombre en Notion.');
      if (res.ok) {
        if(data.activity)anfetaSync.broadcast({type:'ACTIVITY_UPDATED',confirmed:true,pageId:data.activity.pageId,updates:data.activity});
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, name: newName } : it))
        );
        if (selectedItem?.id === item.id) {
          setSelectedItem((prev: any) => (prev ? { ...prev, name: newName } : null));
        }
        sendWindowsNotification("Elemento renombrado", `Nuevo nombre: ${newName}`);
      }
    } catch (err) {
      setStatusError(err instanceof Error?err.message:"No se pudo renombrar.");
    }
  };

  const handleBatchRenameConfirm = async (renames: Array<{ item: any; newName: string }>) => {
    try {
      playCheckChime();
      let count = 0;
      for (const { item, newName } of renames) {
        if (!newName || newName === item.name) continue;
        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rename-item",
            payload: {
              id: item.externalId||item.id,
              source: item.source,
              oldName: item.name,
              newName,
              path: item.target || item.path,
            },
          }),
        });
        if (res.ok) {
          const data=await res.json();if(data.activity)anfetaSync.broadcast({type:'ACTIVITY_UPDATED',confirmed:true,pageId:data.activity.pageId,updates:data.activity});
          count++;
          setItems((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, name: newName } : it))
          );
        }
      }
      sendWindowsNotification("Renombrado Masivo", `Se renombraron ${count} elementos con éxito.`);
    } catch (err) {
      console.error("Error en renombrado masivo:", err);
    }
  };

  const handleDuplicateConfirm = async (item: any, newTitle: string) => {
    try {
      playCheckChime();
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate-item",
          payload: {
            id: item.id,
            source: item.source,
            title: newTitle,
            path: item.target || item.path,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const duplicatedRow: SearchResultRow = {
          ...item,
          id: data.id || `dup-${Date.now()}`,
          name: newTitle,
          target: data.newPath || item.target,
          path: data.newPath || item.path,
        };
        setItems((prev) => [duplicatedRow, ...prev]);
        setSelectedItem(duplicatedRow);
        sendWindowsNotification("Elemento duplicado", `Creado duplicado: ${newTitle}`);
      }
    } catch (err) {
      console.error("Error duplicating:", err);
    }
  };

  const handleCreateFolderConfirm = async (folderName: string, targetDir: string) => {
    try {
      playCheckChime();
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-dropbox-folder",
          payload: { folderName, targetDir },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newFolderRow: SearchResultRow = {
          id: `folder-${Date.now()}`,
          name: folderName,
          type: "FOLDER",
          target: data.path,
          path: data.path,
          folder: targetDir,
          extension: "",
          sizeBytes: 0,
          modifiedLocalDate: new Date().toLocaleDateString(),
          source: "Dropbox",
          sourceName: "Dropbox",
          serverModified: new Date().toISOString(),
          isFolder: true,
        };
        setItems((prev) => [newFolderRow, ...prev]);
        setSelectedItem(newFolderRow);
        sendWindowsNotification("Carpeta creada", `Carpeta creada en: ${data.path}`);
      }
    } catch (err) {
      console.error("Error creating folder:", err);
    }
  };

  // Filter & scope processing
  const filteredItems = useMemo(() => {
    let res = filterDeletedPages(items,currentUser).filter((item) => {
      if (deferredQuery.trim()) {
        if (!matchesFlexibleOrQuotedQuery(item, deferredQuery, searchOptions)) {
          return false;
        }
      }
      if (filterFavorites && !favorites.has(favoriteKey(item))) return false;
      return true;
    });

    if (selectedScope && selectedScope !== "Todo") {
      res = filterByNotionBase(res as any, selectedScope) as any;
    }

    // Filtrado estricto por usuario activo si no es "__all__" y no está en Scope de carpetas/dropbox
    if (resultPerson && resultPerson !== "__all__" && selectedScope !== "Dropbox" && selectedScope !== "Carpetas") {
      res=res.filter(item=>resultAssignedPerson(item)===normalizePerson(resultPerson));
    }

    if (selectedMonth && selectedMonth !== "Todos") {
      res = res.filter((it) => it.name.toUpperCase().includes(selectedMonth));
    }

    res = [...res].sort((a,b)=>compareSearchRows(a,b,resultSort));
    return orderSearchResults(res, groupBy);
  }, [items, deferredQuery, searchOptions, selectedScope, filterFavorites, favorites, selectedMonth, groupBy, resultPerson,currentMonth,resultSort]);

  useEffect(()=>{setCurrentPage(1);},[deferredQuery,selectedScope,resultPerson,pageSize,selectedMonth,filterFavorites,resultSort]);
  useEffect(()=>{setCurrentPage(page=>Math.min(page,Math.max(1,Math.ceil(filteredItems.length/pageSize))));},[filteredItems.length,pageSize]);

  useEffect(()=>{const remove=(event?:Event)=>{if(event instanceof CustomEvent&&event.detail?.owner!==currentUser)return;setItems(prev=>filterDeletedPages(prev,currentUser));if(deleteErrorIds.current.length&&deleteErrorIds.current.every(id=>deletedPages(currentUser).has(pageIdentity(id)))){setDeleteFeedback(null);deleteErrorIds.current=[];}setSelectedItem(previous=>previous&&deletedPages(currentUser).has(pageIdentity(previous))?null:previous);setSelectedIds(previous=>new Set([...previous].filter(id=>!deletedPages(currentUser).has(pageIdentity(id)))));};window.addEventListener(DELETED_PAGES_EVENT,remove);window.addEventListener('storage',remove);return()=>{window.removeEventListener(DELETED_PAGES_EVENT,remove);window.removeEventListener('storage',remove);};},[currentUser]);
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);
  const watchPeople=new Set(scanActivityTags(deferredQuery).map(tag=>tag.person));
  const watchRows=pagedItems.length?pagedItems:items.filter(item=>watchPeople.size?watchPeople.has(resultAssignedPerson(item) as any):/\[RESPUESTA\]/i.test(item.name));
  useNotionPageWatch(currentUser,watchRows,isActive,states=>setItems(previous=>filterDeletedPages(applyNotionStates(previous,states),currentUser)));
  function focusResult(item:SearchResultRow){
    setSelectedItem(item);setSelectedIds(new Set([item.id]));
    requestAnimationFrame(()=>{const row=Array.from(resultsRoot.current?.querySelectorAll<HTMLElement>('[data-search-result]')||[]).find(el=>el.dataset.searchResult===item.id);row?.focus({preventScroll:true});row?.scrollIntoView({block:'nearest'});});
  }
  function focusFirstResult(){const first=resultsRoot.current?.querySelector<HTMLElement>('[data-search-result]');const item=pagedItems.find(item=>item.id===first?.dataset.searchResult);if(item)focusResult(item);else setStatusError('No hay resultados para recorrer.');}
  useEffect(()=>{if(!keyboardStart.current||deferredQuery!==query)return;keyboardStart.current=false;focusFirstResult();},[pagedItems,deferredQuery,query]);
  useEffect(()=>{if(!isActive)return;const start=()=>{keyboardStart.current=true;setSettledQuery(query);if(deferredQuery===query){keyboardStart.current=false;focusFirstResult();}};window.addEventListener('anfeta_focus_first_result',start);return()=>window.removeEventListener('anfeta_focus_first_result',start);},[isActive,query,deferredQuery,pagedItems]);
  function handleResultKeys(event:React.KeyboardEvent){
    if(!isActive||event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||event.nativeEvent.isComposing)return;
    const target=event.target as HTMLElement;
    if(event.key==='Tab'&&target.matches('[data-search-query]')&&!event.shiftKey){event.preventDefault();keyboardStart.current=true;setSettledQuery(query);if(deferredQuery===query){keyboardStart.current=false;focusFirstResult();}return;}
    if(event.key==='Enter'&&target.matches('[data-search-result]')){const item=pagedItems.find(item=>item.id===target.dataset.searchResult);if(item){event.preventDefault();event.stopPropagation();handleOpenItem(item);}return;}
    if(event.key!=='Tab'||!target.matches('[data-search-result]'))return;
    const rows=Array.from(resultsRoot.current?.querySelectorAll<HTMLElement>('[data-search-result]')||[]),index=rows.indexOf(target),next=rows[index+(event.shiftKey?-1:1)];
    if(next){const item=pagedItems.find(item=>item.id===next.dataset.searchResult);if(item){event.preventDefault();focusResult(item);}}
    else if(event.shiftKey){event.preventDefault();resultsRoot.current?.querySelector<HTMLInputElement>('[data-search-query]')?.focus();}
  }
  useEffect(()=>{setSelectedItem(previous=>previous&&filteredItems.some(row=>row.id===previous.id)?previous:null);setPinnedDetail(previous=>previous&&filteredItems.some(row=>row.id===previous.id)?previous:null);},[filteredItems]);

  const renderQuickFilters=(onSelected?:()=>void)=>(
          <QuickFiltersColumn
            onClose={()=>setIsFiltersOpen(false)}
            onQuickSearch={(term) => {handleQueryChange(term);onSelected?.();}}
            activeTodayProjects={activeProjects}
            onFilterByProject={(domain) => {
              handleQueryChange(domain);
              onSelected?.();
              onSelectDomain?.(domain);
            }}
            onOpenProjectNotion={async (domain) => {
              try {
                const res = await fetch(`/api/data?type=project-view-url&domain=${encodeURIComponent(domain)}`);
                const data = await res.json();
                if (data.found && data.viewUrl) {
                  window.open(data.viewUrl, "_blank");
                } else if (data.fallbackUrl) {
                  window.open(data.fallbackUrl, "_blank");
                } else {
                  window.open(`https://www.notion.so/search?query=${encodeURIComponent(domain)}`, "_blank");
                }
              } catch (err) {
                console.error("Error opening Notion project view:", err);
                window.open(`https://www.notion.so/search?query=${encodeURIComponent(domain)}`, "_blank");
              }
            }}
            onGenerateDailyAiSummary={() => alert("Generando resumen de jornada mediante IA...")}
          />
  );

  return (
    <div
      ref={resultsRoot}
      onKeyDownCapture={handleResultKeys}
      className="flex-1 flex flex-col h-full text-[#F1F5F9] select-none overflow-hidden transition-colors duration-200"
      style={{ backgroundColor: themeBg }}
    >
      {/* 0. Pestañas de Búsqueda (SearchTabs) */}
      <SearchTabsRow
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        textScale={textScale}
      />

      {/* 1. Barra de Búsqueda Principal + Acciones */}
      <SearchInputBar
        currentUser={currentUser}
        onSubmitSearch={()=>setSettledQuery(query)}
        query={query}
        onChangeQuery={handleQueryChange}
        searchOptions={searchOptions}
        onToggleSearchOption={handleToggleSearchOption}
        searchIndex={items}
        onOpenTemplates={() => setIsTemplatesModalOpen(true)}
        onRefreshIndex={handleRefreshIndex}
        onOpenHelp={() => setIsHelpOpen(true)}
        onSelectThemeBg={handleSelectThemeBg}
        onSelectSavedView={(v) => setSelectedScope(v)}
        textScale={textScale}
        onToggleCalendarView={onToggleCalendarView}
        isCalendarActive={isCalendarActive}
        onOpenStandaloneCalendar={onOpenStandaloneCalendar}
        onToggleMessagesView={onToggleMessagesView}
        isMessagesActive={isMessagesActive}
        messagesCount={messagesCount}
        onToggleRemindersView={onToggleRemindersView}
        isRemindersActive={isRemindersActive}
        remindersCount={remindersCount}
        onOpenWhatsappGroups={() => setShowWhatsappModal(true)}
        onOpenResponseCleanup={() => setIsResponseCleanupOpen(true)}
      />

      {/* 2. Pills de Ámbitos / Bases Notion */}
      <ScopePillsRow
        selectedScope={selectedScope}
        onSelectScope={(scope) => {
          setSelectedScope(scope);
          // Si el usuario tenía su tag personal y selecciona una base global, limpiar el tag para ver todos los registros
          const userTags = ["nneft", "jjohn", "kkarl", "bbria", "ggena", "iisai", "eedua", "ssote", "aacal", "aandr"];
          if (userTags.includes(query.trim().toLowerCase())) {
            handleQueryChange("");
          }
        }}
        filterFavorites={filterFavorites}
        onToggleFavorites={() => setFilterFavorites(!filterFavorites)}
        onOpenSettings={onOpenSettings}
        textScale={textScale}
      />

      {/* 3. Barra de Configuración y Toggles */}
      <SearchConfigRow
        resultSort={resultSort} onChangeResultSort={setResultSort}
        currentUser={resultPerson}
        onChangeCurrentUser={setResultPerson}
        onSyncNotion={handleRefreshIndex}
        isSyncingNotion={isSyncingNotion}
        onOpenResponseCleanup={() => setIsResponseCleanupOpen(true)}
        onSyncDropbox={handleSyncDropbox}
        isSyncingDropbox={isSyncingDropbox}
        selectedTag={selectedTag}
        onChangeTag={handleTagChange}
        customTag={customTag}
        onChangeCustomTag={handleCustomTagChange}
        textScale={textScale}
        onChangeTextScale={handleTextScaleChange}
        groupBy={groupBy}
        onChangeGroupBy={handleGroupByChange}
        selectedMonth={monthSelection}
        currentMonth={currentMonth}
        onChangeMonth={setSelectedMonth}
        viewZoom={viewZoom}
        onChangeViewZoom={handleChangeViewZoom}
        isPendientesOpen={isPendientesOpen}
        onTogglePendientes={() => setIsPendientesOpen(!isPendientesOpen)}
        pendingCount={pendingTasks.filter((t) => !t.isCompleted).length}
        isFiltersOpen={isFiltersOpen}
        onToggleFilters={() => setIsFiltersOpen(!isFiltersOpen)}
        isDetailsOpen={isDetailsOpen}
        onToggleDetails={() => setIsDetailsOpen(!isDetailsOpen)}
        visibleCols={visibleCols}
        onToggleCol={(col) => setVisibleCols((prev) => ({ ...prev, [col]: !prev[col] }))}
        onMaximizeNameCol={() => setVisibleCols({ path: false, status: false, scheduledDate: false, modifiedDate: false })}
        onResetCols={() => setVisibleCols({ path: true, status: true, scheduledDate: true, modifiedDate: true })}
        hasNotionToken={hasNotionToken}
        hasDropboxToken={hasDropboxToken}
        onOpenSettings={onOpenSettings}
        onOpenDropboxConnect={() => setIsDropboxConnectOpen(true)}
        notification={appNotification}
        onDismissNotification={() => setAppNotification(null)}
      />

      {lastSearchTerm(deferredQuery)&&<p className="px-3 py-1 text-[11px] text-cyan-300" role="status">Resaltado: coincidencias del último término «{lastSearchTerm(deferredQuery)}». Las terminadas siguen visibles; el orden conserva las agrupaciones y las activas primero.</p>}
      {/* 4. Contenedor de 4 Columnas Dinámicas */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* Col 0: PENDIENTES (260px) */}
        {isPendientesOpen && (
          <PendientesColumn
            pendingTasks={pendingTasks}
            onToggleTask={onTogglePendingTask}
            onOpenNewTaskModal={() => {
              setEditingTask(null);
              setIsNewTaskModalOpen(true);
            }}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsNewTaskModalOpen(true);
            }}
            onDeleteTask={onDeletePendingTask}
            onDeleteAllTasks={onDeleteAllPendingTasks}
            onSelectTaskQuery={(q) => handleQueryChange(q)}
          />
        )}

        {/* Col 1: FILTROS Y ACCESOS RÁPIDOS (225px) */}
        {isFiltersOpen && (
          renderQuickFilters()
        )}

        {/* Col 2: RESULTADOS (Central) */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1 bg-[#0B0F15]">
            <div className="flex items-center gap-2">
              {query.includes("folder:") && (
                <div className="flex items-center gap-1.5 text-xs bg-[#161F2C] border border-[#223848] px-2 py-0.5 rounded text-amber-300">
                  <FolderOpen className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span className="font-mono text-[11px] truncate max-w-[280px]">
                    {query.match(/folder:(?:"([^"]+)"|(\S+))/)?.[1] || query.match(/folder:(?:"([^"]+)"|(\S+))/)?.[2] || "Carpeta"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      // Subir de nivel o quitar filtro de carpeta
                      const cleanQ = query.replace(/folder:(?:"[^"]+"|"[^"]*|\S+)/g, "").trim();
                      handleQueryChange(cleanQ);
                    }}
                    className="ml-1 text-[10px] text-sky-400 hover:text-sky-200 flex items-center gap-0.5 underline cursor-pointer"
                    title="Subir de nivel / Salir de la carpeta"
                  >
                    <ArrowUpLeft className="w-3 h-3" />
                    <span>Subir nivel</span>
                  </button>
                </div>
              )}
              {selectedIds.size > 1 && (
                <button
                  type="button"
                  onClick={() => setIsBatchRenameOpen(true)}
                  className="rounded border border-sky-800 bg-sky-950/40 text-sky-300 px-2 py-1 text-xs hover:bg-sky-900/60 transition-colors font-medium cursor-pointer"
                  title="Renombrar en lote todos los elementos seleccionados"
                >
                  ✎ Renombrar masivo ({selectedIds.size})
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResponseCleanupOpen(true)}
                className="rounded border border-indigo-800/60 bg-indigo-950/40 text-indigo-300 px-2 py-1 text-xs hover:bg-indigo-900/60 transition-colors font-medium cursor-pointer flex items-center gap-1.5"
                title="Escanear y previsualizar páginas [RESPUESTA] para archivarlas en Notion"
              >
                <span>🧹</span>
                <span>Limpiar [RESPUESTA]</span>
              </button>
              <NotionConnectionCheck/>
              <ExportResults rows={filteredItems}/>
            </div>{items.length>0&&filteredItems.length===0&&<p role="status" className="m-2 rounded border border-amber-900 bg-amber-950/30 p-3 text-xs text-amber-200">Hay {items.length} registros cargados, pero ninguno coincide con la persona {resultPerson==="__all__"?"Todas las personas":normalizePerson(resultPerson)} y los filtros actuales. <button type="button" className="ml-2 underline" onClick={()=>{handleQueryChange("");setSelectedScope("Todo");setFilterFavorites(false);setSelectedMonth("Todos");setSelectedTag("Ninguno");setResultPerson("__all__");}}>Limpiar filtros</button></p>}
          </div>
          <ResultsVirtualTable
          headerActions={!isFiltersOpen?<CompactSearchAccess onOpenFilters={()=>setIsFiltersOpen(true)}/>:undefined}
          currentUser={currentUser}
          items={pagedItems}
          selectedId={selectedItem?.id || null}
          selectedIds={selectedIds}
          searchQuery={query}
          favorites={favorites}
          selectedScope={selectedScope}
          onSelect={handleSelectRow}
          onToggleCheck={handleToggleCheck}
          onToggleBookmark={handleToggleBookmark}
          onDelete={handleDeleteItem}
          onDoubleClick={handleOpenItem}
          onOpenLocation={handleOpenLocation}
          onCopyName={(it) => {
            navigator.clipboard.writeText(it.name);
            playCopyChime();
          }}
          onCopyPath={(it) => {
            navigator.clipboard.writeText(it.target || it.path || it.name);
            playCopyChime();
          }}
          onCopyLink={(it) => {
            const url = it.externalUrl || it.url || (it.id ? `https://notion.so/${it.id.replace(/-/g, "")}` : "");
            if (url) navigator.clipboard.writeText(url);
            playCopyChime();
          }}
          onCopyDomain={(dom) => {
            navigator.clipboard.writeText(dom);
            playCopyChime();
          }}
          onCopyDomainType={(chatCode) => {
            navigator.clipboard.writeText(chatCode);
            playCopyChime();
          }}
          onCopyContent={(it) => {
            navigator.clipboard.writeText(it.contentSnippet || it.name);
            playCopyChime();
          }}
          onOpenDomain={(dom) => {
            if (dom) window.open(`https://${dom}`, "_blank");
          }}
          onRename={(it) => {
            setRenameTargetItem(it);
            setIsRenameOpen(true);
          }}
          onDuplicate={(it) => {
            setDuplicateTargetItem(it);
            setIsDuplicateOpen(true);
          }}
          onCreateFolder={(targetDir) => {
            setCreateFolderTargetDir(targetDir || "C:\\Users\\nanoc\\Dropbox\\DRX");
            setIsCreateFolderOpen(true);
          }}
          onUpdateStatus={handleUpdateStatus}
          onActivityAction={(item,mode,position)=>setActivityAction({item,mode,position})}
          onToggleSelectAll={handleToggleSelectAll}
          onClearSelection={handleClearSelection}
          onDeleteSelected={handleDeleteSelected}
          onOpenUploadDropbox={handleOpenDropboxUpload}
          onDropFiles={handleDropFiles}
          showPath={visibleCols.path}
          showStatus={visibleCols.status}
          showScheduledDate={visibleCols.scheduledDate}
          showModifiedDate={visibleCols.modifiedDate}
          viewZoom={viewZoom}
          onChangeViewZoom={handleChangeViewZoom}
          textScale={textScale}
          groupBy={groupBy}
        /></div>

        {activityAction&&<SearchActivityActions item={activityAction.item} currentUser={currentUser} mode={activityAction.mode} position={activityAction.position} onClose={()=>setActivityAction(null)} onSaved={()=>setStatusError('')}/>}
        {/* Col 4: DETALLES (320px) */}
        {isDetailsOpen && (
          <div className="shrink-0 h-full flex flex-col"><div className="flex gap-2 border-b border-slate-800 bg-[#0F141C] p-2 text-xs"><button type="button" aria-pressed={showPersonalAgenda||!(pinnedDetail||selectedItem)} className="text-cyan-300" onClick={()=>setShowPersonalAgenda(true)}>Calendario individual</button><button type="button" disabled={!(pinnedDetail||selectedItem)} aria-pressed={!showPersonalAgenda&&!!(pinnedDetail||selectedItem)} className="text-slate-300 disabled:opacity-40" onClick={()=>setShowPersonalAgenda(false)}>Detalles</button></div><div className="flex-1 min-h-0">
          <DetailsPane
            emptyContent={<PersonalAgendaPane active={isActive} currentUser={currentUser} onOpenCalendar={onToggleCalendarView}/>}
            item={showPersonalAgenda?null:(pinnedDetail||selectedItem)}
            isPinned={!!pinnedDetail}
            onTogglePin={()=>setPinnedDetail(old=>old?null:selectedItem)}
            onOpen={handleOpenItem}
            onOpenLocation={handleOpenLocation}
            onSearchDomain={(domain) => handleQueryChange(domain)}
            onOpenUploadDropbox={handleOpenDropboxUpload}
            onOpenGlobalPaste={() => triggerGlobalPaste(null)}
            onDelete={handleDeleteItem}
            textScale={textScale}
            searchQuery={deferredQuery}
          />
          </div></div>
        )}
      </div>

      {/* 5. Barra Inferior Global */}
      <SearchBottomBar
        currentPage={currentPage}
        pageSize={pageSize}
        onChangePageSize={setPageSize}
        statusText={`Índice: ${items.length} · Notion: ${filterByNotionBase(items as any, 'Notion').length} · Visibles: ${filteredItems.length}`} 
        selectedItem={selectedItem}
        selectedCount={selectedIds.size}
        onDeleteSelected={handleDeleteSelected}
        onOpenItem={handleOpenItem}
        onOpenLocation={handleOpenLocation}
        onCopyName={(it) => {
          navigator.clipboard.writeText(it.name);
          playCopyChime();
        }}
        onCopyContent={(it) => {
          navigator.clipboard.writeText(it.contentSnippet || it.name);
          playCopyChime();
        }}
        onOpenUploadDropbox={() => handleOpenDropboxUpload()}
        onOpenGlobalPaste={() => triggerGlobalPaste(null)}
        textScale={textScale}
      />

      {/* Grabador flotante persistente entre módulos */}
      <ScreenRecorder disabled={isGlobalPasteOpen||isDropboxModalOpen} onReady={async (file,target)=>{onShowResults?.();setRecordingDestination(target?{id:target.id,externalId:target.id,name:target.title,source:'Notion',type:'PAGE'} as SearchResultRow:null);setRecordingUpload(true);setGlobalFiles([file]);setGlobalPasteText('');setGlobalPasteImage(null);setIsGlobalPasteOpen(true);return true;}}/>

      {/* Modal Editor para Nuevo/Editar Pendiente */}
      <QuickPendingCapture active={isActive} onSave={onAddPendingTask}/>
      <PendingTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => {
          setIsNewTaskModalOpen(false);
          setEditingTask(null);
        }}
        taskToEdit={editingTask}
        onSave={(taskData, editId) => {
          if (editId && onEditPendingTask) {
            onEditPendingTask(editId, taskData);
          } else {
            onAddPendingTask(taskData);
          }
          setEditingTask(null);
        }}
      />

      {/* Modal de Plantillas Rápidas Notion */}
      <NotionTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onApplyTemplate={(tplTitle) => handleQueryChange(tplTitle)}
        onActivitiesCreated={(created) => {
          const newRows: SearchResultRow[] = created.map((act, idx) => ({
            id: act.pageId || `tpl-new-${Date.now()}-${idx}`,
            name: act.title,
            path: act.title,
            folder: "Revisiones",
            extension: "",
            sizeBytes: 0,
            modifiedLocalDate: new Date().toISOString().slice(0, 10),
            serverModified: new Date().toISOString(),
            source: "Notion",
            sourceName: "Revisiones",
            type: "Notion",
            scheduledDate: act.start ? act.start.slice(0, 10) : "",
            assignedPerson: act.person,
            statusLabel: act.status || "rtuzREVISION",
            domainChip: act.domain,
            url: act.pageUrl,
          }));
          setItems((prev) => [...newRows, ...prev]);
          if (newRows.length > 0) {
            setSelectedItem(newRows[0]);
            playCheckChime();
            sendWindowsNotification(
              "Actividad Duplicada en Notion",
              `Estructura duplicada sin contenido: ${newRows[0].name}`
            );
          }
        }}
      />

      {/* Modal Subir a Dropbox */}
      <DropboxUploadModal
        isOpen={isDropboxModalOpen}
        onClose={() => setIsDropboxModalOpen(false)}
        currentUser={currentUser}
        defaultDomain={detectUpload([selectedItem?.name,dropboxTargetDir,query].filter(Boolean).join(' ')).domain}
        defaultTargetDir={dropboxTargetDir}
        onUploadSuccess={(newRow) => {
          setItems((prev) => [newRow, ...prev]);
          setSelectedItem(newRow);
        }}
      />

      {/* Modal Pegar Texto / Captura Global (Ctrl+V) */}
      <DiagnosticMessage owner={currentUser} source="Buscador · acción" message={statusError} level="error"/>
      {draggingFiles && <div className="pointer-events-none fixed inset-4 z-[100] flex items-center justify-center rounded-2xl border-2 border-dashed border-cyan-300 bg-slate-950/80 text-xl text-cyan-200">📥 Soltar archivo aquí para Pegado Global ANFETA (Dropbox / Notion)</div>}
      <GlobalPasteModal
        isOpen={isGlobalPasteOpen}
        onClose={() => {
          setIsGlobalPasteOpen(false);
          setGlobalPasteImage(null);
          setGlobalFiles([]);
          setRecordingUpload(false);
          setRecordingDestination(null);
        }}
        currentUser={currentUser}
        initialFiles={globalFiles}
        initialDestination={recordingUpload?'both':undefined}
        initialText={globalPasteText}
        initialImage={globalPasteImage}
        attachmentOnly={recordingUpload&&!!recordingDestination}
        suggestedTarget={recordingUpload?recordingDestination:selectedItem}
        onSuccess={(newRow) => {
          setItems((prev) => [newRow, ...prev]);
          setSelectedItem(newRow);
          if (newRow.source === 'Notion') window.dispatchEvent(new CustomEvent('anfeta_data_refreshed'));
        }}
      />

      {/* Modal de Ayuda Avanzada V2 (ANFETA) */}
      <SearchHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onInsertCommand={(cmd) => {
          handleQueryChange(query ? `${query} ${cmd}` : cmd);
          setIsHelpOpen(false);
        }}
      />

      {/* Modal Renombrar */}
      <RenameModal
        isOpen={isRenameOpen}
        item={renameTargetItem}
        onClose={() => {
          setIsRenameOpen(false);
          setRenameTargetItem(null);
        }}
        onConfirm={handleRenameConfirm}
      />

      {/* Modal Duplicar */}
      <DuplicateModal
        isOpen={isDuplicateOpen}
        item={duplicateTargetItem}
        onClose={() => {
          setIsDuplicateOpen(false);
          setDuplicateTargetItem(null);
        }}
        onConfirm={handleDuplicateConfirm}
      />

      {/* Modal Crear Carpeta en Dropbox */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        targetDir={createFolderTargetDir}
        onClose={() => setIsCreateFolderOpen(false)}
        onConfirm={handleCreateFolderConfirm}
      />

      {/* Modal Renombrado Masivo */}
      <BatchRenameModal
        isOpen={isBatchRenameOpen}
        selectedItems={items.filter((it) => selectedIds.has(it.id))}
        onClose={() => setIsBatchRenameOpen(false)}
        onConfirm={handleBatchRenameConfirm}
      />

      {/* Modal Conectar Dropbox OAuth */}
      <DropboxConnectModal
        isOpen={isDropboxConnectOpen}
        onClose={() => setIsDropboxConnectOpen(false)}
        onConnected={(info) => {
          setHasDropboxToken(true);
          setAppNotification({
            type: "success",
            text: `✓ Dropbox conectado: ${info.account}`,
          });
        }}
        onDisconnected={() => {
          setHasDropboxToken(false);
          setAppNotification({
            type: "info",
            text: "Dropbox desvinculado",
          });
        }}
      />

      {/* Modal Directorio de Grupos de WhatsApp */}
      {showWhatsappModal && (
        <WhatsappDirectoryModal
          isOpen={showWhatsappModal}
          currentUser={currentUser}
          onClose={() => setShowWhatsappModal(false)}
        />
      )}

      {/* Modal de Limpieza y Escaneo de Páginas [RESPUESTA] */}
      {isResponseCleanupOpen && (
        <ResponsePagesCleanupModal
          isOpen={isResponseCleanupOpen}
          onClose={() => setIsResponseCleanupOpen(false)}
          localItems={items}
          onDeleted={(deletedIds) => {
            rememberDeletedPages(currentUser,deletedIds);
            const removed = new Set(deletedIds);
            setItems((prev) => prev.filter((it) => !removed.has(it.id) && (!it.externalId || !removed.has(it.externalId))));
            setSelectedIds((prev) => {
              const next = new Set(prev);
              for (const id of deletedIds) next.delete(id);
              return next;
            });
            if (selectedItem && (removed.has(selectedItem.id) || (selectedItem.externalId && removed.has(selectedItem.externalId)))) {
              setSelectedItem(null);
            }
            playDeleteChime();
            setDeleteFeedback({
              type: "success",
              message: `✅ Se eliminaron ${deletedIds.length} página(s) de [RESPUESTA] en Notion con éxito.`,
            });
            setTimeout(() => setDeleteFeedback(previous=>previous?.type==='success'?null:previous), 5000);
          }}
        />
      )}

      {/* Mensaje de confirmación de eliminación */}
      {deleteFeedback && (
        <div
          className={`fixed bottom-12 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-xs font-semibold shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-2 ${
            deleteFeedback.type === "success"
              ? "bg-[#091E16] border-[#059669] text-[#34D399]"
              : "bg-[#200D11] border-[#E11D48] text-[#FDA4AF]"
          }`}
        >
          <span>{deleteFeedback.message}</span>
          <button
            type="button"
            onClick={() => setDeleteFeedback(null)}
            className="p-0.5 rounded hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
