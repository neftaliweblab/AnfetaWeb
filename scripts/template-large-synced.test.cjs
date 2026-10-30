const fs=require('fs'),ts=require('typescript'),assert=require('assert/strict'),Module=require('module');
require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
let tree={},writes=[],reads=[],fail=new Set();
const load=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.endsWith('notionTemplateBody.ts')){
  if(name==='./notionCalendar')return {readBlocks:async(_,id)=>{reads.push(id);if(fail.has(id))throw Error('Notion 404 object_not_found');return tree[id]||[];}};
  if(name==='./notionMutations')return {notionRequest:async(_,url,method,body)=>{writes.push({url,method,body});return {results:body.children.map((b,i)=>({id:'new-'+writes.length+'-'+i,type:b.type}))};}};
 }
 return load.call(this,name,parent,...rest);
};
const {prepareTemplateBody,appendTemplateBody}=require('../src/services/notionTemplateBody.ts');
const paragraph=i=>({id:'p'+i,type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content:'Paso '+i}}]}});
const sync=(id,original)=>({id,type:'synced_block',has_children:true,synced_block:{synced_from:{block_id:original}}});
(async()=>{
 tree={page:[sync('local','origin')],origin:Array.from({length:650},(_,i)=>paragraph(i))};
 let nodes=await prepareTemplateBody({},'page');assert.equal(nodes.length,650);assert.equal(reads.includes('local'),false);
 await appendTemplateBody({},'destination',nodes);assert.deepEqual(writes.map(w=>w.body.children.length),[100,100,100,100,100,100,50]);
 const copied=writes.flatMap(w=>w.body.children).map(b=>b.paragraph.rich_text[0].text.content);
 assert.deepEqual(copied,Array.from({length:650},(_,i)=>'Paso '+i));assert.equal(new Set(copied).size,650);
 // The same synced source may appear twice without being a circular reference.
 tree={page:[sync('local1','origin'),sync('local2','origin')],origin:[paragraph(1)]};
 nodes=await prepareTemplateBody({},'page');assert.equal(nodes.length,2);
 // Only a read error permits trying the local copy.
 tree={page:[sync('local','origin')],local:[paragraph(9)]};fail=new Set(['origin']);
 nodes=await prepareTemplateBody({},'page');assert.equal(nodes[0].block.paragraph.rich_text[0].text.content,'Paso 9');
 fail.add('local');await assert.rejects(()=>prepareTemplateBody({},'page'),/origen.*copia local/);
 fail=new Set();reads=[];
 tree={page:[sync('local','origin')],origin:Array.from({length:5001},(_,i)=>paragraph(i)),local:[paragraph('fallback')]};
 await assert.rejects(()=>prepareTemplateBody({},'page'),error=>/5000/.test(error.message)&&!/acceso|compartida/.test(error.message));assert.equal(reads.includes('local'),false);
 tree={page:[sync('local','origin')],origin:[sync('again','origin')]};
 await assert.rejects(()=>prepareTemplateBody({},'page'),/circular/);
 tree={page:[sync('local','origin')],origin:[{id:'unsupported',type:'meeting_notes'}],local:[paragraph('wrong')]};
 await assert.rejects(()=>prepareTemplateBody({},'page'),/meeting_notes/);
 tree={page:[sync('local','origin')],origin:[{id:'cdb-sync',type:'child_database',child_database:{title:'BD Sincronizada'}}],local:[paragraph('wrong')]};
 nodes=await prepareTemplateBody({},'page');
 assert.equal(nodes[0].block.type,'callout');
 assert.equal(nodes[0].block.callout.icon.emoji,'📊');
 assert.match(nodes[0].block.callout.rich_text[0].text.content,/BD Sincronizada/);
 assert.match(nodes[0].block.callout.rich_text[1].text.link.url,/notion\.so\/cdbsync/);
 // Payloads are split by bytes too, even when there are fewer than 100 blocks.
 tree={page:Array.from({length:90},(_,i)=>({id:'big'+i,type:'paragraph',paragraph:{rich_text:Array.from({length:10},()=>({type:'text',text:{content:'x'.repeat(1000)}}))}}))};
 nodes=await prepareTemplateBody({},'page');writes=[];await appendTemplateBody({},'destination',nodes);
 assert.ok(writes.length>1);assert.equal(writes.flatMap(w=>w.body.children).length,90);
 for(const write of writes){assert.ok(Buffer.byteLength(JSON.stringify(write.body))<450000);assert.ok(write.body.children.length<=100);}
 // Large tables seed one row and append the rest, preserving order and flags.
 tree={page:[{id:'table',type:'table',has_children:true,table:{table_width:1,has_column_header:true,has_row_header:false}}],table:Array.from({length:250},(_,i)=>({id:'row'+i,type:'table_row',table_row:{cells:[[{type:'text',text:{content:'Fila '+i}}]]}}))};
 nodes=await prepareTemplateBody({},'page');assert.equal(nodes[0].block.table.children.length,1);assert.equal(nodes[0].children.length,249);
 writes=[];await appendTemplateBody({},'destination',nodes);assert.deepEqual(writes.map(w=>w.body.children.length),[1,100,100,49]);assert.equal(writes[0].body.children[0].table.has_column_header,true);
 const rows=[...writes[0].body.children[0].table.children,...writes.slice(1).flatMap(w=>w.body.children)];assert.deepEqual(rows.map(r=>r.table_row.cells[0][0].text.content),Array.from({length:250},(_,i)=>'Fila '+i));
 console.log('OK: 650 bloques sincronizados completos y ordenados, lotes de 100, origen repetido, fallback solo de lectura, permisos, ciclos, límite sin error falso y tabla de 250 filas. Notion simulado.');
})().catch(error=>{console.error(error);process.exitCode=1;});
