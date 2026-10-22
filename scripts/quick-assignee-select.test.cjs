const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript'),vm=require('vm');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const code=ts.transpileModule(fs.readFileSync(root+'/src/components/CalendarHost/QuickAssigneeSelect.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const flush=async()=>{for(let n=0;n<10;n++)await new Promise(setImmediate);};
const nodes=node=>node&&typeof node==='object'?[node,...(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)]:[];
function mount(props){
 const slots=[],effects=[];let index=0;
 const react={useState:initial=>{const n=index++;if(!(n in slots))slots[n]=initial;return [slots[n],v=>slots[n]=v];},useRef:initial=>{const n=index++;return slots[n]||(slots[n]={current:initial});},useEffect:fn=>{const n=index++;if(!(n in slots)){slots[n]=true;effects.push(fn);}}};
 const exports={};vm.runInNewContext(code,{exports,require:name=>name==='react'?react:require(name),AbortController,Error,fetch:async()=>({ok:true,json:async()=>({people:[{name:'Neftali'},{name:'John'},{name:'Emmanuel'}]})})});
 const render=()=>{index=0;return nodes(exports.QuickAssigneeSelect(props));};render();effects.forEach(fn=>fn());return {render};
}
(async()=>{
 const activity={pageId:'a',person:'Neftali',title:'prtuzREVISION nne22',status:'Por hacer'},calls=[];let finish;
 const props={activity,currentUser:'Neftali',onConfirm:async update=>{calls.push(update);await new Promise(resolve=>finish=resolve);props.activity={...activity,person:update.person};return true;}};
 const app=mount(props);await flush();let select=app.render().find(n=>n.type==='select');assert.ok(select);assert.ok(!nodes(select).some(n=>n.type==='option'&&n.props.children==='Emmanuel'));
 select.props.onChange({target:{value:'John'}});select.props.onChange({target:{value:'John'}});assert.equal(calls.length,1);assert.equal(calls[0].handoff,true);assert.equal(calls[0].leaveVisualCopy,false);assert.equal(calls[0].note,'');
 select=app.render().find(n=>n.type==='select');assert.equal(select.props.value,'Neftali');assert.equal(select.props.disabled,true);finish();await flush();assert.equal(app.render().find(n=>n.type==='select').props.value,'John','Dirección conserva el selector tras confirmar');
 const failed=mount({activity,currentUser:'Neftali',onConfirm:async()=>{throw Error('Sin conexión');}});await flush();failed.render().find(n=>n.type==='select').props.onChange({target:{value:'John'}});await flush();assert.equal(failed.render().find(n=>n.type==='select').props.value,'Neftali');assert.ok(failed.render().some(n=>n.props?.role==='alert'));
 for(const patch of [{status:'Terminada'},{isLocked:true},{isReviewMirror:true}]){const blocked=mount({activity:{...activity,...patch},currentUser:'Neftali',onConfirm:async()=>true});assert.ok(!blocked.render().some(n=>n.type==='select'));}
 const other=mount({activity,currentUser:'Brian',onConfirm:async()=>true});assert.ok(!other.render().some(n=>n.type==='select'));
 const reviewCalls=[];const review=mount({activity:{...activity,status:'EN REVISIÓN',reviewFlow:{State:'pending',LeaveVisualCopy:true}},currentUser:'Neftali',onConfirm:async update=>{reviewCalls.push(update);return true;}});await flush();review.render().find(n=>n.type==='select').props.onChange({target:{value:'John'}});await flush();assert.equal(reviewCalls[0].reviewer,'John');assert.equal(reviewCalls[0].handoff,undefined);assert.equal(reviewCalls[0].leaveVisualCopy,true);
 console.log('OK selector rápido: equipo sin Emmanuel, sin copia, una sola petición, confirmación antes de cambiar, restauración por error, bloqueo y permisos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
