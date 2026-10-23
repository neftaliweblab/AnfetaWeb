import {mexicoDate,mexicoMinutes} from './calendarPresentation';
import {normalizePerson,PERSON_ALIASES} from './identityNormalizer';
import {NotionCalendarActivity} from '@/types/anfeta';
import {isFtfReminder} from './progressKpis';

// Only real activities starting today before 18:00 count; checklist progress is unrelated.
export function completedFtfPeople(activities:NotionCalendarActivity[],now=new Date()) {
  const day=mexicoDate(now);
  const groups=new Map<string,NotionCalendarActivity[]>();
  for(const activity of activities){
    const person=normalizePerson(activity.person);
    if(!PERSON_ALIASES[person]||person==='Emmanuel'||activity.isReviewMirror||activity.isHandoffMirror||isFtfReminder(activity)||!activity.start||mexicoDate(activity.start)!==day||mexicoMinutes(activity.start)>=1080)continue;
    const list=groups.get(person)||[];
    if(!list.some(a=>a.pageId===activity.pageId))list.push(activity);
    groups.set(person,list);
  }
  return [...groups].filter(([,rows])=>rows.length>0&&rows.every(a=>a.ftfAvailable&&a.ftfVerified)).map(([person])=>person);
}

export function notificationPageId(value:string='') {
  return value.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32}/i)?.[0]?.replace(/-/g,'').toLowerCase()||'';
}
