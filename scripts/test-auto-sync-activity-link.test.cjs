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

const {
  canonicalActivityUrl,
  evaluateActivityLink,
  findActivityLinkProperty,
  saveActivityLinkToNotion,
  backfillActivityLinks,
} = require('@/services/activityLinkService');

async function testAutoSyncLogic() {
  console.log('=== TEST: Auto-Sync "Abrir en ANFETA" Property ===\n');

  // Case 1: Page "45" created in Notion directly with empty "Abrir en ANFETA"
  console.log('--- Test 1: Page "45" detection and link evaluation ---');
  const mockPage45 = {
    id: '45000000-0000-0000-0000-000000000045',
    properties: {
      'Nombre': { type: 'title', title: [{ plain_text: '45' }] },
      'Abrir en ANFETA': { type: 'url', url: null },
      'Fecha POR Hacer': { type: 'date', date: { start: '2026-11-03T16:22:00-06:00', end: '2026-11-03T18:00:00-06:00' } }
    }
  };

  const propMatch = findActivityLinkProperty(mockPage45.properties);
  assert.ok(propMatch, 'Should find property "Abrir en ANFETA"');
  assert.equal(propMatch.name, 'Abrir en ANFETA');
  assert.equal(propMatch.isValid, true);

  const evaluation = evaluateActivityLink(mockPage45.id, mockPage45.properties[propMatch.name].url);
  assert.equal(evaluation.status, 'empty');
  assert.equal(evaluation.canonicalUrl, 'https://anfeta.com/calendar?activity=45000000000000000000000000000045');
  console.log('OK: Page "45" identified as needing URL fill.');

  // Case 2: Batch detection across mixed pages
  console.log('\n--- Test 2: Batch detection and categorization ---');
  const pages = [
    mockPage45,
    {
      id: '11111111-1111-1111-1111-111111111111',
      properties: {
        'Abrir en ANFETA': { type: 'url', url: 'https://anfeta.com/calendar?activity=11111111111111111111111111111111' },
      }
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      properties: {
        'Abrir en ANFETA': { type: 'url', url: 'https://anfeta.com/calendar?activity=99999999999999999999999999999999' }, // Inherited / outdated
      }
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      properties: {
        'Abrir en ANFETA': { type: 'url', url: 'https://dropbox.com/s/123/doc.pdf' }, // Foreign URL
      }
    }
  ];

  const results = pages.map(p => {
    const match = findActivityLinkProperty(p.properties);
    if (!match || !match.isValid) return { id: p.id, action: 'skip' };
    const curUrl = p.properties[match.name]?.url;
    const evalRes = evaluateActivityLink(p.id, curUrl);
    return { id: p.id, status: evalRes.status, canonical: evalRes.canonicalUrl };
  });

  assert.equal(results[0].status, 'empty');
  assert.equal(results[1].status, 'exact');
  assert.equal(results[2].status, 'needs_repair');
  assert.equal(results[3].status, 'foreign');
  console.log('OK: Correctly categorized all 4 page states.');

  console.log('\n=============================================');
  console.log('ALL AUTO-SYNC TESTS PASSED!');
  console.log('=============================================');
}

testAutoSyncLogic().catch(e => {
  console.error(e);
  process.exit(1);
});
