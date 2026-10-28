const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) {
    name = path.join(root, 'src', name.slice(2));
  }
  return originalResolve.call(this, name, parent, ...rest);
};

for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (m, p) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(p, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
      p
    );
}

const tags = require('../src/services/activityTags.ts');
const { PROGRESSIVE_WORKFLOW_PRIMARY, stripProgressiveStage, progressiveStage } = require('../src/services/progressiveWorkflow.ts');
const { normalizePerson } = require('../src/services/identityNormalizer.ts');

function proposedReviewTitle(title, original, reviewer, state, previousReviewer = '', mode = PROGRESSIVE_WORKFLOW_PRIMARY ? 'new' : 'compatible') {
  const ownerKey = normalizePerson(original);
  const reviewKey = normalizePerson(reviewer);
  const owner = tags.ACTIVITY_TAGS[ownerKey];
  const review = tags.ACTIVITY_TAGS[reviewKey];
  if ((!owner && normalizePerson(original) !== 'Sin asignar') || !review) throw Error('No se encontró la configuración de tags de revisión.');
  const previousKey = normalizePerson(previousReviewer);
  const useNew = mode === 'new' || tags.scanActivityTags(title).some(tag => tag.role === 'review' && !tag.legacy);
  if (state === 'pending' && tags.ACTIVITY_TAGS[previousKey] && previousKey !== reviewKey && previousKey !== ownerKey) {
    let source = title;
    for (const tag of tags.scanActivityTags(title).reverse()) {
      if (tag.person === previousKey && tag.role === 'review') {
        source = source.slice(0, tag.index) + (tag.legacy ? tags.ACTIVITY_TAGS[previousKey].passive : ' ') + source.slice(tag.index + tag.token.length);
      }
    }
    if (useNew) source += ' ' + tags.pendingReviewTag(reviewer);
    return proposedReviewTitle(source, original, reviewer, state, '', mode);
  }
  const allTags = tags.scanActivityTags(title);
  const ownerTags = allTags.filter(tag => tag.person === ownerKey && (tag.role === 'active' || tag.role === 'reference'));
  const ownerTokens = [...new Set(ownerTags.map(tag => tag.legacy ? (state === 'returned' ? tags.ACTIVITY_TAGS[ownerKey].review : tags.ACTIVITY_TAGS[ownerKey].passive) + tag.suffix : (state === 'returned' ? tags.ACTIVITY_TAGS[ownerKey].active : tags.ACTIVITY_TAGS[ownerKey].reference) + tag.suffix))];
  if (owner && !ownerTokens.length) ownerTokens.push(state === 'returned' ? owner.review : owner.passive);
  const legacyReviewSuffix = allTags.find(tag => tag.person === reviewKey && tag.legacy && tag.suffix)?.suffix || '';

  const reviewerReferences = (state === 'pending' && useNew && reviewKey !== ownerKey)
    ? allTags.filter(tag => tag.person === reviewKey && (tag.role === 'active' || tag.role === 'reference') && !tag.legacy).map(tag => review.reference + tag.suffix)
    : [];

  const remove = allTags.filter(tag => {
    if (tag.person === ownerKey) return tag.role !== 'legacy' || tag.token === tag.token.toLowerCase();
    if (tag.person === reviewKey) {
      if (state === 'approved' || state === 'returned') return true;
      return tag.role === 'review' || (useNew && (tag.role === 'active' || tag.role === 'reference')) || (tag.legacy && (!!tag.suffix || tag.token === tag.token.toLowerCase()));
    }
    if (state === 'approved' && tag.role === 'review') return true;
    return false;
  });

  let body = title;
  for (const tag of remove.reverse()) body = body.slice(0, tag.index) + ' ' + body.slice(tag.index + tag.token.length);
  if (progressiveStage(body)?.category === 'revision') body = stripProgressiveStage(body);
  body = body.replace(/[\s·|—–-]+$/, '').trim();
  const phase = /(?<![\p{L}\p{N}_])(?:sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)(?![\p{L}\p{N}_])/giu;
  const target = mode === 'new' ? (state === 'pending' ? 'rtuzR' : state === 'approved' ? 'tuzR' : 'prtuzR') : (state === 'pending' ? 'rtuzREVISION' : state === 'approved' ? 'zREVISION' : 'prtuzREVISION');
  body = phase.test(body) ? body.replace(phase, target) : target + ' ' + body;

  const reviewerToken = state === 'pending'
    ? (mode === 'new' ? tags.pendingReviewTag(reviewer) : (review.review + legacyReviewSuffix))
    : '';
  const newToken = state === 'pending' && useNew && mode !== 'new' ? tags.pendingReviewTag(reviewer) : '';

  return [body, ...ownerTokens, ...new Set(reviewerReferences), reviewerToken, newToken].filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim();
}

console.log('--- Proposed Lifecycle Results ---');
const created = 'prtuzR cliente.com webs 26-[10OCT] Diseño nne11';
console.log('1. Creada:    ', created);

const pending = proposedReviewTitle(created, 'Neftali', 'Genaro', 'pending');
console.log('2. En revisión:', pending);
assert.equal(pending, 'rtuzR cliente.com webs 26-[10OCT] Diseño ne11 ge000');

const approved = proposedReviewTitle(pending, 'Neftali', 'Genaro', 'approved');
console.log('3. Terminada:  ', approved);
assert.equal(approved, 'tuzR cliente.com webs 26-[10OCT] Diseño ne11');
assert.ok(!approved.includes('ge000'));
assert.ok(!approved.includes('gena'));
assert.ok(!approved.includes('ge'));

const returned = proposedReviewTitle(pending, 'Neftali', 'Genaro', 'returned');
console.log('4. Devuelta:   ', returned);
assert.equal(returned, 'prtuzR cliente.com webs 26-[10OCT] Diseño nne11');
assert.ok(!returned.includes('ge000'));
assert.ok(!returned.includes('gena'));

// Legacy mode check
const legCreated = 'prtuzREVISION cliente.com webs 26-[10OCT] Diseño nneft0000';
const legPending = proposedReviewTitle(legCreated, 'Neftali', 'Genaro', 'pending', '', 'compatible');
console.log('5. Legacy Rev: ', legPending);
assert.equal(legPending, 'rtuzREVISION cliente.com webs 26-[10OCT] Diseño neft0000 ggena');

const legApproved = proposedReviewTitle(legPending, 'Neftali', 'Genaro', 'approved', '', 'compatible');
console.log('6. Legacy Term:', legApproved);
assert.equal(legApproved, 'zREVISION cliente.com webs 26-[10OCT] Diseño neft0000');
assert.ok(!legApproved.includes('ggena'));
assert.ok(!legApproved.includes('gena'));

console.log('ALL PROPOSED TAG TESTS PASSED!');
