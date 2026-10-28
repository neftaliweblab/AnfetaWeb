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
import {MediaViewerModal, detectMediaKind, type MediaKind} from '../MediaViewerModal';
const cache=new Map<string,any>();
export function ActivityContentPanel({activity,currentUser,onEditingChange,defaultOpen=true,onChecklistUpdated}:{activity:NotionCalendarActivity;currentUser:string;onEditingChange?:(open:boolean)=>void;defaultOpen?:boolean;onChecklistUpdated?:(updates:Partial<NotionCalendarActivity>)=>void}){
 const pageId=(activity.originalPageId||activity.pageId).replace(/^review-mirror-/,'');
 const [full,setFull]=useState(false),[visible,setVisible]=useState(100),[open,setOpen]=useState(defaultOpen),[blocks,setBlocks]=useState<any[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[editor,setEditor]=useState<string|null>(null),[adding,setAdding]=useState(false),[revision,setRevision]=useState(0),[organizing,setOrganizing]=useState(false);
 const [mediaPreview,setMediaPreview]=useState<{url:string;title?:string;kind?:MediaKind}|null>(null);
 const active=useRef(pageId);active.current=pageId;const saving=useRef(false);
 const editable=canEditActivity(currentUser,activity)&&!activity.isHandoffMirror;
 useEffect(()=>{setFull(false);setVisible(100);setOpen(defaultOpen);setBlocks([]);setError('');setEditor(null);setAdding(false);},[pageId,currentUser,defaultOpen]);
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
  try{const data=await readApiJson(await fetch('/api/data',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggle-checklist',payload:{pageId,blockId:block.id,checked:!block.isChecked,expectedChecked:!!block.isChecked}})}));if(!data.success||data.checked!==!block.isChecked)throw Error(data.error||'Notion no confirmó el check.');if(active.current!==id)return;setBlocks(rows=>rows.map(row=>row.id===block.id?{...row,isChecked:data.checked}:row));cache.delete(currentUser+':'+pageId);cache.delete(currentUser+':'+pageId+':full');if(data.stats){anfetaSync.broadcast({type:'ACTIVITY_UPDATED',confirmed:true,pageId,updates:{checklistScanned:true,...data.stats}});onChecklistUpdated?.({checklistScanned:true,...data.stats});}window.dispatchEvent(new CustomEvent('anfeta_page_content_changed',{detail:{pageId}}));setError(data.warning||'');}catch(e){if(active.current===id)setError(e instanceof Error?e.message:'No se confirmó el check.');}finally{saving.current=false;}
 }
 const render=(block:any)=>{
  const url=mediaUrl(block.url),declaredKind=block.kind;
  const kind=url?detectMediaKind(url,declaredKind):declaredKind;
  const caption=block.caption||block.text||'Archivo de la actividad';
  return <div className="space-y-1.5">
   {kind==='image'&&url?(
     <div className="space-y-1">
       <button
         type="button"
         onClick={()=>setMediaPreview({url,title:caption,kind:'image'})}
         className="group relative block max-w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900 transition hover:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
         title="Hacer clic para ampliar en el visor de ANFETA"
       >
         <img src={url} alt={caption} loading="lazy" className="max-h-80 max-w-full rounded object-contain transition duration-150 group-hover:scale-[1.01]"/>
         <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-0.5 text-[10px] text-cyan-300 font-mono backdrop-blur">
           🔍 Ampliar
         </span>
       </button>
       <div className="flex items-center gap-2 text-[11px] text-slate-400">
         <button type="button" onClick={()=>setMediaPreview({url,title:caption,kind:'image'})} className="text-cyan-300 underline">Visor ANFETA</button>
         <span>·</span>
         <a href={url} target="_blank" rel="noreferrer" className="text-slate-400 underline">Abrir original ↗</a>
       </div>
     </div>
   ):kind==='video'&&url?(
     <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 space-y-1.5">
       <video src={url} controls playsInline preload="metadata" className="max-h-64 w-full rounded-lg bg-black"/>
       <div className="flex items-center justify-between text-[11px]">
         <span className="truncate text-slate-300 font-medium">{caption}</span>
         <div className="flex gap-2 shrink-0">
           <button type="button" onClick={()=>setMediaPreview({url,title:caption,kind:'video'})} className="text-cyan-300 underline">Pantalla completa</button>
           <a href={url} target="_blank" rel="noreferrer" className="text-slate-400 underline">Abrir ↗</a>
         </div>
       </div>
     </div>
   ):kind==='audio'&&url?(
     <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 space-y-1.5">
       <div className="flex items-center justify-between text-[11px] text-slate-300">
         <span className="truncate font-medium">{caption}</span>
         <button type="button" onClick={()=>setMediaPreview({url,title:caption,kind:'audio'})} className="text-cyan-300 underline shrink-0">Abrir reproductor</button>
       </div>
       <audio src={url} controls preload="metadata" className="w-full h-8 accent-cyan-400"/>
     </div>
   ):kind==='pdf'&&url?(
     <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5 flex items-center justify-between gap-3">
       <div className="flex items-center gap-2 truncate">
         <span className="rounded bg-rose-950/80 px-1.5 py-0.5 font-bold text-[10px] text-rose-300 border border-rose-800/60">PDF</span>
         <span className="truncate text-slate-200">{caption}</span>
       </div>
       <div className="flex items-center gap-2 shrink-0">
         <button type="button" onClick={()=>setMediaPreview({url,title:caption,kind:'pdf'})} className="rounded bg-cyan-700/60 px-2.5 py-1 text-cyan-200 hover:bg-cyan-600 font-medium">Ver en ANFETA</button>
         <a href={url} target="_blank" rel="noreferrer" className="text-slate-400 underline">Abrir ↗</a>
       </div>
     </div>
   ):kind==='to_do'?(
     <label className="flex items-start gap-2.5 p-1 rounded hover:bg-slate-900/60 transition cursor-pointer select-none">
       <input type="checkbox" checked={!!block.isChecked} disabled={!editable||block.readOnly} onChange={()=>void toggle(block)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-cyan-500 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"/>
       <span className={'text-xs leading-snug break-words '+(block.isChecked?'text-slate-400 line-through':'text-slate-100 font-medium')+(block.text?.startsWith('⚡')?' font-bold text-amber-300':'')}>{block.text}</span>
     </label>
   ):kind==='divider'?<hr className="border-slate-700"/>:block.cells?<div className="overflow-x-auto"><table><tbody><tr>{block.cells.map((cell:string,i:number)=><td key={i} className="border border-slate-700 p-2">{cell}</td>)}</tr></tbody></table></div>:<p className={'whitespace-pre-wrap break-words '+(/^heading/.test(declaredKind)?'font-semibold text-slate-100':'text-slate-300')}>{block.text}</p>}
   {url&&!['image','video','audio','pdf'].includes(kind)&&<div className="flex items-center gap-2 py-1"><button type="button" onClick={()=>setMediaPreview({url,title:caption,kind:'file'})} className="text-cyan-300 underline font-medium">{caption||'Ver adjunto'}</button><a href={url} target="_blank" rel="noreferrer" className="text-slate-400 underline text-[11px]">Abrir ↗</a></div>}
   {editable&&!block.readOnly&&EDITABLE_NOTION_TEXT_TYPES.includes(declaredKind)&&/^[a-f0-9-]{32,36}$/i.test(block.id)&&<button type="button" onClick={()=>edit(block.id)} className="text-[11px] text-cyan-300 underline">Editar texto</button>}
  </div>;
 };
 const organize=async()=>{if(organizing)return;setOrganizing(true);setError('');try{const data=await readApiJson(await fetch('/api/data',{method:'POST',signal:AbortSignal.timeout(95000),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'consolidate-internal-metadata',payload:{pageId}})}));setError('Historial conservado en 1 solo desplegable. Contenedores agrupados: '+data.report.archived+(data.report.skipped?'. Se conservaron '+data.report.skipped+' contenedores con contenido distinto o cambios recientes.':''));}catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar la organización. Revisa antes de repetir.');}finally{setOrganizing(false);}};
 const tree=useMemo(()=>activityContentTree(blocks.slice(0,visible)),[blocks,visible]);
 const renderNode=(node:ActivityContentNode):React.ReactNode=>{
  const {block,children}=node;
  if(block.kind==='toggle'||block.isToggleable)return <details key={node.key} className="rounded border border-slate-800 p-2"><summary className="cursor-pointer font-semibold text-slate-200">{block.text||'Sección'}</summary><div className="mt-2 space-y-2 border-l border-slate-700 pl-2">{editable&&!block.readOnly&&EDITABLE_NOTION_TEXT_TYPES.includes(block.kind)&&<button type="button" className="text-cyan-300 underline" onClick={()=>edit(block.id)}>Editar título de sección</button>}{children.map(renderNode)}</div></details>;
  return <div key={node.key} className="rounded border border-slate-800 p-2">{render(block)}{!!children.length&&<div className="mt-2 space-y-2 border-l border-slate-700 pl-2">{children.map(renderNode)}</div>}</div>;
 };
 return <section className="rounded-lg border border-slate-700 bg-slate-950/50 p-2 text-xs"><button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="font-semibold text-cyan-200">{open?'▾':'▸'} Contenido e imágenes · {editable?'editar':'consulta'}</button>
 {open&&<div className="mt-2 max-h-[60vh] space-y-2 overflow-auto select-text">{loading&&<p role="status">Cargando contenido…</p>}{error&&<p role="status" className="text-amber-300">{error}</p>}{!loading&&!blocks.length&&<p className="text-slate-400">No se recibió contenido. Puedes revisar la página original en Notion.</p>}{tree.map(renderNode)}{editable&&isDirection(currentUser)&&<details className="text-slate-500"><summary>Mantenimiento de actividad</summary><p>Conserva el historial interno en un solo desplegable «Datos internos de ANFETA» para que al borrarse en Notion se haga en un solo paso. Los anteriores se archivan solo tras verificar la copia.</p><button type="button" disabled={organizing} onClick={()=>void organize()} className="text-cyan-300 underline">{organizing?'Organizando…':'Agrupar en 1 solo desplegable'}</button></details>}{blocks.length>visible&&<button type="button" className="text-cyan-300 underline" onClick={()=>setVisible(n=>n+100)}>Mostrar 100 bloques más</button>}{!full&&<button type="button" disabled={loading} className="block text-cyan-300 underline" onClick={()=>setFull(true)}>Cargar contenido completo</button>}{editable&&<button type="button" onClick={()=>add(true)} className="rounded border border-cyan-800 p-2 text-cyan-200">Agregar texto o checklist</button>}</div>}
 {editor&&<NotionBlockTextEditor pageId={pageId} blockId={editor} onClose={()=>edit(null)} onSaved={saved=>setBlocks(rows=>rows.map(row=>row.id===saved.id?{...row,...saved}:row))}/>}
 {adding&&<NotionNewBlock pageId={pageId} onClose={()=>add(false)} onSaved={saved=>setBlocks(rows=>[...rows,saved])}/>}
 {mediaPreview&&<MediaViewerModal url={mediaPreview.url} title={mediaPreview.title} kind={mediaPreview.kind} onClose={()=>setMediaPreview(null)} onRefreshUrl={()=>{cache.delete(currentUser+':'+pageId);cache.delete(currentUser+':'+pageId+':full');setRevision(n=>n+1);}}/>}
 </section>;
}
