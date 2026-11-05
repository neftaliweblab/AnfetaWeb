import {mexicoDate,mexicoMinutes} from './calendarPresentation';
import {normalizePerson} from './identityNormalizer';
import {NotionCalendarActivity} from '@/types/anfeta';
import {isFtfReminder} from './progressKpis';

export function canViewFtfDashboard(user:string){return ['John','Neftali'].includes(normalizePerson(user));}

function activityHours(a: NotionCalendarActivity): number {
  if (!a.start) return 0.5;
  const start = Date.parse(a.start);
  const end = Date.parse(a.end || a.start);
  if (!Number.isFinite(start)) return 0.5;
  const diff = (end - start) / 3600000;
  return diff > 0 && diff <= 14 ? diff : 0.5;
}

export function buildFtfDashboard(actor:string,day:string,people:{name:string;alias?:string;role?:string}[],activities:NotionCalendarActivity[],records:Record<string,any>,now=new Date()) {
  if(!canViewFtfDashboard(actor))throw Error('Este panel está disponible únicamente para John y Neftalí.');
  const cutoff=Date.parse(day+'T18:00:00-06:00');
  const team=[...new Map(people.map(p=>[normalizePerson(p.name),p])).values()];
  let earliestStartMin = 1440;
  const rows=team.filter(p=>normalizePerson(p.name)!=='Emmanuel'&&normalizePerson(p.name)!=='Sin asignar').map(person=>{
    const name=normalizePerson(person.name),unique=new Map<string,NotionCalendarActivity>();
    for(const activity of activities){
      if(!activity.start||activity.isReviewMirror||activity.isHandoffMirror||isFtfReminder(activity)||normalizePerson(activity.person)!==name||mexicoDate(activity.start)!==day||mexicoMinutes(activity.start)>=1080)continue;
      unique.set(activity.pageId,activity);
      const mins = mexicoMinutes(activity.start);
      if (mins < earliestStartMin) earliestStartMin = mins;
    }
    const all=[...unique.values()],pending=all.filter(a=>!a.ftfAvailable||!a.ftfVerified).sort((a,b)=>a.start.localeCompare(b.start));
    const verifiedActivities = all.filter(a => a.ftfAvailable && a.ftfVerified);
    const assignedHours = Number(all.reduce((sum, a) => sum + activityHours(a), 0).toFixed(1));
    const completedHours = Number(verifiedActivities.reduce((sum, a) => sum + activityHours(a), 0).toFixed(1));
    const record=records['ftf:'+day+':'+name],stamp=Date.parse(record?.updated||'');
    const completedAt=record?.person===name&&record?.date===day&&Number.isFinite(stamp)&&mexicoDate(record.updated)===day&&stamp<=now.getTime()?record.updated:null;
    const late=!!completedAt&&stamp>cutoff;
    const status=!all.length?'empty':pending.length?'pending':completedAt?'complete':'unconfirmed';
    return {...person,name,total:all.length,verified:all.length-pending.length,pending,completedAt,late,timeKind:record?.timeKind||'observed',status,assignedHours,completedHours};
  });
  const totalAssignedHours = Number(rows.reduce((sum, p) => sum + (p.assignedHours || 0), 0).toFixed(1));
  const totalCompletedHours = Number(rows.reduce((sum, p) => sum + (p.completedHours || 0), 0).toFixed(1));
  const initialTime = earliestStartMin < 1440
    ? `${String(Math.floor(earliestStartMin / 60)).padStart(2, '0')}:${String(earliestStartMin % 60).padStart(2, '0')}`
    : '08:00';
  const finalTime = '18:00';

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
  };
}
