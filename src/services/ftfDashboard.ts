import {NotionCalendarActivity} from '@/types/anfeta';
import {mexicoDate,mexicoMinutes} from './calendarPresentation';
import {normalizePerson} from './identityNormalizer';
import {isFtfReminder} from './progressKpis';
import {workflowState} from './activityWorkflow';
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

function ftfRecordedTime(record: any, day: string, now: Date): string | null {
  if (!record) return null;
  const time = record.timeKind === 'confirmed'
    ? record.completedAt || record.updated
    : record.observedAt || record.updated;
  const timestamp = Date.parse(time || '');
  if (record.timeKind !== 'confirmed' && !record.observedAt && time && mexicoMinutes(time) === 0) return null;
  return Number.isFinite(timestamp) && timestamp <= now.getTime() && mexicoDate(time) === day ? time : null;
}

export function ftfPendingAssignmentMinutes(day: string, activities: NotionCalendarActivity[]) {
  const from = Date.parse(day + 'T10:00:00-06:00');
  const until = Date.parse(day + 'T18:00:00-06:00');
  const intervals = activities
    .filter(activity => !activity.isSuspended && workflowState(activity.status, activity.title) !== 'suspended')
    .map(activity => ({
      start: Math.max(from, Date.parse(activity.start)),
      end: Math.min(until, Date.parse(activity.end)),
    }))
    .filter(({start, end}) => end > start)
    .sort((a, b) => a.start - b.start);

  let covered = 0;
  let cursor = from;
  for (const {start, end} of intervals) {
    if (end <= cursor) continue;
    covered += end - Math.max(start, cursor);
    cursor = end;
  }
  return Math.round((until - from - covered) / 60000);
}

export function shiftFtfDate(day: string, days: number) {
  return new Date(Date.parse(day + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}

export function ftfWeekStart(day: string) {
  const weekday = new Date(day + 'T12:00:00Z').getUTCDay();
  return shiftFtfDate(day, -((weekday + 6) % 7));
}

export type FtfPresenceDay = {
  day: string;
  person: string;
  firstSeen: string;
  lastSeen: string;
};

export function buildFtfWeek(
  actor: string,
  start: string,
  people: Parameters<typeof buildFtfDashboard>[2],
  activities: NotionCalendarActivity[],
  records: Record<string, any>,
  presence: FtfPresenceDay[],
  now = new Date(),
) {
  const today = mexicoDate(now);
  const signals = new Map(presence.map(row => [row.day + ':' + row.person, row]));
  const days = Array.from({length: 7}, (_, index) => shiftFtfDate(start, index))
    .filter(day => day <= today)
    .map(day => {
      const report = buildFtfDashboard(actor, day, people, activities, records, now);
      const weekend = [0, 6].includes(new Date(day + 'T12:00:00Z').getUTCDay());
      return {
        day,
        people: report.people.map(person => {
          const signal = signals.get(day + ':' + person.name);
          const recordedAt = person.completedAt;
          const personActivities = activities.filter(activity =>
            normalizePerson(activity.person) === person.name &&
            activity.start?.slice(0, 10) === day
          );
          const ftfVerifiedMinutes = personActivities
            .filter(a => a.ftfVerified)
            .reduce((sum, a) => sum + Math.max(0, (Date.parse(a.end) - Date.parse(a.start)) / 60000), 0);
          const completedMinutes = personActivities
            .filter(a => a.isFinalized || workflowState(a.status, a.title) === 'completed')
            .reduce((sum, a) => sum + Math.max(0, (Date.parse(a.end) - Date.parse(a.start)) / 60000), 0);

          let agenda10Status = 'Sin evidencia';
          if (weekend) {
            agenda10Status = 'Sin jornada';
          } else if (day === today) {
            agenda10Status = person.pendingAssignmentMinutes === 0 ? 'Lista para 10:00' : 'Pendientes por asignar';
          }

          return {
            name: person.name,
            firstSeen: signal?.firstSeen ?? null,
            lastSeen: signal?.lastSeen ?? null,
            recordedAt,
            timeKind: recordedAt ? person.timeKind === 'confirmed' ? 'confirmed' : 'observed' : null,
            verified: person.verified,
            total: person.total,
            pendingAssignmentMinutes: weekend ? null : person.pendingAssignmentMinutes,
            agenda10Status,
            workdayHours: weekend ? null : 8.0,
            productiveGoalHours: weekend ? null : 6.5,
            ftfVerifiedMinutes,
            completedMinutes,
          };
        }),
      };
    });
  return {start, end: shiftFtfDate(start, 6), days};
}

export function buildFtfDashboard(actor:string,day:string,people:{name:string;alias?:string;role?:string}[],activities:NotionCalendarActivity[],records:Record<string,any>,now=new Date(),presence: FtfPresenceDay[] = []) {
  if(!canViewFtfDashboard(actor))throw Error('Inicia sesión para consultar la bitácora del equipo.');
  const cutoff=Date.parse(day+'T18:00:00-06:00');
  const team=[...new Map(people.map(p=>[normalizePerson(p.name),p])).values()];
  const signals = new Map(presence.map(row => [row.day + ':' + row.person, row]));

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
    const pendingAssignmentMinutes = ftfPendingAssignmentMinutes(day, all);
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

    const signal = signals.get(day + ':' + name);
    const firstSeen = signal?.firstSeen || null;
    const presenceLastSeen = signal?.lastSeen || null;

    // Primer señal: Presencia real en ANFETA si existe; si no, primera actividad programada
    const firstSignal = firstSeen || firstActivityStart || null;

    // Última señal: La más reciente entre última presencia ANFETA y última edición en Notion
    const lastCandidates = [presenceLastSeen, lastActivityEdited].filter(
      (v): v is string => Boolean(v && Number.isFinite(Date.parse(v)))
    );
    lastCandidates.sort();
    const lastSignal = lastCandidates.at(-1) || null;

    const record=records['ftf:'+day+':'+name],stamp=Date.parse(record?.updated||'');
    const validRecord=record?.person===name&&record?.date===day&&Number.isFinite(stamp)&&mexicoDate(record.updated)===day&&stamp<=now.getTime();
    
    const completedAt = validRecord
      ? ftfRecordedTime(record, day, now)
      : null;

    const lateStamp = completedAt ? Date.parse(completedAt) : stamp;
    const late = !!completedAt && Number.isFinite(lateStamp) && lateStamp > cutoff;
    const status=!all.length?'empty':pending.length?'pending':validRecord?'complete':'unconfirmed';
    return {
      ...person,
      name,
      total:all.length,
      verified:all.length-pending.length,
      pending,
      completedActivities: verifiedActivities,
      completedAt,
      late,
      timeKind:record?.timeKind||'observed',
      status,
      assignedHours,
      pendingAssignmentMinutes,
      completedHours,
      lastActivityEdited,
      firstActivityStart,
      firstSeen,
      presenceLastSeen,
      firstSignal,
      lastSignal,
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
