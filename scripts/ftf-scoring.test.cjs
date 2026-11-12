const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
const ts = require(path.join(root, 'node_modules/typescript'));
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return origResolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (mod, file) =>
    mod._compile(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      file
    );
}

const { computeHybridFtfScore, buildWeeklyPayrollMatrix } = require(root + '/src/services/ftfScoring.ts');
const { buildFtfDashboard } = require(root + '/src/services/ftfDashboard.ts');

test('ftfScoring: cobertura FTF dinámica inicia incompleta con huecos y se completa al llenar la jornada', () => {
  const partialDay = computeHybridFtfScore(
    {
      name: 'Neftali',
      assignedHours: 2.0,
      completedHours: 2.0,
      verified: 2,
      total: 4,
      ftfPendingAssignmentMinutes: 360,
      status: 'pending',
      isOnline: true,
      firstSignalAt: '2026-11-12T10:02:00-06:00',
    },
    '2026-11-12'
  );

  assert.equal(partialDay.coverageState, 'dynamic_pending');
  assert.equal(partialDay.stars.star1, false);
  assert.ok(partialDay.breakdown.attendance === 20);
  assert.ok(partialDay.breakdown.coverage < 20);

  // Cuando el día se llena (0 minutos pendientes por asignar) la estrella 1 pasa a completa y suma 20/20
  const filledDay = computeHybridFtfScore(
    {
      name: 'Neftali',
      assignedHours: 8.0,
      completedHours: 8.0,
      verified: 8,
      total: 8,
      ftfPendingAssignmentMinutes: 0,
      status: 'complete',
      late: false,
      isOnline: true,
      completedAt: '2026-11-12T17:45:00-06:00',
    },
    '2026-11-12'
  );

  assert.equal(filledDay.coverageState, 'complete');
  assert.equal(filledDay.stars.star1, true);
  assert.equal(filledDay.stars.star2, true);
  assert.equal(filledDay.stars.star3, true);
  assert.equal(filledDay.finalScore, 100);
});

test('ftfScoring: falta sin señal o marcada manualmente da 0 puntos y sin bono extra', () => {
  const absentAuto = computeHybridFtfScore(
    {
      name: 'Karla',
      assignedHours: 0,
      completedHours: 0,
      verified: 0,
      total: 0,
      status: 'empty',
      isOnline: false,
    },
    '2026-11-12'
  );
  assert.equal(absentAuto.absent, true);
  assert.equal(absentAuto.finalScore, 0);
  assert.equal(absentAuto.overtimeHours, 0);

  const absentOverride = computeHybridFtfScore(
    {
      name: 'Karla',
      assignedHours: 4,
      completedHours: 4,
      verified: 4,
      total: 4,
      status: 'complete',
      isOnline: true,
      afterCutoffHours: 2.0,
    },
    '2026-11-12',
    { absent: true }
  );
  assert.equal(absentOverride.absent, true);
  assert.equal(absentOverride.finalScore, 0);
  assert.equal(absentOverride.overtimeHours, 0);
});

test('ftfScoring: horas extra después de las 18:30 solo cuentan como bono si cumplió jornada normal', () => {
  const qualifiedOvertime = computeHybridFtfScore(
    {
      name: 'Brian',
      assignedHours: 8,
      completedHours: 7.5,
      verified: 7,
      total: 8,
      ftfPendingAssignmentMinutes: 0,
      status: 'complete',
      isOnline: true,
      afterCutoffHours: 1.5,
    },
    '2026-11-12'
  );
  assert.equal(qualifiedOvertime.overtimeHours, 1.5);

  const unqualifiedOvertime = computeHybridFtfScore(
    {
      name: 'Brian',
      assignedHours: 8,
      completedHours: 2.0,
      verified: 1,
      total: 8,
      ftfPendingAssignmentMinutes: 300,
      status: 'pending',
      isOnline: true,
      afterCutoffHours: 1.5,
    },
    '2026-11-12'
  );
  assert.equal(unqualifiedOvertime.overtimeHours, 0);
});

