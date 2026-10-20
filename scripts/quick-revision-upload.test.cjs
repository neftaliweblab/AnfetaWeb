const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const {quickRevisionTitle}=require('../src/lib/quickRevisionTitle.ts');
const sample={type:'Corrección de prueba',title:'Error al mover actividad',person:'nneft',domain:'anfeta.com',description:'Revisar el horario mostrado',month:'26-[10OCT]'};
assert.equal(quickRevisionTitle(sample),'prtuzREVISION [Corrección de prueba] 26-[10OCT] Error al mover actividad nne11 [anfeta.com] Revisar el horario mostrado');
assert.match(quickRevisionTitle({...sample,person:'ggena'}),/ gge11 \[anfeta.com\]/);
assert.match(quickRevisionTitle({...sample,person:'aandr'}),/ aan11\s+\[anfeta.com\]/);
assert.throws(()=>quickRevisionTitle({...sample,person:'desconocido'}),/responsable válido/);
assert.throws(()=>quickRevisionTitle({...sample,month:'26-[99OCT]'}),/mes/);
assert.throws(()=>quickRevisionTitle({...sample,month:'26-[08OCT]'}),/mes/);
assert.match(quickRevisionTitle({...sample,type:'   '}),/\[Actividad rápida\]/);
const previous=process.env.NOTION_PERSON_IDS;process.env.NOTION_PERSON_IDS=JSON.stringify({Neftali:'user-neft',Genaro:'user-gena'});
let writes=[],schemas=0;
global.fetch=async(url,options={})=>{const target=String(url).split('/v1/')[1];let data={};if(target.startsWith('data_sources/')){schemas++;data={properties:{Name:{type:'title'},Estado:{type:'status',status:{options:[{name:'prtuzREVISION'}]}},'Assignee/Ejecutor Principal':{type:'people'}}};}
else if(target==='file_uploads')data={id:'file-one'};else if(target==='file_uploads/file-one/send')data={id:'file-one',status:'uploaded'};
else if(target==='pages'){const body=JSON.parse(options.body);writes.push(body);data={id:'11111111-1111-4111-8111-111111111111',url:'https://notion.so/page',properties:body.properties};}
else throw Error('Unexpected Notion request: '+target);return new Response(JSON.stringify(data),{status:200});};
(async()=>{const {createActivity}=require('../src/services/notionMutations.ts');await createActivity({notionToken:'TEST_QUICK_ONLY',currentUser:'nneft'},'nneft',{title:'Nombre de archivo original',domain:'anfeta.com',person:'nneft',quickRevision:true,quickType:sample.type,quickTitle:sample.title,quickDescription:sample.description,quickMonth:sample.month,files:[{filename:'video.mp4',contentType:'video/mp4',base64:'dmlkZW8='}]});assert.equal(writes.length,1);const page=writes[0];assert.equal(page.properties.Name.title[0].text.content,quickRevisionTitle(sample));assert.equal(page.properties.Estado.status.name,'prtuzREVISION');assert.equal(page.properties['Assignee/Ejecutor Principal'].people[0].id,'user-neft');assert.equal(page.children[0].type,'video');assert.equal(page.children[0].video.file_upload.id,'file-one');assert.ok(!Object.values(page.properties).some(prop=>prop.date));assert.ok(schemas);console.log('OK Revisiones rápidas: estructura de catálogo, etiquetas por persona, responsable real, estado pendiente y video adjunto sin horario inventado. Notion simulado.');})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{if(previous===undefined)delete process.env.NOTION_PERSON_IDS;else process.env.NOTION_PERSON_IDS=previous;});
