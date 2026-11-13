import { PendingTaskItem } from "@/types/anfeta";

export interface ParsedTaskTime {
  hasTime: boolean;
  timeMinutes: number;
  endMinutes: number;
  timeBadge: string;
}

/**
 * Normalizes a minute offset to 12h clock string, e.g. 570 -> "9:30 AM", 1500 -> "1:00 AM (+1d)".
 */
export function formatMinutes12h(totalMinutes: number, includeNextDaySuffix = false): string {
  const isNextDay = totalMinutes >= 1440;
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const dispH = h % 12 || 12;
  const meridian = h >= 12 ? "PM" : "AM";
  const base = `${dispH}:${String(m).padStart(2, "0")} ${meridian}`;
  return includeNextDaySuffix && isNextDay ? `${base} (+1d)` : base;
}

/**
 * Parses start/end minutes from task title or metadata, keeping post-midnight shifts (>= 1440) in extended coordinates.
 */
export function parseTaskTime(task: PendingTaskItem, defaultDurationMinutes = 60): ParsedTaskTime {
  const title = (task.title || "").trim();
  const applyPostMidnight = (tMin: number) =>
    task.isPostMidnight && tMin < 360 ? tMin + 1440 : tMin;

  const rangeMatch = title.match(
    /(?:^|\b)(\d{1,2})(?:[:.](\d{2}))?\s*(?:(am|pm)(?:[.\s]*(?:am|pm))*)?\s*(?:-|a|al|to)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:(am|pm)(?:[.\s]*(?:am|pm))*)?(?=\s|[·•\-A-Za-zÀ-ÿ]|$)/i
  );
  const singleMatch = title.match(/(?:^|\b)(\d{1,2})(?:[:.](\d{2}))?\s*(?:(am|pm|hrs?|h)(?:\s*(?:am|pm|hrs?|h))*)?(?=\s|[·•\-A-Za-zÀ-ÿ]|$)/i);
  const rangeHasExplicitClock = Boolean(
    rangeMatch && (rangeMatch[2] || rangeMatch[3] || rangeMatch[5] || rangeMatch[6])
  );
  const singlePrecedesBareRange = Boolean(
    rangeMatch &&
      !rangeHasExplicitClock &&
      singleMatch &&
      (singleMatch.index ?? 9999) < (rangeMatch.index ?? 9999)
  );
  if (rangeMatch && !singlePrecedesBareRange && (rangeHasExplicitClock || !/\([^)]*\)/.test(rangeMatch[0]))) {
    let h1 = parseInt(rangeMatch[1], 10);
    const m1 = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const mer1 = rangeMatch[3]?.toLowerCase();

    let h2 = parseInt(rangeMatch[4], 10);
    const m2 = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0;
    const mer2 = rangeMatch[6]?.toLowerCase() || mer1;

    if (mer1 === "pm" && h1 < 12) h1 += 12;
    if (mer1 === "am" && h1 === 12) h1 = 0;
    if (!mer1 && h1 >= 1 && h1 <= 6) h1 += 12;

    if (mer2 === "pm" && h2 < 12) h2 += 12;
    if (mer2 === "am" && h2 === 12) h2 = 0;
    if (!mer2 && h2 >= 1 && h2 <= 6) h2 += 12;

    const t1 = applyPostMidnight(h1 * 60 + m1);
    let t2 = applyPostMidnight(h2 * 60 + m2);
    if (t2 <= t1) t2 = t1 + defaultDurationMinutes;

    const w1 = ((t1 % 1440) + 1440) % 1440;
    const wh1 = Math.floor(w1 / 60);
    const wm1 = w1 % 60;
    const b1 = `${wh1 % 12 || 12}:${String(wm1).padStart(2, "0")}`;
    const b2 = formatMinutes12h(t2, t2 >= 1440);
    return {
      hasTime: true,
      timeMinutes: t1,
      endMinutes: t2,
      timeBadge: `${b1} - ${b2}`,
    };
  }

  if (singleMatch) {
    let hours = parseInt(singleMatch[1], 10);
    const minutes = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;
    const meridian = singleMatch[3]?.toLowerCase();

    if (hours >= 0 && hours <= 24 && minutes >= 0 && minutes < 60) {
      if (meridian === "pm" && hours < 12) hours += 12;
      else if (meridian === "am" && hours === 12) hours = 0;
      else if (!meridian && hours >= 1 && hours <= 6) hours += 12;

      const timeMinutes = applyPostMidnight(hours * 60 + minutes);
      const endMinutes = timeMinutes + defaultDurationMinutes;
      return {
        hasTime: true,
        timeMinutes,
        endMinutes,
        timeBadge: formatMinutes12h(timeMinutes, timeMinutes >= 1440),
      };
    }
  }

  if (task.startTime) {
    const [sh, sm] = task.startTime.split(":").map((v) => parseInt(v || "0", 10));
    const startM = applyPostMidnight(sh * 60 + sm);
    let endM = startM + defaultDurationMinutes;
    if (task.endTime) {
      const [eh, em] = task.endTime.split(":").map((v) => parseInt(v || "0", 10));
      endM = applyPostMidnight(eh * 60 + em);
      if (endM <= startM) endM = startM + defaultDurationMinutes;
    }
    return {
      hasTime: true,
      timeMinutes: startM,
      endMinutes: endM,
      timeBadge: formatMinutes12h(startM, startM >= 1440),
    };
  }

  if (task.scheduledDate) {
    const timeMatch = task.scheduledDate.match(/T(\d{2}):(\d{2})/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const tMin = applyPostMidnight(h * 60 + m);
      return {
        hasTime: true,
        timeMinutes: tMin,
        endMinutes: tMin + defaultDurationMinutes,
        timeBadge: formatMinutes12h(tMin, tMin >= 1440),
      };
    }
  }

  return { hasTime: false, timeMinutes: 99999, endMinutes: 99999, timeBadge: "" };
}

