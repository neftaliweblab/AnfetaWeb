import type { NotionCalendarActivity } from '@/types/anfeta';
import { filterDeletedPages } from './deletedPages';

const DAY_CACHE_PREFIX = 'anfeta_cal_day_v1:';
const DAY_INDEX_KEY = 'anfeta_cal_day_index_v1';
const MAX_CACHED_DAYS = 8;

export interface CalendarLocalCacheEntry {
  date: string;
  activities: NotionCalendarActivity[];
  syncCursor?: string;
  updatedAt: number;
}

const memoryDayCache = new Map<string, CalendarLocalCacheEntry>();

function trimActivityForStorage(activity: NotionCalendarActivity, stripChecklistItems = false): NotionCalendarActivity {
  const { pageContent: _pageContent, contentSnippet: _contentSnippet, ...rest } = activity as any;
  if (stripChecklistItems && Array.isArray(rest.checklistItems) && rest.checklistItems.length > 0) {
    return {
      ...rest,
      checklistItems: undefined,
    };
  }
  return rest;
}

function updateStoredDayIndex(date: string) {
  try {
    const raw = localStorage.getItem(DAY_INDEX_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [date, ...list.filter((d) => d !== date)];
    while (next.length > MAX_CACHED_DAYS) {
      const evicted = next.pop();
      if (evicted) {
        try {
          localStorage.removeItem(DAY_CACHE_PREFIX + evicted);
        } catch {}
      }
    }
    localStorage.setItem(DAY_INDEX_KEY, JSON.stringify(next));
  } catch {}
}

export function readCalendarLocalCache(date: string, currentUser = ''): CalendarLocalCacheEntry | null {
  if (!date) return null;
  const mem = memoryDayCache.get(date);
  if (mem) {
    return {
      ...mem,
      activities: currentUser ? filterDeletedPages(mem.activities, currentUser) : mem.activities,
    };
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAY_CACHE_PREFIX + date);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CalendarLocalCacheEntry;
    if (!parsed || !Array.isArray(parsed.activities)) return null;
    const entry: CalendarLocalCacheEntry = {
      date,
      activities: parsed.activities,
      syncCursor: typeof parsed.syncCursor === 'string' ? parsed.syncCursor : undefined,
      updatedAt: Number(parsed.updatedAt) || 0,
    };
    memoryDayCache.set(date, entry);
    return {
      ...entry,
      activities: currentUser ? filterDeletedPages(entry.activities, currentUser) : entry.activities,
    };
  } catch {
    return null;
  }
}

export function writeCalendarLocalCache(
  date: string,
  activities: NotionCalendarActivity[],
  syncCursor?: string
): void {
  if (!date || !Array.isArray(activities)) return;
  const existing = memoryDayCache.get(date);
  const entry: CalendarLocalCacheEntry = {
    date,
    activities,
    syncCursor: syncCursor || existing?.syncCursor,
    updatedAt: Date.now(),
  };
  if (memoryDayCache.size >= 16 && !memoryDayCache.has(date)) {
    const oldest = memoryDayCache.keys().next().value;
    if (oldest) memoryDayCache.delete(oldest);
  }
  memoryDayCache.set(date, entry);
  if (typeof window === 'undefined') return;
  try {
    const compact = {
      ...entry,
      activities: activities.map((a) => trimActivityForStorage(a, false)),
    };
    localStorage.setItem(DAY_CACHE_PREFIX + date, JSON.stringify(compact));
    updateStoredDayIndex(date);
  } catch {
    try {
      const lighter = {
        ...entry,
        activities: activities.map((a) => trimActivityForStorage(a, true)),
      };
      localStorage.setItem(DAY_CACHE_PREFIX + date, JSON.stringify(lighter));
      updateStoredDayIndex(date);
    } catch {}
  }
}

export function clearCalendarLocalCache(date?: string): void {
  if (date) {
    memoryDayCache.delete(date);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(DAY_CACHE_PREFIX + date);
      } catch {}
    }
    return;
  }
  memoryDayCache.clear();
}
