const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,p);
const tags=require('../src/services/activityTags.ts'),{reviewTitleLegacy:reviewTitle}=require('../src/services/reviewTitleLegacy.ts'),{calendarUrgent}=require('../src/services/calendarPresentation.ts');
const {matchesFlexibleOrQuotedQuery:match}=require('../src/services/advancedQuery.ts');
for(const [person,entry]of Object.entries(tags.ACTIVITY_TAGS)){
 const token=entry.reference+'000';assert.equal(tags.pendingReviewTag(person),token);assert.equal(tags.parseActivityTag(token).role,'review');assert.equal(calendarUrgent(token),false);
 assert.equal(match({name:token},token),true);assert.equal(match({name:entry.reference+'00'},token),false);assert.equal(match({name:token},entry.reference+'00'),false);
 assert.equal(match({name:'x'+token},token),false);assert.equal(match({name:'https://'+token+'.com'},token),false);
 const original=person==='Isaias'?'Neftali':'Isaias',active=tags.activePersonTag(original);
 const old=reviewTitle('prtuzREVISION Trabajo '+active,original,person,'pending');assert.ok(old.endsWith(entry.review),'Legacy writes stay active by default');assert.ok(!old.includes(token));
 const pending=reviewTitle('prtuzREVISION Trabajo '+active+' '+token,original,person,'pending');assert.ok(pending.includes(token));assert.ok(pending.includes(entry.review));assert.equal(reviewTitle(pending,original,person,'pending'),pending);
 for(const state of ['returned','approved']){const resolved=reviewTitle(pending,original,person,state);assert.ok(!resolved.includes(token));assert.ok(!tags.scanActivityTags(resolved).some(t=>t.role==='review'));}
 const future=reviewTitle(old,original,person,'pending','','new');assert.ok(future.includes(token));assert.ok(!future.split(' ').includes(entry.review));
}
let pending=reviewTitle('prtuzREVISION iis11 gge11 ge000','Isaias','Genaro','pending');assert.ok(!pending.includes('gge11'));assert.ok(pending.includes('ge11'));assert.equal(reviewTitle(pending,'Isaias','Genaro','pending'),pending);
pending=reviewTitle(pending,'Isaias','John','pending','Genaro');assert.ok(pending.includes('jo000'));assert.ok(!pending.includes('ge000'));assert.ok(!pending.includes('ggena'));
const {quickActivitySchedule}=require('../src/lib/quickActivitySchedule.ts');const activity={start:'2026-10-22T10:00:00-06:00',end:'2026-10-22T11:00:00-06:00'};
const {buildCalendarQuickTemplateFinalTitle:build}=require('../src/lib/templateCatalog.ts');
const template=build({selectedDate:new Date('2026-10-22T12:00:00Z'),description:'Prueba',personName:'Isaias',reviewerName:'John',templateOriginalTitle:'prtuzREVISION iis11 ge000'});
assert.ok(template.includes('iis11'));assert.ok(template.includes('jjohn'));assert.ok(template.includes('jo000'));assert.ok(!template.includes('ge000'));
assert.deepEqual(quickActivitySchedule(activity,0,90,'2026-11-05'),{start:'2026-11-05T10:00:00-06:00',end:'2026-11-05T11:30:00-06:00'});assert.throws(()=>quickActivitySchedule(activity,0,60,'2026-02-30'),/fecha válida/);assert.throws(()=>quickActivitySchedule({...activity,start:'2026-10-22T21:30:00-06:00'},0,120,'2026-11-05'),/horario/);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{ResultIdentityBadges}=require('../src/components/ResultsViewHost/ResultIdentityBadges.tsx'),{highlightMultiSearch}=require('../src/lib/multiSearchHighlight.tsx');
let html=renderToStaticMarkup(React.createElement(ResultIdentityBadges,{item:{source:'Notion',name:'Trabajo largo al final ge000',assignedPerson:'Isaias'},query:'ge000 OR jo000'}));assert.match(html,/ge000/);assert.match(html,/Asignado: Isaias/);assert.ok(!html.includes('jo000'));
html=renderToStaticMarkup(React.createElement(ResultIdentityBadges,{item:{source:'Notion',name:'ge000',assignedPerson:'Isaias'},query:'ge00'}));assert.ok(!html.includes('Coincide con'));
html=renderToStaticMarkup(React.createElement('div',null,highlightMultiSearch('ge000 ge00','ge00')));assert.equal((html.match(/transition-all/g)||[]).length,1);
console.log('OK transición: 9 personas, formato actual conservado, nuevos tags exactos, aprobación/devolución, cambio de revisor, fecha libre, duración y badges visibles.');
