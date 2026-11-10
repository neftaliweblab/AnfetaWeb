import { NotionCalendarActivity } from "@/types/anfeta";
import { normalizePerson } from "./identityNormalizer";
import { workflowState } from "./activityWorkflow";
import { canEditActivity } from "./activityPermissions";
import { calendarEntryAllowsOverlap } from "./calendarEntryPolicy";
import { titlePriority, ActivityPriority } from "./activityTags";
import { mexicoMinutes, mexicoDate, calendarDisplayTitle } from "./calendarPresentation";

export interface ReorderRule {
  id: string;
  name: string;
  description: string;
  badge: string;
}

export const CALENDAR_REORDER_RULES: ReorderRule[] = [
  {
    id: 'timeline_congruence',
    name: '1. Congruencia temporal (Respetar línea de tiempo)',
    description: 'En el día de hoy, las actividades pendientes arrancan a partir de la hora actual redondeada (sin programar pendientes hacia el pasado tras la línea roja).',
    badge: '⏱ Sin pasado',
  },
  {
    id: 'strict_priority',
    name: '2. Jerarquía de Prioridad (00 > 11 > 22 > 33)',
    description: '00 Urgentes primero, 11 Primarias a continuación, 22 Secundarias después y 33 Backlog al final. Conserva el orden original entre iguales.',
    badge: '🚨 Prioridades',
  },
  {
    id: 'sequential_chain',
    name: '3. Desempalme secuencial en cadena (Cero amontonamiento)',
    description: 'Elimina empalmes: cada actividad inicia inmediatamente al finalizar la anterior (nuevoInicio = finAnterior).',
    badge: '🔗 En cadena',
  },
  {
    id: 'preserve_duration',
    name: '4. Conservación de duración estimada',
    description: 'Se respeta la duración estimada original de cada actividad (redondeada a múltiplos de 15 min, mínimo 30 min).',
    badge: '⏳ Duración fija',
  },
  {
    id: 'preserve_fixed',
    name: '5. Intocabilidad de Terminadas (TER/FIN) y En Revisión (REV)',
    description: 'Las actividades terminadas, en revisión, con candado o espejos permanecen inamovibles en su horario registrado.',
    badge: '🛡️ Bloqueadas fijas',
  },
  {
    id: 'shift_limits',
    name: '6. Límite de jornada laboral (09:00 a 18:00 / 22:00)',
    description: 'La jornada laboral estándar cubre hasta las 18:00. Las actividades que se extiendan más allá se marcan con aviso preventivo.',
    badge: '🏢 Jornada 18h',
  },
];

export interface ReorderItemProposal {
  pageId: string;
  title: string;
  person: string;
  priority: ActivityPriority;
  priorityWeight: number;
  durationMinutes: number;
  expectedStart: string;
  expectedEnd: string;
  expectedTitle: string;
  start: string; // proposed ISO start
  end: string;   // proposed ISO end
  hasChanged: boolean;
  exceedsRegularHours: boolean; // past 18:00
  exceedsMaxHours: boolean;     // past 22:00
  allowOverlap: boolean;
}

export interface ReorderPlanResult {
  proposals: ReorderItemProposal[];
  changes: ReorderItemProposal[];
  fixedCount: number;
  totalDurationMinutes: number;
  exceedsRegularCount: number;
  exceedsMaxCount: number;
  person: string;
  day: string;
  startMinute: number;
  endMinute: number;
}

const at = (day: string, m: number) =>
  day + 'T' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') + ':00-06:00';

function getMexicoCurrentMinute(): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
    const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
    return hour * 60 + minute;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

