import { NotionCalendarActivity } from "@/types/anfeta";

export interface AutomationMoveResult {
  activityId: string;
  title: string;
  originalDate: string;
  targetDate: string;
  status: string;
  reason: string;
}

export interface AutomationRunReport {
  generatedAt: string;
  reviewed: number;
  moved: number;
  skippedCompleted: number;
  skippedSuspended: number;
  skippedReview: number;
  skippedLocked: number;
  failed: number;
  movements: AutomationMoveResult[];
}

export function simulateDailyAutomation(
  calendarCache: Record<string, NotionCalendarActivity[]>,
  todayStr: string,
  lookbackDays: number = 14
): AutomationRunReport {
  const report: AutomationRunReport = {
    generatedAt: new Date().toISOString(),
    reviewed: 0,
    moved: 0,
    skippedCompleted: 0,
    skippedSuspended: 0,
    skippedReview: 0,
    skippedLocked: 0,
    failed: 0,
    movements: [],
  };

  const todayDate = new Date(todayStr);

  for (let i = 1; i <= lookbackDays; i++) {
    const prevDate = new Date(todayDate);
    prevDate.setDate(todayDate.getDate() - i);
    const dateKey = prevDate.toISOString().split("T")[0];

    const activities = calendarCache[dateKey] || [];
    for (const act of activities) {
      report.reviewed++;

      const actTitle = act.title || (act as any).Title || "";
      if (act.isLocked || actTitle.includes("Bloqueada_ANFETA")) {
        report.skippedLocked++;
        continue;
      }

      if (act.isFinalized || act.status?.includes("zREVISION")) {
        report.skippedCompleted++;
        continue;
      }

      if (act.isCompletedForReview || act.status?.includes("rtuzREVISION")) {
        report.skippedReview++;
        continue;
      }

      const isPending =
        act.status?.includes("prtuz") ||
        actTitle.toLowerCase().includes("prtuzrevision");
      const isSuspended =
        act.isSuspended ||
        act.status?.includes("sprtuz") ||
        actTitle.toLowerCase().includes("sprtuzrevision");

      if (isPending || isSuspended) {
        report.moved++;
        report.movements.push({
          activityId: act.pageId,
          title: act.shortTitle || act.title,
          originalDate: dateKey,
          targetDate: todayStr,
          status: act.status,
          reason: isPending
            ? "Pendiente no completada de día anterior"
            : "Suspendida reprogramada a hoy",
        });
      }
    }
  }

  return report;
}
