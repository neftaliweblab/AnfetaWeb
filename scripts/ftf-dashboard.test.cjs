const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const {buildFtfDashboard,canViewFtfDashboard}=require(root+'/src/services/ftfDashboard.ts');
for(const actor of ['John','jjohn','Neftali','Neftalí','nneft','nnetf'])assert.equal(canViewFtfDashboard(actor),true);
for(const actor of ['Genaro','Karla','Andrade',''])assert.equal(canViewFtfDashboard(actor),false);
const day='2026-10-16',people=[{name:'Neftali',alias:'nneft'},{name:'John'},{name:'Karla'},{name:'Emmanuel'}],now=new Date(day+'T19:00:00-06:00');
const base={pageId:'a',person:'Neftali',title:'Actividad',start:day+'T10:00:00-06:00',ftfAvailable:true,ftfVerified:true,checklistCompleted:0,checklistTotal:6};
const receipt={person:'Neftali',date:day,updated:day+'T17:30:00-06:00'},records={['ftf:'+day+':Neftali']:receipt};
let report=buildFtfDashboard('jjohn',day,people,[base],records,now);
assert.equal(report.people.length,3);assert.equal(report.completed,1);assert.equal(report.empty,2);assert.equal(report.deadlinePassed,true);assert.equal(report.people[0].verified,1);assert.equal(report.people[0].completedAt,receipt.updated);
assert.throws(()=>buildFtfDashboard('Genaro',day,people,[base],records),/John/);
report=buildFtfDashboard('John',day,people,[base,{...base,pageId:'missing',ftfVerified:false},{...base,pageId:'late',start:day+'T18:00:00-06:00',ftfVerified:false},{...base,pageId:'mirror',isReviewMirror:true,ftfVerified:false},{...base,pageId:'handoff',isHandoffMirror:true,ftfVerified:false},{...base,pageId:'yesterday',start:'2026-10-15T10:00:00-06:00',ftfVerified:false}],records,now);
assert.equal(report.pending,1);assert.equal(report.completed,0);assert.equal(report.people[0].total,2);assert.deepEqual(report.people[0].pending.map(a=>a.pageId),['missing']);assert.equal(report.people[0].completedAt,receipt.updated);
report=buildFtfDashboard('John',day,people,[base],{},now);assert.equal(report.unconfirmed,1);assert.equal(report.completed,0);
for(const stamp of ['2026-10-15T10:00:00-06:00','invalid']){report=buildFtfDashboard('John',day,people,[base],{['ftf:'+day+':Neftali']:{...receipt,updated:stamp}},now);assert.equal(report.completed,0);}
for(const [time,late] of [['18:00:00',false],['18:00:01',true]]){const r=buildFtfDashboard('John',day,people,[base],{['ftf:'+day+':Neftali']:{...receipt,updated:day+'T'+time+'-06:00',timeKind:'confirmed'}},now);assert.equal(r.people[0].status,'complete');assert.equal(r.people[0].late,late);assert.equal(r.late,late?1:0);}
report=buildFtfDashboard('John',day,people,[{...base,ftfAvailable:false}],records,now);assert.equal(report.people[0].pending.length,1);
report=buildFtfDashboard('John',day,people,[base,base],records,now);assert.equal(report.people[0].total,1);
// API authorization uses the authenticated actor, ignoring a forged person query.
const NativeDate=Date;
global.Date=class extends NativeDate{constructor(...args){if(!args.length)super(now.getTime());else super(...args);}static now(){return now.getTime();}};
const load=Module._load;let reads=0,failQuery=false;
Module._load=function(name,parent,...rest){
 if(parent?.filename.replace(/\\/g,'/').endsWith('/src/app/api/data/route.ts')){
  if(name==='@/services/serverAuth')return {requireActor:req=>{const actor=req.headers.get('x-test-user');if(!actor)throw Error('Inicia sesión para continuar.');return actor;},assertSameOrigin:()=>{}};
  if(name==='@/services/supabaseServer')return {supabaseConfigured:()=>false};
  if(name==='@/services/serverSettings')return {getSettings:()=>({notionToken:'TEST_ONLY',currentUser:'John'})};
  if(name==='@/services/teamDirectory')return {activeTeam:async()=>{reads++;return people;}};
  if(name==='@/services/notionCalendar')return {...load.call(this,name,parent,...rest),queryCalendarPages:async(_,start,end,fresh)=>{
    reads++;assert.equal(start,day);assert.equal(end,'2026-10-17');assert.equal(fresh,true);if(failQuery)throw Error('Lectura no disponible');
    return [{id:'a',properties:{Name:{type:'title',title:[{plain_text:'prtuzREVISION nneft Trabajo'}]},Responsable:{type:'select',select:{name:'Neftali'}},'Fecha POR Hacer':{type:'date',date:{start:base.start}},'Check FTF Pasos Verificados Hoy':{type:'checkbox',checkbox:true}}}];
  }};
  if(name==='@/services/ftfNotifications')return {recordFtfCompletions:async()=>{}};
  if(name==='@/services/userState')return {readUserState:async(_,owner)=>{assert.equal(owner,'John');return {values:{receipts:{ftfCompletions:records}}};}};
 }
 return load.call(this,name,parent,...rest);
};
global.fetch=async()=>{reads++;throw Error('No live calls in tests');};
(async()=>{
 const {GET}=require(root+'/src/app/api/data/route.ts');
 for(const actor of ['Genaro','Karla','Andrade']){const response=await GET(new Request('http://localhost/api/data?type=ftf-dashboard&person=John&date='+day,{headers:{'x-test-user':actor}}));assert.equal(response.status,403);}
 const anonymous=await GET(new Request('http://localhost/api/data?type=ftf-dashboard'));assert.equal(anonymous.status,401);assert.equal(reads,0);
 const authorized=await GET(new Request('http://localhost/api/data?type=ftf-dashboard&date='+day,{headers:{'x-test-user':'jjohn'}}));assert.equal(authorized.status,200);const data=await authorized.json();assert.equal(data.completed,1);assert.equal(data.people.length,3);assert.equal(data.people[0].total,1);
 for(const actor of ['Neftali','Neftalí','nneft','nnetf']){const response=await GET(new Request('http://localhost/api/data?type=ftf-dashboard&date='+day,{headers:{'x-test-user':actor}}));assert.equal(response.status,200);const preview=await response.json();assert.deepEqual(preview.people,data.people);assert.equal(preview.completed,data.completed);}
 failQuery=true;const unavailable=await GET(new Request('http://localhost/api/data?type=ftf-dashboard&date='+day,{headers:{'x-test-user':'John'}}));assert.equal(unavailable.status,502);assert.match((await unavailable.json()).error,/Lectura no disponible/);
 console.log('OK: panel FTF John y Neftalí (incluidos aliases), mismo historial del equipo, otros usuarios 403, sesión obligatoria, corte 18:00 y pendientes independientes del checklist. Servicios simulados.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.Date=NativeDate;});