function getMexicoTodayString(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const PRIORITY_WEIGHTS: Record<ActivityPriority, number> = {
  '00': 0, // Urgente
  '11': 1, // Primaria
  '22': 2, // Secundaria
  '33': 3, // Usar / practicar
};

/**
 * Motor de reordenamiento inteligente con reglas corporativas:
 * 1. Respetar línea de tiempo (si es hoy, no antes de la hora actual redondeada).
 * 2. Ordenar pendientes por prioridad 00 > 11 > 22 > 33.
 * 3. Desempalmar secuencialmente respetando huecos entre actividades terminadas/fijas.
 * 4. Respetar duraciones mínimas y límites de jornada.
 */
export function calculateCalendarReorder(
  activities: NotionCalendarActivity[],
  day: string,
  person: string,
  currentUser: string
): ReorderPlanResult {
  const normPerson = normalizePerson(person);
  const isToday = day === getMexicoTodayString();
  const currentMin = getMexicoCurrentMinute();

  // Filtrar actividades correspondientes al día y la persona
  const personDayActivities = activities.filter(a => {
    if (a.isReviewMirror) return false;
    if (normalizePerson(a.person) !== normPerson) return false;
    const actDay = mexicoDate(a.start);
    return actDay === day;
  });

  // Identificar actividades fijas:
  // - Terminadas (completed), En revisión (review), Suspendidas (suspended)
  // - Marcadas como locked
  // - Actividades que permiten solapamiento especial
  // - O si es hoy, actividades que ya terminaron antes de la hora actual
  const fixedActivities: NotionCalendarActivity[] = [];
  const eligibleActivities: NotionCalendarActivity[] = [];

  for (const act of personDayActivities) {
    const state = workflowState(act.status, act.title);
    const isCompletedOrReview = state !== 'pending';
    const isLocked = Boolean(act.isLocked);
    const allowOverlap = calendarEntryAllowsOverlap(act.title);

    const endMinute = mexicoMinutes(act.end);
    const alreadyEndedToday = isToday && endMinute <= currentMin;

    if (isCompletedOrReview || isLocked || allowOverlap || alreadyEndedToday || !canEditActivity(currentUser, act)) {
      fixedActivities.push(act);
    } else {
      eligibleActivities.push(act);
    }
  }

  // Intervalos ocupados por actividades fijas: [startMin, endMin]
  const fixedIntervals: [number, number][] = fixedActivities
    .map(a => [mexicoMinutes(a.start), mexicoMinutes(a.end)] as [number, number])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0]);

  // Determinar cursor de inicio según Regla 1 (Congruencia temporal):
  // Si es hoy: arranca en la hora actual redondeada hacia arriba al siguiente bloque de 15 min,
  // con mínimo de 540 (09:00 AM).
  // Si es otro día: arranca a las 540 (09:00 AM).
  let startMinute = 540; // 09:00 AM
  if (isToday) {
    const roundedNow = Math.ceil(currentMin / 15) * 15;
    startMinute = Math.max(540, roundedNow);
  }

  // Ordenar pendientes según Regla 2 (Prioridad 00 > 11 > 22 > 33, luego orden cronológico original)
  const sortedEligible = [...eligibleActivities].sort((a, b) => {
    const prioA = titlePriority(a.title, a.person) || '11';
    const prioB = titlePriority(b.title, b.person) || '11';
    const weightA = PRIORITY_WEIGHTS[prioA] ?? 1;
    const weightB = PRIORITY_WEIGHTS[prioB] ?? 1;

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    // Mismo nivel de prioridad: respetar hora inicial cronológica
    const timeA = Date.parse(a.start) || 0;
    const timeB = Date.parse(b.start) || 0;
    return timeA - timeB;
  });

  // Reubicar secuencialmente cada actividad (Reglas 3 y 4)
  let cursor = startMinute;
  const proposals: ReorderItemProposal[] = [];
  let totalDurationMinutes = 0;
  let exceedsRegularCount = 0;
  let exceedsMaxCount = 0;

  for (const act of sortedEligible) {
    const prio = titlePriority(act.title, act.person) || '11';
    const weight = PRIORITY_WEIGHTS[prio] ?? 1;

    // Calcular duración original
    const rawDuration = (Date.parse(act.end) - Date.parse(act.start)) / 60000;
    const duration = Math.max(30, Math.ceil((Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 30) / 15) * 15);
    totalDurationMinutes += duration;

    // Saltar intervalos ocupados por actividades fijas
    let fits = false;
    while (!fits && cursor + duration <= 1320) {
      const collision = fixedIntervals.find(([s, e]) => cursor < e && cursor + duration > s);
      if (collision) {
        cursor = collision[1]; // saltar al final del bloque fijo
      } else {
        fits = true;
      }
    }

    const proposedStart = at(day, cursor);
    const proposedEnd = at(day, cursor + duration);
    const hasChanged = act.start !== proposedStart || act.end !== proposedEnd;

    const exceedsRegularHours = cursor + duration > 1080; // después de 18:00
    const exceedsMaxHours = cursor + duration > 1320;     // después de 22:00

    if (exceedsRegularHours) exceedsRegularCount++;
    if (exceedsMaxHours) exceedsMaxCount++;

    proposals.push({
      pageId: act.pageId,
      title: act.title,
      person: act.person,
      priority: prio,
      priorityWeight: weight,
      durationMinutes: duration,
      expectedStart: act.start,
      expectedEnd: act.end,
      expectedTitle: act.title,
      start: proposedStart,
      end: proposedEnd,
      hasChanged,
      exceedsRegularHours,
      exceedsMaxHours,
      allowOverlap: true,
    });

    cursor += duration;
  }

  // Las modificaciones a realizar
  const changes = proposals.filter(p => p.hasChanged);

  return {
    proposals,
    changes,
    fixedCount: fixedActivities.length,
    totalDurationMinutes,
    exceedsRegularCount,
    exceedsMaxCount,
    person,
    day,
    startMinute,
    endMinute: cursor,
  };
}
