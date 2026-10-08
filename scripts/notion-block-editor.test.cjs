const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
const compile=p=>ts.transpileModule(fs.readFileSync(__dirname+'/../'+p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const model={};vm.runInNewContext(compile('src/lib/notionBlockText.ts'),{exports:model,Error});
const page='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',parent='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
const text=(content,annotations={},link=null)=>({type:'text',text:{content,link},annotations,plain_text:content});
let blocks={},allowed=true,patches=[],invalidated=[];
function reset(){patches=[];invalidated=[];allowed=true;blocks={[id]:{id,type:'to_do',last_edited_time:'2026-10-07T12:00:00Z',parent:{type:'block_id',block_id:parent},to_do:{checked:true,rich_text:[text('Uno ',{bold:true,code:true}, {url:'https://example.test'}),text('dos',{strikethrough:true})]}},[parent]:{id:parent,type:'toggle',parent:{type:'page_id',page_id:page},toggle:{rich_text:[text('Trabajo')]}}};}
const api={};vm.runInNewContext(compile('src/services/notionBlockEditor.ts'),{exports:api,require:name=>{
 if(name==='node:crypto')return require(name);
 if(name==='@/lib/notionBlockText')return model;
 if(name==='./notionCalendar')return {assertChecklistAccess:async(_s,actor,p)=>{assert.equal(actor,'verified');assert.equal(p,page);if(!allowed)throw Error('No puedes modificar');},invalidateChecklist:(_s,p)=>invalidated.push(p)};
 if(name==='./notionMutations')return {notionRequest:async(_s,endpoint,method='GET',body)=>{const block=blocks[endpoint.split('/')[1]];if(!block)throw Error('Not found');if(method==='PATCH'){patches.push(body);block[block.type]={...block[block.type],...body[block.type]};block.last_edited_time='2026-10-07T12:00:01Z';}return structuredClone(block);}};
 throw Error(name);
},Error,Set});
const settings={notionToken:'mock'},read=()=>api.readEditableBlock(settings,'verified',page,id),save=(version,texts)=>api.saveEditableBlock(settings,'verified',{pageId:page,blockId:id,version,texts});
(async()=>{
 reset();let editor=await read();assert.equal(editor.runs[0].annotations.code,true);assert.equal(editor.runs[0].linked,true);let result=await save(editor.version,['Nuevo ','texto']);assert.equal(result.text,'Nuevo texto');assert.equal(blocks[id].to_do.checked,true);assert.equal(patches[0].to_do.checked,undefined);assert.equal(patches[0].to_do.rich_text[0].annotations.bold,true);assert.equal(patches[0].to_do.rich_text[0].annotations.code,true);assert.equal(patches[0].to_do.rich_text[1].annotations.strikethrough,true);assert.equal(patches[0].to_do.rich_text[0].text.link.url,'https://example.test');assert.equal(invalidated[0],page);
 await assert.rejects(()=>save(editor.version,['A','B']),/otro dispositivo/);assert.equal(patches.length,1);
 reset();allowed=false;await assert.rejects(read,/No puedes/);assert.equal(patches.length,0);
 reset();blocks[parent].parent.page_id=other;await assert.rejects(read,/no pertenece/);
 reset();blocks[parent].type='synced_block';await assert.rejects(read,/sincronizados/);
 reset();blocks[parent].toggle.rich_text=[text('Datos internos de ANFETA')];await assert.rejects(read,/protegidos/);
 reset();blocks[parent].toggle.rich_text=[text('[anfeta_WEB_'),text('session]')];await assert.rejects(read,/protegidos/);
 reset();blocks[parent].parent={type:'block_id',block_id:id};await assert.rejects(read,/ubicación/);
 reset();blocks[id].archived=true;await assert.rejects(read,/protegidos/);
 reset();editor=await read();await assert.rejects(()=>save(editor.version,['[AN','FETA_TEST]']),/reservados/);await assert.rejects(()=>save(editor.version,['x'.repeat(2001),'']),/2000/);assert.equal(patches.length,0);
 reset();blocks[id].type='image';blocks[id].image={};await assert.rejects(read,/todavía/);
 const mention={type:'paragraph',paragraph:{rich_text:[{type:'mention',mention:{type:'user',user:{id:other}},plain_text:'John'}]}};assert.throws(()=>model.blockTextUpdate(mention,['Genaro']),/menciones/);assert.equal(model.blockTextUpdate(mention,['John']).paragraph.rich_text[0].mention.user.id,other);
 reset();blocks[id].to_do.rich_text=[];editor=await read();result=await save(editor.version,['Primer texto']);assert.equal(result.text,'Primer texto');
 console.log('OK editor Notion: permisos, pertenencia, ciclos, ramas sincronizadas/internas, conflictos, formatos/enlaces preservados, menciones y checks sin modificar. Notion simulado.');
})().catch(e=>{console.error(e);process.exitCode=1});
