"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {NotionCalendarActivity} from '@/types/anfeta';
import {canEditActivity,isDirection,isReviewer} from '@/services/activityPermissions';
import {normalizePerson} from '@/services/identityNormalizer';
import {workflowState} from '@/services/activityWorkflow';
import {calendarTime,mexicoDate} from '@/services/calendarPresentation';
import {ViewportMenu} from '../CalendarHost/ViewportMenu';
import {QuickScheduleActions} from '../CalendarHost/QuickScheduleModal';
import {ReassignActivityModal} from '../CalendarHost/ReassignActivityModal';
import {SendToReviewModal} from '../CalendarHost/SendToReviewModal';
import type {AgendaUpdate} from './saveAgendaActivity';

export function AgendaActivityActions({activity,currentUser,position,busy,onClose,onSave,initialAction=null}:{activity:NotionCalendarActivity;currentUser:string;position:{x:number;y:number};busy:boolean;initialAction?:'review'|'handoff'|'schedule'|null;onClose:()=>void;onSave:(updates:AgendaUpdate)=>Promise<boolean>}){
  const [modal,setModal]=useState<'review'|'handoff'|'schedule'|null>(initialAction);
  const [error,setError]=useState('');
  const editable=canEditActivity(currentUser,activity)&&!activity.isHandoffMirror;
  const completed=workflowState(activity.status,activity.title)==='completed';
  const handoff=editable&&!completed&&workflowState(activity.status,activity.title)!=='review'&&activity.reviewFlow?.State!=='pending'&&(isDirection(currentUser)||normalizePerson(currentUser)===normalizePerson(activity.person));
  const finish=editable&&!completed&&(activity.reviewFlow?.State==='pending'?normalizePerson(currentUser)===normalizePerson(activity.reviewFlow.ReviewAssignee):isReviewer(currentUser));
  useEffect(()=>{
    if(modal)return;
    const click=()=>{if(!busy)onClose();},escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onClose();};
    window.addEventListener('click',click);window.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('click',click);window.removeEventListener('keydown',escape);};
  },[modal,busy,onClose]);
  const button='w-full px-3 py-2 text-left hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed';
  if(modal==='handoff')return <ReassignActivityModal activity={activity} onClose={onClose} onConfirm={onSave}/>;
  if(modal==='review')return <SendToReviewModal activity={activity} currentUser={currentUser} onClose={onClose} onConfirm={(reviewer,leaveVisualCopy)=>onSave({status:'rtuzREVISION',reviewer,leaveVisualCopy})}/>;
  if(modal==='schedule')return <AgendaScheduleDialog activity={activity} busy={busy} onClose={onClose} onSave={onSave}/>;
  return <ViewportMenu position={position}>
    <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2 text-[10px] text-slate-400">ACCIONES DE ACTIVIDAD<button aria-label="Cerrar acciones" disabled={busy} onClick={onClose}>✕</button></div>
    <button role="menuitem" disabled={!handoff||busy} className={button+' text-cyan-200'} onClick={()=>setModal('handoff')}>◇ Reasignar actividad…</button>
    <button role="menuitem" disabled={!editable||completed||busy} className={button+' text-sky-300'} onClick={()=>setModal('review')}>◇ Enviar a revisión final…</button>
    <button role="menuitem" disabled={!finish||busy} className={button+' text-emerald-300'} onClick={async()=>{setError('');if(await onSave({status:'zREVISION',isFinalized:true}))onClose();else setError('No se confirmó el cambio. Revisa el aviso del calendario.');}}>✓ Finalizar actividad (zREVISION)</button>
    <button role="menuitem" disabled={!editable||completed||busy} className={button+' text-yellow-300'} onClick={()=>setModal('schedule')}>▣ Editar fecha y horario…</button>
    {editable&&!completed&&<QuickScheduleActions activity={activity} currentUser={currentUser} disabled={busy} onClose={onClose} onSave={onSave}/>}
    {!editable&&<p className="px-3 py-2 text-slate-400">Esta actividad es de solo lectura.</p>}
    {error&&<p role="alert" className="px-3 py-2 text-rose-300">{error}</p>}
  </ViewportMenu>;
}

function AgendaScheduleDialog({activity,busy,onClose,onSave}:{activity:NotionCalendarActivity;busy:boolean;onClose:()=>void;onSave:(updates:AgendaUpdate)=>Promise<boolean>}){
  const baseline=useRef(activity).current;
  const [day,setDay]=useState(mexicoDate(activity.start)),[start,setStart]=useState(calendarTime(activity.start)),[end,setEnd]=useState(calendarTime(activity.end));
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const dialog=useRef<HTMLElement>(null),submitting=useRef(false);
  const disabled=busy||saving;
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.focus();return()=>previous?.focus();},[]);
  return createPortal(<div className="fixed inset-0 z-[400] grid place-items-center bg-black/75 p-4" onClick={()=>!disabled&&onClose()}><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="agenda-schedule-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0E1520] p-5 text-sm text-slate-200 shadow-2xl" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'&&!disabled)onClose();if(e.key==='Tab'){const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])')||[]);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
    <h3 id="agenda-schedule-title" className="font-semibold text-yellow-200">Editar fecha y horario</h3><p className="mt-2 break-words text-xs text-slate-400">{activity.shortTitle||activity.title}</p>
    <form className="mt-4 space-y-4" onSubmit={async e=>{e.preventDefault();if(submitting.current||disabled)return;if(!day||!start||!end||end<=start||start<'08:00'||end>'22:00'){setError('Selecciona un horario válido entre 08:00 y 22:00.');return;}submitting.current=true;setSaving(true);setError('');try{if(await onSave({start:day+'T'+start+':00-06:00',end:day+'T'+end+':00-06:00',expectedTitle:baseline.title,expectedStart:baseline.start,expectedEnd:baseline.end}))onClose();else setError('No se confirmó el cambio. Revisa el aviso del calendario.');}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{submitting.current=false;setSaving(false);}}}>
      <label className="block">Fecha<input required disabled={disabled} type="date" value={day} onChange={e=>setDay(e.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2"/></label>
      <div className="grid grid-cols-2 gap-3">{[['Inicio',start,setStart],['Fin',end,setEnd]].map(([label,value,set])=><label key={String(label)}>{String(label)}<input required disabled={disabled} type="time" min="08:00" max="22:00" step={300} value={String(value)} onChange={e=>(set as (s:string)=>void)(e.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2"/></label>)}</div>
      {error&&<p role="alert" className="text-rose-300">{error}</p>}
      <div className="flex justify-end gap-3"><button type="button" disabled={disabled} onClick={onClose} className="rounded border border-slate-600 px-3 py-2">Cancelar</button><button disabled={disabled} className="rounded bg-cyan-700 px-3 py-2 disabled:opacity-40">{disabled?'Guardando…':'Guardar horario'}</button></div>
    </form>
  </section></div>,document.body);
}
