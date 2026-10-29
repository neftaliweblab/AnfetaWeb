const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,p);

const {createActivityDetailQueue}=require('../src/lib/activityDetailQueue.ts');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const run=createActivityDetailQueue(2);let active=0,max=0,started=[],release=[];
 const jobs=Array.from({length:8},(_,i)=>run(async()=>{started.push(i);active++;max=Math.max(max,active);await new Promise(resolve=>release.push(resolve));active--;return i;},new AbortController().signal));
 await tick();assert.equal(started.length,2);for(let i=0;i<4;i++){release.splice(0).forEach(done=>done());await tick();}assert.deepEqual(await Promise.all(jobs),[0,1,2,3,4,5,6,7]);assert.equal(max,2);
 const serial=createActivityDetailQueue(1);let unlock,cancelledStarted=false;
 const first=serial(()=>new Promise(resolve=>unlock=resolve),new AbortController().signal);await tick();
 const controller=new AbortController();const cancelled=serial(async()=>{cancelledStarted=true;},controller.signal);const rejected=assert.rejects(cancelled);controller.abort();await rejected;unlock('ok');await first;await tick();assert.equal(cancelledStarted,false);
 await assert.rejects(serial(async()=>{throw Error('read rejected');},new AbortController().signal),/read rejected/);assert.equal(await serial(async()=>42,new AbortController().signal),42,'Failure releases slot');
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {VisibleActivityDetails}=require('../src/components/VisibleActivityDetails.tsx');let mounted=0;function Heavy(){mounted++;return React.createElement('div',null,'Detalle');}assert.match(renderToStaticMarkup(React.createElement(VisibleActivityDetails,null,React.createElement(Heavy))),/se cargar/);assert.equal(mounted,0,'Bulk expansion must not mount heavy detail before intersection');
 const {PersonalAgendaPane}=require('../src/components/ResultsViewHost/PersonalAgendaPane.tsx');const html=renderToStaticMarkup(React.createElement(PersonalAgendaPane,{currentUser:'Neftali',workspace:true}));assert.match(html,/Desplegar todas/);assert.match(html,/Contraer todas/);
 console.log('OK bulk details: lazy mount, two concurrent reads, queued cancellation, failure recovery and visible agenda controls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
