const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,p);

const {workflowBadgePresentation:badge,workflowPresentation}=require('../src/services/activityWorkflow.ts');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{WorkflowStageBadge}=require('../src/components/WorkflowStageBadge.tsx');
const cases=[['PRTUZ POR HACER','','PH'],['POR HACER','','PH'],['PENDIENTE','','PH'],['EN REVISION','','REV'],['TERMINADA','','TER'],['SUSPENDIDA','','SUS'],['','aprtuzR Prueba','PA'],['','prtuzR Prueba','PH'],['','rtuzR Prueba','REV'],['','tuzR Prueba','APR'],['','uzR Prueba','CP'],['','zR Prueba','FIN'],['','ZS Prueba','ST'],['','ZC Prueba','CT'],['','ZP Prueba','PT'],['Estado especial','','SC']];
for(const [status,title,short] of cases){
 const info=badge(status,title);assert.equal(info.shortLabel,short);assert.equal(info.label,workflowPresentation(status,title).label,'Full label unchanged');
 const html=renderToStaticMarkup(React.createElement(WorkflowStageBadge,{status,title}));assert.ok(html.includes('>'+short+'<'),html);assert.ok(html.includes('aria-label='));assert.ok(html.includes('title='));if(status)assert.ok(html.includes(status));
}
const mismatch=badge('POR HACER','tuzR Prueba');assert.equal(mismatch.shortLabel,'PH');assert.equal(mismatch.inconsistent,true);assert.ok(mismatch.description.includes('difiere'));
assert.match(renderToStaticMarkup(React.createElement(WorkflowStageBadge,{status:'POR HACER',title:'tuzR Prueba'})),/⚠ PH/);
console.log('OK compact badges: all stages, old/new pending aliases, full tooltip/accessibility labels, explicit status precedence and conflict warning. No Notion writes.');
