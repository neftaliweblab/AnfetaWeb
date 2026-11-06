const assert = require('assert');

// 1. Test progressiveStage & revisionPhaseTitle
const { progressiveStage, revisionPhaseTitle } = require('../src/services/progressiveWorkflow.ts');

console.log("--- TEST 1: Progressive Workflow Dominio Suffix ---");
const pStage = progressiveStage("aprtuzDominio [d.weblab.mx] Auditoria");
assert.strictEqual(pStage.category, "dominio");
assert.strictEqual(pStage.code, "aprtuzD");

const pStageD = progressiveStage("aprtuzD [d.weblab.mx] Auditoria");
assert.strictEqual(pStageD.category, "dominio");
assert.strictEqual(pStageD.code, "aprtuzD");

const titleDone = revisionPhaseTitle("aprtuzDominio [d.weblab.mx] Auditoria", "completed");
console.log("Completed title:", titleDone);
assert.ok(titleDone.startsWith("tuzD "));

const titleRev = revisionPhaseTitle("aprtuzD [d.weblab.mx] Auditoria", "review");
console.log("Review title:", titleRev);
assert.ok(titleRev.startsWith("rtuzD "));

const titleSusp = revisionPhaseTitle("aprtuzDominio [d.weblab.mx] Auditoria", "suspended");
console.log("Suspended title:", titleSusp);
assert.ok(titleSusp.startsWith("saprtuzD "));

console.log("OK: Progressive stage handles D and dominio suffix seamlessly.");

// 2. Test activityTags exclusion of # and -
const { scanActivityTags } = require('../src/services/activityTags.ts');
console.log("--- TEST 2: Template Tag Filtering ---");
const tags1 = scanActivityTags("Plantilla web #kka11 #nne11");
assert.ok(tags1.every(t => t.role === 'template'), "Tags starting with # must be template role");

const tags2 = scanActivityTags("Plantilla web kk-a11 nn-e11");
assert.ok(tags2.every(t => t.role === 'template'), "Tags with hyphens must be template role");

const tagsReal = scanActivityTags("Actividad real kka11 nne11");
assert.ok(tagsReal.some(t => t.role === 'active'), "Standard tags without # or - are active");

console.log("OK: Template tags with # and - correctly isolated from active tasks.");

// 3. Test dateUtils
const { formatSmartDate, formatSmartSingleDate } = require('../src/lib/dateUtils.ts');
console.log("--- TEST 3: Date formatting for 'Hoy' ---");
const now = new Date();
const todayWithTime = { date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0), hasTime: true };
const todayFormatted = formatSmartSingleDate(todayWithTime, now);
console.log("Single date formatted:", todayFormatted);
assert.strictEqual(todayFormatted, "9:00 AM");

console.log("=========================================");
console.log("ALL NEW UNIT TESTS PASSED SUCCESSFULLY!");
console.log("=========================================");
