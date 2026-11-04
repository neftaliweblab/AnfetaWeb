const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
process.chdir(root);

const ts = require(path.join(root, 'node_modules/typescript'));
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};

for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (mod, file) =>
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      }
    }).outputText, file);
}

const {
  completedActivityTags,
  inferActivityPerson,
  scanActivityTags,
  ACTIVITY_TAGS,
} = require(root + '/src/services/activityTags.ts');

const { reviewTitle } = require(root + '/src/services/reviewTitle.ts');
const { assignedPerson } = require(root + '/src/services/notionCalendar.ts');
const { normalizeActivity } = require(root + '/src/services/dataNormalizers.ts');

console.log('--- 1. Testing completedActivityTags: deactivates owner tag ---');
{
  // Neftalí active tag nne11
  const completedNeftali = completedActivityTags(
    'rtuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web RECURRENTE ASISTENTE Fase-36 rrecu nne11 jjo000',
    'John',
    'Neftali'
  );
  console.log('Neftali completed title:', completedNeftali);
  assert.ok(completedNeftali.includes('ne11'), 'Must retain passive ne11 in title');
  assert.ok(!completedNeftali.includes('jjo000'), 'Must remove reviewer tag');
  assert.ok(!/\bnne11\b/.test(completedNeftali), 'Must not retain active nne11');

  // Edwin active tag eed11
  const completedEdwin = completedActivityTags(
    'rtuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web Edwin Actividad eed11 jjo000',
    'John',
    'Edwin'
  );
  console.log('Edwin completed title:', completedEdwin);
  assert.ok(completedEdwin.includes('ed11'), 'Must retain passive ed11 in title');
  assert.ok(!completedEdwin.includes('jjo000'), 'Must remove reviewer tag');
  assert.ok(!/\beed11\b/.test(completedEdwin), 'Must not retain active eed11');

  // If title only had reference tag ne11, promote back to active tag nne11
  const restoredFromRef = completedActivityTags(
    'tuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web RECURRENTE ASISTENTE Fase-36 rrecu ne11',
    '',
    'Neftali'
  );
  console.log('Restored from reference:', restoredFromRef);
  assert.ok(restoredFromRef.includes('ne11'), 'Must preserve passive ne11');
}
console.log('OK: completedActivityTags preserves passive tag.');

console.log('\n--- 2. Testing reviewTitle: approved state retains passive tag ---');
{
  const sent = 'rtuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web Mejoras ne11 jjo000';
  const approved = reviewTitle(sent, 'Neftali', 'John', 'approved');
  console.log('Approved review title:', approved);
  assert.ok(approved.includes('ne11'), 'Approved title must have passive owner ne11');
  assert.ok(!approved.includes('jjo000'), 'Approved title must not have reviewer tag');
}
console.log('OK: reviewTitle approved preserves passive tag.');

console.log('\n--- 3. Testing inferActivityPerson with reference tags ---');
{
  // Historic page with reference tag ne11
  const inferredNeftali = inferActivityPerson(
    'tuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web RECURRENTE ASISTENTE Mejoras a implementar Fase-36 Mejoras web ANFETA rrecu ne11',
    'Terminada'
  );
  assert.equal(inferredNeftali, 'Neftali', 'Should infer Neftali from ne11');

  // Historic page with ed11
  const inferredEdwin = inferActivityPerson(
    'tuzR 26-[10OCT] Actividad finalizada ed11',
    'Terminada'
  );
  assert.equal(inferredEdwin, 'Edwin', 'Should infer Edwin from ed11');
}
console.log('OK: inferActivityPerson resolves reference tags.');

console.log('\n--- 4. Testing assignedPerson for completed page with empty Notion People ---');
{
  const pageWithEmptyPeople = {
    id: 'mock-page-id',
    properties: {
      Name: {
        type: 'title',
        title: [{
          plain_text: 'tuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web RECURRENTE ASISTENTE Mejoras a implementar Fase-36 Mejoras web ANFETA rrecu ne11',
          text: { content: 'tuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web RECURRENTE ASISTENTE Mejoras a implementar Fase-36 Mejoras web ANFETA rrecu ne11' }
        }]
      },
      'Assignee/Ejecutor Principal': {
        type: 'people',
        people: [] // Empty in Notion!
      },
      Estado: {
        type: 'status',
        status: { name: 'Terminada' }
      }
    }
  };

  const resolved = assignedPerson(pageWithEmptyPeople);
  console.log('Resolved person for page with empty Notion people:', resolved);
  assert.equal(resolved, 'Neftali', 'Must resolve to Neftali so no calendar gap occurs');
}
console.log('OK: assignedPerson handles completed activities with empty Notion People.');

console.log('\n--- 5. Testing normalizeActivity: places completed task in member column ---');
{
  const normalized = normalizeActivity({
    pageId: 'test-123',
    title: 'tuzR aapli 26-[10OCT] d.anfeta.com.aplicacion.web RECURRENTE ASISTENTE Mejoras a implementar Fase-36 Mejoras web ANFETA rrecu ne11',
    person: 'Sin asignar', // If raw person was Sin asignar
    status: 'Terminada',
    start: '2026-10-26T10:00:00-06:00',
    end: '2026-10-26T11:00:00-06:00',
  }, 0);

  console.log('Normalized activity person:', normalized.person);
  assert.equal(normalized.person, 'Neftali', 'Must assign to Neftali for calendar column mapping');
  assert.equal(normalized.isFinalized, true);
}
console.log('OK: normalizeActivity assigns finalized activity correctly.');

console.log('\n=============================================');
console.log('ALL FINALIZED ACTIVITY & ASSIGNEE TESTS PASSED!');
console.log('=============================================');
