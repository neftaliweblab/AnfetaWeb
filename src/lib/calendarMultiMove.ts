import type { NotionCalendarActivity } from "@/types/anfeta";
import { canEditActivity } from "@/services/activityPermissions";
import { workflowState } from "@/services/activityWorkflow";
import { mexicoDate, mexicoMinutes } from "@/services/calendarPresentation";
import { normalizePerson } from "@/services/identityNormalizer";

export interface BatchScheduleChange {
  pageId: string;
  title: string;
  expectedTitle: string;
  expectedStart: string;
  expectedEnd: string;
  start: string;
  end: string;
  person?: string;
  allowOverlap: true;
}

const DAY_START_MIN = 480; // 08:00
const DAY_END_MIN = 1320; // 22:00
const BOTTOM_TRAY_START_MIN = 1260; // 21:00

export function formatMexicoScheduleIso(date: string, totalMinutes: number): string {
  const clamped = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, Math.round(totalMinutes)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${date}T${hh}:${mm}:00-06:00`;
}

export function isMovableCalendarActivity(
  activity: Partial<NotionCalendarActivity>,
  currentUser: string
): boolean {
  if (!activity?.pageId || !activity.start || !activity.end) return false;
  if (!canEditActivity(currentUser, activity)) return false;
  if (workflowState(activity.status || "", activity.title) === "completed") return false;
  const historicalMove = /(?<![\p{L}\p{Nd}_])zREVISION(?![\p{L}\p{Nd}_])/iu.test(
    `${activity.status || ""} ${activity.title || ""}`
  );
  return !historicalMove;
}

function resolveDurationMinutes(activity: NotionCalendarActivity): number {
  const raw = (Date.parse(activity.end) - Date.parse(activity.start)) / 60000;
  if (!Number.isFinite(raw) || raw <= 0) return 60;
  const snapped = Math.max(15, Math.round(raw / 5) * 5);
  return Math.min(840, snapped);
}

/**
 * Computes batch schedule updates shifting each movable activity by `deltaMinutes`
 * within [08:00, 22:00] while preserving each card's duration.
 */
export function buildMultiDeltaScheduleChanges(
  activities: NotionCalendarActivity[],
  date: string,
  deltaMinutes: number,
  currentUser: string,
  targetPerson?: string
): BatchScheduleChange[] {
  const step = deltaMinutes % 15 === 0 ? 15 : 5;
  const snappedDelta = Math.round(deltaMinutes / step) * step;
  const normalizedTarget = targetPerson ? normalizePerson(targetPerson) : undefined;
  const changes: BatchScheduleChange[] = [];

  for (const act of activities) {
    if (!isMovableCalendarActivity(act, currentUser)) continue;
    if (mexicoDate(act.start) !== date) continue;

    const origStartMin = Math.max(DAY_START_MIN, mexicoMinutes(act.start));
    const durationMin = resolveDurationMinutes(act);
    const maxStart = Math.max(DAY_START_MIN, Math.floor((DAY_END_MIN - durationMin) / 5) * 5);
    const nextStartMin = Math.max(DAY_START_MIN, Math.min(maxStart, origStartMin + snappedDelta));
    const nextEndMin = Math.min(DAY_END_MIN, nextStartMin + durationMin);

    const start = formatMexicoScheduleIso(date, nextStartMin);
    const end = formatMexicoScheduleIso(date, nextEndMin);
    const currentOwner = normalizePerson(act.person);
    const personChanged = Boolean(
      normalizedTarget && normalizedTarget !== "Sin asignar" && normalizedTarget !== currentOwner
    );

    if (nextStartMin === origStartMin && nextEndMin === origStartMin + durationMin && !personChanged) {
      continue;
    }

    changes.push({
      pageId: act.pageId,
      title: act.title,
      expectedTitle: act.title,
      expectedStart: act.start,
      expectedEnd: act.end,
      start,
      end,
      ...(personChanged ? { person: normalizedTarget } : {}),
      allowOverlap: true,
    });
  }

  return changes;
}

/**
 * Moves movable activities to the bottom tray of the day (21:00-22:00 by default)
 * so the user can drag them back up into clean priority order.
 */
export function buildPushDownScheduleChanges(
  activities: NotionCalendarActivity[],
  date: string,
  currentUser: string,
  options?: { normalizeOneHour?: boolean; onlyPending?: boolean }
): BatchScheduleChange[] {
  const normalizeOneHour = options?.normalizeOneHour !== false;
  const onlyPending = options?.onlyPending === true;
  const changes: BatchScheduleChange[] = [];

  for (const act of activities) {
    if (!isMovableCalendarActivity(act, currentUser)) continue;
    if (mexicoDate(act.start) !== date) continue;
    if (onlyPending && workflowState(act.status, act.title) === "review") continue;

    const durationMin = normalizeOneHour ? 60 : resolveDurationMinutes(act);
    const targetStartMin = normalizeOneHour
      ? BOTTOM_TRAY_START_MIN
      : Math.max(DAY_START_MIN, Math.floor((DAY_END_MIN - durationMin) / 15) * 15);
    const targetEndMin = Math.min(DAY_END_MIN, targetStartMin + durationMin);

    const origStartMin = mexicoMinutes(act.start);
    const origEndMin = mexicoMinutes(act.end);
    if (origStartMin === targetStartMin && origEndMin === targetEndMin) {
      continue;
    }

    changes.push({
      pageId: act.pageId,
      title: act.title,
      expectedTitle: act.title,
      expectedStart: act.start,
      expectedEnd: act.end,
      start: formatMexicoScheduleIso(date, targetStartMin),
      end: formatMexicoScheduleIso(date, targetEndMin),
      allowOverlap: true,
    });
  }

  return changes;
}
