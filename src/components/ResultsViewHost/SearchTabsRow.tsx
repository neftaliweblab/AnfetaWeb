"use client";

import React from "react";
import { Search, Plus, X } from "lucide-react";

export interface SearchTab {
  id: string;
  query: string;
  canClose: boolean;
}

interface SearchTabsRowProps {
  tabs: SearchTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  textScale?: string;
}

export function SearchTabsRow({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  textScale = "100%",
}: SearchTabsRowProps) {
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
      className="flex items-center px-3 bg-[#0A0E17] select-none border-b border-[#1A2332]/50 transition-all"
    >
      <div
        style={{ gap: `${Math.round(4 * scale)}px` }}
        className="flex items-center overflow-x-auto scrollbar-none flex-1"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const displayLabel = tab.query.trim() ? tab.query : "Búsqueda";
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                padding: `${Math.max(2, Math.round(3 * scale))}px ${Math.round(10 * scale)}px`,
                fontSize: `${(11 * scale).toFixed(1)}px`,
                gap: `${Math.round(5 * scale)}px`,
              }}
              className={`flex items-center rounded-t-md cursor-pointer border-t border-l border-r transition-colors ${
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
              {tab.canClose && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-[#EF4444]/20 hover:text-[#F87171] text-[#64748B] transition-colors cursor-pointer"
                  title="Cerrar pestaña"
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
          className="w-6 h-6 flex items-center justify-center rounded bg-[#161F2C] border border-[#26354A] text-[#38BDF8] hover:bg-[#1E293B] hover:border-[#38BDF8] text-xs font-bold transition-colors ml-1"
          title="Abrir nueva pestaña de búsqueda (Ctrl+T)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
