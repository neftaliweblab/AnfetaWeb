"use client";
import {useEffect,useRef,useState} from 'react';
import type {NotionCalendarActivity} from '@/types/anfeta';
import {canEditActivity,isDirection} from '@/services/activityPermissions';
import {normalizePerson} from '@/services/identityNormalizer';
import {workflowState} from '@/services/activityWorkflow';
export function QuickAssigneeSelect({activity,currentUser,onConfirm}:{activity:NotionCalendarActivity;currentUser:string;onConfirm?:(updates:any)=>Promise<boolean|void>|void}){
 const [people,setPeople]=useState<{name:string}[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');const saving=useRef(false);
 const isPendingReview = activity.reviewFlow?.State === 'pending' || workflowState(activity.status,activity.title)==='review';
 const isDir = isDirection(currentUser);
 const isOwner = normalizePerson(currentUser) === normalizePerson(activity.person);
 const isAllowedState = ['pending','suspended'].includes(workflowState(activity.status,activity.title)) || isPendingReview;
 const allowed = !!onConfirm && canEditActivity(currentUser,activity) && (isDir || isOwner || isPendingReview) && isAllowedState;
 useEffect(()=>{if(!allowed)return;const controller=new AbortController();fetch('/api/team',{signal:controller.signal,cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo cargar el equipo.');if(!controller.signal.aborted)setPeople((data.people||[]).filter((p:any)=>p.name!=='Emmanuel'));}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[allowed,currentUser]);
 async function change(person:string){if(saving.current||!allowed||person===activity.person)return;saving.current=true;setBusy(true);setError('');try{const update=isPendingReview?{reviewer:person,status:'rtuzREVISION',leaveVisualCopy:activity.reviewFlow?.LeaveVisualCopy!==false}:{handoff:true,person,note:'',leaveVisualCopy:false};if(await onConfirm?.(update)===false)throw Error('No se confirmó la reasignación. Revisa el aviso y vuelve a intentar.');}catch(e){setError(e instanceof Error?e.message:'No se pudo reasignar.');}finally{saving.current=false;setBusy(false);}}
 return <span className="min-w-0 max-w-[65%] text-right" onClick={e=>e.stopPropagation()}>{allowed?<select aria-label="Reasignar responsable sin copia" title="Reasigna esta misma actividad, sin dejar copia visual" disabled={busy||!people.length} value={activity.person} onChange={e=>void change(e.target.value)} className="max-w-full rounded border border-cyan-900 bg-slate-900 px-2 py-1 text-xs text-cyan-100">{!people.some(p=>p.name===activity.person)&&<option>{activity.person}</option>}{people.map(p=><option key={p.name}>{p.name}</option>)}</select>:<span>{activity.person}</span>}{busy&&<span role="status" className="block text-[10px] text-cyan-300">Guardando…</span>}{error&&<span role="alert" className="block text-[10px] text-rose-300">{error}</span>}</span>;
}
