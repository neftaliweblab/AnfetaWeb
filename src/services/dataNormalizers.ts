import {inferActivityPerson,currentReviewTagPerson,ACTIVITY_TAGS} from './activityTags';
import path from "path";
import { calendarUrgent, mexicoDate } from "./calendarPresentation";
import { normalizePerson } from "./identityNormalizer";
import { SearchResultRow, NotionCalendarActivity } from "@/types/anfeta";

function resolveAssignedPerson(text:string,keys:string[]=[]):string {
  const explicit=keys.map(normalizePerson).find(person=>person in ACTIVITY_TAGS);
  return explicit||inferActivityPerson(text)||'Sin asignar';
}

export function normalizeSearchRow(raw: any, idx: number): SearchResultRow {
  const filePath = raw.FullPath || raw.Target || raw.path || "";
  const name = raw.Name || raw.name || path.basename(filePath) || `Item-${idx}`;
  const ext =
    raw.Type === "FOLDER"
      ? ""
      : (raw.Extension || path.extname(filePath).replace(".", "")).toLowerCase();

  const isFolder = raw.IsFolder ?? (raw.Type === "FOLDER");
  const sourceCode = raw.Source;
  const source: "Notion" | "Dropbox" | "Local" =
    sourceCode === 2 ? "Notion" : sourceCode === 1 ? "Dropbox" : "Local";

  const assignmentKeys: string[] = Array.isArray(raw.AssignmentKeys)
    ? raw.AssignmentKeys
    : Array.isArray(raw.assignmentKeys)
    ? raw.assignmentKeys
    : [];

  const assignedPerson =
    (source==='Notion'&&!raw.isReviewMirror&&!raw.IsReviewMirror&&!raw.isHandoffMirror?currentReviewTagPerson(name,raw.ProjectUpdateStatus||raw.statusLabel||raw.status||''):'')||
    raw.AssignedPerson ||
    raw.assignedPerson ||
    resolveAssignedPerson(name, assignmentKeys);

  const rawSearchText = raw.SearchText || raw.searchText || "";
  const combinedSearchText = [rawSearchText, name, assignedPerson, ...assignmentKeys]
    .filter(Boolean)
    .join(" ");

  return {
    id: raw.NodeId || raw.ExternalId || filePath || `idx-${idx}`,
    name,
    path: filePath,
    folder: raw.TargetNorm || path.dirname(filePath) || "",
    extension: ext,
    sizeBytes: raw.Size || raw.sizeBytes || 0,
    modifiedLocalDate: (raw.ServerModified || raw.modifiedLocalDate || "").slice(0, 10),
    serverModified: raw.ServerModified || "",
    daysModified: raw.DaysModified || raw.daysModified || 0,
    source,
    sourceName: raw.ExternalSourceName || (source === "Notion" ? "Revisiones" : "Dropbox"),
    externalId: raw.ExternalId || raw.externalId,
    externalUrl: raw.ExternalUrl || raw.externalUrl,
    scheduledDate: raw.ScheduledDate || raw.scheduledDate || "",
    scheduledEnd:raw.ScheduledEnd||raw.scheduledEnd,estimatedWorkMinutes:raw.EstimatedWorkMinutes||raw.estimatedWorkMinutes,
    ftfVerified:raw.ftfVerified,ftfAvailable:raw.ftfAvailable,
    updateStatus: raw.ProjectUpdateStatus || raw.statusLabel || "",
    description: raw.Description || raw.description || "",
    contentSnippet: raw.Description || rawSearchText || "",
    searchText: combinedSearchText,
    assignmentKeys,
    isFolder,
    type: raw.Type || (source === "Notion" ? "PAGE" : isFolder ? "FOLDER" : "FILE"),
    target: raw.Target || filePath,
    assignedPerson,
    checklistProgressText: raw.ChecklistProgressText || "",
    hasChecklistProgress: !!raw.ChecklistProgressText,
    coverUrl: raw.CoverUrl || raw.coverUrl || raw.Cover?.file?.url || raw.Cover?.external?.url || "",
    thumbnailUrl: raw.ThumbnailUrl || raw.thumbnailUrl || "",
  };
}

