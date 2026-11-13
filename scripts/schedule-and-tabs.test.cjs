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

const {
  parseTaskTime,
  shiftTaskSchedule,
  moveTaskToMinutes,
  computeCatchUpSchedule,
  simplifyReviewSearchQuery,
  stripLeadingScheduleTime,
} = require(root + '/src/lib/scheduleHelpers.ts');
const { parseSearchTabs } = require(root + '/src/lib/searchTabsStorage.ts');
const { matchesFlexibleOrQuotedQuery, parseAdvancedQuery } = require(root + '/src/services/advancedQuery.ts');

test('scheduleHelpers: desfasar después de las 11:30 PM no brinca a las 00:00 AM de la mañana', () => {
  const lateTask = {
    id: 't1',
    title: '11:30 PM · Revisar servidor nocturno',
    scheduledDate: '2026-11-12',
    query: 'servidor',
    isCompleted: false,
  };
  const shifted1 = shiftTaskSchedule(lateTask, 30);
  assert.equal(shifted1.timeMinutes, 1440);
  assert.equal(shifted1.isPostMidnight, true);
  assert.equal(shifted1.startTime, '00:00');
  assert.equal(shifted1.title, 'Revisar servidor nocturno');

  const shifted2 = shiftTaskSchedule({ ...lateTask, title: shifted1.title, startTime: shifted1.startTime, isPostMidnight: true }, 30);
  assert.equal(shifted2.timeMinutes, 1470);
  assert.equal(shifted2.isPostMidnight, true);
  assert.equal(shifted2.startTime, '00:30');
  assert.equal(shifted2.title, 'Revisar servidor nocturno');

  const parsedLate = parseTaskTime({ ...lateTask, title: shifted2.title, startTime: shifted2.startTime, isPostMidnight: true });
  assert.equal(parsedLate.timeMinutes, 1470);
  assert.match(parsedLate.timeBadge, /\(\+1d\)/);
});

