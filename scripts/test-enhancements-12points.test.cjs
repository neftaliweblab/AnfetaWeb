const assert = require('assert/strict');
const path = require('path');
const root = path.resolve(__dirname, '..');

// Load TS modules
const Module = require('module');
const fs = require('fs');
const ts = require('typescript');
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

const { parseVisualParts } = require(path.join(root, 'src/lib/visualTitleParser.ts'));
const { calculateSearchRelevance, getOrderNumericRank, cleanSearchTitle } = require(path.join(root, 'src/lib/searchResultOrder.ts'));
const { sortSearchRows, isFullMatch, itemMatchesScheduledDay, searchMexicoDay } = require(path.join(root, 'src/lib/searchPresentation.ts'));
const { progressiveStage } = require(path.join(root, 'src/services/progressiveWorkflow.ts'));
const { matchesActivityTagQuery } = require(path.join(root, 'src/services/activityTags.ts'));

console.log('=== TEST SUITE: 12-POINT ENHANCEMENTS ===\n');

// 1. Structured Titles (MM.c.OO.SS)
console.log('1. Structured Title Parsing:');
const p1 = parseVisualParts('11.s.01.00 Definición-instalador');
assert.equal(p1.monthCode, '11', 'Month code is 11');
assert.equal(p1.orderCode, '01.00', 'Order code is 01.00');
assert.equal(p1.area, 'PROG', 'Strand s maps to PROG');

const p2 = parseVisualParts('tuzR | 💻 aapli | 📅 11.a.02.00 Mejoras anfeta web | 🌐 p.anfeta.com | 👥 nne11 ed11');
assert.equal(p2.monthCode, '11', 'Month code is 11');
assert.equal(p2.orderCode, '02.00', 'Order code is 02.00');
assert.equal(p2.area, 'APP', 'Strand a maps to APP');

const rank1 = getOrderNumericRank({ Name: '11.s.01.00 Actividad 1' });
const rank2 = getOrderNumericRank({ Name: '11.s.02.00 Actividad 2' });
const rank10 = getOrderNumericRank({ Name: '11.s.10.00 Actividad 10' });
assert.ok(rank1 < rank2, '01.00 < 02.00');
assert.ok(rank2 < rank10, '02.00 < 10.00');
console.log('  OK: Structured format 11.s.01.00 and numeric order ranking verified.');

// 2. Double "A" Suspended Tokens
console.log('2. Double "A" Suspended Prefix:');
assert.equal(progressiveStage('aaprtuzR Tarea')?.state, 'suspended', 'aaprtuzR is suspended');
assert.equal(progressiveStage('aaprtuzS Tarea')?.state, 'suspended', 'aaprtuzS is suspended');
assert.equal(progressiveStage('aartuzR Tarea')?.state, 'suspended', 'aartuzR is suspended');
assert.equal(progressiveStage('aaprR Tarea')?.state, 'suspended', 'aaprR is suspended');
assert.equal(progressiveStage('WA Tarea')?.state, 'suspended', 'WA is suspended');
assert.equal(progressiveStage('AA Tarea')?.state, 'suspended', 'AA is suspended');

// Ensure no collision with tags/domains
assert.equal(progressiveStage('aads Tarea'), null, 'aads does not trigger suspended');
assert.equal(progressiveStage('aapli Tarea'), null, 'aapli does not trigger suspended');
assert.equal(progressiveStage('aacal Tarea'), null, 'aacal does not trigger suspended');
assert.equal(progressiveStage('aan11 Tarea'), null, 'aan11 does not trigger suspended');

const pSusp = parseVisualParts('aaprtuzS | 💻 ssoft | 📅 11.s.04.00 Usos-cliente');
assert.equal(pSusp.workflow, 'SUSPENDIDA', 'aaprtuzS parsed as SUSPENDIDA');
console.log('  OK: Double "A" tokens recognize suspended and do not collide with domains/tags.');

