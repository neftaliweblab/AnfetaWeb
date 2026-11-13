import type { PendingTaskItem } from '@/types/anfeta';
import { mexicoDate } from '@/services/calendarPresentation';

export const FIXED_FTF_BLOCK_ID = 'task-fixed-daily-ftf-block';

/** Returns true when a pending block resets automatically each new day. */
export function isRecurringPendingTask(task: Partial<PendingTaskItem> | null | undefined): boolean {
  return Boolean(task?.isRecurringDaily || task?.isFtfBlock || task?.id === FIXED_FTF_BLOCK_ID);
}

/** Returns true when the pending item represents the team daily FTF review block. */
export function isFtfPendingBlock(task: Partial<PendingTaskItem> | null | undefined): boolean {
  if (!task) return false;
  if (task.isFtfBlock || task.id === FIXED_FTF_BLOCK_ID) return true;
  if (!task.isRecurringDaily) return false;
  const text = `${task.title || ''} ${task.query || ''}`;
  return /\bftf\b/i.test(text);
}

/** Default fixed FTF daily schedule block seeded for every collaborator. */
export function buildFixedFtfBlock(today = mexicoDate()): PendingTaskItem {
  const nowIso = new Date().toISOString();
  return {
    id: FIXED_FTF_BLOCK_ID,
    title: 'FTF · Revisión diaria de agenda',
    description: 'Bloque fijo diario FTF (08:00 – 08:30). Al palomearlo se registra tu hora exacta de término en Bitácora y se reinicia mañana.',
    query: 'ftf',
    scheduledDate: today,
    startTime: '08:00',
    endTime: '08:30',
    isRecurringDaily: true,
    isFtfBlock: true,
    isCompleted: false,
    isAttended: false,
    isArchived: false,
    color: 'cyan',
    createdAt: nowIso,
  };
}

function completionDayForTask(task: PendingTaskItem): string {
  if (task.lastCompletedDate && /^\d{4}-\d{2}-\d{2}$/.test(task.lastCompletedDate)) {
    return task.lastCompletedDate;
  }
  const sourceIso = task.completedAt || task.updatedAt || task.createdAt || '';
  if (sourceIso) {
    const parsedDay = mexicoDate(sourceIso);
    if (parsedDay) return parsedDay;
  }
  if (task.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(task.scheduledDate)) {
    return task.scheduledDate;
  }
  return '';
}

/**
 * Resets checked recurring daily blocks once the Mexico City calendar day advances,
 * keeping their historical completion timestamps intact.
 */
export function normalizeRecurringPendingTasks(
  items: PendingTaskItem[],
  today = mexicoDate()
): { items: PendingTaskItem[]; changed: boolean } {
  let changed = false;
  const next = items.map((task) => {
    if (!isRecurringPendingTask(task)) return task;
    const recurringFlag = task.isRecurringDaily ?? true;
    const ftfFlag = task.isFtfBlock || task.id === FIXED_FTF_BLOCK_ID ? true : task.isFtfBlock;
    const wasDone = Boolean(task.isAttended || task.isCompleted);
    const doneDay = completionDayForTask(task);
    const needsReset = wasDone && doneDay !== today;
    const needsDateAdvance = !task.scheduledDate || task.scheduledDate < today;

    if (!needsReset && !needsDateAdvance && task.isRecurringDaily === recurringFlag && task.isFtfBlock === ftfFlag) {
      return task;
    }

    changed = true;
    if (needsReset) {
      return {
        ...task,
        isRecurringDaily: recurringFlag,
        ...(ftfFlag ? { isFtfBlock: true } : {}),
        isAttended: false,
        isCompleted: false,
        completedAt: '',
        lastCompletedDate: '',
        scheduledDate: today,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      ...task,
      isRecurringDaily: recurringFlag,
      ...(ftfFlag ? { isFtfBlock: true } : {}),
      scheduledDate: needsDateAdvance ? today : task.scheduledDate,
    };
  });

  return { items: changed ? next : items, changed };
}

/** Builds a state patch for toggling attended/completed status on a pending block. */
export function buildAttendedStatePatch(
  task: PendingTaskItem,
  nextAttended: boolean,
  now = new Date(),
  alsoToggleCompleted = false
): Partial<PendingTaskItem> {
  const today = mexicoDate(now);
  const nowIso = now.toISOString();
  const recurring = isRecurringPendingTask(task);
  const existingHistory = Array.isArray(task.recurrenceCompletions)
    ? task.recurrenceCompletions.filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date !== today)
    : [];

  if (nextAttended) {
    return {
      isAttended: true,
      ...(alsoToggleCompleted ? { isCompleted: true } : {}),
      completedAt: nowIso,
      lastCompletedDate: today,
      ...(recurring
        ? {
            isRecurringDaily: true,
            scheduledDate: today,
            recurrenceCompletions: [...existingHistory, { date: today, completedAt: nowIso }].slice(-30),
          }
        : {}),
      updatedAt: nowIso,
    };
  }

  return {
    isAttended: false,
    ...(alsoToggleCompleted ? { isCompleted: false } : {}),
    completedAt: '',
    lastCompletedDate: '',
    ...(recurring ? { recurrenceCompletions: existingHistory.slice(-30) } : {}),
    updatedAt: nowIso,
  };
}

/** Looks up the recorded ISO completion timestamp for an FTF pending block on a specific day. */
export function resolveFtfBlockCompletionForDay(
  tasks: PendingTaskItem[] | unknown,
  day: string
): string | null {
  if (!Array.isArray(tasks)) return null;
  let latestMs = -1;
  let latestIso: string | null = null;

  for (const raw of tasks) {
    if (!raw || typeof raw !== 'object') continue;
    const task = raw as PendingTaskItem;
    if (!isFtfPendingBlock(task)) continue;

    if ((task.isAttended || task.isCompleted) && task.lastCompletedDate === day && task.completedAt) {
      const ms = Date.parse(task.completedAt);
      if (Number.isFinite(ms) && ms > latestMs) {
        latestMs = ms;
        latestIso = task.completedAt;
      }
    }

    if (Array.isArray(task.recurrenceCompletions)) {
      for (const entry of task.recurrenceCompletions) {
        if (entry?.date === day && entry?.completedAt) {
          const ms = Date.parse(entry.completedAt);
          if (Number.isFinite(ms) && ms > latestMs) {
            latestMs = ms;
            latestIso = entry.completedAt;
          }
        }
      }
    }
  }

  return latestIso;
}

/** Keeps a bounded list of deleted pending IDs so cross-sync and seeds never resurrect deleted tasks. */
export function mergeDeletedPendingIds(
  existing: unknown,
  addedDeletedIds: string[],
  activeIds: Iterable<string>
): string[] {
  const active = new Set(activeIds);
  const combined = new Set<string>();
  if (Array.isArray(existing)) {
    for (const id of existing) {
      if (typeof id === 'string' && id.trim() && !active.has(id.trim())) {
        combined.add(id.trim());
      }
    }
  }
  for (const id of addedDeletedIds) {
    if (typeof id === 'string' && id.trim() && !active.has(id.trim())) {
      combined.add(id.trim());
    }
  }
  return [...combined].slice(-300);
}
