const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
const source=ts.transpileModule(fs.readFileSync(__dirname+'/../src/lib/screenRecording.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({denyMic=false,denyScreen=false}={}){
  const track=kind=>({kind,readyState:'live',stops:0,listeners:{},stop(){this.stops++;this.readyState='ended';},addEventListener(name,fn){this.listeners[name]=fn;}});
  const video=track('video'),mic=track('audio'),system=track('audio');
  const stream=tracks=>({getTracks:()=>tracks,getVideoTracks:()=>tracks.filter(t=>t.kind==='video'),getAudioTracks:()=>tracks.filter(t=>t.kind==='audio')});
  let instance,timer,finished=[];
  class Recorder{static isTypeSupported(type){return type==='video/webm';}constructor(input,options){this.input=input;this.options=options;this.mimeType=options.mimeType;this.state='inactive';instance=this;}start(interval){assert.equal(interval,1000);this.state='recording';}stop(){if(this.state==='inactive')return;this.state='inactive';this.onstop();}}
  const exports={};const context={exports,Blob,MediaRecorder:Recorder,MediaStream:class{constructor(tracks){return stream(tracks);}},navigator:{mediaDevices:{getDisplayMedia:async options=>{assert.equal(options.audio,false);if(denyScreen)throw Error('screen denied');return stream([video,system]);},getUserMedia:async options=>{assert.ok(options.audio);if(denyMic)throw Error('mic denied');return stream([mic]);}}},setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{timer=null;}};
  vm.runInNewContext(source,context);
  return {exports,video,mic,system,get recorder(){return instance;},get timer(){return timer;},finished,start:options=>exports.startScreenRecording((...args)=>finished.push(args),options)};
}
(async()=>{
  const silent=harness({denyMic:true});const silentSession=await silent.start({microphone:false});assert.equal(silent.recorder.input.getAudioTracks().length,0);silentSession.stop();assert.equal(silent.exports.RECORDING_MAX_MS,10*60*1000);
  const a=harness(),session=await a.start();assert.equal(a.recorder.input.getAudioTracks().length,1);assert.equal(a.recorder.input.getAudioTracks()[0],a.mic);
  a.recorder.ondataavailable({data:new Blob(['video'])});session.stop();assert.equal(a.finished.length,1);assert.equal(await a.finished[0][0].text(),'video');assert.equal(a.video.stops,1);assert.equal(a.mic.stops,1);assert.equal(a.system.stops,1);assert.equal(a.timer,null);
  const b=harness({denyMic:true});await assert.rejects(()=>b.start(),/mic denied/);assert.equal(b.video.stops,1);
  const c=harness(),abandoned=await c.start();c.recorder.ondataavailable({data:new Blob(['private'])});abandoned.dispose();assert.equal(c.finished.length,0);assert.ok(c.mic.stops);
  const d=harness();await d.start();d.recorder.ondataavailable({data:new Blob(['part'])});d.video.listeners.ended();assert.equal(d.finished.length,1);
  const e=harness();await e.start();e.recorder.ondataavailable({data:new Blob(['part'])});e.timer();assert.match(e.finished[0][1],/10 minutos/);
  const f=harness();await f.start();f.recorder.ondataavailable({data:{size:f.exports.RECORDING_MAX_BYTES}});assert.match(f.finished[0][1],/128 MB/);
  const g=harness();await g.start();g.recorder.ondataavailable({data:new Blob(['part'])});g.mic.listeners.ended();assert.match(g.finished[0][1],/micrófono/);
  console.log('OK grabación: pantalla + micrófono sin audio interno, formato, límites, permisos denegados, detener, desconexiones y liberación de recursos. Navegador simulado.');
})().catch(error=>{console.error(error);process.exitCode=1;});
