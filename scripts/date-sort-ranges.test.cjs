const fs = require('fs'), path = require('path'), Module = require('module'), assert = require('assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '..'), resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (m, p) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(p, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      }).outputText,
      p
    );
}

const { compareSearchRows, parseSearchDate, searchRowDate } = require('../src/lib/searchPresentation.ts');

// 1. Probar parseSearchDate con formatos individuales, intervalos, y nulos
assert.equal(parseSearchDate('2026-11-08T09:00:00-06:00'), Date.parse('2026-11-08T09:00:00-06:00'));
assert.equal(parseSearchDate('2026-10-29T11:00:00-06:00 - 2026-10-29T12:00:00-06:00'), Date.parse('2026-10-29T11:00:00-06:00'));
assert.equal(parseSearchDate('2026-11-02T19:30:00-06:00 - 2026-11-02T20:30:00-06:00'), Date.parse('2026-11-02T19:30:00-06:00'));
assert.equal(parseSearchDate('2026-10-28'), Date.parse('2026-10-28'));
assert.equal(parseSearchDate('—'), null);
assert.equal(parseSearchDate('-'), null);
assert.equal(parseSearchDate(''), null);
assert.equal(parseSearchDate(null), null);

// 2. Probar orden con el escenario exacto del usuario (con intervalos y horas fijas)
const testRows = [
  { id: 'nov08', name: 'Reporte Nov 8', scheduledDate: '2026-11-08T09:00:00-06:00' },
  { id: 'manana_1230', name: 'Opt Tec Mañana 12:30', scheduledDate: '2026-10-29T12:30:00-06:00' },
  { id: 'manana_0930', name: 'SEO Mañana 9:30', scheduledDate: '2026-10-29T09:30:00-06:00' },
  { id: 'manana_intervalo', name: 'Intervalo Mañana 11:00 a 12:00', scheduledDate: '2026-10-29T11:00:00-06:00 - 2026-10-29T12:00:00-06:00' },
  { id: 'hoy_1830', name: 'FTF Hoy 18:30', scheduledDate: '2026-10-28T18:30:00-06:00' },
  { id: 'hoy_1730', name: 'Pag Hoy 17:30', scheduledDate: '2026-10-28T17:30:00-06:00' },
  { id: 'ayer_0900', name: 'Ayer 9:00', scheduledDate: '2026-10-27T09:00:00-06:00' },
  { id: 'nov02_intervalo', name: 'Intervalo 02/11 19:30 a 20:30', scheduledDate: '2026-11-02T19:30:00-06:00 - 2026-11-02T20:30:00-06:00' },
  { id: 'sin_fecha', name: 'Sin fecha', scheduledDate: '' },
];

// scheduled-desc (Fecha por hacer · reciente primero / futuro primero)
const descOrder = [...testRows].sort((a, b) => compareSearchRows(a, b, 'scheduled-desc')).map(r => r.id);
assert.deepEqual(descOrder, [
  'nov08',
  'nov02_intervalo',
  'manana_1230',
  'manana_intervalo',
  'manana_0930',
  'hoy_1830',
  'hoy_1730',
  'ayer_0900',
  'sin_fecha'
]);

// scheduled-asc (Fecha por hacer · antigua primero / más próxima primero)
const ascOrder = [...testRows].sort((a, b) => compareSearchRows(a, b, 'scheduled-asc')).map(r => r.id);
assert.deepEqual(ascOrder, [
  'ayer_0900',
  'hoy_1730',
  'hoy_1830',
  'manana_0930',
  'manana_intervalo',
  'manana_1230',
  'nov02_intervalo',
  'nov08',
  'sin_fecha'
]);

console.log('OK scheduled date sorting: ranges with dash, single timestamps, descending, ascending and null placement passed.');
