"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {PersonalAgendaPane} from './ResultsViewHost/PersonalAgendaPane';
export function DailyWorkspace({currentUser}:{currentUser:string}){
 const [selection,setSelection]=useState<{person?:string;day?:string}|null>(null);const dialog=useRef<HTMLDivElement>(null);
 useEffect(()=>{const show=(event:Event)=>setSelection((event as CustomEvent).detail||{});window.addEventListener('anfeta_open_daily_workspace',show);return()=>window.removeEventListener('anfeta_open_daily_workspace',show);},[]);
 useEffect(()=>{if(!selection)return;const focused=document.activeElement as HTMLElement;dialog.current?.focus();return()=>focused?.focus();},[selection]);
 useEffect(()=>{if(!selection)return;document.documentElement.dataset.anfetaWorkspace='open';return()=>{delete document.documentElement.dataset.anfetaWorkspace;};},[selection]);
 useEffect(()=>setSelection(null),[currentUser]);
 if(!selection||typeof document==='undefined')return null;
 return createPortal(<div className="fixed inset-0 z-[330] flex items-center justify-center bg-black/75 p-2 sm:p-5"><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Jornada de actividades" className="flex h-[94dvh] w-[min(1500px,98vw)] flex-col overflow-hidden rounded-2xl border border-cyan-900 bg-slate-950 shadow-2xl" onKeyDown={event=>{if((document.activeElement as HTMLElement)?.closest('dialog[open]'))return;if(event.key==='Escape')setSelection(null);if(event.key==='Tab'){const all=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href],select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')||[]);const first=all[0],last=all[all.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}}>
 <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-cyan-200"><strong>Jornada · revisión y trabajo</strong><button type="button" aria-label="Cerrar jornada" onClick={()=>setSelection(null)} className="rounded border border-slate-700 px-3 py-1">✕</button></header>
 <div className="min-h-0 flex-1"><PersonalAgendaPane currentUser={currentUser} workspace initialPerson={selection.person} initialDay={selection.day}/></div>
 </div></div>,document.body);
}
