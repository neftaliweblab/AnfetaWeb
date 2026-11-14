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

const pid = '33333333-3333-3333-3333-333333333333';
const overlapId = '44444444-4444-4444-4444-444444444444';
const settings = { notionToken: 'TEST_ONLY', currentUser: 'nneft' };

const origLoad = Module._load;
Module._load = function (name, parent, ...rest) {
  if (name === 'next/server') {
    const actual = origLoad.call(this, name, parent, ...rest);
    return { ...actual, after: () => {} };
  }
  if (name === '@/services/serverAuth' && parent?.filename.replace(/\\/g, '/').endsWith('/src/app/api/data/route.ts')) {
    return { requireActor: (req) => req.headers.get('x-test-user') || 'nneft', assertSameOrigin: () => {} };
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

const { dailyChecklist } = require(root + '/src/lib/dailyChecklist.ts');
const { executiveActivities, computeDailyKPIs, currentActivityRatio } = require(root + '/src/services/progressKpis.ts');
const { buildFtfDashboard } = require(root + '/src/services/ftfDashboard.ts');
const { computeHybridFtfScore } = require(root + '/src/services/ftfScoring.ts');
const { isActivityLocked, canEditActivity } = require(root + '/src/services/activityPermissions.ts');
const { readDailySnapshotMirrors } = require(root + '/src/services/checklistPlanning.ts');
const { normalizeActivity } = require(root + '/src/services/dataNormalizers.ts');
const route = require(root + '/src/app/api/data/route.ts');

let state;
function makePageFixture() {
  return {
    id: pid,
    url: 'https://notion.so/' + pid,
    parent: { data_source_id: 'source' },
    last_edited_time: '2026-11-13T16:00:00Z',
    properties: {
      Name: {
        type: 'title',
        title: [
          {
            plain_text: 'prtuzREVISION sseo 11-[0930] nneft cerrajeriasmonterrey.com SEO Optimización Técnica',
            text: { content: 'prtuzREVISION sseo 11-[0930] nneft cerrajeriasmonterrey.com SEO Optimización Técnica' },
          },
        ],
      },
      'Assignee/Ejecutor Principal': {
        type: 'people',
        people: [{ id: 'neft-id', name: 'Neftalí', person: { email: 'nneft@practicante.com' } }],
      },
      'Fecha POR Hacer': {
        type: 'date',
        date: { start: '2026-11-13T09:30:00-06:00', end: '2026-11-13T14:30:00-06:00' },
      },
      Estado: { type: 'status', status: { name: 'PRTUZ POR HACER' } },
      Locked: { type: 'checkbox', checkbox: false },
    },
  };
}

function makeOverlapPageFixture() {
  return {
    id: overlapId,
    url: 'https://notion.so/' + overlapId,
    parent: { data_source_id: 'source' },
    last_edited_time: '2026-11-15T10:00:00Z',
    properties: {
      Name: {
        type: 'title',
        title: [{ plain_text: 'prtuzREVISION web 12-[1000] nneft otraweb.com Empalme', text: { content: 'prtuzREVISION web 12-[1000] nneft otraweb.com Empalme' } }],
      },
      'Assignee/Ejecutor Principal': {
        type: 'people',
        people: [{ id: 'neft-id', name: 'Neftalí', person: { email: 'nneft@practicante.com' } }],
      },
      'Fecha POR Hacer': {
        type: 'date',
        date: { start: '2026-11-15T10:00:00-06:00', end: '2026-11-15T12:00:00-06:00' },
      },
      Estado: { type: 'status', status: { name: 'PRTUZ POR HACER' } },
      Locked: { type: 'checkbox', checkbox: false },
    },
  };
}

function reset() {
  settings.notionToken = 'TEST_ONLY_' + Math.random().toString(36).slice(2);
  process.env.NOTION_TOKEN = settings.notionToken;
  state = {
    page: makePageFixture(),
    overlapPage: makeOverlapPageFixture(),
    todos: [
      { id: 'todo-11111111111111111111111111111111', checked: false, text: 'Descripción de los servicios disponibles' },
      { id: 'todo-22222222222222222222222222222222', checked: false, text: 'Apertura de autos y recuperación de llaves' },
      { id: 'todo-33333333333333333333333333333333', checked: false, text: 'Instalación y cambio de cerraduras' },
    ],
  };
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

global.fetch = async (url, options = {}) => {
  const target = String(url).split('/v1/')[1].replace(pid.replace(/-/g, ''), pid).replace(overlapId.replace(/-/g, ''), overlapId);
  const method = options.method || 'GET';
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : undefined;

  if (target === 'pages/' + pid && method === 'GET') return response(state.page);
  if (target === 'pages/' + pid && method === 'PATCH') {
    for (const [name, p] of Object.entries(body.properties || {})) {
      const prop = { type: Object.keys(p)[0], ...p };
      state.page.properties[name] = prop;
    }
    state.page.last_edited_time = new Date().toISOString();
    return response(state.page);
  }
  if (target.startsWith('data_sources/') && method === 'GET') {
    return response({
      properties: {
        Name: { type: 'title' },
        'Assignee/Ejecutor Principal': { type: 'people' },
        'Fecha POR Hacer': { type: 'date' },
        Estado: {
          type: 'status',
          status: { options: [{ name: 'PRTUZ POR HACER' }, { name: 'rtuzREVISION' }, { name: 'zREVISION' }] },
        },
      },
    });
  }
  if (target.endsWith('/query') && method === 'POST') {
    // Filter pages by date filter if checking target date range
    const serialized = JSON.stringify(body?.filter || {});
    const pageStart = state.page.properties['Fecha POR Hacer'].date.start.slice(0, 10);
    const list = [state.overlapPage];
    if (!serialized.includes('2026-11-13') || pageStart === '2026-11-13') {
      if (!serialized.includes('before":"2026-11-14') || pageStart < '2026-11-14') {
        list.unshift(state.page);
      }
    }
    return response({ results: list.filter((p) => {
      const d = p.properties['Fecha POR Hacer'].date.start.slice(0, 10);
      if (serialized.includes('2026-11-13') && serialized.includes('2026-11-14') && d === '2026-11-15') return false;
      return true;
    }), has_more: false });
  }
  if (target.startsWith('blocks/' + pid + '/children') && method === 'GET') {
    return response({
      results: state.todos.map((t) => ({
        id: t.id,
        type: 'to_do',
        created_time: '2026-11-12T10:00:00Z',
        last_edited_time: '2026-11-12T10:00:00Z',
        to_do: { checked: t.checked, rich_text: [{ plain_text: t.text }] },
      })),
      has_more: false,
    });
  }
  if (target.startsWith('blocks/' + overlapId + '/children') && method === 'GET') {
    return response({ results: [], has_more: false });
  }
  if (target.startsWith('blocks/') && method === 'PATCH') {
    const bid = target.split('/')[1];
    const todo = state.todos.find((t) => t.id.replace(/-/g, '') === bid.replace(/-/g, ''));
    if (!todo) return response({ message: 'Block not found' }, 404);
    todo.checked = Boolean(body?.to_do?.checked);
    todo.last_edited_time = new Date().toISOString();
    return response({ id: todo.id, last_edited_time: todo.last_edited_time, to_do: { checked: todo.checked } });
  }
  if (target.startsWith('users?')) {
    return response({ results: [{ id: 'neft-id', type: 'person', name: 'Neftalí', person: { email: 'nneft@practicante.com' } }], has_more: false });
  }
  throw Error('Unexpected mock Notion request: ' + method + ' ' + target);
};

const postAction = (action, payload) =>
  new Request('http://localhost/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user': payload?.currentUser || 'nneft' },
    body: JSON.stringify({ action, payload }),
  });

const getQuery = (qs) =>
  new Request('http://localhost/api/data?' + qs, {
    method: 'GET',
    headers: { 'x-test-user': 'John' },
  });

let passed = 0;
async function test(name, fn) {
  reset();
  await fn();
  passed++;
  console.log('OK ' + name);
}

(async () => {
  await test('dailyChecklist calcula Meta de hoy, completedForDay, checks futuros y fecha próxima', async () => {
    const summary = dailyChecklist(
      [
        { blockId: 'a', isChecked: true, plannedDate: '2026-11-13' },
        { blockId: 'b', isChecked: true, plannedDate: '2026-11-13' },
        { blockId: 'c', isChecked: false, plannedDate: '2026-11-16' },
        { blockId: 'd', isChecked: false },
      ],
      '2026-11-13'
    );
    assert.equal(summary.hasDailyPlan, true);
    assert.equal(summary.plannedTotal, 2);
    assert.equal(summary.plannedDone, 2);
    assert.equal(summary.completedForDay, true);
    assert.equal(summary.pendingFutureCount, 2);
    assert.equal(summary.pendingCheckValidation, true);
    assert.equal(summary.nextPlannedDate, '2026-11-16');
  });

  await test('FTF y KPIs cuentan completedForDay/isDaySnapshot al 100% con advertencia hasta terminar todo', async () => {
    const snap = normalizeActivity(
      {
        pageId: 'day-snapshot-2026-11-13-' + pid,
        originalPageId: pid,
        title: 'SEO Optimización Técnica',
        person: 'Neftali',
        status: 'PRTUZ POR HACER',
        start: '2026-11-13T09:30:00-06:00',
        end: '2026-11-13T14:30:00-06:00',
        isReviewMirror: true,
        isDaySnapshot: true,
        isLocked: true,
        completedForDay: true,
        pendingFutureChecksCount: 2,
        pendingCheckValidation: true,
        checklistTotal: 1,
        checklistCompleted: 1,
      },
      0
    );
    assert.equal(isActivityLocked(snap), true);
    assert.equal(canEditActivity('John', snap), false);

    const exec = executiveActivities([snap], '2026-11-13');
    assert.equal(exec.length, 1);
    assert.equal(currentActivityRatio(snap, '2026-11-13'), 1);
    const kpis = computeDailyKPIs([snap], '2026-11-13');
    assert.equal(kpis.coveragePercentage, 100);
    assert.equal(kpis.currentProgressPercentage, 100);
    assert.equal(kpis.completedCount, 1);
    assert.equal(kpis.laggingCount, 0);

    const dashboard = buildFtfDashboard('John', '2026-11-13', [{ name: 'Neftali' }], [snap], {});
    const row = dashboard.people.find((p) => p.name === 'Neftali');
    assert.equal(row.completedHours, 5);
    assert.equal(row.pendingCheckValidationCount, 1);

    const score = computeHybridFtfScore(
      {
        name: 'Neftali',
        assignedHours: 5,
        completedHours: 5,
        inProgressCount: 0,
        expiredUnfinishedCount: 0,
        verified: 1,
        total: 1,
        status: 'complete',
        pendingCheckValidationCount: row.pendingCheckValidationCount,
        pendingCheckValidationSummary: row.pendingCheckValidationSummary,
      },
      '2026-11-13'
    );
    assert.equal(score.pendingCheckValidationCount, 1);
    assert.ok(score.finalScore >= 75);
  });

  await test('plan-checklist-item + complete-day-and-advance mueve preservando horario, permite empalme y deja copia visual', async () => {
    // 1. Planear todo-1 para hoy (2026-11-13) y todo-3 para el 2026-11-15
    let res = await route.POST(
      postAction('plan-checklist-item', {
        pageId: pid,
        blockId: state.todos[0].id,
        plannedDate: '2026-11-13',
        workDate: '2026-11-13',
      })
    );
    let data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.stats.completedForDay, false);

    res = await route.POST(
      postAction('plan-checklist-item', {
        pageId: pid,
        blockId: state.todos[2].id,
        plannedDate: '2026-11-15',
        workDate: '2026-11-13',
      })
    );
    data = await res.json();
    assert.equal(res.status, 200);

    // 2. Marcar todo-1 completado
    res = await route.POST(
      postAction('toggle-checklist', {
        pageId: pid,
        blockId: state.todos[0].id,
        checked: true,
        workDate: '2026-11-13',
      })
    );
    data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.stats.completedForDay, true);
    assert.equal(data.stats.pendingCheckValidation, true);
    assert.equal(data.stats.pendingFutureChecksCount, 2);
    assert.equal(data.stats.nextPlannedChecklistDate, '2026-11-15');

    // 3. Guardar fase del día y avanzar a 2026-11-15 (incluso empalmando con otraweb.com 10:00-12:00)
    res = await route.POST(
      postAction('complete-day-and-advance', {
        pageId: pid,
        workDate: '2026-11-13',
      })
    );
    data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.targetDate, '2026-11-15');
    assert.equal(data.movedActivity.start, '2026-11-15T09:30:00-06:00');
    assert.equal(data.movedActivity.end, '2026-11-15T14:30:00-06:00');
    assert.equal(data.snapshotActivity.isDaySnapshot, true);
    assert.equal(data.snapshotActivity.isLocked, true);
    assert.equal(data.snapshotActivity.pendingCheckValidation, true);

    // 4. GET ?type=calendar del 2026-11-13 conserva la copia visual congelada aunque la real se movió al 15
    res = await route.GET(getQuery('type=calendar&date=2026-11-13&scope=day'));
    data = await res.json();
    assert.equal(res.status, 200);
    const frozen = data.activities.find((a) => a.isDaySnapshot);
    assert.ok(frozen, 'Debe existir la copia visual congelada en 2026-11-13');
    assert.equal(frozen.start, '2026-11-13T09:30:00-06:00');
    assert.equal(frozen.pendingCheckValidation, true);

    // 5. Al completar el 100% de checks en la actividad viva en Notion, se limpia la advertencia automáticamente
    await route.POST(
      postAction('toggle-checklist', { pageId: pid, blockId: state.todos[1].id, checked: true, workDate: '2026-11-15' })
    );
    await route.POST(
      postAction('toggle-checklist', { pageId: pid, blockId: state.todos[2].id, checked: true, workDate: '2026-11-15' })
    );
    res = await route.GET(getQuery('type=calendar&date=2026-11-13&scope=week'));
    data = await res.json();
    assert.equal(res.status, 200);
    const cleared = data.activities.find((a) => a.isDaySnapshot);
    assert.ok(cleared, 'Debe seguir existiendo la copia visual congelada tras completar todo en Notion');
    assert.equal(cleared.pendingCheckValidation, false);
    assert.equal(cleared.pendingFutureChecksCount, 0);
  });

  console.log(`\nPassed ${passed}/3 daily checklist planning tests.`);
})();
