import {CalendarSettings} from './notionCalendar';
import {readUserState,updateUserState} from './userState';
import {completedFtfPeople} from './ftfCompletion';
import {mexicoDate} from './calendarPresentation';
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
      if(records[id])continue;
      records[id]={id,kind:'ftf',person,date:day,updated:now.toISOString(),observedAt:now.toISOString(),...(timeKind==='confirmed'?{completedAt:now.toISOString()}:{}),timeKind,late:now.getTime()>Date.parse(day+'T18:00:00-06:00'),actionLabel:'FTF completado',title:person+' completó su revisión FTF de hoy',activityTitle:person+' completó su revisión FTF de hoy'};
      changed=true;
    }
    if(changed)await updateUserState(settings,recipient,{receipts:{...receipts,ftfCompletions:Object.fromEntries(Object.entries(records).slice(-300))}},state.revision);
  }
}
