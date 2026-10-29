"use client";
import {useRef,useState} from 'react';
import {ACTIVITY_TAGS} from '@/services/activityTags';
import {SearchChoice} from './SearchChoice';
import {openNotionPage} from '@/services/windowsIntegration';
import {readApiJson} from '@/lib/readApiJson';
export function personWorkQuery(person:string){const entry=ACTIVITY_TAGS[person as keyof typeof ACTIVITY_TAGS];return entry?[...['00','11','22','33'].map(p=>entry.active+p),entry.review,entry.reference+'000'].join(' OR '):'';}
export function PersistentSearchAccess({onSearch}:{onSearch:(query:string)=>void}){
 const [links,setLinks]=useState<{id:string;name:string;url:string}[]>([]),[status,setStatus]=useState('Consultar bases de Notion'),[warning,setWarning]=useState('');const loaded=useRef(false),loading=useRef(false);
 async function load(){if(loaded.current||loading.current)return;loading.current=true;setStatus('Consultando bases…');try{const data=await readApiJson(await fetch('/api/data?type=notion-base-links',{signal:AbortSignal.timeout(60000)}));setLinks(data.items||[]);setWarning((data.warnings||[]).join(' · '));loaded.current=true;setStatus('Abrir base en Notion');}catch(e){setStatus('Volver a consultar bases');setWarning(e instanceof Error?e.message:'No se pudieron cargar las bases.');}finally{loading.current=false;}}
 return <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Accesos rápidos permanentes"><span className="text-[10px] text-slate-400">Trabajo:</span>{Object.keys(ACTIVITY_TAGS).map(person=><button key={person} type="button" title={person+' · abrir trabajo en una búsqueda nueva'} aria-label={'Abrir trabajo de '+person+' en nueva pestaña'} onClick={()=>onSearch(personWorkQuery(person))} className="rounded-md border border-cyan-900 bg-cyan-950/40 px-1.5 py-1 text-[10px] text-cyan-200 hover:border-cyan-400">{person}</button>)}<div title={warning||'Enlaces a las bases originales; se consultan al abrir.'}><SearchChoice description="Abre la base original en Notion. Este acceso no filtra los resultados de ANFETA." label="Bases originales de Notion" value="" onOpen={()=>void load()} options={[{value:'',label:status,description:warning||'Abre la base completa en Notion.'},...links.map(link=>({value:link.id,label:link.name,description:'Abrir base original ↗'}))]} onChange={id=>{const link=links.find(x=>x.id===id);if(link)openNotionPage(link.url);}}/></div></div>;
}
