import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {requireActor, assertSameOrigin} from '@/services/serverAuth';
import {normalizePerson} from '@/services/identityNormalizer';
import {supabaseAdmin} from '@/services/supabaseServer';
import {createWahaClient, wahaConfigured, WahaError} from '@/services/wahaClient';
import {whatsappAccessUrl, whatsappGroupId} from '@/lib/whatsappGroups';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = {'Cache-Control': 'no-store, private'};
async function authorize(req: Request) {
  if (normalizePerson(await requireActor(req)) !== 'John') throw new WahaError('La conexión y el directorio de WhatsApp están disponibles únicamente para John.', 403);
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'No se pudo completar la operación.';
  return NextResponse.json({error: message}, {status: error instanceof WahaError ? error.status : /Inicia sesión/.test(message) ? 401 : 502, headers});
}
function storageFailure() { return new WahaError('No se confirmó el directorio de WhatsApp. Revisa Supabase y su migración; los datos anteriores se conservan.', 503); }
export async function GET(req: Request) {
  try {
    await authorize(req);
    const action = new URL(req.url).searchParams.get('action') || 'directory';
    if (action === 'status') return NextResponse.json(wahaConfigured() ? {configured: true, ...await createWahaClient().status()} : {configured: false, status: 'NOT_CONFIGURED'}, {headers});
    if (action === 'qr') return NextResponse.json({image: await createWahaClient().qr()}, {headers});
    if (action !== 'directory') throw new WahaError('Consulta no admitida.', 400);
    const db = supabaseAdmin();
    const groups: any[] = [], links: any[] = [];
    // Read all pages; Supabase otherwise silently limits ordinary selects.
    for (const [table, fields, target] of [['whatsapp_groups','group_id,name,access_url,last_seen_at',groups],['whatsapp_activity_links','group_id,page_id,activity_title',links]] as const) {
      for (let offset = 0; offset <= 20000; offset += 500) {
        let query = db.from(table).select(fields).eq('owner','John').order('group_id');
        if (table === 'whatsapp_activity_links') query = query.order('page_id');
        const result = await query.range(offset, offset + 499);
        if (result.error) throw storageFailure();
        target.push(...(result.data || []));
        if ((result.data || []).length < 500) break;
        if (offset === 20000) throw new WahaError('El directorio es demasiado grande para esta vista.', 409);
      }
    }
    return NextResponse.json({groups, links}, {headers});
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    await authorize(req); assertSameOrigin(req);
    const body = await req.json();
    if (body.action === 'disconnect') return NextResponse.json(await createWahaClient().disconnect(), {headers});
    if (body.action === 'start') {
      const ready = await supabaseAdmin().from('whatsapp_accounts').select('owner').eq('owner','John');
      if (ready.error) throw storageFailure();
      return NextResponse.json(await createWahaClient().start(), {headers});
    }
    if (body.action === 'import') {
      const offset = body.offset;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || offset % 50 !== 0) throw new WahaError('Lote de importación no válido.', 400);
      const batch = await createWahaClient().groups(offset);
      if (body.expectedTotal !== undefined && batch.total !== body.expectedTotal) throw new WahaError('La cantidad de grupos cambió. Repite la importación; lo ya guardado se conserva.', 409);
      const accountKey = createHash('sha256').update(batch.account).digest('hex');
      const result = await supabaseAdmin().rpc('import_anfeta_whatsapp_groups', {p_account_key: accountKey, p_groups: batch.groups});
      if (result.error) {
        if (result.error.message?.includes('different_whatsapp_account')) throw new WahaError('Esta cuenta es distinta de la que originó el directorio de John. Desvincúlala y usa la cuenta original.', 409);
        throw storageFailure();
      }
      if (result.data !== batch.groups.length) throw storageFailure();
      return NextResponse.json({imported: batch.groups.length, total: batch.total, nextOffset: batch.nextOffset, done: batch.done}, {headers});
    }
    if (body.action === 'access' || body.action === 'invite') {
      const groupId = whatsappGroupId(body.groupId);
      const accessUrl = body.action === 'invite' ? await createWahaClient().invite(groupId) : whatsappAccessUrl(body.url);
      const result = await supabaseAdmin().from('whatsapp_groups').update({access_url: accessUrl}).eq('owner','John').eq('group_id',groupId).select('group_id');
      if (result.error || result.data?.length !== 1) throw storageFailure();
      return NextResponse.json({saved: true}, {headers});
    }
    if (body.action === 'link' || body.action === 'unlink') {
      const groupId = whatsappGroupId(body.groupId);
      if (typeof body.pageId !== 'string' || !/^[a-f0-9]{32}$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.pageId)) throw new WahaError('Actividad no válida.', 400);
      const db = supabaseAdmin();
      if (body.action === 'unlink') {
        const result = await db.from('whatsapp_activity_links').delete().eq('owner','John').eq('group_id',groupId).eq('page_id',body.pageId);
        if (result.error) throw storageFailure();
      } else {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 2048) throw new WahaError('Título de actividad no válido.', 400);
        const result = await db.from('whatsapp_activity_links').upsert({owner: 'John', group_id: groupId, page_id: body.pageId, activity_title: body.title.trim()}, {onConflict: 'owner,group_id,page_id'});
        if (result.error) throw storageFailure();
      }
      return NextResponse.json({saved: true}, {headers});
    }
    throw new WahaError('Operación no admitida.', 400);
  } catch (error) { return failure(error); }
}
