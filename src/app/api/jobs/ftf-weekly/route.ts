import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isDirection } from '@/services/activityPermissions';
import { buildAndSendWeeklyFtfReport } from '@/services/ftfWeeklyReport';

export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { error: 'Configura CRON_SECRET de al menos 32 caracteres.' },
      { status: 503 }
    );
  }
  const digest = (s: string) => createHash('sha256').update(s).digest();
  if (!timingSafeEqual(digest(req.headers.get('authorization') || ''), digest('Bearer ' + secret))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const actor = process.env.ANFETA_ROBOT_PERSON || 'Neftali';
  if (!isDirection(actor)) {
    return NextResponse.json(
      { error: 'Configura ANFETA_ROBOT_PERSON como John o Neftali.' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const targetDate = searchParams.get('date') || undefined;
    const recipientOverride = searchParams.get('to') || undefined;
    const result = await buildAndSendWeeklyFtfReport({
      actor,
      targetDate,
      recipientOverride,
      forceCutoffComplete: !searchParams.get('liveCutoff'),
    });
    return NextResponse.json(
      {
        success: result.email.ok,
        weekStart: result.weekStart,
        weekEnd: result.weekEnd,
        matrixCount: result.matrix.length,
        email: result.email,
      },
      {
        status: result.email.ok ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo enviar el reporte semanal.' },
      { status: 503 }
    );
  }
}
