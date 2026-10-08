const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
const compile=p=>ts.transpileModule(fs.readFileSync(__dirname+'/../'+p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const model={};vm.runInNewContext(compile('src/lib/notionBlockText.ts'),{exports:model,Error});
for(const type of model.EDITABLE_NOTION_TEXT_TYPES){const block=model.newTextBlock({type,text:'Contenido',annotations:{bold:true,code:true,strikethrough:true}});assert.equal(block.type,type);assert.equal(block[type].rich_text[0].annotations.bold,true);assert.equal(block[type].rich_text[0].annotations.code,true);if(type==='to_do')assert.equal(block.to_do.checked,false);if(type==='code')assert.equal(block.code.language,'plain text');}
const long='a'.repeat(1999)+'😀'+'b'.repeat(1999),chunks=model.newTextBlock({type:'paragraph',text:long}).paragraph.rich_text;assert.equal(chunks.map(r=>r.text.content).join(''),long);for(const chunk of chunks){assert.ok(chunk.text.content.length<=2000);assert.ok(!/[\uD800-\uDBFF]$/.test(chunk.text.content));}
for(const input of [{type:'image',text:'x'},{type:'to_do',text:' '},{type:'paragraph',text:'x'.repeat(4001)},{type:'paragraph',text:'[AnFeTa_private]'},{type:'paragraph',text:'Datos internos de ANFETA'},{type:'paragraph',text:'x',annotations:{code:'true'}}])assert.throws(()=>model.newTextBlock(input));
const page='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',api={};let allowed=true,patches=[],invalidated=[],fail=false,badResult=false;
vm.runInNewContext(compile('src/services/notionBlockEditor.ts'),{exports:api,require:name=>{
 if(name==='node:crypto')return require(name);if(name==='@/lib/notionBlockText')return model;
 if(name==='./notionCalendar')return {assertChecklistAccess:async(_s,actor,p)=>{assert.equal(actor,'verified');assert.equal(p,page);if(!allowed)throw Error('No puedes modificar');},invalidateChecklist:(_s,p)=>invalidated.push(p)};
 if(name==='./notionMutations')return {notionRequest:async(_s,endpoint,method,body)=>{assert.equal(endpoint,'blocks/'+page+'/children');assert.equal(method,'PATCH');assert.equal(body.children.length,1);patches.push(body);if(fail)throw Error('Network timeout');return {results:badResult?[]:[{...structuredClone(body.children[0]),id,last_edited_time:'2026-10-07T12:00:00Z'}]};}};
 throw Error(name);
},Error,Set});
const append=(input={})=>api.appendEditableBlock({notionToken:'mock'},'verified',{pageId:page,type:'to_do',text:'Nueva tarea',...input});
(async()=>{
 let saved=await append();assert.equal(saved.id,id);assert.equal(saved.kind,'to_do');assert.equal(saved.isChecked,false);assert.equal(invalidated[0],page);
 allowed=false;let count=patches.length;await assert.rejects(append,/No puedes/);assert.equal(patches.length,count);allowed=true;
 await assert.rejects(()=>append({pageId:'../otro'}),/inválida/);await assert.rejects(()=>append({text:'[ANFETA_X]'}),/reservados/);assert.equal(patches.length,count);
 const pending=append();await assert.rejects(append,/otro bloque/);await pending;assert.equal(patches.length,count+1);
 fail=true;await assert.rejects(append,/Revisa la página/);fail=false;saved=await append();assert.equal(saved.text,'Nueva tarea');
 badResult=true;await assert.rejects(append,/no confirmó/);
 console.log('OK crear bloques: tipos, formatos, tareas pendientes, Unicode/límites, permisos, envío simultáneo y resultado incierto sin reintento automático. Notion simulado.');
})().catch(e=>{console.error(e);process.exitCode=1});
