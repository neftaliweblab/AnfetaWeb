const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
process.env.NOTION_TOKEN = 'TEST_ONLY';
if (process.cwd().replace(/\\/g, '/') !== root) process.chdir(root);

const ts = require(path.join(root, 'node_modules/typescript'));
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return origResolve.call(this, name, parent, ...rest);
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

const settings = { notionToken: 'TEST_ONLY', currentUser: 'nneft' };
const origLoad = Module._load;
Module._load = function (name, parent, ...rest) {
  if (name === 'next/server') {
    const actual = origLoad.call(this, name, parent, ...rest);
    return { ...actual, after: () => {} };
  }
  if (
    name === '@/services/serverAuth' &&
    parent?.filename.replace(/\\/g, '/').endsWith('/src/app/api/data/route.ts')
  ) {
    return { requireActor: () => 'nneft', assertSameOrigin: () => {} };
  }
  if (
    (name === 'fs' || name === 'node:fs') &&
    ['/src/app/api/data/route.ts', '/src/services/serverSettings.ts'].some((s) =>
      parent?.filename.replace(/\\/g, '/').endsWith(s)
    )
  ) {
    return {
      ...fs,
      existsSync: (p) => String(p).replace(/\\/g, '/') === root + '/settings.json',
      readFileSync: (p) => {
        if (String(p).replace(/\\/g, '/') === root + '/settings.json') return JSON.stringify(settings);
        throw Error('Unexpected filesystem read in test');
      },
      mkdirSync: () => {},
      writeFileSync: () => {},
    };
  }
  return origLoad.call(this, name, parent, ...rest);
};

const catalog = require(root + '/src/lib/notionViewsCatalog.ts');
const notionFilters = require(root + '/src/lib/notionFilters.ts');
const advancedQuery = require(root + '/src/services/advancedQuery.ts');
const predictive = require(root + '/src/lib/inlinePredictiveEngine.ts');
const tabConfig = require(root + '/src/lib/searchTabConfig.ts');
const mutations = require(root + '/src/services/notionMutations.ts');
const route = require(root + '/src/app/api/data/route.ts');
const phaseOneCatalog = require(root + '/data/notion_template_phase1_catalog_v2.json');