test('ftfScoring: matriz semanal Lun-Vie calcula promedio, faltas, horas extra bono y estatus de nómina', () => {
  const weekDates = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
  const scoresByDate = {
    '2026-11-09': {
      Neftali: computeHybridFtfScore(
        { name: 'Neftali', assignedHours: 8, completedHours: 8, verified: 8, total: 8, ftfPendingAssignmentMinutes: 0, status: 'complete', isOnline: true, afterCutoffHours: 1.0 },
        '2026-11-09'
      ),
      Genaro: computeHybridFtfScore(
        { name: 'Genaro', assignedHours: 0, completedHours: 0, verified: 0, total: 0, status: 'empty', isOnline: false },
        '2026-11-09'
      ),
    },
    '2026-11-10': {
      Neftali: computeHybridFtfScore(
        { name: 'Neftali', assignedHours: 8, completedHours: 7, verified: 7, total: 8, ftfPendingAssignmentMinutes: 0, status: 'complete', isOnline: true, afterCutoffHours: 0.5 },
        '2026-11-10'
      ),
      Genaro: computeHybridFtfScore(
        { name: 'Genaro', assignedHours: 0, completedHours: 0, verified: 0, total: 0, status: 'empty', isOnline: false },
        '2026-11-10'
      ),
    },
  };

  const matrix = buildWeeklyPayrollMatrix(weekDates, ['Neftali', 'Genaro'], scoresByDate);
  const neft = matrix.find(r => r.person === 'Neftali');
  const gena = matrix.find(r => r.person === 'Genaro');

  assert.ok(neft.weeklyAverage >= 85);
  assert.equal(neft.absences, 0);
  assert.equal(neft.overtimeTotalHours, 1.5);
  assert.equal(neft.payrollStatus, 'Bono / Excelente');

  assert.equal(gena.absences, 2);
  assert.equal(gena.weeklyAverage, 0);
  assert.equal(gena.payrollStatus, 'Revisar / Atención');
});

test('ftfScoring: bloques programados sin conexión real NI avances dan 0 puntos (no 29 ghost pts)', () => {
  const ghostUser = computeHybridFtfScore(
    {
      name: 'Edwin',
      assignedHours: 6.0,
      completedHours: 0,
      verified: 0,
      total: 3,
      ftfPendingAssignmentMinutes: 120,
      status: 'pending',
      isOnline: false,
      firstSignalAt: null,
      lastSignalAt: null,
    },
    '2026-11-12'
  );
  assert.equal(ghostUser.absent, true);
  assert.equal(ghostUser.finalScore, 0);
  assert.equal(ghostUser.breakdown.attendance, 0);
  assert.equal(ghostUser.breakdown.coverage, 0);
  assert.equal(ghostUser.overtimeHours, 0);
});

test('ftfScoring: estrellas fraccionales (½★ = 0.5) ponderan puntos proporcionales y matriz semanal conserva 0.5', () => {
  const partialStars = computeHybridFtfScore(
    {
      name: 'Neftali',
      assignedHours: 7,
      completedHours: 3,
      reviewHours: 3,
      verified: 2,
      total: 2,
      ftfPendingAssignmentMinutes: 60,
      status: 'pending',
      isOnline: true,
      firstSignalAt: '2026-11-12T09:34:00-06:00',
    },
    '2026-11-12',
    {
      starsOverride: {
        star1: 0.5,
        star2: 0.5,
        star3: 0.5,
      },
    }
  );
  assert.equal(partialStars.absent, false);
  assert.equal(partialStars.stars.star1, 0.5);
  assert.equal(partialStars.stars.star2, 0.5);
  assert.equal(partialStars.stars.star3, 0.5);
  assert.equal(partialStars.breakdown.attendance, 20);
  assert.equal(partialStars.breakdown.coverage, 10);
  assert.equal(partialStars.breakdown.progress, 18);
  assert.equal(partialStars.breakdown.ftfFinal, 13);
  assert.equal(partialStars.finalScore, 61);

  const matrix = buildWeeklyPayrollMatrix(['2026-11-12'], ['Neftali'], {
    '2026-11-12': { Neftali: partialStars },
  });
  assert.equal(matrix[0].days[0].stars[0], 0.5);
  assert.equal(matrix[0].days[0].stars[1], 0.5);
  assert.equal(matrix[0].days[0].stars[2], 0.5);
});

