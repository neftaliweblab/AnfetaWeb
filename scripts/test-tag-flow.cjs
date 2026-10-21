const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);

const {ACTIVITY_TAGS,parseActivityTag,scanActivityTags,matchesActivityTagQuery,stripActivityTags,titlePriority}=require('../src/services/activityTags.ts');
const {calendarDisplayTitle}=require('../src/services/calendarPresentation.ts');
const {reviewTitle}=require('../src/services/reviewTitle.ts');

console.log('--- 1. Testing parseActivityTag with single digits ---');
const aan1 = parseActivityTag('aan1');
assert.equal(aan1.person, 'Andrade');
assert.equal(aan1.role, 'active');
assert.equal(aan1.priority, '11');
assert.equal(aan1.token, 'aan1');

const an1 = parseActivityTag('an1');
assert.equal(an1.person, 'Andrade');
assert.equal(an1.role, 'reference');
assert.equal(an1.priority, '11');

const jjo1 = parseActivityTag('jjo1');
assert.equal(jjo1.person, 'John');
assert.equal(jjo1.priority, '11');

const gge0 = parseActivityTag('gge0');
assert.equal(gge0.person, 'Genaro');
assert.equal(gge0.priority, '00');

console.log('OK: parseActivityTag parses single-digit variants properly.');

console.log('--- 2. Testing query matching across 1 and 11 ---');
const rawTitle = 'Optimización para la Landing Page -- aan1';
assert.equal(matchesActivityTagQuery(rawTitle, 'aan1'), true);
assert.equal(matchesActivityTagQuery(rawTitle, 'aan11'), true);
assert.equal(matchesActivityTagQuery(rawTitle, 'an1'), false);
assert.equal(matchesActivityTagQuery(rawTitle, 'jjo1'), false);
console.log('OK: matchesActivityTagQuery matches aan1 with aan11.');

console.log('--- 3. Testing calendarDisplayTitle ---');
const displayTitle = calendarDisplayTitle(rawTitle);
assert.equal(displayTitle, 'Optimización para la Landing Page');
console.log('OK: calendarDisplayTitle is clean:', displayTitle);

console.log('--- 4. Testing Review Flow: Andrade -> Genaro ---');
const sentToReview = reviewTitle(rawTitle, 'Andrade', 'Genaro', 'pending');
console.log('Sent to review:', sentToReview);
assert.equal(sentToReview, 'rtuzREVISION Optimización para la Landing Page an11 ggena');
assert.equal(calendarDisplayTitle(sentToReview), 'Optimización para la Landing Page');

const returned = reviewTitle(sentToReview, 'Andrade', 'Genaro', 'returned', 'Genaro');
console.log('Returned:', returned);
assert.equal(returned, 'prtuzREVISION Optimización para la Landing Page aan11 gena');
assert.equal(calendarDisplayTitle(returned), 'Optimización para la Landing Page');

const approved = reviewTitle(sentToReview, 'Andrade', 'Genaro', 'approved', 'Genaro');
console.log('Approved:', approved);
assert.equal(approved, 'zREVISION Optimización para la Landing Page an11 gena');
assert.equal(calendarDisplayTitle(approved), 'Optimización para la Landing Page');

console.log('ALL VERIFICATION CHECKS PASSED PERFECTLY!');
