import {CalendarSettings} from './notionCalendar';
import {readUserState,updateUserState} from './userState';
import {completedFtfPeople} from './ftfCompletion';
import {mexicoDate,mexicoMinutes} from './calendarPresentation';
import {normalizePerson} from './identityNormalizer';
import {NotionCalendarActivity} from '@/types/anfeta';

/** Persist once per recipient/person/day so John can read it after the cutoff. */
export async function recordFtfCompletions(settings:CalendarSettings,activities:NotionCalendarActivity[],now=new Date(),timeKind:'observed'|'confirmed'='observed') {
  const day=mexicoDate(now);
  const completed=completedFtfPeople(activities,now);
  const recipients=new Set(completed.length?['John',...completed]:[]);
  for(const recipient of recipients){
    const state=await readUserState(settings,recipient),receipts=state.values?.receipts||{};
    const records:Record<string,any>={...(receipts.ftfCompletions||{})};
    let changed=false;
    for(const person of completed){
      if(recipient!=='John'&&recipient!==person)continue;
      const id='ftf:'+day+':'+person;

      const personActivities = activities.filter(a => normalizePerson(a.person) === person && a.start && mexicoDate(a.start) === day);
      const lastEdited = personActivities
        .map(a => (a as any).serverModified || (a as any).lastEdited || (a as any).last_edited_time)
        .filter(v => v && Number.isFinite(Date.parse(v)))
        .sort()
        .at(-1);

      const effectiveTimestamp = (lastEdited && mexicoDate(lastEdited) === day && mexicoMinutes(lastEdited) !== 0)
        ? lastEdited
        : now.toISOString();

      const existing = records[id];
      if (existing) {
        // Heal records that were saved with midnight 00:00 or missing completion time
        const existingMinutes = existing.updated ? mexicoMinutes(existing.updated) : 0;
        if (existingMinutes === 0 && effectiveTimestamp && mexicoMinutes(effectiveTimestamp) !== 0) {
          records[id] = {
            ...existing,
            updated: effectiveTimestamp,
            completedAt: effectiveTimestamp,
            observedAt: existing.observedAt || effectiveTimestamp,
          };
          changed = true;
        }
        continue;
      }

      records[id]={id,kind:'ftf',person,date:day,updated:effectiveTimestamp,observedAt:now.toISOString(),...(timeKind==='confirmed'||(lastEdited && mexicoDate(lastEdited)===day)?{completedAt:effectiveTimestamp}:{}),timeKind,late:Date.parse(effectiveTimestamp)>Date.parse(day+'T18:00:00-06:00'),actionLabel:'FTF completado',title:person+' completó su revisión FTF de hoy',activityTitle:person+' completó su revisión FTF de hoy'};
      changed=true;
    }
    if(changed)await updateUserState(settings,recipient,{receipts:{...receipts,ftfCompletions:Object.fromEntries(Object.entries(records).slice(-300))}},state.revision);
  }
}
