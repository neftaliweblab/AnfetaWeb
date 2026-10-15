// Extract mono audio locally; only bounded audio chunks are sent for transcription.
export function wavChunk(samples:Float32Array,sampleRate:number){
 const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
 const word=(offset:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
 word(0,'RIFF');view.setUint32(4,36+samples.length*2,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,samples.length*2,true);
 samples.forEach((s,i)=>view.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*(s<0?32768:32767),true));return new Blob([buffer],{type:'audio/wav'});
}
export async function transcriptionAudio(video:Blob){
 const context=new AudioContext();
 try{
  const decoded=await context.decodeAudioData(await video.arrayBuffer());
  if(!decoded.duration||decoded.duration>605)throw Error('La transcripción admite grabaciones de hasta 10 minutos.');
  const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const audio=(await offline.startRendering()).getChannelData(0),chunks:Blob[]=[];
  for(let offset=0;offset<audio.length;offset+=16000*60)chunks.push(wavChunk(audio.subarray(offset,Math.min(offset+16000*60,audio.length)),16000));
  return chunks;
 }finally{await context.close();}
}
