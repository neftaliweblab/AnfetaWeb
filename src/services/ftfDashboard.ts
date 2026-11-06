import {NotionCalendarActivity} from '@/types/anfeta';
import {mexicoDate,mexicoMinutes,mexicoMinutes as toMinutes} from './calendarPresentation';
import {normalizePerson} from './identityNormalizer';
import {isFtfReminder} from './progressKpis';
import {isTemporaryCalendarResponse} from './calendarEntryPolicy';

export function canViewFtfDashboard(user:string){
  const norm = normalizePerson(user);
  return Boolean(norm && norm !== 'Sin asignar');
}

function activityHours(a: NotionCalendarActivity): number {
  if (!a.start) return 0.5;
  const start = Date.parse(a.start);
  const end = Date.parse(a.end || a.start);
  if (!Number.isFinite(start)) return 0.5;
  const diff = (end - start) / 3600000;
  return diff > 0 && diff <= 14 ? diff : 0.5;
}

export function buildFtfDashboard(actor:string,day:string,people:{name:string;alias?:string;role?:string}[],activities:NotionCalendarActivity[],records:Record<string,any>,now=new Date()) {
  if(!canViewFtfDashboard(actor))throw Error('Inicia sesión para consultar la bitácora del equipo.');
  const cutoff=Date.parse(day+'T18:00:00-06:00');
  const team=[...new Map(people.map(p=>[normalizePerson(p.name),p])).values()];

  // Cálculo de días hábiles transcurridos en la semana (Lunes a Viernes) y meta de 6.5h diarias efectivas
  const dayDate = new Date(day + 'T12:00:00-06:00');
  const rawDayOfWeek = Number.isFinite(dayDate.getTime()) ? dayDate.getDay() : 1;
  const workDaysElapsed = rawDayOfWeek === 0 ? 5 : Math.min(5, Math.max(1, rawDayOfWeek));
  const weeklyTargetPerPerson = Number((workDaysElapsed * 6.5).toFixed(1));
  
  const rows=team.filter(p=>normalizePerson(p.name)!=='Emmanuel'&&normalizePerson(p.name)!=='Sin asignar').map(person=>{
    const name=normalizePerson(person.name),unique=new Map<string,NotionCalendarActivity>();
    for(const activity of activities){
      if(!activity.start||activity.isReviewMirror||activity.isHandoffMirror||isFtfReminder(activity)||isTemporaryCalendarResponse(activity)||normalizePerson(activity.person)!==name||mexicoDate(activity.start)!==day||mexicoMinutes(activity.start)>=1080)continue;
      unique.set(activity.pageId,activity);
    }
    const all=[...unique.values()],pending=all.filter(a=>!a.ftfAvailable||!a.ftfVerified).sort((a,b)=>a.start.localeCompare(b.start));
    const verifiedActivities = all.filter(a => a.ftfAvailable && a.ftfVerified);
    const assignedHours = Number(all.reduce((sum, a) => sum + activityHours(a), 0).toFixed(1));
    const completedHours = Number(verifiedActivities.reduce((sum, a) => sum + activityHours(a), 0).toFixed(1));
    
    // Exact last modified time of activities in Notion for this person
    const lastActivityEdited = all
      .map(a => (a as any).serverModified || (a as any).lastEdited || (a as any).last_edited_time)
      .filter(v => v && Number.isFinite(Date.parse(v)))
      .sort()
      .at(-1) || null;

    const firstActivityStart = all
      .map(a => a.start)
      .filter(Boolean)
      .sort()
      .at(0) || null;

    const record=records['ftf:'+day+':'+name],stamp=Date.parse(record?.updated||'');
    const validRecord=record?.person===name&&record?.date===day&&Number.isFinite(stamp)&&mexicoDate(record.updated)===day&&stamp<=now.getTime();
    
    let completedAt: string | null = null;
    if (validRecord) {
      const recTime = record.completedAt || record.updated;
      const recIsMidnight = mexicoMinutes(recTime) === 0;
      const actTime = lastActivityEdited && mexicoDate(lastActivityEdited) === day ? lastActivityEdited : null;
      const actIsMidnight = actTime ? mexicoMinutes(actTime) === 0 : true;

      if (actTime && !actIsMidnight && !recIsMidnight) {
        // Both exist and are non-midnight: choose the latest actual modification
        completedAt = Date.parse(actTime) >= Date.parse(recTime) ? actTime : recTime;
      } else if (actTime && !actIsMidnight) {
        // Use true Notion activity modification time instead of dummy 00:00 midnight
        completedAt = actTime;
      } else {
        completedAt = recTime;
      }
    }

    const lateStamp = completedAt ? Date.parse(completedAt) : stamp;
    const late = !!completedAt && Number.isFinite(lateStamp) && lateStamp > cutoff;
    const status=!all.length?'empty':pending.length?'pending':completedAt?'complete':'unconfirmed';
    return {
      ...person,
      name,
      total:all.length,
      verified:all.length-pending.length,
      pending,
      completedAt,
      late,
      timeKind:record?.timeKind||'observed',
      status,
      assignedHours,
      completedHours,
      lastActivityEdited,
      firstActivityStart,
    };
  });
  
  const totalAssignedHours = Number(rows.reduce((sum, p) => sum + (p.assignedHours || 0), 0).toFixed(1));
  const totalCompletedHours = Number(rows.reduce((sum, p) => sum + (p.completedHours || 0), 0).toFixed(1));
  const initialTime = '10:00';
  const finalTime = '18:00';
  const jornadaHours = 8;

  return {
    day,
    cutoff:'18:00',
    updatedAt:now.toISOString(),
    deadlinePassed:now.getTime()>cutoff,
    people:rows,
    completed:rows.filter(p=>p.status==='complete'&&!p.late).length,
    late:rows.filter(p=>p.status==='complete'&&p.late).length,
    pending:rows.filter(p=>p.status==='pending').length,
    unconfirmed:rows.filter(p=>p.status==='unconfirmed').length,
    empty:rows.filter(p=>p.status==='empty').length,
    totalAssignedHours,
    totalCompletedHours,
    initialTime,
    finalTime,
    jornadaHours,
    workDaysElapsed,
    weeklyTargetPerPerson,
  };
}
