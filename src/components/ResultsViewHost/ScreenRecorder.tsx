"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Video,Square,X} from 'lucide-react';
import {startScreenRecording,recordingMime,RECORDING_MAX_BYTES} from '@/lib/screenRecording';
import type {GlobalPasteImagePayload} from './GlobalPasteModal';
import {RECORD_ACTIVITY_EVENT,recordingTarget,type RecordingTarget} from '@/lib/activityRecording';
import {playCheckChime,sendWindowsNotification} from '@/services/windowsIntegration';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getMexicoToday(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const QUICK_NOTION_DESTINATIONS = [
  { code: 'gge00', label: 'gge00 notion', person: 'Genaro' },
  { code: 'nne00', label: 'nne00 Notion', person: 'Neftali' },
  { code: 'jjo00', label: 'jjo00', person: 'John' },
  { code: 'kka00', label: 'kka00', person: 'Karla' },
  { code: 'aan00', label: 'aan00', person: 'Andrade' },
  { code: 'iis00', label: 'iis00', person: 'Isaias' },
] as const;

export function ScreenRecorder({onReady,disabled=false}:{onReady:(file:GlobalPasteImagePayload,target:RecordingTarget|null)=>Promise<boolean>;disabled?:boolean}){
  const [target,setTarget]=useState<RecordingTarget|null>(null),targetRef=useRef<RecordingTarget|null>(null);
  const [phase,setPhase]=useState<'idle'|'configure'|'starting'|'recording'|'preview'>('idle');
  const [microphone,setMicrophone]=useState(true),[bytes,setBytes]=useState(0);
  const startedAt=useRef(0),warned=useRef(false);
  const [client,setClient]=useState(false),[panelOpen,setPanelOpen]=useState(false);
  const [video,setVideo]=useState<Blob|null>(null),[url,setUrl]=useState(''),[notice,setNotice]=useState(''),[seconds,setSeconds]=useState(0),[sending,setSending]=useState(false);
  const [customDomain,setCustomDomain]=useState('');
  const [quickSavingCode,setQuickSavingCode]=useState<string|null>(null);
  const session=useRef<Awaited<ReturnType<typeof startScreenRecording>>|null>(null),mounted=useRef(true),starting=useRef(false);

  useEffect(()=>{mounted.current=true;setClient(true);return()=>{mounted.current=false;session.current?.dispose();};},[]);
  useEffect(()=>{if(!video){setUrl('');return;}const value=URL.createObjectURL(video);setUrl(value);return()=>URL.revokeObjectURL(value);},[video]);
  useEffect(()=>{if(phase!=='recording')return;const started=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[phase]);
  useEffect(()=>{if(phase==='recording'&&!warned.current&&(seconds>=540||bytes>=RECORDING_MAX_BYTES*.9)){warned.current=true;setPanelOpen(true);}},[phase,seconds,bytes]);
  useEffect(()=>{if(phase==='idle')return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[phase]);

  function configure(destination:RecordingTarget|null=null){targetRef.current=destination?{...destination}:null;setTarget(targetRef.current);setNotice('');setPanelOpen(true);setPhase('configure');}

  useEffect(()=>{const begin=(event:Event)=>{const requested=recordingTarget((event as CustomEvent).detail);if(!requested)return;event.preventDefault();if(phase!=='idle'||starting.current){setPanelOpen(true);setNotice('Ya hay una grabación en curso o pendiente. Termínala antes de iniciar otra.');return;}if(disabled){setNotice('Cierra el panel de subida antes de iniciar otra grabación.');return;}configure(requested);};window.addEventListener(RECORD_ACTIVITY_EVENT,begin);return()=>window.removeEventListener(RECORD_ACTIVITY_EVENT,begin);},[phase,disabled]);

  async function start(destination:RecordingTarget|null=null){
    if(starting.current||phase!=='configure'||disabled)return;starting.current=true;targetRef.current=destination?{...destination}:null;setTarget(targetRef.current);setNotice('');setPanelOpen(true);setPhase('starting');setSeconds(0);setBytes(0);warned.current=false;
    try{const value=await startScreenRecording((blob,message)=>{if(!mounted.current)return;session.current=null;setSeconds(Math.round((Date.now()-startedAt.current)/1000));if(!blob.size){setNotice('No se generó video. Intenta grabar de nuevo.');setPhase('idle');return;}setVideo(blob);setNotice(message);setPanelOpen(true);setPhase('preview');},{microphone,onProgress:value=>{if(mounted.current)setBytes(value);}});if(!mounted.current)value.dispose();else{startedAt.current=Date.now();session.current=value;setPhase('recording');}}
    catch(error){if(mounted.current){const name=(error as DOMException)?.name;setNotice(name==='NotAllowedError'?'No se autorizó la pantalla o el micrófono. Puedes intentarlo de nuevo.':name==='NotFoundError'?'No se encontró una pantalla o un micrófono disponible.':name==='NotReadableError'?'No se pudo acceder a la pantalla o al micrófono. Revisa los permisos del sistema.':error instanceof Error?error.message:'No se pudo iniciar la grabación.');setPhase('idle');}}
    finally{starting.current=false;}
  }

  async function send(){
    if(!video||sending||quickSavingCode)return;
    if(video.size>RECORDING_MAX_BYTES){setNotice('El video supera 128 MB. Descárgalo para reducirlo antes de subir.');return;}
    setSending(true);
    try{
      const file={filename:'Grabacion_ANFETA_'+new Date().toISOString().replace(/[:.]/g,'-')+(video.type.includes('mp4')?'.mp4':'.webm'),contentType:video.type,sizeBytes:video.size,blob:video,base64:'',dataUrl:''};
      if(await onReady(file,targetRef.current)){
        setVideo(null);setPhase('idle');setNotice('');setCustomDomain('');
      }
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo preparar la subida.');}
    finally{setSending(false);}
  }

  async function quickUploadDirectNotion(dest: typeof QUICK_NOTION_DESTINATIONS[number]) {
    if (!video || sending || quickSavingCode) return;
    if (video.size > RECORDING_MAX_BYTES) {
      setNotice('El video supera 128 MB. Descárgalo para reducirlo antes de subir.');
      return;
    }
    setQuickSavingCode(dest.code);
    setNotice(`Subiendo directo a Notion para ${dest.person} (${dest.code})...`);
    try {
      const base64 = await blobToBase64(video);
      const today = getMexicoToday();
      const start = `${today}T09:00:00-06:00`;
      const end = `${today}T10:00:00-06:00`;
      const cleanDom = customDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      const domainTitlePart = cleanDom ? ` ${cleanDom}` : '';
      const title = `prtuzREVISION ${dest.code}${domainTitlePart} Grabación ${today} 09:00`;

      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-activity',
          payload: {
            title,
            domain: cleanDom || undefined,
            person: dest.person,
            start,
            end,
            files: [{
              filename: `Grabacion_${dest.code}_${today}_${Date.now()}.webm`,
              contentType: video.type || 'video/webm',
              base64
            }]
          }
        })
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'No se pudo guardar la actividad en Notion');
      }
      playCheckChime();
      sendWindowsNotification('Grabación guardada en Notion', `Se asignó a ${dest.person} (${dest.code}) a las 9:00 AM`);
      window.dispatchEvent(new CustomEvent('anfeta_data_refreshed'));
      window.dispatchEvent(new CustomEvent('anfeta_calendar_refresh'));
      setNotice(`✅ Actividad creada en Notion con éxito para ${dest.person} (${dest.code}) a las 9am`);
      setTimeout(() => {
        if (mounted.current) {
          setVideo(null);
          setPhase('idle');
          setNotice('');
          setCustomDomain('');
        }
      }, 1500);
    } catch (err: any) {
      setNotice(err instanceof Error ? err.message : 'Error al subir a Notion');
    } finally {
      if (mounted.current) setQuickSavingCode(null);
    }
  }

  const preferred=client&&typeof MediaRecorder!=='undefined'?recordingMime(MediaRecorder,microphone):'';
  const overlay=phase!=='idle'&&panelOpen?<div id="anfeta-recording-controls" className="fixed bottom-28 right-5 z-[400] w-[min(440px,calc(100vw-32px))] max-h-[calc(100dvh-128px)] overflow-auto rounded-xl border border-cyan-800 bg-slate-950 p-4 text-xs text-slate-100 shadow-2xl" role="region" aria-label="Grabación de pantalla">
    <button type="button" aria-label="Ocultar controles; la grabación continúa" title="Ocultar controles" onClick={()=>setPanelOpen(false)} className="float-right ml-2 p-1 text-slate-300"><X size={16}/></button>
    <h2 className="font-bold text-cyan-200">{phase==='configure'?'Preparar grabación':phase==='preview'?'Vista previa de la grabación':phase==='starting'?'Selecciona qué compartir':'● Grabando pantalla'+(microphone?' y micrófono':'')}</h2>
    {phase==='configure'&&<div className="my-3 space-y-3"><p>El navegador te permitirá elegir pantalla, ventana o pestaña según su compatibilidad. Máximo 10 minutos / 128 MB.</p><label className="flex gap-2"><input type="checkbox" checked={microphone} onChange={e=>setMicrophone(e.target.checked)}/>Incluir micrófono</label><p className="text-xs text-slate-400">Grabación WebM fluida con audio. En Notion se incrustará el reproductor interactivo y se conservará el archivo descargable.</p><button type="button" disabled={disabled} onClick={()=>void start(targetRef.current)} className="rounded bg-cyan-800 p-2">Elegir pantalla e iniciar</button><button type="button" onClick={()=>setPhase('idle')} className="ml-3">Cancelar</button></div>}
    {target&&<p className="mt-2 break-words text-cyan-100 font-medium">{phase==='preview'?'Destino vinculado: ':'Grabando para: '}{target.title}</p>}
    {phase==='recording'&&<><p role="status" className="my-2">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} · {(bytes/1048576).toFixed(1)} MB · Máximo 10 minutos / 128 MB</p>{(seconds>=540||bytes>=RECORDING_MAX_BYTES*.9)&&<p role="status" className="my-2 text-amber-200">Cerca del límite. La grabación se detendrá automáticamente; podrás revisarla.</p>}<button onClick={()=>session.current?.stop()} className="rounded bg-rose-700 px-3 py-2">Detener y revisar</button></>}
    {phase==='preview'&&<>
      <video src={url} controls className="my-3 w-full max-h-[45dvh] rounded"/>
      <p className="text-[11px] text-slate-300">
        {((video?.size||0)/1048576).toFixed(1)} MB · {video?.type.includes('mp4')?'MP4':'WebM'} · {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} · {microphone?'Con micrófono':'Sin micrófono'}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2 items-center">
        <button disabled={sending||!!quickSavingCode||!video||video.size>RECORDING_MAX_BYTES} onClick={send} className="rounded bg-cyan-800 hover:bg-cyan-700 px-3 py-1.5 font-medium transition-colors cursor-pointer text-xs disabled:opacity-50">
          {sending?'Preparando…':'Subir a Notion / Dropbox'}
        </button>
        <a href={url} download={'Grabacion_ANFETA'+(video?.type.includes('mp4')?'.mp4':'.webm')} className="px-2 py-1 underline text-slate-300 hover:text-white">
          Descargar
        </a>
        <button disabled={sending||!!quickSavingCode} onClick={()=>{setVideo(null);setNotice('');setPhase('idle');setCustomDomain('');}} className="px-2 py-1 text-slate-400 hover:text-rose-300 cursor-pointer">
          Descartar
        </button>
      </div>

      {/* Campo opcional de dominio */}
      <div className="mt-3 pt-2.5 border-t border-slate-800">
        <label className="block text-[11px] text-slate-400 mb-1">
          Dominio (opcional):
        </label>
        <input
          type="text"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="Sin dominio o escribe un dominio (ej. novakid.com)"
          disabled={sending || !!quickSavingCode}
          className="w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
      </div>

      {/* Botones rápidos: Guardado directo en Notion 9am */}
      <div className="mt-2.5 space-y-1.5">
        <span className="block text-[10.5px] font-semibold text-cyan-300">
          Guardar directo en Notion (9am hoy · prioridad 00):
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK_NOTION_DESTINATIONS.map((dest) => (
            <button
              key={dest.code}
              type="button"
              disabled={sending || !!quickSavingCode || !video || video.size > RECORDING_MAX_BYTES}
              onClick={() => void quickUploadDirectNotion(dest)}
              className={`rounded-lg border px-2 py-2 text-center font-mono text-[11px] font-semibold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 ${
                quickSavingCode === dest.code
                  ? 'bg-cyan-700 border-cyan-400 text-white animate-pulse'
                  : 'bg-[#131F2E] border-[#263A50] hover:bg-[#1A2C42] hover:border-[#38BDF8] text-[#93C5FD] hover:text-white'
              }`}
              title={`Crear actividad en Notion con video adjunto para ${dest.person} a las 9am (${dest.code})`}
            >
              {quickSavingCode === dest.code ? 'Subiendo...' : dest.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[10px] text-amber-200/80 leading-snug">
        Este navegador generó WebM. En Notion se incrustará el reproductor y se conservará como archivo descargable.
      </p>
    </>}
    {notice&&<p role="status" className="mt-2 text-amber-200 font-medium">{notice}</p>}
  </div>:null;

  const label=phase==='recording'?'Grabando: mostrar u ocultar controles':phase==='preview'?'Revisar grabación':phase==='starting'?'Preparando grabación':'Grabar pantalla y micrófono';
  return client?createPortal(<><button type="button" disabled={(disabled&&phase==='idle')||phase==='starting'} onClick={()=>phase==='idle'?configure():setPanelOpen(open=>!open)} aria-label={label} title={label} aria-expanded={phase!=='idle'&&panelOpen} aria-controls={phase!=='idle'&&panelOpen?'anfeta-recording-controls':undefined} className={`fixed bottom-12 right-6 z-[401] w-11 h-11 rounded-full border flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 ${phase==='recording'?'bg-rose-600 border-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.6)]':'bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] border-[#7DD3FC]/50 shadow-[0_0_15px_rgba(56,189,248,0.5)]'}`}>{phase==='recording'?<Square className="w-4 h-4 fill-current animate-pulse"/>:<Video className="w-5 h-5"/>}</button>{phase==='idle'&&notice&&<p role="status" className="fixed bottom-28 right-5 z-[400] max-w-sm rounded-lg bg-slate-950 p-3 text-xs text-amber-200">{notice}</p>}{overlay}</>,document.body):null;
}
