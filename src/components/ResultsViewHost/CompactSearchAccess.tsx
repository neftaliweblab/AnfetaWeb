'use client';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,SlidersHorizontal,X} from 'lucide-react';

export function CompactSearchAccess({onOpenFilters,renderQuickFilters}:{onOpenFilters:()=>void;renderQuickFilters:(onSelected:()=>void)=>React.ReactNode}){
  const [open,setOpen]=useState(false),[position,setPosition]=useState({top:0,left:0,width:260,height:460});
  const anchor=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null);
  const close=()=>{setOpen(false);anchor.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    const place=()=>{const bounds=anchor.current?.getBoundingClientRect();if(!bounds)return;const width=Math.min(260,window.innerWidth-16),height=Math.min(560,window.innerHeight-24);setPosition({width,height,left:Math.max(8,Math.min(bounds.left,window.innerWidth-width-8)),top:Math.max(8,Math.min(bounds.bottom+6,window.innerHeight-height-8))});};
    const outside=(event:MouseEvent)=>{if(!popup.current?.contains(event.target as Node)&&!anchor.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();}};
    place();popup.current?.querySelector<HTMLButtonElement>('button')?.focus();
    document.addEventListener('mousedown',outside);document.addEventListener('keydown',escape);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[open]);
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <button ref={anchor} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open?'compact-quick-searches':undefined} onClick={()=>setOpen(value=>!value)} className="flex items-center gap-1 rounded border border-sky-900 bg-sky-950/40 px-2 py-1 text-[11px] text-sky-200 hover:border-sky-500">Búsquedas rápidas<ChevronDown size={12}/></button>
    <button type="button" aria-expanded={false} onClick={onOpenFilters} className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:text-white"><SlidersHorizontal size={12}/>Abrir filtros</button>
    {open&&createPortal(<div ref={popup} id="compact-quick-searches" role="dialog" aria-label="Búsquedas rápidas" className="fixed z-[180] flex flex-col overflow-hidden rounded-xl border border-sky-900 bg-[#0F141C] p-2 shadow-2xl" style={position}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs text-sky-200"><span>Accesos rápidos</span><button type="button" onClick={close} aria-label="Cerrar búsquedas rápidas" className="rounded p-1 hover:bg-slate-800"><X size={15}/></button></div>
      <div className="min-h-0 flex-1">{renderQuickFilters(close)}</div>
    </div>,document.body)}
  </div>;
}
