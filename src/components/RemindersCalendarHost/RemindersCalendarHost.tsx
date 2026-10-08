"use client";
import {agendaRange,shiftAgendaDate,filterAgenda,remindersCsv} from '@/lib/reminderAgenda';
import {filterReminders,reminderOverdue} from '@/lib/reminderFilters';
import React,{useEffect,useState,useCallback,useRef} from 'react';
import {Bell,Plus,Trash2,RefreshCw,Pencil} from 'lucide-react';
import {anfetaSync} from '@/lib/anfetaBroadcastSync';
import {readApiJson} from '@/lib/readApiJson';
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
type Item={id:string;title:string;due_date:string;due_time:string;priority:string;completed:boolean;revision:number;creator_id:string;assignee_id:string;recurrence?:string};
export function RemindersCalendarHost(){const [items,setItems]=useState<Item[]>([]),[people,setPeople]=useState<{id:string;name:string}[]>([]),[current,setCurrent]=useState(''),[date,setDate]=useState(today),[title,setTitle]=useState(''),[time,setTime]=useState('12:00'),[assignee,setAssignee]=useState(''),[priority,setPriority]=useState('medium'),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
const [view,setView]=useState('day'),[personFilter,setPersonFilter]=useState(''),[textFilter,setTextFilter]=useState(''),[truncated,setTruncated]=useState(false);const range=agendaRange(date,view);const [notice,setNotice]=useState('');
const [scope,setScope]=useState('all');const [now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);const visibleItems=filterAgenda(filterReminders(items,scope,now),personFilter,textFilter);
const [editing,setEditing]=useState<Item|null>(null),[recurrence,setRecurrence]=useState('none');
const cancelEdit=()=>{setEditing(null);setTitle('');setRecurrence('none');setTime('12:00');setPriority('medium');setAssignee(current);};
const requestNumber=useRef(0);
const load=useCallback(async(signal?:AbortSignal)=>{const request=++requestNumber.current;try{const data=await readApiJson(await fetch('/api/reminders?start='+range.start+'&end='+range.end,{signal,cache:'no-store'}));if(signal?.aborted||request!==requestNumber.current)return;setItems(data.items);setTruncated(!!data.truncated);setPeople(data.people);setCurrent(data.currentId);setAssignee(old=>old||data.currentId);setError('');}catch(e){if(!signal?.aborted&&request===requestNumber.current)setError(e instanceof Error?e.message:'No se pudieron cargar.');}finally{if(!signal?.aborted&&request===requestNumber.current)setLoading(false);}},[range.start,range.end]);
useEffect(()=>{const controller=new AbortController();setItems([]);setLoading(true);void load(controller.signal);const refresh=()=>{if(!document.hidden)void load(controller.signal);};const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const unsubscribe=anfetaSync.subscribe(message=>{if(message.type==='REMINDERS_CHANGED')refresh();});return()=>{requestNumber.current++;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);unsubscribe();};},[load]);
async function change(body:any){if(busy)return;setBusy(true);setNotice('');try{const result=await readApiJson(await fetch('/api/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));if(body.action==='create'||body.action==='edit'){cancelEdit();setNotice(body.action==='edit'?'Recordatorio actualizado.':'Recordatorio creado.');}if(body.action==='complete'&&body.completed&&items.find(i=>i.id===body.id)?.recurrence&&items.find(i=>i.id===body.id)?.recurrence!=='none')setNotice('Completado. La siguiente repetición se conserva como un recordatorio separado; puede caer fuera del periodo visible.');if(body.action==='snooze')setNotice('Pospuesto al '+result.item.due_date+' a las '+result.item.due_time.slice(0,5)+'.');await load();anfetaSync.broadcast({type:'REMINDERS_CHANGED'});}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}}
  const fileImportRef = useRef<HTMLInputElement>(null);

  // Alarma sonora y notificación local PWA/Navegador cuando un recordatorio vence
  const notifiedRemindersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const checkDueReminders = () => {
      const currentStamp = Date.now();
      items.forEach((item) => {
        if (item.completed) return;
        const dueDateTime = Date.parse(`${item.due_date}T${item.due_time}:00`);
        if (!isNaN(dueDateTime) && Math.abs(currentStamp - dueDateTime) < 60000) {
          if (!notifiedRemindersRef.current.has(item.id)) {
            notifiedRemindersRef.current.add(item.id);
            if (Notification.permission === "granted") {
              try {
                new Notification(`⏰ Recordatorio ANFETA: ${item.title}`, {
                  body: `Hora: ${item.due_time} · Prioridad: ${item.priority}`,
                  icon: "/anfeta-logo.png",
                });
              } catch {}
            }
          }
        }
      });
    };

    const alarmInterval = setInterval(checkDueReminders, 15000);
    return () => clearInterval(alarmInterval);
  }, [items]);

  const handleImportDesktopJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rawList = Array.isArray(parsed) ? parsed : parsed.items || parsed.reminders || [];
      if (!rawList.length) throw new Error("No se encontraron recordatorios en el archivo.");

      let importedCount = 0;
      for (const r of rawList) {
        const itemTitle = r.Title || r.title || r.Text || r.text;
        const itemDate = r.DueDate || r.dueDate || r.due_date || today();
        const itemTime = r.DueTime || r.dueTime || r.due_time || "12:00";
        const itemPriority = (r.Priority || r.priority || "medium").toLowerCase();
        if (itemTitle) {
          await fetch("/api/reminders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
              title: itemTitle,
              date: itemDate.slice(0, 10),
              time: itemTime.slice(0, 5),
              priority: ["low", "medium", "high", "urgent"].includes(itemPriority) ? itemPriority : "medium",
              assigneeId: current,
              recurrence: "none",
            }),
          });
          importedCount++;
        }
      }
      setNotice(`¡Se importaron ${importedCount} recordatorios desde el archivo de Desktop!`);
      await load();
      anfetaSync.broadcast({ type: "REMINDERS_CHANGED" });
    } catch (err: any) {
      setError(`Error al importar: ${err?.message || "Archivo inválido"}`);
    } finally {
      if (fileImportRef.current) fileImportRef.current.value = "";
    }
  };

