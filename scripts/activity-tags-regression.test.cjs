const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const tags=require('../src/services/activityTags.ts'),{reviewTitle}=require('../src/services/reviewTitle.ts'),{handoffTitle}=require('../src/services/handoffTitle.ts');
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
  assert.ok(returned.endsWith(active+' '+review.passive),returned);
  assert.equal(tags.inferActivityPerson(returned),person);
  assert.ok(reviewTitle(pending,person,reviewer,'approved').endsWith(reference+' '+review.passive));
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
const urgent=tags.setTaskUrgent('prtuzREVISION iis22 ne00','Isaias',true);
assert.equal(tags.setTaskUrgent(urgent,'Isaias',false),'prtuzREVISION iis22 ne00');
assert.equal(tags.setTaskUrgent(urgent,'Isaias',true),urgent);
assert.ok(!calendarDisplayTitle('prtuzREVISION iis11 is22 jjohn Trabajo').includes('iis11'));
const row={name:'rtuzREVISION is11 jjohn Diseño',path:'',assignedPerson:'John',description:'iis11',searchText:'iis11'};
for(const query of ['jjohn','is11 AND jjohn','iis11 OR jjohn','jjohn NOT iis11','(is11 OR nne11) AND jjohn']){
 assert.equal(match(row,query),true,query);
}
for(const query of ['is11 jjohn','iis11|jjohn','jjohn -iis11']){const parsed=AdvancedQueryV3.parse(query);assert.equal(AdvancedQueryV3.evaluate(row,parsed.plan,parsed.expr),true,query+' AST');}
assert.equal(match(row,'iis11'),false);
assert.equal(match(row,'jjo11'),false);
assert.equal(match({...row,name:'iisai'},'iisai'),true);
assert.equal(tags.resultAssignedPerson({name:'ne11 jjohn',assignedPerson:'Genaro',searchText:'nne11'}),'Genaro');
assert.equal(tags.resultAssignedPerson({name:'ne11',description:'nne11',searchText:'nne11'}),'');
assert.equal(normalizeSearchRow({Name:'ne11',SearchText:'nne11'},0).assignedPerson,'Sin asignar');
const rows=[
{id:'old',name:'prtuzREVISION 25-[10OCT] vieja',updateStatus:'PENDIENTE'},
{id:'next',name:'prtuzREVISION 26-[11NOV] futura',updateStatus:'PENDIENTE'},
{id:'done',name:'zREVISION 26-[10OCT] lista',updateStatus:'TERMINADA'},
{id:'active',name:'prtuzREVISION 26-[10OCT] activa',updateStatus:'PENDIENTE'},
{id:'sep',name:'prtuzREVISION 26-[09SEP] anterior',updateStatus:'PENDIENTE'}];
const now=new Date('2026-10-19T12:00:00Z'),snapshot=structuredClone(rows);
assert.deepEqual(orderSearchResults(rows,'month',now).map(r=>r.id),['active','done','next','sep','old']);
assert.deepEqual(orderSearchResults(rows.filter(r=>r.id!=='active'),'month',now).map(r=>r.id),['done','next','sep','old']);
assert.deepEqual(rows,snapshot);
assert.equal(resultMonth({name:'26-[10OCT]'}).year,2026);
assert.deepEqual(orderSearchResults([{id:1,name:'26-[12DIC]'},{id:2,name:'27-[01ENE]'}],'month',new Date('2027-01-01T06:00:00Z')).map(r=>r.id),[2,1]);
console.log('OK catálogo: 9 personas × 4 prioridades, revisión completa e idempotente, legado, reasignación, búsquedas exactas/AST/NOT, metadatos confiables, urgencia, todos los meses, año y orden antes de paginar.');
