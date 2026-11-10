"use client";
import {fetchWithScheduleChoice} from '@/lib/scheduleChoice';
import {FloatingActionButton} from './FloatingActionButton';
import {revisionPhaseTitle} from '@/services/progressiveWorkflow';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Video,Square,X,ClipboardPaste,Trash2,ListPlus} from 'lucide-react';
import {startScreenRecording,recordingMime,RECORDING_MAX_BYTES} from '@/lib/screenRecording';
import type {GlobalPasteImagePayload} from './GlobalPasteModal';
import {RECORD_ACTIVITY_EVENT,recordingTarget,type RecordingTarget} from '@/lib/activityRecording';
import {playCheckChime,sendWindowsNotification} from '@/services/windowsIntegration';
import {blobToBase64} from '@/lib/blobBase64';
import {ACTIVITY_TAGS, activePersonTag, pendingReviewTag, type ActivityPerson, type ActivityPriority} from '@/services/activityTags';
import {anfetaSync} from '@/lib/anfetaBroadcastSync';
import {showCreationResult} from '@/components/CreationFeedback';

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

export const TEAM_MEMBERS: ActivityPerson[] = [
  'Neftali',
  'John',
  'Genaro',
  'Karla',
  'Edwin',
  'Acalli',
  'Isaias',
  'Brian',
  'Andrade',
  'Sotelo',
];

export const PRIORITIES: { value: ActivityPriority; label: string; tagSuffix: string }[] = [
  { value: '00', label: '00 · Urgente', tagSuffix: '00' },
  { value: '11', label: '11 · Primaria', tagSuffix: '11' },
  { value: '22', label: '22 · Secundaria', tagSuffix: '22' },
  { value: '33', label: '33 · Usar/practicar', tagSuffix: '33' },
];

export const REVIEWERS = [
  { person: '', label: 'Sin revisor técnico' },
  ...TEAM_MEMBERS.map(m => ({
    person: m,
    label: `${m} (${ACTIVITY_TAGS[m].active}000)`
  }))
];

export function buildQuickTitle(
  desc: string,
  domain: string,
  person: ActivityPerson,
  priority: ActivityPriority,
  reviewer: string
): string {
  const cleanDom = (domain || '').trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  const domPart = cleanDom ? (cleanDom.startsWith('d.') || cleanDom.startsWith('p.') ? cleanDom : `d.${cleanDom}`) : '';
  const taskPart = (desc || '').trim() || 'Actividad rápida';
  const personTag = activePersonTag(person, priority);
  const reviewerTag = reviewer ? pendingReviewTag(reviewer) : '';

  const parts = [
    domPart,
    taskPart,
    personTag,
    reviewerTag
  ].filter(Boolean);

  const rawTitle = parts.join(' ');
  return revisionPhaseTitle(rawTitle, 'pending').replace(/\s{2,}/g, ' ').trim();
}

export const QUICK_NOTION_DESTINATIONS = Object.entries(ACTIVITY_TAGS).map(([person, entry]) => ({
  person, code: entry.active + '00', label: entry.active + '00 notion',
}));
export type RecordingUploadOptions = {person?: string; domain?: string; attach?: boolean};
const DIRECT_NOTION_MAX_BYTES = 2500000;

