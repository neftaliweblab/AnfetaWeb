export type SearchSource = 'Local' | 'Notion' | 'Dropbox';

export interface SearchResultRow {
  id: string;
  name: string;
  path: string;
  folder: string;
  extension: string;
  sizeBytes: number;
  modifiedLocalDate: string;
  daysModified?: number;
  source: SearchSource;
  externalId?: string;
  externalUrl?: string;
  scheduledDate?: string;
  scheduledEnd?:string;
  estimatedWorkMinutes?:number;
  ftfVerified?:boolean;
  ftfAvailable?:boolean;
  assignmentKeys?: string[];
  notionEditedUtc?: string;
  pageContent?: string;
  description?: string;
  checklistProgressText?: string;
  hasChecklistProgress?: boolean;
  statusLabel?: string;
  statusBg?: string;
  statusBorder?: string;
  statusColor?: string;
  areaChip?: string;
  monthChip?: string;
  orderChip?: string;
  domainChip?: string;
  assignedPerson?: string;
  isChecked?: boolean;
  isFolder?: boolean;
  sourceName?: string;
  updateStatus?: string;
  projectUpdateStatus?: string;
  serverModified?: string;
  type?: string;
  target?: string;
  url?: string;
  isBookmarked?: boolean;
  contentSnippet?: string;
  searchText?: string;
  displayName?: string;
  displayLocation?: string;
  externalSourceName?: string;
  pathColumn?: string;
  status?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  isReviewMirror?: boolean;
  isHandoffMirror?: boolean;
}

export interface NotionCalendarActivity {
  financialFields?:{name:string;value:number}[];
  serverModified?:string;
  localConfirmedAt?:number;
  pageId: string;
  pageUrl: string;
  title: string;
  shortTitle: string;
  person: string;
  originalPerson: string;
  project: string;
  domain: string;
  status: string;
  start: string; // ISO
  end: string;   // ISO
  originalScheduledDate: string;
  currentScheduledDate: string;
  moveCount: number;
  routeDates: string[];
  checklistScanned: boolean;
  checklistTotal: number;
  checklistCompleted: number;
  completedChecks?: {id:string;blockId:string;text:string;editedAt?:string;createdAt?:string;markedAt?:string;isChecked:boolean}[];
  checklistItems?: {id:string;blockId:string;text:string;isChecked:boolean;createdAt?:string;editedAt?:string;markedAt?:string;markingSource?:string}[];
  todayChecklistCompleted: number;
  dailyChecklistTotal?:number;
  dailyChecklistCompleted?:number;
  historicalChecklistCompleted?:number;
  checklistUnknownCompleted?:number;
  checklistTimingEstimated?:boolean;
  checklistTimingWarning?:string;
  isUrgent: boolean; // Tag '00'
  isCompletedForReview: boolean; // Tag 'rtuzREVISION'
  isFinalized: boolean; // Tag 'zREVISION'
  isSuspended: boolean; // Tag 'sprtuzREVISION'
  isLocked: boolean; // Tag 'Bloqueada_ANFETA'
  ftfVerified?: boolean;
  ftfAvailable?: boolean;
  expectedFtfVerified?: boolean;
  isReviewMirror?: boolean;
  isHandoffMirror?: boolean;
  originalPageId?: string;
  handoffNote?: string;
  reviewFlowScanned?: boolean;
  reviewFlow?: { OriginalPerson: string; ReviewAssignee: string; State: string; LeaveVisualCopy?: boolean; [key: string]: unknown };
  estimatedWorkMinutes: number;
  workedMinutes?: number;
}

export interface DailyProgressKPIs {
  date: string;
  coveragePercentage: number;
  currentProgressPercentage?: number;
  totalActivities: number;
  laggingCount: number;
  reviewCount: number;
  completedCount: number;
  scheduledMinutes: number;
  progressMinutes: number;
  missingChecklistCount: number;
}

export interface PendingTaskItem {
  person?: string;
  priority?: number;
  url?: string;
  pageId?: string;
  id: string;
  title: string;
  scheduledDate: string;
  query: string;
  isCompleted?: boolean;
  createdAt?: string;
}

export interface ActiveProjectSubActivity {
  title: string;
  rawTitle?: string;
  type: string;
  pageUrl?: string;
  activity?: NotionCalendarActivity;
}

export interface ActiveProjectItem {
  domain: string;
  count: number;
  color?: string;
  activities?: ActiveProjectSubActivity[];
}

export interface MessageItem {
  id: string;
  conversationTitle: string;
  conversationPreview: string;
  conversationContactLabel: string;
  conversationTimeLabel: string;
  avatarText: string;
  avatarColor: string;
  isUnread?: boolean;
  unreadCount?: number;
  type: 'reminders' | 'projects' | 'reviews' | 'chat';
  domain?: string;
  person?: string;
  month?: string;
  messages?: Array<{
    id: string;
    sender: string;
    content: string;
    timestamp: string;
    isMe: boolean;
  }>;
}

export interface ReminderItem {
  id: string;
  title: string;
  dueTime: string; // HH:mm
  dueDate: string; // yyyy-MM-dd
  category: string;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  details?: string;
}

export type ActiveHostView = 
  | 'results' 
  | 'calendar' 
  | 'messages' 
  | 'reminders' 
  | 'dailyProgress' 
  | 'settings';
