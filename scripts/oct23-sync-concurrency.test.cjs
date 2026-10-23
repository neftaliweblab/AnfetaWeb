const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,p);


const timers=new Map();let key=0;const interval=setInterval,clear=clearInterval;
global.setInterval=(fn,ms)=>{timers.set(++key,{fn,ms});return key;};global.clearInterval=id=>timers.delete(id);
global.window=new EventTarget();global.document=Object.assign(new EventTarget(),{hidden:false});const storage=new Map();global.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const channels=[];global.BroadcastChannel=class{constructor(){channels.push(this);}close(){}};
global.fetch=async()=>Response.json({events:[],timestamp:'2026-10-23T16:00:00Z'});
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
(async()=>{try{
 const {subscribeNotionPages}=require('../src/lib/notionPageWatchHub.ts');const a='a'.repeat(32),b='b'.repeat(32);let blocked=true,content=0;const applied=new Map();window.addEventListener('anfeta_page_content_changed',()=>content++);
 const stop=subscribeNotionPages('John',{calendar:true,rows:()=>[],onStates:states=>{const ready=states.filter(s=>!blocked||s.id!==a);for(const s of ready)applied.set(s.id,s);return ready.map(s=>s.id);}});await flush();
 const emit=states=>channels[0].onmessage({data:{owner:'John',states}});
 emit([{id:a,name:'Primero',updateStatus:'EN REVISIÓN',serverModified:'2026-10-23T16:01:00Z'},{id:b,name:'Otro proyecto',serverModified:'2026-10-23T16:01:00Z'}]);assert.equal(applied.has(a),false);assert.equal(applied.get(b).name,'Otro proyecto','A save must not block unrelated pages');
 emit([{id:a,scheduledDate:'2026-10-24T10:00:00-06:00',serverModified:'2026-10-23T16:02:00Z'}]);blocked=false;[...timers.values()][0].fn();await flush();assert.equal(applied.get(a).name,'Primero');assert.equal(applied.get(a).updateStatus,'EN REVISIÓN');assert.equal(applied.get(a).scheduledDate,'2026-10-24T10:00:00-06:00');
 emit([{id:a,name:'Viejo',serverModified:'2026-10-23T16:00:00Z'}]);assert.equal(applied.get(a).name,'Primero');
 emit([{id:a,contentChanged:true,serverModified:'2026-10-23T16:03:00Z'}]);assert.equal(content,1);emit([{id:a,name:'Nuevo',serverModified:'2026-10-23T16:04:00Z'}]);assert.equal(content,1,'A property update must not replay the previous content invalidation');
 emit([{id:a,calendarActivity:{pageId:a,title:'Título de tarjeta nuevo',start:'2026-10-23T12:00:00-06:00',end:'2026-10-23T13:00:00-06:00',serverModified:'2026-10-23T16:05:00Z'},serverModified:'2026-10-23T16:05:00Z'}]);assert.equal(applied.get(a).name,'Título de tarjeta nuevo');assert.equal(applied.get(a).calendarActivity.title,'Título de tarjeta nuevo');
 emit([{id:a,deleted:true,serverModified:'2026-10-23T16:06:00Z'}]);emit([{id:a,deleted:false,name:'No resucitar',serverModified:'2026-10-23T16:05:00Z'}]);assert.equal(applied.get(a).deleted,true);
 stop();assert.equal(timers.size,0);
 const {mergeCalendarSnapshot}=require('../src/lib/calendarUpdates.ts');const page={pageId:b,title:'Llegó durante lectura',person:'John',status:'POR HACER',start:'2026-10-23T10:00:00-06:00',end:'2026-10-23T11:00:00-06:00',serverModified:'2026-10-23T16:01:00Z'};
 assert.equal(mergeCalendarSnapshot([page],[],'2026-10-23',Date.parse('2026-10-23T16:00:00Z')).length,1);assert.equal(mergeCalendarSnapshot([page],[],'2026-10-23',Date.parse('2026-10-23T16:02:00Z')).length,0);
 console.log('OK concurrencia: entrega parcial durante guardado, deltas acumulados, lecturas antiguas rechazadas, invalidación de contenido sin repetición, bajas sin resurrección y snapshot anterior a un alta.');
 }finally{global.setInterval=interval;global.clearInterval=clear;}})().catch(e=>{console.error(e);process.exitCode=1;});
