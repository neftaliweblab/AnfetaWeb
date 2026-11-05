"use client";
import React,{useEffect,useState} from 'react';
import {canViewFtfDashboard} from '@/services/ftfDashboard';
import {calendarDisplayTitle,calendarDomain,calendarTime} from '@/services/calendarPresentation';
import {NotionCalendarActivity} from '@/types/anfeta';
import type {buildFtfDashboard} from '@/services/ftfDashboard';
type Report=ReturnType<typeof buildFtfDashboard>&{warning?:string;automation?:{state:string;secretConfigured:boolean;actorConfigured:boolean;jobs:{kind:string;status:string;updatedAt:string;failed:number;remaining:number}[]}};

export function CalendarFtfPanel({currentUser,date,onOpenActivity}:{currentUser:string;date:string;onOpenActivity:(activity:NotionCalendarActivity)=>void}){
  const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0);
  const reviewStorageKey = 'anfeta_bitacora_review:' + date;
  const [supervisorReview, setSupervisorReview] = useState<{ reviewer: string; reviewedAt: string } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(reviewStorageKey);
      setSupervisorReview(saved ? JSON.parse(saved) : null);
    } catch {
      setSupervisorReview(null);
    }
  }, [reviewStorageKey]);

  const toggleSupervisorReview = () => {
    if (supervisorReview) {
      try {
        localStorage.removeItem(reviewStorageKey);
      } catch {}
      setSupervisorReview(null);
    } else {
      const reviewData = { reviewer: currentUser, reviewedAt: new Date().toISOString() };
      try {
        localStorage.setItem(reviewStorageKey, JSON.stringify(reviewData));
      } catch {}
      setSupervisorReview(reviewData);
    }
  };

  useEffect(()=>{
    setReport(null);setError('');
    if(!canViewFtfDashboard(currentUser))return;
    let stopped=false,busy=false;const controller=new AbortController();
    const refresh=async()=>{
      if(stopped||busy||document.hidden)return;busy=true;setLoading(true);
      try{
        const response=await fetch('/api/data?type=ftf-dashboard&date='+encodeURIComponent(date),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])});
        const data=await response.json();if(!response.ok||data.error)throw Error(data.error||'No se pudo comprobar la Bitácora.');
        if(!stopped){setReport(data);setError('');}
      }catch(e){if(!stopped)setError(e instanceof Error?e.message:'No se pudo actualizar la Bitácora.');}
      finally{busy=false;if(!stopped)setLoading(false);}
    };
    void refresh();
    window.addEventListener('anfeta_review_saved',refresh);window.addEventListener('anfeta_calendar_refresh',refresh);
    return ()=>{stopped=true;controller.abort();window.removeEventListener('anfeta_review_saved',refresh);window.removeEventListener('anfeta_calendar_refresh',refresh);};
  },[currentUser,date,revision]);
  if(!canViewFtfDashboard(currentUser))return null;
  return <details open className="shrink-0 border-b border-cyan-900/60 bg-slate-950/70 px-3 py-2">
    <summary className="cursor-pointer text-xs font-semibold text-cyan-200">
      Bitácora del equipo (FTF) · {date}
      {report && (
        <span className="ml-3 font-normal text-slate-300">
          {report.completed} a tiempo · {report.late} tarde · {report.pending} pendientes
          {report.totalAssignedHours !== undefined && (
            <span className="ml-2 text-cyan-300 font-medium">
              · {report.totalAssignedHours} h asignadas · {report.totalCompletedHours || 0} h terminadas
            </span>
          )}
        </span>
      )}
    </summary>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
      <div className="flex items-center gap-2 flex-wrap">
        <span>Bitácora inicial: <strong className="text-slate-200">{report?.initialTime || '08:00'}</strong> · Bitácora final: <strong className="text-slate-200">{report?.finalTime || '18:00'}</strong></span>
        {supervisorReview ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-[10.5px]">
            <span>✓ Bitácora revisada por <strong>{supervisorReview.reviewer}</strong></span>
            <button type="button" onClick={toggleSupervisorReview} className="text-slate-400 hover:text-white underline ml-1 text-[10px]">Desmarcar</button>
          </span>
        ) : (
          <button
            type="button"
            onClick={toggleSupervisorReview}
            className="rounded border border-emerald-600/70 bg-emerald-950/40 hover:bg-emerald-900/60 px-2 py-0.5 text-[10.5px] font-medium text-emerald-300 transition-colors"
            title="Marcar que el supervisor ya revisó y cuadró la bitácora del día"
          >
            ✓ Ya revisé bitácora
          </button>
        )}
      </div>
      <button type="button" disabled={loading} onClick={()=>setRevision(v=>v+1)} className="rounded border border-slate-700 px-2 py-1 text-cyan-200 disabled:opacity-50">{loading?'Comprobando…':'Actualizar Bitácora'}</button>
    </div>
    {error&&<p role="alert" className="mt-2 text-xs text-rose-300">{error}{report?' Se conserva la última lectura; no es una confirmación actual.':''}</p>}
    {report?.warning&&<p role="status" className="mt-2 text-xs text-amber-200">{report.warning}</p>}
    {report?.automation&&<p className="mt-2 text-[11px] text-slate-400">Preparación diaria 05:00: {report.automation.state==='missing'?'Sin registro para este día':report.automation.state==='unavailable'?'No se pudo consultar el registro':['reset','rollover'].map(kind=>report.automation!.jobs.find(j=>j.kind===kind)||{kind,status:'missing',updatedAt:'',failed:0,remaining:0}).map(j=>(j.kind==='reset'?'Verificación':'Tarjeta FTF')+': '+(j.status==='completed'?'completado':j.status==='failed'?'falló':j.status==='pending'?'pendiente':j.status==='missing'?'sin registro':'en proceso')+(j.updatedAt?' '+calendarTime(j.updatedAt):'')).join(' · ')}{!report.automation.secretConfigured||!report.automation.actorConfigured?' · Revisa la configuración del cron en Vercel.':''}</p>}
    {report&&<div className="mt-2 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
      {report.people.map(person=><details key={person.name} className={'rounded-lg border px-3 py-2 '+(person.status==='complete'?'border-emerald-700/60 bg-emerald-950/25':person.status==='pending'?'border-amber-800/60 bg-amber-950/15':'border-slate-700 bg-slate-900/60')}>
        <summary className="cursor-pointer text-xs">
          <span className="font-semibold text-slate-100">{person.name}</span>
          <span className={'ml-2 '+(person.status==='complete'?'text-emerald-300':person.status==='pending'?'text-amber-200':'text-slate-400')}>
            {person.status==='complete'?(person.timeKind==='confirmed'?'✓ Completó':'Verificado al consultar')+(person.late?' tarde':'')+' '+calendarTime(person.completedAt!):person.status==='pending'?(report.deadlinePassed?'Fuera de plazo · ':'')+person.pending.length+' por verificar':person.status==='empty'?'Sin actividades antes de las 18:00':'Verificado · sin registro antes de las 18:00'}
          </span>
          <span className="ml-2 text-slate-400">
            {person.verified}/{person.total}
            {person.assignedHours !== undefined && (
              <span className="ml-1 text-cyan-300/80 font-mono text-[10px]">({person.assignedHours}h)</span>
            )}
          </span>
        </summary>
        <p className="mt-2 text-[10px] text-slate-400">{person.alias} · {person.role||'Integrante del equipo'}{person.completedAt&&person.timeKind!=='confirmed'?' · Hora de detección; la hora exacta de marcado no está confirmada.':''}</p>
        {person.pending.length>0&&person.completedAt&&<p className="mt-1 text-[11px] text-amber-200">Tuvo un registro a las {calendarTime(person.completedAt)}; ahora hay actividades sin verificar.</p>}
        {person.status==='unconfirmed'&&<p className="mt-2 text-[11px] text-slate-400">Las casillas están marcadas, pero no existe un registro que confirme cumplimiento antes del corte.</p>}
        {person.pending.map(activity=><button type="button" key={activity.pageId} onClick={()=>onOpenActivity(activity)} className="mt-2 block w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-left text-[11px] text-slate-200 hover:border-cyan-500"><span className="text-cyan-300">{calendarTime(activity.start)} · {calendarDomain(activity.title)}</span><span className="mt-1 block break-words">{calendarDisplayTitle(activity.title,calendarDomain(activity.title))}</span>{!activity.ftfAvailable&&<span className="mt-1 block text-amber-200">Falta la casilla FTF en Notion.</span>}</button>)}
      </details>)}
    </div>}
    {report&&<p className="mt-2 text-[10px] text-slate-500">Última comprobación: {calendarTime(report.updatedAt)} · {report.empty} integrantes sin actividades en este horario.</p>}
  </details>;
}
