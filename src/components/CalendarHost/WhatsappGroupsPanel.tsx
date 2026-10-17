'use client';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {MessageCircle, X, Search, Link2, ExternalLink, Unplug, QrCode} from 'lucide-react';
import {NotionCalendarActivity} from '@/types/anfeta';
import {WhatsappGroup, WhatsappBinding, whatsappMatchScore} from '@/lib/whatsappGroups';

const button = 'rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400 disabled:opacity-40';
const states: Record<string,string> = {ABSENT:'Desvinculado',STOPPED:'Detenido · puede conservar una vinculación',STARTING:'Preparando WhatsApp…',SCAN_QR_CODE:'Listo para escanear',WORKING:'Conectado',FAILED:'La conexión necesita atención',NOT_CONFIGURED:'Servicio pendiente de configurar'};
async function api(action: string, body?: Record<string, unknown>) {
  const response = await fetch('/api/whatsapp' + (body ? '' : '?action=' + action), {method: body ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store', headers: body ? {'Content-Type':'application/json'} : undefined, body: body ? JSON.stringify({...body,action}) : undefined});
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'No se confirmó la operación de WhatsApp.');
  return data;
}
export function WhatsappGroupsPanel({activities,onOpenActivity}: {activities:NotionCalendarActivity[];onOpenActivity:(activity:NotionCalendarActivity)=>void}) {
  const [open,setOpen] = useState(false), [groups,setGroups] = useState<WhatsappGroup[]>([]), [links,setLinks] = useState<WhatsappBinding[]>([]);
  const [status,setStatus] = useState(''), [qr,setQr] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [query,setQuery] = useState(''), [selected,setSelected] = useState(''), [activityQuery,setActivityQuery] = useState(''), [access,setAccess] = useState('');
  const mounted = useRef(true), importing = useRef(false), generation = useRef(0), dialog = useRef<HTMLDivElement>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function directory() { const data = await api('directory'); if (mounted.current) {setGroups(data.groups);setLinks(data.links);} }
  async function connection() {
    const version=generation.current;
    const data = await api('status'); if (!mounted.current||version!==generation.current) return;
    setStatus(data.status);
    if (data.status === 'SCAN_QR_CODE') {const value=await api('qr');if(mounted.current&&version===generation.current)setQr(value.image);} else setQr('');
  }
  async function run(action:()=>Promise<void>) {setBusy(true);setError('');try{await action();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'No se confirmó la operación.');}finally{if(mounted.current)setBusy(false);}}
  useEffect(()=>{
    if(!open)return;
    void run(async()=>{const results=await Promise.allSettled([directory(),connection()]);const failed=results.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;});
  },[open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(!open||!['STARTING','SCAN_QR_CODE'].includes(status))return;
    let active=true, checking=false;
    const timer=setInterval(()=>{if(active&&!importing.current&&!checking){checking=true;void connection().catch(e=>{if(active)setError(e.message);}).finally(()=>{checking=false;});}},5000);
    return()=>{active=false;clearInterval(timer);};
  },[open,status]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen=groups.find(g=>g.group_id===selected);
  useEffect(()=>{setAccess(chosen?.access_url||'');},[chosen?.group_id,chosen?.access_url]);
  const visible=useMemo(()=>groups.filter(g=>g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())),[groups,query]);
  const candidates=useMemo(()=>{
    if(!chosen)return [];
    const unique=[...new Map(activities.filter(a=>!a.isHandoffMirror&&!a.isReviewMirror).map(a=>[a.pageId,a])).values()];
    return unique.map(a=>({activity:a,score:whatsappMatchScore(chosen.name,a.title)})).filter(row=>activityQuery?row.activity.title.toLocaleLowerCase().includes(activityQuery.toLocaleLowerCase()):row.score>0).sort((a,b)=>b.score-a.score).slice(0,20);
  },[activities,chosen,activityQuery]);
  async function importGroups(){
    importing.current=true;setNotice('');
    try{
      let offset=0,total: number|undefined;
      while(true){
        const batch=await api('import',{offset,...(total===undefined?{}:{expectedTotal:total})});
        if(!mounted.current)return;
        total=batch.total;setNotice(`Guardados ${batch.nextOffset} de ${total} grupos disponibles en esta sesión…`);
        if(batch.done){await directory();setNotice(`Importación terminada: ${batch.nextOffset} grupos disponibles en esta sesión. Revisa la lista y pulsa Finalizar y desvincular.`);break;}
        if(batch.nextOffset<=offset||batch.nextOffset>10000)throw Error('No se confirmó el avance de la importación.');
        offset=batch.nextOffset;
      }
    }catch(e){await directory().catch(()=>{});setNotice('Importación incompleta. Los lotes confirmados se conservaron; vuelve a importar para completar.');throw e;}finally{importing.current=false;}
  }
  function close(){generation.current++;setOpen(false);setQr('');}
  return <div className="border-b border-slate-800 px-3 py-2">
    <button type="button" onClick={()=>setOpen(true)} className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><MessageCircle size={15}/> Grupos de WhatsApp <span className="font-normal text-slate-400">Directorio de John</span></button>
    {open&&<div ref={dialog} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-labelledby="whatsapp-title" onKeyDown={event=>{
      if(event.key==='Escape'&&!busy){event.stopPropagation();close();}
      if(event.key==='Tab'){const controls=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)');if(controls?.length){const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}
    }}>
      <section className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-emerald-900 bg-[#0c141e] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-700 p-5"><div><h2 id="whatsapp-title" className="flex items-center gap-2 text-lg font-semibold text-emerald-200"><MessageCircle/> Grupos de WhatsApp</h2><p className="mt-1 text-xs text-slate-400">Importa el directorio, vincula actividades y desvincula WhatsApp al terminar.</p></div><button autoFocus disabled={busy} onClick={close} aria-label="Cerrar directorio" className={button}><X size={18}/></button></header>
        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-100">{states[status]||status||'Consultando conexión…'}</p><p className="mt-1 max-w-2xl text-xs text-slate-400">Solo se importan nombres e identificadores. No se envían mensajes. Esta conexión es no oficial y no garantiza evitar restricciones de cuenta.</p></div><div className="flex flex-wrap gap-2"><button disabled={busy||!['ABSENT','STOPPED'].includes(status)} className={button} onClick={()=>void run(async()=>{await api('start',{});await connection();})}><QrCode className="mr-1 inline" size={14}/>Conectar</button><button disabled={busy||status==='NOT_CONFIGURED'} className={button} onClick={()=>void run(connection)}>Actualizar estado</button><button disabled={busy||status!=='WORKING'} className={button+' border-emerald-600 bg-emerald-950'} onClick={()=>void run(importGroups)}>Importar grupos</button><button disabled={busy||!status||['ABSENT','NOT_CONFIGURED'].includes(status)} className={button} onClick={()=>void run(async()=>{await api('disconnect',{});setQr('');setStatus('ABSENT');setNotice('Sesión desvinculada. El directorio y las relaciones se conservan. Comprueba también Dispositivos vinculados en el teléfono.');})}><Unplug className="mr-1 inline" size={14}/>Finalizar y desvincular</button></div></div>
            {qr&&<div className="mt-4 flex flex-wrap items-center gap-4"><img src={qr} alt="QR privado para vincular el WhatsApp de John" className="h-56 w-56 rounded-lg bg-white p-2"/><p className="max-w-xs text-sm text-slate-300">En el teléfono de John: WhatsApp → Dispositivos vinculados → Vincular dispositivo. El QR se actualiza mientras este panel está abierto.</p></div>}
            {status==='NOT_CONFIGURED'&&<p className="mt-3 text-xs text-amber-200">El administrador debe preparar el servicio WAHA y el almacenamiento antes de conectar.</p>}
            {chosen&&status==='WORKING'&&<button disabled={busy} className={button+' mt-3'} onClick={()=>void run(async()=>{await api('invite',{groupId:selected});await directory();setNotice('Enlace vigente consultado y guardado. No se envió ninguna invitación.');})}>Obtener enlace de «{chosen.name}» · requiere permisos en el grupo</button>}
          </div>
          {error&&<p role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
          {notice&&<p role="status" className="mt-3 rounded-lg border border-emerald-800 p-3 text-sm text-emerald-200">{notice}</p>}
          <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="min-w-0"><label className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3"><Search size={16}/><input aria-label="Buscar grupo" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar grupo por nombre o dominio" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"/></label><p className="my-2 text-xs text-slate-400">{visible.length} de {groups.length} grupos guardados · se conservan después de desconectar</p><div className="max-h-[44dvh] space-y-2 overflow-y-auto">{visible.slice(0,300).map(group=><button key={group.group_id} onClick={()=>{setSelected(group.group_id);setActivityQuery('');}} className={'w-full rounded-lg border p-3 text-left '+(selected===group.group_id?'border-emerald-400 bg-emerald-950/40':'border-slate-700 bg-slate-900')}><span className="block break-words text-sm font-medium text-slate-100">{group.name}</span><span className="mt-1 block text-xs text-slate-400">{links.filter(l=>l.group_id===group.group_id).length} actividades vinculadas · {group.access_url?'Con enlace de acceso':'Enlace pendiente'}</span></button>)}{!groups.length&&<p className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">Conecta e importa para ver los grupos disponibles.</p>}{visible.length>300&&<p className="text-xs text-slate-400">Afina la búsqueda para ver los demás resultados.</p>}</div></div>
            <div className="min-w-0 rounded-xl border border-slate-700 p-4">{!chosen?<p className="text-sm text-slate-400">Selecciona un grupo para abrir su acceso o relacionarlo con actividades.</p>:<><h3 className="break-words font-semibold text-emerald-200">{chosen.name}</h3><p className="mt-1 text-xs text-slate-400">Última importación: {new Date(chosen.last_seen_at).toLocaleString('es-MX')}</p><label className="mt-4 block text-xs text-slate-300">Enlace de acceso del grupo<input value={access} onChange={e=>setAccess(e.target.value)} placeholder="https://chat.whatsapp.com/…" className="mt-2 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm"/></label><div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} className={button} onClick={()=>void run(async()=>{await api('access',{groupId:selected,url:access});await directory();setNotice('Enlace guardado. Su funcionamiento depende de que siga vigente en WhatsApp.');})}>Guardar enlace</button>{chosen.access_url&&<a href={chosen.access_url} target="_blank" rel="noopener noreferrer" className={button}><ExternalLink size={13} className="mr-1 inline"/>Abrir grupo</a>}</div><p className="mt-2 text-xs text-slate-500">El ID no es un enlace para abrir el grupo. Agrega un enlace de invitación vigente solo si deseas compartir ese acceso.</p>
              <h4 className="mt-5 text-sm font-medium text-slate-200">Actividades vinculadas</h4>{links.filter(l=>l.group_id===selected).map(link=><div key={link.page_id} className="mt-2 rounded-lg border border-slate-700 p-2"><p className="break-words text-xs text-slate-200">{link.activity_title}</p><div className="mt-2 flex gap-2"><a href={'https://www.notion.so/'+link.page_id.replace(/-/g,'')} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-300">Abrir en Notion</a>{activities.find(a=>a.pageId===link.page_id)&&<button className="text-xs text-cyan-300" onClick={()=>{const activity=activities.find(a=>a.pageId===link.page_id)!;close();onOpenActivity(activity);}}>Ver actividad</button>}<button disabled={busy} className="ml-auto text-xs text-slate-400" onClick={()=>void run(async()=>{await api('unlink',{groupId:selected,pageId:link.page_id});await directory();})}>Quitar relación</button></div></div>)}
              <h4 className="mt-5 text-sm font-medium text-slate-200">Relacionar con una actividad</h4><p className="mt-1 text-xs text-slate-400">Sugerencias del calendario cargado, por dominio y título. Confirma cada relación; no se cambia la actividad en Notion.</p><input aria-label="Buscar actividad para vincular" value={activityQuery} onChange={e=>setActivityQuery(e.target.value)} placeholder="Buscar en las actividades cargadas…" className="mt-2 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm"/><div className="mt-2 max-h-64 space-y-2 overflow-y-auto">{candidates.filter(row=>!links.some(l=>l.group_id===selected&&l.page_id===row.activity.pageId)).map(({activity,score})=><div key={activity.pageId} className="rounded-lg border border-slate-700 p-2"><p className="break-words text-xs text-slate-200">{activity.title}</p><button disabled={busy} className="mt-2 flex items-center gap-1 text-xs text-emerald-300 disabled:opacity-40" onClick={()=>void run(async()=>{await api('link',{groupId:selected,pageId:activity.pageId,title:activity.title});await directory();})}><Link2 size={13}/>Vincular {score>=100?'· coincide el dominio':''}</button></div>)}</div>
            </>}</div>
          </div>
          <p className="mt-4 text-xs text-slate-500">Cerrar este panel no desvincula WhatsApp. Usa Finalizar y desvincular; si falla, cierra el dispositivo desde el teléfono. Los grupos nuevos requieren otra importación.</p>
        </div>
      </section>
    </div>}
  </div>;
}
