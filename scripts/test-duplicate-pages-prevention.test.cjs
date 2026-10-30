const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (m, p) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(p, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
      }).outputText,
      p
    );
}

// 1. Test retainSearchResults
const { retainSearchResults } = require('../src/lib/retainSearchResults.ts');

const uuidWithDashes = '3e3abd7d-91b7-81e9-8d2f-fd0b013b43cf';
const uuidWithoutDashes = '3e3abd7d91b781e98d2ffd0b013b43cf';
const mirrorId = 'review-mirror-3e3abd7d-91b7-81e9-8d2f-fd0b013b43cf';

// Test 1: Deduplication of dashes vs no-dashes
const prev = [
  { id: uuidWithDashes, externalId: uuidWithDashes, source: 'Notion', name: 'Task Original', serverModified: '2026-10-30T10:00:00Z' }
];
const freshWithoutDashes = [
  { id: uuidWithoutDashes, externalId: uuidWithoutDashes, source: 'Notion', name: 'Task Updated', serverModified: '2026-10-30T12:00:00Z' }
];

const merged = retainSearchResults(prev, { items: freshWithoutDashes, loadingIndex: true });
assert.equal(merged.length, 1, 'Should deduplicate item regardless of dashes in UUID');
assert.equal(merged[0].name, 'Task Updated', 'Should retain latest data for the same canonical item');

// Test 2: Rejection of review mirrors
const mirrorItem = {
  id: mirrorId,
  externalId: mirrorId,
  isReviewMirror: true,
  source: 'Notion',
  name: '[COPIA REVISION] Task Original'
};
const mergedWithMirror = retainSearchResults(prev, { items: [mirrorItem], loadingIndex: true });
assert.equal(mergedWithMirror.length, 1, 'Should never retain review mirrors as duplicate search rows');
assert.equal(mergedWithMirror[0].isReviewMirror, undefined, 'Original item is preserved');

// Test 3: Deduplication within data.items when index is fresh
const duplicateIncoming = [
  { id: uuidWithDashes, externalId: uuidWithDashes, source: 'Notion', name: 'Task 1' },
  { id: uuidWithoutDashes, externalId: uuidWithoutDashes, source: 'Notion', name: 'Task 1' },
  { id: '11111111-2222-3333-4444-555566667777', source: 'Notion', name: 'Task 2' }
];
const freshResult = retainSearchResults([], { items: duplicateIncoming });
assert.equal(freshResult.length, 2, 'Fresh load should deduplicate incoming duplicate rows with same identity');

// 2. Test uniqueIndex from notionIndexParity
const { uniqueIndex } = require('../src/services/notionIndexParity.ts');
const uniqueOutput = uniqueIndex([
  { id: uuidWithDashes, externalId: uuidWithDashes, source: 'Notion', name: 'Task' },
  { id: uuidWithoutDashes, externalId: uuidWithoutDashes, source: 'Notion', name: 'Task' },
  { id: mirrorId, externalId: mirrorId, isReviewMirror: true, source: 'Notion', name: 'Mirror' },
  { id: 'idx-1', externalId: 'idx-1', source: 'Dropbox', path: '/docs/doc1.pdf', name: 'Doc 1' }
]);
assert.equal(uniqueOutput.length, 2, 'uniqueIndex should exclude mirrors and deduplicate Notion items');

console.log('OK All duplicate page prevention tests passed successfully.');
