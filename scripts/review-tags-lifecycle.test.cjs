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

const {reviewTitle:proposedReviewTitle}=require('../src/services/reviewTitle.ts');
console.log('--- Production Lifecycle Results ---');
const created = 'prtuzR cliente.com webs 26-[10OCT] Diseño nne11';
console.log('1. Creada:    ', created);

const pending = proposedReviewTitle(created, 'Neftali', 'Genaro', 'pending');
console.log('2. En revisión:', pending);
assert.equal(pending, 'rtuzR cliente.com webs 26-[10OCT] Diseño ne11 gge000');

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

console.log('ALL PRODUCTION TAG TESTS PASSED!');

const {completedActivityTags,ACTIVITY_TAGS,scanActivityTags}=tags;
for(const [person,entry] of Object.entries(ACTIVITY_TAGS)){
 for(const priority of ['00','11','22','33']){
  const raw=`tuzR cliente.com ${entry.active}${priority}`;
  const done=completedActivityTags(raw);
  assert.equal(done,`tuzR cliente.com ${entry.reference}${priority}`);
  assert.equal(completedActivityTags(done),done);
  assert.ok(!scanActivityTags(done).some(t=>t.role==='active'||t.role==='review'));
 }
}
assert.equal(completedActivityTags('tuzR Texto nne11 gge22 gge000','Genaro','Neftali'),'tuzR Texto ne11');
assert.equal(completedActivityTags('tuzR Texto nneft11 ggena','Genaro','Neftali'),'tuzR Texto neft11');
assert.equal(completedActivityTags('tuzR cliente-nne11.com correo@nne11.com nne11'),'tuzR cliente-nne11.com correo@nne11.com ne11');
console.log('OK production helpers: all users/priorities, legacy, idempotence, reviewer removal and token boundaries.');

assert.equal(completedActivityTags('zREVISION Texto nneft ggena','Genaro','Neftali'),'zREVISION Texto neft');
