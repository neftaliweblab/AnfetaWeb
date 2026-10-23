import {revisionTime} from './activityRevision';
import type { NotionCalendarActivity } from '@/types/anfeta';

// Una lectura de calendario puede haber comenzado antes del PATCH confirmado.
// Mantener la protección hasta que expire, incluso después de una lectura coincidente.
export function confirmedCalendarActivity(incoming: NotionCalendarActivity, saved: NotionCalendarActivity) {
  const next=revisionTime(incoming),old=revisionTime(saved);
  if(next!==null&&old!==null&&next>old)return incoming;
  if(next!==null&&old!==null&&next<old)return saved;
  const sameTime = (a: string, b: string) => a === b || (Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b));
  return incoming.title === saved.title && incoming.person === saved.person &&
    incoming.status === saved.status && sameTime(incoming.start, saved.start) &&
    sameTime(incoming.end, saved.end) && incoming.reviewFlow?.State === saved.reviewFlow?.State &&
    incoming.ftfVerified===saved.ftfVerified && incoming.ftfAvailable===saved.ftfAvailable
    ? incoming : saved;
}