test('ftfDashboard: excluye suspendidas (inclusive post-18:30), separa Por hacer de Terminada, atribuye revisión al creador y exige conexión real', () => {
  const day = '2026-11-12';
  const now = new Date('2026-11-12T16:15:00-06:00');
  const dash = buildFtfDashboard(
    'Neftali',
    day,
    [{ name: 'Neftali' }, { name: 'John' }, { name: 'Genaro' }],
    [
      // Actividad en revisión 10:00–13:00 (3h) cuyo assignee visible fuera John pero OriginalPerson = Neftali
      {
        pageId: 'rev-1',
        title: 'rtuzR | Asistente corregir funciones diseño ANFETA ✅ ne11 jjo000',
        person: 'John',
        status: 'RTUZ - REVISAR REVISIONES rrevi',
        start: '2026-11-12T10:00:00-06:00',
        end: '2026-11-12T13:00:00-06:00',
        ftfAvailable: true,
        ftfVerified: true,
        reviewFlow: { OriginalPerson: 'Neftali', ReviewAssignee: 'John', State: 'pending', LeaveVisualCopy: false },
      },
      // Actividad en curso 14:00–18:00 (4h) aún "Por hacer" aunque tenga check FTF activo
      {
        pageId: 'pend-1',
        title: 'prtuzR | Asistente recurrente ✅ nne11',
        person: 'Neftali',
        status: 'PxHACER (PxH)',
        start: '2026-11-12T14:00:00-06:00',
        end: '2026-11-12T18:00:00-06:00',
        ftfAvailable: true,
        ftfVerified: true,
      },
      // Dos actividades SUSPENDIDAS después de las 18:30 (19:00–21:00 = 2h): NO deben contar como horas ni bono extra
      {
        pageId: 'susp-1',
        title: 'aaprtuzR Suspendida 1',
        person: 'Neftali',
        status: 'AA - SUSPE X PAGO INFO',
        start: '2026-11-12T19:00:00-06:00',
        end: '2026-11-12T20:00:00-06:00',
        isSuspended: true,
        ftfAvailable: true,
        ftfVerified: false,
      },
      {
        pageId: 'susp-2',
        title: 'aaprtuzR Suspendida 2',
        person: 'Neftali',
        status: 'AA - SUSPE X PAGO INFO',
        start: '2026-11-12T20:00:00-06:00',
        end: '2026-11-12T21:00:00-06:00',
        isSuspended: true,
        ftfAvailable: true,
        ftfVerified: false,
      },
      // Bloque vencido (09:00–10:00) de Genaro que nunca se conectó
      {
        pageId: 'gen-1',
        title: 'prtuzR | Revision Notion gge11',
        person: 'Genaro',
        status: 'PxHACER (PxH)',
        start: '2026-11-12T09:00:00-06:00',
        end: '2026-11-12T10:00:00-06:00',
        ftfAvailable: true,
        ftfVerified: false,
      },
    ],
    {},
    now,
    [{ day, person: 'Neftali', firstSeen: '2026-11-12T09:34:00-06:00', lastSeen: '2026-11-12T16:10:00-06:00' }]
  );

  const neft = dash.people.find(p => p.name === 'Neftali');
  const gena = dash.people.find(p => p.name === 'Genaro');

  assert.equal(neft.assignedHours, 7);
  assert.equal(neft.reviewHours, 3);
  assert.equal(neft.workCompletedHours, 0);
  assert.equal(neft.inProgressHours, 4);
  assert.equal(neft.completedHours, 3);
  assert.equal(neft.afterCutoffHours, 0);
  assert.equal(neft.status, 'pending');
  assert.equal(neft.completedActivities.length, 0);
  assert.equal(neft.reviewActivities.length, 1);
  assert.equal(neft.pendingAssignmentMinutes, 0);
  assert.equal(neft.mealBreak?.enabled, true);
  assert.equal(neft.mealBreak?.startHour, 13);
  assert.equal(neft.mealBreak?.endHour, 14);

  assert.equal(gena.firstSignal, null);
  assert.equal(gena.expiredUnfinishedCount, 1);
});
