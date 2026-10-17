const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const {activeResultsFirst,activeGroupsFirst,orderSearchResults,getItemGroupKey,isCompletedResult,isBillingItem}=require(root+'/src/lib/activeResultsFirst.ts');

const done={id:'done',name:'zREVISION terminada',updateStatus:'TERMINADA'},pending={id:'pending',name:'prtuzREVISION trabajo',updateStatus:'PENDIENTE'},review={id:'review',name:'rtuzREVISION revisión',updateStatus:'EN REVISIÓN'},suspended={id:'suspended',name:'sprtuzREVISION trabajo',updateStatus:'SUSPENDIDA'},file={id:'file',name:'manual terminado.docx'};
const rows=[done,pending,{...done,id:'done2'},review,suspended,file],snapshot=structuredClone(rows);

// 1. Basic partition
assert.deepEqual(activeResultsFirst(rows).map(r=>r.id),['pending','review','suspended','file','done','done2']);
assert.deepEqual(rows,snapshot);

// 2. Official status priority & never classify as completed just by description
assert.equal(isCompletedResult({name:'prtuzREVISION Pendiente',updateStatus:'TERMINADA'}),true);
assert.equal(isCompletedResult({name:'zREVISION Texto viejo',updateStatus:'PENDIENTE'}),false);
assert.equal(isCompletedResult(file),false);
assert.equal(isCompletedResult({name:'zREVISION tarea'}),true);
assert.equal(isCompletedResult({Name:'Trabajo',UpdateStatus:'COMPLETED'}),true);
assert.equal(isCompletedResult({name:'prtuzREVISION tarea en curso',updateStatus:'POR HACER',description:'Esta actividad ya está terminada por completo',contentSnippet:'terminada y finalizada'}),false);
assert.equal(isCompletedResult({name:'prtuzREVISION tarea sin estado pero descripcion dice terminada',description:'terminada'}),false);

// 3. activeGroupsFirst preserves groups, active/mixed first, completed-only groups last, active rows first inside groups
for(const mode of ['domain','domain_nobilling','project_suffix','month','name','name_noterminated','area','area_nobilling','person']){
  const groups=[{key:mode+' finished',items:[done]},{key:mode+' mixed',items:[done,pending,review]},{key:mode+' active',items:[suspended,file]}];
  const grouped=activeGroupsFirst(groups);
  assert.deepEqual(grouped.map(g=>g.key),[mode+' mixed',mode+' active',mode+' finished']);
  assert.deepEqual(grouped[0].items.map(r=>r.id),['pending','review','done']);
  assert.deepEqual(groups[1].items.map(r=>r.id),['done','pending','review']);
}

// 4. orderSearchResults without grouping
assert.deepEqual(orderSearchResults(rows,'none').map(r=>r.id),['pending','review','suspended','file','done','done2']);
assert.deepEqual(orderSearchResults(rows).map(r=>r.id),['pending','review','suspended','file','done','done2']);

// 5. orderSearchResults with groupings & name_noterminated NEVER excludes completed items
const personRows = [
  {id:'p1_done',name:'John - zREVISION terminado',updateStatus:'TERMINADA'},
  {id:'p1_act',name:'John - prtuzREVISION activo',updateStatus:'PENDIENTE'},
  {id:'p2_done',name:'Karla - zREVISION reporte listo',updateStatus:'TERMINADA'},
  {id:'p3_act',name:'Brian - prtuzREVISION diseño',updateStatus:'PENDIENTE'}
];
for(const mode of ['name','name_noterminated','person']){
  const ordered=orderSearchResults(personRows,mode);
  // John mixed group: p1_act before p1_done
  // Brian active group: p3_act
  // Karla completed group: p2_done at the end
  assert.equal(ordered.length,4,'Completed items must not be excluded in '+mode);
  const ids=ordered.map(r=>r.id);
  assert.ok(ids.indexOf('p1_act') < ids.indexOf('p1_done'), 'Active before done in same group for '+mode);
  assert.ok(ids.indexOf('p1_act') < ids.indexOf('p2_done'), 'Active before completed group for '+mode);
  assert.ok(ids.indexOf('p3_act') < ids.indexOf('p2_done'), 'Active group before completed group for '+mode);
}

// 6. Contiguity and group ordering check: mixed groups active first, pure completed groups last
const monthRows = [
  {id:'m1_done',name:'zREVISION terminada',monthChip:'ENE',updateStatus:'TERMINADA'},
  {id:'m1_act',name:'prtuzREVISION activa',monthChip:'ENE',updateStatus:'PENDIENTE'},
  {id:'m2_done',name:'zREVISION done',monthChip:'FEB',updateStatus:'TERMINADA'},
  {id:'m3_act',name:'prtuzREVISION activo',monthChip:'MAR',updateStatus:'PENDIENTE'},
];
const orderedMonths=orderSearchResults(monthRows,'month');
assert.equal(orderedMonths.length,4);
// Group ENE (mixed) has active before done; Group MAR (active) is before Group FEB; Group FEB (completed only) is last.
assert.deepEqual(orderedMonths.map(r=>r.id),['m1_act','m1_done','m3_act','m2_done']);

// 7. Full set sorting before pagination
const many=[...Array.from({length:80},(_,i)=>({...done,id:'d'+i})),...Array.from({length:80},(_,i)=>({...pending,id:'p'+i}))];
const sorted=activeResultsFirst(many);
assert.ok(sorted.slice(0,80).every(r=>!isCompletedResult(r)));
assert.ok(sorted.slice(80).every(isCompletedResult));
assert.equal(new Set(sorted.map(r=>r.id)).size,160);

// Empty inputs
assert.deepEqual(activeResultsFirst([]),[]);
assert.deepEqual(activeGroupsFirst([]),[]);
assert.deepEqual(orderSearchResults([]),[]);

console.log('OK: activas arriba y terminadas abajo, orden estable, estados oficiales, grupos mixtos y solo terminados, todas las agrupaciones, paginación y datos sin modificar.');
