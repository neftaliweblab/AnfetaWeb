import crypto from 'crypto';
import {notionRequest} from './notionMutations';
import {readBlocks,clearReadBlocksCache,type CalendarSettings} from './notionCalendar';
import {getDropboxAccessToken} from './dropboxUpload';

export function generateRecordingToken(pageId: string, uploadId?: string): string {
  const secret = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'anfeta_recording_token_secret_2026';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${pageId}:${uploadId || ''}`);
  return hmac.digest('hex').slice(0, 32);
}

export function verifyRecordingToken(pageId: string, uploadId?: string, token?: string | null): boolean {
  if (!token) return false;
  try {
    const expected = generateRecordingToken(pageId, uploadId);
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function recordingPlaybackUrl(origin:string,pageId:string,uploadId?:string,asEmbed=false){
  const url=new URL('/recording',origin);
  url.searchParams.set('page',pageId);
  if(uploadId)url.searchParams.set('upload',uploadId);
  url.searchParams.set('token',generateRecordingToken(pageId,uploadId));
  if(asEmbed)url.searchParams.set('embed','1');
  return url.href;
}
const textOf=(block:any):string=>(block[block.type]?.rich_text||[]).map((t:any)=>t.plain_text||t.text?.content||'').join('');
export function recordingGroups(blocks:any[],uploadId?:string){
 const groups:{id:string;title:string;notionUrl?:string;dropboxPath?:string;filename?:string}[]=[];
 for(let i=0;i<blocks.length;i++){
  const text=textOf(blocks[i]),id=/\[UPLOAD_REF:([a-f0-9-]{36})\]/i.exec(text)?.[1];if(!id||uploadId&&id!==uploadId)continue;
  const title=text.split('\n')[0].replace(/^Adjunto ANFETA:\s*/,'');
  let media:any;
  for(let j=i+1;j<blocks.length;j++){
   if(/\[UPLOAD_REF:/.test(textOf(blocks[j])))break;
   const b=blocks[j],body=b[b.type];if(!['video','file'].includes(b.type))continue;
   const url=body?.file?.url||body?.external?.url,name=body?.name||'';
   if(typeof url==='string'&&(b.type==='video'||/\.(webm|mp4|mov|m4v)$/i.test(name)||/\.(webm|mp4|mov|m4v)(?:[?#]|$)/i.test(url))){media={url,name};break;}
  }
  const dropboxPath=text.split('\n').map(line=>/^Dropbox:\s*(\/.*\.(?:webm|mp4|mov|m4v))\s*$/i.exec(line)?.[1]).find(Boolean);
  if(media||dropboxPath)groups.push({id,title,notionUrl:media?.url,filename:media?.name,dropboxPath});
 }
 return groups;
}
function safeMediaUrl(value:string){
 const url=new URL(value);const allowed=['amazonaws.com','notion-static.com','notionusercontent.com','notion.so','notion.com','dropboxusercontent.com','dropbox.com'];
 if(url.protocol!=='https:'||url.username||url.password||!allowed.some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw Error('El proveedor no devolvió una dirección de video válida.');return url.href;
}
export async function readRecordingPlayback(settings:CalendarSettings,pageId:string,uploadId?:string){
 if(!/^[a-f0-9-]{32,36}$/i.test(pageId)||uploadId&&!/^[a-f0-9-]{36}$/i.test(uploadId))throw Error('Identificador de grabación inválido.');
 const page=await notionRequest(settings,'pages/'+pageId);if(page.archived||page.in_trash)throw Error('La actividad está archivada.');
 clearReadBlocksCache(settings);const groups=recordingGroups(await readBlocks(settings,pageId),uploadId);
 if(!groups.length)throw Error('No se encontró el video de esta actividad. Si acaba de subirse, espera unos segundos y vuelve a cargar.');
 const items=[];
 for(const group of groups){
  if(!uploadId){items.push({id:group.id,title:group.title});continue;}
  let url=group.notionUrl,filename=group.filename;
  if(!url&&group.dropboxPath){
   let token=await getDropboxAccessToken();
   const request=()=>fetch('https://api.dropboxapi.com/2/files/get_temporary_link',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({path:group.dropboxPath}),signal:AbortSignal.timeout(30000)});
   let response=await request();if(response.status===401){token=await getDropboxAccessToken(undefined,true);response=await request();}
   if(!response.ok)throw Error('Dropbox no pudo abrir el video (HTTP '+response.status+').');
   const data=await response.json();url=data.link;filename=data.metadata?.name;
  }
  if(!url)throw Error('El video todavía no tiene una dirección de reproducción. Vuelve a cargar.');
  items.push({id:group.id,title:group.title,url:safeMediaUrl(url),filename:filename||group.dropboxPath?.split('/').at(-1)||'Grabación'});
 }
 return {pageId,pageUrl:page.url||'https://www.notion.so/'+pageId.replace(/-/g,''),items};
}
