const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const {activeResultsFirst,activeGroupsFirst,isCompletedResult}=require(root+'/src/lib/activeResultsFirst.ts');
const done={id:'done',name:'zREVISION terminada',updateStatus:'TERMINADA'},pending={id:'pending',name:'prtuzREVISION trabajo',updateStatus:'PENDIENTE'},review={id:'review',name:'rtuzREVISION revisión',updateStatus:'EN REVISIÓN'},suspended={id:'suspended',name:'sprtuzREVISION trabajo',updateStatus:'SUSPENDIDA'},file={id:'file',name:'manual terminado.docx'};
const rows=[done,pending,{...done,id:'done2'},review,suspended,file],snapshot=structuredClone(rows);
assert.deepEqual(activeResultsFirst(rows).map(r=>r.id),['pending','review','suspended','file','done','done2']);assert.deepEqual(rows,snapshot);
assert.equal(isCompletedResult({name:'prtuzREVISION Pendiente',updateStatus:'TERMINADA'}),true);
assert.equal(isCompletedResult({name:'zREVISION Texto viejo',updateStatus:'PENDIENTE'}),false);
assert.equal(isCompletedResult(file),false);assert.equal(isCompletedResult({name:'zREVISION tarea'}),true);
assert.equal(isCompletedResult({Name:'Trabajo',UpdateStatus:'COMPLETED'}),true);
// Every group mode shares this partition, without moving records to another group.
for(const mode of ['domain','domain_nobilling','project_suffix','month','name','name_noterminated','area','area_nobilling','person']){
 const groups=[{key:mode+' finished',items:[done]},{key:mode+' mixed',items:[done,pending,review]},{key:mode+' active',items:[suspended,file]}];
 const grouped=activeGroupsFirst(groups);assert.deepEqual(grouped.map(g=>g.key),[mode+' mixed',mode+' active',mode+' finished']);assert.deepEqual(grouped[0].items.map(r=>r.id),['pending','review','done']);assert.deepEqual(groups[1].items.map(r=>r.id),['done','pending','review']);
}
// Partition the full result set before slicing pages, not just each visible page.
const many=[...Array.from({length:80},(_,i)=>({...done,id:'d'+i})),...Array.from({length:80},(_,i)=>({...pending,id:'p'+i}))];
const sorted=activeResultsFirst(many);assert.ok(sorted.slice(0,80).every(r=>!isCompletedResult(r)));assert.ok(sorted.slice(80).every(isCompletedResult));assert.equal(new Set(sorted.map(r=>r.id)).size,160);
assert.deepEqual(activeResultsFirst([]),[]);assert.deepEqual(activeGroupsFirst([]),[]);
console.log('OK: activas arriba y terminadas abajo, orden estable, estados oficiales, grupos mixtos y solo terminados, todas las agrupaciones, paginación y datos sin modificar.');
