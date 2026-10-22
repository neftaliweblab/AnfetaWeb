const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const field='Check FTF Pasos Verificados Hoy',day='2026-10-22';let pages=[],patches=[],completed=false;const deliveries=new Map();
const eventCalls=[];
function fixture(id='a'.repeat(32)){return {id,last_edited_time:'2026-10-21T22:00:00Z',properties:{Name:{type:'title',title:[{plain_text:'prtuzREVISION nne11 Prueba'}]},Estado:{type:'status',status:{name:'POR HACER'}},Responsable:{type:'people',people:[{name:'Neftali'}]},'Fecha POR Hacer':{type:'date',date:{start:day+'T10:00:00-06:00',end:day+'T11:00:00-06:00'}},[field]:{type:'checkbox',checkbox:true}}};}
Module._load=function(name,parent,...rest){
 const ftf=parent?.filename.replace(/\\/g,'/').endsWith('/services/ftfDailyReset.ts');
 if(ftf&&name==='./supabaseServer')return {supabaseConfigured:()=>true,supabaseAdmin:()=>({rpc:async(name,args)=>name==='claim_automation_job'?{data:completed?{state:'completed'}:{state:'claimed',token:'job'}}:(completed=!args.p_report?.remaining&&!args.p_report?.failed,{data:true})})};
 if(ftf&&name==='./notionSnapshotCache')return {notionSourceKey:()=> 'test-source'};
 if(ftf&&name==='./notionMutations')return {notionRequest:async(_s,endpoint)=>endpoint.endsWith('/query')?{results:pages.filter(p=>p.properties[field].checkbox),has_more:false}:endpoint.startsWith('data_sources/')?{properties:{[field]:{type:'checkbox'}}}:pages.find(p=>endpoint.endsWith(p.id)),mutateActivity:async(_s,_a,id,updates)=>{assert.equal(updates.ftfVerified,false);assert.equal(updates.expectedFtfVerified,true);assert.equal(updates.ftfDailyReset,true);patches.push({id,updates});const page=pages.find(p=>p.id===id);page.properties[field].checkbox=false;page.last_edited_time=day+'T11:00:00Z';return page;}};
 if(ftf&&name==='./reliableOperations')return {operationKey:(...s)=>s.join(':'),durableStep:async(key,run)=>{if(deliveries.has(key))return deliveries.get(key);const result=await run();deliveries.set(key,result);return result;}};
 if(ftf&&name==='./notionEventSync')return {recordPageEvent:async event=>{eventCalls.push(event);},parseNotionPageProperties:page=>({title:page.properties.Name.title[0].plain_text,person:'Neftali',status:'POR HACER',dateStart:day})};
 return load.call(this,name,parent,...rest);
};
global.fetch=async()=>{throw Error('No real network allowed');};
const {resetDailyFtf,ftfResetCandidate}=require('../src/services/ftfDailyReset.ts');
const {reviewPreflight}=require('../src/lib/reviewPreflight.ts'),{applyNotionStates}=require('../src/lib/applyNotionStates.ts');
const base=fixture();assert.equal(ftfResetCandidate(base,'Neftali',day),true);
for(const patch of ['done','future','locked','today','unchecked']){const p=structuredClone(base);if(patch==='done')p.properties.Estado.status.name='TERMINADA';if(patch==='future')p.properties['Fecha POR Hacer'].date.start='2026-10-23';if(patch==='locked')p.properties.Locked={type:'checkbox',checkbox:true};if(patch==='today')p.last_edited_time=day+'T12:00:00Z';if(patch==='unchecked')p.properties[field].checkbox=false;assert.equal(ftfResetCandidate(p,'Neftali',day),false,patch);}
const a={title:'Prueba',status:'POR HACER',person:'Neftali',start:day+'T10:00:00-06:00',end:day+'T11:00:00-06:00'};
assert.equal(reviewPreflight(a,{...a,start:day+'T16:00:00Z',end:day+'T17:00:00.000Z'}).changed,false);
assert.equal(reviewPreflight(a,{...a,end:day+'T18:00:00Z'}).changed,true);
const row={id:'a'.repeat(32),source:'Notion',name:'Actual',assignedPerson:'Neftali',status:'POR HACER',scheduledDate:day,serverModified:day+'T16:00:00Z'};
assert.equal(applyNotionStates([row],[{id:row.id,serverModified:day+'T15:00:00Z',name:'Viejo'}])[0],row);
const sparse=applyNotionStates([row],[{id:row.id,name:'Nuevo'}])[0];assert.equal(sparse.name,'Nuevo');assert.equal(sparse.assignedPerson,'Neftali');assert.equal(sparse.status,'POR HACER');
const calendar={pageId:row.id,title:'Actual',person:'Neftali',status:'POR HACER',start:day+'T10:00:00-06:00',ftfVerified:true};const changed=applyNotionStates([calendar],[{id:row.id,ftfVerified:false}])[0];assert.equal(changed.ftfVerified,false);assert.equal(changed.title,'Actual');assert.equal(changed.person,'Neftali');
(async()=>{
 const settings={notionToken:'test',currentUser:'Neftali'};assert.equal((await resetDailyFtf(settings,'Neftali',day,new Date(day+'T10:59:00Z'))).skipped,'before_0500_or_other_day');
 pages=Array.from({length:12},(_,i)=>fixture((i+1).toString(16).padStart(32,'0')));let report=await resetDailyFtf(settings,'Neftali',day,new Date(day+'T11:00:00Z'));assert.equal(report.reset,10);assert.equal(report.remaining,2);report=await resetDailyFtf(settings,'Neftali',day,new Date(day+'T11:01:00Z'));assert.equal(report.reset,2);assert.equal(report.remaining,0);assert.equal(patches.length,12);
 pages[0].properties[field].checkbox=true;report=await resetDailyFtf(settings,'Neftali',day,new Date(day+'T12:00:00Z'));assert.equal(report.skipped,'completed');assert.equal(pages[0].properties[field].checkbox,true);assert.equal(patches.length,12);assert.ok(eventCalls.every(e=>e.properties.ftfVerified===false));
 const {sharedCalendarFetch}=require('../src/lib/sharedCalendarFetch.ts');let count=0,finish;global.fetch=()=>{count++;return new Promise(resolve=>finish=resolve);};
 const controller=new AbortController();const first=sharedCalendarFetch('/api/data?type=calendar&date='+day,'Neftali',{signal:controller.signal});const rejected=assert.rejects(first);const second=sharedCalendarFetch('/api/data?type=calendar&date='+day,'Neftali');assert.equal(count,1);controller.abort();await rejected;finish(Response.json({activities:[]}));assert.deepEqual(await (await second).json(),{activities:[]});
 console.log('OK FTF diario por lotes, una vez por día, protección de terminadas y verificaciones nuevas, delta parcial/antiguo, horarios equivalentes y lecturas compartidas con cancelación independiente.');
})().catch(e=>{console.error(e);process.exitCode=1;});
