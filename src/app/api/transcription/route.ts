import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {requireActor,assertSameOrigin} from '@/services/serverAuth';
import {getSettings} from '@/services/serverSettings';
import {assertChecklistAccess,readBlocks,clearReadBlocksCache} from '@/services/notionCalendar';
import {notionRequest} from '@/services/notionMutations';
import {uploadDropboxCloud} from '@/services/dropboxUpload';
import {withActivityLease,operationKey} from '@/services/reliableOperations';
export const maxDuration=120;
const calls=new Map<string,{at:number;count:number}>();
export async function GET(req:Request){try{await requireActor(req);return NextResponse.json({available:!!process.env.GROQ_API_KEY},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Inicia sesión.'},{status:401});}}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);const actor=await requireActor(req);
  if(Number(req.headers.get('content-length')||0)>2100000)return NextResponse.json({error:'El fragmento de audio supera el límite.'},{status:413});
  const contentType=req.headers.get('content-type')||'';
  if(contentType.includes('multipart/form-data')){
   if(!process.env.GROQ_API_KEY)return NextResponse.json({error:'La transcripción no está configurada en el servidor. El video guardado se conserva.'},{status:503});
   const now=Date.now(),bucket=calls.get(actor);if(bucket&&now-bucket.at<60000&&bucket.count>=12)return NextResponse.json({error:'Espera un minuto antes de seguir transcribiendo.'},{status:429});
   if(calls.size>1000)calls.clear();calls.set(actor,bucket&&now-bucket.at<60000?{...bucket,count:bucket.count+1}:{at:now,count:1});
   const form=await req.formData(),file=form.get('file');
   if(!(file instanceof File)||file.size<44||file.size>2000000||file.type!=='audio/wav')throw Error('Envía un fragmento WAV de hasta un minuto.');
   const data=Buffer.from(await file.arrayBuffer());if(data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE')throw Error('Audio WAV inválido.');
   const upstream=new FormData();upstream.set('file',file,'audio.wav');upstream.set('model','whisper-large-v3-turbo');upstream.set('language','es');upstream.set('response_format','json');
   const response=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+process.env.GROQ_API_KEY},body:upstream,signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error('No se pudo transcribir este fragmento (HTTP '+response.status+'). El video está guardado; puedes reintentar.');
   const result=await response.json();return NextResponse.json({text:String(result.text||'').slice(0,12000)});
  }
  const body=await req.json();
  if(body.action!=='save'||typeof body.text!=='string'||!body.text.trim()||body.text.length>60000||typeof body.filename!=='string'||body.filename.length>240)throw Error('Transcripción inválida.');
  const settings={...getSettings(),notionSignal:AbortSignal.timeout(110000)};
  const header=req.headers.get('x-notion-token'),cookie=req.headers.get('cookie')?.match(/anfeta_notion_token=([^;]+)/)?.[1];settings.notionToken=header||(cookie?decodeURIComponent(cookie):settings.notionToken);
  const text=body.text.trim(),pageId=String(body.pageId||'');
  if(pageId){
   await assertChecklistAccess(settings,actor,pageId);
   const marker='[ANFETA_TRANSCRIPT_'+createHash('sha256').update(body.filename+text).digest('hex').slice(0,24)+']';
   await withActivityLease(operationKey(settings.notionToken,'transcript:'+pageId),async()=>{
    clearReadBlocksCache(settings);const blocks=await readBlocks(settings,pageId);
    if(blocks.some((b:any)=>(b.toggle?.rich_text||[]).some((t:any)=>(t.plain_text||t.text?.content||'').includes(marker))))return;
    const children=[];for(let i=0;i<text.length;i+=1800)children.push({object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:text.slice(i,i+1800)}}]}});
    await notionRequest(settings,'blocks/'+pageId+'/children','PATCH',{children:[{object:'block',type:'toggle',toggle:{rich_text:[{text:{content:'Transcripción · '+body.filename+' '+marker}}],children}}]});clearReadBlocksCache(settings);
   });
   return NextResponse.json({success:true});
  }
  // A transcription without a Notion destination can always be downloaded as TXT.
  // Dropbox destination is intentionally selected by the user, like the upload form.
  const folder=String(body.folder||'');if(!folder.startsWith('/')||folder.length>2000)throw Error('Carpeta de Dropbox inválida.');
  const result=await uploadDropboxCloud(body.filename.replace(/\.[^.]+$/,'')+'.transcripcion.txt',Buffer.from(text,'utf8'),folder);
  return NextResponse.json({success:true,path:result.path});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'No se pudo generar la transcripción. El video se conserva.'},{status:400});}
}
