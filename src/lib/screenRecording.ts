export const RECORDING_MAX_BYTES=128*1024*1024;
export const RECORDING_MAX_MS=20*60*1000;
export function recordingMime(recorder:typeof MediaRecorder){
  return ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type=>recorder.isTypeSupported(type))||'';
}
export async function startScreenRecording(onFinish:(blob:Blob,notice:string)=>void){
  if(!navigator.mediaDevices?.getDisplayMedia||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Este navegador no permite grabar pantalla. Prueba Chrome o Firefox en tu computadora.');
  const display=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:15,max:30}},audio:false});
  let microphone:MediaStream|undefined;
  try{
    microphone=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    if(!microphone.getAudioTracks().some(track=>track.readyState==='live'))throw Error('No se detectó un micrófono activo. Conéctalo y vuelve a intentar.');
    if(!display.getVideoTracks().some(track=>track.readyState==='live'))throw Error('Se detuvo la pantalla antes de iniciar la grabación.');
    const mimeType=recordingMime(MediaRecorder),stream=new MediaStream([...display.getVideoTracks(),...microphone.getAudioTracks()]);
    const recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:1500000,audioBitsPerSecond:64000});
    let chunks:Blob[]=[],size=0,discarded=false,notice='',timer:ReturnType<typeof setTimeout>|undefined;
    const cleanup=()=>{clearTimeout(timer);display.getTracks().forEach(t=>t.stop());microphone?.getTracks().forEach(t=>t.stop());};
    const stop=()=>{if(recorder.state!=='inactive')recorder.stop();};
    recorder.ondataavailable=event=>{if(discarded||!event.data.size)return;chunks.push(event.data);size+=event.data.size;if(size>=RECORDING_MAX_BYTES){notice='Se alcanzó el límite de 128 MB; se conservó el video grabado.';stop();}};
    recorder.onerror=()=>{notice='La grabación se interrumpió. Revisa el video recuperado antes de enviarlo.';stop();};
    recorder.onstop=()=>{cleanup();if(!discarded){const blob=new Blob(chunks,{type:recorder.mimeType||mimeType||'video/webm'});chunks=[];onFinish(blob,notice);}else chunks=[];};
    display.getVideoTracks()[0].addEventListener('ended',stop,{once:true});
    microphone.getAudioTracks()[0]?.addEventListener('ended',()=>{notice='Se desconectó el micrófono; se detuvo y conservó el video.';stop();},{once:true});
    recorder.start(1000);
    timer=setTimeout(()=>{notice='Se alcanzaron 20 minutos; se conservó el video grabado.';stop();},RECORDING_MAX_MS);
    return {stop,dispose:()=>{discarded=true;stop();cleanup();chunks=[];}};
  }catch(error){display.getTracks().forEach(t=>t.stop());microphone?.getTracks().forEach(t=>t.stop());throw error;}
}
