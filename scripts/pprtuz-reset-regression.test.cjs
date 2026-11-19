const fs=require('fs'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
let pages=Array.from({length:25},(_,i)=>({id:(i+1).toString(16).padStart(32,'0'),last_edited_time:'2026-11-18T22:00:00-06:00',properties:{Name:{type:'title',title:[{plain_text:'pprtuzR Trabajo nne11'}]},Estado:{type:'status',status:{name:'PPRTUZ TERMINADO-HOY-(POR HACER)'}}}}));
let job='pending',invalidations=0,patches=0,events=0,queries=0;const receipts=new Map();const load=Module._load;
Module._load=function(n,p,...args){const parent=p?.filename.replace(/\\/g,'/')||'';
 if(parent.endsWith('/services/pprtuzDailyReset.ts')){
  if(n==='./notionMutations')return {notionRequest:async(_settings,url)=>{
   if(url==='data_sources/source')return {properties:{Name:{type:'title'},Estado:{type:'status',status:{options:[{name:'PPRTUZ TERMINADO-HOY-(POR HACER)'},{name:'PRTUZ POR HACER'}]}}}};
   if(url.endsWith('/query')){queries++;return {results:structuredClone(pages.filter(p=>p.properties.Estado.status.name.startsWith('PPRTUZ'))),has_more:false};}
   if(url.startsWith('pages/'))return structuredClone(pages.find(p=>p.id===url.split('/')[1]));throw Error(url);
  },mutateActivity:async(_settings,_actor,id,updates)=>{const p=pages.find(p=>p.id===id);assert.equal(updates.expectedEditedAt,p.last_edited_time);assert.equal(updates.status,'PRTUZ POR HACER');p.properties.Estado.status.name=updates.status;p.properties.Name.title=[{plain_text:'prtuzR Trabajo nne11'}];p.last_edited_time='2026-11-19T01:00:00-06:00';patches++;return structuredClone(p)}};
  if(n==='./notionCalendar')return {assignedPerson:()=> 'Neftali',calendarStatusField:p=>p.properties.Estado?['Estado',p.properties.Estado]:undefined};
  if(n==='./activityPermissions')return {canEditActivity:()=>true,isReviewer:()=>true};
  if(n==='./supabaseServer')return {supabaseConfigured:()=>true,supabaseAdmin:()=>({rpc:async(name,args)=>{
   if(name==='claim_automation_job'){assert.equal(args.p_force,false);if(job==='completed')return {data:{state:'completed'}};job='running';return {data:{state:'claimed',token:'lease'}};}
   if(name==='finish_automation_job'){job=args.p_error?'failed':args.p_report.remaining||args.p_report.failed?'pending':'completed';return {data:true};}throw Error(name);
  }})};
  if(n==='./notionSnapshotCache')return {notionSourceKey:()=> 'source',invalidateSnapshots:async()=>invalidations++};
  if(n==='./reliableOperations')return {operationKey:(...v)=>v.join(':'),durableStep:async(key,run)=>{if(receipts.has(key))return receipts.get(key);const result=await run();receipts.set(key,result);return result}};
  if(n==='./identityNormalizer')return {normalizePerson:x=>x,PERSON_ALIASES:{Neftali:['nneft']}};
  if(n==='./notionEventSync')return {recordPageEvent:async()=>events++,parseNotionPageProperties:p=>({title:p.properties.Name.title[0].plain_text,person:'Neftali',status:p.properties.Estado.status.name})};
 }
 if(parent.endsWith('/services/prepareDailyFtf.ts')){
  if(n==='./notionSnapshotCache')return {invalidateSnapshots:async()=>{}};
  if(n==='./pprtuzDailyReset')return {resetDailyPprtuz:async()=>{order.push('daily');return {reset:1,remaining:4,failed:1}}};
  if(n==='./ftfDailyReset')return {resetDailyFtf:async()=>{order.push('ftf');return {reset:0,remaining:0,failed:0}}};
  if(n==='./ftfRollover')return {rolloverDailyFtf:async()=>{order.push('rollover');return {moved:0,remaining:0,failed:0}}};
 }
 return load.call(this,n,p,...args);
};
let order=[];
(async()=>{
 const {resetDailyPprtuz}=require('../src/services/pprtuzDailyReset.ts');const settings={notionDataSourceId:'source'},now=new Date('2026-11-19T01:00:00-06:00');
 const before=await resetDailyPprtuz(settings,'Neftali','2026-11-19',new Date('2026-11-19T00:30:00-06:00'));assert.equal(before.reset,0);assert.equal(queries,0);
 let report=await resetDailyPprtuz(settings,'Neftali','2026-11-19',now);assert.equal(report.reset,10);assert.equal(report.remaining,15);assert.equal(job,'pending');
 report=await resetDailyPprtuz(settings,'Neftali','2026-11-19',now);assert.equal(report.reset,10);assert.equal(report.remaining,5);
 report=await resetDailyPprtuz(settings,'Neftali','2026-11-19',now);assert.equal(report.reset,5);assert.equal(report.remaining,0);assert.equal(job,'completed');
 report=await resetDailyPprtuz(settings,'Neftali','2026-11-19',now);assert.equal(report.skipped,'completed');assert.equal(patches,25);assert.equal(events,25);assert.equal(queries,3);
 const {prepareDailyFtf}=require('../src/services/prepareDailyFtf.ts');const prepared=await prepareDailyFtf({},'Neftali','2026-11-19',now);
 assert.deepEqual(order,['daily','ftf','rollover'],'daily stage resets before FTF jobs change page timestamps; failures stop retries');assert.equal(prepared.remaining,4);assert.equal(prepared.failed,1);
 console.log('OK reinicio diario: 25 actividades en lotes, idempotencia, antes de 01:00 sin consultas, orden del respaldo y pendientes/errores sin ocultar. Servicios simulados.');
})().catch(e=>{console.error(e);process.exitCode=1});
