import { normalizePerson, PERSON_ALIASES } from './identityNormalizer';
import { NotionCalendarActivity } from '@/types/anfeta';

export function isDirection(user: string) {
  return user === '__all__' || user.toLowerCase() === 'jjohn';
}
export function isActivityLocked(activity: Partial<NotionCalendarActivity> & { IsAutomationLocked?: boolean }) {
  return !!(activity.isLocked || activity.IsAutomationLocked || /Bloqueada_ANFETA/i.test(activity.title || ''));
}
export function canEditActivity(user: string, activity: Partial<NotionCalendarActivity>) {
  const actor = user.trim().toLowerCase();
  const knownActor = Object.entries(PERSON_ALIASES).some(([name, aliases]) => name.toLowerCase() === actor || aliases.includes(actor));
  return !isActivityLocked(activity) && (isDirection(user) ||
    (knownActor && normalizePerson(user) === normalizePerson(activity.person || '')));
}

export function scheduleAtDrop(activity: NotionCalendarActivity, date: string, minutes: number) {
  const duration = (Date.parse(activity.end) - Date.parse(activity.start)) / 60000;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 840) throw new Error('Duración fuera de la jornada 08:00–22:00.');
  const startMinute = Math.max(480, Math.min(Math.floor((1320 - duration) / 15) * 15, 480 + Math.round(minutes / 15) * 15));
  const at = (value: number) => `${date}T${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}:00-06:00`;
  return { start: at(startMinute), end: at(startMinute + duration) };
}
