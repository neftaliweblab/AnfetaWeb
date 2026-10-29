const fs = require('fs'), path = require('path'), Module = require('module'), assert = require('assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '..'), resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (m, p) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(p, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText,
      p
    );
}

// Mock notionCalendar and notionRequest for mutateCalendarActivity
let patchedPage = null;
let savedFlow = null;
const load = Module._load;
Module._load = function (n, p, ...r) {
  if (p?.filename.endsWith('notionMutations.ts')) {
    if (n === './notionCalendar') {
      return {
        resolveTeamPersonId: async () => 'user-123',
        clearReadBlocksCache: () => {},
        calendarStatusField: (page) => ['Estado', page.properties.Estado],
        assignedField: (page) => ['Responsable', page.properties.Responsable],
        assignedPerson: (page, fallback) => fallback || 'Neftali',
        readReviewFlow: async () => ({
          State: 'pending',
          ReviewAssignee: 'Acalli',
          OriginalPerson: 'Neftali',
          UpdatedAt: '2026-10-29T10:00:00Z',
          Round: 1,
        }),
        saveReviewFlow: async (_settings, _id, flow) => { savedFlow = flow; },
        cacheReviewFlowMemory: () => {},
        clearReviewFlowMemory: () => {},
        sendReviewNotification: async () => ({ PageId: 'alert-1', PageUrl: 'https://notion.so/alert-1' }),
        queryCalendarPages: async () => [],
      };
    }
  }
  return load.call(this, n, p, ...r);
};

const { mutateActivity } = require('../src/services/notionMutations.ts');

(async () => {
  // Case 1: The page in Notion is "POR HACER" (prtuzR). Even though previousFlow was with Acalli,
  // Neftali sending it back to Acalli must SUCCEED!
  const pendingPage = {
    id: '12345678123412341234123456789abc',
    url: 'https://notion.so/page-123',
    properties: {
      Nombre: { type: 'title', title: [{ type: 'text', text: { content: 'prtuzR aapli 26-[10OCT] d.anfeta.com.web Tarea nne11' } }] },
      Estado: { type: 'select', select: { name: 'POR HACER' } },
      Responsable: { type: 'people', people: [{ id: 'user-neftali' }] },
      'Fecha por hacer': { type: 'date', date: { start: '2026-10-29T11:00:00-06:00', end: '2026-10-29T12:00:00-06:00' } },
    },
  };

  // Mock global fetch / notionRequest via global
  const okJson = (obj) => ({
    ok: true,
    status: 200,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
  });

  global.fetch = async (url, opts) => {
    if (url.includes('/users')) return okJson({ results: [{ type: 'person', name: 'Acalli', id: 'user-acalli' }] });
    if (url.includes('/pages/12345678123412341234123456789abc')) {
      if (opts?.method === 'PATCH') {
        patchedPage = JSON.parse(opts.body);
        return okJson({ id: pendingPage.id, properties: pendingPage.properties, last_edited_time: new Date().toISOString() });
      }
      return okJson(pendingPage);
    }
    if (url.includes('/databases') || url.includes('/data_sources')) {
      return okJson({ properties: { Estado: { select: { options: [{ name: 'POR HACER' }, { name: 'rtuzREVISION' }] } } } });
    }
    return okJson({});
  };

  // Should succeed:
  const res = await mutateActivity({ notionToken: 'test' }, 'Neftali', pendingPage.id, {
    reviewer: 'Acalli',
    status: 'rtuzREVISION',
  });
  assert.ok(res, 'Mutation returned response');
  assert.equal(savedFlow.State, 'pending');
  assert.equal(savedFlow.ReviewAssignee, 'Acalli');
  assert.equal(savedFlow.OriginalPerson, 'Neftali');
  assert.equal(savedFlow.Round, 2, 'Round incremented');
  console.log('OK Case 1: Pending activity with old flow correctly sent to review without false rejection.');

  // Case 2: The page in Notion IS currently in review with Acalli (title rtuzREVISION, status rtuzREVISION).
  // Trying to send to Acalli again SHOULD throw "La actividad ya está en revisión con este compañero."
  const reviewPage = {
    id: '12345678123412341234123456789abc',
    url: 'https://notion.so/page-123',
    properties: {
      Nombre: { type: 'title', title: [{ type: 'text', text: { content: 'rtuzREVISION aapli 26-[10OCT] d.anfeta.com.web Tarea ne11 aacal000' } }] },
      Estado: { type: 'select', select: { name: 'rtuzREVISION' } },
      Responsable: { type: 'people', people: [{ id: 'user-acalli' }] },
      'Fecha por hacer': { type: 'date', date: { start: '2026-10-29T11:00:00-06:00', end: '2026-10-29T12:00:00-06:00' } },
    },
  };

  global.fetch = async (url, opts) => {
    if (url.includes('/pages/12345678123412341234123456789abc')) {
      return okJson(reviewPage);
    }
    return okJson({});
  };

  await assert.rejects(
    () => mutateActivity({ notionToken: 'test' }, 'Neftali', reviewPage.id, { reviewer: 'Acalli', status: 'rtuzREVISION' }),
    /La actividad ya está en revisión con este compañero/
  );
  console.log('OK Case 2: Activity genuinely in review still rejects redundant re-submission.');

  console.log('ALL TESTS PASSED!');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
