"use client";
import {useState} from 'react';
import {quickActivitySchedule} from '@/lib/quickActivitySchedule';
import {calendarTime,mexicoDate} from '@/services/calendarPresentation';
import type {NotionCalendarActivity} from '@/types/anfeta';
export function QuickScheduleActions({activity,onClose,onSave,disabled=false}:{activity:NotionCalendarActivity;onClose:()=>void;onSave:(updates:any)=>Promise<boolean|void>|void;disabled?:boolean}){
  const [baseline]=useState(activity);
  const [offset,setOffset]=useState(0),[duration,setDuration]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  let proposal:{start:string;end:string}|null=null,message='';
  try{proposal=quickActivitySchedule(baseline,offset,duration);}catch(e){message=e instanceof Error?e.message:'Horario inválido';}
  async function save(){if(busy||disabled||!proposal)return;setBusy(true);setError('');try{const result=await onSave({...proposal,expectedTitle:baseline.title,expectedStart:baseline.start,expectedEnd:baseline.end});if(result===false)throw Error('No se confirmó el cambio. Revisa el aviso del calendario.');onClose();}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}}
  const buttonClass='rounded border border-slate-600 px-2 py-1.5 aria-pressed:bg-cyan-900 disabled:opacity-40';
  return <section aria-label="Mover fecha y duración" className="border-t border-slate-700 px-3 py-2 space-y-2">
    <p className="font-semibold text-cyan-200">Mover fecha / Duración</p>
    <p className="text-[10px] text-slate-400">Desde {mexicoDate(baseline.start)}; conserva la hora de inicio.</p>
    <fieldset disabled={busy||disabled} className="space-y-2">
      <div className="flex flex-wrap gap-1">{[[-1,'Enviar para ayer'],[1,'Enviar para mañana'],[0,'Conservar fecha']].map(([n,label])=><button key={n} aria-pressed={offset===n} onClick={()=>setOffset(Number(n))} className={buttonClass}>{label}</button>)}</div>
      <label className="flex items-center justify-between gap-2">Enviar para… <select aria-label="Días para mover la actividad" value={offset>0?offset:0} onChange={e=>setOffset(Number(e.target.value))} className="min-w-0 rounded bg-slate-800 p-1.5"><option value={0}>Seleccionar días</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>En {n} día{n===1?'':'s'}</option>)}</select></label>
      <p>Duración de la actividad</p>
      <div className="flex flex-wrap gap-1">{[[null,'Conservar'],[60,'1 hora'],[120,'2 horas']].map(([n,label])=><button key={String(n)} aria-pressed={duration===n} onClick={()=>setDuration(n as number|null)} className={buttonClass}>{label}</button>)}</div>
    </fieldset>
    {proposal&&<p role="status" className="rounded bg-cyan-950 p-2 text-cyan-100">Nueva fecha: {mexicoDate(proposal.start)}<br/>{calendarTime(proposal.start)}–{calendarTime(proposal.end)}</p>}
    {(error||message)&&<p role="alert" className="text-rose-300">{error||message}</p>}
    <button disabled={busy||disabled||!proposal||(offset===0&&duration===null)} onClick={save} className="w-full rounded bg-cyan-800 p-2 disabled:opacity-40">{busy?'Guardando…':'Confirmar cambio'}</button>
  </section>;
}