test('scheduleHelpers: recoger atrasados solo mueve tareas vencidas no atendidas desde la hora actual sin poner hora en el título', () => {
  const nowMin = 13 * 60 + 10; // 1:10 PM
  const tasks = [
    { id: 'done', title: '10:00 AM · Hecha', scheduledDate: '2026-11-12', query: 'a', isCompleted: true },
    { id: 'att', title: '11:00 AM · Atendida', scheduledDate: '2026-11-12', query: 'b', isCompleted: false, isAttended: true },
    { id: 'old1', title: '9:00 AM · Reporte 1', scheduledDate: '2026-11-12', query: 'c', isCompleted: false },
    { id: 'old2', title: '12:00 PM · Reporte 2', scheduledDate: '2026-11-12', query: 'd', isCompleted: false },
    { id: 'future', title: '4:00 PM · Tarde', scheduledDate: '2026-11-12', query: 'e', isCompleted: false },
  ];

  const updates = computeCatchUpSchedule(tasks, nowMin, 30);
  assert.equal(updates.length, 2);
  assert.equal(updates[0].task.id, 'old1');
  assert.equal(updates[0].newStartMinutes, 13 * 60 + 30); // 1:30 PM
  assert.equal(updates[0].startTime, '13:30');
  assert.equal(updates[0].newTitle, 'Reporte 1');
  assert.equal(updates[1].task.id, 'old2');
  assert.equal(updates[1].newStartMinutes, 14 * 60); // 2:00 PM
  assert.equal(updates[1].startTime, '14:00');
  assert.equal(updates[1].newTitle, 'Reporte 2');

  const rangedTask = {
    id: 'rng',
    title: '9:00 AM - 10:00 AM · Reporte con rango',
    scheduledDate: '2026-11-12',
    startTime: '09:00',
    endTime: '10:00',
    query: 'rango',
    isCompleted: false,
  };
  const rangedUpdates = computeCatchUpSchedule([rangedTask], 17 * 60 + 5, 30);
  assert.equal(rangedUpdates.length, 1);
  assert.equal(rangedUpdates[0].newTitle, 'Reporte con rango');
  assert.equal(rangedUpdates[0].startTime, '17:30');
  assert.equal(rangedUpdates[0].endTime, '18:30');

  // Limpia textos corruptos pegados como "6:00 PMPMPMPMprueba..." sin reinsertar AM/PM en title
  const corrupt = {
    id: 'stuck',
    title: '6:00 PMPMPMPMprueba guardado bien machin',
    scheduledDate: '2026-11-12',
    query: 'prueba',
    isCompleted: false,
  };
  assert.equal(stripLeadingScheduleTime(corrupt.title), 'prueba guardado bien machin');
  const cleaned = shiftTaskSchedule(corrupt, -60);
  assert.equal(cleaned.title, 'prueba guardado bien machin');
  assert.equal(cleaned.startTime, '17:00');
  const shiftedBack = shiftTaskSchedule({ ...corrupt, title: cleaned.title, startTime: cleaned.startTime }, 60);
  assert.equal(shiftedBack.title, 'prueba guardado bien machin');
  assert.equal(shiftedBack.startTime, '18:00');

  // Modo 'last': mueve solo el último atrasado y evita chocar en el mismo bloque al repetir
  const stack = [
    { id: 't1', title: '9:00 AM · Primero', scheduledDate: '2026-11-12', query: '1', isCompleted: false },
    { id: 't2', title: '11:00 AM · Último', scheduledDate: '2026-11-12', query: '2', isCompleted: false },
  ];
  const step1 = computeCatchUpSchedule(stack, 17 * 60 + 16, 60, { mode: 'last' });
  assert.equal(step1.length, 1);
  assert.equal(step1[0].task.id, 't2');
  assert.equal(step1[0].newStartMinutes, 18 * 60); // 6:00 PM
  assert.equal(step1[0].startTime, '18:00');
  assert.equal(step1[0].newTitle, 'Último');

  const afterStep1 = [stack[0], { ...stack[1], title: step1[0].newTitle, startTime: step1[0].startTime, endTime: step1[0].endTime }];
  const step2 = computeCatchUpSchedule(afterStep1, 17 * 60 + 16, 60, { mode: 'last' });
  assert.equal(step2.length, 1);
  assert.equal(step2[0].task.id, 't1');
  assert.equal(step2[0].newStartMinutes, 19 * 60); // 7:00 PM (siguiente hueco consecutivo)
  assert.equal(step2[0].startTime, '19:00');
});

test('scheduleHelpers: simplifyReviewSearchQuery limpia etiquetas internas dejando dominio/título limpio', () => {
  const q = simplifyReviewSearchQuery('[COPIA REVISIÓN] rtuzREVISION sseo 26-08AGO anfeta.com Optimización SEO nneft kkarl');
  assert.doesNotMatch(q, /\bnneft\b/i);
  assert.doesNotMatch(q, /\bkkarl\b/i);
  assert.doesNotMatch(q, /COPIA REVISI/i);
  assert.match(q, /anfeta\.com/i);
  assert.match(q, /Optimizaci/i);
});

test('searchTabsStorage: conserva nota visible independiente del término de búsqueda', () => {
  const raw = JSON.stringify({
    activeTabId: 'tab-1',
    tabs: [
      { id: 'tab-1', query: '!Encontrarlos anfeta.com', canClose: true, pending: true, note: 'Revisar con cliente el viernes' },
    ],
  });
  const parsed = parseSearchTabs(raw);
  assert.ok(parsed);
  assert.equal(parsed.tabs.length, 1);
  assert.equal(parsed.tabs[0].query, '!Encontrarlos anfeta.com');
  assert.equal(parsed.tabs[0].note, 'Revisar con cliente el viernes');
});

