"use client";
import {useEffect,useRef,useState} from 'react';
import {transcriptionAudio} from '@/lib/transcriptionAudio';
export function RecordingTranscription({file,pageIds,folder}:{file:{blob?:Blob;filename:string};pageIds:string[];folder:string}){
 const [available,setAvailable]=useState<boolean|null>(null),[choice,setChoice]=useState(false),[busy,setBusy]=useState(false),[text,setText]=useState(''),[message,setMessage]=useState(''),[saved,setSaved]=useState(false),[url,setUrl]=useState('');
 const chunks=useRef<Blob[]|null>(null),parts=useRef<string[]>([]),running=useRef(false),confirmed=useRef(new Set<string>());
 useEffect(()=>{let alive=true;fetch('/api/transcription').then(r=>r.json()).then(d=>{if(alive)setAvailable(!!d.available);}).catch(()=>{if(alive)setAvailable(false);});return()=>{alive=false;};},[]);
 useEffect(()=>{if(!text)return;const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));setUrl(url);return()=>URL.revokeObjectURL(url);},[text]);
 async function generate(){if(running.current)return;running.current=true;setBusy(true);setMessage('');try{
  if(!file.blob)throw Error('El video está guardado, pero su audio ya no está disponible en esta sesión.');
  if(!chunks.current){setMessage('Preparando audio en este navegador…');chunks.current=await transcriptionAudio(file.blob);}
  for(let i=parts.current.length;i<chunks.current.length;i++){
   setMessage('Transcribiendo '+(i+1)+' de '+chunks.current.length+'…');const data=new FormData();data.set('file',chunks.current[i],'audio.wav');
   const res=await fetch('/api/transcription',{method:'POST',body:data,signal:AbortSignal.timeout(100000)}),result=await res.json();if(!res.ok)throw Error(result.error);parts.current.push(result.text);setText(parts.current.join('\n'));
  }
  const fullText=parts.current.join('\n').trim();if(!fullText)throw Error('No se detectó voz. El video se conserva.');
  setMessage('Guardando transcripción…');
  const destinations=pageIds.length?pageIds:[''];for(const pageId of destinations){if(confirmed.current.has(pageId))continue;const res=await fetch('/api/transcription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',text:fullText,filename:file.filename,pageId,folder}),signal:AbortSignal.timeout(115000)}),data=await res.json();if(!res.ok)throw Error(data.error);confirmed.current.add(pageId);}
  setSaved(true);setMessage(pageIds.length?'Transcripción guardada en la misma actividad, después del video.':'Transcripción TXT guardada junto al video en Dropbox.');window.dispatchEvent(new Event('anfeta_data_refreshed'));
 }catch(e){setMessage((e instanceof Error?e.message:'No se pudo transcribir.')+' El video guardado se conserva. Puedes reintentar sin subirlo otra vez.');}finally{running.current=false;setBusy(false);}}
 return <section className="rounded-lg border border-cyan-800 p-3 space-y-2 text-xs"><h3 className="font-bold">¿Generar transcripción?</h3>{!choice?<><p>Opcional. Solo al elegir Sí se enviará el audio a Groq para convertirlo a texto. Puede consumir la cuota del servicio.</p>{available===false&&<p className="text-amber-200">No está disponible: configura GROQ_API_KEY en el servidor. El video ya está guardado.</p>}<button type="button" disabled={available!==true||!file.blob} onClick={()=>{setChoice(true);void generate();}} className="rounded bg-cyan-800 p-2 disabled:opacity-40">Sí, generar</button><button type="button" onClick={()=>{setChoice(true);setMessage('Video guardado sin transcripción.');}} className="ml-3">No, gracias</button></>:<>{message&&<p role="status">{message}</p>}{!busy&&!saved&&message!=='Video guardado sin transcripción.'&&<button type="button" onClick={()=>void generate()} className="underline">Reintentar transcripción</button>}</>}{busy&&<p>Puedes esperar aquí. No vuelvas a subir el video.</p>}{text&&<><textarea readOnly value={text} aria-label="Transcripción generada" className="w-full h-32 rounded bg-slate-900 p-2"/><a href={url} download={file.filename+'.transcripcion.txt'} className="underline">Descargar texto</a></>}</section>;
}
