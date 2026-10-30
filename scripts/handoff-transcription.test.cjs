const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {handoffTitle}=require(root+'/src/services/handoffTitle.ts');
assert.equal(handoffTitle('prtuzREVISION coti 26-[10OCT] Trabajo [dominio.com] acal john','Acalli','Karla'),'prtuzREVISION coti 26-[10OCT] Trabajo [dominio.com] kkarl john');
assert.equal(handoffTitle('prtuzREVISION nneft002 Trabajo gena','Neftali','Andrade'),'prtuzREVISION aandr002 Trabajo gena');
assert.equal(handoffTitle('sprtuzREVISION Trabajo','Neftali','Karla'),'sprtuzREVISION kka11 Trabajo');
const {wavChunk}=require(root+'/src/lib/transcriptionAudio.ts');
let pageWrites=0,metadataWrites=0,prepared=[],confirmed=[],flow,active=true,conflict=false,failHistory=false;
const id='11111111-1111-1111-1111-111111111111',at=t=>'2026-10-15T'+t+':00-06:00';
let current={id,url:'https://www.notion.so/'+id,properties:{Name:{type:'title',title:[{plain_text:'prtuzREVISION Trabajo nneft gena'}]},Responsable:{type:'select',select:{name:'Neftali'}},Estado:{type:'status',status:{name:'Por hacer'}},'Fecha POR Hacer':{type:'date',date:{start:at('10:00'),end:at('11:00')}}}};
const load=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.endsWith('notionMutations.ts')){
  if(name==='./reliableOperations')return {operationKey:(...p)=>p.join(':'),withActivityLease:async(_,fn)=>fn()};
  if(name==='./reviewNotifications')return {sendReviewNotification:async()=>({PageId:'notice',PageUrl:'https://www.notion.so/notice'})};
  if(name==='./teamDirectory')return {activeTeam:async()=>active?[{name:'Karla'},{name:'Andrade'}]:[]};
  if(name==='./activityHandoffs')return {prepareHandoff:async(_,input)=>{if(failHistory)throw Error('historial no disponible');prepared.push(structuredClone(input));return 'handoff-'+prepared.length;},confirmHandoff:async(_,id)=>confirmed.push(id)};
  if(name==='./notionCalendar')return {clearReadBlocksCache:()=>{},assignedField:p=>['Responsable',p.properties.Responsable],assignedPerson:p=>p.properties.Responsable.select.name,calendarStatusField:p=>['Estado',p.properties.Estado],readReviewFlow:async()=>flow,saveReviewFlow:async(_,__,f)=>{metadataWrites++;flow=f;},cacheReviewFlowMemory:()=>{},clearReviewFlowMemory:()=>{},readChecklist:async()=>[{id:'check',text:'Preservar',isChecked:true}],queryCalendarPages:async()=>conflict?[{id:'22222222-2222-2222-2222-222222222222',properties:{...current.properties,Responsable:{type:'select',select:{name:'Karla'}}}}]:[],resolveTeamPersonId:async()=>null};
 }
 return load.call(this,name,parent,...rest);
};
global.fetch=async(url,opts={})=>{
 const target=String(url).split('/v1/')[1];let data;
 if(target==='pages/'+id&&(!opts.method||opts.method==='GET'))data=current;
 else if(target==='pages/'+id&&opts.method==='PATCH'){pageWrites++;current={...current,properties:{...current.properties,...JSON.parse(opts.body).properties}};data=current;}
 else if(target==='blocks/'+id+'/children'&&opts.method==='PATCH')data={results:JSON.parse(opts.body).children.map((block,i)=>({...block,id:'observation-'+i}))};
 else throw Error('Unexpected write/request '+target);
 return new Response(JSON.stringify(data),{status:200});
};
(async()=>{
 const wav=await wavChunk(new Float32Array([0,-1,1]),16000).arrayBuffer();assert.equal(Buffer.from(wav).toString('ascii',0,4),'RIFF');assert.equal(new DataView(wav).getUint32(40,true),6);assert.equal(new DataView(wav).getInt16(46,true),-32768);
 const {mutateActivity}=require(root+'/src/services/notionMutations.ts'),settings={notionToken:'TEST',currentUser:'Neftali'};
 const update={handoff:true,person:'Karla',note:'Continuar cotización',leaveVisualCopy:true};
 await assert.rejects(()=>mutateActivity(settings,'Brian',id,update),/Solo el responsable/);assert.equal(pageWrites,0);
 active=false;await assert.rejects(()=>mutateActivity(settings,'Neftali',id,update),/perfil activo/);active=true;
 conflict=true;await assert.rejects(()=>mutateActivity(settings,'Neftali',id,update),/empalma/);conflict=false;assert.equal(prepared.length,0);
 failHistory=true;await assert.rejects(()=>mutateActivity(settings,'Neftali',id,update),/historial/);failHistory=false;assert.equal(pageWrites,0);
 const result=await mutateActivity(settings,'Neftali',id,update);assert.equal(result.id,id);assert.equal(pageWrites,1);assert.ok(metadataWrites>=1);assert.equal(current.properties.Responsable.select.name,'Karla');assert.equal(prepared[0].snapshot.start,at('10:00'));assert.equal(prepared[0].snapshot.checklistCompleted,1);assert.equal(prepared[0].note,'Continuar cotización');assert.equal(confirmed.length,1);
 // Passing the original onward creates another historical entry, never another page.
 await mutateActivity(settings,'Karla',id,{...update,person:'Andrade',note:'Enviar al cliente',leaveVisualCopy:false});assert.equal(pageWrites,2);assert.equal(prepared[1].from,'Karla');assert.equal(prepared[1].copy,false);assert.equal(prepared[0].snapshot.person,'Neftali');assert.equal(flow.State,'handoff');
 console.log('OK handoff: permisos, equipo activo, empalmes, historial previo, misma página, cadena, nota y copia congelada; WAV mono validado. Notion simulado.');
})().catch(e=>{console.error(e);process.exitCode=1;});
