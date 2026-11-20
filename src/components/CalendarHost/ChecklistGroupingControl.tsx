"use client";
import {useState,useRef} from 'react';
type Plan={undated?:Array<{blockId:string;label:string}>;alreadyGrouped?:number;fingerprint:string;moves:Array<{blockId:string;label:string;date:string|null;resuming:boolean}>;blocked:Array<{label:string;reason:string}>;warning:string};
export function ChecklistGroupingControl({pageId,workDate,onUpdated,onBusyChange}:{pageId:string;workDate:string;onUpdated:(stats:any)=>void;onBusyChange:(busy:boolean)=>void}){
 const [plan,setPlan]=useState<Plan|null>(null),[busy,setBusy]=useState(false),[accepted,setAccepted]=useState(false),[message,setMessage]=useState('');
 const lock=useRef(false);
 async function run(apply=false,refresh=false){
  if(lock.current)return;lock.current=true;setBusy(true);onBusyChange(true);setMessage('');
  try{
   const res=await fetch('/api/checklist-grouping',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(100000),body:JSON.stringify({action:refresh?'refresh':apply?'apply':'preview',pageId,workDate,...(apply?{fingerprint:plan?.fingerprint,acknowledgeIds:accepted}:{})})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'No se confirmó la agrupación.');
   setPlan(data.preview);setAccepted(false);
   if(apply||refresh){
    if(data.stats)onUpdated(data.stats);
    window.dispatchEvent(new CustomEvent('anfeta_page_content_changed',{detail:{pageId}}));
    const remaining=data.preview?.moves?.length||0,undated=data.preview?.undated?.length||0;
    setMessage([refresh?'Detalle actualizado.':`${data.moved||0} checks trasladados en este lote.`,remaining?`Quedan ${remaining} por agrupar: confirma el siguiente lote.`:'No quedan checks con fecha por trasladar.',undated?`${undated} sin fecha asignada: selecciona esos checks y usa Hoy, Mañana o Elegir fecha; después vuelve a generar la vista previa.`:'',data.stats&&!data.refreshRequired?'Los datos del detalle están actualizados; no necesitas recargar ANFETA.':'Pulsa Actualizar detalle; si persiste, cierra y vuelve a abrir la actividad.',...(data.errors||[])].filter(Boolean).join(' '));
   }
  }catch(error){setMessage(error instanceof Error?error.message:'No se confirmó el resultado. Genera la vista previa antes de repetir.');}
  finally{lock.current=false;setBusy(false);onBusyChange(false);}
 }
 return <section className="rounded border border-violet-500/30 bg-violet-950/15 p-2 text-[11px] space-y-2">
  <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" disabled={busy} onClick={()=>void run()} className="rounded border border-violet-400/60 px-2 py-1 text-violet-200 hover:bg-violet-900/30 disabled:opacity-50">{busy?'Procesando…':'Agrupar por fecha en Notion'}</button><button type="button" disabled={busy} onClick={()=>void run(false,true)} className="text-cyan-300 underline disabled:opacity-50">Actualizar detalle</button></div>
  {plan&&<div className="space-y-2"><p className="text-slate-300">{plan.moves.length} por trasladar · {plan.alreadyGrouped||0} ya agrupados · {plan.undated?.length||0} sin fecha · {plan.blocked.length} requieren revisión</p>
   <ul className="max-h-40 overflow-y-auto space-y-1" aria-label="Vista previa de agrupación">{plan.moves.map(m=><li key={m.blockId} className="flex gap-2"><strong className="shrink-0 text-violet-300">{m.date||'Sin fecha · raíz'}</strong><span className="break-words text-slate-300">{m.resuming?'Retomar: ':''}{m.label}</span></li>)}{plan.blocked.map((b,i)=><li key={'b'+i} className="text-amber-300 break-words">{b.label}: {b.reason}</li>)}</ul>
   {!!plan.undated?.length&&<div className="rounded border border-amber-500/40 p-2 text-amber-200"><p>“Completado hoy” indica cuándo se marcó el check; no le asigna una fecha de agrupación. Selecciona los checks sin fecha y pulsa Hoy, Mañana o Elegir fecha, incluso si ya están completados.</p><ul className="mt-1 max-h-24 overflow-auto">{plan.undated.map(item=><li key={item.blockId}>• {item.label}</li>)}</ul></div>}
   <p className="text-amber-200/90">{plan.warning}</p>
   {!!plan.moves.length&&<><label className="flex gap-2 items-start text-slate-300"><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>setAccepted(e.target.checked)}/>Entiendo el cambio de IDs y quiero agrupar los checks de esta vista previa.</label><button type="button" disabled={busy||!accepted} onClick={()=>void run(true)} className="rounded bg-violet-700 px-3 py-1 text-white disabled:opacity-40">{busy?'Verificando y agrupando…':`Confirmar ${Math.min(5,plan.moves.length)} checks`}</button><span className="ml-2 text-slate-400">Lotes de hasta 5; los demás se muestran al terminar.</span></>}
   <button type="button" disabled={busy} onClick={()=>{setPlan(null);setAccepted(false);setMessage('');}} className="block text-slate-400 underline">Cerrar vista previa</button>
  </div>}
  {message&&<p role="status" className="text-cyan-200 break-words">{message}</p>}
 </section>;
}
