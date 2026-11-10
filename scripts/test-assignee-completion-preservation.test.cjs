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

const pid = '11111111-1111-1111-1111-111111111111';
const settings = { notionToken: 'TEST_ONLY', currentUser: 'nneft' };

let state = {
  page: null,
  calls: [],
};

global.fetch = async (url, options = {}) => {
  const target = String(url).split('/v1/')[1];
  const method = options.method || 'GET';
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : undefined;
  state.calls.push({ target, method, body });

  if (target === 'pages/' + pid && method === 'GET') {
    return new Response(JSON.stringify(state.page), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (target === 'pages/' + pid && method === 'PATCH') {
    for (const [name, p] of Object.entries(body.properties || {})) {
      state.page.properties[name] = { type: Object.keys(p)[0], ...p };
    }
    return new Response(JSON.stringify(state.page), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (target.startsWith('blocks/' + pid + '/children')) {
    return new Response(JSON.stringify({ results: [], has_more: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (target.startsWith('data_sources/') && method === 'GET') {
    return new Response(
      JSON.stringify({
        properties: {
          Name: { type: 'title' },
          'Assignee/Ejecutor Principal': { type: 'people' },
          'Fecha POR Hacer': { type: 'date' },
          '(bien) Estado opcion multiple revisiones': {
            type: 'status',
            status: {
              options: [
                { name: 'PRTUZ POR HACER' },
                { name: 'REVISAR REVISIONES rrevi' },
                { name: 'TUZ - TERMINADO REVISION' },
                { name: 'TERMINADO REV COBRO/DOCUMENTACION' },
              ],
            },
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (target.startsWith('users?')) {
    return new Response(
      JSON.stringify({
        results: [
          { id: 'neft-id', type: 'person', name: 'Neftali', person: { email: 'nnetf@practicante.com' } },
          { id: 'edwin-id', type: 'person', name: 'Edwin', person: { email: 'eedwi@practicante.com' } },
          { id: 'john-id', type: 'person', name: 'John', person: { email: 'jjohn@pprin.com' } },
        ],
        has_more: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ results: [], has_more: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const mutations = require(root + '/src/services/notionMutations.ts');

async function runTests() {
  console.log('=== TEST: Assignee Preservation on Completion ===\n');

  // Case 1: The exact case from user screenshot - Neftali activity with rrecu nne11
  // Even if previousFlow had OriginalPerson = 'Sin asignar', Assignee MUST NOT be emptied!
  process.env.NOTION_PERSON_IDS = JSON.stringify({ Neftali: 'neft-id', Edwin: 'edwin-id', John: 'john-id' });
  state.page = {
    id: pid,
    url: 'https://notion.so/' + pid,
    parent: { data_source_id: 'source' },
    last_edited_time: '2026-11-03T10:00:00Z',
    properties: {
      Name: {
        type: 'title',
        title: [
          {
            text: {
              content:
                'tuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web RECURRENTE ASISTENTE Mejoras a implementar Fase-36 Mejoras web ANFETA rrecu nne11',
            },
          },
        ],
      },
      'Assignee/Ejecutor Principal': {
        type: 'people',
        people: [{ id: 'john-id', name: 'John' }], // Was in review by John
      },
      'Fecha POR Hacer': {
        type: 'date',
        date: { start: '2026-11-03T10:00:00-06:00', end: '2026-11-03T11:00:00-06:00' },
      },
      '(bien) Estado opcion multiple revisiones': {
        type: 'status',
        status: { name: 'REVISAR REVISIONES rrevi' },
      },
      Locked: { type: 'checkbox', checkbox: false },
    },
  };

  const completedPage = await mutations.mutateActivity(settings, 'jjohn', pid, {
    status: 'TUZ - TERMINADO REVISION',
  });

  assert.ok(
    completedPage.properties['Assignee/Ejecutor Principal'].people.length > 0,
    'Assignee MUST NOT be empty when activity is completed!'
  );
  assert.equal(
    completedPage.properties['Assignee/Ejecutor Principal'].people[0].id,
    'neft-id',
    'Assignee must resolve to the real executor (Neftali) from nne11!'
  );
  const finalTitle = completedPage.properties.Name.title[0].text.content;
  assert.match(finalTitle, /\b(nne11|ne11)\b/, 'Completed title must preserve last active/reference tag ne11/nne11!');
  console.log('OK Case 1: Neftali task completed preserves ne11/nne11 tag and Assignee (neft-id) without emptying.');

  // Case 2: Edwin activity with eed11
  state.page.properties.Name.title[0].text.content =
    'rtuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web Edwin feature rrecu eed11';
  state.page.properties['Assignee/Ejecutor Principal'].people = [{ id: 'john-id', name: 'John' }];
  const edwinPage = await mutations.mutateActivity(settings, 'jjohn', pid, {
    status: 'TUZ - TERMINADO REVISION',
  });

  assert.ok(
    edwinPage.properties['Assignee/Ejecutor Principal'].people.length > 0,
    'Assignee MUST NOT be empty for Edwin!'
  );
  assert.equal(
    edwinPage.properties['Assignee/Ejecutor Principal'].people[0].id,
    'edwin-id',
    'Assignee must resolve to Edwin from eed11 tag!'
  );
  const edwinTitle = edwinPage.properties.Name.title[0].text.content;
  assert.match(edwinTitle, /\b(eed11|ed11)\b/, 'Completed title must preserve Edwin active/reference tag ed11/eed11!');
  console.log('OK Case 2: Edwin task completed preserves ed11/eed11 tag and Assignee (edwin-id) without emptying.');

  console.log('\nALL ASSIGNEE PRESERVATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
