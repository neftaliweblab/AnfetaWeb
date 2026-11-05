"use client";
import {useEffect,useRef,useState} from 'react';
import {Monitor,Maximize2,Minimize2,X} from 'lucide-react';
import {CALENDAR_GRID_INTERVALS,CALENDAR_DISPLAY_PRESETS,CALENDAR_HEIGHT_MIN,CALENDAR_HEIGHT_MAX,CALENDAR_WIDTH_MIN,CALENDAR_WIDTH_MAX} from '@/lib/calendarDisplayOptions';

type MonitorProfile={id:string;name:string;value:Record<string,any>};
export function CalendarDisplaySettings({currentUser,value,onChange,expanded,onToggleExpanded}:{currentUser:string;value:Record<string,any>;onChange:(value:any)=>void;expanded:boolean;onToggleExpanded:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const latest=useRef({value,onChange});latest.current={value,onChange};
  const [profiles,setProfiles]=useState<MonitorProfile[]>([]),[selected,setSelected]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState('');
  const [readyOwner,setReadyOwner]=useState('');
  const ownerKey='anfeta-monitor-profiles-v1:'+currentUser;
  useEffect(()=>{
    const initial=[{id:'primary',name:'Monitor principal',value:{...latest.current.value,height:72,width:260,gridInterval:30}},{id:'secondary',name:'Monitor secundario',value:{...latest.current.value,height:288,width:400,gridInterval:15}}];
    let loaded=initial;
    try{
      const raw=JSON.parse(localStorage.getItem(ownerKey)||'null');
      if(Array.isArray(raw))loaded=raw.filter(p=>p&&typeof p.id==='string'&&p.id.length<=80&&typeof p.name==='string'&&p.name.length<=60&&p.value&&typeof p.value==='object'&&!Array.isArray(p.value)).slice(0,10);
    }catch{}
    setProfiles(loaded);setMessage('');setSelected('');setName('');setReadyOwner(ownerKey);
    // Per-window selection: applying a view never changes another monitor's zoom.
    try{const active=sessionStorage.getItem(ownerKey+':active');const profile=loaded.find(p=>p.id===active);if(profile){setSelected(profile.id);setName(profile.name);latest.current.onChange(profile.value);}}catch{}
  },[ownerKey]);
  useEffect(()=>{
    const refresh=(event:StorageEvent)=>{
      if(event.key!==ownerKey)return;
      try{const raw=JSON.parse(event.newValue||'[]');if(Array.isArray(raw))setProfiles(raw.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.value&&typeof p.value==='object').slice(0,10));}catch{}
    };
    window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);
  },[ownerKey]);
  const remember=(id:string)=>{try{sessionStorage.setItem(ownerKey+':active',id);}catch{}};
  const apply=(profile:MonitorProfile)=>{setSelected(profile.id);setName(profile.name);remember(profile.id);onChange(profile.value);setMessage('Vista aplicada solo a esta ventana.');};
  const change=(patch:Record<string,any>)=>{setSelected('');remember('');onChange({...value,...patch});setMessage('Ajuste visual aplicado. Puedes guardarlo con un nombre.');};
  const fitScreenHeight=()=>{
    if(typeof window==='undefined')return;
    const available=window.innerHeight-180;
    const targetHourHeight=Math.max(CALENDAR_HEIGHT_MIN,Math.min(CALENDAR_HEIGHT_MAX,Math.round(available/14)));
    change({height:targetHourHeight});
    setMessage(`Altura ajustada a tu pantalla (${targetHourHeight}px por hora, ${Math.round(targetHourHeight/72*100)}%).`);
  };
  const save=()=>{
    const clean=name.trim().slice(0,60);if(!clean){setMessage('Escribe un nombre para la vista.');return;}
    const existing=profiles.find(p=>p.name.toLowerCase()===clean.toLowerCase());
    if(!existing&&profiles.length>=10){setMessage('Puedes guardar hasta 10 vistas. Elimina una antes de crear otra.');return;}
    const saved={id:existing?.id||crypto.randomUUID(),name:clean,value:{...value}};
    const next=existing?profiles.map(p=>p.id===saved.id?saved:p):[...profiles,saved];
    try{localStorage.setItem(ownerKey,JSON.stringify(next));setProfiles(next);setSelected(saved.id);remember(saved.id);setMessage('Vista guardada para tu usuario en este navegador.');}
    catch{setMessage('No se pudo guardar en este navegador. La vista actual se conserva.');}
  };
  const remove=()=>{
    const next=profiles.filter(p=>p.id!==selected);
    try{localStorage.setItem(ownerKey,JSON.stringify(next));setProfiles(next);setSelected('');setName('');remember('');setMessage('Vista eliminada; tus actividades no cambian.');}
    catch{setMessage('No se pudo eliminar la vista guardada.');}
  };
  return <>
    <button ref={trigger} type="button" disabled={readyOwner!==ownerKey} onClick={()=>dialog.current?.showModal()} className="flex items-center gap-1 rounded border border-cyan-800 bg-cyan-950/50 px-2 py-1 text-cyan-200" title="Configurar tamaño, líneas y perfiles por monitor"><Monitor size={14}/>Pantallas</button>
    <button type="button" aria-pressed={expanded} onClick={onToggleExpanded} className="rounded border border-cyan-800 p-1 text-cyan-200" title={expanded?'Salir de vista ampliada (Escape)':'Ampliar calendario y ocultar barras externas'} aria-label={expanded?'Salir de vista ampliada':'Ampliar calendario'}>{expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button>
    <dialog ref={dialog} onClose={()=>trigger.current?.focus()} className="m-auto max-h-[90dvh] w-[min(42rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-cyan-800 bg-[#0c1622] p-5 text-slate-200 shadow-2xl backdrop:bg-black/70" aria-label="Pantallas y tamaño del calendario">
      <header className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-semibold text-cyan-200"><Monitor size={20}/>Pantallas y tamaño del calendario</h2><button type="button" aria-label="Cerrar ajustes de pantalla" onClick={()=>dialog.current?.close()} className="rounded p-2 hover:bg-slate-800"><X size={18}/></button></header>
      <p className="mb-4 text-xs leading-relaxed text-slate-400">Ajusta cada ventana a su monitor. Las actividades siguen sincronizadas; la altura, las columnas y las líneas de esta ventana son independientes. Estos controles no cambian los horarios de Notion.</p>
      <section className="space-y-3 rounded-xl border border-slate-700 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tamaños rápidos</h3>
          <button
            type="button"
            onClick={fitScreenHeight}
            className="rounded border border-cyan-700 bg-cyan-950/60 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-900 transition-colors flex items-center gap-1.5"
            title="Calcula automáticamente la altura ideal para llenar esta ventana o monitor sin dejar huecos abajo"
          >
            <Maximize2 size={13} />
            Llenar altura de pantalla
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{CALENDAR_DISPLAY_PRESETS.map(preset=><button type="button" key={preset.id} onClick={()=>change({height:preset.height,width:preset.width})} className="rounded border border-cyan-900 bg-cyan-950/30 px-2 py-2 text-xs text-cyan-200 hover:bg-cyan-900">{preset.label}<span className="block text-[10px] text-slate-400">{Math.round(preset.height/72*100)}% de altura</span></button>)}</div>
        <label className="block text-xs">Altura por hora · {Math.round(value.height/72*100)}%<input aria-label="Altura del calendario" type="range" min={CALENDAR_HEIGHT_MIN} max={CALENDAR_HEIGHT_MAX} step={12} value={value.height} onChange={event=>change({height:Number(event.target.value)})} className="mt-2 block w-full accent-cyan-400"/></label>
        <label className="block text-xs">Ancho de columnas · {value.width} px<input aria-label="Ancho de columnas del calendario" type="range" min={CALENDAR_WIDTH_MIN} max={CALENDAR_WIDTH_MAX} step={20} value={value.width} onChange={event=>change({width:Number(event.target.value)})} className="mt-2 block w-full accent-cyan-400"/></label>
        <label className="flex items-center justify-between gap-3 text-xs">Líneas del reloj<select aria-label="Intervalo visual del calendario" value={value.gridInterval} onChange={event=>change({gridInterval:Number(event.target.value)})} className="rounded border border-slate-600 bg-slate-900 p-2">{CALENDAR_GRID_INTERVALS.map(minutes=><option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></label>
        <p className="text-[11px] text-slate-400">Las líneas y la altura se ajustan por separado. Con líneas de 5 minutos, usa Amplia o Extraalta para leer todas las etiquetas sin encimarlas.</p>
      </section>
      <section className="mt-4 space-y-3 rounded-xl border border-slate-700 p-3">
        <h3 className="text-sm font-semibold">Mis vistas por monitor</h3>
        <label className="block text-xs">Aplicar una vista guardada<select aria-label="Vista guardada del monitor" value={selected} onChange={event=>{const profile=profiles.find(p=>p.id===event.target.value);if(profile)apply(profile);}} className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2"><option value="">Vista personalizada actual</option>{profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
        <label className="block text-xs">Nombre de la vista<input aria-label="Nombre de la vista del monitor" maxLength={60} value={name} onChange={event=>setName(event.target.value)} placeholder="Ej. Monitor secundario vertical" className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2"/></label>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={save} className="rounded bg-cyan-700 px-3 py-2 text-xs text-white">Guardar vista actual</button><button type="button" disabled={!selected} onClick={remove} className="rounded border border-slate-600 px-3 py-2 text-xs disabled:opacity-40">Eliminar vista</button></div>
        <p className="text-[11px] text-slate-400">Incluye tamaño, divisiones, personas visibles y filtros. Hasta 10 vistas por usuario en este navegador. Para cambiar de equipo, usa también «Guardar vista en mi cuenta».</p>
      </section>
      {message&&<p role="status" className="mt-3 text-xs text-cyan-300">{message}</p>}
      <footer className="mt-4 flex justify-end"><button type="button" onClick={()=>dialog.current?.close()} className="rounded bg-cyan-800 px-4 py-2 text-sm text-white">Listo</button></footer>
    </dialog>
  </>;
}
