"use client";
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {ClipboardList,X} from 'lucide-react';
import {getAppLogs,serverAppLogs,subscribeAppLogs,recordAppLog,markAppLogsRead,clearAppLogs,diagnosticAdvice,formatDiagnosticReport,type LogLevel} from '@/lib/appDiagnostics';
export function useDiagnosticLog(owner:string,source:string,message:string,level:LogLevel='warning'){
 useEffect(()=>{if(message)recordAppLog(owner,source,message,level);},[owner,source,message,level]);
}
export function DiagnosticMessage({owner,source,message,level='warning'}:{owner:string;source:string;message:string;level?:LogLevel}){useDiagnosticLog(owner,source,message,level);return null;}
export function DiagnosticsLogs({owner}:{owner:string}){
 const subscribe=useCallback((fn:()=>void)=>subscribeAppLogs(owner,fn),[owner]),snapshot=useCallback(()=>getAppLogs(owner),[owner]);
 const entries=useSyncExternalStore(subscribe,snapshot,serverAppLogs),unread=entries.filter(e=>!e.read).length;
 const [open,setOpen]=useState(false),[feedback,setFeedback]=useState('');
 const dialog=useRef<HTMLElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setOpen(false);setFeedback('');},[owner]);
 useEffect(()=>{
  if(!owner)return;
  const error=(event:ErrorEvent)=>{if(event.filename&&!event.filename.startsWith(location.origin))return;recordAppLog(owner,'Aplicación',event.message||'Error inesperado de la aplicación.','error');};
  const rejection=(event:PromiseRejectionEvent)=>recordAppLog(owner,'Aplicación · proceso',event.reason instanceof Error?event.reason.message:'Un proceso de la aplicación no pudo completarse.','error');
  window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);
  return()=>{window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);};
 },[owner]);
 useEffect(()=>{
  if(!open)return;dialog.current?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}if(e.key==='Tab'){const all=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),summary,[tabindex="0"]')||[]);const first=all[0],last=all.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);trigger.current?.focus();};
 },[open]);
 if(!owner)return null;
 return <><button ref={trigger} type="button" onClick={()=>{markAppLogsRead(owner);setFeedback('');setOpen(true);}} aria-label={'Abrir Logs'+(unread?': '+unread+' nuevos avisos':'')} title="Logs · avisos, errores y sugerencias" className={'flex items-center gap-1 rounded border px-2 py-1 text-[11px] '+(unread?'border-amber-700 bg-amber-950/30 text-amber-200':'border-slate-700 text-slate-300 hover:bg-slate-800')}><ClipboardList size={13}/><span>Logs</span>{unread>0&&<span className="rounded bg-amber-700 px-1 font-bold">{unread}</span>}</button>
 {open&&typeof document!=='undefined'&&createPortal(<div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-3 sm:p-6" onClick={()=>setOpen(false)}><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="diagnostics-title" onClick={e=>e.stopPropagation()} className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0c141e] text-slate-200 shadow-2xl outline-none">
 <header className="flex items-start gap-3 border-b border-slate-700 p-4"><ClipboardList className="text-cyan-300" size={21}/><div className="flex-1"><h2 id="diagnostics-title" className="font-semibold text-white">Logs · Diagnóstico de ANFETA</h2><p className="mt-1 text-xs text-slate-400">{owner} · Envía una captura del registro o copia el reporte.</p></div><button type="button" aria-label="Cerrar Logs" onClick={()=>setOpen(false)} className="rounded p-1 hover:bg-slate-800"><X size={18}/></button></header>
 <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3 text-xs"><button type="button" disabled={!entries.length} onClick={async()=>{try{await navigator.clipboard.writeText(formatDiagnosticReport(entries));setFeedback('Reporte copiado. Compártelo manualmente con Neftali.');}catch{setFeedback('No se pudo copiar. Puedes tomar una captura del registro.');}}} className="rounded border border-cyan-800 px-2 py-1.5 text-cyan-200 disabled:opacity-40">Copiar reporte</button><button type="button" disabled={!entries.length} onClick={()=>{clearAppLogs(owner);setFeedback('Historial local limpiado.');}} className="rounded border border-slate-700 px-2 py-1.5 disabled:opacity-40">Limpiar</button><button type="button" onClick={()=>{window.dispatchEvent(new Event('anfeta_retry_pending'));setFeedback('Se solicitó reintentar el guardado de pendientes locales.');}} className="rounded border border-slate-700 px-2 py-1.5">Reintentar pendientes</button><span role="status" className="text-cyan-200">{feedback}</span></div>
 <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4" tabIndex={0}>{!entries.length&&<p className="py-8 text-center text-sm text-slate-400">No hay avisos registrados en esta pestaña.</p>}{entries.map(entry=>{const advice=diagnosticAdvice(entry.message);return <article key={entry.id} className={'rounded-xl border p-3 '+(entry.level==='error'?'border-rose-900/70 bg-rose-950/15':'border-amber-900/60 bg-amber-950/10')}><div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-400"><span>{entry.level==='error'?'Error':'Aviso'} · {entry.source}{entry.count>1?' · Repetido '+entry.count+' veces':''}</span><time dateTime={entry.lastAt}>{new Date(entry.lastAt).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})} · México</time></div><h3 className="mt-2 text-sm font-semibold text-white">{advice.title}</h3><p className="mt-2 text-xs leading-relaxed text-slate-300"><strong>Posible causa:</strong> {advice.cause}</p><p className="mt-2 text-xs leading-relaxed text-cyan-200"><strong>Qué puedes hacer:</strong> {advice.next}</p><details className="mt-3 text-xs" open={entries.length===1}><summary className="cursor-pointer text-slate-400">Ver mensaje original · {entry.id.slice(0,8)}</summary><p className="mt-2 select-text whitespace-pre-wrap break-words rounded bg-black/25 p-2 text-slate-300">{entry.message}</p></details></article>;})}</div>
 <footer className="border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500">Últimos 80 registros de esta pestaña y persona. No se envían automáticamente. Recargar no significa que un error se haya resuelto.</footer>
 </section></div>,document.body)}</>;
}
