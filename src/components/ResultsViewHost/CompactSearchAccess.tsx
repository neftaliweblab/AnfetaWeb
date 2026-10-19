'use client';
import {ChevronDown} from 'lucide-react';

export function CompactSearchAccess({onOpenFilters}:{onOpenFilters:()=>void}){
  return <button type="button" aria-expanded={false} aria-controls="quick-search-panel" onClick={onOpenFilters} className="flex items-center gap-1 rounded border border-sky-900 bg-sky-950/40 px-2 py-1 text-[11px] text-sky-200 hover:border-sky-500">Búsquedas rápidas<ChevronDown size={12}/></button>;
}
