const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');
const root=path.resolve(__dirname,'..');const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){return resolve.call(this,name.startsWith('@/')?path.join(root,'src',name.slice(2)):name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,p);
const {normalizeSearchTabConfig,migrateGroupByPreference}=require('../src/lib/searchTabConfig.ts');
const {parseSearchTabs}=require('../src/lib/searchTabsStorage.ts');
const {closeSearchTab}=require('../src/lib/searchTabNavigation.ts');
const {computeInlineSuggestions,itemMatchesStructuredType}=require('../src/lib/inlinePredictiveEngine.ts');
const {hoverPreviewBounds,loadNotionPreview,invalidateNotionPreview,previewPageId}=require('../src/lib/notionPreviewResource.ts');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const {NotionPreviewBlock}=require('../src/components/ResultsViewHost/NotionPreviewBlock.tsx');
const a=normalizeSearchTabConfig({hideTerminated:true,billingFilter:'exclude',activeCriteria:[{id:'p',type:'person',value:'Brian',label:'Brian'}],resultPerson:'Brian'});
const b=normalizeSearchTabConfig({paymentFilter:'only',selectedScope:'Dropbox'});
const stored=parseSearchTabs(JSON.stringify({tabs:[{id:'a',query:'uno',config:a},{id:'b',query:'dos',config:b}],activeTabId:'b'}));
assert.deepEqual(stored.tabs[0].config,a);assert.deepEqual(stored.tabs[1].config,b);
assert.deepEqual(normalizeSearchTabConfig(stored.tabs[1].config).activeCriteria,[]);
assert.equal(normalizeSearchTabConfig(undefined).hideTerminated,false);
assert.equal(normalizeSearchTabConfig(undefined).resultPerson,'__all__');
assert.equal(closeSearchTab(stored.tabs,'b','b').activeId,'a');
assert.equal(normalizeSearchTabConfig({activeCriteria:[null,{type:'bad'}],billingFilter:'bad'}).activeCriteria.length,0);
assert.equal(normalizeSearchTabConfig({groupBy:'domain_nobilling'}).billingFilter,'exclude');
assert.equal(normalizeSearchTabConfig({groupBy:'area_nobilling'}).groupBy,'project_type');
assert.equal(normalizeSearchTabConfig({groupBy:'name_noterminated'}).hideTerminated,false,'Legacy active-first did not hide rows');
assert.equal(migrateGroupByPreference('name_noterminated').groupBy,'person');
const {getItemGroupKey,isCobroItem,isPagoItem}=require('../src/lib/activeResultsFirst.ts');
assert.notEqual(getItemGroupKey({name:'prtuzR sseo SEO',status:'POR HACER'},'status'),getItemGroupKey({name:'tuzR sseo SEO',status:'TERMINADA'},'status'));
assert.notEqual(getItemGroupKey({name:'prtuzR sseo SEO'},'project_type'),getItemGroupKey({name:'prtuzR pprog Instalación'},'project_type'));
assert.equal(isCobroItem({name:'prtuzR Revisar cómo cobrar la página',sourceName:'Revisiones'}),false);
assert.equal(isCobroItem({name:'zpagar Hosting',sourceName:'Cobrar y pagar'}),false);
assert.equal(isPagoItem({name:'zcobrar Factura',sourceName:'Cobrar y pagar'}),false);
const rows=[{name:'prtuzR pprog 11.s.01.00 Instalación nne11',assignedPerson:'Brian'},{name:'prtuzR wwebs Diseño eed11',assignedPerson:'Edwin'}];
const suggestions=computeInlineSuggestions('prtuzR',rows,[]);
assert.ok(suggestions.some(s=>s.value==='PROGRAMAS'&&s.count===1));
assert.ok(itemMatchesStructuredType(rows[0],'PROGRAMAS'));assert.ok(!itemMatchesStructuredType(rows[1],'PROGRAMAS'));
assert.deepEqual(computeInlineSuggestions('no existe',[],[]),[]);
for(const [width,height] of [[360,320],[800,450],[1920,1080]])for(const anchor of [{left:0,top:0,bottom:25},{left:width-10,top:height-20,bottom:height-5},{left:50,top:height/2,bottom:height/2+20}]){
 const rect=hoverPreviewBounds(anchor,width,height);assert.ok(rect.left>=0&&rect.top>=0);assert.ok(rect.left+rect.width<=width);assert.ok(rect.top+rect.height<=height);
}
assert.equal(previewPageId({id:'idx-old',target:'https://notion.so/12345678-1234-1234-1234-123456789abc'}),'12345678123412341234123456789abc');
for(const block of [{id:'table',kind:'table_row',text:'',cells:['Cliente','Estado']},{id:'video',kind:'video',text:'Grabación',url:'https://example.com/video.mp4'},{id:'todo',kind:'to_do',text:'Paso hecho',isChecked:true},{id:'image',kind:'image',text:'',url:'https://example.com/image.png'}]){
 const html=renderToStaticMarkup(React.createElement(NotionPreviewBlock,{block,index:0,pageTitle:'Prueba'}));
 if(block.kind==='table_row')assert.match(html,/role="table"/);
 if(block.kind==='video')assert.match(html,/<video/);
 if(block.kind==='to_do')assert.match(html,/Hecho/);
 if(block.kind==='image')assert.match(html,/Ampliar/);
}
(async()=>{
 let calls=0;const nativeFetch=global.fetch;const id='a'.repeat(32);
 try{
  global.fetch=async()=>{calls++;return new Response(JSON.stringify({blocks:[{id:'x',kind:'paragraph',text:'Página A'}],content:'Página A'}),{status:200});};
  const one=await loadNotionPreview(id,new AbortController().signal);assert.equal(one.content,'Página A');
  await loadNotionPreview(id,new AbortController().signal);assert.equal(calls,1,'Shared cache avoids reread');
  invalidateNotionPreview(id);await loadNotionPreview(id,new AbortController().signal);assert.equal(calls,2);
  const abort=new AbortController();abort.abort();await assert.rejects(loadNotionPreview(id,abort.signal));
  let release;global.fetch=()=>new Promise(resolve=>release=resolve);
  const controller=new AbortController();const pending=loadNotionPreview('b'.repeat(32),controller.signal);controller.abort();
  release(new Response(JSON.stringify({blocks:[],content:'Old response'})));await assert.rejects(pending);
  global.fetch=async()=>new Response(JSON.stringify({error:'Sin acceso a esta página'}),{status:403});
  await assert.rejects(loadNotionPreview('c'.repeat(32),new AbortController().signal),/acceso/);
 }finally{global.fetch=nativeFetch;invalidateNotionPreview(id);}
 console.log('OK controles reales: pestañas serializadas/restauradas, pestaña antigua neutra, cierre, migración, criterios, sugerencias, vista compartida de tablas/multimedia/imágenes, límites de viewport, caché, cancelación y errores.');
})().catch(error=>{console.error(error);process.exitCode=1;});
