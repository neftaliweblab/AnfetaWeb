import {activityLinkPageId} from './activityDeepLink';
import type {PendingTaskItem} from '@/types/anfeta';

/** Pending IDs are app records, not Notion page IDs. Use explicit linkage only. */
export function pendingActivityPageId(task:Partial<PendingTaskItem>):string {
  for (const candidate of [task.reviewPageId, task.pageId]) {
    const id=activityLinkPageId(candidate); if(id)return id;
  }
  try {
    const url=new URL(String(task.url||'').replace(/^notion:/,'https:'));
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) return '';
    if (/(^|\.)notion\.(so|com|site)$/i.test(url.hostname)) {
      const last=url.pathname.split('/').filter(Boolean).at(-1)||'';
      const match=last.match(/([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i);
      const id=activityLinkPageId(match?.[1]); if(id)return id;
    }
    if (['anfeta-web.onrender.com','anfeta-web.vercel.app','anfeta-web-iota.vercel.app'].includes(url.hostname)) {
      const id=activityLinkPageId(url.searchParams.get('activity')||url.searchParams.get('pageId')); if(id)return id;
    }
  } catch { /* A historic task may have no URL. */ }
  return activityLinkPageId(String(task.id||'').match(/^act-pending-([a-f0-9-]+)$/i)?.[1]);
}
