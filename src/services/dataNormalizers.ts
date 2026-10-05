import path from "path";
import { SearchResultRow, NotionCalendarActivity } from "@/types/anfeta";

function resolveAssignedPerson(text: string, keys: string[] = []): string {
  const combined = `${text} ${keys.join(" ")}`.toLowerCase();
  if (/\b(?:ggena|genaro|ggena@pprin\.com)\b/i.test(combined)) return "Genaro";
  if (/\b(?:nneft|nnetf|neft|neftali|nnetf@practicante\.com)\b/i.test(combined)) return "Neftali";
  if (/\b(?:bbria|brian|bbria@pprin\.com)\b/i.test(combined)) return "Brian";
  if (/\b(?:iisai|iisaia|isai|isaias|iisai@pprin\.com)\b/i.test(combined)) return "Isaias";
  if (/\b(?:kkarl|karl|karla|kkarl@pprin\.com)\b/i.test(combined)) return "Karla";
  if (/\b(?:jjohn|john|jjohn@pprin\.com)\b/i.test(combined)) return "John";
  if (/\b(?:aandr|andrade|aandr@pprin\.com)\b/i.test(combined)) return "Andrade";
  if (/\b(?:aacal|acalli|aacal@pprin\.com)\b/i.test(combined)) return "Acalli";
  if (/\b(?:ssote|sotelo|ssote@pprin\.com)\b/i.test(combined)) return "Sotelo";
  if (/\b(?:eemma|eedua|eduardo|emmanuel|eedua@pprin\.com)\b/i.test(combined)) return "Emmanuel";
  return "Sin asignar";
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
    raw.AssignedPerson ||
    raw.assignedPerson ||
    resolveAssignedPerson(name + " " + (raw.SearchText || ""), assignmentKeys);

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
    scheduledDate: raw.ScheduledDate || "",
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
  };
}

import { workflowState } from './activityWorkflow';

export function normalizeActivity(raw: any, idx: number): NotionCalendarActivity {
  const title = raw.Title || raw.title || "";
  const workflow = workflowState(raw.Status || raw.status || "", title);
  return {
    pageId: raw.PageId || raw.pageId || `act-${idx}`,
    pageUrl: raw.PageUrl || raw.pageUrl || "",
    title,
    shortTitle: raw.ShortTitle || raw.shortTitle || title,
    person: raw.Person || raw.person || "—",
    originalPerson: raw.OriginalPerson || raw.originalPerson || "—",
    project: raw.Project || raw.project || "",
    domain: raw.ParsedDomain || raw.domain || "general",
    status: raw.Status || raw.status || "Pendiente",
    start: raw.Start || raw.start || "",
    end: raw.End || raw.end || "",
    originalScheduledDate: raw.originalScheduledDate || raw.ActivityCreatedDate || "",
    currentScheduledDate: raw.currentScheduledDate || (raw.Start || raw.start || "").slice(0,10),
    moveCount: raw.MoveCount ?? raw.moveCount ?? 0,
    routeDates: raw.RouteDates || raw.routeDates || [],
    checklistScanned: !!(raw.ChecklistScanned ?? raw.checklistScanned),
    checklistTotal: raw.ChecklistTotal ?? raw.checklistTotal ?? 0,
    checklistCompleted: raw.ChecklistCompleted ?? raw.checklistCompleted ?? 0,
    todayChecklistCompleted:
      raw.TodayChecklistCompleted ?? raw.todayChecklistCompleted ?? raw.ChecklistCompleted ?? 0,
    isUrgent: !!(raw.IsCritical ?? raw.isUrgent ?? title.includes("00")),
    isCompletedForReview: workflow === 'review' || (workflow === 'unknown' && !!(raw.IsCompletedForReview ?? raw.isCompletedForReview)),
    isFinalized: workflow === 'completed' || (workflow === 'unknown' && !!(raw.IsFinalized ?? raw.isFinalized)),
    isSuspended: workflow === 'suspended' || (workflow === 'unknown' && !!(raw.IsSuspended ?? raw.isSuspended)),
    isLocked: !!(
      raw.IsAutomationLocked || raw.isLocked || /Bloqueada_ANFETA/i.test(title)
    ),
    estimatedWorkMinutes: raw.EstimatedWorkMinutes ?? raw.estimatedWorkMinutes ?? 0,
  };
}
