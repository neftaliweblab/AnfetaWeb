const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
let checked=0;
Module._load=function(name,parent,...rest){if(parent?.filename.replace(/\\/g,'/').endsWith('/src/app/api/data/route.ts')){
if(name==='@/services/serverAuth')return {requireActor:async()=> 'nneft',assertSameOrigin:()=>{}};
if(name==='@/services/serverSettings')return {getSettings:()=>({notionToken:'',currentUser:'nneft'}),saveSettings:()=>{}};
if(name==='@/services/supabaseServer')return {supabaseConfigured:()=>false};
if(name==='@/services/reliableOperations')return {operationKey:(...parts)=>JSON.stringify(parts),durableStep:async(_,run)=>run()};
if(name==='@/services/dropboxBrowserUpload')return {verifiedDropboxReceipt:(receipt,actor,uploadId,index,filename)=>{assert.equal(receipt,'CONFIRMED_RECEIPT');assert.equal(actor,'nneft');assert.equal(index,0);assert.equal(filename,'video.webm');checked++;return {path:'/DRX/anfeta.com.proyecto/video.webm',filename,sizeBytes:12};}};
}return load.call(this,name,parent,...rest);};
global.fetch=async()=>{throw Error('No debe llamar a Dropbox ni a Notion para un archivo ya confirmado.');};
(async()=>{const {NextRequest}=require('next/server'),api=require('../src/app/api/data/route.ts');const response=await api.POST(new NextRequest('https://anfeta.test/api/data',{method:'POST',body:JSON.stringify({action:'unified-upload',payload:{mode:'dropbox',uploadId:'11111111-1111-4111-8111-111111111111',domain:'anfeta.com',root:'proyecto',category:'proyecto',title:'Grabación',files:[{filename:'video.webm',sizeBytes:12,cloudReceipt:'CONFIRMED_RECEIPT'}]}})}));const data=await response.json();assert.equal(response.status,200);assert.equal(data.success,true);assert.equal(checked,1);assert.equal(data.receipts.length,1);assert.equal(data.receipts[0].kind,'dropbox');console.log('OK continuar solo Dropbox: verifica recibo y finaliza sin volver a subir ni requerir Notion. Servicios simulados.');})().catch(error=>{console.error(error);process.exitCode=1;});
