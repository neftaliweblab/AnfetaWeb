"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {startScreenRecording} from '@/lib/screenRecording';
import type {GlobalPasteImagePayload} from './GlobalPasteModal';

export function ScreenRecorder({onReady,disabled=false}:{onReady:(file:GlobalPasteImagePayload)=>Promise<boolean>;disabled?:boolean}){
  const [phase,setPhase]=useState<'idle'|'starting'|'recording'|'preview'>('idle');
  const [video,setVideo]=useState<Blob|null>(null),[url,setUrl]=useState(''),[notice,setNotice]=useState(''),[seconds,setSeconds]=useState(0),[sending,setSending]=useState(false);
  const session=useRef<Awaited<ReturnType<typeof startScreenRecording>>|null>(null),mounted=useRef(true),starting=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;session.current?.dispose();};},[]);
  useEffect(()=>{if(!video){setUrl('');return;}const value=URL.createObjectURL(video);setUrl(value);return()=>URL.revokeObjectURL(value);},[video]);
  useEffect(()=>{if(phase!=='recording')return;const started=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[phase]);
  useEffect(()=>{if(phase==='idle')return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[phase]);
  async function start(){
    if(starting.current||phase!=='idle'||disabled)return;starting.current=true;setNotice('');setPhase('starting');setSeconds(0);
    try{const value=await startScreenRecording((blob,message)=>{if(!mounted.current)return;session.current=null;if(!blob.size){setNotice('No se generó video. Intenta grabar de nuevo.');setPhase('idle');return;}setVideo(blob);setNotice(message);setPhase('preview');});if(!mounted.current)value.dispose();else{session.current=value;setPhase('recording');}}
    catch(error){if(mounted.current){const name=(error as DOMException)?.name;setNotice(name==='NotAllowedError'?'No se autorizó la pantalla o el micrófono. Puedes intentarlo de nuevo.':name==='NotFoundError'?'No se encontró una pantalla o un micrófono disponible.':name==='NotReadableError'?'No se pudo acceder a la pantalla o al micrófono. Revisa los permisos del sistema.':error instanceof Error?error.message:'No se pudo iniciar la grabación.');setPhase('idle');}}
    finally{starting.current=false;}
  }
  async function send(){if(!video||sending)return;setSending(true);try{const file={filename:'Grabacion_ANFETA_'+new Date().toISOString().replace(/[:.]/g,'-')+(video.type.includes('mp4')?'.mp4':'.webm'),contentType:video.type,sizeBytes:video.size,blob:video,base64:'',dataUrl:''};if(await onReady(file)){setVideo(null);setPhase('idle');setNotice('');}}catch(error){setNotice(error instanceof Error?error.message:'No se pudo preparar la subida.');}finally{setSending(false);}}
  const overlay=phase!=='idle'&&typeof document!=='undefined'?createPortal(<div className="fixed bottom-5 right-5 z-[400] w-[min(440px,calc(100vw-32px))] max-h-[90dvh] overflow-auto rounded-xl border border-cyan-800 bg-slate-950 p-4 text-xs text-slate-100 shadow-2xl" role="region" aria-label="Grabación de pantalla">
    <h2 className="font-bold text-cyan-200">{phase==='preview'?'Vista previa de la grabación':phase==='starting'?'Selecciona pantalla y autoriza el micrófono':'● Grabando pantalla y micrófono'}</h2>
    {phase==='recording'&&<><p role="status" className="my-2">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} · Máximo 20 minutos / 128 MB</p><button onClick={()=>session.current?.stop()} className="rounded bg-rose-700 px-3 py-2">Detener y revisar</button></>}
    {phase==='preview'&&<><video src={url} controls className="my-3 w-full max-h-[45dvh] rounded"/><p>{((video?.size||0)/1048576).toFixed(1)} MB · Pantalla con voz del micrófono</p><div className="mt-3 flex flex-wrap gap-3"><button disabled={sending} onClick={send} className="rounded bg-cyan-800 p-2">{sending?'Preparando…':'Subir a Notion / Dropbox'}</button><a href={url} download={'Grabacion_ANFETA'+(video?.type.includes('mp4')?'.mp4':'.webm')} className="p-2 underline">Descargar</a><button disabled={sending} onClick={()=>{setVideo(null);setNotice('');setPhase('idle');}}>Descartar</button></div></>}
    {notice&&<p role="status" className="mt-2 text-amber-200">{notice}</p>}
  </div>,document.body):null;
  return <><button disabled={disabled||phase!=='idle'} onClick={start} className="rounded border border-rose-800 bg-rose-950/40 px-3 py-1 text-xs text-rose-200 disabled:opacity-50" title="Grabar pantalla o ventana con micrófono">● Grabar pantalla + micrófono</button>{phase==='idle'&&notice&&<span role="status" className="text-xs text-amber-200">{notice}</span>}{overlay}</>;
}
