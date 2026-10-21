"use client";
import {useEffect,useRef,useState,useCallback} from 'react';
import {applyPendingJournal,applyPendingOperation,type PendingOperation} from '@/lib/pendingOperations';
import type {PendingTaskItem} from '@/types/anfeta';

const sanitizeTask = (t: any): PendingTaskItem => ({
  id: typeof t?.id === 'string' && t.id ? t.id : crypto.randomUUID(),
  title: typeof t?.title === 'string' ? t.title : (typeof t?.query === 'string' ? t.query : ''),
  query: typeof t?.query === 'string' ? t.query : (typeof t?.title === 'string' ? t.title : ''),
  scheduledDate: typeof t?.scheduledDate === 'string' ? t.scheduledDate : '',
  isCompleted: Boolean(t?.isCompleted),
  createdAt: typeof t?.createdAt === 'string' && t.createdAt ? t.createdAt : new Date().toISOString(),
  ...(t?.updatedAt && typeof t.updatedAt === 'string' ? { updatedAt: t.updatedAt } : {}),
});

export function usePendingTasks(user:string,authenticated:boolean){
  const [tasks,setTasks]=useState<PendingTaskItem[]>([]),[error,setError]=useState('');
  const current=useRef<PendingTaskItem[]>([]),enqueue=useRef<(op:PendingOperation)=>void>(()=>{});
  useEffect(()=>{
    let active=true,busy=false;let journal:PendingOperation[]=[];
    const key='anfeta-pending-v2:'+user;
    current.current=[];setTasks([]);setError('');
    if(!authenticated||!user){enqueue.current=()=>{};return;}
    const publish=(items:PendingTaskItem[])=>{if(!active)return;const clean=items.map(sanitizeTask);current.current=clean;setTasks(clean);};
    const persist=()=>{try{localStorage.setItem(key,JSON.stringify({items:current.current}));for(const op of journal)localStorage.setItem(key+':op:'+op.key,JSON.stringify(op));}catch{setError('No se pudo conservar la copia local de pendientes. Mantén abierta esta ventana hasta confirmar el guardado.');}};
    try{
      const saved=JSON.parse(localStorage.getItem(key)||'null');
      if(Array.isArray(saved?.journal))journal=saved.journal;
      for(let i=0;i<localStorage.length;i++){
        const name=localStorage.key(i);
        if(name?.startsWith(key+':op:')){
          const op=JSON.parse(localStorage.getItem(name)||'null');
          if(op?.key&&!journal.some(entry=>entry.key===op.key))journal.push(op);
        }
      }
      if(Array.isArray(saved?.items))publish(applyPendingJournal(saved.items,journal));
    }catch{}
    const read=async()=>{
      const r=await fetch('/api/data?type=pendientes',{cache:'no-store'}),data=await r.json();
      if(!r.ok||!Array.isArray(data.items)||!Number.isFinite(data.revision))throw Error(data.error||'No se pudieron cargar los pendientes.');
      return data;
    };
    const sync=async()=>{
      if(busy||!active)return;busy=true;
      try{
        let remote=await read();if(!active)return;
        publish(applyPendingJournal(remote.items,journal));persist();
        while(journal.length&&active){
          const op=journal[0];let confirmed=false;
          for(let attempt=0;attempt<3&&!confirmed;attempt++){
            if(attempt)remote=await read();if(!active)return;
            const items=applyPendingOperation(remote.items,op).map(sanitizeTask);
            const r=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save-pendientes',payload:items,expectedRevision:remote.revision})}),data=await r.json();
            if(!active)return;
            if(!r.ok||!data.success){
              if(/inv[aá]lida/i.test(data.error||'')){
                try{localStorage.removeItem(key+':op:'+op.key);}catch{}
                confirmed=true;break;
              }
              if(/cambi|revision|conflict|guardando/i.test(data.error||'')&&attempt<2)continue;
              throw Error(data.error||'No se confirmó el guardado.');
            }
            remote={items:Array.isArray(data.items)?data.items:items,revision:data.revision};confirmed=true;
          }
          if(!confirmed)throw Error('Los pendientes cambiaron en otra ventana. Vuelve a intentar.');
          try{localStorage.removeItem(key+':op:'+op.key);}catch{}
          journal=journal.filter(entry=>entry.key!==op.key);
          publish(applyPendingJournal(remote.items,journal));persist();
        }
        if(active)setError('');
      }catch(e){
        if(active){
          persist();
          setError((e instanceof Error?e.message:'Error de conexión.')+' Los cambios locales se conservan; pulsa Reintentar o vuelve a esta ventana.');
        }
      }
      finally{busy=false;}
    };
    enqueue.current=op=>{journal.push(op);publish(applyPendingOperation(current.current,op));persist();void sync();};
    const retry=()=>void sync();
    window.addEventListener('focus',retry);
    window.addEventListener('online',retry);
    window.addEventListener('anfeta_retry_pending',retry);
    void sync();
    return()=>{
      active=false;
      enqueue.current=()=>{};
      window.removeEventListener('focus',retry);
      window.removeEventListener('online',retry);
      window.removeEventListener('anfeta_retry_pending',retry);
    };
  },[user,authenticated]);

  const send=useCallback((op:Omit<PendingOperation,'key'>)=>enqueue.current({...op,key:crypto.randomUUID()}),[]);
  return {
    pendingTasks:tasks,
    pendingError:error,
    handleAddPendingTask:useCallback((task:Omit<PendingTaskItem,'id'>)=>send({item:{...task,id:crypto.randomUUID(),createdAt:new Date().toISOString()}}),[send]),
    handleEditPendingTask:useCallback((id:string,patch:Partial<PendingTaskItem>)=>send({id,patch}),[send]),
    handleTogglePendingTask:useCallback((id:string)=>{const task=current.current.find(t=>t.id===id);if(task)send({id,patch:{isCompleted:!task.isCompleted}});},[send]),
    handleDeletePendingTask:useCallback((id:string)=>send({remove:[id]}),[send]),
    handleDeleteAllPendingTasks:useCallback(()=>send({remove:current.current.map(t=>t.id)}),[send])
  };
}
