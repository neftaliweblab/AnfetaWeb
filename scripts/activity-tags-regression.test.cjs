const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const tags=require('../src/services/activityTags.ts'),{reviewTitleLegacy:reviewTitle}=require('../src/services/reviewTitleLegacy.ts'),{handoffTitle}=require('../src/services/handoffTitle.ts');
const {calendarUrgent,calendarDisplayTitle}=require('../src/services/calendarPresentation.ts');
const {matchesFlexibleOrQuotedQuery:match,AdvancedQueryV3}=require('../src/services/advancedQuery.ts');
const {orderSearchResults}=require('../src/lib/activeResultsFirst.ts'),{resultMonth}=require('../src/lib/searchMonthOrder.ts');
const {normalizeSearchRow}=require('../src/services/dataNormalizers.ts');
for(const [person,entry]of Object.entries(tags.ACTIVITY_TAGS)){
 for(const priority of ['00','11','22','33']){
  const active=entry.active+priority,reference=entry.reference+priority;
  assert.equal(tags.inferActivityPerson('prtuzREVISION '+active),person);
  assert.equal(tags.inferActivityPerson(reference),'');
  assert.equal(tags.matchesActivityTagQuery(reference,active),false);
  assert.equal(tags.matchesActivityTagQuery(active,reference),false);
  assert.equal(tags.matchesActivityTagQuery(active,entry.review),false);
  const reviewer=person==='John'?'Genaro':'John',review=tags.ACTIVITY_TAGS[reviewer];
  const source='prtuzREVISION webs 26-[10OCT] Ejemplo [dominio.com] '+active;
  const pending=reviewTitle(source,person,reviewer,'pending');
  assert.ok(pending.endsWith(reference+' '+review.review),pending);
  assert.equal(tags.inferActivityPerson(pending),reviewer);
  assert.equal(reviewTitle(pending,person,reviewer,'pending'),pending);
  const returned=reviewTitle(pending,person,reviewer,'returned');
  assert.ok(returned.endsWith(active),returned);
  assert.ok(!returned.includes(review.passive), 'Returned removes reviewer tag');
  assert.equal(tags.inferActivityPerson(returned),person);
  const approved=reviewTitle(pending,person,reviewer,'approved');
  assert.ok(approved.endsWith(reference), approved);
  assert.ok(!approved.includes(review.passive), 'Approved removes reviewer tag');
  const target=person==='Andrade'?'Neftali':'Andrade';
  assert.ok(handoffTitle(source,person,target).endsWith(tags.activePersonTag(target,priority)));
 }
}
assert.equal(reviewTitle('prtuzREVISION iis11 iis22 nne33','Isaias','John','pending'),'rtuzREVISION nne33 is11 is22 jjohn');
assert.equal(reviewTitle('rtuzREVISION is11 jjohn nne33','Isaias','Genaro','pending','John'),'rtuzREVISION john nne33 is11 ggena');
assert.equal(reviewTitle('rtuzREVISION is11 jjohn nne33','Isaias','Genaro','pending','John').includes('jjohn'),false);
for(const text of ['x_iis11','xiis11','iis110','iis11@dominio.com','https://iis11.com','carpeta/iis11','contacto@iis11','1s11'])assert.equal(tags.scanActivityTags(text).length,0,text);
assert.equal(tags.matchesActivityTagQuery('nneft002','nne22'),true);
assert.equal(tags.matchesActivityTagQuery('neft002','nne22'),false);
assert.equal(calendarUrgent('is00 jjohn'),false);
assert.equal(calendarUrgent('iis00'),true);
assert.equal(calendarUrgent('26-[01ENE] 08:00 2000'),false);
console.log('OK activity tags regression passed with clean finalized activity tags.');
