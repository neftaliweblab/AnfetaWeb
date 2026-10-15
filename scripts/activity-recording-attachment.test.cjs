const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const id='11111111-1111-4111-8111-111111111111';let writes=[],created=0,uploads=0,existing=false,dropboxWrites=0;
const load=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.replace(/\\/g,'/').endsWith('/src/app/api/data/route.ts')){
  if(name==='@/services/serverAuth')return {requireActor:async()=> 'Neftali',assertSameOrigin:()=>{}};
  if(name==='@/services/serverSettings')return {getSettings:()=>({notionToken:'TEST',currentUser:'Neftali'}),saveSettings:()=>{}};
  if(name==='@/services/dropboxUpload')return {cloudFolder:(_domain,target)=>target,uploadDropboxCloud:async(filename,bytes,folder)=>{dropboxWrites++;return {success:true,path:folder+'/'+filename,filename,targetDir:folder,sizeBytes:bytes.length};}};
  if(name==='@/services/reliableOperations')return {operationKey:(...a)=>a.join(':'),durableStep:async(_,f)=>f()};
  if(name==='@/services/notionCalendar'){const actual=load.call(this,name,parent,...rest);return {...actual,assertChecklistAccess:async()=>({id,url:'https://www.notion.so/'+id}),readBlocks:async()=>existing?[{id:'saved',type:'callout',callout:{rich_text:[{plain_text:'[UPLOAD_REF:'+id+']'}]}}]:[],invalidateChecklist:()=>{}};}
 }
 if(name==='@/services/supabaseServer')return {supabaseConfigured:()=>false};
 return load.call(this,name,parent,...rest);
};
global.fetch=async(url,opts={})=>{const target=String(url).split('/v1/')[1];if(target==='pages'){created++;throw Error('Must not create a page');}if(target==='file_uploads'){uploads++;return Response.json({id:'file-id'});}if(target==='file_uploads/file-id/send'){assert.ok(['video/mp4','video/webm'].includes(opts.body.get('file').type));return Response.json({status:'uploaded'});}if(target==='blocks/'+id+'/children'&&opts.method==='PATCH'){const body=JSON.parse(opts.body);writes.push(body);return Response.json({results:body.children.map((b,i)=>({...b,id:'block-'+i}))});}throw Error('Unexpected request '+url);};
(async()=>{
 const {activityAttachmentPlan}=require(root+'/src/lib/activityAttachmentPlan.ts');const plan=activityAttachmentPlan({id,name:'Actividad sin dominio'},'Grabacion.webm');assert.equal(plan.customFolder,'/DRX/Grabaciones/'+id.replace(/-/g,''));assert.equal(activityAttachmentPlan({id:'review-mirror-'+id},'a.webm'),null);
 const {NextRequest}=require('next/server'),route=require(root+'/src/app/api/data/route.ts');
 const request=(mime='video/mp4')=>new NextRequest('https://anfeta.test/api/data',{method:'POST',body:JSON.stringify({action:'unified-upload',payload:{uploadId:id,mode:'notion',targetPageId:id,title:'Indicación',body:'Revisar el botón al guardar',files:[{filename:mime==='video/mp4'?'Grabacion.mp4':'Grabacion.webm',base64:'YQ==',contentType:mime}]}})});
 let res=await route.POST(request()),data=await res.json();assert.equal(res.status,200,JSON.stringify(data));assert.equal(data.success,true);assert.equal(created,0);assert.equal(uploads,1);assert.equal(writes.length,1);assert.equal(writes[0].children[1].type,'video');assert.equal(writes[0].children[1].video.file_upload.id,'file-id');assert.match(JSON.stringify(writes[0]),/Revisar el botón/);
 existing=true;res=await route.POST(request());assert.equal(res.status,200);assert.equal(writes.length,1);assert.equal(uploads,1);
 existing=false;res=await route.POST(request('video/webm'));assert.equal(res.status,200);assert.equal(writes[1].children[1].type,'file');assert.equal(uploads,2);
 process.env.DROPBOX_ACCESS_TOKEN='MOCK_ONLY';existing=false;res=await route.POST(new NextRequest('https://anfeta.test/api/data',{method:'POST',body:JSON.stringify({action:'unified-upload',payload:{uploadId:id,mode:'both',targetPageId:id,customFolder:plan.customFolder,title:'Grabacion',body:'Otra indicación',files:[{filename:'Grabacion.webm',base64:'YQ==',contentType:'video/webm'}]}})}));data=await res.json();assert.equal(res.status,200,JSON.stringify(data));assert.equal(created,0);assert.equal(dropboxWrites,1);assert.equal(uploads,2);assert.match(JSON.stringify(writes[2]),/Dropbox:/);
 console.log('OK grabación de actividad: destino por ID sin dominio, misma página, descripción y video real en Solo Notion, reintento sin duplicar. Proveedores simulados.');
})().catch(e=>{console.error(e);process.exitCode=1;});
