const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
Module._extensions['.ts'] = (m, p) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(p, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    p
  );

const { isCobroItem, isPagoItem, isBillingItem } = require(path.join(root, 'src/lib/activeResultsFirst.ts'));
const { progressiveStage } = require(path.join(root, 'src/services/progressiveWorkflow.ts'));

console.log('Testing Cobros/Pagos Exclusion from user screenshot...');

// 1. Probar progressiveStage con tokens prtuzC y aprtuzC
const stagePrtuzC = progressiveStage('prtuzC 2026-01 Mensualidad E34 F34 mme...');
assert(stagePrtuzC, 'Debe detectar stage');
assert.equal(stagePrtuzC.category, 'cobro', 'prtuzC debe tener category cobro');
assert.equal(stagePrtuzC.code, 'prtuzC', 'Code debe ser prtuzC');

const stageAprtuzC = progressiveStage('aprtuzC 2027-04 SOLO HOSTING aanua hhost oo...');
assert(stageAprtuzC, 'Debe detectar stage');
assert.equal(stageAprtuzC.category, 'cobro', 'aprtuzC debe tener category cobro');

const stagePrtuzP = progressiveStage('prtuzP 2026-01 Pago a proveedor');
assert(stagePrtuzP, 'Debe detectar stage');
assert.equal(stagePrtuzP.category, 'pago', 'prtuzP debe tener category pago');

// 2. Probar items de la captura del usuario
const itemMensualidad1 = { name: 'prtuzC 2026-01 Mensualidad E34 F34 mme...', sourceName: 'Cobrar y pagar' };
const itemMensualidad2 = { name: 'prtuzC 2026-01 Mensualidad E35 F35 mmen...', sourceName: 'Cobrar y pagar' };
const itemHosting1 = { name: 'aprtuzC 2027-04 SOLO HOSTING aanua hhost oo...', sourceName: 'Cobrar y pagar' };
const itemHosting2 = { name: 'aprtuzC 2028-04 SOLO HOSTING aanua hhost oo...', sourceName: 'Cobrar y pagar' };
const itemHosting3 = { name: 'aprtuzC 2029-04 SOLO HOSTING aanua hhost oo...', sourceName: 'Cobrar y pagar' };
const itemHosting4 = { name: 'aprtuzC 2030-04 SOLO HOSTING aanua hhost oo...', sourceName: 'Cobrar y pagar' };

for (const it of [itemMensualidad1, itemMensualidad2, itemHosting1, itemHosting2, itemHosting3, itemHosting4]) {
  assert.equal(isCobroItem(it), true, `Item ${it.name} debe ser isCobroItem === true`);
  assert.equal(isPagoItem(it), false, `Item ${it.name} debe ser isPagoItem === false`);
  assert.equal(isBillingItem(it), true, `Item ${it.name} debe ser isBillingItem === true`);
}

// 3. Probar simulación de filtros
const userScreenshotItems = [
  { name: 'ijuli Creacion de contenido', sourceName: 'Revisiones' },
  { name: 'zzz ASIGNAR-PROYECTO', sourceName: 'Revisiones' },
  { name: 'Reporte SEO jlluni', sourceName: 'Revisiones' },
  itemMensualidad1,
  itemMensualidad2,
  itemHosting1,
  itemHosting2,
  itemHosting3,
  itemHosting4,
  { name: 'prtuzCLIENTE JesusGarza jjesu ggarz nopti cliente...', sourceName: 'Clientes' },
];

// Al excluir Cobros y excluir Pagos (como en la captura del usuario)
const filtered = userScreenshotItems.filter(it => !isCobroItem(it) && !isPagoItem(it) && !isBillingItem(it));
assert.equal(filtered.length, 4, 'Deben quedar exactamente 4 items (3 Revisiones y 1 Clientes)');
assert.deepEqual(
  filtered.map(it => it.name),
  [
    'ijuli Creacion de contenido',
    'zzz ASIGNAR-PROYECTO',
    'Reporte SEO jlluni',
    'prtuzCLIENTE JesusGarza jjesu ggarz nopti cliente...',
  ]
);

console.log('ALL BILLING EXCLUSION TESTS PASSED!');
