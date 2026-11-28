import type { NotionCalendarActivity } from '@/types/anfeta';
import { readBlocks, type CalendarSettings } from './notionCalendar';
import { workflowState } from './activityWorkflow';
import { mexicoDate, mexicoMinutes } from './calendarPresentation';
import { normalizeActivity } from './dataNormalizers';
import { normalizePerson, PERSON_ALIASES } from './identityNormalizer';
import { notionSourceKey, snapshotContext } from './notionSnapshotCache';
import { supabaseAdmin, supabaseConfigured } from './supabaseServer';

function cleanId(value: string | null | undefined): string {
  return String(value || '')
    .replace(/^notion:/i, '')
    .replace(/^day-snapshot-\d{4}-\d{2}-\d{2}-/i, '')
    .replace(/^review-mirror-/i, '')
    .replace(/-/g, '')
    .toLowerCase();
}

function isSupabaseLive(): boolean {
  return Boolean(supabaseConfigured() && !process.env.NOTION_TOKEN?.startsWith('TEST_ONLY'));
}

function isNonWorkEntry(title: string): boolean {
  return /^\s*(?:20\d{2}-\d{2}-\d{2}|\[RESPUESTA\]|FTF\s*-\s*Recordatorio|Recordatorio)/i.test(title || '');
}

function isMeaningfulActivity(act: any): boolean {
  if (!act || act.isReviewMirror || act.isHandoffMirror) return false;
  const title = String(act.title || '');
  if (!title.trim() || isNonWorkEntry(title)) return false;
  return true;
}

function shiftClockToDay(iso: string | undefined, targetDay: string, fallbackTime = '10:00:00-06:00'): string {
  if (!iso || iso.length < 16) return `${targetDay}T${fallbackTime}`;
  const timePart = iso.slice(11);
  return `${targetDay}T${timePart}`;
}

function computeBoundedDurationMinutes(startIso?: string, endIso?: string): number {
  const s = Date.parse(startIso || '');
  const e = Date.parse(endIso || '');
  if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
    const mins = Math.round((e - s) / 60000);
    if (mins > 0 && mins <= 8 * 60) return mins;
  }
  return 60;
}

