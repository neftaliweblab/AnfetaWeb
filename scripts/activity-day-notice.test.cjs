const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(n,p,...a){if(n.startsWith('@/'))n=path.join(root,'src',n.slice(2));return resolve.call(this,n,p,...a)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
let state={revision:0,values:{receipts:{keep:'retained'}}},saves=0,pushes=0,failSave=false,failPush=false;
const load=Module._load;
Module._load=function(n,p,...a){if(p?.filename.endsWith('activityDayNotice.ts')){
 if(n==='./notionCalendar')return {};
 if(n==='./identityNormalizer')return {normalizePerson:x=>x};
 if(n==='./notionSnapshotCache')return {notionSourceKey:()=> 'source'};
 if(n==='./userState')return {readUserState:async(_,user)=>{assert.equal(user,'John');return structuredClone(state)},updateUserState:async(_,user,patch,rev)=>{assert.equal(user,'John');assert.equal(rev,state.revision);if(failSave)throw Error('storage unavailable');state={revision:rev+1,values:{...state.values,...patch}};saves++}};
 if(n==='./pwaPush')return {sendPwaPush:async(_,user)=>{assert.equal(user,'John');pushes++;if(failPush)throw Error('push unavailable')}};
 }return load.call(this,n,p,...a)};
const {confirmActivityDayNotice,assertDailyClosureReady}=require(root+'/src/services/activityDayNotice.ts');
(async()=>{
 assert.throws(()=>assertDailyClosureReady('2026-11-18','2026-11-19',2,{hasDailyPlan:true,completedForDay:true}),/actual/);
 assert.throws(()=>assertDailyClosureReady('2026-11-19','2026-11-19',0,{hasDailyPlan:true,completedForDay:true}),/Completa/);
 assert.throws(()=>assertDailyClosureReady('2026-11-19','2026-11-19',3,{hasDailyPlan:true,completedForDay:false,done:20}),/Completa/);
 assert.throws(()=>assertDailyClosureReady('2026-11-19','2026-11-19',3,{hasDailyPlan:false,done:0}),/Completa/);
 assertDailyClosureReady('2026-11-19','2026-11-19',3,{hasDailyPlan:true,completedForDay:true,pendingFutureCount:8});
 assertDailyClosureReady('2026-11-19','2026-11-19',3,{hasDailyPlan:false,done:3});

 const page={id:'a'.repeat(32),title:'Actividad',person:'Edwin'},summary={hasDailyPlan:true,plannedTotal:2,plannedDone:2,total:8,done:2};
 await confirmActivityDayNotice({},'Edwin',page,'2026-11-19',summary);
 assert.equal(saves,1);assert.equal(pushes,1);assert.equal(state.values.receipts.keep,'retained');
 const first=Object.values(state.values.receipts.activityDayCompletions)[0];assert.equal(first.authorName,'Edwin');assert.equal(first.pageId,page.id);assert.match(first.detail,/2\/2/);
 await confirmActivityDayNotice({},'Edwin',page,'2026-11-19',summary);assert.equal(saves,1);assert.equal(pushes,1);
 failSave=true;await assert.rejects(confirmActivityDayNotice({},'Edwin',page,'2026-11-20',summary),/storage/);assert.equal(pushes,1);
 failSave=false;failPush=true;const warning=await confirmActivityDayNotice({},'Edwin',page,'2026-11-20',{hasDailyPlan:false,plannedDone:0,plannedTotal:0,done:3,total:3});assert.match(warning,/guardado/);assert.match(Object.values(state.values.receipts.activityDayCompletions)[1].detail,/3\/3/);
 await assert.rejects(confirmActivityDayNotice({},'Edwin',{id:'invalid'},'2026-11-21',summary),/identificar/);
 console.log('OK: cierre diario, destinatario, historial conservado, idempotencia, fallo de almacenamiento y push, conteo sin plan e ID inválido.');
})().catch(e=>{console.error(e);process.exitCode=1});
