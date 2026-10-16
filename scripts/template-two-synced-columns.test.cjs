const fs=require('fs'),ts=require('typescript'),assert=require('assert/strict'),Module=require('module');
require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
let tree={},created=new Map(),writes=[],reads=[],serial=0;
const load=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.endsWith('notionTemplateBody.ts')){
  if(name==='./notionCalendar')return {readBlocks:async(_,id)=>{reads.push(id);return structuredClone(tree[id]||[]);}};
  if(name==='./notionMutations')return {notionRequest:async(_,url,method,body)=>{
    writes.push({url,method,body});
    if(method==='DELETE')return {};
    assert.match(url,/^blocks\/(destination|new-\d+)\/children$/);
    const results=body.children.map(block=>{
      const id='new-'+(++serial),saved={...structuredClone(block),id};created.set(id,saved);
      if(block.type==='column_list'){
        tree[id]=block.column_list.children.map(col=>{
          const columnId='new-'+(++serial),placeholderId='new-'+(++serial);
          created.set(columnId,{...structuredClone(col),id:columnId});
          tree[columnId]=[{id:placeholderId,type:'paragraph',paragraph:{rich_text:[]}}];
          return {id:columnId,type:'column'};
        });
      }
      return saved;
    });
    return {results};
  }};
 }
 return load.call(this,name,parent,...rest);
};
const {prepareTemplateBody,appendTemplateBody}=require('../src/services/notionTemplateBody.ts');
const original='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sync=(id,origin)=>({id,type:'synced_block',has_children:true,synced_block:{synced_from:origin?{type:'block_id',block_id:origin}:null}});
const text=value=>[{type:'text',text:{content:value},annotations:{bold:true}}];
const steps=prefix=>Array.from({length:180},(_,i)=>({id:prefix+i,type:'to_do',to_do:{rich_text:text(prefix+' '+i),checked:i%2===0}}));
async function run(sameOrigin){
 created=new Map();writes=[];reads=[];serial=0;
 tree={page:[{id:'layout',type:'column_list',has_children:true,column_list:{}}],layout:[{id:'left',type:'column',has_children:true,column:{}},{id:'right',type:'column',has_children:true,column:{}}],left:[sync(original,null)],right:[sync('local-copy',sameOrigin?original.replace(/-/g,''):'second-origin')],[original]:[{id:'toggle-a',type:'toggle',has_children:true,toggle:{rich_text:text('Checklist Página Interna')}}],'toggle-a':steps('A'),'second-origin':[{id:'toggle-b',type:'toggle',has_children:true,toggle:{rich_text:text('Segundo checklist')}}],'toggle-b':steps('B')};
 const sourceSnapshot=structuredClone(tree);
 const nodes=await prepareTemplateBody({},'page');
 assert.equal(nodes[0].children.length,2);
 const first=nodes[0].children[0].children[0],second=nodes[0].children[1].children[0];
 assert.equal(first.block.type,'toggle');assert.equal(second.block.type,'toggle');
 assert.equal(first.children.length,180);assert.equal(second.children.length,180);
 assert.equal(reads.filter(id=>id.replace(/-/g,'')===original.replace(/-/g,'')).length,1);
 assert.notEqual(first,second);assert.notEqual(first.children[0],second.children[0]);
 await appendTemplateBody({},'destination',nodes);
 const checks=[...created.values()].filter(b=>b.type==='to_do');
 assert.equal(checks.length,360);assert.equal(new Set(checks.map(b=>b.id)).size,360);
 assert.equal(checks.filter(b=>b.to_do.checked).length,180);
 assert.ok([...created.values()].every(b=>b.type!=='synced_block'));
 for(const [id,blocks] of Object.entries(sourceSnapshot))assert.deepEqual(tree[id],blocks);
 assert.equal(writes.filter(w=>w.method==='DELETE').length,2);
 checks[0].to_do.checked=!checks[0].to_do.checked;
 assert.equal(tree['toggle-a'][0].to_do.checked,true);
 assert.equal(second.children[0].block.to_do.checked,true);
}
(async()=>{await run(true);await run(false);console.log('OK: plantilla tipo Pg Interna con dos sincronizados en columnas, mismo origen y distintos, 360 checks íntegros, una lectura por origen, copias independientes y plantilla sin cambios. Notion simulado.');})().catch(error=>{console.error(error);process.exitCode=1;});
