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
        },
      }).outputText,
      file
    );
}

const {
  extractNotionPageId,
  buildJournalToggleBlock,
  buildFtfScoreEmailHtml,
} = require('../src/services/ftfScoreDelivery.ts');
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

console.log('OK ftfScoreDelivery (Journal toggle + Email HTML) and pendingAlerts tests passed.');
