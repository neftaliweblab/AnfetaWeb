import {mexicoDate} from '../services/calendarPresentation';

export interface DailyChecklistItemShape {
  isChecked: boolean;
  markedAt?: string;
  markingSource?: string;
  plannedDate?: string;
}

export function shiftMexicoDay(day: string, offsetDays: number): string {
  const base = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(base)) return day;
  return new Date(base + offsetDays * 86400000).toISOString().slice(0, 10);
}

/**
 * Daily workload calculation:
 * - When checklist items have explicit `plannedDate === day`, daily goal & progress
 *   use that day's planned subset (allowing `completedForDay` even when future checks remain).
 * - Otherwise preserves legacy behavior (excludes checked history, uses today's verified marks).
 */
export function dailyChecklist<T extends DailyChecklistItemShape>(items: readonly T[], day: string) {
  const pending: T[] = [];
  const completed: T[] = [];
  const history: T[] = [];
  const plannedTodayPending: T[] = [];
  const plannedTodayCompleted: T[] = [];
  const upcomingPending: T[] = [];
  const backlogPending: T[] = [];
  let unknown = 0;

  for (const item of items) {
    const planned = typeof item.plannedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.plannedDate)
      ? item.plannedDate
      : '';
    if (!item.isChecked) {
      pending.push(item);
      if (planned === day) plannedTodayPending.push(item);
      else if (planned && planned > day) upcomingPending.push(item);
      else backlogPending.push(item);
      continue;
    }
    const markedDay = item.markedAt ? mexicoDate(item.markedAt) : '';
    const isVerifiedToday = item.markingSource === 'verified' && markedDay === day;
    if (planned === day) {
      plannedTodayCompleted.push(item);
      completed.push(item);
    } else if (isVerifiedToday) {
      completed.push(item);
    } else {
      history.push(item);
      if (item.markingSource !== 'verified' || !markedDay) unknown++;
    }
  }

  const hasDailyPlan = plannedTodayPending.length + plannedTodayCompleted.length > 0;
  const plannedTotal = plannedTodayPending.length + plannedTodayCompleted.length;
  const plannedDone = plannedTodayCompleted.length;
  const completedForDay = hasDailyPlan && plannedTotal > 0 && plannedTodayPending.length === 0;

  const extraCompletedToday = hasDailyPlan
    ? completed.filter((item) => item.plannedDate !== day)
    : [];

  const total = hasDailyPlan
    ? plannedTotal + extraCompletedToday.length
    : pending.length + completed.length;
  const done = hasDailyPlan
    ? plannedDone + extraCompletedToday.length
    : completed.length;

  const pendingFutureCount = hasDailyPlan
    ? pending.filter((item) => item.plannedDate !== day).length
    : pending.length;
  const pendingCheckValidation = completedForDay && pendingFutureCount > 0;

  const tomorrow = shiftMexicoDay(day, 1);
  const futurePendingDates = upcomingPending
    .map((item) => item.plannedDate || '')
    .filter((d) => d > day)
    .sort();
  const nextPlannedDate = futurePendingDates.includes(tomorrow)
    ? tomorrow
    : futurePendingDates[0] || null;

  const orderedItems = hasDailyPlan
    ? [...plannedTodayPending, ...plannedTodayCompleted, ...extraCompletedToday, ...upcomingPending, ...backlogPending]
    : [...pending, ...completed];

  return {
    items: orderedItems,
    pending: hasDailyPlan ? plannedTodayPending : pending,
    completed: hasDailyPlan ? [...plannedTodayCompleted, ...extraCompletedToday] : completed,
    history,
    unknown,
    total,
    done,
    percent: total ? Math.round((done * 100) / total) : 0,
    hasDailyPlan,
    plannedTotal,
    plannedDone,
    completedForDay,
    pendingFutureCount,
    pendingCheckValidation,
    nextPlannedDate,
    upcomingPending,
    backlogPending,
  };
}

export function dailyActivityChecks(activity: any, day = mexicoDate(activity.start)) {
  if (Array.isArray(activity.checklistItems) && (activity.checklistItems.length > 0 || !activity.checklistTotal)) {
    return dailyChecklist(activity.checklistItems, day);
  }
  const hasDailyPlan = Boolean(activity.completedForDay) || (
    Number(activity.dailyChecklistTotal) > 0 &&
    Number(activity.checklistTotal) > 0 &&
    Number(activity.dailyChecklistTotal) < Number(activity.checklistTotal)
  );
  const total = (activity.dailyChecklistTotal !== undefined ? activity.dailyChecklistTotal : (activity.todayChecklistCompleted !== undefined ? activity.checklistTotal : 0)) || 0;
  const done = activity.dailyChecklistCompleted ?? activity.todayChecklistCompleted ?? 0;
  const completedForDay = Boolean(activity.completedForDay) || (hasDailyPlan && total > 0 && done >= total);
  const pendingFutureCount = Number(activity.pendingFutureChecksCount ?? Math.max(0, (Number(activity.checklistTotal) || 0) - (Number(activity.checklistCompleted) || 0)));
  return {
    total,
    done,
    percent: total ? Math.round((done * 100) / total) : 0,
    hasDailyPlan,
    completedForDay,
    pendingFutureCount,
    pendingCheckValidation: Boolean(activity.pendingCheckValidation) || (completedForDay && pendingFutureCount > 0),
    nextPlannedDate: activity.nextPlannedChecklistDate || null,
  };
}

/** Actual checked state, independent of whether the marking date is known. */
export function checklistTotals(activity: any) {
  const items = Array.isArray(activity.checklistItems) ? activity.checklistItems : [];
  const hasItems = items.length > 0;
  const total = hasItems ? items.length : Math.max(0, Number(activity.checklistTotal) || 0);
  const done = hasItems ? items.filter((item: any) => item.isChecked).length : Math.max(0, Math.min(total, Number(activity.checklistCompleted) || 0));
  return { total, done, percent: total ? Math.round((done * 100) / total) : 0 };
}
