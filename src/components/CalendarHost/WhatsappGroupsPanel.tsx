'use client';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {MessageCircle, X, Search, ExternalLink, Unplug, QrCode} from 'lucide-react';

type Group = {id:string;name:string;accessUrl?:string};
const button='rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400 disabled:opacity-40';
const states:Record<string,string>={ABSENT:'Desvinculado',STOPPED:'Detenido · puede conservar una vinculación',STARTING:'Preparando WhatsApp…',SCAN_QR_CODE:'Listo para escanear',WORKING:'Conectado',FAILED:'La conexión necesita atención',NOT_CONFIGURED:'Servicio pendiente de configurar'};
async function api(action:string,body?:Record<string,unknown>){
  const response=await fetch('/api/whatsapp'+(body?'':'?action='+action),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify({...body,action}):undefined});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'No se confirmó la operación de WhatsApp.');
  return data;
}
export function WhatsappGroupsPanel({currentUser}:{currentUser:string}){
  const [open,setOpen]=useState(false),[groups,setGroups]=useState<Group[]>([]);
  const [status,setStatus]=useState(''),[qr,setQr]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [query,setQuery]=useState(''),[selected,setSelected]=useState('');
  const mounted=useRef(true),working=useRef(false),generation=useRef(0),dialog=useRef<HTMLDivElement>(null),opener=useRef<HTMLButtonElement>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
  async function connection(){
    const version=generation.current,data=await api('status');
    if(!mounted.current||version!==generation.current)return;
    setStatus(data.status);
    if(data.status==='SCAN_QR_CODE'){const value=await api('qr');if(mounted.current&&version===generation.current)setQr(value.image);}else setQr('');
  }
  async function run(action:()=>Promise<void>){
    if(working.current)return;
    working.current=true;setBusy(true);setError('');
    try{await action();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'No se confirmó la operación.');}
    finally{working.current=false;if(mounted.current)setBusy(false);}
  }
  useEffect(()=>{if(open)void run(connection);},[open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(!open||!['STARTING','SCAN_QR_CODE'].includes(status))return;
    let active=true,checking=false;
    const timer=setInterval(()=>{if(active&&!working.current&&!checking){checking=true;void connection().catch(e=>{if(active)setError(e.message);}).finally(()=>{checking=false;});}},5000);
    return()=>{active=false;clearInterval(timer);};
  },[open,status]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen=groups.find(g=>g.id===selected);
  const visible=useMemo(()=>groups.filter(g=>g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())),[groups,query]);
  async function preview(){
    const version=generation.current;
    setGroups([]);setSelected('');setNotice('');
    const found=new Map<string,Group>();
    let offset=0,total:number|undefined;
    try{
      while(true){
        const batch=await api('preview',{offset,...(total===undefined?{}:{expectedTotal:total})});
        if(!mounted.current||version!==generation.current)return;
        for(const group of batch.groups)found.set(group.id,group);
        total=batch.total;setGroups([...found.values()]);
        setNotice('Obtenidos '+found.size+' de '+total+' grupos disponibles…');
        if(batch.done){
          if(found.size!==total)throw Error('La lista cambió durante la consulta. Vuelve a obtener los grupos.');
          setNotice('Consulta completa: '+found.size+' grupos. Solo están en esta ventana; puedes desvincular WhatsApp y seguir revisándolos hasta cerrar el panel.');
          break;
        }
        if(batch.nextOffset<=offset||batch.nextOffset>10000)throw Error('No se confirmó el avance de la consulta.');
        offset=batch.nextOffset;
      }
    }catch(e){if(mounted.current&&version===generation.current)setNotice('Consulta incompleta. Lo mostrado es parcial y no está guardado. Vuelve a consultar.');throw e;}
  }
  function close(){generation.current++;setOpen(false);setQr('');setGroups([]);setSelected('');setQuery('');setNotice('');setError('');opener.current?.focus();}
  return <div className="border-b border-slate-800 px-3 py-2">
    <button ref={opener} type="button" onClick={()=>setOpen(true)} className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><MessageCircle size={15}/>Grupos de WhatsApp<span className="font-normal text-slate-400">Vista temporal · {currentUser==='Neftali'?'Neftalí':currentUser}</span></button>
    {open&&<div ref={dialog} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-labelledby="whatsapp-title" onKeyDown={event=>{
      if(event.key==='Escape'&&!busy){event.stopPropagation();close();}
      if(event.key==='Tab'){const controls=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)');if(controls?.length){const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}
    }}>
      <section className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-emerald-900 bg-[#0c141e] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-700 p-5">
          <div><h2 id="whatsapp-title" className="flex items-center gap-2 text-lg font-semibold text-emerald-200"><MessageCircle/>Grupos de WhatsApp</h2><p className="mt-1 text-xs text-slate-400">Consulta temporal. Los resultados se borran al cerrar este panel o recargar.</p></div>
          <button autoFocus disabled={busy} onClick={close} aria-label="Cerrar vista temporal" className={button}><X size={18}/></button>
        </header>
        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm font-semibold text-slate-100">{states[status]||status||'Consultando conexión…'}</p>
            <p className="mt-1 text-xs text-slate-400">Solo se muestran nombres e identificadores. No se guardan grupos, enlaces ni relaciones con actividades.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy||!['ABSENT','STOPPED'].includes(status)} className={button} onClick={()=>void run(async()=>{await api('start',{});await connection();})}><QrCode className="mr-1 inline" size={14}/>Conectar</button>
              <button disabled={busy} className={button} onClick={()=>void run(connection)}>Actualizar estado</button>
              <button disabled={busy||status!=='WORKING'} className={button+' border-emerald-600 bg-emerald-950'} onClick={()=>void run(preview)}>Obtener grupos</button>
              <button disabled={busy||!status||['ABSENT','NOT_CONFIGURED'].includes(status)} className={button} onClick={()=>void run(async()=>{generation.current++;setQr('');await api('disconnect',{});setStatus('ABSENT');setNotice('WhatsApp desvinculado. Los resultados siguen visibles solo hasta cerrar este panel.');})}><Unplug className="mr-1 inline" size={14}/>Finalizar y desvincular</button>
            </div>
            {qr&&<div className="mt-4 flex flex-wrap items-center gap-4"><img src={qr} alt="QR privado para vincular tu WhatsApp" className="h-56 w-56 rounded-lg bg-white p-2"/><p className="max-w-xs text-sm text-slate-300">En tu teléfono: WhatsApp → Dispositivos vinculados → Vincular dispositivo.</p></div>}
            {status==='NOT_CONFIGURED'&&<p className="mt-3 text-xs text-amber-200">Falta configurar tu conexión WAHA en el servidor. Esta vista no requiere tablas de WhatsApp en Supabase.</p>}
          </div>
          {error&&<p role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
          {notice&&<p role="status" className="mt-3 rounded-lg border border-emerald-800 p-3 text-sm text-emerald-200">{notice}</p>}
          <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <label className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3"><Search size={16}/><input aria-label="Buscar grupo" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nombre o dominio" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"/></label>
              <p className="my-2 text-xs text-slate-400">{visible.length} de {groups.length} grupos obtenidos · sin guardar</p>
              <div className="max-h-[44dvh] space-y-2 overflow-y-auto">
                {visible.slice(0,300).map(group=><button key={group.id} disabled={busy} onClick={()=>setSelected(group.id)} className={'w-full rounded-lg border p-3 text-left '+(selected===group.id?'border-emerald-400 bg-emerald-950/40':'border-slate-700 bg-slate-900')}><span className="block break-words text-sm font-medium text-slate-100">{group.name}</span></button>)}
                {!groups.length&&<p className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">Conecta y pulsa Obtener grupos para ver lo que devuelve WhatsApp.</p>}
                {visible.length>300&&<p className="text-xs text-slate-400">Afina la búsqueda para ver los demás resultados.</p>}
              </div>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-700 p-4">
              {!chosen?<p className="text-sm text-slate-400">Selecciona un grupo para revisar sus datos.</p>:<>
                <h3 className="break-words font-semibold text-emerald-200">{chosen.name}</h3>
                <p className="mt-4 text-xs text-slate-400">Identificador del grupo</p><p className="mt-1 break-all text-sm text-slate-200">{chosen.id}</p>
                <p className="mt-4 text-xs text-slate-400">El identificador por sí solo no permite abrir el grupo. Puedes consultar su enlace si tu cuenta tiene permisos.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={busy||status!=='WORKING'} className={button} onClick={()=>void run(async()=>{const id=chosen.id,value=await api('invite',{groupId:id});setGroups(old=>old.map(group=>group.id===id?{...group,accessUrl:value.url}:group));setNotice('Enlace obtenido solo para esta vista. No se guardó ni se envió una invitación.');})}>Consultar enlace</button>
                  {chosen.accessUrl&&<a href={chosen.accessUrl} target="_blank" rel="noopener noreferrer" className={button}><ExternalLink size={13} className="mr-1 inline"/>Abrir grupo</a>}
                </div>
              </>}
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">Cerrar el panel borra los resultados, pero no desvincula WhatsApp. Usa Finalizar y desvincular antes de salir. La conexión no es oficial y no garantiza evitar restricciones de cuenta.</p>
        </div>
      </section>
    </div>}
  </div>;
}
