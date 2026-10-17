import {NextResponse} from 'next/server';
import {requireActor, assertSameOrigin} from '@/services/serverAuth';
import {normalizePerson} from '@/services/identityNormalizer';
import {createWahaClient, wahaConfigured, WahaError, WhatsappOwner} from '@/services/wahaClient';
import {whatsappGroupId} from '@/lib/whatsappGroups';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = {'Cache-Control': 'no-store, private'};
async function authorize(req: Request): Promise<WhatsappOwner> {
  const actor=normalizePerson(await requireActor(req));
  if (actor!=='John'&&actor!=='Neftali') throw new WahaError('Esta vista de WhatsApp está disponible para John y Neftalí.', 403);
  return actor;
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'No se pudo completar la operación.';
  return NextResponse.json({error: message}, {status: error instanceof WahaError ? error.status : /Inicia sesión/.test(message) ? 401 : 502, headers});
}
export async function GET(req: Request) {
  try {
    const actor=await authorize(req);
    const action = new URL(req.url).searchParams.get('action') || 'status';
    if (action === 'status') return NextResponse.json(wahaConfigured(actor) ? {configured: true, ...await createWahaClient(fetch,actor).status()} : {configured: false, status: 'NOT_CONFIGURED'}, {headers});
    if (action === 'qr') return NextResponse.json({image: await createWahaClient(fetch,actor).qr()}, {headers});
    throw new WahaError('Consulta no admitida en la vista temporal.', 400);
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const actor=await authorize(req); assertSameOrigin(req);
    const body = await req.json();
    if (body.action === 'disconnect') return NextResponse.json(await createWahaClient(fetch,actor).disconnect(), {headers});
    if (body.action === 'start') return NextResponse.json(await createWahaClient(fetch,actor).start(), {headers});
    if (body.action === 'preview') {
      const offset = body.offset;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || offset % 50 !== 0) throw new WahaError('Lote de importación no válido.', 400);
      const batch = await createWahaClient(fetch,actor).groups(offset);
      if (body.expectedTotal !== undefined && batch.total !== body.expectedTotal) throw new WahaError('La cantidad de grupos cambió. Vuelve a consultar para obtener una lista completa.', 409);
      return NextResponse.json({groups: batch.groups, total: batch.total, nextOffset: batch.nextOffset, done: batch.done}, {headers});
    }
    if (body.action === 'invite') return NextResponse.json({url:await createWahaClient(fetch,actor).invite(whatsappGroupId(body.groupId))}, {headers});
    throw new WahaError('Operación no admitida en la vista temporal.', 400);
  } catch (error) { return failure(error); }
}
