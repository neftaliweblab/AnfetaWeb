const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
process.env.NOTION_TOKEN = 'TEST_ONLY';
if (process.cwd().replace(/\\/g, '/') !== root) process.chdir(root);

const ts = require(path.join(root, 'node_modules/typescript'));
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (mod, file) =>
    mod._compile(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
      file
    );
}

const { progressiveStage, revisionPhaseTitle } = require('../src/services/progressiveWorkflow.ts');
const { workflowBadgePresentation, activityDetailedState } = require('../src/services/activityWorkflow.ts');
const { RESULT_STATUS_FILTERS, matchesResultStatus } = require('../src/lib/resultIndicators.ts');
const { isFinalizedResult, isOperativeTerminatedResult } = require('../src/lib/activeResultsFirst.ts');

console.log('=== TEST: Diferenciación de Estados TERMINADOS vs FIN (Reunión Nov 9) ===\n');

// 1. progressiveStage reconoce las opciones de la base de Notion
const tuzNotion = progressiveStage('TUZ - TERMINADO REVISION');
assert.ok(tuzNotion, 'TUZ - TERMINADO REVISION debe ser reconocido');
assert.ok(tuzNotion.code.startsWith('tuz'));
assert.equal(tuzNotion.state, 'completed');
assert.ok(tuzNotion.label.includes('Terminada'));
console.log('✓ TUZ - TERMINADO REVISION detectado como tuzR (Terminada · por aprobar)');

const finNotion = progressiveStage('TERMINADO REV COBRO/DOCUMENTACION');
assert.ok(finNotion, 'TERMINADO REV COBRO/DOCUMENTACION debe ser reconocido como Fin');
assert.equal(finNotion.code, 'zR');
assert.equal(finNotion.state, 'completed');
assert.equal(finNotion.label, 'Finalizada (Fin)');
console.log('✓ TERMINADO REV COBRO/DOCUMENTACION detectado como zR (Finalizada · Fin)');

const simpleTerminado = progressiveStage('TERMINADO');
assert.ok(simpleTerminado);
assert.equal(simpleTerminado.code, 'tuzR');
console.log('✓ TERMINADO detectado como tuzR');

const simpleFin = progressiveStage('FINALIZADO');
assert.ok(simpleFin);
assert.equal(simpleFin.code, 'zR');
console.log('✓ FINALIZADO detectado como zR');

// 2. Badges diferenciados: TER vs FIN
const badgeTer = workflowBadgePresentation('TUZ - TERMINADO REVISION', 'tuzR 26-[11NOV] Auditoria Ads');
assert.equal(badgeTer.shortLabel, 'TER');
assert.equal(badgeTer.isTer, true);
assert.equal(badgeTer.isFin, false);
console.log('✓ Badge de Terminado muestra [TER]');

const badgeFin = workflowBadgePresentation('TERMINADO REV COBRO/DOCUMENTACION', 'zR 26-[11NOV] Auditoria Ads');
assert.equal(badgeFin.shortLabel, 'FIN');
assert.equal(badgeFin.isFin, true);
assert.equal(badgeFin.isTer, false);
console.log('✓ Badge de Fin muestra [FIN]');

// 3. revisionPhaseTitle genera zR cuando es finalized/fin (quitando t y u de tuzR como dijo John)
const baseTitle = 'Auditoria Ads p.fortelite.com.ads #descripcion';
const titleWithTuz = revisionPhaseTitle(baseTitle, 'completed');
assert.ok(titleWithTuz.startsWith('tuzR'), 'completed debe generar tuzR');
console.log('✓ revisionPhaseTitle(..., "completed") genera: ' + titleWithTuz.slice(0, 30));

const titleWithFin = revisionPhaseTitle(titleWithTuz, 'finalized');
assert.ok(titleWithFin.startsWith('zR'), 'finalized debe generar zR');
console.log('✓ revisionPhaseTitle(..., "finalized") quita t y u generando: ' + titleWithFin.slice(0, 30));

// 4. activityDetailedState
assert.equal(activityDetailedState('TUZ - TERMINADO REVISION', 'tuzR act'), 'terminated');
assert.equal(activityDetailedState('TERMINADO REV COBRO/DOCUMENTACION', 'zR act'), 'finalized');
assert.equal(activityDetailedState('REVISAR REVISIONES rrevi', 'rtuzR act'), 'review');
assert.equal(activityDetailedState('PRTUZ POR HACER', 'prtuzR act'), 'pending');
console.log('✓ activityDetailedState clasifica terminated, finalized, review y pending con precisión');

// 5. Filtros de tipo y estado (RESULT_STATUS_FILTERS y matchesResultStatus)
const filterKeys = RESULT_STATUS_FILTERS.map(([val]) => val);
assert.ok(filterKeys.includes('terminated'), 'RESULT_STATUS_FILTERS debe incluir TER · Terminadas');
assert.ok(filterKeys.includes('finalized'), 'RESULT_STATUS_FILTERS debe incluir FIN · Finalizadas');
console.log('✓ RESULT_STATUS_FILTERS incluye opciones separadas para "terminated" (TER) y "finalized" (FIN)');

const actTuz = {
  name: 'tuzR aapli Mejoras web rrecu ne11',
  updateStatus: 'TUZ - TERMINADO REVISION',
};
const actFin = {
  name: 'zR aapli Cobro y cierre fase-36 rrecu ne11',
  updateStatus: 'TERMINADO REV COBRO/DOCUMENTACION',
};

assert.equal(matchesResultStatus(actTuz, 'terminated'), true, 'actTuz debe coincidir con filtro terminated');
assert.equal(matchesResultStatus(actTuz, 'finalized'), false, 'actTuz NO debe coincidir con filtro finalized');
assert.equal(matchesResultStatus(actFin, 'finalized'), true, 'actFin debe coincidir con filtro finalized');
assert.equal(matchesResultStatus(actFin, 'terminated'), false, 'actFin NO debe coincidir con filtro terminated');
console.log('✓ matchesResultStatus filtra con precisión quirúrgica entre TER y FIN');

console.log('\n=============================================');
console.log('TODAS LAS PRUEBAS DE DIFERENCIACIÓN PASARON!');
console.log('=============================================');
