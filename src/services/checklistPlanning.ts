import fs from 'node:fs';
import path from 'node:path';
import { supabaseAdmin, supabaseConfigured } from './supabaseServer';
import { notionSourceKey } from './notionSnapshotCache';
import type { CalendarSettings } from './notionCalendar';
import { normalizePerson } from './identityNormalizer';

export interface ChecklistItemPlan {
  plannedDate: string; // YYYY-MM-DD
  plannedBy?: string;
  updatedAt: string;
}

export interface DailyActivitySnapshotRecord {
  sourceKey: string;
  pageId: string;
  workDate: string; // YYYY-MM-DD
  person: string;
  title: string;
  startAt: string;
  endAt: string;
  phaseLabel?: string;
  daySummary?: string;
  plannedTotal: number;
  completedTotal: number;
  pendingFutureCount: number;
  snapshot: any;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

const cleanId = (id: string) => String(id || '').replace(/-/g, '').toLowerCase();

const memoryPlans = new Map<string, Record<string, Record<string, ChecklistItemPlan>>>();
const memorySnapshots = new Map<string, DailyActivitySnapshotRecord>();

function localFilePath(filename: string): string {
  return path.join(process.cwd(), 'data', filename);
}

function readOptionalJson<T>(filename: string, fallback: T): T {
  if (process.env.NODE_ENV === 'test' || process.env.NOTION_TOKEN?.startsWith('TEST_ONLY')) {
    return fallback;
  }
  try {
    const file = localFilePath(filename);
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeOptionalJson(filename: string, value: unknown): void {
  if (process.env.NODE_ENV === 'test' || process.env.NOTION_TOKEN?.startsWith('TEST_ONLY')) {
    return;
  }
  try {
    const file = localFilePath(filename);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  } catch {
    // Ignore filesystem errors in read-only serverless runtimes; Supabase/memory persist state
  }
}

function planStoreKey(sourceKey: string, pageId: string): string {
  return `${sourceKey}:${cleanId(pageId)}`;
}

function snapshotStoreKey(sourceKey: string, pageId: string, workDate: string): string {
  return `${sourceKey}:${cleanId(pageId)}:${workDate}`;
}

/** Reads planned dates per checklist block for a page from memory, disk, and Supabase. */
export async function getChecklistItemPlans(
  settings: CalendarSettings,
  pageId: string
): Promise<Record<string, ChecklistItemPlan>> {
  const sourceKey = notionSourceKey(settings);
  const cleanPage = cleanId(pageId);
  const storeKey = planStoreKey(sourceKey, cleanPage);

  const bySource = readOptionalJson<Record<string, Record<string, Record<string, ChecklistItemPlan>>>>(
    'checklist_plans.json',
    {}
  );
  const localDisk = bySource[sourceKey]?.[cleanPage] || {};
  const inMem = memoryPlans.get(sourceKey)?.[cleanPage] || {};
  const merged: Record<string, ChecklistItemPlan> = { ...localDisk, ...inMem };

  if (supabaseConfigured() && !process.env.NOTION_TOKEN?.startsWith('TEST_ONLY')) {
    try {
      const { data, error } = await supabaseAdmin()
        .from('checklist_marks')
        .select('block_id,planned_date,planned_by,planned_updated_at')
        .eq('source_key', sourceKey)
        .eq('page_id', cleanPage)
        .not('planned_date', 'is', null);

      if (!error && Array.isArray(data)) {
        for (const row of data as any[]) {
          const bid = cleanId(row.block_id);
          if (!bid || !row.planned_date) continue;
          const dbEntry: ChecklistItemPlan = {
            plannedDate: String(row.planned_date).slice(0, 10),
            plannedBy: row.planned_by || undefined,
            updatedAt: row.planned_updated_at || new Date().toISOString(),
          };
          const existing = merged[bid];
          if (!existing || Date.parse(dbEntry.updatedAt) >= Date.parse(existing.updatedAt || '')) {
            merged[bid] = dbEntry;
          }
        }
      }
    } catch {
      // Schema might not have planned_date yet; local/memory fallback handles cleanly
    }
  }

  void storeKey;
  return merged;
}

/** Merges `plannedDate` and `plannedBy` into checklist items. */
export async function mergeChecklistItemPlans<T extends { blockId?: string; id?: string }>(
  settings: CalendarSettings,
  pageId: string,
  items: T[]
): Promise<Array<T & { plannedDate?: string; plannedBy?: string }>> {
  if (!items.length) return items as any;
  const plans = await getChecklistItemPlans(settings, pageId);
  return items.map((item) => {
    const bid = cleanId(item.blockId || item.id || '');
    const plan = bid ? plans[bid] : undefined;
    if (!plan) return { ...item };
    return {
      ...item,
      plannedDate: plan.plannedDate,
      plannedBy: plan.plannedBy,
    };
  });
}

/** Saves or clears `plannedDate` for one or more checklist blocks on a page. */
export async function setChecklistItemPlans(
  settings: CalendarSettings,
  pageId: string,
  updates: Array<{ blockId: string; plannedDate: string | null }>,
  actor: string
): Promise<Record<string, ChecklistItemPlan>> {
  const sourceKey = notionSourceKey(settings);
  const cleanPage = cleanId(pageId);
  const nowIso = new Date().toISOString();
  const normalizedActor = normalizePerson(actor || settings.currentUser || 'Anfeta');

  const sourceMem = memoryPlans.get(sourceKey) || {};
  const pageMem = { ...(sourceMem[cleanPage] || {}) };

  const allDisk = readOptionalJson<Record<string, Record<string, Record<string, ChecklistItemPlan>>>>(
    'checklist_plans.json',
    {}
  );
  const sourceDisk = allDisk[sourceKey] || {};
  const pageDisk = { ...(sourceDisk[cleanPage] || {}) };

  const validDate = (val: string | null): string | null => {
    if (!val) return null;
    const trimmed = String(val).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  };

  for (const u of updates) {
    const bid = cleanId(u.blockId);
    if (!bid) continue;
    const nextDate = validDate(u.plannedDate);
    if (nextDate) {
      const entry: ChecklistItemPlan = {
        plannedDate: nextDate,
        plannedBy: normalizedActor,
        updatedAt: nowIso,
      };
      pageMem[bid] = entry;
      pageDisk[bid] = entry;
    } else {
      delete pageMem[bid];
      delete pageDisk[bid];
    }
  }

  sourceMem[cleanPage] = pageMem;
  memoryPlans.set(sourceKey, sourceMem);

  sourceDisk[cleanPage] = pageDisk;
  allDisk[sourceKey] = sourceDisk;
  writeOptionalJson('checklist_plans.json', allDisk);

  if (supabaseConfigured() && !process.env.NOTION_TOKEN?.startsWith('TEST_ONLY')) {
    try {
      for (const u of updates) {
        const bid = cleanId(u.blockId);
        if (!bid) continue;
        const nextDate = validDate(u.plannedDate);
        const existing = await supabaseAdmin()
          .from('checklist_marks')
          .select('block_id')
          .eq('source_key', sourceKey)
          .eq('page_id', cleanPage)
          .eq('block_id', bid)
          .maybeSingle();
        if (existing.error) break;
        if (existing.data) {
          await supabaseAdmin()
            .from('checklist_marks')
            .update({
              planned_date: nextDate,
              planned_by: nextDate ? normalizedActor : null,
              planned_updated_at: nowIso,
            })
            .eq('source_key', sourceKey)
            .eq('page_id', cleanPage)
            .eq('block_id', bid);
        } else {
          await supabaseAdmin()
            .from('checklist_marks')
            .insert({
              source_key: sourceKey,
              page_id: cleanPage,
              block_id: bid,
              checked: false,
              marking_source: 'unknown',
              observed_at: nowIso,
              planned_date: nextDate,
              planned_by: nextDate ? normalizedActor : null,
              planned_updated_at: nowIso,
            });
        }
      }
    } catch {
      // Ignore missing column if SQL migration hasn't run yet; memory/local storage remains authoritative
    }
  }

  return pageMem;
}

/** Saves a read-only historical visual copy (`isDaySnapshot`) for work performed on `workDate`. */
export async function saveDailyActivitySnapshot(
  settings: CalendarSettings,
  record: Omit<DailyActivitySnapshotRecord, 'sourceKey' | 'createdAt' | 'updatedAt'>
): Promise<DailyActivitySnapshotRecord> {
  const sourceKey = notionSourceKey(settings);
  const nowIso = new Date().toISOString();
  const cleanPage = cleanId(record.pageId);
  const key = snapshotStoreKey(sourceKey, cleanPage, record.workDate);

  const full: DailyActivitySnapshotRecord = {
    ...record,
    sourceKey,
    pageId: cleanPage,
    createdAt: memorySnapshots.get(key)?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  memorySnapshots.set(key, full);

  const allDisk = readOptionalJson<Record<string, DailyActivitySnapshotRecord>>(
    'daily_activity_snapshots.json',
    {}
  );
  allDisk[key] = full;
  writeOptionalJson('daily_activity_snapshots.json', allDisk);

  if (supabaseConfigured() && !process.env.NOTION_TOKEN?.startsWith('TEST_ONLY')) {
    try {
      await supabaseAdmin()
        .from('daily_activity_snapshots')
        .upsert(
          {
            source_key: sourceKey,
            page_id: cleanPage,
            work_date: record.workDate,
            person: record.person,
            title: record.title,
            start_at: record.startAt,
            end_at: record.endAt,
            phase_label: record.phaseLabel || null,
            day_summary: record.daySummary || null,
            planned_total: record.plannedTotal,
            completed_total: record.completedTotal,
            pending_future_count: record.pendingFutureCount,
            snapshot: record.snapshot,
            created_by: record.createdBy || null,
            updated_at: nowIso,
          },
          { onConflict: 'source_key,page_id,work_date' }
        );
    } catch {
      // Ignore if table hasn't been created yet
    }
  }

  return full;
}

/**
 * Loads read-only `isDaySnapshot` visual copies within `[first, end)`.
 * If `liveActivities` shows that the underlying Notion page already reached 100% global
 * completion or `completed` status, the "pending future checks validation" warning clears automatically.
 */
export async function readDailySnapshotMirrors(
  settings: CalendarSettings,
  first: string,
  end: string,
  liveActivities: any[] = []
): Promise<any[]> {
  const sourceKey = notionSourceKey(settings);
  const byKey = new Map<string, DailyActivitySnapshotRecord>();

  const allDisk = readOptionalJson<Record<string, DailyActivitySnapshotRecord>>(
    'daily_activity_snapshots.json',
    {}
  );
  for (const [k, rec] of Object.entries(allDisk)) {
    if (rec?.sourceKey === sourceKey && rec.workDate >= first && rec.workDate < end) {
      byKey.set(k, rec);
    }
  }

  for (const [k, rec] of memorySnapshots.entries()) {
    if (rec.sourceKey === sourceKey && rec.workDate >= first && rec.workDate < end) {
      byKey.set(k, rec);
    }
  }

  if (supabaseConfigured() && !process.env.NOTION_TOKEN?.startsWith('TEST_ONLY')) {
    try {
      const { data, error } = await supabaseAdmin()
        .from('daily_activity_snapshots')
        .select('*')
        .eq('source_key', sourceKey)
        .gte('work_date', first)
        .lt('work_date', end)
        .limit(1000);
      if (!error && Array.isArray(data)) {
        for (const row of data as any[]) {
          const rec: DailyActivitySnapshotRecord = {
            sourceKey,
            pageId: cleanId(row.page_id),
            workDate: String(row.work_date).slice(0, 10),
            person: row.person,
            title: row.title,
            startAt: row.start_at,
            endAt: row.end_at,
            phaseLabel: row.phase_label || undefined,
            daySummary: row.day_summary || undefined,
            plannedTotal: Number(row.planned_total) || 0,
            completedTotal: Number(row.completed_total) || 0,
            pendingFutureCount: Number(row.pending_future_count) || 0,
            snapshot: row.snapshot || {},
            createdBy: row.created_by || undefined,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
          };
          const k = snapshotStoreKey(sourceKey, rec.pageId, rec.workDate);
          byKey.set(k, rec);
        }
      }
    } catch {
      // Ignore missing table
    }
  }

  const liveByCleanId = new Map<string, any>();
  for (const act of liveActivities) {
    if (!act || act.isDaySnapshot || act.isReviewMirror || act.isHandoffMirror) continue;
    const cid = cleanId(act.pageId);
    if (cid) liveByCleanId.set(cid, act);
  }

  const mirrors: any[] = [];
  for (const rec of byKey.values()) {
    const live = liveByCleanId.get(rec.pageId);
    const liveGlobalDone =
      live &&
      (live.isFinalized ||
        (Number(live.checklistTotal) > 0 && Number(live.checklistCompleted) >= Number(live.checklistTotal)));
    const pendingFutureChecksCount = liveGlobalDone ? 0 : Math.max(0, Number(rec.pendingFutureCount) || 0);
    const pendingCheckValidation = pendingFutureChecksCount > 0;

    mirrors.push({
      ...(rec.snapshot || {}),
      pageId: `day-snapshot-${rec.workDate}-${rec.pageId}`,
      originalPageId: rec.pageId,
      person: normalizePerson(rec.person),
      title: rec.title,
      shortTitle: rec.snapshot?.shortTitle || rec.title,
      start: rec.startAt,
      end: rec.endAt,
      isReviewMirror: true,
      isHandoffMirror: false,
      isDaySnapshot: true,
      isLocked: true,
      completedForDay: true,
      daySnapshotDate: rec.workDate,
      daySnapshotSummary:
        rec.daySummary ||
        `${rec.phaseLabel || 'Fase del día'} · ${rec.completedTotal}/${rec.plannedTotal} checks${
          pendingCheckValidation ? ` · Pendiente de validar ${pendingFutureChecksCount} checks futuros` : ''
        }`,
      pendingFutureChecksCount,
      pendingCheckValidation,
    });
  }

  return mirrors;
}
