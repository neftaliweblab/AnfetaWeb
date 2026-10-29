"use client";
import {useMemo,useState} from 'react';
import {X,SlidersHorizontal,BookOpen} from 'lucide-react';
import {queryChips,appendQueryTerm} from '@/lib/searchQueryChips';
export function SearchQueryTools({query,onChange,onHelp,regex=false}:{query:string;onChange:(value:string)=>void;onHelp?:()=>void;regex?:boolean}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(''),[mode,setMode]=useState<'include'|'exclude'|'any'>('include');
 const chips=useMemo(()=>regex?[]:queryChips(query),[query,regex]);
 return <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
 <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className="flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-cyan-300"><SlidersHorizontal className="h-3 w-3"/>Términos y comandos</button>
 {chips.map(chip=><button type="button" key={chip.start} title={'Quitar '+chip.text} onClick={()=>onChange(chip.without)} className="flex max-w-60 items-center gap-1 rounded border border-cyan-900 bg-cyan-950/40 px-1.5 py-0.5 text-cyan-200"><span className="truncate">{chip.text}</span><X className="h-3 w-3 shrink-0"/></button>)}
 {open&&<form className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-2" onSubmit={e=>{e.preventDefault();if(!regex){onChange(appendQueryTerm(query,value,mode));setValue('');}}}>
 <select aria-label="Cómo combinar el término" value={mode} onChange={e=>setMode(e.target.value as typeof mode)} className="rounded bg-slate-800 p-1"><option value="include">Incluir · AND</option><option value="exclude">Excluir · NOT</option><option value="any">Cualquiera · OR</option></select>
 <input aria-label="Término o tag" placeholder="Ej. gge11 o reporte del mes" value={value} onChange={e=>setValue(e.target.value)} className="min-w-40 flex-1 rounded border border-slate-700 bg-slate-950 p-1"/>
 <button disabled={regex||!value.trim()} className="rounded bg-cyan-800 px-2 py-1 disabled:opacity-40">Agregar</button><button type="button" onClick={onHelp} className="flex items-center gap-1 text-cyan-300"><BookOpen className="h-3 w-3"/>Catálogo de comandos</button><button type="button" aria-label="Cerrar comandos" onClick={()=>setOpen(false)}><X className="h-3 w-3"/></button>
 <span className="w-full text-slate-400">{regex?'Desactiva .* para usar los términos visuales.':'Incluir exige el término; excluir lo descarta; cualquiera amplía la búsqueda. Los grupos se conservan completos.'}</span>
 </form>}</div>;
}
