export type FtfStarValue = boolean | number;

export function starWeight(value: FtfStarValue | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  return value === true ? 1 : 0;
}

export function normalizeStarValue(weight: number): FtfStarValue {
  const clamped = Math.max(0, Math.min(1, weight));
  if (clamped >= 0.99) return true;
  if (clamped <= 0.01) return false;
  return Math.round(clamped * 100) / 100;
}

export interface FtfPersonInput {
  name: string;
  assignedHours: number;
  completedHours: number;
  workCompletedHours?: number;
  reviewHours?: number;
  inProgressHours?: number;
  ftfVerifiedHours?: number;
  expiredUnfinishedCount?: number;
  verified: number;
  total: number;
  ftfPendingAssignmentMinutes?: number;
  status: 'complete' | 'pending' | 'empty' | string;
  late?: boolean;
  completedAt?: string | null;
  lastActivityEdited?: string | null;
  firstSignalAt?: string | null;
  lastSignalAt?: string | null;
  isOnline?: boolean;
  afterCutoffHours?: number;
}

export interface FtfStars {
  star1: FtfStarValue; // Tiempo 1: Cobertura FTF dinámica (sin huecos)
  star2: FtfStarValue; // Tiempo 2: Avances, checks y terminados
  star3: FtfStarValue; // Tiempo 3: FTF final antes de corte 18:30
}

export interface SavedFtfScoreEntry {
  person: string;
  date: string;
  autoScore: number;
  finalScore: number;
  manualScoreOverride?: number | null;
  stars: FtfStars;
  starsOverride?: Partial<FtfStars>;
  absent?: boolean;
  overtimeHours: number;
  supervisorNote?: string;
  updatedBy?: string;
  updatedAt?: string;
  published?: boolean;
  publishedAt?: string;
  breakdown: {
    attendance: number; // max 20
    coverage: number;   // max 20
    progress: number;   // max 35
    ftfFinal: number;   // max 25
  };
  pendingItemsSummary?: string;
}

export interface ComputedFtfScore extends SavedFtfScoreEntry {
  coverageState: 'complete' | 'dynamic_pending' | 'empty';
  pendingGapMinutes: number;
  isPublished: boolean;
}

export interface WeeklyPayrollRow {
  person: string;
  days: Array<{
    date: string;
    score: number | null;
    stars: [FtfStarValue, FtfStarValue, FtfStarValue];
    absent: boolean;
    overtimeHours: number;
    published: boolean;
  }>;
  weeklyAverage: number;
  absences: number;
  overtimeTotalHours: number;
  payrollStatus: 'Bono / Excelente' | 'Cumplimiento Regular' | 'Revisar / Atención';
}

export function getMexicoTimeMinutes(now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    return h * 60 + m;
  } catch {
    return now.getHours() * 60 + now.getMinutes();
  }
}

