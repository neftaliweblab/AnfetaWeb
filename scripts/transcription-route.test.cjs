const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
let authenticated=true,providerFailure=false,providerCalls=0,notionWrites=0,dropboxWrites=0,accessChecks=0,blocks=[];
const load=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.endsWith(path.join('transcription','route.ts'))){
  if(name==='next/server')return {NextResponse:{json:(data,opts)=>Response.json(data,opts)}};
  if(name==='@/services/serverAuth')return {requireActor:async()=>{if(!authenticated)throw Error('Inicia sesión.');return 'Neftali';},assertSameOrigin:()=>{}};
  if(name==='@/services/serverSettings')return {getSettings:()=>({notionToken:'TEST',currentUser:'Neftali'})};
  if(name==='@/services/notionCalendar')return {assertChecklistAccess:async()=>{accessChecks++;},readBlocks:async()=>blocks,clearReadBlocksCache:()=>{}};
  if(name==='@/services/notionMutations')return {notionRequest:async(_,target,method,body)=>{assert.equal(method,'PATCH');assert.match(target,/^blocks\//);notionWrites++;blocks.push(...body.children);}};
  if(name==='@/services/dropboxUpload')return {uploadDropboxCloud:async(filename,bytes,folder)=>{dropboxWrites++;assert.equal(bytes.toString(),'Texto de prueba');return {path:folder+'/'+filename};}};
  if(name==='@/services/reliableOperations')return {operationKey:(...a)=>a.join(':'),withActivityLease:async(_,fn)=>fn()};
 }
 return load.call(this,name,parent,...rest);
};
global.fetch=async(url,opts)=>{assert.equal(url,'https://api.groq.com/openai/v1/audio/transcriptions');providerCalls++;assert.equal(opts.body.get('model'),'whisper-large-v3-turbo');assert.equal(opts.body.get('file').type,'audio/wav');return Response.json(providerFailure?{error:'provider failed'}:{text:'Texto de prueba'},{status:providerFailure?503:200});};
const route=require(root+'/src/app/api/transcription/route.ts');
const req=body=>new Request('http://localhost/api/transcription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
(async()=>{
 delete process.env.GROQ_API_KEY;let res=await route.GET(new Request('http://localhost/api/transcription'));assert.equal((await res.json()).available,false);
 const {wavChunk}=require(root+'/src/lib/transcriptionAudio.ts');const audio=()=>{const form=new FormData();form.set('file',wavChunk(new Float32Array(16000),16000),'audio.wav');return new Request('http://localhost/api/transcription',{method:'POST',body:form});};
 res=await route.POST(audio());assert.equal(res.status,503);assert.equal(providerCalls,0);
 process.env.GROQ_API_KEY='FAKE_FOR_TEST_ONLY';authenticated=false;res=await route.POST(audio());assert.notEqual(res.status,200);assert.equal(providerCalls,0);authenticated=true;
 res=await route.POST(audio());assert.equal(res.status,200);assert.equal((await res.json()).text,'Texto de prueba');
 providerFailure=true;res=await route.POST(audio());assert.equal(res.status,400);assert.match((await res.json()).error,/video está guardado/);assert.equal(notionWrites,0);assert.equal(dropboxWrites,0);
 const body={action:'save',pageId:'11111111-1111-1111-1111-111111111111',text:'Texto de prueba',filename:'Grabacion.webm'};
 res=await route.POST(req(body));assert.equal(res.status,200);res=await route.POST(req(body));assert.equal(res.status,200);assert.equal(notionWrites,1);assert.equal(accessChecks,2);
 res=await route.POST(req({...body,pageId:'',folder:'/DRX/prueba'}));assert.equal(res.status,200);assert.equal(dropboxWrites,1);
 res=await route.POST(req({...body,text:''}));assert.equal(res.status,400);assert.equal(notionWrites,1);
 console.log('OK transcripción: sin clave/sesión no envía audio, proveedor aislado del video, permisos, guardado idempotente en Notion y TXT en Dropbox. Proveedores simulados.');
})().catch(e=>{console.error(e);process.exitCode=1;});