async function run() {
  // 1. Vistas catalog + filters
  const egresosView = catalog.NOTION_VIEWS.find((v) => v.id === 'vista-egresos');
  const ingresosView = catalog.NOTION_VIEWS.find((v) => v.id === 'vista-ingresos');
  const operativoView = catalog.NOTION_VIEWS.find((v) => v.id === 'vista-operativo');
  assert.equal(egresosView.status, 'ready');
  assert.ok(egresosView.url.includes('9d8abd7d91b782f9b47c8109ef3fb075'));
  assert.equal(ingresosView.status, 'ready');
  assert.ok(ingresosView.url.includes('385abd7d91b78255b3f781c02fe9100d'));
  assert.equal(operativoView.status, 'pending');
  assert.equal(operativoView.url, undefined);

  const sampleTemplateId = phaseOneCatalog.Items[0].PageId;
  const items = [
    {
      id: 'notion:tpl-phase1',
      externalId: sampleTemplateId,
      source: 'Notion',
      sourceName: 'Revisiones',
      name: 'sseo Auditoría técnica general',
    },
    {
      id: 'notion:tpl-hash',
      externalId: 'aaaa1111aaaa1111aaaa1111aaaa1111',
      source: 'Notion',
      sourceName: 'Revisiones',
      name: 'aaprtuzR #ffase00 00-00 Configuracion inicial ee-d11',
    },
    {
      id: 'notion:view-1',
      externalId: '9d8abd7d-91b7-82f9-b47c-8109ef3fb075',
      source: 'Notion',
      sourceName: 'Revisiones',
      name: 'aaprtuzR VSzU Egresos 11 c 00 00 ccrea vvist ttab',
    },
    {
      id: 'notion:regular-1',
      externalId: 'bbbb2222bbbb2222bbbb2222bbbb2222',
      source: 'Notion',
      sourceName: 'Revisiones',
      name: 'prtuzREVISION sseo nneft anfeta.com Revisar robots',
    },
    {
      id: 'dropbox:file-1',
      source: 'Dropbox',
      sourceName: 'Dropbox',
      name: 'plantilla contrato.docx',
    },
  ];

  // 2. Plantillas filter surfaces templates in Revisiones regardless of eed11/plantilla word
  const filteredTemplates = notionFilters.filterByNotionBase(items, 'Plantillas');
  assert.deepEqual(
    filteredTemplates.map((x) => x.id),
    ['notion:tpl-phase1', 'notion:tpl-hash']
  );

  // 3. Vistas filter surfaces views without normal tasks or dropbox
  const filteredViews = notionFilters.filterByNotionBase(items, 'Vistas');
  assert.deepEqual(
    filteredViews.map((x) => x.id),
    ['notion:view-1']
  );

  // 4. advancedQuery matches `plantillas` and `vvist` tokens cleanly
  const aqTemplates = items.filter((x) => advancedQuery.matchesFlexibleOrQuotedQuery(x, 'plantillas'));
  assert.deepEqual(
    aqTemplates.map((x) => x.id),
    ['notion:tpl-phase1', 'notion:tpl-hash', 'dropbox:file-1']
  );
  const aqViews = items.filter((x) => advancedQuery.matchesFlexibleOrQuotedQuery(x, 'vvist'));
  assert.deepEqual(
    aqViews.map((x) => x.id),
    ['notion:view-1']
  );

  // 5. SOFTWARE label (not PROGRAMAS) + INGRESOS/EGRESOS labels, while preserving value='PROGRAMAS'
  const predictiveItems = [
    {
      id: 'prog-1',
      source: 'Notion',
      name: 'pprog 11 [11NOV] nneft anfeta.com Nueva pantalla',
      updateStatus: 'Por hacer',
    },
    {
      id: 'cobro-1',
      source: 'Notion',
      name: 'zcobrar 11 [11NOV] nneft anfeta.com Cobro mensual',
      updateStatus: 'Por hacer',
    },
    {
      id: 'pago-1',
      source: 'Notion',
      name: 'zpagar 11 [11NOV] nneft anfeta.com Pago servidor',
      updateStatus: 'Por hacer',
    },
  ];
  const suggestions = predictive.computeInlineSuggestions('11', predictiveItems, []);
  const typeSugs = suggestions.filter((s) => s.type === 'type');
  assert.equal(typeSugs.find((s) => s.value === 'PROGRAMAS')?.label, 'SOFTWARE');
  assert.equal(predictive.itemMatchesStructuredType(predictiveItems[0], 'SOFTWARE'), true);
  assert.equal(predictive.itemMatchesStructuredType(predictiveItems[0], 'PROGRAMAS'), true);

  const normalized = tabConfig.normalizeSearchTabConfig({
    activeCriteria: [
      { id: 'type_PROGRAMAS', type: 'type', value: 'PROGRAMAS', label: 'PROGRAMAS' },
      { id: 'type_COBROS', type: 'type', value: 'COBROS', label: 'COBROS' },
      { id: 'type_PAGOS', type: 'type', value: 'PAGOS', label: 'PAGOS' },
    ],
  });
  assert.deepEqual(
    normalized.activeCriteria.map((c) => c.label),
    ['SOFTWARE', 'INGRESOS', 'EGRESOS']
  );

  // 6. Template creation & activity creation WITHOUT assigned person ('Sin asignar' / '')
  const sourcePid = '33333333-3333-3333-3333-333333333333';
  const cleanSourcePid = sourcePid.replace(/-/g, '');
  const calls = [];
  const resJson = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  global.fetch = async (url, options = {}) => {
    const u = String(url);
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ url: u, method, body });

    if (u.includes('/users')) {
      throw new Error('Should NOT resolve Notion users when person is unassigned');
    }
    if ((u.endsWith('/pages/' + sourcePid) || u.endsWith('/pages/' + cleanSourcePid)) && method === 'GET') {
      return resJson({
        id: sourcePid,
        url: 'https://notion.so/' + sourcePid,
        parent: { database_id: '2eeabd7d91b781348ed5c537ec14962e' },
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Plantilla base', text: { content: 'Plantilla base' } }] },
          'Assignee/Ejecutor Principal': { type: 'people', people: [{ id: 'neft-id' }] },
          'Fecha POR Hacer': { type: 'date', date: null },
        },
      });
    }
    if (u.includes('/blocks/' + sourcePid + '/children') && method === 'GET') {
      return resJson({ results: [], has_more: false });
    }
    if (u.endsWith('/pages') && method === 'POST') {
      return resJson({
        id: '44444444-4444-4444-4444-444444444444',
        url: 'https://notion.so/44444444444444444444444444444444',
        properties: {
          Name: body.properties.Name || body.properties.Title,
          'Assignee/Ejecutor Principal': { type: 'people', people: [] },
          'Fecha POR Hacer': body.properties['Fecha POR Hacer'] || { type: 'date', date: null },
          Estado: body.properties.Estado || { type: 'status', status: { name: 'Por hacer' } },
        },
      });
    }
    if (u.includes('/databases/') || u.includes('/data_sources/')) {
      return resJson({
        id: '2eeabd7d91b781348ed5c537ec14962e',
        properties: {
          Name: { type: 'title', title: {} },
          'Assignee/Ejecutor Principal': { type: 'people', people: {} },
          'Fecha POR Hacer': { type: 'date', date: {} },
          Estado: { type: 'status', status: { options: [{ name: 'prtuzREVISION' }, { name: 'Por hacer' }] } },
        },
      });
    }
    if (u.endsWith('/query') && method === 'POST') {
      return resJson({ results: [], has_more: false });
    }
    return resJson({});
  };

  // Test create-from-template with "Sin asignar" AND without dates
  const postRes = await route.POST(
    new Request('http://localhost/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-from-template',
        payload: {
          currentUser: 'nneft',
          requests: [
            {
              sourcePageId: sourcePid,
              title: 'aaprtuzR Nueva plantilla libre',
              person: 'Sin asignar',
            },
            {
              sourcePageId: sourcePid,
              title: 'aaprtuzR Segunda plantilla libre',
              person: '',
            },
          ],
        },
      }),
    })
  );
  const postData = await postRes.json();
  assert.equal(postData.success, true, 'create-from-template should succeed without person: ' + postData.error);
  assert.equal(postData.count, 2);

  const createdCalls = calls.filter((c) => c.url.endsWith('/pages') && c.method === 'POST');
  assert.equal(createdCalls.length, 2);
  for (const c of createdCalls) {
    assert.deepEqual(c.body.properties['Assignee/Ejecutor Principal'], { people: [] });
  }

  // Test createActivity without person
  const createdUnassigned = await mutations.createActivity(settings, 'nneft', {
    title: 'Actividad operativa sin asignar',
    domain: 'anfeta.com',
    person: '',
    start: '2026-11-13T15:00:00-06:00',
    end: '2026-11-13T16:00:00-06:00',
    targetId: '2eeabd7d91b781348ed5c537ec14962e',
  });
  assert.ok(createdUnassigned.activity.pageId);
  assert.equal(createdUnassigned.activity.person, 'Sin asignar');
  const lastCreate = calls.filter((c) => c.url.endsWith('/pages') && c.method === 'POST').at(-1);
  assert.equal(lastCreate.body.properties['Assignee/Ejecutor Principal'], undefined);

  console.log('OK views, templates discovery, SOFTWARE/INGRESOS/EGRESOS labels, and unassigned creation verified');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