export function ScreenRecorder({onReady,onOpenDetailed,disabled=false}:{onOpenDetailed?:()=>void;onReady:(file:GlobalPasteImagePayload,target:RecordingTarget|null,options?:RecordingUploadOptions)=>Promise<boolean>;disabled?:boolean}){
  const clipboardSubmission=useRef(false);
  const recordingSubmission=useRef(false);
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

  // Controles modulares (John Nov 10): Responsable, Prioridad, Revisor y Vista previa editable
  const [targetPerson, setTargetPerson] = useState<ActivityPerson>('Neftali');
  const [targetPriority, setTargetPriority] = useState<ActivityPriority>('11');
  const [targetReviewer, setTargetReviewer] = useState<string>('');

  const [clipboardCustomTitle, setClipboardCustomTitle] = useState('');
  const [isClipboardTitleEdited, setIsClipboardTitleEdited] = useState(false);

  const [recordingCustomTitle, setRecordingCustomTitle] = useState('');
  const [isRecordingTitleEdited, setIsRecordingTitleEdited] = useState(false);

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

  async function send(attach=false){
    if(!video||sending||quickSavingCode)return;
    if(video.size>RECORDING_MAX_BYTES){setNotice('El video supera 128 MB. Descárgalo para reducirlo antes de subir.');return;}
    setSending(true);
    try{
      const file={filename:'Grabacion_ANFETA_'+new Date().toISOString().replace(/[:.]/g,'-')+(video.type.includes('mp4')?'.mp4':'.webm'),contentType:video.type,sizeBytes:video.size,blob:video,base64:'',dataUrl:''};
      if(await onReady(file,targetRef.current,{domain:customDomain,attach})){
        setVideo(null);setPhase('idle');setNotice('');setCustomDomain('');
      }
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo preparar la subida.');}
    finally{setSending(false);}
  }

  async function quickUploadDirectNotion() {
    if (!video || sending || quickSavingCode || recordingSubmission.current) return;
    if (video.size > RECORDING_MAX_BYTES) {
      setNotice('El video supera 128 MB. Descárgalo para reducirlo antes de subir.');
      return;
    }
    const destCode = activePersonTag(targetPerson, targetPriority);
    recordingSubmission.current=true;
    setQuickSavingCode(destCode);
    setNotice(`Subiendo directo a Notion para ${targetPerson} (${destCode})...`);
    try {
      const cleanDom = customDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      if (video.size > DIRECT_NOTION_MAX_BYTES) {
        // Large base64 bodies exceed Vercel's request limit. Hand off before reading the blob.
        const file={filename:'Grabacion_'+destCode+(video.type.includes('mp4')?'.mp4':'.webm'),contentType:video.type,sizeBytes:video.size,blob:video,base64:'',dataUrl:''};
        if (await onReady(file,targetRef.current,{person:targetPerson,domain:customDomain})) {
          setVideo(null);setPhase('idle');setNotice('');setCustomDomain('');
          setRecordingCustomTitle('');setIsRecordingTitleEdited(false);
        }
        return;
      }
      const base64 = await blobToBase64(video);
      const today = getMexicoToday();
      const start = `${today}T09:00:00-06:00`;
      const end = `${today}T10:00:00-06:00`;
      
      const autoTitle = buildQuickTitle(`Grabación ${today} 09:00`, customDomain, targetPerson, targetPriority, targetReviewer);
      const title = isRecordingTitleEdited && recordingCustomTitle.trim() ? recordingCustomTitle.trim() : autoTitle;

      const response = await fetchWithScheduleChoice('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-activity',
          payload: {
            title:revisionPhaseTitle(title,'pending'),
            domain: cleanDom || undefined,
            person: targetPerson,
            start,
            end,
            calendarEntryKind:'recording',
            files: [{
              filename: `Grabacion_${destCode}_${today}_${Date.now()}${video.type.includes('mp4')?'.mp4':'.webm'}`,
              contentType: video.type || 'video/webm',
              base64
            }]
          }
        })
      });
      const data = await response.json();
      if (!response.ok || data.error || data.success !== true || !data.pageId) {
        throw new Error(data.error || 'No se confirmó el guardado. Tu grabación se conserva; verifica Notion antes de repetir.');
      }
      playCheckChime();
      sendWindowsNotification('Grabación guardada en Notion', `Se asignó a ${targetPerson} (${destCode}) en el horario confirmado`);
      if(data.activity)anfetaSync.broadcast({type:'ACTIVITY_CREATED',confirmed:true,activity:data.activity});
      
      showCreationResult(true, `Grabación asignada a ${targetPerson}`, title, data.activity?.pageUrl, data.pageId);
      setNotice(`✅ Actividad creada en Notion con éxito para ${targetPerson} (${destCode})`);
      setVideo(null);setPhase('idle');setCustomDomain('');
      setRecordingCustomTitle('');setIsRecordingTitleEdited(false);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Error al subir a Notion';
      setNotice(msg);
      showCreationResult(false, 'Error al subir grabación', msg);
    } finally {
      recordingSubmission.current=false;
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

  async function quickUploadClipboard() {
    if (sending || clipboardSavingCode || clipboardSubmission.current) return;
    clipboardSubmission.current=true;
    const destCode = activePersonTag(targetPerson, targetPriority);
    setClipboardSavingCode(destCode);
    setNotice(`Subiendo directo a Notion para ${targetPerson} (${destCode})...`);
    try {
      const today = getMexicoToday();
      const start = `${today}T09:00:00-06:00`;
      const end = `${today}T10:00:00-06:00`;
      const cleanDom = clipboardDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      const autoTitle = buildQuickTitle(clipboardText, clipboardDomain, targetPerson, targetPriority, targetReviewer);
      const title = isClipboardTitleEdited && clipboardCustomTitle.trim() ? clipboardCustomTitle.trim() : autoTitle;

      const files = clipboardImage ? [{
        filename: clipboardImage.name,
        contentType: 'image/png',
        base64: clipboardImage.base64
      }] : undefined;

      const response = await fetchWithScheduleChoice('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-activity',
          payload: {
            title:revisionPhaseTitle(title,'pending'),
            domain: cleanDom || undefined,
            person: targetPerson,
            start,
            end,
            files
          }
        })
      });
      const data = await response.json();
      if (!response.ok || data.error || data.success !== true || !data.pageId) {
        throw new Error(data.error || 'No se pudo guardar la actividad en Notion');
      }
      playCheckChime();
      sendWindowsNotification('Actividad guardada en Notion', `Se asignó a ${targetPerson} (${destCode}) en el horario confirmado`);
      if(data.activity)anfetaSync.broadcast({type:'ACTIVITY_CREATED',confirmed:true,activity:data.activity});
      
      showCreationResult(true, `Actividad creada para ${targetPerson}`, title, data.activity?.pageUrl, data.pageId);
      setNotice(`✅ Creada en Notion para ${targetPerson} (${destCode}) en el horario confirmado`);
      setTimeout(() => {
        if (mounted.current) {
          setClipboardOpen(false);
          setClipboardText('');
          setClipboardImage(null);
          setClipboardDomain('');
          setClipboardCustomTitle('');
          setIsClipboardTitleEdited(false);
          setNotice('');
        }
      }, 1200);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Error al subir a Notion';
      setNotice(msg);
      showCreationResult(false, 'Error al subir a Notion', msg);
    } finally {
      clipboardSubmission.current=false;
      if (mounted.current) setClipboardSavingCode(null);
    }
  }

  const preferred=client&&typeof MediaRecorder!=='undefined'?recordingMime(MediaRecorder,microphone):'';
  const overlay=phase!=='idle'&&panelOpen?<div id="anfeta-recording-controls" className="fixed bottom-28 right-5 z-[400] w-[min(460px,calc(100vw-32px))] max-h-[calc(100dvh-128px)] overflow-auto rounded-xl border border-cyan-800 bg-slate-950 p-4 text-xs text-slate-100 shadow-2xl" role="region" aria-label="Grabación de pantalla">
    <button type="button" aria-label="Ocultar controles; la grabación continúa" title="Ocultar controles" onClick={()=>setPanelOpen(false)} className="float-right ml-2 p-1 text-slate-300"><X size={16}/></button>
    <h2 className="font-bold text-cyan-200">{phase==='configure'?'Preparar grabación':phase==='preview'?'Vista previa de la grabación':phase==='starting'?'Selecciona qué compartir':'● Grabando pantalla'+(microphone?' y micrófono':'')}</h2>
    {phase==='configure'&&<div className="my-3 space-y-3"><p>El navegador te permitirá elegir pantalla, ventana o pestaña según su compatibilidad. Máximo 10 minutos / 128 MB.</p><label className="flex gap-2"><input type="checkbox" checked={microphone} onChange={e=>setMicrophone(e.target.checked)}/>Incluir micrófono</label><p className="text-xs text-slate-400">Grabación WebM fluida con audio. En Notion se incrustará el reproductor interactivo y se conservará el archivo descargable.</p><button type="button" disabled={disabled} onClick={()=>void start(targetRef.current)} className="rounded bg-cyan-800 p-2">Elegir pantalla e iniciar</button><button type="button" onClick={()=>setPhase('idle')} className="ml-3">Cancelar</button></div>}
    {target&&<p className="mt-2 break-words text-cyan-100 font-medium">{phase==='preview'?'Destino vinculado: ':'Grabando para: '}{target.title}</p>}
    {phase==='recording'&&<><p role="status" className="my-2">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} · {(bytes/1048576).toFixed(1)} MB · Máximo 10 minutos / 128 MB</p>{(seconds>=540||bytes>=RECORDING_MAX_BYTES*.9)&&<p role="status" className="my-2 text-amber-200">Cerca del límite. La grabación se detendrá automáticamente; podrás revisarla.</p>}<button onClick={()=>session.current?.stop()} className="rounded bg-rose-700 px-3 py-2">Detener y revisar</button></>}
    {phase==='preview'&&<>
      {!!video&&video.size>DIRECT_NOTION_MAX_BYTES&&<p className="rounded border border-amber-700 p-2 text-xs text-amber-200">Video mayor de 2.5 MB: elige un responsable para abrir la subida por fragmentos. Revisa Notion + Dropbox antes de confirmar; Solo Notion admite hasta 2.5 MB.</p>}
      <video src={url} controls className="my-3 w-full max-h-[45dvh] rounded"/>
      <p className="text-[11px] text-slate-300">
        {((video?.size||0)/1048576).toFixed(1)} MB · {video?.type.includes('mp4')?'MP4':'WebM'} · {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} · {microphone?'Con micrófono':'Sin micrófono'}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2 items-center">
        <button disabled={sending||!!quickSavingCode||!video||video.size>RECORDING_MAX_BYTES} onClick={()=>void send()} className="rounded bg-cyan-800 hover:bg-cyan-700 px-3 py-1.5 font-medium transition-colors cursor-pointer text-xs disabled:opacity-50">
          {sending?'Preparando…':'Subir a Notion / Dropbox'}
        </button>
        <button disabled={sending||!!quickSavingCode} onClick={()=>void send(true)} className="rounded border border-cyan-700 px-3 py-1.5 text-xs text-cyan-200">Adjuntar a actividad existente</button>
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

      {/* Asignación rápida modular en Notion (John Nov 10) */}
      {!target && (
        <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-2.5">
          <span className="block text-[11px] font-semibold text-cyan-300">
            {video && video.size > DIRECT_NOTION_MAX_BYTES
              ? 'Preparar subida por fragmentos (confirma datos):'
              : 'Asignación rápida en Notion (9am hoy):'}
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10.5px] font-medium text-cyan-300 mb-1">
                Responsable:
              </label>
              <select
                value={targetPerson}
                onChange={(e) => setTargetPerson(e.target.value as ActivityPerson)}
                disabled={sending || !!quickSavingCode}
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
              >
                {TEAM_MEMBERS.map((p) => (
                  <option key={p} value={p}>
                    {p} ({ACTIVITY_TAGS[p].active})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] font-medium text-cyan-300 mb-1">
                Revisor técnico:
              </label>
              <select
                value={targetReviewer}
                onChange={(e) => setTargetReviewer(e.target.value)}
                disabled={sending || !!quickSavingCode}
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
              >
                {REVIEWERS.map((r) => (
                  <option key={r.label} value={r.person}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-medium text-cyan-300 mb-1">
              Prioridad:
            </label>
            <div className="grid grid-cols-4 gap-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  disabled={sending || !!quickSavingCode}
                  onClick={() => setTargetPriority(p.value)}
                  className={`rounded px-1.5 py-1 text-center font-mono text-[10.5px] font-semibold transition-all cursor-pointer ${
                    targetPriority === p.value
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-500/50'
                  }`}
                  title={p.label}
                >
                  {p.value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-medium text-cyan-300">
                Título técnico final en Notion:
              </label>
              {isRecordingTitleEdited && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRecordingTitleEdited(false);
                    setRecordingCustomTitle('');
                  }}
                  className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                >
                  ↺ Restablecer
                </button>
              )}
            </div>
            <input
              type="text"
              value={
                isRecordingTitleEdited
                  ? recordingCustomTitle
                  : buildQuickTitle(
                      `Grabación ${getMexicoToday()} 09:00`,
                      customDomain,
                      targetPerson,
                      targetPriority,
                      targetReviewer
                    )
              }
              onChange={(e) => {
                setIsRecordingTitleEdited(true);
                setRecordingCustomTitle(e.target.value);
              }}
              disabled={sending || !!quickSavingCode}
              className="w-full rounded bg-slate-950 border border-cyan-600/60 p-2 text-xs text-cyan-100 font-mono focus:border-cyan-400 focus:outline-none"
              placeholder="Título estructurado..."
            />
          </div>

          <button
            type="button"
            disabled={sending || !!quickSavingCode || !video || video.size > RECORDING_MAX_BYTES}
            onClick={() => void quickUploadDirectNotion()}
            className={`w-full rounded-lg px-3 py-2 text-center font-semibold text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
              quickSavingCode
                ? 'bg-cyan-700 text-cyan-100 cursor-wait'
                : 'bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white active:scale-[0.99]'
            }`}
          >
            {quickSavingCode ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>
                  {video && video.size > DIRECT_NOTION_MAX_BYTES ? 'Preparando fragmentos...' : 'Guardando en Notion...'}
                </span>
              </>
            ) : (
              <span>
                {video && video.size > DIRECT_NOTION_MAX_BYTES
                  ? `⚡ Preparar subida por fragmentos para ${targetPerson}`
                  : `⚡ Guardar en Notion (${targetPerson} · ${activePersonTag(targetPerson, targetPriority)})`}
              </span>
            )}
          </button>
        </div>
      )}

      <p className="mt-2 text-[10px] text-amber-200/80 leading-snug">
        {video?.type.includes('mp4')?'Se guardará el video MP4 en Notion.':'WebM se conservará como archivo descargable en Notion; puedes revisar el video aquí.'}
      </p>
    </>}
    {notice&&<p role="status" className="mt-2 text-amber-200 font-medium">{notice}</p>}
  </div>:null;

  const clipboardOverlay = clipboardOpen ? (
    <div
      id="anfeta-clipboard-controls"
      className="fixed bottom-28 right-5 z-[400] w-[min(460px,calc(100vw-32px))] max-h-[calc(100dvh-128px)] overflow-auto rounded-xl border border-amber-500/70 bg-slate-950 p-4 text-xs text-slate-100 shadow-2xl"
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

      {/* Selectores modulares (John Nov 10): Responsable, Revisor, Prioridad y Título Técnico Editable */}
      <div className="space-y-2.5 pt-2 border-t border-slate-800">
        <div className="grid grid-cols-2 gap-2">
          {/* Selector de Responsable */}
          <div>
            <label className="block text-[10.5px] font-medium text-amber-300 mb-1">
              Responsable:
            </label>
            <select
              value={targetPerson}
              onChange={(e) => setTargetPerson(e.target.value as ActivityPerson)}
              disabled={!!clipboardSavingCode}
              className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
            >
              {TEAM_MEMBERS.map((p) => (
                <option key={p} value={p}>
                  {p} ({ACTIVITY_TAGS[p].active})
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Revisor Técnico */}
          <div>
            <label className="block text-[10.5px] font-medium text-amber-300 mb-1">
              Revisor técnico:
            </label>
            <select
              value={targetReviewer}
              onChange={(e) => setTargetReviewer(e.target.value)}
              disabled={!!clipboardSavingCode}
              className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
            >
              {REVIEWERS.map((r) => (
                <option key={r.label} value={r.person}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Prioridad en píldoras / botones */}
        <div>
          <label className="block text-[10.5px] font-medium text-amber-300 mb-1">
            Prioridad (nivel de asignación):
          </label>
          <div className="grid grid-cols-4 gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                disabled={!!clipboardSavingCode}
                onClick={() => setTargetPriority(p.value)}
                className={`rounded px-1.5 py-1 text-center font-mono text-[10.5px] font-semibold transition-all cursor-pointer ${
                  targetPriority === p.value
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-amber-500/50'
                }`}
                title={p.label}
              >
                {p.value}
              </button>
            ))}
          </div>
        </div>

        {/* Título técnico final en Notion (editable para corregir antes de guardar) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10.5px] font-medium text-amber-300">
              Título técnico final en Notion:
            </label>
            {isClipboardTitleEdited && (
              <button
                type="button"
                onClick={() => {
                  setIsClipboardTitleEdited(false);
                  setClipboardCustomTitle('');
                }}
                className="text-[10px] text-amber-400 hover:underline cursor-pointer"
              >
                ↺ Restablecer
              </button>
            )}
          </div>
          <input
            type="text"
            value={
              isClipboardTitleEdited
                ? clipboardCustomTitle
                : buildQuickTitle(clipboardText, clipboardDomain, targetPerson, targetPriority, targetReviewer)
            }
            onChange={(e) => {
              setIsClipboardTitleEdited(true);
              setClipboardCustomTitle(e.target.value);
            }}
            disabled={!!clipboardSavingCode}
            className="w-full rounded bg-slate-950 border border-amber-600/60 p-2 text-xs text-amber-100 font-mono focus:border-amber-400 focus:outline-none"
            placeholder="Título estructurado..."
          />
        </div>

        {/* Botón Guardar en Notion */}
        <button
          type="button"
          disabled={!!clipboardSavingCode}
          onClick={() => void quickUploadClipboard()}
          className={`w-full rounded-lg px-3 py-2 text-center font-semibold text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
            clipboardSavingCode
              ? 'bg-amber-700 text-amber-100 cursor-wait'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 active:scale-[0.99]'
          }`}
        >
          {clipboardSavingCode ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Guardando en Notion...</span>
            </>
          ) : (
            <span>⚡ Guardar en Notion (9am hoy · ${activePersonTag(targetPerson, targetPriority)})</span>
          )}
        </button>
      </div>

      {notice && <p role="status" className="mt-2 text-amber-200 font-medium">{notice}</p>}
    </div>
  ) : null;

  const label=phase==='recording'?'Grabando: mostrar u ocultar controles':phase==='preview'?'Revisar grabación':phase==='starting'?'Preparando grabación':'Grabar pantalla y micrófono';
  return client?createPortal(
    <>
      {onOpenDetailed&&<FloatingActionButton label="Asignación detallada · elegir destino y detalles" tone="cyan" className="anfeta-assignment-action bottom-24 right-20" disabled={disabled||!!clipboardSavingCode} onClick={()=>{if(clipboardSubmission.current)return;setClipboardOpen(false);onOpenDetailed();}}><ListPlus size={21}/></FloatingActionButton>}
      <FloatingActionButton label="Asignación rápida desde portapapeles" tone="amber" className="anfeta-assignment-action bottom-12 right-20" disabled={disabled} onClick={()=>(clipboardOpen?setClipboardOpen(false):void openClipboardModal())} aria-expanded={clipboardOpen}><ClipboardPaste size={21}/></FloatingActionButton>
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
