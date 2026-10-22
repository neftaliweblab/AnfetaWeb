import {assignedPerson,calendarStatusField} from './notionCalendar';
import {normalizeActivity} from './dataNormalizers';
import {ftfState} from './ftfVerification';
import {calendarDomain} from './calendarPresentation';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseConfigured, supabaseAdmin } from './supabaseServer';
import { BoundedCache } from '../lib/boundedCache';

export type PageEventState = 'deleted' | 'active' | 'unverified';
export type PageEventType =
  | 'page.deleted'
  | 'page.undeleted'
  | 'page.properties_updated'
  | 'page.content_updated'
  | 'page.created'
  | 'manual_delete'
  | 'manual_restore'
  | 'polled_state';

export interface PageProperties {
  name?: string;
  assignedPerson?: string;
  updateStatus?: string;
  scheduledDate?: string;
  domain?: string;
  [key: string]: any;
}

export interface PageEventRecord {
  id?: string;
  sourceKey: string;
  pageId: string;
  state: PageEventState;
  eventType: PageEventType;
  serverModified: string;
  eventTimestamp?: string;
  properties?: PageProperties | null;
  unverifiedReason?: string | null;
  updatedAt?: string;
}

export const cleanPageId = (id: string | null | undefined): string =>
  String(id || '').replace(/^review-mirror-/, '').replace(/-/g, '').toLowerCase();

// In-memory cache for fast lookup, monotonic protection, and fallback when Supabase is not configured
const memoryEvents = new BoundedCache<PageEventRecord>(
  10000,
  16 * 1024 * 1024,
  24 * 60 * 60 * 1000,
  (val: PageEventRecord) => Buffer.byteLength(JSON.stringify(val))
);

export function parseNotionPageProperties(page: any): {
  id: string;
  title: string;
  person: string;
  status: string;
  dateStart: string;
  lastEdited: string;
} {
  const id = cleanPageId(page.id);
  const lastEdited = page.last_edited_time || new Date().toISOString();
  let title = '';
  let status = '';
  let person = '';
  let dateStart = '';

  if (page.properties) {
    for (const [propName, propVal] of Object.entries(page.properties as Record<string, any>)) {
      if (!propVal) continue;
      const type = propVal.type;
      const lowerName = propName.toLowerCase();

      if (type === 'title' && Array.isArray(propVal.title)) {
        title = propVal.title.map((t: any) => t?.plain_text || t?.text?.content || '').join('').trim();
      }

      if ((type === 'status' || type === 'select') && propVal[type]?.name) {
        if (lowerName.includes('estado') || lowerName.includes('status')) {
          status = propVal[type].name;
        }
      }

      if (type === 'date' && propVal.date?.start) {
        if (/^fecha por hacer$/i.test(lowerName.trim()) || !dateStart) {
          dateStart = propVal.date.start;
        }
      }

      if (type === 'people' && Array.isArray(propVal.people) && propVal.people.length > 0) {
        person = propVal.people.map((p: any) => p?.name || '').filter(Boolean).join(', ');
      } else if (type === 'select' && (lowerName.includes('persona') || lowerName.includes('responsable') || lowerName.includes('asignado'))) {
        person = propVal.select?.name || person;
      }
    }
  }

  return { id, title, person, status, dateStart, lastEdited };
}

/** A real calendar card only exists when the official scheduling property is present. */
export function calendarActivityFromPage(page:any,calendarSourceId?:string){
  const source=calendarSourceId||process.env.NOTION_CALENDAR_DATA_SOURCE_ID||'2eeabd7d-91b7-8193-a131-000b08cd54e2';
  if(page.parent?.data_source_id&&cleanPageId(page.parent.data_source_id)!==cleanPageId(source))return undefined;
  const date:any=Object.entries(page.properties||{}).find(([name,value]:any)=>/^fecha por hacer$/i.test(name.trim())&&value.type==='date')?.[1];
  if(!date?.date?.start)return undefined;
  const parsed=parseNotionPageProperties(page),start=date.date.start.length===10?date.date.start+'T08:00:00-06:00':date.date.start;
  const end=date.date.end||new Date(Date.parse(start)+3600000).toISOString();
  if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end)))return undefined;
  return {...normalizeActivity({pageId:page.id,pageUrl:page.url,title:parsed.title,person:assignedPerson(page,parsed.person),status:((field:any)=>field?.[1]?.[field[1].type]?.name||parsed.status)(calendarStatusField(page)),start,end,domain:calendarDomain(parsed.title),isLocked:Object.entries(page.properties||{}).some(([n,p]:any)=>/lock|bloquead/i.test(n)&&p.checkbox),...ftfState(page),reviewFlow:page.__reviewFlow,reviewFlowScanned:!!page.__reviewFlow},0),serverModified:parsed.lastEdited};
}