return <section className="flex-1 flex flex-col min-h-0 bg-[#080B0F] text-slate-200"><header className="flex flex-wrap items-center gap-3 p-3 border-b border-slate-800"><Bell size={18} className="text-cyan-400"/><h2>Recordatorios</h2><nav aria-label="Navegar agenda" className="flex gap-1"><button type="button" onClick={()=>setDate(shiftAgendaDate(date,view,-1))} className="rounded border border-slate-700 px-2 py-1 text-xs">Anterior</button><button type="button" onClick={()=>setDate(today())} className="rounded border border-slate-700 px-2 py-1 text-xs">Hoy</button><button type="button" onClick={()=>setDate(shiftAgendaDate(date,view,1))} className="rounded border border-slate-700 px-2 py-1 text-xs">Siguiente</button></nav><select aria-label="Vista de agenda" value={view} onChange={e=>setView(e.target.value)} className="rounded bg-slate-900 p-2 text-sm"><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option></select><select aria-label="Filtrar recordatorios" value={scope} onChange={e=>setScope(e.target.value)} className="rounded bg-slate-900 p-2 text-sm"><option value="all">Todos</option><option value="pending">Pendientes</option><option value="completed">Completados</option><option value="overdue">Vencidos</option></select><input aria-label="Fecha" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}} className="bg-slate-900 p-2 rounded"/><select aria-label="Filtrar por persona" value={personFilter} onChange={e=>setPersonFilter(e.target.value)} className="rounded bg-slate-900 p-2 text-sm"><option value="">Todas las personas</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="Buscar recordatorios" placeholder="Buscar recordatorio…" value={textFilter} onChange={e=>setTextFilter(e.target.value)} className="min-w-0 rounded bg-slate-900 p-2 text-sm"/><span className="text-xs text-slate-400">{visibleItems.length} visibles · {visibleItems.filter(x=>!x.completed).length} pendientes</span><button disabled={loading||!visibleItems.length} onClick={()=>{const url=URL.createObjectURL(new Blob([remindersCsv(visibleItems,people)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='anfeta-recordatorios-'+range.start+'-'+range.end+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}} className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40">Exportar CSV</button><input type="file" ref={fileImportRef} accept=".json" onChange={handleImportDesktopJson} className="hidden"/><button type="button" onClick={()=>fileImportRef.current?.click()} title="Importar recordatorios desde reminders.json de Desktop" className="rounded border border-cyan-800 bg-cyan-950/40 text-cyan-300 px-2 py-1 text-xs hover:bg-cyan-900/60 transition-colors">Importar Desktop JSON</button><button aria-label="Actualizar recordatorios" onClick={()=>void load()}><RefreshCw size={16}/></button></header>
<p className="px-3 pt-2 text-xs text-slate-400">Agenda: {range.start} — {range.end}. Los nuevos recordatorios se crean para {date}.</p>{truncated&&<p role="status" className="px-3 py-2 text-xs text-amber-200">Se muestran los primeros 500 recordatorios del rango. Elige un periodo menor para ver los restantes; la exportación incluye los visibles.</p>}{notice&&<p role="status" className="px-3 py-2 text-sm text-cyan-200">{notice}</p>}
{error&&<div role="alert" className="m-3 p-3 rounded border border-red-800 bg-red-950 text-red-100">{error}</div>}
<form onSubmit={e=>{e.preventDefault();void change({action:editing?'edit':'create',id:editing?.id,revision:editing?.revision,title,date,time,priority,assigneeId:assignee,recurrence});}} className="flex flex-wrap gap-2 p-3"><span className="self-center text-xs">{editing?'Editar recordatorio':'Nuevo recordatorio'}</span><input required maxLength={500} aria-label="Título del recordatorio" placeholder="Nuevo recordatorio" value={title} onChange={e=>setTitle(e.target.value)} className="flex-1 min-w-40 bg-slate-900 rounded p-2"/><input required aria-label="Hora" type="time" value={time} onChange={e=>setTime(e.target.value)} className="bg-slate-900 rounded p-2"/><select aria-label="Persona asignada" value={assignee} onChange={e=>setAssignee(e.target.value)} className="bg-slate-900 rounded p-2">{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label="Prioridad" value={priority} onChange={e=>setPriority(e.target.value)} className="bg-slate-900 rounded p-2"><option value="low">Baja</option><option value="medium">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select><select aria-label="Repetición" value={recurrence} onChange={e=>setRecurrence(e.target.value)} className="rounded bg-slate-900 p-2"><option value="none">Sin repetición</option><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select><button disabled={busy||!current} className="flex items-center gap-1 rounded bg-sky-800 px-3 disabled:opacity-40"><Plus size={16}/>{busy?'Guardando…':editing?'Guardar cambios':'Agregar'}</button>{editing&&<button type="button" disabled={busy} onClick={cancelEdit} className="rounded border border-slate-700 px-3">Cancelar edición</button>}<p className="basis-full text-xs text-slate-400">La repetición genera el siguiente recordatorio al completar este. Usa la fecha programada; mensual conserva el día elegido y se ajusta al último día de meses cortos. Los cambios afectan solo a esta ocurrencia.</p></form>
<div className="flex-1 overflow-auto p-3 space-y-2">{loading?<p>Cargando recordatorios…</p>:!visibleItems.length?<p className="text-slate-400">No hay recordatorios que coincidan con este periodo y filtro.</p>:visibleItems.map(item=><article key={item.id} className="flex flex-wrap items-center gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded"><input type="checkbox" aria-label={'Completar '+item.title} checked={item.completed} disabled={busy} onChange={e=>void change({action:'complete',id:item.id,revision:item.revision,completed:e.target.checked})}/><time className="text-cyan-300 text-sm">{view!=='day'&&<span className="block text-xs">{item.due_date}</span>}{item.due_time.slice(0,5)}</time><div className="flex-1 min-w-0"><p className={item.completed?'line-through text-slate-500':'break-words'}>{item.title}{reminderOverdue(item,now)&&<span className="ml-2 rounded bg-rose-950 px-1 text-xs text-rose-200">Vencido</span>}</p><p className="text-xs text-slate-400">{people.find(p=>p.id===item.assignee_id)?.name||'Persona asignada'}{item.recurrence&&item.recurrence!=='none'?' · '+({daily:'Diaria',weekly:'Semanal',monthly:'Mensual'} as Record<string,string>)[item.recurrence]:''} · {({low:'Baja',medium:'Normal',high:'Alta',urgent:'Urgente'} as Record<string,string>)[item.priority]}</p></div>{!item.completed&&<select aria-label={'Posponer '+item.title} disabled={busy} value="" onChange={e=>{const minutes=Number(e.target.value);if(minutes)void change({action:'snooze',id:item.id,revision:item.revision,minutes});}} className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"><option value="">Posponer…</option><option value="15">15 minutos</option><option value="60">1 hora</option><option value="1440">24 horas</option></select>}{item.creator_id===current&&!item.completed&&<button disabled={busy} aria-label={'Editar '+item.title} onClick={()=>{setEditing(item);setTitle(item.title);setDate(item.due_date);setTime(item.due_time.slice(0,5));setAssignee(item.assignee_id);setPriority(item.priority);setRecurrence(item.recurrence||'none');setNotice('Editando: '+item.title);}}><Pencil size={16}/></button>}{item.creator_id===current&&<button disabled={busy} aria-label={'Eliminar '+item.title} onClick={()=>void change({action:'delete',id:item.id,revision:item.revision})}><Trash2 size={16} className="text-slate-400"/></button>}</article>)}</div></section>;}
