const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
let calls=0,queue=[];
Module._load=function(name,parent,...rest){if(parent?.filename.replace(/\\/g,'/').endsWith('/api/jobs/ftf/route.ts')){
 if(name==='@/services/serverSettings')return {getSettings:()=>({notionToken:'test'})};
 if(name==='@/services/prepareDailyFtf')return {prepareDailyFtf:async()=>{calls++;return queue.shift();}};
 }return load.call(this,name,parent,...rest);};
global.fetch=async()=>{throw Error('No live network in tests');};
const secret=process.env.CRON_SECRET,actor=process.env.ANFETA_ROBOT_PERSON;
(async()=>{try{
 const {GET}=require('../src/app/api/jobs/ftf/route.ts');delete process.env.CRON_SECRET;
 assert.equal((await GET(new Request('http://localhost/api/jobs/ftf'))).status,503);
 process.env.CRON_SECRET='test-only-'.repeat(5);assert.equal((await GET(new Request('http://localhost/api/jobs/ftf'))).status,401);assert.equal(calls,0);
 const req=()=>new Request('http://localhost/api/jobs/ftf',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}});
 process.env.ANFETA_ROBOT_PERSON='Karla';assert.equal((await GET(req())).status,503);assert.equal(calls,0);
 process.env.ANFETA_ROBOT_PERSON='John';queue=[{reset:10,moved:2,remaining:1,failed:0},{reset:1,moved:0,remaining:0,failed:0}];let res=await GET(req()),data=await res.json();assert.equal(res.status,200);assert.equal(data.reset,11);assert.equal(data.moved,2);assert.equal(calls,2);
 queue=[{reset:0,moved:0,remaining:0,failed:1}];res=await GET(req());assert.equal(res.status,503);assert.equal((await res.json()).success,false);
 console.log('OK cron autentica, requiere Dirección, suma lotes y traslados, devuelve fallo en vez de éxito si hay pendientes/errores. Sin llamadas reales.');
 }finally{if(secret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=secret;if(actor===undefined)delete process.env.ANFETA_ROBOT_PERSON;else process.env.ANFETA_ROBOT_PERSON=actor;}})().catch(e=>{console.error(e);process.exitCode=1;});
