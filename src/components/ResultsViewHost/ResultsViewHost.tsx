"use client";
import {ExportResults} from './ExportResults';
import {newestFirst} from '@/lib/searchResultOrder';
import {retainSearchResults} from '@/lib/retainSearchResults';
import {loadSearchIndex} from '@/lib/loadSearchIndex';


import React, { useState, useMemo, useEffect, useRef } from "react";
import { SearchResultRow, PendingTaskItem, ActiveProjectItem } from "@/types/anfeta";
import { SearchTabsRow, SearchTab } from "./SearchTabsRow";
import { FolderOpen, ChevronRight, ArrowUpLeft } from "lucide-react";
import {loadAccountPreferences,saveAccountPreferences} from '@/lib/accountPreferences';
import { SearchInputBar } from "./SearchInputBar";
import { ScopePillsRow } from "./ScopePillsRow";
import { SearchConfigRow } from "./SearchConfigRow";
import { PendientesColumn } from "./PendientesColumn";
import { QuickFiltersColumn } from "./QuickFiltersColumn";
import { ResultsVirtualTable } from "./ResultsVirtualTable";
import { DetailsPane } from "./DetailsPane";
import { SearchBottomBar } from "./SearchBottomBar";
import { SearchFloatingAiButton } from "./SearchFloatingAiButton";
import { PendingTaskModal } from "./PendingTaskModal";
import { NotionTemplatesModal } from "./NotionTemplatesModal";
import {detectUpload} from '@/lib/drxUploadPlan';
import { DropboxUploadModal } from "./DropboxUploadModal";
import { GlobalPasteModal, GlobalPasteImagePayload } from "./GlobalPasteModal";
import { filterByNotionBase } from "@/lib/notionFilters";
import { matchesFlexibleOrQuotedQuery } from "@/services/advancedQuery";
import { SearchHelpModal } from "./SearchHelpModal";
import { RenameModal, DuplicateModal, CreateFolderModal } from "./ActionDialogs";
import { BatchRenameModal } from "./BatchRenameModal";
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

  // Search input & scopes
  const [query, setQuery] = useState(externalQuery || "nneft");
  const [selectedScope, setSelectedScope] = useState("Notion");
  const [filterFavorites, setFilterFavorites] = useState(false);

  // Config & views (Deterministic initial states for SSR to prevent hydration errors)
  const [selectedTag, setSelectedTag] = useState("Ninguno");
  const [customTag, setCustomTag] = useState("");
  const [textScale, setTextScale] = useState("100%");
  const [groupBy, setGroupBy] = useState("none");
  const [selectedMonth, setSelectedMonth] = useState("Todos");
  const [viewZoom, setViewZoom] = useState<"list" | "small" | "medium" | "large">("list");
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
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isDropboxModalOpen, setIsDropboxModalOpen] = useState(false);
  const [dropboxTargetDir, setDropboxTargetDir] = useState("");
  const [isGlobalPasteOpen, setIsGlobalPasteOpen] = useState(false);
  const [isBatchRenameOpen, setIsBatchRenameOpen] = useState(false);
  const [globalFiles, setGlobalFiles] = useState<GlobalPasteImagePayload[]>([]);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [globalPasteText, setGlobalPasteText] = useState("");
  const [globalPasteImage, setGlobalPasteImage] = useState<GlobalPasteImagePayload | null>(null);

  // Theme background (10 ANFETA themes)
  const [themeBg, setThemeBg] = useState("#080B0F");

  // Favorites / Bookmarks
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set<string>());

  // Carga e hidratación segura de configuraciones desde localStorage sin romper SSR
  useEffect(() => {
    try {
      const savedTag = localStorage.getItem("anfeta_default_tag");
      if (savedTag) setSelectedTag(savedTag);

      const savedCustom = localStorage.getItem("anfeta_custom_tag");
      if (savedCustom) setCustomTag(savedCustom);

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

  // Table selections
  const [items, setItems] = useState<SearchResultRow[]>(initialItems);
  const [pinnedDetail,setPinnedDetail]=useState<SearchResultRow|null>(null);
  useEffect(()=>{setPinnedDetail(old=>old?items.find(row=>row.id===old.id)||null:null);},[items]);
  const [selectedItem, setSelectedItem] = useState<SearchResultRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  React.useEffect(() => {
    if (externalQuery !== undefined && externalQuery !== query) {
      setQuery(externalQuery);
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
    const newId = `tab_${Date.now()}`;
    const newTab: SearchTab = { id: newId, query: "", canClose: true };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setQuery("");
    onSearchChange?.("");
  };

  const KNOWN_TAGS = [
    "prtuzREVISION",
    "zclientes",
    "zdominios",
    "zproyectos",
    "zpagar",
    "zcorreos",
  ];

  const handleTagChange = (newTag: string) => {
    setSelectedTag(newTag);
    if (typeof window !== "undefined") {
      localStorage.setItem("anfeta_default_tag", newTag);
    }
    if (newTag === "Ninguno") {
      let q = query;
      for (const t of KNOWN_TAGS) {
        if (q.toLowerCase().startsWith(t.toLowerCase())) {
          q = q.slice(t.length).trim();
          break;
        }
      }
      handleQueryChange(q);
    } else if (newTag === "Personalizado") {
      if (customTag.trim()) {
        let q = query;
        for (const t of KNOWN_TAGS) {
          if (q.toLowerCase().startsWith(t.toLowerCase())) {
            q = q.slice(t.length).trim();
            break;
          }
        }
        handleQueryChange(q ? `${customTag.trim()} ${q}` : `${customTag.trim()} `);
      }
    } else {
      let q = query;
      for (const t of KNOWN_TAGS) {
        if (q.toLowerCase().startsWith(t.toLowerCase())) {
          q = q.slice(t.length).trim();
          break;
        }
      }
      handleQueryChange(q ? `${newTag} ${q}` : `${newTag} `);
    }
  };

  const handleCustomTagChange = (newCustom: string) => {
    setCustomTag(newCustom);
    if (typeof window !== "undefined") {
      localStorage.setItem("anfeta_custom_tag", newCustom);
    }
    let q = query;
    for (const t of KNOWN_TAGS) {
      if (q.toLowerCase().startsWith(t.toLowerCase())) {
        q = q.slice(t.length).trim();
        break;
      }
    }
    const cleanTag = newCustom.trim();
    handleQueryChange(cleanTag ? (q ? `${cleanTag} ${q}` : `${cleanTag} `) : q);
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

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      if (selectedItem) {
        handleDeleteItem(selectedItem);
      }
      return;
    }
    const count = selectedIds.size;
    if (window.confirm(`¿Eliminar ${count} página${count > 1 ? "s" : ""} seleccionada${count > 1 ? "s" : ""} del índice?`)) {
      playDeleteChime();
      setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)));
      if (selectedItem && selectedIds.has(selectedItem.id)) {
        setSelectedItem(null);
      }
      setSelectedIds(new Set());
    }
  };

  const handleDeleteItem = (item: any) => {
    playDeleteChime();
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    if (selectedItem?.id === item.id) setSelectedItem(null);
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

      if (e.key === "Enter" && !isInput && selectedItem) {
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
    const files = await Promise.all(droppedFiles.map(file => new Promise<GlobalPasteImagePayload>((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = () => { const dataUrl = String(reader.result); resolve({ dataUrl, base64: dataUrl.split(',')[1], filename: file.name, sizeBytes: file.size, contentType: file.type }); };
      reader.readAsDataURL(file);
    })));
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
    if (item.isFolder || item.type === "FOLDER") {
      const folderName = (item.name || item.target || item.path || "").trim();
      const queryValue = folderName.includes(" ") ? `folder:"${folderName}"` : `folder:${folderName}`;
      handleQueryChange(queryValue);
      return;
    }
    if (item.externalUrl) {
      window.open(item.externalUrl, "_blank");
    } else if (item.target || item.path) {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open-file", payload: { path: item.target || item.path } }),
      });
    }
  };

  const handleOpenLocation = (item: any) => {
    if (!item) return;
    const path = item.target || item.path;
    if (path) {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open-explorer", payload: { path } }),
      });
    }
  };

  const handleRefreshIndex = async () => {
    setIsSyncingNotion(true);
    try {
      let token = "";
      try {
        const saved = localStorage.getItem("anfeta_settings");
        if (saved) token = JSON.parse(saved).notionToken || "";
      } catch {}

      if (!token || !token.trim()) {
        const prompted = window.prompt("Ingresa tu Notion Token de integración para sincronizar en vivo con Notion:");
        if (prompted && prompted.trim()) {
          token = prompted.trim();
          try {
            const prev = JSON.parse(localStorage.getItem("anfeta_settings") || "{}");
            localStorage.setItem("anfeta_settings", JSON.stringify({ ...prev, notionToken: token }));
          } catch {}
        }
      }

      // Si hay token de Notion, forzar sincronización en vivo de páginas modificadas
      if (token && token.trim()) {
        await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync-notion", payload: { token: token.trim() } }),
        }).catch(() => {});
      }

      const data=await loadSearchIndex({fresh:true});
      window.dispatchEvent(new CustomEvent('anfeta_index_status',{detail:data}));
      if(data.items){setItems(previous=>retainSearchResults(previous,data));window.dispatchEvent(new CustomEvent('anfeta_data_refreshed',{detail:data}));sendWindowsNotification('ANFETA',data.warning?'Resultados disponibles; actualización pendiente.':'Índice actualizado.');}
    } catch(error) {
      setStatusError(error instanceof Error?error.message:"Error al sincronizar con Notion.");
    } finally {
      setIsSyncingNotion(false);
    }
  };

  const handleUpdateStatus = async (item: any, newStatus: string) => {
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
            id: item.id,
            source: item.source,
            oldName: item.name,
            newName,
            path: item.target || item.path,
          },
        }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, name: newName } : it))
        );
        if (selectedItem?.id === item.id) {
          setSelectedItem((prev: any) => (prev ? { ...prev, name: newName } : null));
        }
        sendWindowsNotification("Elemento renombrado", `Nuevo nombre: ${newName}`);
      }
    } catch (err) {
      console.error("Error renaming:", err);
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
              id: item.id,
              source: item.source,
              oldName: item.name,
              newName,
              path: item.target || item.path,
            },
          }),
        });
        if (res.ok) {
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
    let res = items.filter((item) => {
      if (query.trim()) {
        if (!matchesFlexibleOrQuotedQuery(item, query, searchOptions)) {
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
    if (currentUser && currentUser !== "__all__" && selectedScope !== "Dropbox" && selectedScope !== "Carpetas") {
      const uLow = currentUser.toLowerCase().trim();
      res = res.filter((it) => {
        const p = (it.assignedPerson || "").toLowerCase();
        const keys = Array.isArray((it as any).assignmentKeys)
          ? (it as any).assignmentKeys.map((k: string) => k.toLowerCase())
          : [];
        const text = ((it.name || "") + " " + (it.searchText || "")).toLowerCase();

        if (uLow === "nneft" || uLow === "neftali" || uLow === "nnetf") {
          return p === "neftali" || keys.some((k: string) => k.includes("neft") || k.includes("nnetf")) || /\b(?:nneft|nnetf|neft|neftali)\b/i.test(text);
        }
        if (uLow === "jjohn" || uLow === "john") {
          return p === "john" || keys.some((k: string) => k.includes("john")) || /\b(?:jjohn|john)\b/i.test(text);
        }
        if (uLow === "kkarl" || uLow === "karla") {
          return p === "karla" || keys.some((k: string) => k.includes("karl")) || /\b(?:kkarl|karla|karl)\b/i.test(text);
        }
        if (uLow === "bbria" || uLow === "brian") {
          return p === "brian" || keys.some((k: string) => k.includes("bria")) || /\b(?:bbria|brian)\b/i.test(text);
        }
        if (uLow === "ggena" || uLow === "genaro") {
          return p === "genaro" || keys.some((k: string) => k.includes("gena")) || /\b(?:ggena|genaro)\b/i.test(text);
        }
        if (uLow === "iisai" || uLow === "isaias" || uLow === "isai") {
          return p === "isaias" || keys.some((k: string) => k.includes("isai")) || /\b(?:iisai|isai|isaias)\b/i.test(text);
        }
        if (uLow === "ssote" || uLow === "sotelo") {
          return p === "sotelo" || keys.some((k: string) => k.includes("sote")) || /\b(?:ssote|sotelo)\b/i.test(text);
        }
        if (uLow === "aacal" || uLow === "acalli") {
          return p === "acalli" || keys.some((k: string) => k.includes("acal")) || /\b(?:aacal|acalli)\b/i.test(text);
        }
        if (uLow === "aandr" || uLow === "andrade") {
          return p === "andrade" || keys.some((k: string) => k.includes("andr")) || /\b(?:aandr|andrade)\b/i.test(text);
        }
        if (uLow === "eemma" || uLow === "emmanuel" || uLow === "eedua") {
          return p === "emmanuel" || keys.some((k: string) => k.includes("eemma") || k.includes("eedua")) || /\b(?:eemma|eedua|emmanuel)\b/i.test(text);
        }
        return p.includes(uLow) || keys.some((k: string) => k.includes(uLow)) || text.includes(uLow);
      });
    }

    if (selectedMonth && selectedMonth !== "Todos") {
      res = res.filter((it) => it.name.toUpperCase().includes(selectedMonth));
    }

    res=[...res].sort(newestFirst);
    if (groupBy === "domain") {
      return [...res].sort((a, b) => (a.domainChip || "").localeCompare(b.domainChip || ""));
    }
    if (groupBy === "month") {
      return [...res].sort((a, b) => (a.monthChip || "").localeCompare(b.monthChip || ""));
    }
    if (groupBy === "person") {
      return [...res].sort((a, b) => (a.assignedPerson || "").localeCompare(b.assignedPerson || ""));
    }
    return res;
  }, [items, query, searchOptions, selectedScope, filterFavorites, favorites, selectedIds, selectedMonth, groupBy, currentUser]);

  useEffect(()=>{setCurrentPage(1);},[query,selectedScope,currentUser,pageSize]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div
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
      />

      {/* 2. Pills de Ámbitos / Bases Notion */}
      <ScopePillsRow
        selectedScope={selectedScope}
        onSelectScope={(scope) => {
          setSelectedScope(scope);
          // Si el usuario tenía su tag personal y selecciona una base global, limpiar el tag para ver todos los registros
          const userTags = ["nneft", "jjohn", "kkarl", "bbria", "ggena", "iisai", "eedua", "ssote", "aacal", "aandr", "eemma"];
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
        currentUser={currentUser}
        onChangeCurrentUser={(newUser) => {
          onChangeCurrentUser?.(newUser);
          try {
            const prev = JSON.parse(localStorage.getItem("anfeta_settings") || "{}");
            localStorage.setItem("anfeta_settings", JSON.stringify({ ...prev, currentUser: newUser }));
            window.dispatchEvent(new CustomEvent("anfeta_settings_changed", { detail: { currentUser: newUser } }));
          } catch {}
          if (newUser !== "__all__") {
            handleQueryChange(newUser);
          } else {
            handleQueryChange("");
          }
        }}
        onSyncNotion={handleRefreshIndex}
        isSyncingNotion={isSyncingNotion}
        selectedTag={selectedTag}
        onChangeTag={handleTagChange}
        customTag={customTag}
        onChangeCustomTag={handleCustomTagChange}
        textScale={textScale}
        onChangeTextScale={handleTextScaleChange}
        groupBy={groupBy}
        onChangeGroupBy={handleGroupByChange}
        selectedMonth={selectedMonth}
        onChangeMonth={setSelectedMonth}
        viewZoom={viewZoom}
        onChangeViewZoom={setViewZoom}
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
      />

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
          <QuickFiltersColumn
            onQuickSearch={(term) => handleQueryChange(term)}
            activeTodayProjects={activeProjects}
            onFilterByProject={(domain) => {
              handleQueryChange(domain);
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
            <ExportResults rows={filteredItems} />
          </div>
          <ResultsVirtualTable
          currentUser={currentUser}
          items={pagedItems}
          selectedId={selectedItem?.id || null}
          selectedIds={selectedIds}
          searchQuery={query}
          favorites={favorites}
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
          textScale={textScale}
          groupBy={groupBy}
        /></div>

        {/* Col 4: DETALLES (320px) */}
        {isDetailsOpen && (
          <DetailsPane
            item={pinnedDetail||selectedItem}
            isPinned={!!pinnedDetail}
            onTogglePin={()=>setPinnedDetail(old=>old?null:selectedItem)}
            onOpen={handleOpenItem}
            onOpenLocation={handleOpenLocation}
            onSearchDomain={(domain) => handleQueryChange(domain)}
            onOpenUploadDropbox={handleOpenDropboxUpload}
            onOpenGlobalPaste={() => triggerGlobalPaste(null)}
            onDelete={handleDeleteItem}
            textScale={textScale}
          />
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

      {/* Botón Flotante Asistente IA */}
      <SearchFloatingAiButton onClick={() => alert("Asistente ANFETA IA listo.")} />

      {/* Modal Editor para Nuevo/Editar Pendiente */}
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
      {statusError && <div role="alert" className="fixed bottom-12 left-4 z-50 rounded bg-slate-900 p-3 text-rose-300">{statusError}</div>}
      {draggingFiles && <div className="pointer-events-none fixed inset-4 z-[100] flex items-center justify-center rounded-2xl border-2 border-dashed border-cyan-300 bg-slate-950/80 text-xl text-cyan-200">📥 Soltar archivo aquí para Pegado Global ANFETA (Dropbox / Notion)</div>}
      <GlobalPasteModal
        isOpen={isGlobalPasteOpen}
        onClose={() => {
          setIsGlobalPasteOpen(false);
          setGlobalPasteImage(null);
          setGlobalFiles([]);
        }}
        currentUser={currentUser}
        initialFiles={globalFiles}
        initialText={globalPasteText}
        initialImage={globalPasteImage}
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
    </div>
  );
}
