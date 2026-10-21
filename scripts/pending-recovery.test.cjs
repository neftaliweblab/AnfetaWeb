const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript'),vm=require('vm'),{randomUUID}=require('crypto');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const ops=require('../src/lib/pendingOperations.ts');
const code=ts.transpileModule(fs.readFileSync(root+'/src/components/usePendingTasks.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const data=new Map(),storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),key:index=>[...data.keys()][index],get length(){return data.size;}};
const flush=async()=>{for(let i=0;i<30;i++)await new Promise(setImmediate);};
let remote=[],revision=1,offline=false,conflict=false,gets=0,posts=0;
const fetchMock=async(_url,init={})=>{
 if(offline)throw Error('Sin conexión');
 if(!init.method){gets++;return {ok:true,json:async()=>({items:structuredClone(remote),revision})};}
 posts++;const body=JSON.parse(init.body);
 if(conflict){conflict=false;remote.push({id:'other',title:'Agregado en otra ventana'});revision++;return {ok:false,json:async()=>({error:'La configuración cambió en otro dispositivo'})};}
 if(body.expectedRevision!==revision)return {ok:false,json:async()=>({error:'revision_conflict'})};
 remote=body.payload;revision++;return {ok:true,json:async()=>({success:true,items:structuredClone(remote),revision})};
};
function mount(user){
 const effects=[],states=[],events=new Map();let index=0;
 const react={useState:initial=>{const at=index++;states[at]=initial;return [initial,value=>{states[at]=typeof value==='function'?value(states[at]):value;}];},useRef:initial=>({current:initial}),useCallback:fn=>fn,useEffect:fn=>effects.push(fn)};
 const exports={};vm.runInNewContext(code,{exports,require:name=>name==='react'?react:ops,fetch:fetchMock,localStorage:storage,crypto:{randomUUID},Date,Error,window:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)}});
 const api=exports.usePendingTasks(user,true),cleanups=effects.map(fn=>fn());
 return {api,states,retry:()=>events.get('anfeta_retry_pending')?.(),close:()=>cleanups.forEach(fn=>fn?.())};
}
(async()=>{
 let app=mount('John');await flush();assert.ok(gets);
 conflict=true;app.api.handleAddPendingTask({title:'Mi pendiente',query:'anfeta.com',isCompleted:false});await flush();
 assert.equal(remote.length,2);assert.ok(remote.some(t=>t.id==='other'));const own=remote.find(t=>t.id!=='other');
 app.api.handleEditPendingTask(own.id,{title:'Editado'});app.api.handleTogglePendingTask(own.id);await flush();
 assert.equal(remote.find(t=>t.id===own.id).title,'Editado');assert.equal(remote.find(t=>t.id===own.id).isCompleted,true);
 offline=true;app.api.handleAddPendingTask({title:'Sin conexión',query:'',isCompleted:false});await flush();
 assert.ok(app.states[0].some(t=>t.title==='Sin conexión'));assert.match(app.states[1],/conservan/);app.close();
 // Recovery after reload replays the persisted operation instead of replacing it with stale server data.
 offline=false;app=mount('John');await flush();assert.equal(remote.filter(t=>t.title==='Sin conexión').length,1);assert.equal(app.states[1],'');
 const before=posts;app.retry();await flush();assert.equal(posts,before,'Confirmed entries must not be replayed');
 app.api.handleDeletePendingTask(own.id);await flush();assert.ok(!remote.some(t=>t.id===own.id));app.close();
 offline=true;const other=mount('Neftali');await flush();assert.equal(other.states[0].length,0,'Local account copies must stay isolated');other.close();
 const original=[{id:'a',title:'A',query:'preservar'},{id:'b',title:'B'}];
 assert.deepEqual(ops.applyPendingOperation(original,{key:'k',id:'a',patch:{title:'Nuevo'}}),[{id:'a',title:'Nuevo',query:'preservar'},{id:'b',title:'B'}]);
 assert.deepEqual(ops.applyPendingOperation([...original,{id:'new'}],{key:'k',remove:['a','b']}),[{id:'new'}]);
 console.log('OK pendientes: carga independiente, conflicto de revisión, cambios rápidos, desconexión, recuperación al recargar, reintento idempotente, borrado y aislamiento por cuenta.');
})().catch(e=>{console.error(e);process.exitCode=1;});
