"use client";
import {useEffect,useState} from 'react';
import {quickActivitySchedule} from '@/lib/quickActivitySchedule';
import {calendarTime,mexicoDate} from '@/services/calendarPresentation';
import type {NotionCalendarActivity} from '@/types/anfeta';
export function QuickScheduleActions({activity,onClose,onSave,disabled=false,currentUser}:{activity:NotionCalendarActivity;onClose:()=>void;onSave:(updates:any)=>Promise<boolean|void>|void;disabled?:boolean;currentUser:string}){
  const [baseline]=useState(activity);
  const [offset,setOffset]=useState(0),[duration,setDuration]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [targetDate,setTargetDate]=useState('');
  const [suggestions,setSuggestions]=useState<{start:string;end:string}[]>([]),[chosen,setChosen]=useState<{start:string;end:string}|null>(null);
  useEffect(()=>{setSuggestions([]);setChosen(null);setError('');},[offset,duration,targetDate]);
  let proposal:{start:string;end:string}|null=null,message='';
  try{proposal=quickActivitySchedule(baseline,offset,duration,targetDate);}catch(e){message=e instanceof Error?e.message:'Horario inválido';}
  async function save(){if(busy||disabled||!proposal)return;setBusy(true);setError('');try{
    const target=chosen||proposal;
    const response=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'calendar-schedule-availability',payload:{pageId:baseline.pageId,...target,currentUser}}),signal:AbortSignal.timeout(45000)});
    const availability=await response.json();if(!response.ok)throw Error(availability.error||'No se pudo consultar disponibilidad.');
    if(availability.conflict){setSuggestions(availability.suggestions||[]);setChosen(null);setError('Se empalma con «'+availability.conflict.title+'». '+(availability.suggestions?.length?'Elige un horario libre y confirma.':'No cabe la actividad completa entre 08:00 y 22:00. Elige otro día.'));return;}
    const result=await onSave({...target,expectedTitle:baseline.title,expectedStart:baseline.start,expectedEnd:baseline.end});if(result===false)throw Error('No se confirmó el cambio. Revisa el aviso del calendario.');onClose();
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}}
  const buttonClass='rounded border border-slate-600 px-2 py-1.5 aria-pressed:bg-cyan-900 disabled:opacity-40';
  return <section aria-label="Mover fecha y duración" className="border-t border-slate-700 px-3 py-2 space-y-2">
    <p className="font-semibold text-cyan-200">Mover fecha / Duración</p>
    <p className="text-[10px] text-slate-400">Desde {mexicoDate(baseline.start)}; conserva la hora de inicio.</p>
    <fieldset disabled={busy||disabled} className="space-y-2">
      <div className="flex flex-wrap gap-1">{[[-1,'Enviar para ayer'],[1,'Enviar para mañana'],[0,'Conservar fecha']].map(([n,label])=><button type="button" key={n} aria-pressed={!targetDate&&offset===n} onClick={()=>{setTargetDate('');setOffset(Number(n));}} className={buttonClass}>{label}</button>)}</div>
      <label className="flex items-center justify-between gap-2">Enviar para… <select aria-label="Días para mover la actividad" value={!targetDate&&offset>0?offset:0} onChange={e=>{setTargetDate('');setOffset(Number(e.target.value));}} className="min-w-0 rounded bg-slate-800 p-1.5"><option value={0}>Seleccionar días</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>En {n} día{n===1?'':'s'}</option>)}</select></label>
      <label className="block">Elegir fecha<input aria-label="Fecha de destino" type="date" value={targetDate||mexicoDate(proposal?.start||baseline.start)} onChange={e=>{setTargetDate(e.target.value);setOffset(0);}} className="mt-1 block w-full rounded bg-slate-800 p-1.5"/></label>
      <label className="flex items-center justify-between gap-2">Duración<select aria-label="Duración de la actividad" value={duration??''} onChange={e=>setDuration(e.target.value?Number(e.target.value):null)} className="rounded bg-slate-800 p-1.5"><option value="">Conservar</option>{[[15,'15 min'],[20,'20 min'],[30,'30 min'],[45,'45 min'],[60,'1 hora'],[90,'1 h 30 min'],[120,'2 horas']].map(([n,label])=><option key={n} value={n}>{label}</option>)}</select></label>
    </fieldset>
    {(chosen||proposal)&&<p role="status" className="rounded bg-cyan-950 p-2 text-cyan-100">Nueva fecha: {mexicoDate((chosen||proposal)!.start)}<br/>{calendarTime((chosen||proposal)!.start)}–{calendarTime((chosen||proposal)!.end)}</p>}
    {!!suggestions.length&&<div className="space-y-1"><p>Horarios libres · más cercano primero</p>{suggestions.map(slot=><button key={slot.start} disabled={busy||disabled} aria-pressed={chosen?.start===slot.start} onClick={()=>{setChosen(slot);setError('');}} className={buttonClass+' block w-full'}>{calendarTime(slot.start)}–{calendarTime(slot.end)} · {proposal&&Date.parse(slot.start)<Date.parse(proposal.start)?'Antes':'Después'}</button>)}</div>}
    {(error||message)&&<p role="alert" className="text-rose-300">{error||message}</p>}
    <button disabled={busy||disabled||!proposal||(offset===0&&duration===null&&(!targetDate||targetDate===mexicoDate(baseline.start)))} onClick={save} className="w-full rounded bg-cyan-800 p-2 disabled:opacity-40">{busy?'Guardando…':'Confirmar cambio'}</button>
  </section>;
}