function formatHHMM(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Replaces or prepends the leading time expression in a task title cleanly.
 * Guarantees only a single AM/PM token is written, strips duplicated/glued AM/PM tokens
 * (e.g. "6:00 PMPMPMprueba" -> "6:00 PM prueba"), and handles full ranges cleanly.
 */
export function rewriteTitleWithTime(title: string, targetMinutes: number, targetEndMinutes?: number): string {
  const timeStr = formatMinutes12h(targetMinutes, false);
  const dedupeMeridians = (s: string) =>
    s
      .replace(/(\d{1,2}:\d{2}\s*(?:AM|PM))(?:\s*(?:AM|PM))+/gi, "$1")
      .replace(/(\d{1,2}:\d{2}\s*(?:AM|PM))([^\s·•\-])/gi, "$1 $2");

  const rangeRegex =
    /(?:^|\b)\d{1,2}(?:[:.]\d{2})?\s*(?:(?:am|pm|a\.?m\.?|p\.?m\.?|hrs?|h)+)?\s*(?:-|a|al|to)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:(?:am|pm|a\.?m\.?|p\.?m\.?|hrs?|h)+)?(\s*[·•\-]\s*|\s*)/i;
  if (rangeRegex.test(title)) {
    const endMin =
      typeof targetEndMinutes === "number" && targetEndMinutes > targetMinutes
        ? targetEndMinutes
        : targetMinutes + 60;
    const replacement = `${timeStr} - ${formatMinutes12h(endMin, false)}`;
    const updated = title.replace(rangeRegex, (_, sep: string) => {
      if (!sep) return replacement;
      return sep.includes("·") || sep.includes("•") || sep.includes("-")
        ? `${replacement} ${sep.trim()} `
        : `${replacement} `;
    });
    return dedupeMeridians(updated).trim();
  }

  const timeTokenRegex =
    /(?:^|\b)\d{1,2}(?:[:.]\d{2})?\s*(?:(?:am|pm|a\.?m\.?|p\.?m\.?|hrs?|h)+)?(\s*[·•\-]\s*|\s*)/i;
  if (timeTokenRegex.test(title)) {
    const updated = title.replace(timeTokenRegex, (full, sep: string, offset: number) => {
      const after = title.slice(offset + full.length);
      if (!after.trim()) return timeStr;
      if (sep && (sep.includes("·") || sep.includes("•") || sep.includes("-"))) {
        return `${timeStr} ${sep.trim()} `;
      }
      return `${timeStr} `;
    });
    return dedupeMeridians(updated).trim();
  }
  return `${timeStr} · ${title}`.trim();
}

/**
 * Shifts a task's time by `deltaMinutes` while preventing wrap-around back to 00:00 of the same morning.
 * Shifts crossing midnight (>= 1440 up to 1680 = 04:00 AM next day) mark `isPostMidnight: true`.
 */
export function shiftTaskSchedule(
  task: PendingTaskItem,
  deltaMinutes: number,
  defaultDurationMinutes = 60
): { title: string; timeMinutes: number; endMinutes: number; startTime?: string; endTime?: string; isPostMidnight: boolean } | null {
  const parsed = parseTaskTime(task, defaultDurationMinutes);
  if (!parsed.hasTime) return null;

  const duration = Math.max(15, parsed.endMinutes - parsed.timeMinutes);
  let newMin = parsed.timeMinutes + deltaMinutes;
  // Prevent wrapping backwards past 00:00 unless already early morning
  if (newMin < 0) newMin = 0;
  // Cap extended post-midnight schedule at 04:00 AM next day (1680 min)
  if (newMin > 1680) newMin = 1680;
  const newEndMin = newMin + duration;

  return {
    title: rewriteTitleWithTime(task.title, newMin, newEndMin),
    timeMinutes: newMin,
    endMinutes: newEndMin,
    ...(task.startTime ? { startTime: formatHHMM(newMin), endTime: formatHHMM(newEndMin) } : {}),
    isPostMidnight: newMin >= 1440,
  };
}

/**
 * Moves any task (timed or untimed) to a specific minute slot (`targetStartMinutes`),
 * preserving its original duration when available.
 */