// 3. Search Relevance Ranking
console.log('3. Search Relevancy Ranking:');
const q = 'Reporte del mes ADS';
const exact = { Name: 'Reporte del mes ADS' };
const fullPhrase = { Name: 'Reporte del mes ADS de cliente.com' };
const allTerms = { Name: 'ADS · Reporte del mes de cliente.com' };
const partial1 = { Name: 'Reporte mensual' };
const partial2 = { Name: 'Configuración ADS' };

const sExact = calculateSearchRelevance(exact, q);
const sFull = calculateSearchRelevance(fullPhrase, q);
const sTerms = calculateSearchRelevance(allTerms, q);
const sPart1 = calculateSearchRelevance(partial1, q);
const sPart2 = calculateSearchRelevance(partial2, q);

assert.equal(sExact, 100, 'Exact match gets 100');
assert.equal(sFull, 80, 'Full phrase match gets 80');
assert.equal(sTerms, 60, 'All terms match gets 60');
assert.equal(sPart1, 20, 'Partial match gets 20');
assert.equal(sPart2, 20, 'Partial match gets 20');

assert.ok(sExact > sFull && sFull > sTerms && sTerms > sPart1, 'Strict hierarchy: 100 > 80 > 60 > 20');

const sorted = sortSearchRows([partial1, allTerms, fullPhrase, partial2, exact], 'default', new Date(), q);
assert.equal(sorted[0].Name, 'Reporte del mes ADS', 'First is exact match');
assert.equal(sorted[1].Name, 'Reporte del mes ADS de cliente.com', 'Second is full phrase match');
assert.equal(sorted[2].Name, 'ADS · Reporte del mes de cliente.com', 'Third is all terms match');
console.log('  OK: Search relevance ranking strictly complies with required 4 tiers.');

// 4. Full Match Highlighting
console.log('4. Full Match Highlighting:');
assert.equal(isFullMatch(exact, q), true, 'Exact match is full match');
assert.equal(isFullMatch(fullPhrase, q), true, 'Full phrase match is full match');
assert.equal(isFullMatch(allTerms, q), true, 'All terms match is full match');
assert.equal(isFullMatch(partial1, q), false, 'Partial match is NOT full match');
assert.equal(isFullMatch(partial2, q), false, 'Partial match is NOT full match');
console.log('  OK: False highlight on partial/last-term matches eliminated.');

// 5. Edwin Template Tag Recognition
console.log('5. Edwin Template Tag Recognition:');
assert.equal(matchesActivityTagQuery('Plantilla con eed11', 'eed11'), true, 'eed11 matches eed11');
assert.equal(matchesActivityTagQuery('Plantilla con ee-d11', 'eed11'), true, 'eed11 matches template tag ee-d11');
console.log('  OK: eed11 recognizes both active eed11 and template ee-d11.');

// 6. Hoy (Today) Filter
console.log('6. Hoy Filter (Scheduled Day Range):');
const todayStr = searchMexicoDay(new Date());
const itemToday = { dateStart: todayStr + 'T10:00:00-06:00', dateEnd: todayStr + 'T11:00:00-06:00' };
const itemPast = { dateStart: '2026-07-01T10:00:00-06:00', dateEnd: '2026-07-01T11:00:00-06:00' };
const itemSpan = { dateStart: '2026-01-01T10:00:00-06:00', dateEnd: '2026-12-31T11:00:00-06:00' };

assert.equal(itemMatchesScheduledDay(itemToday, todayStr), true, 'Today item matches');
assert.equal(itemMatchesScheduledDay(itemPast, todayStr), false, 'Past item does not match');
assert.equal(itemMatchesScheduledDay(itemSpan, todayStr), true, 'Spanning item matches');
console.log('  OK: Scheduled day range filtering strictly handles CDMX today.');

console.log('\nALL 12-POINT ENHANCEMENT TESTS PASSED!');
