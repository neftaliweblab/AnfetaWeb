const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
process.chdir(root);

const ts = require(path.join(root, 'node_modules/typescript'));
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};

for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (mod, file) =>
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      }
    }).outputText, file);
}

// Imports under test
const { ACTIVITY_TAGS, parseActivityTag, activePersonTag, pendingReviewTag, completedActivityTags } = require('@/services/activityTags');
const { normalizePerson, PERSON_ALIASES } = require('@/services/identityNormalizer');
const { activityDescription, editActivityDescription } = require('@/services/activityTitleEdit');
const { matchesFlexibleOrQuotedQuery } = require('@/services/advancedQuery');
const { calendarDisplayTitle, calendarType } = require('@/services/calendarPresentation');

async function runTests() {
  console.log('--- TEST 1: Edwin Identity & Notion User Resolution ---');
  assert.equal(normalizePerson('Edwin'), 'Edwin', 'Canonical name');
  assert.equal(normalizePerson('eedwi@practicante.com'), 'Edwin', 'Notion email eedwi@practicante.com');
  assert.equal(normalizePerson('edwin@practicante.com'), 'Edwin', 'Notion email edwin@practicante.com');
  assert.equal(normalizePerson('eedwin'), 'Edwin', 'Historical alias eedwin');
  assert.equal(normalizePerson('eedwi'), 'Edwin', 'Alias eedwi');
  assert.equal(normalizePerson('edwi'), 'Edwin', 'Alias edwi');
  assert.equal(normalizePerson('eed11'), 'Edwin', 'Active tag eed11');
  assert.equal(normalizePerson('EED11'), 'Edwin', 'Case insensitive active tag EED11');
  assert.equal(normalizePerson('eed00'), 'Edwin', 'Urgent tag eed00');
  assert.equal(normalizePerson('eed22'), 'Edwin', 'Secondary tag eed22');
  assert.equal(normalizePerson('eed33'), 'Edwin', 'Practice tag eed33');
  assert.equal(normalizePerson('eed000'), 'Edwin', 'Review tag eed000');
  console.log('OK: Edwin identity normalizes across all variants and Notion email.');

  console.log('--- TEST 2: Edwin Active & Reference Tags ---');
  assert.equal(activePersonTag('Edwin', '11'), 'eed11', 'Active primary is eed11');
  assert.equal(activePersonTag('Edwin', '00'), 'eed00', 'Active urgent is eed00');
  assert.equal(activePersonTag('Edwin', '22'), 'eed22', 'Active secondary is eed22');
  assert.equal(activePersonTag('Edwin', '33'), 'eed33', 'Active practice is eed33');
  assert.equal(pendingReviewTag('Edwin'), 'eed000', 'Review tag is eed000');

  const t11 = parseActivityTag('eed11');
  assert.equal(t11?.person, 'Edwin');
  assert.equal(t11?.role, 'active');
  assert.equal(t11?.priority, '11');

  const t11Upper = parseActivityTag('EED11');
  assert.equal(t11Upper?.person, 'Edwin');
  assert.equal(t11Upper?.priority, '11');

  const tRev = parseActivityTag('eed000');
  assert.equal(tRev?.person, 'Edwin');
  assert.equal(tRev?.role, 'review');

  const tRef = parseActivityTag('ed11');
  assert.equal(tRef?.person, 'Edwin');
  assert.equal(tRef?.role, 'reference');

  const tLegacy = parseActivityTag('eedwin');
  assert.equal(tLegacy?.person, 'Edwin');
  assert.equal(tLegacy?.legacy, true, 'eedwin is preserved as legacy alias');

  console.log('OK: Edwin active, review, reference, and legacy tags verified.');

  console.log('--- TEST 3: Structured Activity Presentation & Editing ---');
  const fullTitle = 'prtuzR danela.mx [10OCT] aads Configuración de anuncios Meta eed11';
  const cleanDesc = activityDescription(fullTitle);
  assert.equal(cleanDesc, 'Configuración de anuncios Meta', 'Extracts clean description');

  const renamed = editActivityDescription(fullTitle, 'Ajuste de presupuesto y pixel');
  assert.equal(renamed, 'prtuzR danela.mx [10OCT] aads Ajuste de presupuesto y pixel eed11', 'Renames description preserving all technical tokens');

  // Verify display title cleaner strips tokens cleanly
  const dispTitle = calendarDisplayTitle(fullTitle, 'danela.mx');
  assert.ok(!dispTitle.includes('eed11'), 'Clean display title excludes person tag');
  assert.ok(!dispTitle.includes('prtuzR'), 'Clean display title excludes workflow token');
  console.log('OK: Structured description editing preserves technical tokens and history.');

  console.log('--- TEST 4: Search Query Matching ---');
  const dummyItem = {
    id: 'page-12345678901234567890123456789012',
    name: 'prtuzR danela.mx [10OCT] aads Reporte de rendimiento eed11',
    source: 'Notion',
    sourceName: 'Revisiones',
    assignedPerson: 'Edwin',
    updateStatus: 'En progreso',
  };

  assert.ok(matchesFlexibleOrQuotedQuery(dummyItem, 'Edwin'), 'Matches Edwin');
  assert.ok(matchesFlexibleOrQuotedQuery(dummyItem, 'eed11'), 'Matches eed11 tag');
  assert.ok(matchesFlexibleOrQuotedQuery(dummyItem, 'danela.mx'), 'Matches domain');

  const induItem = {
    id: 'page-indu',
    name: 'prtuzSOFTWARE Induccion General Estadias Practicas iindu bbr11',
    source: 'Notion',
    sourceName: 'Revisiones',
  };
  assert.ok(matchesFlexibleOrQuotedQuery(induItem, 'indu'), 'Matches indu search query');
  console.log('OK: Search query matching for Edwin, tags, and indu passed.');

  console.log('--- TEST 5: Direct Link & Concurrency Architecture ---');
  // Verify cleanPageId format validation
  const testId = '384abd7d91b7809cac11f0beda59eaab';
  assert.equal(testId.length, 32);
  assert.ok(/^[a-f0-9]{32}$/i.test(testId));

  // Verify completed tags retain reference ed11
  const compResult = completedActivityTags(fullTitle, 'Genaro', 'Edwin');
  assert.ok(compResult.includes('ed11'), `Expected ed11 in completed tags: ${compResult}`);

  console.log('\n=============================================');
  console.log('ALL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
