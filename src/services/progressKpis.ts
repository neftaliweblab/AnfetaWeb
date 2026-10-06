import { NotionCalendarActivity, DailyProgressKPIs } from "@/types/anfeta";
import { workflowState } from './activityWorkflow';
import { normalizePerson } from "./identityNormalizer";

export interface ActivityLagStatus {
  isLagging: boolean;
  isMissingChecklist: boolean;
  reason?: string;
}

export function evaluateLagStatus(
  activity: NotionCalendarActivity,
  currentTime: Date = new Date()
): ActivityLagStatus {
  const isPendingStatus = workflowState(activity.status, activity.title) === "pending";

  if (!isPendingStatus) {
    return { isLagging: false, isMissingChecklist: false };
  }

  const endParts = activity.end ? new Date(activity.end) : null;
  const isPastEnd = endParts ? currentTime.getTime() >= endParts.getTime() : false;

  if (!activity.checklistScanned || activity.checklistTotal === 0) {
    return {
      isLagging: false,
      isMissingChecklist: true,
      reason: "Dato faltante (sin checklist)",
    };
  }

  const progressTodayPct =
    activity.checklistTotal > 0
      ? (activity.todayChecklistCompleted / activity.checklistTotal) * 100
      : 0;

  if (isPastEnd && progressTodayPct < 33) {
    return {
      isLagging: true,
      isMissingChecklist: false,
      reason: `Rezago: ${Math.round(progressTodayPct)}% avance tras hora límite`,
    };
  }

  return { isLagging: false, isMissingChecklist: false };
}

export function computeDailyKPIs(
  activities: NotionCalendarActivity[],
  dateStr: string,
  now: Date = new Date()
): DailyProgressKPIs {
  activities = activities.filter(activity => !activity.isReviewMirror);
  let scheduledMinutes = 0;
  let progressMinutes = 0;
  let laggingCount = 0;
  let reviewCount = 0;
  let completedCount = 0;
  let missingChecklistCount = 0;

  for (const act of activities) {
    const startD = act.start ? new Date(act.start).getTime() : 0;
    const endD = act.end ? new Date(act.end).getTime() : 0;
    const durMin = endD > startD ? Math.round((endD - startD) / 60000) : 60;

    scheduledMinutes += durMin;

    const lag = evaluateLagStatus(act, now);
    if (lag.isLagging) laggingCount++;
    if (lag.isMissingChecklist) missingChecklistCount++;

    if (workflowState(act.status, act.title) === "review" || (workflowState(act.status, act.title) === "unknown" && act.isCompletedForReview)) {
      reviewCount++;
    }
    if (workflowState(act.status, act.title) === "completed" || (workflowState(act.status, act.title) === "unknown" && act.isFinalized)) {
      completedCount++;
    }

    const pctToday =
      act.checklistTotal > 0
        ? Math.min(100, (act.todayChecklistCompleted / act.checklistTotal) * 100)
        : act.isFinalized
        ? 100
        : 0;

    progressMinutes += durMin * (pctToday / 100);
  }

  const coveragePercentage =
    scheduledMinutes > 0
      ? Math.round((progressMinutes / scheduledMinutes) * 100)
      : 0;

  return {
    date: dateStr,
    coveragePercentage,
    totalActivities: activities.length,
    laggingCount,
    reviewCount,
    completedCount,
    scheduledMinutes,
    progressMinutes: Math.round(progressMinutes),
    missingChecklistCount,
  };
}

export function getForecastStatus(
  act: NotionCalendarActivity,
  now: Date = new Date()
): string {
  const budget =
    act.estimatedWorkMinutes > 0 ? act.estimatedWorkMinutes : 60;
  const pct =
    act.checklistTotal > 0
      ? (act.todayChecklistCompleted / act.checklistTotal) * 100
      : 0;
  const remainingMin = Math.max(0, budget - (budget * pct) / 100);

  if (remainingMin <= 0 || act.isFinalized) {
    return "Terminada según avance actual";
  }

  const endD = act.end ? new Date(act.end).getTime() : 0;
  const minutesLeftInSchedule = Math.max(
    0,
    Math.round((endD - now.getTime()) / 60000)
  );

  if (remainingMin <= minutesLeftInSchedule) {
    return "Sí puede terminar hoy dentro de su horario";
  }

  return "En riesgo: el restante ya no cabe hoy";
}

export function generateMarkdownReport(
  kpis: DailyProgressKPIs,
  activities: NotionCalendarActivity[]
): string {
  const lines: string[] = [
    `# 📊 Reporte Ejecutivo de Avance Diario ANFETA`,
    `**Fecha:** ${kpis.date}`,
    `**Cobertura Total Ponderada:** ${kpis.coveragePercentage}% (${kpis.progressMinutes} min / ${kpis.scheduledMinutes} min)`,
    `**Resumen:** ${kpis.totalActivities} actividades | 🚨 ${kpis.laggingCount} rezagos | 🔍 ${kpis.reviewCount} revisión | ✅ ${kpis.completedCount} finalizadas`,
    ``,
    `### Desglose de Actividades:`,
  ];

  for (const act of activities) {
    const person = normalizePerson(act.person);
    const domain = act.domain || "general";
    const status = act.status || "P";
    const checks = `${act.todayChecklistCompleted}/${act.checklistTotal}`;
    lines.push(
      `- [${person}] **${domain}**: ${act.shortTitle || act.title} (${status}) — Checklist: ${checks}`
    );
  }

  return lines.join("\n");
}
