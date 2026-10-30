const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (m, p) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(p, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true
        }
      }).outputText,
      p
    );
}

const { detectActivityConflict, hasActivityConflict } = require('../src/services/activityConflict.ts');
const { matchesActivityTagQuery } = require('../src/services/activityTags.ts');
const { matchesResultStatus, RESULT_STATUS_FILTERS } = require('../src/lib/resultIndicators.ts');

console.log('--- TEST 1: detectActivityConflict ---');

// 1.1 Conflicto: Actividad terminada que conserva tag 000
const finishedWith000 = {
  name: 'zREVISION Correcciones web ge11 jo000',
  updateStatus: 'TERMINADA'
};
const c1 = detectActivityConflict(finishedWith000);
assert.ok(c1, 'Debe detectar conflicto en tarea terminada con tag 000');
assert.equal(c1.type, 'completed_with_review_tag');
assert.ok(hasActivityConflict(finishedWith000));
console.log('✔ Conflicto 1 detectado correctamente:', c1.label);

// 1.2 Conflicto: Doble revisor 000 asignado
const doubleReviewer = {
  name: 'rtuzREVISION Campaña Google Ads ge000 jo000 nne11',
  updateStatus: 'EN REVISIÓN'
};
const c2 = detectActivityConflict(doubleReviewer);
assert.ok(c2, 'Debe detectar conflicto con dos revisores 000 simultáneos');
assert.equal(c2.type, 'multiple_reviewers');
console.log('✔ Conflicto 2 detectado correctamente:', c2.label);

// 1.3 Conflicto: Prefijo prtuzR con status TERMINADA
const oppStage = {
  name: 'prtuzR Diseño landing page aac11',
  updateStatus: 'TERMINADA'
};
const c3 = detectActivityConflict(oppStage);
assert.ok(c3, 'Debe detectar conflicto entre prefijo por hacer y estado terminada');
assert.equal(c3.type, 'contradictory_stages');
console.log('✔ Conflicto 3 detectado correctamente:', c3.label);

// 1.4 Conflicto: Prefijo zR con status POR HACER
const oppStage2 = {
  name: 'zR Induccion general bbr11',
  updateStatus: 'POR HACER'
};
const c4 = detectActivityConflict(oppStage2);
assert.ok(c4, 'Debe detectar conflicto entre prefijo zR y estado POR HACER');
assert.equal(c4.type, 'contradictory_stages');
console.log('✔ Conflicto 4 detectado correctamente:', c4.label);

// 1.5 Tarea legítima sin conflicto
const cleanActive = {
  name: 'prtuzR Campaña SEO apartallante nne11',
  updateStatus: 'POR HACER'
};
assert.equal(detectActivityConflict(cleanActive), null, 'Tarea normal activa no debe tener conflicto');

const cleanReview = {
  name: 'rtuzREVISION Auditoria webmaney ggena11 jo000',
  updateStatus: 'EN REVISIÓN'
};
assert.equal(detectActivityConflict(cleanReview), null, 'Revisión legítima con un solo revisor no debe tener conflicto');

console.log('✔ Tareas normales no reportan falsos positivos');

console.log('\n--- TEST 2: matchesActivityTagQuery (filtro de terminadas en búsquedas 000) ---');

// 2.1 Búsqueda de 'jo000' en actividad pendiente de revisión -> coincide
const reviewPendingMatch = matchesActivityTagQuery(
  'rtuzREVISION Banner móvil aac11 jo000',
  'jo000',
  false,
  'EN REVISIÓN'
);
assert.equal(reviewPendingMatch, true, 'Debe coincidir jo000 en actividad pendiente de revisión');

// 2.2 Búsqueda de 'jo000' en actividad terminada -> NO debe coincidir (evita que tareas terminadas contaminen la búsqueda de pendientes)
const reviewCompletedMatch = matchesActivityTagQuery(
  'zREVISION Banner móvil aac11 jo000',
  'jo000',
  false,
  'TERMINADA'
);
assert.equal(reviewCompletedMatch, false, 'NO debe coincidir jo000 cuando la tarea ya fue terminada');

// 2.3 Búsqueda de 'jo000' con status TERMINADA pero sin z en título -> NO debe coincidir
const reviewCompletedByStatus = matchesActivityTagQuery(
  'Banner móvil aac11 jo000',
  'jo000',
  false,
  'TERMINADA'
);
assert.equal(reviewCompletedByStatus, false, 'NO debe coincidir jo000 si el estado en Notion es TERMINADA');

// 2.4 Búsqueda de un tag de trabajo regular como 'aac11' -> coincide normalmente incluso si está terminada
const normalTagMatch = matchesActivityTagQuery(
  'zREVISION Banner móvil aac11 jo000',
  'aac11',
  false,
  'TERMINADA'
);
assert.equal(normalTagMatch, true, 'Tags regulares de trabajo siguen coincidiendo para auditoría histórica');
console.log('✔ Búsquedas de tags 000 excluyen tareas terminadas y mantienen tareas activas de revisión');

console.log('\n--- TEST 3: matchesResultStatus y RESULT_STATUS_FILTERS ---');

// 3.1 Filtro 'conflict' en RESULT_STATUS_FILTERS
const hasConflictFilterOption = RESULT_STATUS_FILTERS.some(([val]) => val === 'conflict');
assert.ok(hasConflictFilterOption, 'RESULT_STATUS_FILTERS debe incluir la opción "conflict"');

// 3.2 matchesResultStatus con filter = 'conflict'
assert.equal(matchesResultStatus(finishedWith000, 'conflict'), true, 'matchesResultStatus debe devolver true para item en conflicto');
assert.equal(matchesResultStatus(cleanActive, 'conflict'), false, 'matchesResultStatus debe devolver false para item limpio');

// 3.3 Filtro 'all' sigue funcionando
assert.equal(matchesResultStatus(finishedWith000, 'all'), true);
assert.equal(matchesResultStatus(cleanActive, 'all'), true);

console.log('✔ Filtro de estado para actividades en conflicto funciona al 100%');
console.log('\nALL CONFLICT AND REVIEW FILTERING TESTS PASSED!');
