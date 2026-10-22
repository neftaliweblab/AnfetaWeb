"use client";
import {useEffect,useRef,useState} from 'react';
import type {NotionCalendarActivity} from '@/types/anfeta';
import {AgendaActivityActions} from './AgendaActivityActions';
import {saveAgendaActivity,type AgendaUpdate} from './saveAgendaActivity';
import {anfetaSync} from '@/lib/anfetaBroadcastSync';

export type SearchActivityAction='review'|'handoff'|'schedule'|'menu'|'finish';
export function SearchActivityActions({item,currentUser,mode,position,onClose,onSaved}:{item:any;currentUser:string;mode:SearchActivityAction;position:{x:number;y:number};onClose:()=>void;onSaved:(activity:NotionCalendarActivity)=>void}){
  const [activity,setActivity]=useState<NotionCalendarActivity|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const saving=useRef(false);
  useEffect(()=>{const controller=new AbortController();fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)]),body:JSON.stringify({action:'activity-edit-snapshot',payload:{pageId:item.externalId||item.pageId||item.id}})}).then(async r=>{const data=await r.json();if(!r.ok||!data.activity)throw Error(data.error||'No se pudo leer la actividad actual.');if(!controller.signal.aborted)setActivity(data.activity);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[item]);
  async function save(updates:AgendaUpdate){if(!activity||saving.current)return false;saving.current=true;setBusy(true);setError('');try{
    const data=await saveAgendaActivity(activity,updates,currentUser,fresh=>setActivity(old=>old?{...old,...fresh}:old));
    setActivity(data.activity);onSaved(data.activity);anfetaSync.broadcast({type:'ACTIVITY_UPDATED',pageId:data.activity.pageId,updates:data.activity});window.dispatchEvent(new Event('anfeta_review_saved'));return true;
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');return false;}finally{saving.current=false;setBusy(false);}}
  if(!activity||mode==='finish')return <div role="dialog" aria-modal="true" aria-label="Acción de actividad" className="fixed inset-0 z-[400] grid place-items-center bg-black/70 p-4"><section className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-200"><h3 className="font-semibold">{mode==='finish'?'Finalizar actividad':'Acciones de actividad'}</h3><p className="my-3 break-words">{activity?activity.title:error?'No se pudo cargar la actividad.':'Consultando el estado actual…'}</p>{error&&<p role="alert" className="my-3 text-rose-300">{error}</p>}<div className="flex justify-end gap-3"><button disabled={busy} onClick={onClose}>Cerrar</button>{activity&&<button disabled={busy} className="rounded bg-emerald-800 p-2 disabled:opacity-40" onClick={async()=>{if(await save({status:'zREVISION'}))onClose();}}>{busy?'Guardando…':'Confirmar finalización'}</button>}</div></section></div>;
  return <><AgendaActivityActions activity={activity} currentUser={currentUser} position={position} initialAction={mode==='menu'?null:mode} busy={busy} onClose={onClose} onSave={save}/>{error&&<div role="alert" className="fixed bottom-4 left-1/2 z-[450] max-w-lg -translate-x-1/2 rounded-lg border border-rose-700 bg-rose-950 p-3 text-sm text-rose-100">{error}</div>}</>;
}
