const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
Module._extensions['.ts'] = (m, p) => m._compile(
  ts.transpileModule(fs.readFileSync(p, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText,
  p
);

const { buildFtfDashboard } = require(root + '/src/services/ftfDashboard.ts');
const { completedFtfPeople } = require(root + '/src/services/ftfCompletion.ts');
const { calendarTime } = require(root + '/src/services/calendarPresentation.ts');

const day = '2026-11-05';
const people = [{ name: 'Neftali', role: 'Desarrollo' }, { name: 'John', role: 'Dirección' }];
const now = new Date(day + 'T19:00:00-06:00');

// Case 1: Record updated is midnight (00:00 in Mexico City: 2026-11-05T00:00:00-06:00 or 2026-11-05T06:00:00Z)
// but activity serverModified is 15:27 (2026-11-05T21:27:00Z)
const act1 = {
  pageId: 'p1',
  person: 'Neftali',
  title: 'prtuzR Correcciones ANFETA',
  start: day + 'T10:00:00-06:00',
  ftfAvailable: true,
  ftfVerified: true,
  serverModified: '2026-11-05T21:27:00.000Z', // 15:27 in Mexico City
};

const midnightReceipt = {
  person: 'Neftali',
  date: day,
  updated: day + 'T00:00:00-06:00', // evaluates to 00:00
};

const report = buildFtfDashboard('John', day, people, [act1], { ['ftf:' + day + ':Neftali']: midnightReceipt }, now);
const neftali = report.people.find(p => p.name === 'Neftali');

assert.equal(neftali.status, 'complete');
assert.equal(neftali.total, 1);
assert.equal(neftali.verified, 1);
assert.equal(neftali.pending.length, 0);

// A legacy midnight placeholder must not turn an unrelated Notion edit into confirmation.
assert.equal(neftali.completedAt, null);
assert.equal(neftali.lastActivityEdited, act1.serverModified);
assert.equal(neftali.late, false);

// Case 2: Activity edited AFTER 18:00 (e.g. 18:15)
const actLate = {
  ...act1,
  serverModified: '2026-11-06T00:15:00.000Z', // 18:15 in Mexico City
};
const reportLate = buildFtfDashboard('John', day, people, [actLate], { ['ftf:' + day + ':Neftali']: midnightReceipt }, now);
const neftaliLate = reportLate.people.find(p => p.name === 'Neftali');
assert.equal(neftaliLate.status, 'complete');
assert.equal(neftaliLate.completedAt, null);
assert.equal(neftaliLate.late, false);

// Case 3: Later Notion edits do not replace a stored FTF time
const afternoonReceipt = {
  person: 'Neftali',
  date: day,
  updated: day + 'T14:00:00-06:00',
};
const reportBoth = buildFtfDashboard('John', day, people, [act1], { ['ftf:' + day + ':Neftali']: afternoonReceipt }, now);
const neftaliBoth = reportBoth.people.find(p => p.name === 'Neftali');
assert.equal(calendarTime(neftaliBoth.completedAt), '14:00');

// Case 4: [RESPUESTA] notification cards must NEVER be counted as work activities in FTF
const respAct = {
  pageId: 'resp1',
  person: 'Neftali',
  title: '11-05 15:36 de: [RESPUESTA] Revisión aprobada - SEO Optimización Técnica Posicionamiento SEO',
  start: day + 'T09:00:00-06:00',
  ftfAvailable: false,
  ftfVerified: false,
};
const reportWithResp = buildFtfDashboard('John', day, people, [act1, respAct], { ['ftf:' + day + ':Neftali']: midnightReceipt }, now);
const neftaliWithResp = reportWithResp.people.find(p => p.name === 'Neftali');
assert.equal(neftaliWithResp.total, 1, 'Activities with [RESPUESTA] must not be counted in total');
assert.equal(neftaliWithResp.pending.length, 0, '[RESPUESTA] must not be added to pending list');
assert.equal(neftaliWithResp.status, 'complete', 'Status remains complete when only real activities are checked');

const completedList = completedFtfPeople([act1, respAct], now);
assert.deepEqual(completedList, ['Neftali'], 'completedFtfPeople must ignore [RESPUESTA]');

console.log('OK: Resolución de timestamps FTF y exclusión de [RESPUESTA] validadas exitosamente.');