/**
 * Validates Notion webhook HMAC-SHA256 signature using constant-time comparison.
 */
export function verifyNotionWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!secret || !signatureHeader) return false;
  try {
    const rawSignature = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7).trim()
      : signatureHeader.trim();
    if (!/^[a-f0-9]{64}$/i.test(rawSignature)) return false;

    const hmac = createHmac('sha256', secret);
    hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf-8') : rawBody);
    const expected = hmac.digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(rawSignature, 'hex');
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

/**
 * Monotonically records a page event to memory and Supabase.
 * Enforces monotonic ordering: an older event timestamp will never overwrite a newer record.
 */
export async function recordPageEvent(event: {
  sourceKey: string;
  pageId: string;
  state: PageEventState;
  eventType: PageEventType;
  serverModified?: string;
  properties?: PageProperties | null;
  unverifiedReason?: string | null;
}): Promise<{
  applied: boolean;
  pageId: string;
  state: PageEventState;
  serverModified: string;
  reason?: string;
}> {
  const cleanId = cleanPageId(event.pageId);
  if (!cleanId || !/^[a-f0-9]{32}$/.test(cleanId)) {
    return { applied: false, pageId: cleanId, state: event.state, serverModified: '', reason: 'invalid_page_id' };
  }

  const serverModified = event.serverModified || new Date().toISOString();
  const cacheKey = `${event.sourceKey}:${cleanId}`;
  const existing = memoryEvents.get(cacheKey);

  if(existing&&existing.state===event.state&&existing.serverModified===serverModified&&JSON.stringify(existing.properties||null)===JSON.stringify(event.properties||existing.properties||null)&&existing.unverifiedReason===(event.unverifiedReason||null))return {applied:false,pageId:cleanId,state:existing.state,serverModified,reason:'unchanged'};
  // Monotonic check in-memory
  if (existing) {
    const incomingTime = Date.parse(serverModified);
    const existingTime = Date.parse(existing.serverModified);
    if (Number.isFinite(incomingTime) && Number.isFinite(existingTime) && incomingTime < existingTime) {
      return {
        applied: false,
        pageId: cleanId,
        state: existing.state,
        serverModified: existing.serverModified,
        reason: 'stale_event'
      };
    }
  }

  const nowIso = new Date().toISOString();
  const record: PageEventRecord = {
    sourceKey: event.sourceKey,
    pageId: cleanId,
    state: event.state,
    eventType: event.eventType,
    serverModified,
    eventTimestamp: nowIso,
    properties: event.state === 'deleted' ? null : (event.properties || existing?.properties || null),
    unverifiedReason: event.unverifiedReason || null,
    updatedAt: nowIso
  };

  memoryEvents.set(cacheKey, record);

  // Persist to Supabase if configured
  if (supabaseConfigured()) {
    try {
      const admin = supabaseAdmin();
      const res = await admin.rpc('record_notion_page_event', {
        p_source_key: event.sourceKey,
        p_page_id: cleanId,
        p_state: event.state,
        p_event_type: event.eventType,
        p_server_modified: serverModified,
        p_properties: record.properties || null,
        p_unverified_reason: record.unverifiedReason
      });
      if (res?.data && res.data.applied === false) {
        return {
          applied: false,
          pageId: cleanId,
          state: res.data.current_state || event.state,
          serverModified: res.data.current_modified || serverModified,
          reason: res.data.reason || 'stale_event'
        };
      }
    } catch (err) {
      console.warn('[notionEventSync] Supabase record_notion_page_event error (memory preserved):', err);
    }
  }

  return { applied: true, pageId: cleanId, state: event.state, serverModified };
}

