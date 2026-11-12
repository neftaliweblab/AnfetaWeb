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
