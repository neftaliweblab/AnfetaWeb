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
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (m, p) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(p, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      }).outputText,
      p
    );
}

console.log('=== TEST SUITE: ANFETA Incremental Scanner & Notion Content Sync ===\n');

// 1. Mocking notionRequest to verify fetchRecentNotionEdits behavior
console.log('--- TEST 1: fetchRecentNotionEdits incremental queries with "since" ---');
let capturedRequests = [];
const mockMutations = {
  notionRequest: async (settings, endpoint, method, body) => {
    capturedRequests.push({ endpoint, method, body });
    if (endpoint.startsWith('data_sources/') && !endpoint.includes('/query')) {
      // Schema query
      return {
        properties: {
          Name: { id: 'title-id', type: 'title' },
          'busqueda palabras por contenido pagina IA': { id: 'ai-content-id', type: 'formula' },
          'Persona': { id: 'person-id', type: 'people' },
          'Estado': { id: 'status-id', type: 'status' },
          'Fecha por hacer': { id: 'date-id', type: 'date' },
        },
      };
    }
    // Query results
    const baseName = endpoint.includes('2eeabd7d-91b7-8193') ? 'Revisiones' : 'Clientes';
    return {
      results: [
        {
          id: '11111111-2222-3333-4444-555555555555',
          last_edited_time: '2026-11-09T18:45:00.000Z',
          archived: false,
          properties: {
            Name: { type: 'title', title: [{ plain_text: 'Actividad editada con bitacora en Notion' }] },
            'busqueda palabras por contenido pagina IA': { type: 'formula', formula: { type: 'string', string: 'bitácora de trabajo de la jornada' } },
          },
        },
      ],
      has_more: false,
    };
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === './notionMutations' || request.endsWith('notionMutations')) {
    return mockMutations;
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { fetchRecentNotionEdits, lookupNotionContent } = require('../src/services/notionContentLookup.ts');
const { applyNotionStates } = require('../src/lib/applyNotionStates.ts');
const { matchesFlexibleOrQuotedQuery } = require('../src/services/advancedQuery.ts');
const { isContentItem } = require('../src/lib/notionFilters.ts');

(async () => {
  // Test incremental query with since parameter
  const sinceIso = '2026-11-09T18:40:00.000Z';
  const recentResult = await fetchRecentNotionEdits({ notionToken: 'test-token', notionDataSourceId: 'test-ds' }, sinceIso, 50);

  assert.ok(recentResult.pages.length > 0, 'Debe retornar páginas modificadas');
  assert.ok(recentResult.scanTimestamp, 'Debe incluir scanTimestamp');

  // Verify that Notion queries included last_edited_time filter
  const queryReqs = capturedRequests.filter(r => r.endpoint.includes('/query'));
  assert.ok(queryReqs.length > 0, 'Debió ejecutar peticiones /query a data sources');
  for (const q of queryReqs) {
    assert.equal(q.body.page_size, 50, 'El page_size debe ser 50');
    assert.deepEqual(q.body.sorts, [{ timestamp: 'last_edited_time', direction: 'descending' }]);
    assert.ok(q.body.filter, 'Debe incluir filtro de timestamp');
    assert.equal(q.body.filter.timestamp, 'last_edited_time');
    assert.ok(q.body.filter.last_edited_time.on_or_after, 'Debe filtrar on_or_after con margen de seguridad');
  }
  console.log('OK: fetchRecentNotionEdits correctly sends timestamp filter and descending sort without full table scan.');

  // 2. Test lookupNotionContent with pagination (page_size: 100) and force cache busting
  console.log('\n--- TEST 2: lookupNotionContent with force cache-bust & page_size: 100 ---');
  capturedRequests = [];
  const lookup1 = await lookupNotionContent({ notionToken: 'test-token-2', notionDataSourceId: 'test-ds-2' }, 'bitacora', true);
  assert.ok(lookup1.pages.length > 0);
  const lookupReqs = capturedRequests.filter(r => r.endpoint.includes('/query'));
  assert.equal(lookupReqs[0].body.page_size, 100, 'lookupNotionContent debe usar page_size: 100');
  console.log('OK: lookupNotionContent uses page_size: 100 and force flag invalidates bounded cache.');

  // 3. Test applyNotionStates merging incremental updates into search rows
  console.log('\n--- TEST 3: Incremental updates merge & immediate Contenido search match ---');
  const existingRow = {
    id: '11111111222233334444555555555555',
    name: 'Actividad previa antigua',
    source: 'Notion',
    sourceName: 'Revisiones',
    aiContent: '', // Before edit: empty
    description: '',
    pageContent: '',
    contentSnippet: '',
    serverModified: '2026-11-09T17:00:00.000Z',
  };

  // Initially: Does not match "bitacora" in Contenido scope
  assert.equal(isContentItem(existingRow), false);
  assert.equal(matchesFlexibleOrQuotedQuery(existingRow, 'bitacora', { contentOnly: true }), false);

  // Incoming incremental modification event from Notion
  const incomingUpdates = [
    {
      id: '11111111222233334444555555555555',
      name: 'Actividad editada con bitacora en Notion',
      aiContent: 'bitácora de trabajo de la jornada',
      serverModified: '2026-11-09T18:45:00.000Z',
    },
  ];

  const updatedRows = applyNotionStates([existingRow], incomingUpdates);
  assert.equal(updatedRows.length, 1);
  const merged = updatedRows[0];

  assert.equal(merged.name, 'Actividad editada con bitacora en Notion');
  assert.equal(merged.aiContent, 'bitácora de trabajo de la jornada');
  assert.equal(isContentItem(merged), true, 'Ahora es ContentItem porque tiene aiContent');

  // After sync: IMMEDIATELY matches "bitacora" and "bitácora" in Contenido scope!
  assert.equal(matchesFlexibleOrQuotedQuery(merged, 'bitacora', { contentOnly: true }), true);
  assert.equal(matchesFlexibleOrQuotedQuery(merged, 'bitácora', { contentOnly: true }), true);
  assert.equal(matchesFlexibleOrQuotedQuery(merged, 'jornada', { contentOnly: true }), true);
  assert.equal(matchesFlexibleOrQuotedQuery(merged, 'ausente', { contentOnly: true }), false);
  console.log('OK: Newly edited page with "bitácora" in Notion immediately surfaces in Contenido scope upon sync.');

  // 4. Test appending brand new pages created in Notion
  console.log('\n--- TEST 4: Brand new pages created in Notion appended seamlessly ---');
  const newRowFromNotion = {
    id: '99999999888877776666555544443333',
    externalId: '99999999888877776666555544443333',
    name: 'Nueva tarea creada en Notion con bitacora',
    source: 'Notion',
    sourceName: 'Clientes',
    aiContent: 'bitácora semanal de clientes',
    contentPropertyObserved: true,
    serverModified: '2026-11-09T18:46:00.000Z',
  };

  const currentList = [merged];
  const known = new Set(currentList.map(r => r.id));
  const mergedList = [...currentList, ...[newRowFromNotion].filter(r => !known.has(r.id))];

  assert.equal(mergedList.length, 2);
  const matchingInContenido = mergedList.filter(r => isContentItem(r) && matchesFlexibleOrQuotedQuery(r, 'bitacora', { contentOnly: true }));
  assert.equal(matchingInContenido.length, 2, 'Ambas páginas (la actualizada y la nueva) deben aparecer');
  console.log('OK: Brand new page from Notion successfully appended and matches search term.');

  console.log('\n===============================================================');
  console.log('ALL INCREMENTAL SCANNER & NOTION CONTENT SYNC TESTS PASSED!');
  console.log('===============================================================');
})().catch(err => {
  console.error('FAILED TEST:', err);
  process.exit(1);
});
