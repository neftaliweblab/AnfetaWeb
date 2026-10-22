const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript'),vm=require('vm');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const code=ts.transpileModule(fs.readFileSync(root+'/src/components/ResultsViewHost/AgendaActivityActions.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const nodes=n=>n&&typeof n==='object'?[n,...(Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)]:[];
function mount(props){let index=0;const slots=[];const react={useState:init=>{const i=index++;if(!(i in slots))slots[i]=init;return [slots[i],value=>slots[i]=value];},useEffect:()=>{},useRef:value=>({current:value})};
 const exports={};const localRequire=name=>name==='react'?react:name==='react-dom'?{createPortal:n=>n}:name.startsWith('../CalendarHost/')?{ViewportMenu:'ViewportMenu',QuickScheduleActions:'QuickScheduleActions',ReassignActivityModal:'ReassignActivityModal',SendToReviewModal:'SendToReviewModal'}:require(name);
 vm.runInNewContext(code,{exports,require:localRequire});return ()=>{index=0;return nodes(exports.AgendaActivityActions(props));};
}
const activity={pageId:'a',person:'Brian',title:'prtuzREVISION bbr11',status:'POR HACER'};
const button=(tree,text)=>tree.find(n=>n.type==='button'&&String(n.props.children).includes(text));
(async()=>{
 let calls=[],closed=0;const props={activity,currentUser:'Brian',position:{x:1,y:1},busy:false,onClose:()=>closed++,onSave:async v=>{calls.push(v);return true;}};
 let render=mount(props),tree=render();assert.equal(button(tree,'Reasignar').props.disabled,false);assert.equal(button(tree,'Enviar a revisión').props.disabled,false);assert.equal(button(tree,'Finalizar').props.disabled,true);assert.ok(tree.some(n=>n.type==='QuickScheduleActions'));
 button(tree,'Reasignar').props.onClick();assert.equal(render()[0].type,'ReassignActivityModal');
 render=mount(props);button(render(),'Enviar a revisión').props.onClick();tree=render();assert.equal(tree[0].type,'SendToReviewModal');await tree[0].props.onConfirm('John',true);assert.equal(calls.at(-1).reviewer,'John');assert.equal(calls.at(-1).leaveVisualCopy,true);
 render=mount({...props,currentUser:'Neftali'});await button(render(),'Finalizar').props.onClick();assert.equal(calls.at(-1).status,'zREVISION');assert.equal(closed,1);
 tree=mount({...props,currentUser:'Acalli'})();for(const label of ['Reasignar','Enviar a revisión','Finalizar','Editar fecha'])assert.equal(button(tree,label).props.disabled,true);assert.ok(!tree.some(n=>n.type==='QuickScheduleActions'));
 tree=mount({...props,activity:{...activity,isHandoffMirror:true},currentUser:'Neftali'})();assert.equal(button(tree,'Reasignar').props.disabled,true);
 tree=mount({...props,activity:{...activity,status:'TERMINADA'},currentUser:'Neftali'})();for(const label of ['Reasignar','Enviar a revisión','Finalizar','Editar fecha'])assert.equal(button(tree,label).props.disabled,true);assert.ok(!tree.some(n=>n.type==='QuickScheduleActions'));
 tree=mount({...props,activity:{...activity,status:'EN REVISIÓN',reviewFlow:{State:'pending',ReviewAssignee:'Brian'}},currentUser:'John'})();assert.equal(button(tree,'Finalizar').props.disabled,true);assert.equal(button(tree,'Reasignar').props.disabled,true);
 tree=mount({...props,activity:{...activity,status:'EN REVISIÓN',reviewFlow:{State:'pending',ReviewAssignee:'Brian'}}})();assert.equal(button(tree,'Finalizar').props.disabled,false);
 tree=mount({...props,currentUser:'Neftali',busy:true})();for(const label of ['Reasignar','Enviar a revisión','Finalizar','Editar fecha'])assert.equal(button(tree,label).props.disabled,true);
 console.log('OK menú agenda: modales existentes, selección de revisor, copia opcional, finalizar, permisos, revisiones asignadas, terminadas e históricos protegidos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
