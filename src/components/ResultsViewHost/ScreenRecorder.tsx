"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Video,Square,X} from 'lucide-react';
import {startScreenRecording} from '@/lib/screenRecording';
import type {GlobalPasteImagePayload} from './GlobalPasteModal';

export function ScreenRecorder({onReady,disabled=false}:{onReady:(file:GlobalPasteImagePayload)=>Promise<boolean>;disabled?:boolean}){
  const [phase,setPhase]=useState<'idle'|'starting'|'recording'|'preview'>('idle');
  const [client,setClient]=useState(false),[panelOpen,setPanelOpen]=useState(false);
  const [video,setVideo]=useState<Blob|null>(null),[url,setUrl]=useState(''),[notice,setNotice]=useState(''),[seconds,setSeconds]=useState(0),[sending,setSending]=useState(false);
  const session=useRef<Awaited<ReturnType<typeof startScreenRecording>>|null>(null),mounted=useRef(true),starting=useRef(false);
  useEffect(()=>{mounted.current=true;setClient(true);return()=>{mounted.current=false;session.current?.dispose();};},[]);
  useEffect(()=>{if(!video){setUrl('');return;}const value=URL.createObjectURL(video);setUrl(value);return()=>URL.revokeObjectURL(value);},[video]);
  useEffect(()=>{if(phase!=='recording')return;const started=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[phase]);
  useEffect(()=>{if(phase==='idle')return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[phase]);
  async function start(){
    if(starting.current||phase!=='idle'||disabled)return;starting.current=true;setNotice('');setPanelOpen(true);setPhase('starting');setSeconds(0);
    try{const value=await startScreenRecording((blob,message)=>{if(!mounted.current)return;session.current=null;if(!blob.size){setNotice('No se generó video. Intenta grabar de nuevo.');setPhase('idle');return;}setVideo(blob);setNotice(message);setPanelOpen(true);setPhase('preview');});if(!mounted.current)value.dispose();else{session.current=value;setPhase('recording');}}
    catch(error){if(mounted.current){const name=(error as DOMException)?.name;setNotice(name==='NotAllowedError'?'No se autorizó la pantalla o el micrófono. Puedes intentarlo de nuevo.':name==='NotFoundError'?'No se encontró una pantalla o un micrófono disponible.':name==='NotReadableError'?'No se pudo acceder a la pantalla o al micrófono. Revisa los permisos del sistema.':error instanceof Error?error.message:'No se pudo iniciar la grabación.');setPhase('idle');}}
    finally{starting.current=false;}
  }
  async function send(){if(!video||sending)return;setSending(true);try{const file={filename:'Grabacion_ANFETA_'+new Date().toISOString().replace(/[:.]/g,'-')+(video.type.includes('mp4')?'.mp4':'.webm'),contentType:video.type,sizeBytes:video.size,blob:video,base64:'',dataUrl:''};if(await onReady(file)){setVideo(null);setPhase('idle');setNotice('');}}catch(error){setNotice(error instanceof Error?error.message:'No se pudo preparar la subida.');}finally{setSending(false);}}
  const overlay=phase!=='idle'&&panelOpen?<div id="anfeta-recording-controls" className="fixed bottom-28 right-5 z-[400] w-[min(440px,calc(100vw-32px))] max-h-[calc(100dvh-128px)] overflow-auto rounded-xl border border-cyan-800 bg-slate-950 p-4 text-xs text-slate-100 shadow-2xl" role="region" aria-label="Grabación de pantalla">
    <button type="button" aria-label="Ocultar controles; la grabación continúa" title="Ocultar controles" onClick={()=>setPanelOpen(false)} className="float-right ml-2 p-1 text-slate-300"><X size={16}/></button>
    <h2 className="font-bold text-cyan-200">{phase==='preview'?'Vista previa de la grabación':phase==='starting'?'Selecciona pantalla y autoriza el micrófono':'● Grabando pantalla y micrófono'}</h2>
    {phase==='recording'&&<><p role="status" className="my-2">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} · Máximo 20 minutos / 128 MB</p><button onClick={()=>session.current?.stop()} className="rounded bg-rose-700 px-3 py-2">Detener y revisar</button></>}
    {phase==='preview'&&<><video src={url} controls className="my-3 w-full max-h-[45dvh] rounded"/><p>{((video?.size||0)/1048576).toFixed(1)} MB · Pantalla con voz del micrófono</p><div className="mt-3 flex flex-wrap gap-3"><button disabled={sending} onClick={send} className="rounded bg-cyan-800 p-2">{sending?'Preparando…':'Subir a Notion / Dropbox'}</button><a href={url} download={'Grabacion_ANFETA'+(video?.type.includes('mp4')?'.mp4':'.webm')} className="p-2 underline">Descargar</a><button disabled={sending} onClick={()=>{setVideo(null);setNotice('');setPhase('idle');}}>Descartar</button></div></>}
    {notice&&<p role="status" className="mt-2 text-amber-200">{notice}</p>}
  </div>:null;
  const label=phase==='recording'?'Grabando: mostrar u ocultar controles':phase==='preview'?'Revisar grabación':phase==='starting'?'Preparando grabación':'Grabar pantalla y micrófono';
  return client?createPortal(<><button type="button" disabled={(disabled&&phase==='idle')||phase==='starting'} onClick={()=>phase==='idle'?void start():setPanelOpen(open=>!open)} aria-label={label} title={label} aria-expanded={phase!=='idle'&&panelOpen} aria-controls={phase!=='idle'&&panelOpen?'anfeta-recording-controls':undefined} className={`fixed bottom-12 right-6 z-[401] w-11 h-11 rounded-full border flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 ${phase==='recording'?'bg-rose-600 border-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.6)]':'bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] border-[#7DD3FC]/50 shadow-[0_0_15px_rgba(56,189,248,0.5)]'}`}>{phase==='recording'?<Square className="w-4 h-4 fill-current animate-pulse"/>:<Video className="w-5 h-5"/>}</button>{phase==='idle'&&notice&&<p role="status" className="fixed bottom-28 right-5 z-[400] max-w-sm rounded-lg bg-slate-950 p-3 text-xs text-amber-200">{notice}</p>}{overlay}</>,document.body):null;
}
