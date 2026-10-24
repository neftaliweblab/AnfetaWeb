const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,p);
const mock=(file,exports)=>{const id=require.resolve('../src/services/'+file+'.ts');require.cache[id]={id,filename:id,loaded:true,exports};};
const {mexicoDate}=require('../src/services/calendarPresentation.ts');const today=mexicoDate();const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
const page=(id,person,day,start,end)=>({id,properties:{Name:{type:'title',title:[{plain_text:'Trabajo '+id}]},Person:{type:'select',select:{name:person}},Estado:{type:'select',select:{name:'PENDIENTE'}},'Fecha POR Hacer':{type:'date',date:{start:day+'T'+start+':00-06:00',end:day+'T'+end+':00-06:00'}}}});
const pages=[page('occupied','John',today,'08:00','22:00'),page('blocked','John',yesterday,'09:00','10:00'),page('free','Neftali',yesterday,'09:00','10:00')];let mutations=[],failMutation=false;
mock('notionCalendar',{queryCalendarPages:async()=>pages,assignedPerson:p=>p.properties.Person.select.name,calendarStatusField:p=>['Estado',p.properties.Estado]});
mock('activityPermissions',{canEditActivity:()=>true});mock('notionMutations',{mutateActivity:async(s,a,id)=>{mutations.push(id);if(failMutation)throw Error('Notion 503');return pages.find(p=>p.id===id);}});
(async()=>{
 const {executeDailyAutomation,planDailyAutomation}=require('../src/services/calendarAutomation.ts');
 // Run at 10am Mexico regardless of test execution hour.
 const ActualDate=Date;global.Date=class extends ActualDate{constructor(...args){super(...(args.length?args:[today+'T10:00:00-06:00']));}static now(){return ActualDate.parse(today+'T10:00:00-06:00');}};
 const report=await executeDailyAutomation({},'John',today);global.Date=ActualDate;
 assert.deepEqual(mutations,['free']);assert.equal(report.failed,0);assert.equal(report.skippedNoSpace,1);assert.equal(report.blocked[0].activityId,'blocked');assert.equal(report.remaining,0);assert.equal(report.errors.length,0);
 global.Date=class extends ActualDate{constructor(...args){super(...(args.length?args:[today+'T10:00:00-06:00']));}};
 failMutation=true;const failed=await executeDailyAutomation({},'John',today);failMutation=false;global.Date=ActualDate;
 assert.equal(failed.failed,1);assert.match(failed.errors[0],/Notion 503/);assert.equal(failed.blocked.length,1);
 const {runCalendarAutomation}=require('../src/services/runCalendarAutomation.ts');let calls=0;global.fetch=async()=>{calls++;return {ok:true,json:async()=>({report})}};
 const combined=await runCalendarAutomation('John',today);assert.equal(calls,1,'Capacity does not cause retry batches');assert.equal(combined.blocked.length,1);assert.equal(combined.failed,0);
 global.window={};const store=new Map();global.sessionStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const logs=require('../src/lib/appDiagnostics.ts');const now=Date.now;let clock=now();Date.now=()=>clock;
 logs.recordAppLog('John','Calendario','Actividad A: No hay espacio suficiente entre 08:00 y 22:00.');clock+=90*60000;logs.recordAppLog('John','Calendario','Actividad A: No hay espacio suficiente entre 08:00 y 22:00.');assert.equal(logs.getAppLogs('John').length,1);assert.equal(logs.getAppLogs('John')[0].count,2);
 for(const seconds of [42,35])logs.recordAppLog('John','Sync',`Lectura de enriquecimiento del ${today} demoró ${seconds} s y finalizó correctamente; origen Notion.`);
 assert.equal(logs.getAppLogs('John').length,2);assert.equal(logs.getAppLogs('John')[0].count,2);assert.match(logs.diagnosticAdvice(logs.getAppLogs('John')[0].message).title,/completada/);Date.now=now;
 console.log('OK: saturated activities retained without failing/retrying, available moves proceed, report details, session deduplication and successful slow-read advice.');
})().catch(e=>{console.error(e);process.exitCode=1});
