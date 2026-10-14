"use client";
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {viewportPosition} from '@/lib/viewportPosition';
export function ViewportMenu({position,children}:{position:{x:number;y:number};children:ReactNode}){
  const ref=useRef<HTMLDivElement>(null),[point,setPoint]=useState(position);
  useLayoutEffect(()=>{
    const align=()=>{const box=ref.current?.getBoundingClientRect();if(!box)return;const next=viewportPosition(position,box,{width:window.innerWidth,height:window.innerHeight});setPoint(old=>old.x===next.x&&old.y===next.y?old:next);};
    align();const observer=new ResizeObserver(align);if(ref.current)observer.observe(ref.current);window.addEventListener('resize',align);return()=>{observer.disconnect();window.removeEventListener('resize',align);};
  },[position.x,position.y]);
  return createPortal(<div ref={ref} role="menu" style={{left:point.x,top:point.y,maxHeight:'calc(100dvh - 16px)',maxWidth:'calc(100vw - 16px)'}} className="fixed z-[300] w-64 overflow-y-auto bg-[#111822] border border-[#253549] rounded-lg shadow-2xl py-1 text-xs text-[#E2E8F0] select-none" onClick={e=>e.stopPropagation()}>{children}</div>,document.body);
}
