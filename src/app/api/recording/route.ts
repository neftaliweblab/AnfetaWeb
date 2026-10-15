import {NextResponse} from 'next/server';
import {requireActor} from '@/services/serverAuth';
import {getSettings} from '@/services/serverSettings';
import {readRecordingPlayback, verifyRecordingToken} from '@/services/recordingPlayback';

export const maxDuration=120;

export async function GET(req:Request){
  const params=new URL(req.url).searchParams;
  const pageId=params.get('page')||'';
  const uploadId=params.get('upload')||undefined;
  const token=params.get('token');

  // Permitir acceso con token firmado (para iframes incrustados en Notion) o con sesión activa
  const hasValidToken = verifyRecordingToken(pageId, uploadId, token);
  if (!hasValidToken) {
    try{
      await requireActor(req);
    }catch{
      return NextResponse.json({error:'Inicia sesión en ANFETA y vuelve a cargar esta grabación.'},{status:401,headers:{'Cache-Control':'no-store'}});
    }
  }

  try{
    const settings={...getSettings(),notionSignal:AbortSignal.timeout(60000)};
    const cookie=req.headers.get('cookie')?.match(/anfeta_notion_token=([^;]+)/)?.[1];
    settings.notionToken=req.headers.get('x-notion-token')||(cookie?decodeURIComponent(cookie):settings.notionToken);
    return NextResponse.json(await readRecordingPlayback(settings,pageId,uploadId),{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'No se pudo abrir la grabación.'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
}
