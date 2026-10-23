const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const {countedCalendarActivities,computeDailyKPIs,isFtfReminder}=require('../src/services/progressKpis.ts'),{personalAgendaActivities}=require('../src/lib/personalAgenda.ts'),{completedFtfPeople}=require('../src/services/ftfCompletion.ts'),{buildFtfDashboard}=require('../src/services/ftfDashboard.ts');
const people=['John','Neftali','Genaro','Karla','Acalli','Andrade','Isaias','Brian','Sotelo'],day='2026-10-22';
for(const person of people){
 const work={pageId:'work',title:'Trabajo real',shortTitle:'Trabajo',person,status:'POR HACER',start:day+'T10:00:00-06:00',end:day+'T11:00:00-06:00',checklistTotal:2,checklistCompleted:1,todayChecklistCompleted:1,ftfAvailable:true,ftfVerified:true};
 const ftf={...work,pageId:'ftf',title:'JUNIO FTF 14 Calendario 0000000 ccale noti aacti FFTF - MOVER AL TERMINAR',shortTitle:'FTF',start:day+'T17:00:00-06:00',end:day+'T18:00:00-06:00',checklistTotal:100,checklistCompleted:0,ftfVerified:false};
 const rows=[work,ftf];assert.equal(personalAgendaActivities(rows,person).length,2,'FTF stays visible for '+person);assert.deepEqual(countedCalendarActivities(rows),[work]);assert.deepEqual(computeDailyKPIs(rows,day),computeDailyKPIs([work],day));assert.equal(rows.length,2);
 assert.ok(completedFtfPeople(rows,new Date(day+'T17:00:00-06:00')).includes(person));
 const dashboard=buildFtfDashboard('Neftali',day,[{name:person}],rows,{},new Date(day+'T17:00:00-06:00'));assert.equal(dashboard.people[0].total,1);assert.equal(dashboard.people[0].pending.length,0);
 assert.equal(isFtfReminder({...work,shortTitle:'FTF Checklist'}),true);
}
assert.equal(isFtfReminder({title:'Trabajo con propiedad de pasos verificados',shortTitle:'Trabajo'}),false);
console.log('OK FTF recordatorio: visible para las 9 personas, sin actividades/horas/checks ni pendientes artificiales en control FTF; propiedad de verificación no excluye trabajo real.');
