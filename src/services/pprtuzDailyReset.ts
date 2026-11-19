import { notionRequest, mutateActivity } from './notionMutations';
import { assignedPerson, calendarStatusField } from './notionCalendar';
import { notionStatusValue } from './notionStatusValue';
import { canEditActivity, isReviewer } from './activityPermissions';
import { workflowState } from './activityWorkflow';
import { isTerminadoHoyStatus } from './progressiveWorkflow';
import { mexicoDate, mexicoMinutes } from './calendarPresentation';
import { supabaseAdmin, supabaseConfigured } from './supabaseServer';
import { notionSourceKey, invalidateSnapshots } from './notionSnapshotCache';
import { operationKey, durableStep } from './reliableOperations';
import { normalizePerson, PERSON_ALIASES } from './identityNormalizer';
import { recordPageEvent, parseNotionPageProperties } from './notionEventSync';

export function pprtuzResetCandidate(page: any, actor: string, day: string, now = new Date()): boolean {
  if (!page || page.archived || page.in_trash) return false;
  const title = Object.values(page.properties || {})
    .filter((p: any) => p.type === 'title')
    .flatMap((p: any) => p.title || [])
    .map((t: any) => t.plain_text || t.text?.content || '')
    .join('');
  const statusProp = calendarStatusField(page)?.[1];
  const statusName = notionStatusValue(statusProp);
  const hasPprtuz = isTerminadoHoyStatus(statusName) || /\bpprtuz[rsdcp]?\b/i.test(title);
  if (!hasPprtuz) return false;
  if (workflowState(statusName, title) !== 'pending') return false;
  const locked = Object.entries(page.properties || {}).some(([n, p]: any) => /lock|bloquead/i.test(n) && p.checkbox);
  if (!canEditActivity(actor, { title, person: assignedPerson(page), isLocked: locked })) return false;

  // Protect every item edited today, including work done before 00:55.
  // A page without a reliable timestamp is not safe to reset automatically.
  const cutoff = Date.parse(`${day}T00:00:00-06:00`);
  const editedAt = Date.parse(page.last_edited_time || '');
  if (!Number.isFinite(cutoff) || !Number.isFinite(editedAt) || editedAt >= cutoff) return false;
  return Number.isFinite(now.getTime());
}

export async function resetDailyPprtuz(settings: any, actor: string, day: string, now = new Date()) {
  if (day !== mexicoDate(now.toISOString()) || mexicoMinutes(now.toISOString()) < 60) {
    return { reset: 0, remaining: 0, failed: 0, skipped: 'before_0100_or_other_day' };
  }
  if (!supabaseConfigured()) {
    throw Error('El reinicio de Terminado por hoy requiere Supabase para coordinar la ejecución.');
  }
  const admin = supabaseAdmin();
  const source = notionSourceKey(settings);
  const tag = PERSON_ALIASES[normalizePerson(actor)]?.[0];
  if (!tag) throw Error('Persona no válida para reiniciar actividades Terminado por hoy.');

  const claim = await admin.rpc('claim_automation_job', {
    p_source: `${source}:pprtuz-reset-v1`,
    p_day: day,
    p_actor: tag,
    p_scope_all: isReviewer(actor),
    p_force: false,
  });
  if (claim.error) throw Error('No se pudo coordinar el reinicio de Terminado por hoy en Supabase.');
  if (claim.data?.state === 'completed' || claim.data?.state === 'busy') {
    return { reset: 0, remaining: 0, failed: 0, skipped: claim.data.state };
  }
  if (!claim.data?.token) throw Error('Supabase no confirmó el permiso de reinicio pprtuz.');

  const report = { reset: 0, remaining: 0, failed: 0, errors: [] as string[] };
  try {
    const sourceId = process.env.NOTION_CALENDAR_DATA_SOURCE_ID || settings.notionDataSourceId || '2eeabd7d-91b7-8193-a131-000b08cd54e2';
    const schema = await notionRequest(settings, `data_sources/${sourceId}`);
    const titleEntry = Object.entries(schema.properties || {}).find(([, p]: any) => p.type === 'title');
    const statusField = calendarStatusField(schema);

    if (!titleEntry || !statusField) throw Error('No se encontró el título o el estado editable de la fuente de calendario.');
    const orFilters: any[] = [];
    if (titleEntry) {
      orFilters.push({ property: titleEntry[0], title: { contains: 'pprtuz' } });
    }
    if (statusField) {
      const [statusName, statusProp] = statusField;
      const options: { name: string }[] = (statusProp as any)?.[statusProp.type]?.options || [];
      for (const opt of options) {
        if (isTerminadoHoyStatus(opt.name)) {
          orFilters.push({ property: statusName, [statusProp.type]: { equals: opt.name } });
        }
      }
    }

    const candidates: any[] = [];
    if (orFilters.length > 0) {
      let cursor: string | undefined;
      do {
        const batch = await notionRequest(settings, `data_sources/${sourceId}/query`, 'POST', {
          page_size: 100,
          filter: orFilters.length === 1 ? orFilters[0] : { or: orFilters },
          ...(cursor ? { start_cursor: cursor } : {}),
        });
        candidates.push(...(batch.results || []).filter((page: any) => pprtuzResetCandidate(page, actor, day, now)));
        if (batch.has_more && (!batch.next_cursor || batch.next_cursor === cursor)) {
          throw Error('No se pudo completar la consulta pprtuz.');
        }
        cursor = batch.has_more ? batch.next_cursor : undefined;
      } while (cursor);
    }

    const batch = candidates.slice(0, 10);
    report.remaining = Math.max(0, candidates.length - batch.length);
    for (const page of batch) {
      try {
        const result = await durableStep(operationKey('pprtuz-reset-v1', source, day, page.id.replace(/-/g, '')), async () => {
          const fresh = await notionRequest(settings, `pages/${page.id}`);
          if (!pprtuzResetCandidate(fresh, actor, day, now)) return { reset: false };
          const saved = await mutateActivity(settings, actor, page.id, {
            status: 'PRTUZ POR HACER',
            expectedEditedAt: fresh.last_edited_time,
          });
          const parsed = parseNotionPageProperties(saved);
          await recordPageEvent({
            sourceKey: source,
            pageId: page.id,
            state: 'active',
            eventType: 'polled_state',
            serverModified: saved.last_edited_time,
            properties: {
              name: parsed.title,
              assignedPerson: parsed.person,
              updateStatus: parsed.status,
              scheduledDate: parsed.dateStart,
            },
          });
          return { reset: true };
        });
        if (result.reset) report.reset++;
      } catch (e) {
        report.failed++;
        report.errors.push(`${page.id}: ${e instanceof Error ? e.message : 'No se confirmó el reinicio.'}`);
      }
    }

    const finished = await admin.rpc('finish_automation_job', {
      p_token: claim.data.token,
      p_report: report,
      p_error: null,
    });
    if (finished.error || !finished.data) {
      throw Error('No se confirmó el registro del reinicio pprtuz.');
    }
    if (report.reset > 0) await invalidateSnapshots(settings);
    return report;
  } catch (e) {
    await admin.rpc('finish_automation_job', {
      p_token: claim.data.token,
      p_report: report,
      p_error: e instanceof Error ? e.message : 'No se completó el reinicio pprtuz.',
    });
    throw e;
  }
}
