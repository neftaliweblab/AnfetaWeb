const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,p);

const tags=require('../src/services/activityTags.ts'),{assignedPerson}=require('../src/services/notionCalendar.ts'),{normalizeSearchRow,normalizeActivity}=require('../src/services/dataNormalizers.ts');
const {reviewTitle}=require('../src/services/reviewTitle.ts');
const screenshot='rtuzR aads 26-[10OCT] 15.00 Reporte del mes p.fromm-pack.mx.ads ge11 ne11 sso000';
assert.equal(tags.currentReviewTagPerson(screenshot),'Sotelo');assert.equal(tags.resultAssignedPerson({name:screenshot,assignedPerson:'Genaro'}),'Sotelo');
assert.equal(tags.inferActivityPerson(screenshot+' ggena'),'Sotelo','A historical tag cannot override the actual three-zero reviewer');
const page={properties:{Name:{type:'title',title:[{text:{content:screenshot}}]},'Assignee/Ejecutor Principal':{type:'people',people:[]}}};
assert.equal(assignedPerson(page),'Sotelo');assert.equal(tags.resultAssignedPerson({name:screenshot,assignedPerson:'Neftali',isReviewMirror:true}),'Neftali');
assert.equal(normalizeSearchRow({Name:screenshot,Source:2,AssignedPerson:'Genaro'},0).assignedPerson,'Sotelo');
assert.equal(normalizeActivity({Title:screenshot,Person:'Neftali'},0).person,'Sotelo');
assert.equal(normalizeActivity({Title:screenshot,Person:'Neftali',IsReviewMirror:true},0).person,'Neftali','Keep the owner visual copy in its original column');
for(const [person,entry]of Object.entries(tags.ACTIVITY_TAGS)){
 const title='rtuzR Prueba ge11 ne11 '+entry.active+'000';assert.equal(tags.currentReviewTagPerson(title),person);assert.equal(tags.currentReviewTagPerson(title.toUpperCase()),person);
 for(const nonReview of [entry.reference+'11',entry.active+'00',entry.active.slice(0,2)+'-'+entry.active.slice(2)+'000'])assert.equal(tags.currentReviewTagPerson('rtuzR Prueba '+nonReview),'',nonReview);
 assert.equal(tags.currentReviewTagPerson(title,'Terminada'),'');assert.equal(tags.currentReviewTagPerson(title,'POR HACER'),'');
 const sent=reviewTitle('prtuzR Prueba nne11 ge11','Neftali',person,'pending');assert.ok(sent.split(' ').includes(entry.active+'000'));assert.equal(tags.currentReviewTagPerson(sent),person);
}
assert.equal(tags.currentReviewTagPerson('rtuzR Prueba ge11 ne11'),'');assert.equal(tags.inferActivityPerson('rtuzR Prueba ge11 ne11'),'');
console.log('OK actual three-zero review detection: screenshot Sotelo, all people, legacy priority, empty/stale assignment, inactive references, completion and owner mirrors.');
