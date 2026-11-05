const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));

// Enable TypeScript on the fly in CommonJS
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

// Support alias @/
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) {
    name = path.join(root, 'src', name.slice(2));
  }
  return resolve.call(this, name, parent, ...rest);
};

const {
  computeInlineSuggestions
} = require(path.join(root, 'src/lib/inlinePredictiveEngine.ts'));

const {
  isCobroItem,
  isPagoItem,
  isCompletedResult,
  getItemGroupKey,
  orderSearchResults,
  activeResultsFirst
} = require(path.join(root, 'src/lib/activeResultsFirst.ts'));

console.log('=== TEST SUITE: SEARCH REDESIGN & FILTERS ===');

// Mock items
const mockItems = [
  { id: '1', name: 'prtuzREVISION wwebs 26-[11NOV] 11.s.01.00 Mejoras anfeta.com bbria', source: 'Notion', sourceName: 'Revisiones', updateStatus: 'Por hacer', domain: 'anfeta.com' },
  { id: '2', name: 'rtuzREVISION wwebs 26-[11NOV] 11.s.02.00 Optimización filtros nneft', source: 'Notion', sourceName: 'Revisiones', updateStatus: 'En revisión', domain: 'anfeta.com' },
  { id: '3', name: 'zREVISION wwebs 26-[11NOV] 11.s.03.00 Mejoras web terminadas edwi', source: 'Notion', sourceName: 'Revisiones', updateStatus: 'Terminada', domain: 'anfeta.com' },
  { id: '4', name: 'zCOBRAR 26-[11NOV] Cobro mensual hosting apartallante.com', source: 'Notion', sourceName: 'zCOBRAR', updateStatus: 'Por hacer', domain: 'apartallante.com' },
  { id: '5', name: 'zPAGAR 26-[11NOV] Pago servidor AWS Weblab', source: 'Notion', sourceName: 'zPAGAR', updateStatus: 'Por hacer', domain: 'weblab.mx' },
  { id: '6', name: 'pprog 26-[11NOV] 11.s.04.00 Plantilla Weblab y cliente eed11', source: 'Notion', sourceName: 'Revisiones', updateStatus: 'Por hacer', domain: 'weblab.mx' }
];

// TEST 1: In-input predictive suggestions
console.log('1. In-input predictive suggestions:');
const emptySug = computeInlineSuggestions('', mockItems);
assert.equal(emptySug.length, 0, 'Empty query must return 0 suggestions');

const querySug = computeInlineSuggestions('anfeta', mockItems);
assert.ok(querySug.length > 0, 'Non-empty query must return contextual suggestions');
const domainSug = querySug.find(s => s.type === 'domain' && s.value === 'anfeta.com');
assert.ok(domainSug, 'Must detect domain anfeta.com');
assert.equal(domainSug.count, 3, 'Domain count must be accurate (3 items)');
console.log('  OK: Empty query returns 0; non-empty query generates accurate live counts');

// TEST 2: Active criteria deduplication
console.log('2. Active criteria deduplication:');
const criteria = [{ id: 'domain_anfeta.com', type: 'domain', label: 'anfeta.com', value: 'anfeta.com' }];
const dedupSug = computeInlineSuggestions('anfeta', mockItems, criteria);
assert.ok(!dedupSug.some(s => s.value === 'anfeta.com'), 'Active criteria must not be duplicated in suggestions');
console.log('  OK: Active criteria are excluded from available suggestions');

// TEST 3: Completed tasks filter (hideTerminated)
console.log('3. Completed tasks independent filter:');
assert.equal(isCompletedResult(mockItems[2]), true, 'Item 3 is completed');
assert.equal(isCompletedResult(mockItems[0]), false, 'Item 1 is active');
const activeOnly = mockItems.filter(it => !isCompletedResult(it));
assert.equal(activeOnly.length, 5, 'Hiding completed removes item 3 without touching other items');
console.log('  OK: isCompletedResult correctly isolates terminated items without altering Notion');

// TEST 4: Cobros and Pagos independent classification & combinations
console.log('4. Independent Cobros and Pagos filters:');
assert.equal(isCobroItem(mockItems[3]), true, 'Item 4 is Cobro');
assert.equal(isCobroItem(mockItems[4]), false, 'Item 5 is NOT Cobro');
assert.equal(isPagoItem(mockItems[4]), true, 'Item 5 is Pago');
assert.equal(isPagoItem(mockItems[3]), false, 'Item 4 is NOT Pago');

// Cobros ONLY
const cobrosOnly = mockItems.filter(it => isCobroItem(it));
assert.equal(cobrosOnly.length, 1);
assert.equal(cobrosOnly[0].id, '4');

// Pagos ONLY
const pagosOnly = mockItems.filter(it => isPagoItem(it));
assert.equal(pagosOnly.length, 1);
assert.equal(pagosOnly[0].id, '5');

// Cobros ONLY + Pagos ONLY (OR union)
const billingAndPaymentUnion = mockItems.filter(it => isCobroItem(it) || isPagoItem(it));
assert.equal(billingAndPaymentUnion.length, 2, 'Cobros: Solo AND Pagos: Solo must show OR union (both cobros and pagos)');
assert.ok(billingAndPaymentUnion.some(it => it.id === '4') && billingAndPaymentUnion.some(it => it.id === '5'));
console.log('  OK: Independent 3-state Cobros and Pagos filters and OR union verified');

// TEST 5: Clean grouping options (no hidden exclusions)
console.log('5. Grouping without hybrid exclusions:');
const groupNone = orderSearchResults(mockItems, 'none');
assert.equal(groupNone.length, mockItems.length, 'Group none organizes all items without dropping any');

const groupDb = orderSearchResults(mockItems, 'database');
assert.equal(groupDb.length, mockItems.length, 'Group database organizes all items without dropping any');

const groupDomain = orderSearchResults(mockItems, 'domain');
assert.equal(groupDomain.length, mockItems.length, 'Group domain organizes all items without dropping any');

const groupStatus = orderSearchResults(mockItems, 'status');
assert.equal(groupStatus.length, mockItems.length, 'Group status organizes all items without dropping any');

const groupPerson = orderSearchResults(mockItems, 'person');
assert.equal(groupPerson.length, mockItems.length, 'Group person organizes all items without dropping any');

const groupProjectType = orderSearchResults(mockItems, 'project_type');
assert.equal(groupProjectType.length, mockItems.length, 'Group project_type organizes all items without dropping any');

console.log('  OK: All clean grouping options preserve 100% of items without silent exclusions');

console.log('\n=============================================');
console.log('ALL SEARCH REDESIGN TESTS COMPLETED SUCCESSFULLY!');
console.log('=============================================');
