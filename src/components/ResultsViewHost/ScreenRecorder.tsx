"use client";
import {FloatingActionButton} from './FloatingActionButton';
import {revisionPhaseTitle} from '@/services/progressiveWorkflow';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Video,Square,X,ClipboardPaste,Trash2,ListPlus} from 'lucide-react';
import {startScreenRecording,recordingMime,RECORDING_MAX_BYTES} from '@/lib/screenRecording';
import type {GlobalPasteImagePayload} from './GlobalPasteModal';
import {RECORD_ACTIVITY_EVENT,recordingTarget,type RecordingTarget} from '@/lib/activityRecording';
import {playCheckChime,sendWindowsNotification} from '@/services/windowsIntegration';
import {anfetaSync} from '@/lib/anfetaBroadcastSync';

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
  { code: 'nne00', label: 'nne00 notion', person: 'Neftali' },
  { code: 'jjo00', label: 'jjo00 notion', person: 'John' },
  { code: 'kka00', label: 'kka00 notion', person: 'Karla' },
  { code: 'aan00', label: 'aan00 notion', person: 'Andrade' },
  { code: 'iis00', label: 'iis00 notion', person: 'Isaias' },
  { code: 'sso00', label: 'sso00 notion', person: 'Sotelo' },
] as const;

export function ScreenRecorder({onReady,onOpenDetailed,disabled=false}:{onOpenDetailed?:()=>void;onReady:(file:GlobalPasteImagePayload,target:RecordingTarget|null)=>Promise<boolean>;disabled?:boolean}){
  const clipboardSubmission=useRef(false);
  const [target,setTarget]=useState<RecordingTarget|null>(null),targetRef=useRef<RecordingTarget|null>(null);
  const [phase,setPhase]=useState<'idle'|'configure'|'starting'|'recording'|'preview'>('idle');
  const [microphone,setMicrophone]=useState(true),[bytes,setBytes]=useState(0);
  const startedAt=useRef(0),warned=useRef(false);
  const [client,setClient]=useState(false),[panelOpen,setPanelOpen]=useState(false);
  const [video,setVideo]=useState<Blob|null>(null),[url,setUrl]=useState(''),[notice,setNotice]=useState(''),[seconds,setSeconds]=useState(0),[sending,setSending]=useState(false);
  const [customDomain,setCustomDomain]=useState('');
  const [quickSavingCode,setQuickSavingCode]=useState<string|null>(null);
  const [clipboardOpen,setClipboardOpen]=useState(false);
  const [clipboardText,setClipboardText]=useState('');
  const [clipboardImage,setClipboardImage]=useState<{base64:string;preview:string;name:string}|null>(null);
  const [clipboardDomain,setClipboardDomain]=useState('');
  const [clipboardSavingCode,setClipboardSavingCode]=useState<string|null>(null);
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
            title:revisionPhaseTitle(title,'pending'),
            domain: cleanDom || undefined,
            person: dest.person,
            start,
            end,
            calendarEntryKind:'recording',
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
      if(data.activity)anfetaSync.broadcast({type:'ACTIVITY_CREATED',confirmed:true,activity:data.activity});
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

  async function openClipboardModal() {
    setClipboardOpen(true);
    setNotice('');
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().length > 0 && text.trim().length < 500 && !clipboardText) {
          setClipboardText(text.trim());
        }
      }
    } catch {}
  }

  function handleClipboardPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = String(reader.result || '');
            const base64 = res.includes(',') ? res.split(',')[1] : res;
            setClipboardImage({
              base64,
              preview: res,
              name: `Portapapeles_${Date.now()}.png`
            });
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
  }

  async function quickUploadClipboard(dest: typeof QUICK_NOTION_DESTINATIONS[number]) {
    if (sending || clipboardSavingCode || clipboardSubmission.current) return;
    clipboardSubmission.current=true;
    setClipboardSavingCode(dest.code);
    setNotice(`Subiendo directo a Notion para ${dest.person} (${dest.code})...`);
    try {
      const today = getMexicoToday();
      const start = `${today}T09:00:00-06:00`;
      const end = `${today}T10:00:00-06:00`;
      const cleanDom = clipboardDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      const domainTitlePart = cleanDom ? ` ${cleanDom}` : '';
      const taskText = clipboardText.trim() || 'Actividad rápida';
      const title = `prtuzREVISION ${dest.code}${domainTitlePart} ${taskText}`;

      const files = clipboardImage ? [{
        filename: clipboardImage.name,
        contentType: 'image/png',
        base64: clipboardImage.base64
      }] : undefined;

      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-activity',
          payload: {
            title:revisionPhaseTitle(title,'pending'),
            domain: cleanDom || undefined,
            person: dest.person,
            start,
            end,
            files
          }
        })
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'No se pudo guardar la actividad en Notion');
      }
      playCheckChime();
      sendWindowsNotification('Actividad guardada en Notion', `Se asignó a ${dest.person} (${dest.code}) a las 9:00 AM`);
      if(data.activity)anfetaSync.broadcast({type:'ACTIVITY_CREATED',confirmed:true,activity:data.activity});
      setNotice(`✅ Creada en Notion para ${dest.person} (${dest.code}) a las 9am`);
      setTimeout(() => {
        if (mounted.current) {
          setClipboardOpen(false);
          setClipboardText('');
          setClipboardImage(null);
          setClipboardDomain('');
          setNotice('');
        }
      }, 1500);
    } catch (err: any) {
      setNotice(err instanceof Error ? err.message : 'Error al subir a Notion');
    } finally {
      clipboardSubmission.current=false;
      if (mounted.current) setClipboardSavingCode(null);
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

  const clipboardOverlay = clipboardOpen ? (
    <div
      id="anfeta-clipboard-controls"
      className="fixed bottom-28 right-5 z-[400] w-[min(440px,calc(100vw-32px))] max-h-[calc(100dvh-128px)] overflow-auto rounded-xl border border-amber-500/70 bg-slate-950 p-4 text-xs text-slate-100 shadow-2xl"
      role="region"
      aria-label="Asignación rápida desde portapapeles"
      onPaste={handleClipboardPaste}
    >
      <button
        type="button"
        aria-label="Cerrar asignación rápida"
        title="Cerrar"
        onClick={() => setClipboardOpen(false)}
        className="float-right ml-2 p-1 text-slate-400 hover:text-white cursor-pointer"
      >
        <X size={16} />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <ClipboardPaste className="w-4 h-4 text-amber-400" />
        <h2 className="font-bold text-amber-300">Asignación rápida · Notion (9am hoy)</h2>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">
        Pega texto o captura con <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-200">Ctrl+V</kbd> o escribe la tarea.
      </p>

      {/* Tarea / descripción */}
      <textarea
        rows={3}
        value={clipboardText}
        onChange={(e) => setClipboardText(e.target.value)}
        placeholder="Descripción de la actividad o pega texto aquí con Ctrl+V..."
        disabled={!!clipboardSavingCode}
        className="w-full rounded bg-slate-900 border border-slate-700 p-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none mb-2 resize-none"
      />

      {/* Imagen pegada opcional */}
      {clipboardImage && (
        <div className="mb-2 relative rounded border border-slate-700 bg-slate-900 p-1.5 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={clipboardImage.preview} alt="Captura pegada" className="h-12 w-16 object-cover rounded" />
          <span className="text-[10px] text-slate-300 truncate flex-1">{clipboardImage.name}</span>
          <button
            type="button"
            onClick={() => setClipboardImage(null)}
            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
            title="Quitar imagen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Dominio opcional */}
      <div className="mb-2.5">
        <label className="block text-[10.5px] text-slate-400 mb-0.5">
          Dominio (opcional):
        </label>
        <input
          type="text"
          value={clipboardDomain}
          onChange={(e) => setClipboardDomain(e.target.value)}
          placeholder="Sin dominio o escribe (ej. novakid.com)"
          disabled={!!clipboardSavingCode}
          className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
        />
      </div>

      {/* Botones de destino en 1 clic */}
      <div className="space-y-1.5">
        <span className="block text-[10.5px] font-semibold text-amber-300">
          Asignar en 1 clic a Notion:
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK_NOTION_DESTINATIONS.map((dest) => (
            <button
              key={dest.code}
              type="button"
              disabled={!!clipboardSavingCode}
              onClick={() => void quickUploadClipboard(dest)}
              className={`rounded-lg border px-2 py-1.5 text-center font-mono text-[11px] font-semibold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 ${
                clipboardSavingCode === dest.code
                  ? 'bg-amber-600 border-amber-300 text-white animate-pulse'
                  : 'bg-[#1C1811] border-[#3E311B] hover:bg-[#2A2113] hover:border-[#F59E0B] text-[#FCD34D] hover:text-white'
              }`}
              title={`Asignar tarea en Notion para ${dest.person} a las 9am (${dest.code})`}
            >
              {clipboardSavingCode === dest.code ? 'Guardando...' : dest.label}
            </button>
          ))}
        </div>
      </div>

      {notice && <p role="status" className="mt-2 text-amber-200 font-medium">{notice}</p>}
    </div>
  ) : null;

  const label=phase==='recording'?'Grabando: mostrar u ocultar controles':phase==='preview'?'Revisar grabación':phase==='starting'?'Preparando grabación':'Grabar pantalla y micrófono';
  return client?createPortal(
    <>
      {onOpenDetailed&&<FloatingActionButton label="Asignación detallada · elegir destino y detalles" tone="cyan" className="bottom-24 right-20" disabled={disabled||!!clipboardSavingCode} onClick={()=>{if(clipboardSubmission.current)return;setClipboardOpen(false);onOpenDetailed();}}><ListPlus size={21}/></FloatingActionButton>}
      <FloatingActionButton label="Asignación rápida desde portapapeles" tone="amber" className="bottom-12 right-20" disabled={disabled} onClick={()=>(clipboardOpen?setClipboardOpen(false):void openClipboardModal())} aria-expanded={clipboardOpen}><ClipboardPaste size={21}/></FloatingActionButton>
      <FloatingActionButton label={label} tone={phase==='recording'?'rose':'sky'} className="bottom-12 right-6" disabled={(disabled&&phase==='idle')||phase==='starting'} onClick={()=>phase==='idle'?configure():setPanelOpen(open=>!open)} aria-expanded={phase!=='idle'&&panelOpen} aria-controls={phase!=='idle'&&panelOpen?'anfeta-recording-controls':undefined}>
        {phase==='recording'?<Square className="w-4 h-4 fill-current"/>:<Video size={21}/>}
      </FloatingActionButton>

      {phase==='idle'&&notice&&<p role="status" className="fixed bottom-28 right-5 z-[400] max-w-sm rounded-lg bg-slate-950 p-3 text-xs text-amber-200">{notice}</p>}
      {overlay}
      {clipboardOverlay}
    </>,
    document.body
  ):null;
}