/**
 * Returns recent events since `since` timestamp for delta synchronization across clients.
 */
export async function getRecentPageEvents(
  sourceKey: string,
  since?: string | null,
  limit: number = 200
): Promise<PageEventRecord[]> {
  let dbEvents: PageEventRecord[] = [];

  if (supabaseConfigured()) {
    try {
      const admin = supabaseAdmin();
      const res = await admin.rpc('get_recent_notion_page_events', {
        p_source_key: sourceKey,
        p_since: since || null,
        p_limit: limit
      });
      if (Array.isArray(res.data)) {
        dbEvents = res.data.map((item: any) => ({
          sourceKey,
          pageId: item.page_id,
          state: item.state,
          eventType: item.event_type,
          serverModified: item.server_modified,
          properties: typeof item.properties==='string'?JSON.parse(item.properties):item.properties,
          unverifiedReason: item.unverified_reason,
          updatedAt: item.updated_at
        }));
      }
    } catch (err) {
      console.warn('[notionEventSync] Supabase get_recent_notion_page_events error (falling back to memory):', err);
    }
  }

  // Merge with recent memory events
  const sinceMs = since ? Date.parse(since) : 0;
  const mergedMap = new Map<string, PageEventRecord>();

  for (const ev of dbEvents) {
    mergedMap.set(ev.pageId, ev);
  }

  // Overlay memory events
  const prefix = `${sourceKey}:`;
  for (const [key, ev] of memoryEvents) {
    if (key.startsWith(prefix)) {
      const updatedMs = Date.parse(ev.updatedAt || ev.serverModified || '');
      if (!sinceMs || (Number.isFinite(updatedMs) && updatedMs > sinceMs)) {
        const existing = mergedMap.get(ev.pageId);
        if (!existing || Date.parse(ev.updatedAt || '') >= Date.parse(existing.updatedAt || '')) {
          mergedMap.set(ev.pageId, ev);
        }
      }
    }
  }

  return [...mergedMap.values()].sort((a, b) =>
    Date.parse(a.updatedAt || a.serverModified) - Date.parse(b.updatedAt || b.serverModified)
  ).slice(0, limit);
}

/**
 * Helper to fetch all confirmed deleted page IDs for a source key.
 */
export async function getConfirmedDeletedPageIds(sourceKey: string): Promise<string[]> {
  const events = await getRecentPageEvents(sourceKey, null, 1000);
  return events.filter(e => e.state === 'deleted').map(e => e.pageId);
}

/**
 * Handles incoming Notion webhook payloads:
 * - URL verification handshake
 * - Sparse payload resolution via Notion REST API
 * - Monotonic event persistence
 */
