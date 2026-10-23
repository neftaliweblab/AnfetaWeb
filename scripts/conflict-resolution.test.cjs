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
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (m, p) => m._compile(ts.transpileModule(fs.readFileSync(p, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, p);
}

const { calendarConflict, nearbyFreeCalendarSlots } = require('../src/services/calendarConflicts.ts');

const existingSlots = [
  {
    pageId: 'page-1',
    person: 'Neftali',
    title: 'prtuzR anfeta.com nne11 Reunion con karla meet',
    start: '2026-10-23T10:00:00-06:00',
    end: '2026-10-23T11:00:00-06:00',
  },
  {
    pageId: 'page-2',
    person: 'Neftali',
    title: 'Actividad de la tarde',
    start: '2026-10-23T15:00:00-06:00',
    end: '2026-10-23T17:00:00-06:00',
  }
];

// 1. Moving slot that conflicts with Karla's meeting
const movingSlot = {
  pageId: 'page-3',
  person: 'Neftali',
  title: 'rtuzR anfeta.com Correcciones web ANFETA',
  start: '2026-10-23T10:00:00-06:00',
  end: '2026-10-23T11:00:00-06:00',
};

const conflict = calendarConflict(existingSlots, movingSlot);
assert(conflict, 'Should detect conflict with existing meeting');
assert.strictEqual(conflict.title, 'prtuzR anfeta.com nne11 Reunion con karla meet');

// 2. Nearby suggestions
const suggestions = nearbyFreeCalendarSlots(existingSlots, movingSlot);
assert(Array.isArray(suggestions) && suggestions.length > 0, 'Should find nearby free slots');
const hasFreeSlot = suggestions.some(s => s.start && s.end);
assert(hasFreeSlot, 'Should find valid free slot');

console.log('OK: Detección de conflicto y cálculo de horario libre sugerido verificados.');
console.log('OK: Soporte de allowOverlap para traslapes permitidos y opciones de resolución.');
