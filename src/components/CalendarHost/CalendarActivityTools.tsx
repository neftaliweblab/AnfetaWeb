"use client";
import React,{useEffect,useState} from 'react';
import {NotionCalendarActivity} from '@/types/anfeta';
import {canEditActivity,isReviewer} from '@/services/activityPermissions';
import {normalizePerson} from '@/services/identityNormalizer';
import {calendarTime,mexicoDate} from '@/services/calendarPresentation';
type Session={id:string;startedAt:string;runningSince:number|null;seconds:number};
export function CalendarActivityTools({activity,currentUser,onSave}:{activity:NotionCalendarActivity;currentUser:string;onSave:(updates:any)=>Promise<boolean|void>|void}) {
  const [open,setOpen]=useState(false),[title,setTitle]=useState(activity.title),[day,setDay]=useState(mexicoDate(activity.start)),[start,setStart]=useState(calendarTime(activity.start)),[end,setEnd]=useState(calendarTime(activity.end)),[note,setNote]=useState(''),[person,setPerson]=useState(activity.person),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [history,setHistory]=useState<any[]>([]);
  const [session,setSession]=useState<Session|null>(null),[tick,setTick]=useState(Date.now());
  const key='anfeta-work-session:'+normalizePerson(currentUser)+':'+activity.pageId;
  useEffect(()=>{setTitle(activity.title);setDay(mexicoDate(activity.start));setStart(calendarTime(activity.start));setEnd(calendarTime(activity.end));setPerson(activity.person);setError('');setNote('');try{setSession(JSON.parse(localStorage.getItem(key)||'null'));}catch{setSession(null);}},[activity.pageId,key]);
  useEffect(()=>{if(session)try{localStorage.setItem(key,JSON.stringify(session));}catch{}const timer=setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(timer);},[key,session]);
  useEffect(()=>{if(!open)return;const controller=new AbortController();fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action:'calendar-movement-history',payload:{pageId:activity.pageId}})}).then(async res=>{const data=await res.json();if(!res.ok)throw new Error(data.error);setHistory(data.items || []);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[open,activity.pageId]);
  const seconds=session?session.seconds+(session.runningSince?Math.max(0,Math.floor((tick-session.runningSince)/1000)):0):0;
  const editable=canEditActivity(currentUser,activity),flow=activity.reviewFlow;
  const resolve=editable&&flow?.State==='pending'&&normalizePerson(currentUser)===normalizePerson(flow.ReviewAssignee);
  const save=async(updates:any)=>{if(busy)return;setBusy(true);setError('');try{if(await onSave(updates)===false)return;setOpen(false);}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar');}finally{setBusy(false);}};
  const finish=async()=>{if(!session||busy)return;setBusy(true);setError('');try{const res=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'calendar-work-session',payload:{pageId:activity.pageId,currentUser,session:{id:session.id,startedAt:session.startedAt,endedAt:new Date().toISOString(),seconds}}})});const data=await res.json();if(!res.ok||!data.success)throw new Error(data.error||'No se guardó la sesión');localStorage.removeItem(key);setSession(null);}catch(e){setError(e instanceof Error?e.message:'No se guardó la sesión');}finally{setBusy(false);}};
  return <section className="space-y-2 border-t border-slate-700 pt-3 text-xs">
    <button onClick={()=>{if(!('speechSynthesis' in window)){setError('Este navegador no tiene lectura por voz.');return;}speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(activity.title);speech.lang='es-MX';speechSynthesis.speak(speech);}} className="text-cyan-300 mr-3">Leer actividad</button><button onClick={()=>{if('speechSynthesis' in window)speechSynthesis.cancel();}} className="text-slate-400 mr-3">Detener voz</button>
    <button onClick={()=>setOpen(!open)} className="text-cyan-300 underline">Editar / reprogramar / correcciones</button>
    {error&&<p role="alert" className="text-rose-300">{error}</p>}
    {open&&<div className="space-y-2 rounded border border-slate-700 p-3">
      <label className="block">Título<input disabled={!editable||busy} maxLength={1800} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded bg-slate-800 p-2" /></label>
      <label className="block">Fecha<input type="date" disabled={!editable||busy} value={day} onChange={e=>setDay(e.target.value)} className="ml-2 rounded bg-slate-800 p-1" /></label>
      <div className="flex gap-2"><label>Inicio<input type="time" step={900} value={start} onChange={e=>setStart(e.target.value)} className="block rounded bg-slate-800 p-1" /></label><label>Fin<input type="time" step={900} value={end} onChange={e=>setEnd(e.target.value)} className="block rounded bg-slate-800 p-1" /></label></div>
      <button disabled={!editable||busy} onClick={()=>save({title,start:day+'T'+start+':00-06:00',end:day+'T'+end+':00-06:00'})} className="rounded bg-cyan-800 px-3 py-2 disabled:opacity-40">Guardar título y horario</button>
      {history.length > 0 && <div className="text-slate-400 space-y-1"><p>Historial de movimientos</p>{history.map((move,index)=><p key={index}>{mexicoDate(move.fromStart)} → {mexicoDate(move.toStart)} · {move.updatedBy}</p>)}<button disabled={busy||!editable} onClick={()=>save({start:history[0].fromStart,end:history[0].fromEnd})} className="text-cyan-300 underline">Volver al horario original</button></div>}
      {resolve&&<><label className="block">Correcciones solicitadas<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1200} className="w-full rounded bg-slate-800 p-2" /></label><button disabled={busy||!note.trim()} onClick={()=>save({reviewAction:'return',note})} className="rounded border border-amber-700 px-3 py-2 disabled:opacity-40">Devolver al responsable</button></>}
      {flow?.State==='approved'&&isReviewer(currentUser)&&<><label className="block">Continuar con responsable<select value={person} onChange={e=>setPerson(e.target.value)} className="ml-2 bg-slate-800 rounded p-1">{['John','Isaias','Genaro','Neftali','Karla','Andrade','Sotelo','Brian','Acalli'].map(p=><option key={p}>{p}</option>)}</select></label><button disabled={busy||!editable} onClick={()=>save({reviewAction:'reassign',person})} className="rounded border border-cyan-800 p-2">Reasignar aprobada</button></>}
    </div>}
    {editable&&<div className="flex items-center gap-2 flex-wrap"><span className="font-mono">⏱ {Math.floor(seconds/3600).toString().padStart(2,'0')}:{Math.floor(seconds/60)%60<10?'0':''}{Math.floor(seconds/60)%60}:{(seconds%60).toString().padStart(2,'0')}</span>
      {!session?<button onClick={()=>setSession({id:crypto.randomUUID(),startedAt:new Date().toISOString(),runningSince:Date.now(),seconds:0})} className="text-cyan-300">Iniciar</button>:<><button disabled={busy} onClick={()=>setSession({...session,seconds,runningSince:session.runningSince?null:Date.now()})} className="text-cyan-300">{session.runningSince?'Pausar':'Reanudar'}</button><button disabled={busy} onClick={finish} className="text-emerald-300">Guardar sesión</button><button disabled={busy} onClick={()=>{localStorage.removeItem(key);setSession(null);}} className="text-slate-400">Descartar</button></>}
    </div>}
  </section>;
}
