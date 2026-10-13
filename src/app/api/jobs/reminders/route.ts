import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { supabaseConfigured, supabaseAdmin } from '@/services/supabaseServer';
import { getSettings } from '@/services/serverSettings';
import { normalizePerson } from '@/services/identityNormalizer';
import { sendPwaPush, pushConfigured } from '@/services/pwaPush';

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
    const offset=Number(new URL(req.url).searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0)return NextResponse.json({error:'Offset inválido.'},{status:400});
    const started=Date.now();
    if(!pushConfigured())return NextResponse.json({error:'Configura VAPID para enviar alarmas PWA.',dispatched:0},{status:503});
    const now = new Date();
    // Hora y fecha actual en zona horaria CDMX
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const timeParts = now.toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });

    // Buscar recordatorios pendientes que estén programados para hoy hasta la hora actual
    const { data: dueReminders, error: remError } = await supabaseAdmin()
      .from('reminders')
      .select('id, title, due_date, due_time, priority, assignee_id, creator_id, revision')
      .eq('completed', false)
      .or('due_date.lt.'+todayStr+',and(due_date.eq.'+todayStr+',due_time.lte.'+timeParts+':59)')
      .order('due_date').order('due_time').order('id')
      .range(offset,offset+19);

    if (remError) throw remError;
    if (!dueReminders || dueReminders.length === 0) {
      return NextResponse.json({ success: true, dispatched: 0, message: 'No hay recordatorios pendientes en este minuto.' });
    }

    // Obtener perfiles de usuarios para mapear personas
    const { data: profiles,error:profileError } = await supabaseAdmin()
      .from('profiles')
      .select('id, person_tag')
      .eq('active', true);
    if(profileError)throw Error('No se pudieron consultar los perfiles de alarmas.');

    const profileMap = new Map<string, string>();
    profiles?.forEach((p: any) => {
      profileMap.set(p.id, normalizePerson(p.person_tag));
    });

    const settings = getSettings();
    let sentCount = 0;
    let failedCount=0,skippedCount=0;
    let evaluated=0;

    for (const rem of dueReminders) {
      if(Date.now()-started>40000)break;
      evaluated++;
      const targetUser = profileMap.get(rem.assignee_id);
      if (targetUser) {
        try {
          const result=await sendPwaPush(settings, targetUser, {
            title: `⏰ Recordatorio: ${rem.title}`,
            body: `Programado para ${rem.due_date} a las ${rem.due_time?.slice(0, 5)} (Prioridad: ${rem.priority})`,
            tag: `reminder-${rem.id}`,
            url: `/?view=reminders&id=${rem.id}`,
          },{key:rem.id+':'+rem.revision+':'+rem.due_date+':'+rem.due_time,profileId:rem.assignee_id});
          sentCount+=result.sent;failedCount+=result.failed;skippedCount+=result.skipped;
        } catch {
          failedCount++;
          // Continuar con los siguientes
        }
      }
      else skippedCount++;
    }

    return NextResponse.json({
      success: failedCount===0,
      dispatched: sentCount,
      failed:failedCount,skipped:skippedCount,
      nextOffset:evaluated<dueReminders.length||dueReminders.length===20?offset+evaluated:null,
      evaluated,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error despachando recordatorios.' },
      { status: 500 }
    );
  }
}
