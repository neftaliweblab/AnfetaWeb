"use client";
import {useEffect,useState,useRef} from 'react';
import {readApiJson} from '@/lib/readApiJson';

interface TeamMember {
  name: string;
  tag?: string;
  isOnline: boolean;
  lastSeen?: string | null;
  lastSeenLabel?: string;
}

export function TeamPresence(){
  const [people,setPeople]=useState<TeamMember[]>([]);
  const [error,setError]=useState('');
  const [configured,setConfigured]=useState(false);
  const [open,setOpen]=useState(false);
  const dropdownRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const controller=new AbortController();
    let busy=false;
    const refresh=async()=>{
      if(document.hidden||busy)return;
      busy=true;
      try{
        const data=await readApiJson(await fetch('/api/presence',{method:'POST',signal:controller.signal,cache:'no-store'}));
        if(!controller.signal.aborted){
          setPeople(data.people || []);
          setConfigured(Boolean(data.configured));
          setError('');
        }
      }catch(e){
        if(!controller.signal.aborted){
          setPeople([]);
          setError(e instanceof Error?e.message:'Presencia no disponible.');
        }
      }finally{
        busy=false;
      }
    };

    void refresh();
    const timer=setInterval(refresh,45000);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);

    return()=>{
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus',refresh);
      document.removeEventListener('visibilitychange',refresh);
    };
  },[]);

  useEffect(()=>{
    if(!open)return;
    const handleClickOutside=(e:MouseEvent)=>{
      if(dropdownRef.current && !dropdownRef.current.contains(e.target as Node)){
        setOpen(false);
      }
    };
    document.addEventListener('mousedown',handleClickOutside);
    return()=>document.removeEventListener('mousedown',handleClickOutside);
  },[open]);

  if(!configured&&!error)return null;

  const onlineCount = people.filter(p=>p.isOnline).length;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={()=>setOpen(prev=>!prev)}
        title={error||`${onlineCount} de ${people.length} en línea. Clic para ver última conexión`}
        className={'inline-flex items-center gap-1.5 text-[11px] font-medium rounded-md border px-2 py-1 transition-colors cursor-pointer select-none '+(
          error
            ?'border-amber-800/80 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'
            :'border-slate-700 bg-slate-900/90 text-emerald-300 hover:bg-slate-800 hover:border-slate-600'
        )}
      >
        <span className={'w-2 h-2 rounded-full '+(error?'bg-amber-400':onlineCount>0?'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]':'bg-slate-500')} />
        <span className="whitespace-nowrap">{error?'Desconectado':`${onlineCount} en línea`}</span>
        <span className="text-[9px] opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[#223848] bg-[#0C121B]/95 p-3.5 shadow-2xl backdrop-blur-md z-[100] text-slate-100 ring-1 ring-cyan-500/20">
          <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Equipo ANFETA</span>
            </span>
            <span className="text-emerald-400 text-[10.5px] font-mono lowercase">{onlineCount} en línea</span>
          </div>

          <div className="mt-2.5 space-y-1.5 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
            {people.length===0 ? (
              <div className="text-[11px] text-slate-400 py-3 text-center">
                {error || 'No se han registrado conexiones todavía.'}
              </div>
            ) : (
              people.map(person=>(
                <div
                  key={person.name}
                  className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-lg hover:bg-[#162335]/70 transition-colors text-xs border border-transparent hover:border-slate-800"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={'w-2 h-2 rounded-full shrink-0 '+(person.isOnline?'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)] animate-pulse':'bg-slate-600')} />
                    <span className={'font-medium truncate '+(person.isOnline?'text-slate-100 font-semibold':'text-slate-400')}>
                      {person.name}
                    </span>
                  </div>
                  <span className={'text-[10px] shrink-0 font-mono px-1.5 py-0.5 rounded '+(
                    person.isOnline
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold'
                      : 'text-slate-500'
                  )}>
                    {person.lastSeenLabel || (person.isOnline ? 'En línea' : 'Sin conexión')}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-[#1E293B] text-[10px] text-slate-400 flex items-center justify-between">
            <span className="text-slate-500">Sincronizado vía Supabase</span>
            <button
              type="button"
              onClick={()=>setOpen(false)}
              className="text-cyan-400 hover:text-cyan-200 transition-colors cursor-pointer font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
