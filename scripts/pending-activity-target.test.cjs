const assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {pendingActivityPageId:target}=require('../src/lib/pendingActivityTarget.ts');
const uuid='410abd7d-91b7-81f8-8fa3-cd58d78f1322',id=uuid.replace(/-/g,''),other='a'.repeat(32);
for(const task of [{reviewPageId:uuid},{pageId:uuid.toUpperCase()},{url:'https://app.notion.com/p/Nombre-anterior-'+id+'?v='+other},{url:'https://www.notion.so/'+uuid+'#'+other},{url:'notion://www.notion.so/'+id},{url:'https://anfeta-web.onrender.com/?activity='+uuid},{url:'https://anfeta-web.vercel.app/calendar?activity='+id},{id:'act-pending-'+uuid}])assert.equal(target({...task,title:'Nombre cambiado',query:'Título viejo con emojis | nne11'}),id);
assert.equal(target({reviewPageId:uuid,url:'https://notion.so/'+other}),id,'Explicit review page has priority over other links');
for(const task of [{id:uuid},{title:id},{query:id},{url:'https://example.com/'+id},{url:'https://notion.so.evil.example/'+id},{url:'https://notion.so/?v='+id},{url:'javascript:alert(1)'},{url:'https://notion.so/invalid'},{pageId:'invalid'},{url:'https://attacker@notion.so/'+id}])assert.equal(target(task),'');
console.log('OK pending activity target: stable ID across renames, review linkage, Notion slugs/UUIDs, canonical links, legacy pending IDs and no generic search/foreign URL fallback.');
