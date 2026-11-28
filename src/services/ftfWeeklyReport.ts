import {reportPublicUrl} from '@/lib/reportPublicUrl';
import fs from 'node:fs';
import path from 'node:path';
import type { NotionCalendarActivity } from '@/types/anfeta';
import type { getSettings } from '@/services/serverSettings';
import type { MealBreakWindow } from '@/services/ftfDashboard';
import type { SavedFtfScoreEntry, WeeklyPayrollRow } from '@/services/ftfScoring';
import { workflowState } from '@/services/activityWorkflow';
import { inferActivityPerson } from '@/services/activityTags';
import { mexicoDate } from '@/services/calendarPresentation';
import { readDailySnapshotMirrors } from '@/services/checklistPlanning';
import { normalizeActivity } from '@/services/dataNormalizers';
import { financeDateField, financeStatus } from '@/services/financeRules';
import { buildFtfWeek, ftfWeekStart, shiftFtfDate } from '@/services/ftfDashboard';
import {
  buildWeeklyPayrollMatrix,
  getMexicoTimeMinutes,
  mergeWeeklyReportScores,
} from '@/services/ftfScoring';
import {
  sendWeeklyFtfReportEmail,
  type FtfEmailDeliveryResult,
} from '@/services/ftfScoreDelivery';
import {
  loadHistoricalFtfRecovery,
  readFtfStore,
  saveFtfDayArchive,
} from '@/services/ftfHistoryStore';
import { ftfState } from '@/services/ftfVerification';
import { notionStatusValue } from '@/services/notionStatusValue';

const LOCAL_STATE_DIR =
  'C:\\Users\\nanoc\\AppData\\Local\\Packages\\c6d297e3-90b3-45d7-8116-b599de47cc6a_jwwtc8z12084g\\LocalState';
const PROJECT_DATA_DIR = path.join(process.cwd(), 'data');

export interface ExtractedWeeklyPageData {
  sourceName?: string;
  id: string;
  url: string;
  title: string;
  status: string;
  dateStart: string;
  dateEnd?: string;
  person: string;
  domain: string;
  lastEdited: string;
  ftfVerified: boolean;
  ftfAvailable: boolean;
  isLocked: boolean;
}

export interface HydrateWeeklyActivitiesInput {
  pages: any[];
  cachedFlat: NotionCalendarActivity[];
  extractPage: (page: any) => ExtractedWeeklyPageData;
  resolveReviewFlow: (page: any, wf: ReturnType<typeof workflowState>) => Promise<any>;
}

export interface WeeklyFtfReportResult {
  weekStart: string;
  weekEnd: string;
  workDates: string[];
  matrix: WeeklyPayrollRow[];
  week: ReturnType<typeof buildFtfWeek>;
  email: FtfEmailDeliveryResult;
}

function cleanPageId(id: string) {
  return String(id || '').replace(/-/g, '').toLowerCase();
}

export function readWeeklyLocalJson<T>(filename: string, defaultValue: T): T {
  try {
    const projectPath = path.join(PROJECT_DATA_DIR, filename);
    if (fs.existsSync(projectPath)) {
      return JSON.parse(fs.readFileSync(projectPath, 'utf-8')) as T;
    }
    const localPath = path.join(LOCAL_STATE_DIR, filename);
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, 'utf-8')) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
  }
  return defaultValue;
}

/**
 * Mirrors route.ts `extractNotionPageData` so background/cron weekly reports parse
 * properties identically to GET /api/data?type=ftf-dashboard&scope=week.
 */
