import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getSettings } from '@/services/serverSettings';
import { resetDailyPprtuz } from '@/services/pprtuzDailyReset';
import { mexicoDate } from '@/services/calendarPresentation';
import { isDirection } from '@/services/activityPermissions';

export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'Configura CRON_SECRET de al menos 32 caracteres.' }, { status: 503 });
  }
  const digest = (s: string) => createHash('sha256').update(s).digest();
  if (!timingSafeEqual(digest(req.headers.get('authorization') || ''), digest('Bearer ' + secret))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const actor = process.env.ANFETA_ROBOT_PERSON || '';
  if (!isDirection(actor)) {
    return NextResponse.json({ error: 'Configura ANFETA_ROBOT_PERSON como John o Neftali para el reinicio pprtuz.' }, { status: 503 });
  }
  try {
    const started = Date.now();
    const settings = getSettings();
    const day = mexicoDate();
    let reset = 0;
    let failed = 0;
    const errors: string[] = [];
    let report = await resetDailyPprtuz(settings, actor, day);
    reset += report.reset || 0;
    failed += report.failed || 0;
    if ('errors' in report && Array.isArray(report.errors)) errors.push(...report.errors);
    while (report.remaining && !report.failed && Date.now() - started < 80000) {
      report = await resetDailyPprtuz(settings, actor, day);
      reset += report.reset || 0;
      failed += report.failed || 0;
      if ('errors' in report && Array.isArray(report.errors)) errors.push(...report.errors);
      if (!report.reset) break;
    }
    const busy = 'skipped' in report && report.skipped === 'busy';
    return NextResponse.json(
      { success: !failed && !report.remaining && !busy, ...report, reset, failed, errors },
      { status: failed || report.remaining || busy ? 503 : 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo reiniciar pprtuz.' }, { status: 503 });
  }
}
