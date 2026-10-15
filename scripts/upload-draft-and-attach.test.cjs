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
require.extensions['.ts'] = (m, p) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(p, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      }
    }).outputText,
    p
  );

// 1. Test getUploadDraftStatus and summarizeDraftProgress
const { getUploadDraftStatus, summarizeDraftProgress } = require('../src/lib/uploadDraft.ts');

const emptyDraft = {
  id: 'd1',
  owner: 'Neftali',
  plan: { title: 'Borrador vacío', files: [] },
  receipts: [],
  started: false,
  updatedAt: Date.now()
};
assert.equal(getUploadDraftStatus(emptyDraft), 'empty_draft');
let summary = summarizeDraftProgress(emptyDraft);
assert.equal(summary.status, 'empty_draft');
assert.equal(summary.totalFiles, 0);
assert.equal(summary.uploadedFiles, 0);

const unconfirmedDraft = {
  id: 'd2',
  owner: 'Neftali',
  plan: { title: 'Iniciado sin confirmación', files: [{ filename: 'v.mp4', sizeBytes: 1000 }] },
  receipts: [],
  started: true,
  updatedAt: Date.now()
};
assert.equal(getUploadDraftStatus(unconfirmedDraft), 'unconfirmed_started');
summary = summarizeDraftProgress(unconfirmedDraft);
assert.equal(summary.status, 'unconfirmed_started');
assert.equal(summary.totalFiles, 1);
assert.equal(summary.uploadedFiles, 0);

const partialDraft = {
  id: 'd3',
  owner: 'Neftali',
  plan: {
    mode: 'both',
    title: 'Parcial',
    files: [
      { filename: 'v1.mp4', sizeBytes: 1000, cloudReceipt: 'c1' },
      { filename: 'v2.mp4', sizeBytes: 1000 }
    ]
  },
  receipts: [{ kind: 'dropbox', path: '/DRX/test/v1.mp4' }],
  started: true,
  updatedAt: Date.now()
};
assert.equal(getUploadDraftStatus(partialDraft), 'partial');
summary = summarizeDraftProgress(partialDraft);
assert.equal(summary.status, 'partial');
assert.equal(summary.totalFiles, 2);
assert.equal(summary.uploadedFiles, 1);
assert.equal(summary.confirmedReceipts, 1);

const completedDraft = {
  id: 'd4',
  owner: 'Neftali',
  plan: {
    mode: 'both',
    title: 'Completado',
    files: [{ filename: 'v1.mp4', sizeBytes: 1000, cloudReceipt: 'c1' }]
  },
  receipts: [
    { kind: 'dropbox', path: '/DRX/test/v1.mp4' },
    { kind: 'notion', pageId: 'page-1' }
  ],
  started: true,
  updatedAt: Date.now()
};
assert.equal(getUploadDraftStatus(completedDraft), 'completed');
const separated={id:'separated',owner:'Neftali',started:true,updatedAt:Date.now(),plan:{mode:'notion',separatePages:true,files:[{filename:'one.webm'},{filename:'two.webm'}]},receipts:[{kind:'notion',pageId:'one'}]};
assert.equal(getUploadDraftStatus(separated),'partial');
assert.equal(getUploadDraftStatus({...separated,receipts:[...separated.receipts,{kind:'event',pageId:'event'}]}),'partial');
assert.equal(getUploadDraftStatus({...separated,receipts:[...separated.receipts,{kind:'notion',pageId:'two'}]}),'completed');

// 2. Test SSRF URL validation in Notion template body
const { validateNotionInternalUrl } = require('../src/services/notionTemplateBody.ts');

assert.doesNotThrow(() => validateNotionInternalUrl('https://prod-files-secure.s3.us-west-2.amazonaws.com/test-uuid/img.png'));
assert.doesNotThrow(() => validateNotionInternalUrl('https://file.notion.so/f/f/test.jpg'));
assert.doesNotThrow(() => validateNotionInternalUrl('https://s3.us-west-2.amazonaws.com/test'));

assert.throws(() => validateNotionInternalUrl('http://file.notion.so/insecure'), /HTTPS/);
assert.throws(() => validateNotionInternalUrl('https://evil.attacker.com/malicious.png'), /no autorizado/);
assert.throws(() => validateNotionInternalUrl('https://169.254.169.254/latest/meta-data/'), /no autorizado/);

// 3. Test auto-scroll distance and speed calculation
const threshold = 70;
const maxSpeed = 16;
const calculateScrollSpeed = (containerRect, clientY) => {
  const distTop = clientY - containerRect.top;
  const distBottom = containerRect.bottom - clientY;
  if (distTop >= 0 && distTop < threshold) {
    const intensity = Math.max(0, Math.min(1, (threshold - distTop) / threshold));
    return -Math.round(intensity * maxSpeed + 2);
  } else if (distBottom >= 0 && distBottom < threshold) {
    const intensity = Math.max(0, Math.min(1, (threshold - distBottom) / threshold));
    return Math.round(intensity * maxSpeed + 2);
  }
  return 0;
};

const fakeRect = { top: 100, bottom: 800 };
// Exactly on top border -> max negative speed
assert.equal(calculateScrollSpeed(fakeRect, 100), -(maxSpeed + 2));
// Inside top zone (35px into 70px) -> half speed
const midTop = calculateScrollSpeed(fakeRect, 135);
assert.ok(midTop < 0 && midTop > -(maxSpeed + 2));
// Middle of container -> 0 speed
assert.equal(calculateScrollSpeed(fakeRect, 450), 0);
// Exactly on bottom border -> max positive speed
assert.equal(calculateScrollSpeed(fakeRect, 800), maxSpeed + 2);
// Inside bottom zone (35px from bottom) -> half positive speed
const midBottom = calculateScrollSpeed(fakeRect, 765);
assert.ok(midBottom > 0 && midBottom < maxSpeed + 2);

console.log('OK: borradores (vacío, parcial, completado), SSRF seguro en plantillas y geometría de autoscroll en calendario.');
