const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const ts = require('typescript');
const Module = require('module');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(__dirname, '../src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (m, file) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      file
    );
}

const {
  extractNotionPageId,
  buildJournalToggleBlock,
  buildFtfScoreEmailHtml,
  buildWeeklyFtfEmailHtml,
} = require('../src/services/ftfScoreDelivery.ts');
const { mergeWeeklyReportScores, buildWeeklyPayrollMatrix } = require('../src/services/ftfScoring.ts');
const {
  isReviewOrSentPending,
  isVideoPendingTask,
  buildQuickPendingFromActivity,
} = require('../src/lib/pendingAlerts.ts');

// 1. Notion Page ID extraction (full URL, dashed UUID, 32-char compact UUID)
assert.equal(
  extractNotionPageId('https://www.notion.so/anfeta/Journal-FTF-2eeabd7d91b78193a131000b08cd54e2?pvs=4'),
  '2eeabd7d-91b7-8193-a131-000b08cd54e2'
);
assert.equal(
  extractNotionPageId('2EEABD7D-91B7-8193-A131-000B08CD54E2'),
  '2eeabd7d-91b7-8193-a131-000b08cd54e2'
);
assert.equal(extractNotionPageId('not-a-notion-page'), '');

// 2. Notion Journal daily toggle block builder
const entries = [
  {
    person: 'Neftali',
    date: '2026-11-13',
    finalScore: 92,
    stars: 5,
    assignedHours: 7,
    completedHours: 6.5,
    ftfCount: 2,
    ftfBlockCompletedAt: '2026-11-13T09:15:00-06:00',
  },
  {
    person: 'Acalli',
    date: '2026-11-13',
    finalScore: 76,
    stars: 4,
    assignedHours: 6,
    completedHours: 4.5,
    ftfCount: 1,
  },
];
const toggle = buildJournalToggleBlock('2026-11-13', entries, 'Neftali', '2026-11-13T18:30:00-06:00');
assert.equal(toggle.type, 'toggle');
assert.ok(toggle.toggle.rich_text[0].text.content.includes('2026-11-13'));
assert.equal(toggle.toggle.children.length, 3); // meta paragraph + 2 bulleted_list_item rows
assert.ok(toggle.toggle.children[1].bulleted_list_item.rich_text[0].text.content.includes('Neftali: 92/100'));
assert.ok(toggle.toggle.children[1].bulleted_list_item.rich_text[0].text.content.includes('FTF terminado 09:15'));
assert.ok(toggle.toggle.children[2].bulleted_list_item.rich_text[0].text.content.includes('FTF diario sin palomear'));

// 3. Score Email HTML table
const html = buildFtfScoreEmailHtml('2026-11-13', entries, 'Neftali', '2026-11-13T18:30:00-06:00');
assert.ok(html.includes('Neftali'));
assert.ok(html.includes('92/100'));
assert.ok(html.includes('✓ 09:15'));
assert.ok(html.includes('Acalli'));

// 4. Quick Pending builder for floating Video / Review tasks
const videoPending = buildQuickPendingFromActivity({
  pageId: 'page-vid-123',
  pageUrl: 'https://www.notion.so/pagevid123',
  title: 'anfeta.com Grabacion demo',
  assignedTo: 'Acalli',
  assignedBy: 'Neftali',
  scheduledDate: '2026-11-13',
  domain: 'anfeta.com',
  isVideoTask: true,
  needsReview: true,
});
assert.equal(videoPending.id, 'act-pending-page-vid-123');
assert.equal(videoPending.assignedTo, 'Acalli');
assert.equal(videoPending.assignedBy, 'Neftali');
assert.equal(videoPending.isVideoTask, true);
assert.equal(videoPending.needsReview, true);
assert.equal(videoPending.isReviewNotice, true);
assert.equal(isVideoPendingTask(videoPending), true);
assert.equal(isReviewOrSentPending(videoPending), true);

const regularTask = {
  id: 'task-plain',
  title: 'Revisar facturas',
  query: 'facturas',
  scheduledDate: '2026-11-13',
  isCompleted: false,
};
assert.equal(isVideoPendingTask(regularTask), false);
assert.equal(isReviewOrSentPending(regularTask), false);

// 5. Weekly FTF Email HTML & closed-day absence merging
const weekDates = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
const weekReportDays = [
  {
    day: '2026-11-09',
    people: [
      { name: 'Neftali', firstSeen: '2026-11-09T10:00:00-06:00', assignedHours: 7, completedHours: 7, inProgressHours: 0, expiredUnfinishedCount: 0, verified: 0, total: 3, pendingAssignmentMinutes: 0, workdayHours: 8 },
      { name: 'Edwin', firstSeen: null, lastSeen: null, assignedHours: 0, completedHours: 0, verified: 0, total: 0, workdayHours: 8 },
    ],
  },
];
const mergedWeek = mergeWeeklyReportScores(weekReportDays, weekDates, {}, '2026-11-15', 14 * 60);
assert.equal(mergedWeek['2026-11-09'].Neftali.finalScore, 100);
assert.equal(mergedWeek['2026-11-09'].Edwin.absent, true);
assert.equal(mergedWeek['2026-11-09'].Edwin.finalScore, 0);

const weeklyMatrix = buildWeeklyPayrollMatrix(weekDates, ['Neftali', 'Edwin'], mergedWeek);
const weeklyHtml = buildWeeklyFtfEmailHtml({
  weekStart: '2026-11-09',
  weekEnd: '2026-11-13',
  weekDates,
  matrix: weeklyMatrix,
  generatedAt: '2026-11-13T18:30:00-06:00',
  reportUrl: 'https://anfeta-web-iota.vercel.app/?ftf=week',
});
assert.ok(weeklyHtml.includes('Neftali'));
assert.ok(weeklyHtml.includes('100/100'));
assert.ok(weeklyHtml.includes('Falta 0'));
assert.ok(weeklyHtml.includes('https://anfeta-web-iota.vercel.app/?ftf=week'));

// 6. Weekly cron auth guard
(async () => {
  const prevSecret = process.env.CRON_SECRET;
  try {
    const { GET } = require('../src/app/api/jobs/ftf-weekly/route.ts');
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new Request('http://localhost/api/jobs/ftf-weekly'))).status, 503);
    process.env.CRON_SECRET = 'test-weekly-cron-secret-32-chars-ok';
    assert.equal((await GET(new Request('http://localhost/api/jobs/ftf-weekly'))).status, 401);
    console.log('OK ftfScoreDelivery (Journal toggle + Email HTML + Weekly Matrix + Weekly Cron auth) and pendingAlerts tests passed.');
  } finally {
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
