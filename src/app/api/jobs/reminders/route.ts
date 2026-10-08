import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { supabaseConfigured, supabaseAdmin } from '@/services/supabaseServer';
import { getSettings } from '@/services/serverSettings';
import { normalizePerson } from '@/services/identityNormalizer';
import { sendPwaPush } from '@/services/pwaPush';

export const maxDuration = 60;

/**
 * Endpoint de Cron/Background para despachar alarmas push de recordatorios vencidos
 * Diseñado para ejecutarse periódicamente (cada 5 o 15 minutos) con la web y PWA cerradas.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'Configura CRON_SECRET de al menos 32 caracteres.' }, { status: 503 });
  }

  const digest = (v: string) => createHash('sha256').update(v).digest();
  const authHeader = req.headers.get('authorization') || '';
  if (!timingSafeEqual(digest(authHeader), digest('Bearer ' + secret))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado.' }, { status: 503 });
  }

  try {
    const now = new Date();
    // Hora y fecha actual en zona horaria CDMX
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const timeParts = now.toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });

    // Buscar recordatorios pendientes que estén programados para hoy hasta la hora actual
    const { data: dueReminders, error: remError } = await supabaseAdmin()
      .from('reminders')
      .select('id, title, due_date, due_time, priority, assignee_id, creator_id')
      .eq('completed', false)
      .eq('due_date', todayStr)
      .lte('due_time', timeParts + ':59')
      .limit(50);

    if (remError) throw remError;
    if (!dueReminders || dueReminders.length === 0) {
      return NextResponse.json({ success: true, dispatched: 0, message: 'No hay recordatorios pendientes en este minuto.' });
    }

    // Obtener perfiles de usuarios para mapear personas
    const { data: profiles } = await supabaseAdmin()
      .from('profiles')
      .select('id, person_tag')
      .eq('active', true);

    const profileMap = new Map<string, string>();
    profiles?.forEach((p) => {
      profileMap.set(p.id, normalizePerson(p.person_tag));
    });

    const settings = getSettings();
    let sentCount = 0;

    for (const rem of dueReminders) {
      const targetUser = profileMap.get(rem.assignee_id) || profileMap.get(rem.creator_id);
      if (targetUser) {
        try {
          await sendPwaPush(settings, targetUser, {
            title: `⏰ Recordatorio: ${rem.title}`,
            body: `Programado para hoy a las ${rem.due_time?.slice(0, 5)} (Prioridad: ${rem.priority})`,
            tag: `reminder-${rem.id}`,
            url: `/?view=reminders&id=${rem.id}`,
          });
          sentCount++;
        } catch {
          // Continuar con los siguientes
        }
      }
    }

    return NextResponse.json({
      success: true,
      dispatched: sentCount,
      evaluated: dueReminders.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error despachando recordatorios.' },
      { status: 500 }
    );
  }
}
