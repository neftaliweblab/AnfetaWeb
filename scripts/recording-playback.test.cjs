const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const page='11111111-1111-4111-8111-111111111111',first='22222222-2222-4222-8222-222222222222',second='33333333-3333-4333-8333-333333333333';
const callout=(id,text)=>({type:'callout',callout:{rich_text:[{plain_text:'Adjunto ANFETA: Prueba\n'+text+'\n[UPLOAD_REF:'+id+']'}]}});
let blocks=[callout(first,'Descripción'),{type:'video',video:{type:'file',file:{url:'https://prod-files-secure.s3.us-west-2.amazonaws.com/old.webm?sig=one'}}},callout(second,'Dropbox: /DRX/Grabaciones/prueba.webm')],authorized=true,reads=0,links=0;
const load=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.endsWith('recordingPlayback.ts')){
  if(name==='./notionMutations')return {notionRequest:async()=>{reads++;return {id:page,url:'https://www.notion.so/'+page};}};
  if(name==='./notionCalendar')return {readBlocks:async()=>blocks,clearReadBlocksCache:()=>{}};
  if(name==='./dropboxUpload')return {getDropboxAccessToken:async()=> 'SERVER_SECRET_TEST'};
 }
 if(parent?.filename.replace(/\\/g,'/').endsWith('/api/recording/route.ts')){
  if(name==='@/services/serverAuth')return {requireActor:async()=>{if(!authorized)throw Error('Inicia sesión');return 'Neftali';}};
  if(name==='@/services/serverSettings')return {getSettings:()=>({notionToken:'NOTION_SERVER_TEST'})};
 }
 return load.call(this,name,parent,...rest);
};
global.fetch=async(url,opts)=>{assert.equal(url,'https://api.dropboxapi.com/2/files/get_temporary_link');assert.equal(opts.headers.Authorization,'Bearer SERVER_SECRET_TEST');assert.equal(JSON.parse(opts.body).path,'/DRX/Grabaciones/prueba.webm');links++;return Response.json({link:'https://dl.dropboxusercontent.com/video.webm?version='+links,metadata:{name:'prueba.webm'}});};
(async()=>{
 const service=require(root+'/src/services/recordingPlayback.ts'),settings={notionToken:'TEST',currentUser:'Neftali'};
 assert.match(service.recordingPlaybackUrl('https://anfeta.test',page,first),/^https:\/\/anfeta.test\/recording\?page=/);
 let result=await service.readRecordingPlayback(settings,page);assert.equal(result.items.length,2);assert.equal(result.items[0].url,undefined);assert.equal(links,0);
 result=await service.readRecordingPlayback(settings,page,first);assert.match(result.items[0].url,/old.webm/);assert.equal(links,0);
 result=await service.readRecordingPlayback(settings,page,second);assert.match(result.items[0].url,/version=1/);result=await service.readRecordingPlayback(settings,page,second);assert.match(result.items[0].url,/version=2/);assert.ok(!JSON.stringify(result).includes('SERVER_SECRET'));
 await assert.rejects(()=>service.readRecordingPlayback(settings,'bad'),/Identificador/);await assert.rejects(()=>service.readRecordingPlayback(settings,page,'44444444-4444-4444-8444-444444444444'),/No se encontró/);
 blocks=[callout(first,''),{type:'file',file:{name:'old.webm',file:{url:'https://prod-files-secure.s3.us-west-2.amazonaws.com/file'}}}];result=await service.readRecordingPlayback(settings,page,first);assert.ok(result.items[0].url);
 blocks=[callout(first,''),{type:'video',video:{file:{url:'https://evil.example/video.webm'}}}];await assert.rejects(()=>service.readRecordingPlayback(settings,page,first),/dirección de video válida/);
 const route=require(root+'/src/app/api/recording/route.ts');authorized=false;const before=reads;const response=await route.GET(new Request('https://anfeta.test/api/recording?page='+page));assert.equal(response.status,401);assert.equal(reads,before);assert.equal(response.headers.get('Cache-Control'),'no-store');
 console.log('OK reproductor: acceso autenticado, videos anteriores de Notion, archivos WebM, Dropbox renovable, asociación por lote, hosts limitados y tokens solo en servidor. Proveedores simulados.');
})().catch(e=>{console.error(e);process.exitCode=1;});
