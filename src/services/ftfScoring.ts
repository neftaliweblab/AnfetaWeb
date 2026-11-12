export interface FtfPersonInput {
  name: string;
  assignedHours: number;
  completedHours: number;
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
  star1: boolean; // Tiempo 1: Cobertura FTF dinámica (sin huecos)
  star2: boolean; // Tiempo 2: Avances, checks y terminados
  star3: boolean; // Tiempo 3: FTF final antes de corte 18:30
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
    stars: [boolean, boolean, boolean];
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
  const hasWork =
    Boolean(person.isOnline) ||
    Boolean(person.firstSignalAt) ||
    Boolean(person.lastSignalAt) ||
    person.assignedHours > 0 ||
    person.completedHours > 0 ||
    person.verified > 0;

  const isExplicitlyAbsent = saved?.absent === true || (!hasWork && person.status === 'empty');

  const pendingGapMinutes = Math.max(0, Math.round(person.ftfPendingAssignmentMinutes || 0));
  const fullCoverage = person.assignedHours > 0 && pendingGapMinutes <= 0;

  // 1. Asistencia / 1a Señal (0 o 20 pts)
  const attendancePts = isExplicitlyAbsent ? 0 : hasWork ? 20 : 0;

  // 2. Tiempo 1: Cobertura FTF dinámica (0..20 pts)
  // Se actualiza dinámicamente durante el día cuando la agenda se llena sin huecos
  let coveragePts = 0;
  let coverageState: 'complete' | 'dynamic_pending' | 'empty' = 'empty';
  if (!isExplicitlyAbsent && person.assignedHours > 0) {
    if (fullCoverage) {
      coveragePts = 20;
      coverageState = 'complete';
    } else {
      const assignedMin = person.assignedHours * 60;
      const ratio = assignedMin / Math.max(1, assignedMin + pendingGapMinutes);
      coveragePts = Math.round(ratio * 20);
      coverageState = 'dynamic_pending';
    }
  }

  // 3. Tiempo 2: Avances, Checks y Actividades terminadas (0..35 pts)
  let progressPts = 0;
  if (!isExplicitlyAbsent) {
    if (person.total > 0) {
      progressPts = Math.round((person.verified / person.total) * 35);
    } else if (person.assignedHours > 0) {
      progressPts = Math.round(Math.min(1, person.completedHours / Math.max(0.5, person.assignedHours)) * 35);
    } else if (hasWork) {
      progressPts = 15;
    }
  }

  // 4. Tiempo 3: FTF Final antes del corte 18:30 (0..25 pts)
  const autoStar1 = !isExplicitlyAbsent && (saved?.starsOverride?.star1 ?? fullCoverage);
  const autoStar2 =
    !isExplicitlyAbsent &&
    (saved?.starsOverride?.star2 ??
      ((person.total > 0 ? person.verified / person.total >= 0.7 : person.completedHours >= Math.min(person.assignedHours || 6.5, 5)) &&
        person.completedHours > 0));
  const ftfCompletedCleanly =
    !isExplicitlyAbsent &&
    (person.status === 'complete' || Boolean(person.completedAt) || (person.total > 0 && person.verified === person.total && person.total > 0));
  const autoStar3 = !isExplicitlyAbsent && (saved?.starsOverride?.star3 ?? (ftfCompletedCleanly && !person.late));

  let ftfFinalPts = 0;
  if (!isExplicitlyAbsent) {
    if (autoStar3) {
      ftfFinalPts = 25;
    } else if (ftfCompletedCleanly && person.late) {
      ftfFinalPts = 15; // Completado pero después de horario
    } else if (saved?.starsOverride?.star3 === true) {
      ftfFinalPts = 25;
    }
  }

  // Aplicar ajuste de estrellas manuales en los puntos si el supervisor las forzó
  const effectiveCoveragePts =
    isExplicitlyAbsent ? 0 : saved?.starsOverride?.star1 === true ? 20 : saved?.starsOverride?.star1 === false ? Math.min(coveragePts, 10) : coveragePts;
  const effectiveProgressPts =
    isExplicitlyAbsent ? 0 : saved?.starsOverride?.star2 === true ? Math.max(progressPts, 30) : progressPts;

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
  const normalShiftFulfilled = !isExplicitlyAbsent && (person.completedHours >= 6.5 || finalScore >= 75 || autoStar3);
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
          stars: [false, false, false] as [boolean, boolean, boolean],
          absent: false,
          overtimeHours: 0,
          published: false,
        };
      }
      return {
        date,
        score: entry.absent ? 0 : entry.finalScore,
        stars: [Boolean(entry.stars?.star1), Boolean(entry.stars?.star2), Boolean(entry.stars?.star3)] as [boolean, boolean, boolean],
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
