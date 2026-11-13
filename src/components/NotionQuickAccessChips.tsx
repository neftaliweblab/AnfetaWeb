"use client";

import React, { useEffect, useState } from 'react';
import { Database, LayoutGrid } from 'lucide-react';
import { openNotionPage } from '@/services/windowsIntegration';
import { DEFAULT_NOTION_BASES, NOTION_VIEWS, type NotionBaseLinkEntry } from '@/lib/notionViewsCatalog';

export function useNotionBaseLinks(): NotionBaseLinkEntry[] {
  const [bases, setBases] = useState<NotionBaseLinkEntry[]>(DEFAULT_NOTION_BASES);

  useEffect(() => {
    let active = true;
    fetch('/api/data?type=notion-base-links', { signal: AbortSignal.timeout(15000) })
      .then((res) => res.json())
      .then((data) => {
        if (!active || !Array.isArray(data?.items) || data.items.length === 0) return;
        setBases((prev) =>
          prev.map((base) => {
            const cleanDbId = base.databaseId.replace(/-/g, '').toLowerCase();
            const found = data.items.find(
              (it: any) =>
                String(it.id || '').replace(/-/g, '').toLowerCase() === cleanDbId ||
                it.name?.toLowerCase().includes(base.id.toLowerCase()) ||
                it.name?.toLowerCase().includes(base.name.toLowerCase())
            );
            return found ? { ...base, url: found.url } : base;
          })
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return bases;
}

export function NotionQuickAccessChips({ compact = false }: { compact?: boolean }) {
  const bases = useNotionBaseLinks();

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-1 pl-1 ml-0.5 border-l border-slate-800"
        title="Bases originales de Notion"
      >
        <span className="text-[10px] text-slate-500 font-medium hidden xl:inline">Bases:</span>
        {bases.map((base) => (
          <button
            key={base.id}
            type="button"
            onClick={() => openNotionPage(base.url)}
            title={`Abrir base original «${base.name}» en Notion`}
            className="flex items-center gap-1 rounded border border-cyan-900/80 bg-cyan-950/40 hover:bg-cyan-900/60 hover:border-cyan-400 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200 transition-colors cursor-pointer shadow-sm"
          >
            <Database className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
            <span>{base.name}</span>
            <span className="rounded bg-cyan-900/90 px-1 py-0.2 text-[8px] font-bold text-cyan-300 border border-cyan-700/60">
              BD
            </span>
          </button>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center gap-1 pl-1 ml-0.5 border-l border-slate-800"
        title="Vistas rápidas de Notion (vvist)"
      >
        <span className="text-[10px] text-slate-500 font-medium hidden xl:inline">Vistas:</span>
        {NOTION_VIEWS.map((view) => {
          const isReady = view.status === 'ready' && Boolean(view.url);
          return (
            <button
              key={view.id}
              type="button"
              disabled={!isReady}
              onClick={() => {
                if (view.url) openNotionPage(view.url);
              }}
              title={view.tooltip}
              className={
                isReady
                  ? 'flex items-center gap-1 rounded border border-violet-800/80 bg-violet-950/40 hover:bg-violet-900/60 hover:border-violet-400 px-1.5 py-0.5 text-[10px] font-medium text-violet-200 transition-colors cursor-pointer shadow-sm'
                  : 'flex items-center gap-1 rounded border border-dashed border-amber-700/60 bg-amber-950/25 px-1.5 py-0.5 text-[10px] font-medium text-amber-300/80 cursor-not-allowed opacity-85'
              }
            >
              <LayoutGrid className={`w-2.5 h-2.5 shrink-0 ${isReady ? 'text-violet-400' : 'text-amber-400/80'}`} />
              <span>{view.name}</span>
              <span
                className={
                  isReady
                    ? 'rounded bg-violet-900/90 px-1 py-0.2 text-[8px] font-bold text-violet-300 border border-violet-700/60'
                    : 'rounded bg-amber-900/60 px-1 py-0.2 text-[8px] font-bold text-amber-300 border border-amber-700/50'
                }
              >
                {isReady ? (compact ? 'V' : 'VISTA') : 'PEND'}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
