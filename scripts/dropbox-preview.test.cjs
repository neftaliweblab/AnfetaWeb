const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
let calls=[],rejectThumbnail=false;
global.fetch=async(url,options)=>{
 assert.ok(String(url).startsWith('https://content.dropboxapi.com/2/files/'),'No external calls permitted');
 const args=JSON.parse(options.headers['Dropbox-API-Arg']);calls.push({url,args});
 if(rejectThumbnail&&String(url).endsWith('get_thumbnail_v2'))return new Response('{}',{status:409});
 return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':String(url).endsWith('get_thumbnail_v2')?'application/octet-stream':'image/png'}});
};
(async()=>{
 const {getDropboxFileContent}=require(root+'/src/services/dropboxUpload.ts');
 const preview=await getDropboxFileContent('C:\\Users\\nanoc\\Dropbox\\DRX\\Captura á.png','sl.TEST_ONLY',true);
 assert.equal(calls[0].args.resource.path,'/DRX/Captura á.png');assert.equal(preview.contentType,'image/jpeg');
 assert.deepEqual([...new Uint8Array(await new Response(preview.body).arrayBuffer())],[255,216,255,217]);
 const tiff=await getDropboxFileContent('/DRX/contacto.tif','sl.TEST_ONLY',true);assert.equal(tiff.contentType,'image/jpeg');assert.ok(calls.at(-1).url.endsWith('get_thumbnail_v2'));await new Response(tiff.body).arrayBuffer();
 const original=await getDropboxFileContent('/DRX/captura.png','sl.TEST_ONLY',true,true);assert.equal(original.contentType,'image/png');assert.ok(calls.at(-1).url.endsWith('/download'));await new Response(original.body).arrayBuffer();
 rejectThumbnail=true;const fallback=await getDropboxFileContent('/DRX/captura.png','sl.TEST_ONLY',true);assert.equal(fallback.contentType,'image/png');assert.ok(calls.at(-1).url.endsWith('/download'));await new Response(fallback.body).arrayBuffer();
 console.log('OK Dropbox: ruta Windows y Unicode, miniatura JPEG, TIF, stream y recuperación mediante original. API simulada.');
})().catch(e=>{console.error(e);process.exitCode=1;});