export async function processNotionWebhook(
  payload: any,
  options: {
    sourceKey: string;
    calendarSourceId?:string;
    notionToken?: string;
    requestFetch?: typeof fetch;
  }
): Promise<{
  handled: boolean;
  handshake?: boolean;
  verificationToken?: string;
  processedCount: number;
  events: Array<{ pageId: string; state: PageEventState; applied: boolean }>;
}> {
  // 1. Handshake handling
  if (payload?.type === 'url_verification' || payload?.verification_token) {
    return {
      handled: true,
      handshake: true,
      verificationToken: payload.verification_token,
      processedCount: 0,
      events: []
    };
  }

  const rawEvents = Array.isArray(payload) ? payload : (Array.isArray(payload?.events) ? payload.events : [payload]);
  const results: Array<{ pageId: string; state: PageEventState; applied: boolean }> = [];
  const fetcher = options.requestFetch || fetch;

  for (const ev of rawEvents) {
    if (!ev) continue;
    const rawId = ev.entity?.id || ev.id || ev.data?.id;
    const cleanId = cleanPageId(rawId);
    if (!cleanId || !/^[a-f0-9]{32}$/.test(cleanId)) continue;

    const eventType = (ev.type || 'polled_state') as PageEventType;
    const eventTime = ev.timestamp || new Date().toISOString();

    if (eventType === 'page.deleted') {
      // Confirmed page deleted / moved to trash in Notion
      const recorded = await recordPageEvent({
        sourceKey: options.sourceKey,
        pageId: cleanId,
        state: 'deleted',
        eventType: 'page.deleted',
        serverModified: eventTime
      });
      results.push({ pageId: cleanId, state: 'deleted', applied: recorded.applied });
    } else if (eventType === 'page.undeleted') {
      // Page restored from trash in Notion - query authoritative properties
      let pageData: any = null;
      if (options.notionToken) {
        try {
          const resp = await fetcher(`https://api.notion.com/v1/pages/${cleanId}`, {
            headers: {
              Authorization: `Bearer ${options.notionToken.trim()}`,
              'Notion-Version': '2022-06-28'
            },
            signal: AbortSignal.timeout(8000)
          });
          if (resp.ok) {
            pageData = await resp.json();
          }
        } catch {}
      }

      const parsed = pageData ? parseNotionPageProperties(pageData) : null;
      const recorded = await recordPageEvent({
        sourceKey: options.sourceKey,
        pageId: cleanId,
        state: 'active',
        eventType: 'page.undeleted',
        serverModified: parsed?.lastEdited || eventTime,
        properties: parsed ? {
          name: parsed.title,
          assignedPerson: parsed.person,
          updateStatus: parsed.status,
          scheduledDate: parsed.dateStart,scheduledEnd:calendarActivityFromPage(pageData,options.calendarSourceId)?.end,...ftfState(pageData),calendarActivity:calendarActivityFromPage(pageData,options.calendarSourceId)
        } : null
      });
      results.push({ pageId: cleanId, state: 'active', applied: recorded.applied });
    } else {
      // page.properties_updated, page.content_updated, or page.created
      // Sparse payload: Notion does not deliver property values in webhook. Query REST API.
      let pageData: any = null;
      let isArchived = false;
      let is404 = false;

      if (options.notionToken) {
        try {
          const resp = await fetcher(`https://api.notion.com/v1/pages/${cleanId}`, {
            headers: {
              Authorization: `Bearer ${options.notionToken.trim()}`,
              'Notion-Version': '2022-06-28'
            },
            signal: AbortSignal.timeout(8000)
          });
          if (resp.ok) {
            pageData = await resp.json();
            if (pageData.archived || pageData.in_trash) isArchived = true;
          } else if (resp.status === 404) {
            is404 = true;
          }
        } catch {}
      }

      if (isArchived) {
        const recorded = await recordPageEvent({
          sourceKey: options.sourceKey,
          pageId: cleanId,
          state: 'deleted',
          eventType: 'page.deleted',
          serverModified: pageData?.last_edited_time || eventTime
        });
        results.push({ pageId: cleanId, state: 'deleted', applied: recorded.applied });
      } else if (is404) {
        // Do NOT delete on 404! Mark as unverified.
        const recorded = await recordPageEvent({
          sourceKey: options.sourceKey,
          pageId: cleanId,
          state: 'unverified',
          eventType,
          serverModified: eventTime,
          unverifiedReason: 'No se puede verificar esta página: puede no existir o faltar acceso a la integración. Actualiza o revisa los permisos.'
        });
        results.push({ pageId: cleanId, state: 'unverified', applied: recorded.applied });
      } else if (pageData) {
        const parsed = parseNotionPageProperties(pageData);
        const recorded = await recordPageEvent({
          sourceKey: options.sourceKey,
          pageId: cleanId,
          state: 'active',
          eventType,
          serverModified: parsed.lastEdited,
          properties: {
            name: parsed.title,
            assignedPerson: parsed.person,
            updateStatus: parsed.status,
            scheduledDate: parsed.dateStart,scheduledEnd:calendarActivityFromPage(pageData,options.calendarSourceId)?.end,...ftfState(pageData),calendarActivity:calendarActivityFromPage(pageData,options.calendarSourceId)
          }
        });
        results.push({ pageId: cleanId, state: 'active', applied: recorded.applied });
      } else {
        // Fallback when token is not available
        const recorded = await recordPageEvent({
          sourceKey: options.sourceKey,
          pageId: cleanId,
          state: 'active',
          eventType,
          serverModified: eventTime
        });
        results.push({ pageId: cleanId, state: 'active', applied: recorded.applied });
      }
    }
  }

  return {
    handled: true,
    processedCount: results.length,
    events: results
  };
}
