const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const ts = require('typescript');
const Module = require('module');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(__dirname, '../src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (m, file) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      file
    );
}

const {
  FIXED_FTF_BLOCK_ID,
  buildFixedFtfBlock,
  buildAttendedStatePatch,
  normalizeRecurringPendingTasks,
  resolveFtfBlockCompletionForDay,
  mergeDeletedPendingIds,
} = require('../src/lib/pendingRecurrence.ts');
const { calendarLayoutPreference } = require('../src/lib/calendarLayoutPreferences.ts');
const { buildFtfDashboard } = require('../src/services/ftfDashboard.ts');

// 1. Fixed FTF block seed + attending at 09:52
const today = '2026-11-13';
const tomorrow = '2026-11-14';
const block = buildFixedFtfBlock(today);
assert.equal(block.id, FIXED_FTF_BLOCK_ID);
assert.equal(block.startTime, '08:00');
assert.equal(block.endTime, '08:30');
assert.equal(block.isRecurringDaily, true);
assert.equal(block.isFtfBlock, true);

const checkAt0952 = new Date('2026-11-13T09:52:00-06:00');
const patch = buildAttendedStatePatch(block, true, checkAt0952);
const attendedToday = { ...block, ...patch };
assert.equal(attendedToday.isAttended, true);
assert.equal(attendedToday.lastCompletedDate, today);
assert.equal(attendedToday.recurrenceCompletions.length, 1);

// 2. Same day reload stays attended
const sameDay = normalizeRecurringPendingTasks([attendedToday], today);
assert.equal(sameDay.changed, false);
assert.equal(sameDay.items[0].isAttended, true);
assert.equal(
  resolveFtfBlockCompletionForDay(sameDay.items, today),
  checkAt0952.toISOString()
);

// 3. Next day rollover auto-resets check to pending while preserving historical completion timestamp
const nextDay = normalizeRecurringPendingTasks([attendedToday], tomorrow);
assert.equal(nextDay.changed, true);
assert.equal(nextDay.items[0].isAttended, false);
assert.equal(nextDay.items[0].isCompleted, false);
assert.equal(nextDay.items[0].scheduledDate, tomorrow);
assert.equal(
  resolveFtfBlockCompletionForDay(nextDay.items, today),
  checkAt0952.toISOString()
);

// 4. Bitácora dashboard reports exact FTF block time even if workday tasks remain pending
const report = buildFtfDashboard(
  'John',
  today,
  [{ name: 'Acalli' }],
  [
    {
      pageId: 'act-1',
      pageUrl: 'https://notion.so/act-1',
      title: 'Limpieza ac11',
      shortTitle: 'Limpieza',
      person: 'Acalli',
      originalPerson: 'Acalli',
      project: 'limpiezamonterrey.com',
      domain: 'limpiezamonterrey.com',
      status: 'POR HACER',
      start: '2026-11-13T10:00:00-06:00',
      end: '2026-11-13T12:00:00-06:00',
      originalScheduledDate: today,
      currentScheduledDate: today,
      moveCount: 0,
      routeDates: [],
      checklistScanned: false,
      checklistTotal: 0,
      checklistCompleted: 0,
      todayChecklistCompleted: 0,
      isUrgent: false,
      isCompletedForReview: false,
      isFinalized: false,
      isSuspended: false,
      isLocked: false,
      estimatedWorkMinutes: 120,
    },
  ],
  {},
  new Date('2026-11-13T10:05:00-06:00'),
  [],
  {},
  { Acalli: checkAt0952.toISOString() }
);
assert.equal(report.people[0].status, 'pending');
assert.equal(report.people[0].ftfBlockCompletedAt, checkAt0952.toISOString());

// 5. Deleted pending IDs tombstone deduplication & active-id exclusion
const mergedDeleted = mergeDeletedPendingIds(
  ['deleted-1', 'recreated-2'],
  ['deleted-3', 'deleted-1'],
  ['recreated-2', 'active-9']
);
assert.deepEqual(mergedDeleted, ['deleted-1', 'deleted-3']);

// 6. Calendar layout preferences preserve cobros, pagos, secondary & updatedAt
const layout = calendarLayoutPreference(
  { cobros: true, pagos: true, secondary: true, updatedAt: 1794586000000 },
  ['Neftali', 'John']
);
assert.equal(layout.cobros, true);
assert.equal(layout.pagos, true);
assert.equal(layout.secondary, true);
assert.equal(layout.updatedAt, 1794586000000);

console.log('OK pending recurrence, daily FTF block tracking, delete tombstones, and layout persistence.');
