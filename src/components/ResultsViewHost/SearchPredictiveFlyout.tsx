"use client";

import React from "react";
import {
  Globe,
  Tag,
  Bookmark,
  Layers,
  Sparkles,
  Command,
  ArrowRight,
} from "lucide-react";
import {
  PredictiveSuggestionItem,
  mergePredictiveQuery,
} from "@/lib/searchPredictiveService";

interface SearchPredictiveFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  headerText: string;
  suggestions: PredictiveSuggestionItem[];
  savedSearches: string[];
  hintText: string;
  currentQuery: string;
  onApplyQuery: (newQuery: string) => void;
}

export function SearchPredictiveFlyout({
  isOpen,
  onClose,
  headerText,
  suggestions,
  savedSearches,
  hintText,
  currentQuery,
  onApplyQuery,
}: SearchPredictiveFlyoutProps) {
  if (!isOpen) return null;

  const handleSelectSuggestion = (s: PredictiveSuggestionItem) => {
    const nextQ = mergePredictiveQuery(currentQuery, s.query, s.kind);
    onApplyQuery(nextQ);
    onClose();
  };

  const handleSelectSaved = (saved: string) => {
    onApplyQuery(saved);
    onClose();
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0F151C] border border-[#2A526B] rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.7)] p-3 space-y-3 max-h-[460px] overflow-y-auto scrollbar-thin select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* 1. SECCIÓN: SUGERENCIAS Y BÚSQUEDAS RÁPIDAS */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
              {headerText}
            </span>
            <span className="text-[10px] text-[#64748B] font-mono">
              {suggestions.length} sugerencias
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSuggestion(s)}
                className="flex flex-col text-left p-2 rounded-xl bg-[#12202B] hover:bg-[#182C3D] border border-[#2B526A] hover:border-[#38BDF8] transition-all group cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-1.5 min-w-0 mb-1">
                  {s.kind === "Domain" && (
                    <Globe className="w-3 h-3 text-[#38BDF8] shrink-0" />
                  )}
                  {s.kind === "Base" && (
                    <Layers className="w-3 h-3 text-[#A78BFA] shrink-0" />
                  )}
                  {s.kind === "Topic" && (
                    <Tag className="w-3 h-3 text-[#4ADE80] shrink-0" />
                  )}
                  <span className="text-[11px] font-semibold text-white group-hover:text-[#38BDF8] truncate flex-1">
                    {s.title}
                  </span>
                </div>
                <span className="text-[9px] text-[#94A3B8] group-hover:text-[#CBD5E1] line-clamp-2 leading-tight">
                  {s.subtitle}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. SECCIÓN: BÚSQUEDAS GUARDADAS */}
      {savedSearches.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-[#1E2E3E]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Bookmark className="w-3 h-3 text-[#FACC15]" />
            <span>Búsquedas guardadas</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {savedSearches.map((saved) => (
              <button
                key={saved}
                type="button"
                onClick={() => handleSelectSaved(saved)}
                className="px-2.5 py-1 rounded-lg bg-[#16202C] hover:bg-[#203042] border border-[#2A3E54] hover:border-[#38BDF8] text-[11px] text-[#CBD5E1] hover:text-white transition-colors flex items-center gap-1.5 group cursor-pointer"
              >
                <Command className="w-2.5 h-2.5 text-[#64748B] group-hover:text-[#38BDF8]" />
                <span className="font-mono">{saved}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. FOOTER HINT */}
      <div className="pt-1.5 border-t border-[#1A2634] flex items-center justify-between text-[10px] text-[#64748B]">
        <span>{hintText}</span>
        <span className="hidden sm:inline font-mono text-[9px] text-[#475569]">
          ESC para cerrar
        </span>
      </div>
    </div>
  );
}
