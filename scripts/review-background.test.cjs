const fs=require('fs'),ts=require('typescript'),assert=require('assert/strict');
const Module=require('module');Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const nodes=[];
function element(){return {style:{},children:[],attributes:{},append(n){this.children.push(n);},setAttribute(k,v){this.attributes[k]=v;},remove(){this.removed=true;}};}
global.document={createElement:element,getElementById:id=>nodes.find(n=>n.id===id),body:{append:n=>nodes.push(n)}};
global.setTimeout=fn=>{fn();};
const {submitReviewInBackground}=require('../src/lib/reviewSubmission.ts');
(async()=>{
 let finish,closed=false;const promise=submitReviewInBackground('one','John',()=>new Promise(resolve=>finish=resolve),()=>closed=true);
 assert.equal(closed,true,'Dialog closes without waiting for Notion');
 const notice=nodes[0].children[0];assert.match(notice.children[0].textContent,/Enviando/);
 assert.throws(()=>submitReviewInBackground('one','John',()=>{},()=>{}),/ya se está enviando/);
 finish(true);await promise;assert.match(notice.children[0].textContent,/enviada/);
 await submitReviewInBackground('two','Karla',async()=>false,()=>{});
 const failure=nodes[0].children[1];assert.equal(failure.attributes.role,'alert');assert.match(failure.children[0].textContent,/No se confirmó/);assert.equal(failure.removed,undefined);
 await submitReviewInBackground('two','Karla',async()=>{throw Error('Notion rechazó el cambio');},()=>{});
 assert.match(nodes[0].children[2].children[0].textContent,/Notion rechazó/);
 console.log('OK revisión en segundo plano: cierre inmediato, bloqueo duplicado, éxito confirmado y errores persistentes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
