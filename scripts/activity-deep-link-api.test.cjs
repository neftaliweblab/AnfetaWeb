const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load;
process.env.NOTION_TOKEN='MOCK_ONLY';
Module._resolveFilename=function(name,parent,...rest){return resolve.call(this,name.startsWith('@/')?path.join(root,'src',name.slice(2)):name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._load=function(name,parent,...rest){
 if(name==='@/services/serverSettings')return {getSettings:()=>({notionToken:'MOCK_ONLY',currentUser:'Neftali'}),saveSettings:()=>{throw Error('Must not write settings');}};
 if(name==='@/services/serverAuth')return {requireActor:async()=> 'Neftali',assertSameOrigin:()=>{}};
 if(name==='@/services/supabaseServer')return {supabaseConfigured:()=>false};
 return load.call(this,name,parent,...rest);
};
const id='38fabd7d91b780199591d3713d7d9421';let requests=[],status=200,archived=false;
global.fetch=async(url,init={})=>{
 assert.equal(init.method||'GET','GET','No writes during opening a direct link');
 assert.equal(String(url),'https://api.notion.com/v1/pages/'+id);
 requests.push(String(url));
 if(status!==200)return Response.json({message:'Mock error'},{status});
 return Response.json({object:'page',id:'38fabd7d-91b7-8019-9591-d3713d7d9421',url:'https://notion.so/'+id,archived,in_trash:false,last_edited_time:'2026-11-04T20:00:00Z',properties:{Name:{type:'title',title:[{plain_text:'Actividad enlazada por ID',text:{content:'Actividad enlazada por ID'}}]}}});
};
(async()=>{
 const route=require('../src/app/api/data/route.ts'),{NextRequest}=require('next/server');
 const get=(value=id)=>route.GET(new NextRequest('https://anfeta-web.vercel.app/api/data?type=calendar-activity&pageId='+value));
 let response=await get(),data=await response.json();
 assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.success,true);
 assert.equal(data.activity.pageId.replace(/-/g,''),id);assert.equal(data.activity.title,'Actividad enlazada por ID');
 assert.equal(data.activity.serverModified,'2026-11-04T20:00:00Z');assert.equal(data.hasDate,false);assert.equal(data.date,null);
 const before=requests.length;response=await get('invalid-id');assert.equal(response.status,400);assert.equal(requests.length,before);
 archived=true;response=await get();assert.equal(response.status,404);archived=false;
 status=404;response=await get();assert.equal(response.status,404);
 status=403;response=await get();assert.equal(response.status,403);
 console.log('OK deep-link API: direct page ID, no search query, current title/freshness, no artificial date, invalid/archived/forbidden handling and zero writes. Notion and session simulated.');
})().catch(error=>{console.error(error);process.exitCode=1;});