export function extractCalendarPageForWeeklyReport(
  page: any,
  helpers: {
    assignedPerson: (page: any, fallback?: string) => string;
    calendarStatusField: (page: any) => [string, any] | undefined;
  }
): ExtractedWeeklyPageData {
  const id = cleanPageId(page.id);
  const url = page.url || `https://notion.so/${id}`;
  const lastEdited = page.last_edited_time || new Date().toISOString();

  let isLocked = false;
  let title = '';
  let status = '';
  let dateStart = '';
  let dateEnd = '';
  let datePriority = -1;
  let person = '';
  let domain = '';

  if (page.properties) {
    for (const [propName, propVal] of Object.entries(page.properties as Record<string, any>)) {
      if (!propVal) continue;
      const type = propVal.type;
      const lowerName = propName.toLowerCase();
      if (type === 'checkbox' && /lock|bloquead/i.test(propName) && propVal.checkbox) {
        isLocked = true;
      }

      if (type === 'title' && Array.isArray(propVal.title)) {
        title = propVal.title.map((t: any) => t?.plain_text || t?.text?.content || '').join('').trim();
      }

      if (type === 'multi_select' && (lowerName.includes('estado') || lowerName.includes('status'))) {
        status = notionStatusValue(propVal);
      }
      if ((type === 'status' || type === 'select') && propVal[type]?.name) {
        if (lowerName.includes('estado') || lowerName.includes('status')) {
          status = propVal[type].name;
        }
      }

      if (type === 'date' && propVal.date?.start) {
        const priority =
          page._anfetaBase === 'Cobrar y pagar'
            ? financeDateField(page.properties)?.[0] === propName
              ? 3
              : 0
            : /^fecha por hacer$/i.test(lowerName.trim())
            ? 3
            : 0;
        if (priority === 3 && priority > datePriority) {
          datePriority = priority;
          dateStart = propVal.date.start;
          dateEnd = propVal.date.end || '';
        }
      }

      if (type === 'people' && Array.isArray(propVal.people) && propVal.people.length > 0) {
        person = propVal.people
          .map((p: any) => p?.person?.email || p?.name || '')
          .filter(Boolean)
          .join(', ');
      } else if (
        type === 'select' &&
        (lowerName.includes('persona') || lowerName.includes('responsable') || lowerName.includes('asignado'))
      ) {
        person = propVal.select?.name || person;
      }

      if (lowerName.includes('dominio') || lowerName.includes('domain')) {
        if (type === 'rich_text' && Array.isArray(propVal.rich_text)) {
          domain = propVal.rich_text.map((t: any) => t?.plain_text || '').join('');
        } else if (type === 'select' && propVal.select?.name) {
          domain = propVal.select.name;
        }
      }
    }
  }

  if (!person && title) person = inferActivityPerson(title, status);

  person = helpers.assignedPerson(page, person);
  const statusProp = helpers.calendarStatusField(page)?.[1];
  status =
    page._anfetaBase === 'Cobrar y pagar'
      ? financeStatus(page.properties || {})
      : notionStatusValue(statusProp);

  return {
    sourceName: page._anfetaBase,
    id,
    url,
    title,
    status,
    dateStart,
    dateEnd,
    person,
    domain,
    lastEdited,
    ...ftfState(page),
    isLocked: isLocked || /Bloqueada_ANFETA/i.test(title),
  };
}

/**
 * Shared weekly Notion page hydration (cached checklist fields + review flow resolution).
 */
export async function hydrateWeeklyFtfActivities({
  pages,
  cachedFlat,
  extractPage,
  resolveReviewFlow,
}: HydrateWeeklyActivitiesInput): Promise<NotionCalendarActivity[]> {
  const cachedByCleanId = new Map(cachedFlat.map(a => [cleanPageId(a.pageId), a]));
  return Promise.all(
    pages.map(async (page: any) => {
      const live = extractPage(page);
      const wf = workflowState(live.status, live.title);
      const cachedAct = cachedByCleanId.get(cleanPageId(page.id));
      const sameInstant = cachedAct && cachedAct.serverModified === page.last_edited_time;
      const reusableCachedFlow =
        cachedAct?.reviewFlow && (sameInstant || wf === 'completed') ? cachedAct.reviewFlow : undefined;
      const rf = reusableCachedFlow || (await resolveReviewFlow(page, wf));
      const cachedPlanFields =
        cachedAct && (sameInstant || mexicoDate(cachedAct.start) === mexicoDate(live.dateStart))
          ? {
              checklistScanned: cachedAct.checklistScanned,
              checklistTotal: cachedAct.checklistTotal,
              checklistCompleted: cachedAct.checklistCompleted,
              todayChecklistCompleted: cachedAct.todayChecklistCompleted,
              completedForDay: cachedAct.completedForDay,
              pendingFutureChecksCount: cachedAct.pendingFutureChecksCount,
              pendingCheckValidation: cachedAct.pendingCheckValidation,
              nextPlannedChecklistDate: cachedAct.nextPlannedChecklistDate,
            }
          : {};

      return normalizeActivity(
        {
          pageId: page.id,
          pageUrl: live.url,
          title: live.title,
          person: live.person,
          status: live.status,
          start: live.dateStart,
          end: live.dateEnd,
          serverModified: page.last_edited_time,
          ftfVerified: live.ftfVerified,
          ftfAvailable: live.ftfAvailable,
          ...cachedPlanFields,
          ...(rf ? { reviewFlow: rf } : {}),
        },
        0
      );
    })
  );
}

