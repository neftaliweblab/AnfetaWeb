const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,p);
const tags=require('../src/services/activityTags.ts'),{reviewTitle}=require('../src/services/reviewTitle.ts'),{buildCalendarQuickTemplateFinalTitle:build}=require('../src/lib/templateCatalog.ts');
const {matchesFlexibleOrQuotedQuery:match}=require('../src/services/advancedQuery.ts');
const {calendarUrgent}=require('../src/services/calendarPresentation.ts');
for(const [person,entry] of Object.entries(tags.ACTIVITY_TAGS)){
 const actual=entry.active+'000',old=entry.reference+'000',planned=entry.reference+'11',owner=person==='Isaias'?'Neftali':'Isaias';
 assert.equal(tags.pendingReviewTag(person),actual);
 for(const token of [actual,old]){assert.equal(tags.parseActivityTag(token).role,'review');assert.equal(calendarUrgent(token),false);assert.equal(match({name:token},actual),true);}
 assert.equal(calendarUrgent(entry.active+'00'),true);
 assert.equal(match({name:actual},entry.active+'00'),false);
 assert.equal(tags.inferActivityPerson(planned),'');
 const template=entry.active.slice(0,2)+'-'+entry.active.slice(2)+'000';
 for(const token of [template,entry.active[0]+'-'+entry.reference+'11']){assert.equal(tags.parseActivityTag(token).role,'template');assert.equal(tags.inferActivityPerson('prtuzR '+token),'');assert.equal(match({name:token},actual),false);}
 const created=build({selectedDate:new Date('2026-10-29T12:00:00Z'),description:'Prueba',personName:owner,reviewerName:person,templateOriginalTitle:'prtuzR '+template});
 assert.ok(created.split(' ').includes(planned));assert.ok(!created.split(' ').includes(actual));assert.equal(tags.inferActivityPerson(created),owner);
 const sent=reviewTitle(created,owner,person,'pending');assert.ok(sent.split(' ').includes(actual));assert.equal(tags.inferActivityPerson(sent),person);assert.equal(reviewTitle(sent,owner,person,'pending'),sent);
 for(const source of [sent,'rtuzR Prueba '+tags.ACTIVITY_TAGS[owner].reference+'11 '+old]){
  for(const state of ['approved','returned']){const result=reviewTitle(source,owner,person,state);assert.ok(!tags.scanActivityTags(result).some(t=>t.person===person),'Reviewer removed: '+result);assert.equal(tags.scanActivityTags(result).find(t=>t.person===owner).role,state==='returned'?'active':'reference');}
 }
}
const urgentTemplate=build({selectedDate:new Date('2026-10-29T12:00:00Z'),description:'Urgente',personName:'John',reviewerName:'Genaro',templateOriginalTitle:'prtuzR nn-e11 jj-o00 gg-e000'});assert.ok(urgentTemplate.includes('jjo00'));assert.ok(urgentTemplate.includes('ge11'));assert.ok(!urgentTemplate.includes('gge000'));
const storage=require('../src/lib/searchTabsStorage.ts');
const saved=storage.parseSearchTabs(JSON.stringify({tabs:[{id:'a',query:'gge11',pending:true,unseen:true,remindAt:123456,canClose:false},{id:'b',query:'cliente gge11',canClose:true}],activeTabId:'b'}));
assert.equal(saved.tabs[0].pending,true);assert.equal(saved.tabs[0].unseen,true);assert.equal(saved.tabs[0].remindAt,123456);assert.equal(storage.findSearchTab(saved.tabs,' gge11 ').id,'a');assert.equal(storage.findSearchTab(saved.tabs,'gge22'),undefined);
assert.equal(storage.parseSearchTabs(JSON.stringify({tabs:[{id:'x',query:'x',remindAt:'bad'}]})).tabs[0].remindAt,undefined);
const {queryChips,appendQueryTerm}=require('../src/lib/searchQueryChips.ts');
for(const query of ['gge11 OR gge22 OR gge33','gge11 AND NOT reporte','(gge11 OR gge22) AND "reporte del mes"','gge11 reporte','NOT reporte OR gge11']){
 for(const chip of queryChips(query)){assert.ok(!/^(?:AND|OR)\b|\b(?:AND|OR|NOT)$/.test(chip.without),'Dangling operator: '+chip.without);}
}
assert.equal(queryChips('gge11 OR gge22')[0].without,'gge22');assert.equal(queryChips('gge11 OR gge22')[1].without,'gge11');assert.equal(queryChips('gge11 AND NOT reporte')[1].without,'gge11');assert.equal(queryChips('(gge11 OR gge22')[0],undefined);
assert.equal(appendQueryTerm('gge11 OR gge22','reporte','exclude'),'(gge11 OR gge22) AND NOT "reporte"');
for(const name of ['gge11','gge22','gge11 reporte','gge22 reporte'])assert.equal(match({name},appendQueryTerm('gge11 OR gge22','reporte','include')),name.includes('reporte'),name);
for(const name of ['gge11','gge22','gge11 reporte','gge22 reporte'])assert.equal(match({name},appendQueryTerm('gge11 OR gge22','reporte','exclude')),!name.includes('reporte'),name);
assert.equal(match({name:'gge11'},'(gge11 OR gge22) AND NOT (reporte OR cancelado)'),true);
assert.equal(match({name:'gge11 cancelado'},'(gge11 OR gge22) AND NOT (reporte OR cancelado)'),false);
assert.equal(queryChips('gge11 AND "doble  espacio"')[0].without,'"doble  espacio"');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{WorkflowStageBadge}=require('../src/components/WorkflowStageBadge.tsx');
const {parseVisualParts}=require('../src/lib/visualTitleParser.ts');
assert.equal(parseVisualParts('Prueba','PRTUZ POR HACER').workflow,parseVisualParts('Prueba','POR HACER').workflow);
const badge=renderToStaticMarkup(React.createElement(WorkflowStageBadge,{status:'PRTUZ POR HACER',title:'prtuzR Prueba'}));assert.match(badge,/>Por hacer</);assert.ok(!badge.includes('prtuzR · Por hacer'));
console.log('OK Oct29: nine users, planned vs actual review, template isolation, legacy reads, complete/return lifecycle, query reuse, reminder persistence, safe term removal and unified status.');
