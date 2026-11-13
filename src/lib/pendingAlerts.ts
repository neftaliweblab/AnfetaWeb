import type { PendingTaskItem } from '@/types/anfeta';
import { normalizePerson } from '@/services/identityNormalizer';

export function isReviewOrSentPending(task: Partial<PendingTaskItem> | null | undefined): boolean {
  if (!task) return false;
  if (task.needsReview || task.isReviewNotice || task.isVideoTask || Boolean(task.reviewPageId)) {
    return true;
  }
  const text = `${task.title || ''} ${task.note || ''} ${task.query || ''}`.toLowerCase();
  return /rtuzrevision|enviado a revisi|revisar para completar|lista para revisi/.test(text);
}

export function isVideoPendingTask(task: Partial<PendingTaskItem> | null | undefined): boolean {
  if (!task) return false;
  if (task.isVideoTask) return true;
  const text = `${task.title || ''} ${task.note || ''}`.toLowerCase();
  return /^🎥|grabaci[oó]n[\s_:-]/i.test(text) || /video grabado/i.test(text);
}

export function buildQuickPendingFromActivity(params: {
  pageId: string;
  pageUrl?: string;
  title: string;
  assignedTo: string;
  assignedBy: string;
  scheduledDate?: string;
  domain?: string;
  isVideoTask?: boolean;
  needsReview?: boolean;
}): PendingTaskItem {
  const nowIso = new Date().toISOString();
  const cleanTitle = String(params.title || 'Pendiente rápido ANFETA').trim().slice(0, 500);
  const to = normalizePerson(params.assignedTo || params.assignedBy || '');
  const by = normalizePerson(params.assignedBy || '');
  const isVideo = Boolean(params.isVideoTask);
  const needsReview = params.needsReview ?? true;
  const queryText = params.domain ? `${params.domain} ${cleanTitle}`.slice(0, 300) : cleanTitle;

  return {
    id: params.pageId ? `act-pending-${params.pageId}` : `quick-pending-${Date.now()}`,
    title: isVideo && !cleanTitle.startsWith('🎥') ? `🎥 ${cleanTitle}` : cleanTitle,
    query: cleanTitle,
    scheduledDate: params.scheduledDate || nowIso.slice(0, 10),
    description: isVideo
      ? `Video grabado${by && to && by !== to ? ` por ${by} para ${to}` : ''}. Revisar para completar la actividad.`
      : `Pendiente rápido enviado${by ? ` por ${by}` : ''}. Revisar para completar.`,
    note: isVideo ? 'Video · Revisar para completar' : 'Enviado · Revisar para completar',
    url: params.pageUrl || (params.pageId ? `https://www.notion.so/${params.pageId.replace(/-/g, '')}` : undefined),
    isCompleted: false,
    isArchived: false,
    isAttended: false,
    isStarred: true,
    isReviewNotice: true,
    needsReview,
    isVideoTask: isVideo,
    reviewPageId: params.pageId || undefined,
    reviewSentBy: by || undefined,
    assignedTo: to || undefined,
    assignedBy: by || undefined,
    assignedAt: nowIso,
    color: isVideo ? 'amber' : 'rose',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...(queryText && !params.pageId ? { query: queryText } : {}),
  };
}