function addMinutesIso(startIso: string, minutes: number): string {
  const ms = Date.parse(startIso);
  if (!Number.isFinite(ms)) return startIso;
  const shifted = new Date(ms + minutes * 60000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(shifted);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
  const hh = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hh}:${get('minute')}:${get('second')}-06:00`;
}

function mergeDateMaps(
  local: Record<string, any>,
  remote: Record<string, any>
): Record<string, any> {
  if (!remote || typeof remote !== 'object') return local;
  const merged: Record<string, any> = { ...local };
  for (const [k, val] of Object.entries(remote)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && merged[k] && typeof merged[k] === 'object') {
      const dayMerged: Record<string, any> = { ...merged[k] };
      for (const [subKey, subVal] of Object.entries(val as Record<string, any>)) {
        const cur = dayMerged[subKey];
        const curTs = Date.parse(cur?.updatedAt || cur?.reviewedAt || '') || 0;
        const remTs = Date.parse(subVal?.updatedAt || subVal?.reviewedAt || '') || 0;
        if (!cur || remTs >= curTs) {
          dayMerged[subKey] = subVal;
        }
      }
      merged[k] = dayMerged;
    } else if (!(k in merged)) {
      merged[k] = val;
    }
  }
  return merged;
}

/**
 * Reads a durable JSON settings/scores map from local cache and merges with Supabase `notion_snapshots`.
 * Ensures score cutoffs, meal breaks, and supervisor reviews survive stateless Render/Vercel deploys.
 */
export async function readFtfStore<T extends Record<string, any>>(
  settings: CalendarSettings,
  requestKey: string,
  localData: T
): Promise<T> {
  if (!isSupabaseLive()) return localData;
  try {
    const sourceKey = notionSourceKey(settings);
    const { data, error } = await supabaseAdmin()
      .from('notion_snapshots')
      .select('payload,updated_at')
      .eq('source_key', sourceKey)
      .eq('request_key', requestKey)
      .eq('has_payload', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.payload || typeof data.payload !== 'object') return localData;
    return mergeDateMaps(localData, data.payload) as T;
  } catch {
    return localData;
  }
}

/**
 * Persists a small JSON settings/scores map to Supabase `notion_snapshots` under the supervisor account.
 */
export async function writeFtfStore(
  settings: CalendarSettings,
  requestKey: string,
  data: Record<string, any>
): Promise<void> {
  if (!isSupabaseLive()) return;
  try {
    const ctx = await snapshotContext('John', settings, requestKey);
    await supabaseAdmin()
      .from('notion_snapshots')
      .upsert(
        {
          user_id: ctx.userId,
          source_key: ctx.source,
          request_key: requestKey,
          payload: data,
          has_payload: true,
          valid: true,
          force_full: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,source_key,request_key' }
      );
  } catch (err) {
    console.warn(`[writeFtfStore:${requestKey}] No se pudo persistir en Supabase:`, err instanceof Error ? err.message : '');
  }
}

/**
 * Saves an immutable per-day activity archive (`ftf:day-archive:YYYY-MM-DD`) when live Notion
 * holds a fuller day than what is already archived, protecting past workdays from rollover.
 */
export async function saveFtfDayArchive(
  settings: CalendarSettings,
  day: string,
  activities: NotionCalendarActivity[],
  today = mexicoDate()
): Promise<void> {
  if (!isSupabaseLive() || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const dayActs = activities.filter(a => {
    if (!isMeaningfulActivity(a) || a.isDaySnapshot) return false;
    return mexicoDate(a.start) === day;
  });
  if (!dayActs.length) return;

  try {
    const requestKey = `ftf:day-archive:${day}`;
    const ctx = await snapshotContext('John', settings, requestKey);
    const { data: existing } = await supabaseAdmin()
      .from('notion_snapshots')
      .select('payload')
      .eq('user_id', ctx.userId)
      .eq('source_key', ctx.source)
      .eq('request_key', requestKey)
      .maybeSingle();

    const prevActs: any[] = Array.isArray(existing?.payload?.activities) ? existing.payload.activities : [];
    // Never shrink a past day's archive after Notion rolls uncompleted/review items forward.
    if (day < today && prevActs.length >= dayActs.length) return;

    await supabaseAdmin()
      .from('notion_snapshots')
      .upsert(
        {
          user_id: ctx.userId,
          source_key: ctx.source,
          request_key: requestKey,
          payload: { day, archivedAt: new Date().toISOString(), activities: dayActs },
          has_payload: true,
          valid: true,
          force_full: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,source_key,request_key' }
      );
  } catch {
    // Non-fatal archive write
  }
}

export interface RecoveredFtfHistory {
  /** All raw snapshot activities usable as `cachedFlat` to avoid duplicate Notion block calls. */
  cachedFlat: NotionCalendarActivity[];
  /** Synthetic/archived historical activities for past days missing from live Notion. */
  recoveredPastActivities: NotionCalendarActivity[];
}

interface RespuestaHandoffEntry {
  targetId: string;
  targetTitle: string;
  sender: string;
  reviewer: string;
  day: string;
}

const RESPUESTA_TITLE_RE = /^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}\s+(\S+)\s+de:(\S+)\s+\[RESPUESTA\]/i;

function extractPageTitleText(page: any): string {
  return Object.values(page?.properties || {})
    .filter((p: any) => p?.type === 'title')
    .flatMap((p: any) => p.title || [])
    .map((t: any) => t?.plain_text || t?.text?.content || '')
    .join('')
    .trim();
}

async function resolveRespuestaHandoffs(
  settings: CalendarSettings,
  pages: any[],
  dates: string[]
): Promise<RespuestaHandoffEntry[]> {
  if (!pages.length || !isSupabaseLive()) return [];
  const dateSet = new Set(dates);
  const candidates: Array<{ pageId: string; day: string; reviewer: string; sender: string }> = [];

  for (const page of pages) {
    const title = extractPageTitleText(page);
    const m = title.match(RESPUESTA_TITLE_RE);
    if (!m) continue;
    const sender = normalizePerson(m[3]);
    const reviewer = normalizePerson(m[2]);
    if (!sender || sender === 'Sin asignar' || !PERSON_ALIASES[sender]) continue;
    const day = dateSet.has(m[1]) ? m[1] : page.created_time ? mexicoDate(page.created_time) : m[1];
    if (!dateSet.has(day)) continue;
    candidates.push({
      pageId: cleanId(page.id),
      day,
      reviewer: reviewer && reviewer !== 'Sin asignar' ? reviewer : 'John',
      sender,
    });
  }
  if (!candidates.length) return [];

  const cachedIndex = await readFtfStore<Record<string, RespuestaHandoffEntry>>(
    settings,
    'ftf:respuesta-index',
    {}
  );
  let dirty = false;
  const resolved: RespuestaHandoffEntry[] = [];
  const missing = candidates.filter(c => !cachedIndex[c.pageId]?.targetId);

  if (missing.length > 0) {
    await Promise.race([
      Promise.all(
        missing.slice(0, 18).map(async item => {
          try {
            const blocks = await readBlocks(settings, item.pageId);
            let targetId = '';
            let targetTitle = '';
            for (const b of blocks || []) {
              const rich = b?.[b.type]?.rich_text || [];
              const text = rich.map((t: any) => t?.plain_text || t?.text?.content || '').join('');
              if (/Actividad original en Notion/i.test(text)) {
                targetTitle = text.replace(/^.*Actividad original en Notion:\s*/i, '').trim();
              }
              for (const t of rich) {
                const raw = t?.href || t?.mention?.page?.id || t?.plain_text || '';
                const idMatch = String(raw).match(
                  /([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i
                );
                if (idMatch) targetId = cleanId(idMatch[1]);
              }
            }
            if (targetId) {
              cachedIndex[item.pageId] = {
                targetId,
                targetTitle: targetTitle || `Actividad en revisión (${item.sender})`,
                sender: item.sender,
                reviewer: item.reviewer,
                day: item.day,
              };
              dirty = true;
            }
          } catch {
            // Skip unreadable [RESPUESTA] page without blocking dashboard
          }
        })
      ),
      new Promise<void>(resolve => setTimeout(resolve, 9000)),
    ]);
    if (dirty) {
      const pruned = Object.fromEntries(Object.entries(cachedIndex).slice(-300));
      writeFtfStore(settings, 'ftf:respuesta-index', pruned).catch(() => {});
    }
  }

  for (const c of candidates) {
    const entry = cachedIndex[c.pageId];
    if (entry?.targetId) {
      resolved.push({
        ...entry,
        day: c.day,
        sender: c.sender,
        reviewer: c.reviewer,
      });
    }
  }
  return resolved;
}

/**
 * Recovers historical workday activities (`< today`) and archived/backed-up today reviews/completions
 * from Supabase `ftf:day-archive:*`, `calendar:*` snapshots across all profiles, `notion_page_events`,
 * `checklist_marks`, and `[RESPUESTA]` review handoff cards.
 */
export async function loadHistoricalFtfRecovery(
  settings: CalendarSettings,
  dates: string[],
  liveActivities: NotionCalendarActivity[],
  today = mexicoDate(),
  rawPages: any[] = []
): Promise<RecoveredFtfHistory> {
  if (!isSupabaseLive() || !dates.length) {
    return { cachedFlat: [], recoveredPastActivities: [] };
  }

  const pastDates = dates.filter(d => d < today);
  const dateSet = new Set(dates.filter(d => d <= today));
  const keys = [
    ...dates.map(d => `calendar:${d}`),
    ...dates.map(d => `ftf:day-archive:${d}`),
  ];

  const sourceKey = notionSourceKey(settings);
  const minDate = dates[0];
  const minIso = `${minDate}T06:00:00Z`;
  const maxIso = `${today}T06:00:00Z`;

  const [snapRes, eventRes, marksRes, handoffs] = await Promise.all([
    supabaseAdmin()
      .from('notion_snapshots')
      .select('request_key,updated_at,payload')
      .in('request_key', keys)
      .eq('has_payload', true)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabaseAdmin()
      .from('notion_page_events')
      .select('page_id,server_modified,properties')
      .eq('source_key', sourceKey)
      .gte('server_modified', minIso)
      .limit(2000),
    supabaseAdmin()
      .from('checklist_marks')
      .select('page_id,marked_at,observed_at,checked')
      .eq('source_key', sourceKey)
      .eq('checked', true)
      .gte('observed_at', minIso)
      .limit(3000),
    resolveRespuestaHandoffs(settings, rawPages, dates).catch(() => [] as RespuestaHandoffEntry[]),
  ]);

  // Index [RESPUESTA] handoffs per targetId+day and per targetId globally
  const handoffByDayTarget = new Map<string, RespuestaHandoffEntry>();
  for (const h of handoffs) {
    handoffByDayTarget.set(`${h.day}:${h.targetId}`, h);
  }

  // Also index notion_page_events by cleanId for status upgrades & metadata fallback
  const eventsByPage = new Map<string, any>();
  for (const ev of (eventRes.data as any[]) || []) {
    if (ev?.page_id && ev?.properties?.name) {
      eventsByPage.set(cleanId(ev.page_id), ev);
    }
  }

  // Fetch missing event rows for checklist-marked pages or [RESPUESTA] targets not recently touched
  const extraLookupIds = new Set<string>();
  for (const m of (marksRes.data as any[]) || []) {
    if (m.page_id) {
      const cid = cleanId(m.page_id);
      if (!eventsByPage.has(cid)) extraLookupIds.add(cid);
    }
  }
  for (const h of handoffs) {
    if (!eventsByPage.has(h.targetId)) extraLookupIds.add(h.targetId);
  }
  if (extraLookupIds.size > 0) {
    const { data: extraEvs } = await supabaseAdmin()
      .from('notion_page_events')
      .select('page_id,server_modified,properties')
      .eq('source_key', sourceKey)
      .in('page_id', [...extraLookupIds].slice(0, 200));
    for (const ev of (extraEvs as any[]) || []) {
      if (ev?.page_id && ev?.properties?.name) {
        eventsByPage.set(cleanId(ev.page_id), ev);
      }
    }
  }

  // Apply [RESPUESTA] attribution directly onto liveActivities when reviewer approved/holds the card without reviewFlow
  for (const act of liveActivities) {
    if (!act?.start) continue;
    const d = mexicoDate(act.start);
    const cid = cleanId(act.originalPageId || act.pageId);
    const h = handoffByDayTarget.get(`${d}:${cid}`);
    if (h && !act.reviewFlow?.OriginalPerson) {
      act.reviewFlow = {
        OriginalPerson: h.sender,
        ReviewAssignee: h.reviewer,
        State: workflowState(act.status, act.title) === 'completed' ? 'approved' : 'pending',
      };
      act.originalPerson = h.sender;
    }
  }

  // 1. Group snapshots per day and merge healthy snapshots chronologically (oldest -> newest)
  // so end-of-day progress (e.g. evening RTUZ review updates) overrides mid-day snapshots without letting tiny post-wipe snapshots shrink the day.
  const snapsByDay = new Map<string, Array<{ updatedAt: string; rawKey: string; meaningfulCount: number; acts: any[] }>>();
  const allCached: NotionCalendarActivity[] = [];
  for (const row of (snapRes.data as any[]) || []) {
    const rawKey = String(row.request_key || '');
    const day = rawKey.replace(/^calendar:|^ftf:day-archive:/, '');
    const acts: any[] = Array.isArray(row.payload?.activities) ? row.payload.activities : [];
    let meaningfulCount = 0;
    for (const act of acts) {
      if (isMeaningfulActivity(act)) {
        meaningfulCount++;
        allCached.push(normalizeActivity(act, 0));
      }
    }
    const list = snapsByDay.get(day) || [];
    list.push({ updatedAt: String(row.updated_at || ''), rawKey, meaningfulCount, acts });
    snapsByDay.set(day, list);
  }

  const bestSnapByDay = new Map<string, any[]>();
  for (const [day, list] of snapsByDay.entries()) {
    const maxCount = Math.max(...list.map(x => x.meaningfulCount));
    const healthy = list
      .filter(x => x.meaningfulCount > 0 && x.meaningfulCount >= Math.min(maxCount, Math.max(10, Math.round(maxCount * 0.5))))
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt) || Number(a.rawKey.startsWith('ftf:day-archive:')) - Number(b.rawKey.startsWith('ftf:day-archive:')));
    const byId = new Map<string, any>();
    for (const snap of healthy) {
      for (const act of snap.acts) {
        if (!isMeaningfulActivity(act)) continue;
        const pid = cleanId(act.originalPageId || act.pageId);
        if (pid) byId.set(pid, act);
      }
    }
    bestSnapByDay.set(day, [...byId.values()]);
  }

  // Track which pageIds ALREADY exist in live Notion anywhere & per day (avoid duplicating moved cards)
  const liveAllIds = new Set<string>();
  const seenByDay = new Map<string, Set<string>>();
  for (const d of dates) seenByDay.set(d, new Set<string>());
  for (const act of liveActivities) {
    const cid = cleanId(act.originalPageId || act.pageId);
    if (cid) liveAllIds.add(cid);
    if (!act.start) continue;
    const d = mexicoDate(act.start);
    const set = seenByDay.get(d);
    if (set && cid) {
      set.add(cid);
    }
  }

  const recovered: NotionCalendarActivity[] = [];

  // 2. Recover missing past-day activities (and archived completed/review cards for today),
  // upgrading status from fresher notion_page_events or [RESPUESTA] handoffs when applicable.
  for (const d of dates) {
    if (d > today) continue;
    const isToday = d === today;
    const seen = seenByDay.get(d)!;
    const snapActs = bestSnapByDay.get(d) || [];
    for (const raw of snapActs) {
      if (!isMeaningfulActivity(raw) || raw.isDaySnapshot) continue;
      const pid = cleanId(raw.originalPageId || raw.pageId);
      if (!pid || seen.has(pid)) continue;
      let effectiveRaw = { ...raw };
      const ev = eventsByPage.get(pid);
      if (ev?.properties?.name) {
        const evTitle = String(ev.properties.calendarActivity?.title || ev.properties.name || '');
        const evStatus = String(ev.properties.calendarActivity?.status || ev.properties.updateStatus || '');
        const evWf = workflowState(evStatus, evTitle);
        const snapWf = workflowState(effectiveRaw.status || '', effectiveRaw.title || '');
        const evSchedRaw = String(ev.properties.scheduledDate || ev.properties.calendarActivity?.start || '');
        const evSchedDay = /^\d{4}-\d{2}-\d{2}/.test(evSchedRaw) ? mexicoDate(evSchedRaw) : '';
        if (
          evSchedDay === d &&
          snapWf === 'pending' &&
          (evWf === 'completed' || evWf === 'review')
        ) {
          effectiveRaw.status = evStatus;
          effectiveRaw.title = evTitle || effectiveRaw.title;
          effectiveRaw.completedForDay = true;
          effectiveRaw.ftfVerified = true;
        }
      }
      const handoff = handoffByDayTarget.get(`${d}:${pid}`);
      if (handoff && !effectiveRaw.reviewFlow?.OriginalPerson) {
        effectiveRaw.reviewFlow = {
          OriginalPerson: handoff.sender,
          ReviewAssignee: handoff.reviewer,
          State: workflowState(effectiveRaw.status || '', effectiveRaw.title || '') === 'completed' ? 'approved' : 'pending',
        };
        effectiveRaw.originalPerson = handoff.sender;
      }
      if (isToday) {
        // On today, only recover cards no longer present anywhere in live Notion AND already completed/in-review
        const wf = workflowState(effectiveRaw.status || '', effectiveRaw.title || '');
        if (liveAllIds.has(pid) || (wf !== 'completed' && wf !== 'review')) continue;
      }
      const startDay = effectiveRaw.start ? mexicoDate(effectiveRaw.start) : d;
      if (startDay !== d) continue;

      const normalized = normalizeActivity(
        {
          ...effectiveRaw,
          serverModified: effectiveRaw.serverModified || effectiveRaw.lastEdited || effectiveRaw.start,
        },
        0
      );
      seen.add(pid);
      recovered.push(normalized);
    }
  }

  // 3. Recover missing completed/review activities & sparse-day events from notion_page_events, checklist_marks, and [RESPUESTA] handoffs
  const sparsePastSet = new Set(pastDates.filter(d => (bestSnapByDay.get(d) || []).length < 25));
  const markedPagesByDay = new Map<string, Set<string>>();
  for (const d of dates) if (dateSet.has(d)) markedPagesByDay.set(d, new Set<string>());

  for (const m of (marksRes.data as any[]) || []) {
    const d = mexicoDate(m.marked_at || m.observed_at);
    const set = markedPagesByDay.get(d);
    if (set && m.page_id) {
      set.add(cleanId(m.page_id));
    }
  }

  for (const [cid, ev] of eventsByPage.entries()) {
    const props = ev.properties || {};
    const calAct = props.calendarActivity;
    const title = String(calAct?.title || props.name || '');
    const status = String(calAct?.status || props.updateStatus || '');
    if (!isMeaningfulActivity({ title, status })) continue;
    const wf = workflowState(status, title);
    if (wf === 'suspended') continue;

    const modIso = String(ev.server_modified || '');
    const modDay = modIso ? mexicoDate(modIso) : '';
    const modMin = modIso ? mexicoMinutes(modIso) : 0;
    const schedRaw = String(props.scheduledDate || calAct?.start || '');
    const schedDay = /^\d{4}-\d{2}-\d{2}/.test(schedRaw) ? mexicoDate(schedRaw) : '';

    let targetDay = '';
    for (const d of dates) {
      if (handoffByDayTarget.has(`${d}:${cid}`)) {
        targetDay = d;
        break;
      }
    }
    if (!targetDay && schedDay && dateSet.has(schedDay)) {
      if (wf === 'completed' || wf === 'review' || sparsePastSet.has(schedDay)) {
        targetDay = schedDay;
      }
    }
    if (!targetDay) {
      for (const d of sparsePastSet) {
        if (markedPagesByDay.get(d)?.has(cid)) {
          targetDay = d;
          break;
        }
      }
    }
    if (!targetDay && sparsePastSet.has(modDay)) {
      const inWeekWindow = !schedDay || (schedDay >= minDate && schedDay <= today);
      const workedDuringDay = modMin >= 7 * 60 && (wf === 'completed' || wf === 'review');
      if (inWeekWindow && workedDuringDay) {
        targetDay = modDay;
      }
    }

    if (!targetDay || !dateSet.has(targetDay)) continue;
    if (targetDay === today && (liveAllIds.has(cid) || (wf !== 'completed' && wf !== 'review' && !handoffByDayTarget.has(`${today}:${cid}`)))) continue;
    const seen = seenByDay.get(targetDay)!;
    if (seen.has(cid)) continue;

    const handoff = handoffByDayTarget.get(`${targetDay}:${cid}`);
    const rawPerson =
      handoff?.sender ||
      (calAct?.reviewFlow?.OriginalPerson && (wf === 'review' || wf === 'completed')
        ? calAct.reviewFlow.OriginalPerson
        : calAct?.person || props.assignedPerson || '');
    const person = normalizePerson(String(rawPerson || ''));
    if (!person || person === 'Sin asignar' || !PERSON_ALIASES[person]) continue;

    const durMin = computeBoundedDurationMinutes(calAct?.start || props.scheduledDate, calAct?.end || props.scheduledEnd);
    const start = shiftClockToDay(calAct?.start || props.scheduledDate, targetDay, '10:00:00-06:00');
    const end = addMinutesIso(start, durMin);

    const synthetic = normalizeActivity(
      {
        ...(calAct || {}),
        pageId: calAct?.pageId || ev.page_id,
        title,
        person,
        originalPerson: handoff?.sender || calAct?.originalPerson,
        ...(handoff
          ? {
              reviewFlow: {
                OriginalPerson: handoff.sender,
                ReviewAssignee: handoff.reviewer,
                State: wf === 'completed' ? 'approved' : 'pending',
              },
            }
          : {}),
        status: handoff && wf !== 'completed' && wf !== 'review' ? 'RTUZ - REVISAR REVISIONES rrevi' : status,
        start,
        end,
        ftfVerified: Boolean(handoff || props.ftfVerified || calAct?.ftfVerified || wf === 'completed' || wf === 'review'),
        ftfAvailable: true,
        completedForDay: Boolean(handoff || calAct?.completedForDay || wf === 'completed' || wf === 'review' || markedPagesByDay.get(targetDay)?.has(cid)),
        serverModified: modIso || start,
      },
      0
    );
    seen.add(cid);
    recovered.push(synthetic);
  }

  // 4. Last-resort [RESPUESTA] review recovery when even notion_page_events lacked a record of targetId
  for (const h of handoffs) {
    if (!dateSet.has(h.day)) continue;
    if (h.day === today && liveAllIds.has(h.targetId)) continue;
    const seen = seenByDay.get(h.day)!;
    if (seen.has(h.targetId)) continue;
    const start = `${h.day}T10:00:00-06:00`;
    const end = `${h.day}T11:00:00-06:00`;
    seen.add(h.targetId);
    recovered.push(
      normalizeActivity(
        {
          pageId: h.targetId,
          title: h.targetTitle,
          person: h.sender,
          originalPerson: h.sender,
          reviewFlow: { OriginalPerson: h.sender, ReviewAssignee: h.reviewer, State: 'pending' },
          status: 'RTUZ - REVISAR REVISIONES rrevi',
          start,
          end,
          ftfVerified: true,
          ftfAvailable: true,
          completedForDay: true,
          serverModified: start,
        },
        0
      )
    );
  }

  return { cachedFlat: allCached, recoveredPastActivities: recovered };
}
