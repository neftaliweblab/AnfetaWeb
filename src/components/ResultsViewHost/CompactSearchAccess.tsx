'use client';
import {ChevronDown} from 'lucide-react';

export function CompactSearchAccess({onOpenFilters,isOpen=false}:{onOpenFilters:()=>void;isOpen?:boolean}){
  return <button type="button" aria-expanded={isOpen} aria-controls="quick-search-panel" onClick={onOpenFilters} className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors cursor-pointer ${isOpen ? 'border-sky-500 bg-sky-900/60 text-white font-semibold' : 'border-sky-900 bg-sky-950/40 text-sky-200 hover:border-sky-500'}`}>Búsquedas rápidas<ChevronDown size={12} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'}/></button>;
}