test('advancedQuery: preserva el operador "!" exclusivamente como negación/exclusión', () => {
  const { expr } = parseAdvancedQuery('anfeta.com !Encontrarlos');
  assert.ok(expr);
  assert.equal(
    matchesFlexibleOrQuotedQuery({ name: 'anfeta.com Sitio Web', path: '', extension: '', searchText: 'anfeta.com Sitio Web' }, 'anfeta.com !Encontrarlos'),
    true
  );
  assert.equal(
    matchesFlexibleOrQuotedQuery({ name: 'anfeta.com Encontrarlos Aquí', path: '', extension: '', searchText: 'anfeta.com Encontrarlos Aquí' }, 'anfeta.com !Encontrarlos'),
    false
  );
});

test('scheduleHelpers: hora explícita inicial no es sobreescrita por rango entre paréntesis ni dura 1h en modo 30m', () => {
  const withParens = parseTaskTime({
    id: 'p1',
    title: '5:00 AM FTF JOHN (5-15?)',
    scheduledDate: '2026-11-12',
    query: 'ftf',
    isCompleted: false,
  });
  assert.equal(withParens.hasTime, true);
  assert.equal(withParens.timeMinutes, 5 * 60);

  // Con cuadrícula de 30m, "5:00 PM" termina a las 5:30 PM -> a las 5:37 PM ya venció y debe recogerse
  const stuck5pm = {
    id: 's5',
    title: '5:00 PM Prueba',
    scheduledDate: '2026-11-12',
    query: 'prueba',
    isCompleted: false,
  };
  const parsed30 = parseTaskTime(stuck5pm, 30);
  assert.equal(parsed30.timeMinutes, 17 * 60);
  assert.equal(parsed30.endMinutes, 17 * 60 + 30);

  const catchUp = computeCatchUpSchedule([stuck5pm], 17 * 60 + 37, 30);
  assert.equal(catchUp.length, 1);
  assert.equal(catchUp[0].task.id, 's5');
  assert.equal(catchUp[0].newStartMinutes, 18 * 60); // 6:00 PM
  assert.equal(catchUp[0].startTime, '18:00');
  assert.equal(catchUp[0].newTitle, 'Prueba');
});

test('scheduleHelpers: moveTaskToMinutes mueve tarjeta al bloque destino guardando hora en startTime sin repetir AM/PM en título', () => {
  const single = {
    id: 'm1',
    title: '5:30 PM · Revisar bitácora',
    scheduledDate: '2026-11-12',
    query: 'bitacora',
    isCompleted: false,
  };
  const movedSingle = moveTaskToMinutes(single, 19 * 60 + 30, 30); // 7:30 PM
  assert.equal(movedSingle.timeMinutes, 19 * 60 + 30);
  assert.equal(movedSingle.endMinutes, 20 * 60);
  assert.equal(movedSingle.startTime, '19:30');
  assert.equal(movedSingle.endTime, undefined);
  assert.equal(movedSingle.title, 'Revisar bitácora');

  const withExplicitFields = {
    id: 'm1b',
    title: '5:30 PM - 6:00 PM · En curso',
    scheduledDate: '2026-11-12',
    startTime: '17:30',
    endTime: '18:00',
    query: 'curso',
    isCompleted: false,
  };
  const movedExplicit = moveTaskToMinutes(withExplicitFields, 19 * 60 + 30, 30);
  assert.equal(movedExplicit.startTime, '19:30');
  assert.equal(movedExplicit.endTime, '20:00');
  assert.equal(movedExplicit.title, 'En curso');

  const untimed = {
    id: 'm2',
    title: 'Revisar pendientes sueltos',
    scheduledDate: '2026-11-12',
    query: 'sueltos',
    isCompleted: false,
  };
  const movedUntimed = moveTaskToMinutes(untimed, 18 * 60, 30);
  assert.equal(movedUntimed.timeMinutes, 18 * 60);
  assert.equal(movedUntimed.endMinutes, 18 * 60 + 30);
  assert.equal(movedUntimed.startTime, '18:00');
  assert.equal(movedUntimed.title, 'Revisar pendientes sueltos');
});
