import path from "path";
import { SearchResultRow, NotionCalendarActivity } from "@/types/anfeta";

function resolveAssignedPerson(text: string): string {
  if (/\b(?:ggena|genaro)\b/i.test(text)) return "Genaro";
  if (/\b(?:nneft|neft|neftali)\b/i.test(text)) return "Neftali";
  if (/\b(?:bbria|brian)\b/i.test(text)) return "Brian";
  if (/\b(?:iisai|isai|isaias)\b/i.test(text)) return "Isaias";
  if (/\b(?:kkarl|karl|karla)\b/i.test(text)) return "Karla";
  if (/\b(?:jjohn|john)\b/i.test(text)) return "John";
  if (/\b(?:aandr|andrade)\b/i.test(text)) return "Andrade";
  if (/\b(?:aacal|acalli)\b/i.test(text)) return "Acalli";
  if (/\b(?:ssote|sotelo)\b/i.test(text)) return "Sotelo";
  if (/\b(?:eemma|emmanuel)\b/i.test(text)) return "Emmanuel";
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
    sourceName: raw.ExternalSourceName || (source === "Notion" ? "Notion" : "Dropbox"),
    externalId: raw.ExternalId || raw.externalId,
    externalUrl: raw.ExternalUrl || raw.externalUrl,
    scheduledDate: raw.ScheduledDate || "",
    updateStatus: raw.ProjectUpdateStatus || raw.statusLabel || "",
    description: raw.Description || raw.description || "",
    contentSnippet: raw.Description || raw.SearchText || "",
    searchText: raw.SearchText || "",
    isFolder,
    type: raw.Type || (source === "Notion" ? "PAGE" : isFolder ? "FOLDER" : "FILE"),
    target: raw.Target || filePath,
    assignedPerson: raw.AssignedPerson || resolveAssignedPerson(name),
    checklistProgressText: raw.ChecklistProgressText || "",
    hasChecklistProgress: !!raw.ChecklistProgressText,
  };
}

export function normalizeActivity(raw: any, idx: number): NotionCalendarActivity {
  const title = raw.Title || raw.title || "";
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
    originalScheduledDate: raw.ActivityCreatedDate || "",
    currentScheduledDate: raw.DatePropertyName || "",
    moveCount: raw.MoveCount || 0,
    routeDates: raw.RouteDates || [],
    checklistScanned: !!(raw.ChecklistScanned ?? raw.checklistScanned),
    checklistTotal: raw.ChecklistTotal ?? raw.checklistTotal ?? 0,
    checklistCompleted: raw.ChecklistCompleted ?? raw.checklistCompleted ?? 0,
    todayChecklistCompleted:
      raw.TodayChecklistCompleted ?? raw.todayChecklistCompleted ?? raw.ChecklistCompleted ?? 0,
    isUrgent: !!(raw.IsCritical ?? raw.isUrgent ?? title.includes("00")),
    isCompletedForReview: !!(
      raw.IsCompletedForReview ?? raw.isCompletedForReview ?? title.includes("rtuzREVISION")
    ),
    isFinalized: !!(raw.IsFinalized ?? raw.isFinalized ?? title.includes("zREVISION")),
    isSuspended: !!(raw.IsSuspended ?? raw.isSuspended ?? title.includes("sprtuzREVISION")),
    isLocked: !!(
      raw.IsAutomationLocked ?? raw.isLocked ?? title.includes("Bloqueada_ANFETA")
    ),
    estimatedWorkMinutes: raw.EstimatedWorkMinutes ?? raw.estimatedWorkMinutes ?? 0,
  };
}
