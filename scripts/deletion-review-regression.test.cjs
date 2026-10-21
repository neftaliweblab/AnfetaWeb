const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const {archiveNotionPage}=require('../src/services/notionDeletion.ts'),{reviewPreflight}=require('../src/lib/reviewPreflight.ts');
const {retainSearchResults}=require('../src/lib/retainSearchResults.ts'),{applyNotionStates}=require('../src/lib/applyNotionStates.ts');
const {ACTIVITY_TAGS,parseActivityTag,matchesActivityTagQuery}=require('../src/services/activityTags.ts');
const id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',row={id,externalId:id,source:'Notion',name:'Anterior',serverModified:'2026-10-20T10:00:00Z'};
function mock(sequence){const calls=[];return {calls,request:async(_url,init)=>{calls.push(init.method);const [status,data]=sequence.shift();return Response.json(data,{status});}};}
(async()=>{
 for(const flag of ['archived','in_trash']){const m=mock([[200,{[flag]:true}]]);assert.equal((await archiveNotionPage('test',id,m.request)).alreadyArchived,true);assert.deepEqual(m.calls,['GET']);}
 let m=mock([[200,{}],[200,{archived:true}]]);await archiveNotionPage('test',id,m.request);assert.deepEqual(m.calls,['GET','PATCH']);
 m=mock([[200,{}],[400,{message:'already archived'}],[200,{archived:true}]]);assert.equal((await archiveNotionPage('test',id,m.request)).alreadyArchived,true);
 m=mock([[404,{message:'not found'}]]);await assert.rejects(()=>archiveNotionPage('test',id,m.request),/faltar acceso/);assert.deepEqual(m.calls,['GET']);
 m=mock([[403,{message:'permission denied'}]]);await assert.rejects(()=>archiveNotionPage('test',id,m.request),/permission/);assert.deepEqual(m.calls,['GET']);
 m=mock([[200,{}],[200,{archived:false}],[200,{}],[200,{}]]);await assert.rejects(()=>archiveNotionPage('test',id,m.request),/no confirmó/);
 const fresh={...row,name:'gge11 nuevo',serverModified:'2026-10-21T10:00:00Z'};
 assert.deepEqual(retainSearchResults([fresh],{items:[row],warning:'stale'}),[fresh]);
 assert.deepEqual(retainSearchResults([fresh],{items:[row]}),[fresh]);
 assert.deepEqual(retainSearchResults([fresh],{items:[row],warning:'stale',deletedPageIds:[id]}),[]);
 assert.deepEqual(applyNotionStates([row],[{id,deleted:true}]),[]);
 assert.equal(applyNotionStates([row],[{id,unverified:true}])[0],row);
 assert.equal(applyNotionStates([row],[{id,name:'gge11',assignedPerson:'Genaro',updateStatus:'PENDIENTE',serverModified:fresh.serverModified}])[0].name,'gge11');
 const base={title:'prtuzREVISION iis11',status:'Por hacer',person:'Isaias',start:'2026-10-21T10:00:00-06:00',end:'2026-10-21T11:00:00-06:00'};
 const state={...base,reviewFlow:{UpdatedAt:'2026-10-21T08:00:00Z'}};
 assert.equal(reviewPreflight(base,state).changed,false,'Unknown flow is hydrated before CAS');
 assert.equal(reviewPreflight({...base,reviewFlowScanned:true},state).changed,true);
 assert.equal(reviewPreflight(state,{...state,reviewFlow:{UpdatedAt:'new'}}).changed,true);
 assert.equal(reviewPreflight(base,{...base,person:'John'}).changed,true);
 assert.equal(reviewPreflight(base,{...base,start:'different'}).changed,true);
 for(const tag of Object.values(ACTIVITY_TAGS)){
  assert.equal(parseActivityTag(tag.active+'000').priority,'00');assert.equal(matchesActivityTagQuery(tag.active+'000',tag.active+'00'),true);
  assert.equal(matchesActivityTagQuery(tag.reference+'000',tag.active+'00'),false);
  assert.equal(parseActivityTag(tag.active+'1').priority,'11');assert.equal(matchesActivityTagQuery(tag.active+'1',tag.active+'11'),true);
  assert.equal(matchesActivityTagQuery(tag.reference+'1',tag.active+'11'),false);
  assert.equal(parseActivityTag(tag.active+'0').priority,'00');assert.equal(parseActivityTag(tag.reference+'1').priority,'11');
 }
 console.log('OK: borrado idempotente, papelera, carrera de archivado, 404 ambiguo, permisos, confirmación, caché antigua, estados actuales, preflight seguro y variantes 000 de todo el equipo.');
})().catch(e=>{console.error(e);process.exitCode=1;});
