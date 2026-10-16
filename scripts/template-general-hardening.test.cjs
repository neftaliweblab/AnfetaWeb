const fs=require('fs'),ts=require('typescript'),assert=require('assert/strict'),Module=require('module');
require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
let tree={},requests=[],fetches=[],uploadStatus='uploaded',downloadMode='normal',badIds=false;
const load=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.endsWith('notionTemplateBody.ts')){
  if(name==='./notionCalendar')return {readBlocks:async(_,id)=>structuredClone(tree[id]||[])};
  if(name==='./notionMutations')return {notionRequest:async(_,url,method,body)=>{requests.push({url,method,body});if(url==='file_uploads')return {id:'upload-one'};return {results:body.children.map((b,i)=>({id:badIds?undefined:'new-'+i,type:b.type}))};}};
 }
 return load.call(this,name,parent,...rest);
};
global.fetch=async(url,opts={})=>{
 fetches.push(String(url));
 if(String(url).endsWith('/send'))return Response.json({status:uploadStatus});
 if(downloadMode==='declared-large')return new Response('x',{headers:{'content-length':String(21*1024*1024)}});
 if(downloadMode==='stream-large'){let count=0;return new Response(new ReadableStream({pull(controller){if(count++<21)controller.enqueue(new Uint8Array(1024*1024));else controller.close();}}));}
 return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}});
};
const {prepareTemplateBody,appendTemplateBody,transferNotionInternalFile}=require('../src/services/notionTemplateBody.ts');
const url='https://s3.us-west-2.amazonaws.com/secure.notion-static.com/image.png';
const image=id=>({id,type:'image',image:{type:'file',file:{url},caption:[]}});
const text=value=>[{type:'text',text:{content:value},annotations:{bold:true}}];
const reset=()=>{requests=[];fetches=[];downloadMode='normal';uploadStatus='uploaded';};
(async()=>{
 // Entire tree must be accepted before uploading the first internal file.
 tree={page:[image('photo'),{id:'unsupported-button',type:'unsupported',unsupported:{block_type:'button'}}]};
 await assert.rejects(()=>prepareTemplateBody({},'page'),/unsupported-button.*unsupported/);assert.equal(fetches.length,0);assert.equal(requests.length,0);
 tree={page:[image('photo'),{id:'table',type:'table',has_children:true,table:{table_width:2}}],table:[{id:'row',type:'table_row',table_row:{cells:[text('one')]}}]};
 await assert.rejects(()=>prepareTemplateBody({},'page'),/número de columnas/);assert.equal(fetches.length,0);
 tree={page:[image('one'),image('two')]};reset();
 let nodes=await prepareTemplateBody({},'page');assert.equal(requests.filter(r=>r.url==='file_uploads').length,1);assert.equal(fetches.length,2);
 assert.ok(nodes.every(n=>n.block.image.type==='file_upload'&&n.block.image.file_upload.id==='upload-one'));
 assert.ok(!JSON.stringify(nodes).includes(url));
 reset();uploadStatus='pending';await assert.rejects(()=>prepareTemplateBody({},'page'),/no confirmó/);
 reset();downloadMode='declared-large';await assert.rejects(()=>transferNotionInternalFile({},url,'image'),/20 MB/);assert.equal(requests.length,0);
 reset();downloadMode='stream-large';await assert.rejects(()=>transferNotionInternalFile({},url,'image'),/20 MB/);assert.equal(requests.length,0);
 reset();
 tree={page:[{id:'legacy',type:'template',has_children:true,template:{rich_text:text('Sección')}},{id:'preview',type:'link_preview',link_preview:{url:'https://example.com'}}],legacy:[{id:'todo',type:'to_do',to_do:{rich_text:text('Paso'),checked:true}}]};
 const original=structuredClone(tree);nodes=await prepareTemplateBody({},'page');assert.equal(nodes[0].block.type,'toggle');assert.equal(nodes[0].children[0].block.to_do.checked,true);assert.equal(nodes[1].block.bookmark.url,'https://example.com');assert.deepEqual(tree,original);
 tree={page:[{id:'plain',type:'paragraph',paragraph:{rich_text:[{plain_text:'Texto de caché'}]}},{id:'instruction',type:'paragraph',paragraph:{rich_text:text('Documentar [ANFETA_INTERNAL] como ejemplo')}},{id:'internal',type:'paragraph',paragraph:{rich_text:text('[ANFETA_INTERNAL] datos de sistema')}}]};
 nodes=await prepareTemplateBody({},'page');assert.equal(nodes.length,2);assert.equal(nodes[0].block.paragraph.rich_text[0].text.content,'Texto de caché');assert.match(nodes[1].block.paragraph.rich_text[0].text.content,/Documentar/);
 badIds=true;await assert.rejects(()=>appendTemplateBody({},'destination',nodes),/no confirmó/);badIds=false;
 const controller=new AbortController();controller.abort();reset();await assert.rejects(()=>prepareTemplateBody({notionSignal:controller.signal},'page'),/abort/i);assert.equal(requests.length,0);assert.equal(fetches.length,0);
 console.log('OK: validación completa antes de transferir, archivos reutilizados y confirmados, límite antes/durante descarga, tablas inválidas, templates antiguos, enlaces, respuestas incompletas y cancelación. Servicios simulados.');
})().catch(error=>{console.error(error);process.exitCode=1;});