/**
 * If Vercel cron triggers slightly before 18:30 CDMX on Friday, snap evaluation to 18:30
 * so the closing workday counts consistently across both buildFtfWeek and mergeWeeklyReportScores.
 */
export function resolveWeeklyCutoffInstant(now: Date = new Date(), forceCutoffComplete = false): Date {
  if (!forceCutoffComplete) return now;
  const cdmxMin = getMexicoTimeMinutes(now);
  if (cdmxMin >= 18 * 60 + 30) return now;
  return new Date(`${mexicoDate(now)}T18:30:00-06:00`);
}

function formatCdmxTime(now: Date): string {
  try {
    return `${new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now)} (CDMX)`;
  } catch {
    return `${now.toISOString().slice(11, 16)} UTC`;
  }
}

export async function sendWeeklyReportFromWeekData(options: {
  settings: Pick<
    ReturnType<typeof getSettings>,
    'ftfEmailTo' | 'ftfEmailFrom' | 'resendApiKey' | 'smtpUser' | 'smtpPass' | 'smtpHost' | 'smtpPort'
  >;
  weekReport: ReturnType<typeof buildFtfWeek>;
  savedScoresByDate: Record<string, Record<string, SavedFtfScoreEntry>>;
  recipientOverride?: string;
  dryRun?: boolean;
  now?: Date;
  forceCutoffComplete?: boolean;
}): Promise<WeeklyFtfReportResult> {
  const effectiveNow = resolveWeeklyCutoffInstant(options.now || new Date(), options.forceCutoffComplete);
  const start = options.weekReport.start;
  const workDates = [0, 1, 2, 3, 4].map(offset => shiftFtfDate(start, offset));
  const weekEnd = workDates[4];
  const today = mexicoDate(effectiveNow);
  const nowMinutes = getMexicoTimeMinutes(effectiveNow);

  const mergedScores = mergeWeeklyReportScores(
    options.weekReport.days,
    workDates,
    options.savedScoresByDate,
    today,
    nowMinutes
  );

  const teamNames = (options.weekReport.days[0]?.people || []).map(p => p.name);
  const matrix = buildWeeklyPayrollMatrix(workDates, teamNames, mergedScores);

  const appUrl = reportPublicUrl();

  const email: FtfEmailDeliveryResult = options.dryRun
    ? { ok: true, skipped: true, to: [] }
    : await sendWeeklyFtfReportEmail({
        apiKey: options.settings.resendApiKey,
        smtpUser: options.settings.smtpUser,
        smtpPass: options.settings.smtpPass,
        smtpHost: options.settings.smtpHost,
        smtpPort: options.settings.smtpPort,
        from: options.settings.ftfEmailFrom,
        to: options.recipientOverride || options.settings.ftfEmailTo,
        weekStart: start,
        weekEnd,
        weekDates: workDates,
        matrix,
        reportUrl: `${appUrl.replace(/\/$/, '')}/?ftf=week`,
        generatedAt: formatCdmxTime(effectiveNow),
      });

  return {
    weekStart: start,
    weekEnd,
    workDates,
    matrix,
    week: options.weekReport,
    email,
  };
}

