"use client";
import {useEffect,useRef,useState,useMemo} from 'react';
import type {NotionCalendarActivity} from '@/types/anfeta';
import {canEditActivity,isDirection} from '@/services/activityPermissions';
import {NotionBlockTextEditor} from '../ResultsViewHost/NotionBlockTextEditor';
import {NotionNewBlock} from '../ResultsViewHost/NotionNewBlock';
import {EDITABLE_NOTION_TEXT_TYPES} from '@/lib/notionBlockText';
import {readApiJson} from '@/lib/readApiJson';
import {activityContentTree,type ActivityContentNode} from '@/lib/activityContentTree';
import {mediaUrl} from '@/lib/mediaUrl';
import {anfetaSync} from '@/lib/anfetaBroadcastSync';
const cache=new Map<string,any>();
export function ActivityContentPanel({activity,currentUser,onEditingChange}:{activity:NotionCalendarActivity;currentUser:string;onEditingChange?:(open:boolean)=>void}){
 const pageId=(activity.originalPageId||activity.pageId).replace(/^review-mirror-/,'');
 const [full,setFull]=useState(false),[visible,setVisible]=useState(100),[open,setOpen]=useState(false),[blocks,setBlocks]=useState<any[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[editor,setEditor]=useState<string|null>(null),[adding,setAdding]=useState(false),[revision,setRevision]=useState(0),[organizing,setOrganizing]=useState(false);
 const active=useRef(pageId);active.current=pageId;const saving=useRef(false);
 const editable=canEditActivity(currentUser,activity)&&!activity.isHandoffMirror;
 useEffect(()=>{setFull(false);setVisible(100);setOpen(false);setBlocks([]);setError('');setEditor(null);setAdding(false);},[pageId,currentUser]);
 useEffect(()=>{const refresh=(e:Event)=>{if((e as CustomEvent).detail?.pageId?.replace(/-/g,'')===pageId.replace(/-/g,'')){cache.delete(currentUser+':'+pageId);cache.delete(currentUser+':'+pageId+':full');setRevision(n=>n+1);}};window.addEventListener('anfeta_page_content_changed',refresh);return()=>window.removeEventListener('anfeta_page_content_changed',refresh);},[pageId,currentUser]);
 useEffect(()=>{
  if(!open)return;const key=currentUser+':'+pageId+(full?':full':''),previous=cache.get(key),abort=new AbortController();
  if(previous&&Date.now()-previous.at<30000){setBlocks(previous.blocks);setLoading(false);return;}
  setLoading(true);setError('');
  fetch('/api/data?type=page-preview&pageId='+encodeURIComponent(pageId)+(full?'&full=1':''),{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(full?85000:45000)])}).then(readApiJson).then(data=>{if(abort.signal.aborted)return;if(!Array.isArray(data.blocks))throw Error(data.error||'No se pudo leer el contenido.');setBlocks(data.blocks);setError(data.warning||'');if(cache.size>=60)cache.delete(cache.keys().next().value!);cache.set(key,{blocks:data.blocks,at:Date.now()});}).catch(e=>{if(!abort.signal.aborted)setError(e.message||'No se pudo cargar el contenido.');}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();
 },[open,pageId,currentUser,revision,full]);
 const edit=(id:string|null)=>{onEditingChange?.(!!id);setEditor(id);};
 const add=(value:boolean)=>{onEditingChange?.(value);setAdding(value);};
 async function toggle(block:any){
  if(!editable||saving.current)return;saving.current=true;setError('');const id=pageId;
  try{const data=await readApiJson(await fetch('/api/data',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggle-checklist',payload:{pageId,blockId:block.id,checked:!block.isChecked,expectedChecked:!!block.isChecked}})}));if(!data.success||data.checked!==!block.isChecked)throw Error(data.error||'Notion no confirmó el check.');if(active.current!==id)return;setBlocks(rows=>rows.map(row=>row.id===block.id?{...row,isChecked:data.checked}:row));cache.delete(currentUser+':'+pageId);cache.delete(currentUser+':'+pageId+':full');if(data.stats)anfetaSync.broadcast({type:'ACTIVITY_UPDATED',confirmed:true,pageId,updates:{checklistScanned:true,...data.stats}});setError(data.warning||'');}catch(e){if(active.current===id)setError(e instanceof Error?e.message:'No se confirmó el check.');}finally{saving.current=false;}
 }
 const render=(block:any)=>{const url=mediaUrl(block.url),kind=block.kind;return <div className="space-y-1">
  {kind==='image'&&url?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={block.caption||'Imagen de la actividad'} loading="lazy" className="max-h-80 max-w-full rounded object-contain"/></a>:kind==='to_do'?<label className="flex gap-2"><input type="checkbox" checked={!!block.isChecked} disabled={!editable||block.readOnly} onChange={()=>void toggle(block)}/><span className={block.isChecked?'text-slate-400 line-through':''}>{block.text}</span></label>:kind==='divider'?<hr className="border-slate-700"/>:block.cells?<div className="overflow-x-auto"><table><tbody><tr>{block.cells.map((cell:string,i:number)=><td key={i} className="border border-slate-700 p-2">{cell}</td>)}</tr></tbody></table></div>:<p className={'whitespace-pre-wrap break-words '+(/^heading/.test(kind)?'font-semibold text-slate-100':'text-slate-300')}>{block.text}</p>}
  {url&&kind!=='image'&&<a href={url} target="_blank" rel="noreferrer" className="block break-all text-cyan-300 underline">{block.caption||'Abrir archivo o enlace'}</a>}
  {editable&&!block.readOnly&&EDITABLE_NOTION_TEXT_TYPES.includes(kind)&&/^[a-f0-9-]{32,36}$/i.test(block.id)&&<button type="button" onClick={()=>edit(block.id)} className="text-[11px] text-cyan-300 underline">Editar texto</button>}
 </div>;};
 const organize=async()=>{if(organizing)return;setOrganizing(true);setError('');try{const data=await readApiJson(await fetch('/api/data',{method:'POST',signal:AbortSignal.timeout(95000),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'consolidate-internal-metadata',payload:{pageId}})}));setError('Historial conservado. Contenedores agrupados: '+data.report.archived+(data.report.skipped?'. Se conservaron '+data.report.skipped+' contenedores con contenido distinto o cambios recientes.':''));}catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar la organización. Revisa antes de repetir.');}finally{setOrganizing(false);}};
 const tree=useMemo(()=>activityContentTree(blocks.slice(0,visible)),[blocks,visible]);
 const renderNode=(node:ActivityContentNode):React.ReactNode=>{
  const {block,children}=node;
  if(block.kind==='toggle'||block.isToggleable)return <details key={node.key} className="rounded border border-slate-800 p-2"><summary className="cursor-pointer font-semibold text-slate-200">{block.text||'Sección'}</summary><div className="mt-2 space-y-2 border-l border-slate-700 pl-2">{editable&&!block.readOnly&&EDITABLE_NOTION_TEXT_TYPES.includes(block.kind)&&<button type="button" className="text-cyan-300 underline" onClick={()=>edit(block.id)}>Editar título de sección</button>}{children.map(renderNode)}</div></details>;
  return <div key={node.key} className="rounded border border-slate-800 p-2">{render(block)}{!!children.length&&<div className="mt-2 space-y-2 border-l border-slate-700 pl-2">{children.map(renderNode)}</div>}</div>;
 };
 return <section className="rounded-lg border border-slate-700 bg-slate-950/50 p-2 text-xs"><button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="font-semibold text-cyan-200">{open?'▾':'▸'} Contenido e imágenes · {editable?'editar':'consulta'}</button>
 {open&&<div className="mt-2 max-h-[60vh] space-y-2 overflow-auto select-text">{loading&&<p role="status">Cargando contenido…</p>}{error&&<p role="status" className="text-amber-300">{error}</p>}{!loading&&!blocks.length&&<p className="text-slate-400">No se recibió contenido. Puedes revisar la página original en Notion.</p>}{tree.map(renderNode)}{editable&&isDirection(currentUser)&&<details className="text-slate-500"><summary>Mantenimiento de actividad</summary><p>Conserva el historial interno en un contenedor. Los anteriores se archivan solo después de verificar la copia. El contenido de trabajo no se modifica.</p><button type="button" disabled={organizing} onClick={()=>void organize()} className="text-cyan-300 underline">{organizing?'Organizando…':'Agrupar datos internos repetidos'}</button></details>}{blocks.length>visible&&<button type="button" className="text-cyan-300 underline" onClick={()=>setVisible(n=>n+100)}>Mostrar 100 bloques más</button>}{!full&&<button type="button" disabled={loading} className="block text-cyan-300 underline" onClick={()=>setFull(true)}>Cargar contenido completo</button>}{editable&&<button type="button" onClick={()=>add(true)} className="rounded border border-cyan-800 p-2 text-cyan-200">Agregar texto o checklist</button>}</div>}
 {editor&&<NotionBlockTextEditor pageId={pageId} blockId={editor} onClose={()=>edit(null)} onSaved={saved=>setBlocks(rows=>rows.map(row=>row.id===saved.id?{...row,...saved}:row))}/>}
 {adding&&<NotionNewBlock pageId={pageId} onClose={()=>add(false)} onSaved={saved=>setBlocks(rows=>[...rows,saved])}/>}
 </section>;
}
