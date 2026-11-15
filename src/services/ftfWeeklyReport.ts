import fs from 'node:fs';
import path from 'node:path';
import { getPublicBaseUrl } from '@/lib/activityCanonicalLink';
import { mexicoDate } from '@/services/calendarPresentation';
import { readDailySnapshotMirrors } from '@/services/checklistPlanning';
import { normalizeActivity } from '@/services/dataNormalizers';
import {
  buildFtfWeek,
  ftfWeekStart,
  type MealBreakWindow,
  shiftFtfDate,
} from '@/services/ftfDashboard';
import { readFtfPresenceHistory } from '@/services/ftfPresenceHistory';
import {
  type FtfEmailDeliveryResult,
  sendWeeklyFtfReportEmail,
} from '@/services/ftfScoreDelivery';
import {
  buildWeeklyPayrollMatrix,
  getMexicoTimeMinutes,
  mergeWeeklyReportScores,
  type SavedFtfScoreEntry,
} from '@/services/ftfScoring';
import { ftfState } from '@/services/ftfVerification';
import { queryCalendarPages } from '@/services/notionCalendar';
import { calendarActivityFromPage } from '@/services/notionEventSync';
import { getSettings } from '@/services/serverSettings';
import { activeTeam } from '@/services/teamDirectory';
import { readUserState } from '@/services/userState';

function readJsonDataFile<T>(filename: string, fallback: T): T {
  const candidates = [
    path.join(process.cwd(), 'data', filename),
    path.join(
      'C:\\Users\\nanoc\\AppData\\Local\\Packages\\c6d297e3-90b3-45d7-8116-b599de47cc6a_jwwtc8z12084g\\LocalState',
      filename
    ),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
      }
    } catch {}
  }
  return fallback;
}

export async function buildAndSendWeeklyFtfReport(params: {
  actor: string;
  targetDate?: string;
  recipientOverride?: string;
  reportBaseUrl?: string;
  notionTokenOverride?: string;
}) {
  const settings = getSettings();
  const effectiveSettings = params.notionTokenOverride
    ? { ...settings, notionToken: params.notionTokenOverride }
    : settings;

  const now = new Date();
  const todayMexico = mexicoDate(now);
  const resolvedDate =
    params.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(params.targetDate)
      ? params.targetDate
      : todayMexico;

  const weekStart = ftfWeekStart(resolvedDate);
  const weekEnd = shiftFtfDate(weekStart, 4);
  const queryEnd = shiftFtfDate(weekStart, 7);
  const weekDatesMonToFri = [0, 1, 2, 3, 4].map((offset) => shiftFtfDate(weekStart, offset));

  const [pages, people, johnState, presence] = await Promise.all([
    queryCalendarPages(effectiveSettings, weekStart, queryEnd, false),
    activeTeam(),
    readUserState(effectiveSettings, 'John'),
    readFtfPresenceHistory(weekStart, queryEnd).catch(() => []),
  ]);

  const dataSourceId =
    process.env.NOTION_CALENDAR_DATA_SOURCE_ID || effectiveSettings.notionDataSourceId;
  const activities = pages.map((page: any) =>
    normalizeActivity(
      {
        ...calendarActivityFromPage(page, dataSourceId),
        ...ftfState(page),
      },
      0
    )
  );

  const cachedFlat = Object.values(
    readJsonDataFile<Record<string, any[]>>('notion_calendar_cache_v13.json', {})
  )
    .flat()
    .map((a) => normalizeActivity(a, 0));

  const snapshotMirrors = await readDailySnapshotMirrors(effectiveSettings, weekStart, queryEnd, [
    ...cachedFlat,
    ...activities,
  ]).catch(() => []);
  const combinedActivities = [
    ...activities,
    ...snapshotMirrors.map((a) => normalizeActivity(a, 0)),
  ];

  const mealBreaks = readJsonDataFile<Record<string, MealBreakWindow>>('meal_breaks.json', {});
  const savedScoresByDate = readJsonDataFile<
    Record<string, Record<string, SavedFtfScoreEntry>>
  >('ftf_daily_scores.json', {});

  const week = buildFtfWeek(
    params.actor,
    weekStart,
    people,
    combinedActivities,
    johnState.values?.receipts?.ftfCompletions || {},
    presence,
    now,
    mealBreaks
  );

  const mergedScoresByDate = mergeWeeklyReportScores(
    week.days,
    weekDatesMonToFri,
    savedScoresByDate,
    todayMexico,
    getMexicoTimeMinutes(now)
  );

  const teamNames = [...new Set(week.days.flatMap((d) => d.people.map((p) => p.name)))];
  const matrix = buildWeeklyPayrollMatrix(weekDatesMonToFri, teamNames, mergedScoresByDate);

  const baseUrl = getPublicBaseUrl(params.reportBaseUrl);
  const reportUrl = `${baseUrl}/?ftf=week`;

  const email: FtfEmailDeliveryResult = await sendWeeklyFtfReportEmail({
    apiKey: effectiveSettings.resendApiKey,
    smtpUser: effectiveSettings.smtpUser,
    smtpPass: effectiveSettings.smtpPass,
    smtpHost: effectiveSettings.smtpHost,
    smtpPort: effectiveSettings.smtpPort,
    from: effectiveSettings.ftfEmailFrom,
    to: params.recipientOverride || effectiveSettings.ftfEmailTo,
    weekStart,
    weekEnd,
    weekDates: weekDatesMonToFri,
    matrix,
    generatedAt: now.toISOString(),
    reportUrl,
  });

  return {
    weekStart,
    weekEnd,
    weekDates: weekDatesMonToFri,
    reportUrl,
    matrix,
    email,
  };
}