export async function buildAndSendWeeklyFtfReport(options: {
  actor: string;
  targetDate?: string;
  recipientOverride?: string;
  dryRun?: boolean;
  notionTokenOverride?: string;
  now?: Date;
  forceCutoffComplete?: boolean;
}): Promise<WeeklyFtfReportResult> {
  const [
    { getSettings },
    { activeTeam },
    { queryCalendarPages, knownReviewFlow, cachedReviewFlow, assignedPerson, calendarStatusField },
    { readFtfPresenceHistory },
    { readUserState },
  ] = await Promise.all([
    import('@/services/serverSettings'),
    import('@/services/teamDirectory'),
    import('@/services/notionCalendar'),
    import('@/services/ftfPresenceHistory'),
    import('@/services/userState'),
  ]);

  const effectiveNow = resolveWeeklyCutoffInstant(options.now || new Date(), options.forceCutoffComplete);
  const baseSettings = getSettings();
  const settings = options.notionTokenOverride
    ? { ...baseSettings, notionToken: options.notionTokenOverride }
    : baseSettings;
  const resolvedDate = options.targetDate || mexicoDate(effectiveNow);
  const start = ftfWeekStart(resolvedDate);
  const end = shiftFtfDate(start, 7);
  const weekDates = [0, 1, 2, 3, 4].map(offset => shiftFtfDate(start, offset));

  const [pages, people, presence, state] = await Promise.all([
    queryCalendarPages(settings, start, end, false),
    activeTeam(),
    readFtfPresenceHistory(start, end).catch(() => []),
    readUserState(settings, 'John'),
  ]);

  const localCache = readWeeklyLocalJson<Record<string, any[]>>('notion_calendar_cache_v13.json', {});
  const localCachedFlat = Object.values(localCache).flat().map(a => normalizeActivity(a, 0));
  const preliminaryLive = pages.map(page => {
    const live = extractCalendarPageForWeeklyReport(page, { assignedPerson, calendarStatusField });
    return normalizeActivity({ pageId: page.id, title: live.title, person: live.person, status: live.status, start: live.dateStart, end: live.dateEnd }, 0);
  });
  const history = await loadHistoricalFtfRecovery(settings, weekDates, preliminaryLive, resolvedDate, pages).catch(() => ({
    cachedFlat: [],
    recoveredPastActivities: [],
  }));
  const cachedFlat = [...history.cachedFlat, ...localCachedFlat];

  const activities = await hydrateWeeklyFtfActivities({
    pages,
    cachedFlat,
    extractPage: page => extractCalendarPageForWeeklyReport(page, { assignedPerson, calendarStatusField }),
    resolveReviewFlow: async (page, wf) =>
      knownReviewFlow(settings, page) ||
      (wf === 'review' ? await cachedReviewFlow(settings, page).catch(() => undefined) : undefined),
  });
  // Propagate [RESPUESTA] handoff attribution onto hydrated live activities as well
  const handoffByKey = new Map<string, any>();
  for (const act of preliminaryLive) {
    if (act.reviewFlow?.OriginalPerson) {
      handoffByKey.set(cleanPageId(act.pageId), act.reviewFlow);
    }
  }
  for (const act of activities) {
    if (!act.reviewFlow?.OriginalPerson) {
      const flow = handoffByKey.get(cleanPageId(act.pageId));
      if (flow) {
        act.reviewFlow = flow;
        act.originalPerson = flow.OriginalPerson;
      }
    }
  }

  const combinedBase = [...activities, ...history.recoveredPastActivities];
  const snapshotMirrors = await readDailySnapshotMirrors(settings, start, end, [...cachedFlat, ...combinedBase]).catch(
    () => []
  );
  const combinedActivities = [...combinedBase, ...snapshotMirrors.map(a => normalizeActivity(a, 0))];
  await saveFtfDayArchive(settings, mexicoDate(effectiveNow), combinedActivities, resolvedDate).catch(() => {});

  const [mealBreaks, savedScoresByDate] = await Promise.all([
    readFtfStore<Record<string, MealBreakWindow>>(
      settings,
      'ftf:meal-breaks',
      readWeeklyLocalJson<Record<string, MealBreakWindow>>('meal_breaks.json', {})
    ),
    readFtfStore<Record<string, Record<string, SavedFtfScoreEntry>>>(
      settings,
      'ftf:daily-scores',
      readWeeklyLocalJson<Record<string, Record<string, SavedFtfScoreEntry>>>('ftf_daily_scores.json', {})
    ),
  ]);
  const completions = state.values?.receipts?.ftfCompletions || {};
  const weekReport = buildFtfWeek(
    options.actor,
    start,
    people,
    combinedActivities,
    completions,
    presence,
    effectiveNow,
    mealBreaks
  );

  return sendWeeklyReportFromWeekData({
    settings,
    weekReport,
    savedScoresByDate,
    recipientOverride: options.recipientOverride,
    dryRun: options.dryRun,
    now: effectiveNow,
    forceCutoffComplete: options.forceCutoffComplete,
  });
}