export function computeHybridFtfScore(
  person: FtfPersonInput,
  date: string,
  saved?: Partial<SavedFtfScoreEntry> | null,
  options?: { now?: Date; pendingTitles?: string[] }
): ComputedFtfScore {
  const now = options?.now || new Date();
  // Solo señal real de conexión en ANFETA o trabajo real terminado/en revisión cuenta como asistencia;
  // actividades pre-agendadas en "Por hacer" sin conexión NO otorgan puntos de asistencia.
  const hasWork =
    Boolean(person.isOnline) ||
    Boolean(person.firstSignalAt) ||
    Boolean(person.lastSignalAt) ||
    person.completedHours > 0 ||
    (person.reviewHours || 0) > 0;

  const isExplicitlyAbsent = saved?.absent === true || (saved?.absent !== false && !hasWork);

  const pendingGapMinutes = Math.max(0, Math.round(person.ftfPendingAssignmentMinutes || 0));
  const fullCoverage = person.assignedHours > 0 && pendingGapMinutes <= 0;

  // 1. Asistencia / 1a Señal (0 o 20 pts)
  const attendancePts = isExplicitlyAbsent ? 0 : hasWork ? 20 : 0;

  // 2. Tiempo 1: Cobertura FTF dinámica (0..20 pts)
  let coveragePts = 0;
  let coverageRatio = 0;
  let coverageState: 'complete' | 'dynamic_pending' | 'empty' = 'empty';
  if (!isExplicitlyAbsent && person.assignedHours > 0) {
    if (fullCoverage) {
      coveragePts = 20;
      coverageRatio = 1;
      coverageState = 'complete';
    } else {
      const assignedMin = person.assignedHours * 60;
      coverageRatio = assignedMin / Math.max(1, assignedMin + pendingGapMinutes);
      coveragePts = Math.round(coverageRatio * 20);
      coverageState = 'dynamic_pending';
    }
  }

  // 3. Tiempo 2: Avances reales (Terminadas/En revisión + FTF checks - bloques vencidos sin cerrar) (0..35 pts)
  let progressPts = 0;
  let progressRatio = 0;
  const expiredCount = Math.max(0, Number(person.expiredUnfinishedCount || 0));
  if (!isExplicitlyAbsent) {
    if (person.assignedHours > 0) {
      const hoursRatio = Math.min(1, person.completedHours / Math.max(0.5, person.assignedHours));
      const checksRatio = person.total > 0 ? person.verified / person.total : hoursRatio;
      const penalty = expiredCount > 0 ? Math.min(0.35, expiredCount * 0.12) : 0;
      progressRatio = Math.max(0, Math.min(1, hoursRatio * 0.7 + checksRatio * 0.3 - penalty));
      progressPts = Math.round(progressRatio * 35);
    } else if (person.total > 0) {
      progressRatio = Math.min(1, person.verified / person.total);
      progressPts = Math.round(progressRatio * 35);
    } else if (hasWork) {
      progressRatio = 0.4;
      progressPts = 14;
    }
  }

  // Estrellas 1..3 (soportan valores fraccionales 0..1: 0=0%, 0.5=½★ 50%, 1=★ 100%)
  const hasStar1Override = saved?.starsOverride?.star1 !== undefined;
  const hasStar2Override = saved?.starsOverride?.star2 !== undefined;
  const hasStar3Override = saved?.starsOverride?.star3 !== undefined;

  const autoStar1: FtfStarValue = isExplicitlyAbsent
    ? false
    : hasStar1Override
    ? normalizeStarValue(starWeight(saved!.starsOverride!.star1))
    : fullCoverage;

  const computedStar2Weight =
    progressRatio >= 0.8 && person.completedHours > 0
      ? 1
      : progressRatio >= 0.35 && (person.completedHours > 0 || person.verified > 0)
      ? 0.5
      : 0;
  const autoStar2: FtfStarValue = isExplicitlyAbsent
    ? false
    : hasStar2Override
    ? normalizeStarValue(starWeight(saved!.starsOverride!.star2))
    : normalizeStarValue(computedStar2Weight);

  const ftfCompletedCleanly =
    !isExplicitlyAbsent &&
    (person.status === 'complete' || Boolean(person.completedAt) || (person.total > 0 && person.verified === person.total && person.completedHours >= person.assignedHours * 0.85));

  const autoStar3: FtfStarValue = isExplicitlyAbsent
    ? false
    : hasStar3Override
    ? normalizeStarValue(starWeight(saved!.starsOverride!.star3))
    : ftfCompletedCleanly
    ? person.late
      ? 0.5
      : true
    : false;

  const w1 = starWeight(autoStar1);
  const w2 = starWeight(autoStar2);
  const w3 = starWeight(autoStar3);

  const ftfFinalPts = isExplicitlyAbsent
    ? 0
    : hasStar3Override
    ? Math.round(w3 * 25)
    : w3 >= 0.99
    ? 25
    : w3 > 0
    ? Math.round(w3 * 25)
    : 0;

  // Si el supervisor ajusta manualmente una estrella (ej. 50% ½★), recalcula ese rubro proporcionalmente
  const effectiveCoveragePts = isExplicitlyAbsent
    ? 0
    : hasStar1Override
    ? Math.round(w1 * 20)
    : coveragePts;
  const effectiveProgressPts = isExplicitlyAbsent
    ? 0
    : hasStar2Override
    ? Math.round(w2 * 35)
    : progressPts;

  const autoScore = isExplicitlyAbsent
    ? 0
    : Math.max(0, Math.min(100, attendancePts + effectiveCoveragePts + effectiveProgressPts + ftfFinalPts));

  const hasManualOverride = typeof saved?.manualScoreOverride === 'number' && !Number.isNaN(saved.manualScoreOverride);
  const finalScore = isExplicitlyAbsent
    ? 0
    : hasManualOverride
    ? Math.max(0, Math.min(100, Math.round(saved!.manualScoreOverride!)))
    : autoScore;

  // Bono Horas Extra post-18:30 solo si cumplió jornada normal
  const normalShiftFulfilled = !isExplicitlyAbsent && (person.completedHours >= 6.5 || finalScore >= 75 || w3 >= 0.99);
  const rawOvertime = Number(person.afterCutoffHours ?? saved?.overtimeHours ?? 0);
  const overtimeHours = normalShiftFulfilled && rawOvertime > 0 ? Math.round(rawOvertime * 10) / 10 : 0;

  const mexicoMin = getMexicoTimeMinutes(now);
  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);
  const isCutoffReached = date < todayIso || (date === todayIso && mexicoMin >= 18 * 60 + 30);

  return {
    person: person.name,
    date,
    autoScore,
    finalScore,
    manualScoreOverride: hasManualOverride ? saved!.manualScoreOverride! : null,
    stars: {
      star1: autoStar1,
      star2: autoStar2,
      star3: autoStar3,
    },
    starsOverride: saved?.starsOverride,
    absent: isExplicitlyAbsent,
    overtimeHours,
    supervisorNote: saved?.supervisorNote || '',
    updatedBy: saved?.updatedBy,
    updatedAt: saved?.updatedAt,
    published: Boolean(saved?.published),
    publishedAt: saved?.publishedAt,
    isPublished: Boolean(saved?.published) || isCutoffReached && Boolean(saved?.publishedAt),
    coverageState,
    pendingGapMinutes,
    breakdown: {
      attendance: attendancePts,
      coverage: effectiveCoveragePts,
      progress: effectiveProgressPts,
      ftfFinal: ftfFinalPts,
    },
    pendingItemsSummary: saved?.pendingItemsSummary || (options?.pendingTitles?.slice(0, 3).join(' · ') || ''),
  };
}

