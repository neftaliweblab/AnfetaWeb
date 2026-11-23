const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load;let cells=[],index=0;
Module._resolveFilename=function(n,p,...a){if(n.startsWith('@/'))n=path.join(root,'src',n.slice(2));return resolve.call(this,n,p,...a)};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
Module._load=function(n,p,...a){if(p?.filename.endsWith('SettingsModal.tsx')){
 if(n==='react')return {...React,useState:(initial)=>{const at=index++;if(!(at in cells))cells[at]=typeof initial==='function'?initial():initial;return [cells[at],value=>cells[at]=typeof value==='function'?value(cells[at]):value]},useEffect:()=>{}};
 if(n==='@/services/windowsIntegration')return {playTestChime:()=>{},openWindowsSoundSettings:()=>{}};
 if(n==='@/components/DropboxConnectModal/DropboxConnectModal')return {DropboxConnectModal:()=>null};
 if(n==='@/lib/modalPosition')return {getModalPositionConfig:()=>({mode:'top_high',topOffset:8}),saveModalPositionConfig:()=>{}};
}return load.call(this,n,p,...a)};
const {SettingsModal}=require(root+'/src/components/SettingsModal/SettingsModal.tsx');let closed=0,requests=[];
const storage=new Map([['anfeta_settings',JSON.stringify({ftfEmailTo:'kept@example.com',customPreference:'keep'})]]);
global.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};global.window={dispatchEvent:()=>{}};global.CustomEvent=class{};
function nodes(tree,result=[]){if(!tree||typeof tree!=='object')return result;if(Array.isArray(tree)){tree.forEach(n=>nodes(n,result));return result;}result.push(tree);nodes(tree.props?.children,result);return result;}
function text(tree){if(Array.isArray(tree))return tree.map(text).join(' ');if(!tree||typeof tree==='boolean')return '';return typeof tree==='object'?text(tree.props?.children):String(tree);}
function render(){index=0;return SettingsModal({isOpen:true,currentUser:'Neftali',onClose:()=>closed++,onSaveCurrentUser:async()=>{}});}
(async()=>{
let tree=render();cells[2]=true;tree=render();
const save=()=>nodes(render()).find(n=>n.type==='button'&&text(n).includes('Guardar cambios')).props.onClick();
global.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));throw Error('offline');};
await save();assert.equal(closed,0);assert.equal(JSON.parse(storage.get('anfeta_settings')).customPreference,'keep');assert.ok(text(render()).includes('No se pudo guardar'));
global.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({success:true})}};
await save();assert.equal(closed,1);const payload=requests.at(-1).payload;assert.ok(!('notionToken' in payload),'Blank token must not overwrite server token');assert.ok(!('resendApiKey' in payload));assert.ok(!('ftfEmailTo' in payload),'Externally managed recipients must not be overwritten');assert.equal(JSON.parse(storage.get('anfeta_settings')).ftfEmailTo,'kept@example.com');assert.equal(JSON.parse(storage.get('anfeta_settings')).customPreference,'keep');
console.log('OK settings save: failed request retains form and local preferences; confirmed save preserves unrelated settings, Gmail recipients and server Notion token. No real API calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