import { workflowState } from './activityWorkflow';

export function normalizeActivity(raw: any, idx: number): NotionCalendarActivity {
  const title = raw.Title || raw.title || "";
  const workflow = workflowState(raw.Status || raw.status || "", title);
  return {
    financialFields:raw.financialFields,
    serverModified:raw.serverModified||raw.last_edited_time,
    pageId: raw.PageId || raw.pageId || `act-${idx}`,
    pageUrl: raw.PageUrl || raw.pageUrl || "",
    title,
    shortTitle: raw.ShortTitle || raw.shortTitle || title,
    person: raw.IsReviewMirror||raw.isReviewMirror||raw.isHandoffMirror?normalizePerson(raw.Person||raw.person):currentReviewTagPerson(title,raw.Status||raw.status||'')||normalizePerson(raw.Person||raw.person),
    originalPerson: raw.OriginalPerson || raw.originalPerson || "—",
    project: raw.Project || raw.project || "",
    domain: raw.ParsedDomain || raw.domain || "general",
    status: raw.Status || raw.status || ({pending:'Pendiente',review:'En revisión',completed:'Terminada',suspended:'Suspendida',unknown:'Pendiente'}[workflow]),
    start: raw.Start || raw.start || "",
    end: raw.End || raw.end || "",
    originalScheduledDate: raw.originalScheduledDate || raw.ActivityCreatedDate || "",
    currentScheduledDate: raw.currentScheduledDate || (raw.Start || raw.start || "").slice(0,10),
    moveCount: raw.MoveCount ?? raw.moveCount ?? 0,
    routeDates: raw.RouteDates || raw.routeDates || [],
    checklistUnknownCompleted:raw.checklistUnknownCompleted,checklistTimingEstimated:raw.checklistTimingEstimated,checklistTimingWarning:raw.checklistTimingWarning,
    checklistScanned: !!(raw.ChecklistScanned ?? raw.checklistScanned),
    checklistTotal: raw.ChecklistTotal ?? raw.checklistTotal ?? 0,
    checklistCompleted: raw.ChecklistCompleted ?? raw.checklistCompleted ?? 0,
    completedChecks:raw.completedChecks || [],
    dailyChecklistTotal:raw.dailyChecklistTotal,
    dailyChecklistCompleted:raw.dailyChecklistCompleted,
    historicalChecklistCompleted:raw.historicalChecklistCompleted,
    checklistItems: raw.checklistItems || raw.ChecklistItems || raw.completedChecks || [],
    todayChecklistCompleted:
      raw.TodayChecklistCompleted ?? raw.todayChecklistCompleted ?? 0,
    isUrgent: !!(raw.IsCritical ?? raw.isUrgent ?? calendarUrgent(title)),
    isReviewMirror: !!(raw.IsReviewMirror ?? raw.isReviewMirror),
    reviewFlow: raw.ReviewFlow || raw.reviewFlow,
    reviewFlowScanned:raw.reviewFlowScanned,
    ftfVerified:raw.ftfVerified===true,ftfAvailable:raw.ftfAvailable===true,
    isHandoffMirror:raw.isHandoffMirror,originalPageId:raw.originalPageId,handoffNote:raw.handoffNote,
    isCompletedForReview: workflow === 'review' || (workflow === 'unknown' && !!(raw.IsCompletedForReview ?? raw.isCompletedForReview)),
    isFinalized: workflow === 'completed' || (workflow === 'unknown' && !!(raw.IsFinalized ?? raw.isFinalized)),
    isSuspended: workflow === 'suspended' || (workflow === 'unknown' && !!(raw.IsSuspended ?? raw.isSuspended)),
    isLocked: !!(
      raw.IsAutomationLocked || raw.isLocked || /Bloqueada_ANFETA/i.test(title)
    ),
    workedMinutes: raw.WorkedMinutes ?? raw.workedMinutes ?? 0,
    estimatedWorkMinutes: raw.EstimatedWorkMinutes ?? raw.estimatedWorkMinutes ?? 0,
  };
}
