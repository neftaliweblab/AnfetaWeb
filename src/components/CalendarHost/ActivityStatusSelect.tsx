"use client";
import {useRef,useState,useEffect} from 'react';
import {workflowState,isTerminadoHoyStatus} from '@/services/activityWorkflow';

export function getStatusOptionBadge(name: string): string {
  const cleanName = String(name || '').trim();
  if (!cleanName) return '';
  if (isTerminadoHoyStatus(cleanName)) return '🌤️ [HOY✓] ';

  const isFin =
    /^(?:z|fin|finaliz)/i.test(cleanName) ||
    /(?<![a-z])z[rdscp]?\b/i.test(cleanName) ||
    /finaliz|\bfin(?:-|\b)|cobro\/documentacion|cobrado/i.test(cleanName);
  if (isFin) return '🏁 [FIN] ';

  const isTer =
    (/terminad/i.test(cleanName) && !/no\s+terminad/i.test(cleanName)) ||
    /(?<![a-z])(?:tuz|uz|szr)[rdscp]?\b/i.test(cleanName);
  if (isTer) return '✅ [TER] ';

  const isSusp = /(?<![a-z])(?:aaprtuz|saprtuz)[rdscp]?\b|\bsuspe(?:ndid[oa]?s?)?\b|x\s*pago\s*info/i.test(cleanName);
  if (isSusp) return '⏸ [SUS] ';

  const isRev = /revisar|revisi[oó]n|\brrevi\b|(?<![a-z])rtuz[rdscp]?\b/i.test(cleanName);
  if (isRev) return '🔍 [REV] ';

  const isPending = /por\s+hacer|(?<![a-z])prtuz[rdscp]?\b|pendiente/i.test(cleanName);
  if (isPending) return '⏳ [POR] ';

  const isAssign = /por\s+asignar|arrancar|(?<![a-z])aprtuz[rdscp]?\b/i.test(cleanName);
  if (isAssign) return '👤 [PA] ';

  return '';
}

export function ActivityStatusSelect({pageId,status,disabled,onReview,onSave}:{pageId:string;status:string;disabled:boolean;onReview:()=>void;onSave:(status:string)=>Promise<boolean|void>|void}){
 const [options,setOptions]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);const loaded=useRef(false),controller=useRef<AbortController|null>(null),lock=useRef(false);
 useEffect(()=>{loaded.current=false;setOptions([]);setError('');return()=>controller.current?.abort();},[pageId]);
 async function load(){if(loaded.current||lock.current||disabled)return;lock.current=true;setBusy(true);controller.current=new AbortController();try{const response=await fetch('/api/data?type=activity-status-options&pageId='+encodeURIComponent(pageId.replace(/^review-mirror-/,'')),{signal:controller.current.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudieron consultar los estados.');setOptions((data.options||[]).map((option:any)=>option.name));loaded.current=true;setError('');}catch(e){if(!controller.current.signal.aborted)setError(e instanceof Error?e.message:'No se pudieron consultar estados.');}finally{lock.current=false;setBusy(false);}}
 async function change(value:string){if(workflowState(value)==='review'){onReview();return;}setBusy(true);setError('');try{if(await onSave(value)===false)throw Error('No se confirmó el estado. Revisa el aviso de la actividad.');}catch(e){setError(e instanceof Error?e.message:'No se pudo cambiar el estado.');}finally{setBusy(false);}}
 return <span className="inline-flex max-w-[65%] flex-col items-end gap-1"><select aria-label="Estado real de Notion" disabled={disabled||busy} value={status} onFocus={()=>void load()} onPointerDown={()=>void load()} onChange={e=>void change(e.target.value)} className="max-w-full rounded border border-slate-600 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-200">{!options.includes(status)&&<option value={status}>{getStatusOptionBadge(status)}{status}</option>}{options.map(name=><option key={name} value={name}>{getStatusOptionBadge(name)}{name}</option>)}</select>{busy&&<small className="text-slate-400">Consultando…</small>}{error&&<small role="alert" className="max-w-64 text-rose-300">{error}<button type="button" onClick={()=>void load()} className="ml-1 underline">Reintentar</button></small>}</span>;
}
