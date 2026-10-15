"use client";
import {useEffect,useState,useRef} from 'react';

export function UpdateNotice({message}:{message:string}){
  const [saved,setSaved]=useState(''),[dismissed,setDismissed]=useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(()=>{
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!message) {
      setSaved('');
      setDismissed(false);
      return;
    }

    // Debounce transient 1-2s warnings from background sync
    timerRef.current = setTimeout(() => {
      setSaved(message);
      setDismissed(false);
    }, 2200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  },[message]);

  if(!saved||dismissed)return null;
  const messages=[...new Set(saved.split(' · ').map(text=>text.trim()).filter(Boolean))];
  return (
    <div className="flex items-start gap-2 border-b border-amber-900/40 bg-amber-950/30 px-3 py-1 text-xs text-amber-200 animate-in fade-in duration-200">
      <details className="min-w-0 flex-1">
        <summary className="cursor-pointer font-medium hover:text-amber-100">Aviso de actualización ({messages.length})</summary>
        <ul className="mt-1.5 max-h-32 overflow-y-auto space-y-1 break-words">{messages.map((text,index)=><li key={index}>{text}</li>)}</ul>
      </details>
      <button type="button" aria-label="Cerrar aviso de actualización" onClick={()=>setDismissed(true)} className="text-amber-400 hover:text-white px-1">×</button>
    </div>
  );
}