export function moveTaskToMinutes(
  task: PendingTaskItem,
  targetStartMinutes: number,
  defaultDurationMinutes = 30
): { title: string; timeMinutes: number; endMinutes: number; startTime?: string; endTime?: string; isPostMidnight: boolean } {
  const parsed = parseTaskTime(task, defaultDurationMinutes);
  const duration = parsed.hasTime ? Math.max(15, parsed.endMinutes - parsed.timeMinutes) : defaultDurationMinutes;
  const clampedStart = Math.max(0, Math.min(1680, targetStartMinutes));
  const clampedEnd = clampedStart + duration;

  return {
    title: rewriteTitleWithTime(task.title, clampedStart, clampedEnd),
    timeMinutes: clampedStart,
    endMinutes: clampedEnd,
    ...(task.startTime ? { startTime: formatHHMM(clampedStart), endTime: formatHHMM(clampedEnd) } : {}),
    isPostMidnight: clampedStart >= 1440,
  };
}

/**
 * Collects unfinished overdue timed tasks (`endMinutes <= nowMinutes`) and reschedules either
 * all of them (`mode: 'all'`) or only the latest overdue task (`mode: 'last'`) consecutively into
 * the next free blocks starting from `nowMinutes`.
 */
export function computeCatchUpSchedule(
  tasks: PendingTaskItem[],
  nowMinutes: number,
  stepMinutes: 30 | 60 = 30,
  options?: { mode?: "all" | "last" }
): Array<{
  task: PendingTaskItem;
  newTitle: string;
  newStartMinutes: number;
  newEndMinutes: number;
  startTime?: string;
  endTime?: string;
  isPostMidnight: boolean;
}> {
  const overdue = tasks
    .filter((t) => {
      if (t.isCompleted || t.isAttended || t.isArchived) return false;
      const parsed = parseTaskTime(t, stepMinutes);
      return parsed.hasTime && parsed.endMinutes <= nowMinutes;
    })
    .sort((a, b) => parseTaskTime(a, stepMinutes).timeMinutes - parseTaskTime(b, stepMinutes).timeMinutes);

  if (overdue.length === 0) return [];

  const anchorStart = Math.max(nowMinutes, Math.ceil(nowMinutes / stepMinutes) * stepMinutes);
  const overdueIds = new Set(overdue.map((t) => t.id));
  const occupiedSlots = new Set<number>();
  for (const t of tasks) {
    if (overdueIds.has(t.id) || t.isArchived || t.isCompleted) continue;
    const parsed = parseTaskTime(t, stepMinutes);
    if (!parsed.hasTime || parsed.timeMinutes < anchorStart) continue;
    const bucket = Math.floor(parsed.timeMinutes / stepMinutes) * stepMinutes;
    occupiedSlots.add(bucket);
  }

  let cursor = anchorStart;
  const allocateNextSlot = () => {
    while (occupiedSlots.has(cursor) && cursor < 1680) {
      cursor = Math.min(1680, cursor + stepMinutes);
    }
    const chosen = cursor;
    occupiedSlots.add(chosen);
    cursor = Math.min(1680, chosen + stepMinutes);
    return chosen;
  };

  const targets = options?.mode === "last" ? [overdue[overdue.length - 1]] : overdue;
  return targets.map((task) => {
    const parsed = parseTaskTime(task, stepMinutes);
    const duration = Math.max(stepMinutes, parsed.endMinutes - parsed.timeMinutes);
    const slotMin = allocateNextSlot();
    const slotEnd = slotMin + duration;
    return {
      task,
      newTitle: rewriteTitleWithTime(task.title, slotMin, slotEnd),
      newStartMinutes: slotMin,
      newEndMinutes: slotEnd,
      ...(task.startTime ? { startTime: formatHHMM(slotMin), endTime: formatHHMM(slotEnd) } : {}),
      isPostMidnight: slotMin >= 1440,
    };
  });
}

/**
 * Strips internal collaborator/project tags (e.g. "nne00", "kkarl", "26-08AGO", "pprin")
 * so clicking a review notification populates a clean domain/title search query.
 */
export function simplifyReviewSearchQuery(rawTitle: string, domain?: string): string {
  const cleaned = (rawTitle || "")
    .replace(/^\[COPIA REVISI[ÓO]N\]\s*/i, "")
    // Strip collaborator / prefix tags like nneft, jjohn, kkarl, eedua, aacal, bbrai, ggena, iisai, ssote, aandr
    .replace(/\b(?:nne\w*|jjoh\w*|kkar\w*|eed\w*|aac\w*|bbri\w*|ggen\w*|iis\w*|ssot\w*|aand\w*)\b/gi, " ")
    // Strip date/type codes like 26-08AGO, 00.10, ppref, ddise, etc.
    .replace(/\b\d{2}-\d{2}[a-zA-Z]{3}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (domain && domain.trim()) {
    const cleanDomain = domain.trim();
    if (!cleaned) return cleanDomain;
    if (cleaned.toLowerCase().includes(cleanDomain.toLowerCase())) return cleaned;
    return `${cleanDomain} ${cleaned}`.trim();
  }
  return cleaned || rawTitle.trim();
}
