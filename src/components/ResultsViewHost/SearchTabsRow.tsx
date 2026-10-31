"use client";

import type {SearchShortcutMode} from "@/lib/searchTabNavigation";
import React, {useEffect,useState} from "react";
import { Search, Plus, X, Star, Timer } from "lucide-react";
import { TopBarUtilities } from "../TopBarUtilities";

export interface SearchTab {
  id: string;
  query: string;
  canClose: boolean;
  unseen?: boolean;
  pending?: boolean;
  remindAt?: number;
}

interface SearchTabsRowProps {
  tabs: SearchTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  shortcutMode?:SearchShortcutMode;
  onMarkPending?: (id:string,pending:boolean,minutes?:number)=>void;
  onRestorePrevious?: () => void;
  textScale?: string;
  currentUser?: string;
  onTriggerAutomation?: () => void;
  onOpenAnnouncements?: () => void;
}

function SearchTabsRowComponent({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  shortcutMode="compatible",
  onMarkPending,
  onRestorePrevious,
  textScale = "100%",
  currentUser,
  onTriggerAutomation,
  onOpenAnnouncements,
}: SearchTabsRowProps) {
  const tabList=React.useRef<HTMLDivElement>(null);
  useEffect(()=>{const list=tabList.current,active=list?.querySelector<HTMLElement>('[aria-selected="true"]');if(!list||!active)return;const outer=list.getBoundingClientRect(),inner=active.getBoundingClientRect();if(inner.right>outer.right)list.scrollLeft+=inner.right-outer.right;else if(inner.left<outer.left)list.scrollLeft-=outer.left-inner.left;},[activeTabId,tabs.length]);
  const [now,setNow]=useState(()=>Date.now());
  const hasTimers=tabs.some(tab=>!!tab.remindAt);
  useEffect(()=>{if(!hasTimers)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer);},[hasTimers]);
  const pendingCount=tabs.filter(tab=>tab.pending||tab.unseen||tab.remindAt&&tab.remindAt<=now).length;
  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  return (
    <div
      style={{
        paddingTop: `${Math.max(2, Math.round(4 * scale))}px`,
        paddingBottom: `${Math.max(2, Math.round(2 * scale))}px`,
        gap: `${Math.round(4 * scale)}px`,
      }}
      className="flex items-center justify-between px-3 bg-[#0A0E17] select-none border-b border-[#1A2332]/50 transition-all gap-2 min-h-[34px]"
    >
      <div
        style={{ gap: `${Math.round(4 * scale)}px` }}
        ref={tabList} role="tablist" aria-label="Búsquedas abiertas" className="flex items-center overflow-x-auto scrollbar-none flex-1 min-w-0"
      >
        <span className="shrink-0 text-[10px] text-slate-400" title="Búsquedas abiertas y pendientes">{tabs.length} abiertas{pendingCount?` · ${pendingCount} pendientes`:""}</span>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const expired=!!tab.remindAt&&tab.remindAt<=now;
          const alarm=tab.unseen||expired;
          const displayLabel = tab.query.trim() ? tab.query : "Búsqueda";
          return (
            <div
              key={tab.id}
              role="tab" aria-selected={isActive} tabIndex={0}
              onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==="Enter"||e.key===" ")){e.preventDefault();onSelectTab(tab.id);}}}
              onClick={() => onSelectTab(tab.id)}
              style={{
                padding: `${Math.max(2, Math.round(3 * scale))}px ${Math.round(10 * scale)}px`,
                fontSize: `${(11 * scale).toFixed(1)}px`,
                gap: `${Math.round(5 * scale)}px`,
              }}
              title={displayLabel+(expired?" · Recordatorio vencido; pulsa para reconocerlo":"")}
              className={`${alarm?"motion-safe:animate-pulse ring-1 ring-amber-400 shadow-[0_0_12px_#f59e0b55]":""} flex items-center rounded-t-md cursor-pointer border-t border-l border-r transition-colors ${
                isActive
                  ? "bg-[#161F2C] border-[#38BDF8] text-[#F1F5F9] font-medium shadow-[0_-1px_6px_rgba(56,189,248,0.2)]"
                  : "bg-[#101721] border-[#1E2836] text-[#94A3B8] hover:bg-[#131E2B] hover:text-[#CBD5E1]"
              }`}
            >
              <Search
                style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }}
                className="text-[#38BDF8] shrink-0"
              />
              <span
                style={{
                  maxWidth: `${Math.round(140 * scale)}px`,
                  fontSize: `${(11 * scale).toFixed(1)}px`,
                }}
                className="truncate font-mono"
              >
                {displayLabel}
              </span>
              {onMarkPending&&<><button type="button" aria-label={tab.pending?'Quitar pendiente':'Marcar búsqueda pendiente'} title={tab.pending?'Quitar pendiente':'Marcar para revisar después'} className={tab.pending?'text-amber-300':'text-slate-500 hover:text-amber-300'} onClick={e=>{e.stopPropagation();onMarkPending(tab.id,!tab.pending);}}><Star className="h-3 w-3" fill={tab.pending?'currentColor':'none'}/></button><label title="Recordar esta búsqueda en minutos" className="flex items-center gap-0.5 text-slate-400" onClick={e=>e.stopPropagation()}><Timer className="h-3 w-3"/><select aria-label="Recordatorio de búsqueda" className="max-w-14 rounded bg-slate-900 text-[10px]" value="" onChange={e=>{if(e.target.value)onMarkPending(tab.id,true,Number(e.target.value));}}><option value="">{tab.remindAt?expired?'¡Revisar!':Math.ceil((tab.remindAt-now)/60000)+' min':'—'}</option><option value="5">5 min</option><option value="10">10 min</option><option value="60">1 hora</option></select></label></>}
              {tab.canClose && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-[#EF4444]/20 hover:text-[#F87171] text-[#64748B] transition-colors cursor-pointer"
                  aria-label="Cerrar búsqueda"
                  title={"Cerrar búsqueda interna"+(shortcutMode==='off'?'':' · Ctrl+Alt+W')}
                >
                  <X style={{ width: `${Math.round(12 * scale)}px`, height: `${Math.round(12 * scale)}px` }} />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onNewTab}
          className="w-6 h-6 flex items-center justify-center rounded bg-[#161F2C] border border-[#26354A] text-[#38BDF8] hover:bg-[#1E293B] hover:border-[#38BDF8] text-xs font-bold transition-colors ml-1 shrink-0"
          aria-label="Nueva pestaña de búsqueda"
          title={"Nueva búsqueda"+(shortcutMode==='off'?'':' · Ctrl+Alt+T')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        {onRestorePrevious && (
          <button
            type="button"
            onClick={onRestorePrevious}
            title="Añade búsquedas del respaldo anterior sin borrar las actuales"
            className="ml-2 shrink-0 rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Recuperar búsquedas anteriores
          </button>
        )}
      </div>

      {/* Lado derecho: Herramientas secundarias reubicadas desde la barra superior */}
      <TopBarUtilities
        currentUser={currentUser}
        onTriggerAutomation={onTriggerAutomation}
        onOpenAnnouncements={onOpenAnnouncements}
        className="shrink-0 ml-auto hidden sm:flex"
      />
    </div>
  );
}
export const SearchTabsRow = React.memo(SearchTabsRowComponent);
