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
  computeCatchUpSchedule,
  simplifyReviewSearchQuery,
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
  assert.match(shifted1.title, /^12:00 AM/);

  const shifted2 = shiftTaskSchedule({ ...lateTask, title: shifted1.title, isPostMidnight: true }, 30);
  assert.equal(shifted2.timeMinutes, 1470);
  assert.equal(shifted2.isPostMidnight, true);
  assert.match(shifted2.title, /^12:30 AM/);

  const parsedLate = parseTaskTime({ ...lateTask, title: shifted2.title, isPostMidnight: true });
  assert.equal(parsedLate.timeMinutes, 1470);
  assert.match(parsedLate.timeBadge, /\(\+1d\)/);
});

test('scheduleHelpers: recoger atrasados solo mueve tareas vencidas no atendidas desde la hora actual', () => {
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
  assert.match(updates[0].newTitle, /^1:30 PM/);
  assert.equal(updates[1].task.id, 'old2');
  assert.equal(updates[1].newStartMinutes, 14 * 60); // 2:00 PM
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
