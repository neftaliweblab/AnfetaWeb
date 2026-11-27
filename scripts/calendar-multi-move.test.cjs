const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return resolve.call(
    this,
    name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name,
    parent,
    ...rest
  );
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (m, p) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(p, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
      p
    );
}

const {
  isMovableCalendarActivity,
  buildMultiDeltaScheduleChanges,
  buildPushDownScheduleChanges,
} = require('../src/lib/calendarMultiMove.ts');

const DAY = '2026-11-27';
const base = (overrides) => ({
  pageId: 'p1',
  originalPageId: 'p1',
  title: 'prtuz | WEBS | dom.com | Act',
  shortTitle: 'Act',
  person: 'Neftali',
  originalPerson: 'Neftali',
  project: '',
  domain: 'dom.com',
  status: 'PRTUZ (POR HACER)',
  start: `${DAY}T10:00:00-06:00`,
  end: `${DAY}T11:00:00-06:00`,
  originalScheduledDate: `${DAY}T10:00:00-06:00`,
  currentScheduledDate: `${DAY}T10:00:00-06:00`,
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
  pageUrl: '',
  ...overrides,
});

const a1 = base({ pageId: 'a1', title: 'Pendiente 1', start: `${DAY}T09:00:00-06:00`, end: `${DAY}T10:00:00-06:00` });
const a2 = base({ pageId: 'a2', title: 'Pendiente 2', start: `${DAY}T10:30:00-06:00`, end: `${DAY}T12:00:00-06:00` });
const rev = base({ pageId: 'rev', title: 'rtuzR Revision', status: 'RTUZ - REVISAR REVISIONES rrevi', start: `${DAY}T14:00:00-06:00`, end: `${DAY}T15:00:00-06:00`, isCompletedForReview: true });
const done = base({ pageId: 'done', title: 'zREVISION Final', status: 'Z - FIN-alizado COBRADO TERMINADO REVI', start: `${DAY}T15:00:00-06:00`, end: `${DAY}T16:00:00-06:00`, isFinalized: true });
const locked = base({ pageId: 'lock', title: 'Bloqueada_ANFETA', isLocked: true, start: `${DAY}T16:00:00-06:00`, end: `${DAY}T17:00:00-06:00` });

assert.equal(isMovableCalendarActivity(a1, 'Neftali'), true);
assert.equal(isMovableCalendarActivity(rev, 'Neftali'), true);
assert.equal(isMovableCalendarActivity(done, 'Neftali'), false);
assert.equal(isMovableCalendarActivity(locked, 'Neftali'), false);

// 1. Move multiple selected activities together by +90 min and reassign to Karla
const shifted = buildMultiDeltaScheduleChanges([a1, a2, done, locked], DAY, 90, 'Neftali', 'Karla');
assert.equal(shifted.length, 2);
assert.equal(shifted[0].pageId, 'a1');
assert.equal(shifted[0].start, `${DAY}T10:30:00-06:00`);
assert.equal(shifted[0].end, `${DAY}T11:30:00-06:00`);
assert.equal(shifted[0].person, 'Karla');
assert.equal(shifted[1].pageId, 'a2');
assert.equal(shifted[1].start, `${DAY}T12:00:00-06:00`);
assert.equal(shifted[1].end, `${DAY}T13:30:00-06:00`);
assert.equal(shifted[1].allowOverlap, true);

// 2. Clamp inside 08:00..22:00 when pushing far down or up
const clampedDown = buildMultiDeltaScheduleChanges([a2], DAY, 900, 'Neftali');
assert.equal(clampedDown[0].start, `${DAY}T20:30:00-06:00`);
assert.equal(clampedDown[0].end, `${DAY}T22:00:00-06:00`);

// 3. Push down with 1h normalization (21:00-22:00) & onlyPending=true
const pushPending = buildPushDownScheduleChanges([a1, a2, rev, done, locked], DAY, 'Neftali', {
  normalizeOneHour: true,
  onlyPending: true,
});
assert.deepEqual(
  pushPending.map((c) => [c.pageId, c.start, c.end]),
  [
    ['a1', `${DAY}T21:00:00-06:00`, `${DAY}T22:00:00-06:00`],
    ['a2', `${DAY}T21:00:00-06:00`, `${DAY}T22:00:00-06:00`],
  ]
);

// 4. Push down preserving original duration and including reviews
const pushAllPreserve = buildPushDownScheduleChanges([a1, a2, rev], DAY, 'Neftali', {
  normalizeOneHour: false,
  onlyPending: false,
});
assert.deepEqual(
  pushAllPreserve.map((c) => [c.pageId, c.start, c.end]),
  [
    ['a1', `${DAY}T21:00:00-06:00`, `${DAY}T22:00:00-06:00`],
    ['a2', `${DAY}T20:30:00-06:00`, `${DAY}T22:00:00-06:00`],
    ['rev', `${DAY}T21:00:00-06:00`, `${DAY}T22:00:00-06:00`],
  ]
);

console.log('OK calendarMultiMove: desplazamiento en grupo, reasignación por lote, límites 08:00-22:00 y botón Pasar abajo.');