export function buildWeeklyPayrollMatrix(
  weekDates: string[], // [Lun, Mar, Mie, Jue, Vie]
  teamNames: string[],
  scoresByDate: Record<string, Record<string, SavedFtfScoreEntry>>
): WeeklyPayrollRow[] {
  const workDays = weekDates.slice(0, 5);
  return teamNames.map(person => {
    const days = workDays.map(date => {
      const entry = scoresByDate[date]?.[person];
      if (!entry) {
        return {
          date,
          score: null,
          stars: [false, false, false] as [FtfStarValue, FtfStarValue, FtfStarValue],
          absent: false,
          overtimeHours: 0,
          published: false,
        };
      }
      return {
        date,
        score: entry.absent ? 0 : entry.finalScore,
        stars: [
          normalizeStarValue(starWeight(entry.stars?.star1)),
          normalizeStarValue(starWeight(entry.stars?.star2)),
          normalizeStarValue(starWeight(entry.stars?.star3)),
        ] as [FtfStarValue, FtfStarValue, FtfStarValue],
        absent: Boolean(entry.absent),
        overtimeHours: Number(entry.overtimeHours || 0),
        published: Boolean(entry.published),
      };
    });

    const scoredDays = days.filter(d => d.score !== null);
    const weeklyAverage = scoredDays.length > 0
      ? Math.round(scoredDays.reduce((sum, d) => sum + (d.score || 0), 0) / scoredDays.length)
      : 0;
    const absences = days.filter(d => d.absent).length;
    const overtimeTotalHours = Math.round(days.reduce((sum, d) => sum + d.overtimeHours, 0) * 10) / 10;

    let payrollStatus: WeeklyPayrollRow['payrollStatus'] = 'Cumplimiento Regular';
    if (scoredDays.length === 0) {
      payrollStatus = 'Cumplimiento Regular';
    } else if (weeklyAverage >= 85 && absences === 0) {
      payrollStatus = 'Bono / Excelente';
    } else if (weeklyAverage < 60 || absences >= 2) {
      payrollStatus = 'Revisar / Atención';
    }

    return {
      person,
      days,
      weeklyAverage,
      absences,
      overtimeTotalHours,
      payrollStatus,
    };
  });
}
