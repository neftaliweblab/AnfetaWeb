import {mexicoDate,mexicoMinutes} from './calendarPresentation';
import {normalizePerson} from './identityNormalizer';
import {NotionCalendarActivity} from '@/types/anfeta';
import {isFtfReminder} from './progressKpis';

export function canViewFtfDashboard(user:string){return ['John','Neftali'].includes(normalizePerson(user));}

export function buildFtfDashboard(actor:string,day:string,people:{name:string;alias?:string;role?:string}[],activities:NotionCalendarActivity[],records:Record<string,any>,now=new Date()) {
  if(!canViewFtfDashboard(actor))throw Error('Este panel está disponible únicamente para John y Neftalí.');
  const cutoff=Date.parse(day+'T18:00:00-06:00');
  const team=[...new Map(people.map(p=>[normalizePerson(p.name),p])).values()];
  const rows=team.filter(p=>normalizePerson(p.name)!=='Emmanuel'&&normalizePerson(p.name)!=='Sin asignar').map(person=>{
    const name=normalizePerson(person.name),unique=new Map<string,NotionCalendarActivity>();
    for(const activity of activities){
      if(!activity.start||activity.isReviewMirror||activity.isHandoffMirror||isFtfReminder(activity)||normalizePerson(activity.person)!==name||mexicoDate(activity.start)!==day||mexicoMinutes(activity.start)>=1080)continue;
      unique.set(activity.pageId,activity);
    }
    const all=[...unique.values()],pending=all.filter(a=>!a.ftfAvailable||!a.ftfVerified).sort((a,b)=>a.start.localeCompare(b.start));
    const record=records['ftf:'+day+':'+name],stamp=Date.parse(record?.updated||'');
    const completedAt=record?.person===name&&record?.date===day&&Number.isFinite(stamp)&&mexicoDate(record.updated)===day&&stamp<=now.getTime()?record.updated:null;
    const late=!!completedAt&&stamp>cutoff;
    const status=!all.length?'empty':pending.length?'pending':completedAt?'complete':'unconfirmed';
    return {...person,name,total:all.length,verified:all.length-pending.length,pending,completedAt,late,timeKind:record?.timeKind||'observed',status};
  });
  return {day,cutoff:'18:00',updatedAt:now.toISOString(),deadlinePassed:now.getTime()>cutoff,people:rows,completed:rows.filter(p=>p.status==='complete'&&!p.late).length,late:rows.filter(p=>p.status==='complete'&&p.late).length,pending:rows.filter(p=>p.status==='pending').length,unconfirmed:rows.filter(p=>p.status==='unconfirmed').length,empty:rows.filter(p=>p.status==='empty').length};
}
