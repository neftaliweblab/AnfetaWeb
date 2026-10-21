"use client";
import {useEffect,useRef} from 'react';
import {rememberDeletedPages,pageIdentity,deletedPages,restoreConfirmedPages} from '@/lib/deletedPages';
/** Bounded validation of visible records, never a complete index query per tick. */
export function useNotionPageWatch(owner:string,rows:any[],enabled:boolean,onStates:(states:any[])=>void){
 const latest=useRef({rows,onStates});latest.current={rows,onStates};
 useEffect(()=>{if(!enabled||!owner)return;let active=true,busy=false,cursor=0,restoreCursor=0;const controller=new AbortController();
  const check=async()=>{if(!active||busy||document.hidden)return;const ids=[...new Set(latest.current.rows.filter(row=>row.source==='Notion'||!!row.pageId).map(pageIdentity))].filter(id=>/^[a-f0-9]{32}$/.test(id)),removed=[...deletedPages(owner)];if(!ids.length&&!removed.length)return;busy=true;
   const selected=Array.from({length:Math.min(removed.length?3:4,ids.length)},(_,i)=>ids[(cursor+i)%ids.length]);if(ids.length)cursor=(cursor+selected.length)%ids.length;if(removed.length)selected.push(removed[restoreCursor++%removed.length]);
   try{let token='';try{token=JSON.parse(localStorage.getItem('anfeta_settings')||'{}').notionToken||'';}catch{}
    const response=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'x-notion-token':token}:{})},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]),body:JSON.stringify({action:'notion-page-states',payload:{ids:selected}})}),data=await response.json();
    if(active&&response.ok&&Array.isArray(data.states)){const deleted=data.states.filter((s:any)=>s.deleted).map((s:any)=>s.id);if(deleted.length)rememberDeletedPages(owner,deleted);restoreConfirmedPages(owner,data.states.filter((s:any)=>s.deleted===false&&!s.unverified).map((s:any)=>s.id));latest.current.onStates(data.states);}
   }catch{/* A timeout, permission failure or 404 never proves deletion. */}finally{busy=false;}
  };const timer=setInterval(()=>void check(),5000);window.addEventListener('focus',check);void check();return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',check);};
 },[owner,enabled]);
}
