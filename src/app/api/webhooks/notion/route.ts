import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/services/serverSettings';
import { notionSourceKey, invalidateSnapshots } from '@/services/notionSnapshotCache';
import {
  verifyNotionWebhookSignature,
  processNotionWebhook
} from '@/services/notionEventSync';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  const webhookSecret = process.env.NOTION_WEBHOOK_SECRET?.trim();
  const signature = req.headers.get('x-notion-signature');

  if (webhookSecret) {
    if (!signature || !verifyNotionWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json(
        { error: 'Firma inválida de webhook Notion o verificación fallida.' },
        { status: 401 }
      );
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON malformado' }, { status: 400 });
  }

  const settings = getSettings();
  const sourceKey = notionSourceKey(settings);

  try {
    const result = await processNotionWebhook(payload, {
      sourceKey,
      calendarSourceId:process.env.NOTION_CALENDAR_DATA_SOURCE_ID||settings.notionDataSourceId,
      notionToken: settings.notionToken
    });

    // Invalidate snapshot if any deletion was confirmed
    const hasDeletion = result.events.some(e => e.state === 'deleted' && e.applied);
    if (hasDeletion) {
      try {
        await invalidateSnapshots(settings, true);
      } catch (e) {
        console.warn('[webhook notion] No se pudo invalidar la copia del snapshot:', e);
      }
    }

    if (result.handshake) {
      return NextResponse.json(
        { verification_token: result.verificationToken, success: true },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: any) {
    console.error('[webhook notion] Error procesando evento:', error);
    return NextResponse.json(
      { error: error?.message || 'Error procesando webhook Notion' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ANFETA Notion Webhook Receiver',
    version: '2.0.0'
  });
}
