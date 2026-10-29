"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
/** Mount near the viewport once, keeping editors mounted when the user scrolls away. */
export function VisibleActivityDetails({children}:{children:ReactNode}){
 const target=useRef<HTMLDivElement>(null),[ready,setReady]=useState(false);
 useEffect(()=>{
  if(!target.current)return;
  if(typeof IntersectionObserver==='undefined'){setReady(true);return;}
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){
    setReady(true);
    observer.disconnect();
   }
  },{rootMargin:'250px'});
  observer.observe(target.current);
  return()=>observer.disconnect();
 },[]);
 return (
  <div ref={target} className="min-h-16">
   {ready ? children : (
    <div role="status" className="p-3 bg-slate-900/40 rounded-lg border border-slate-800/60 animate-pulse space-y-1.5">
     <p className="text-xs text-slate-400">Actividad desplegada. El detalle se cargará al acercarte en la lista.</p>
     <div className="h-2 bg-slate-800/70 rounded w-1/4" />
    </div>
   )}
  </div>
 );
}
