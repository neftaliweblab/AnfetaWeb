const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,p);


const load=Module._load;let writes=0;
Module._load=function(name,parent,...rest){if(parent?.filename.replace(/\\/g,'/').endsWith('/api/whatsapp-directory/route.ts')){
 if(name==='@/services/serverAuth')return {sessionActor:()=>undefined,requireActor:async req=>{const actor=req.headers.get('x-test-user');if(!actor)throw Error('Inicia sesión');return actor;},assertSameOrigin:req=>{if(req.headers.get('origin')&&req.headers.get('origin')!=='http://localhost')throw Error('Origen');}};
 if(name==='@/services/supabaseServer')return {supabaseConfigured:()=>false};
 if(name==='fs')return {existsSync:()=>false,mkdirSync:()=>{writes++;},writeFileSync:()=>{writes++;}};
 }return load.call(this,name,parent,...rest);};
(async()=>{const {GET,POST}=require('../src/app/api/whatsapp-directory/route.ts');const {NextRequest}=require('next/server');assert.equal((await GET(new NextRequest('http://localhost/api/whatsapp-directory?all=1'))).status,401);assert.equal((await POST(new NextRequest('http://localhost/api/whatsapp-directory',{method:'POST',body:'{}'}))).status,401);
 const res=await GET(new NextRequest('http://localhost/api/whatsapp-directory?all=1',{headers:{'x-test-user':'John'}}));assert.equal(res.status,200);assert.equal((await res.json()).groups.length,0);
 const forged=await POST(new NextRequest('http://localhost/api/whatsapp-directory',{method:'POST',headers:{'x-test-user':'Karla','Content-Type':'application/json'},body:JSON.stringify({user:'John',groups:[{id:'a',name:'Prueba'}]})}));assert.equal(forged.status,403);assert.equal(writes,0);
 console.log('OK directorio requiere sesión y evita escrituras con otro usuario; ninguna escritura real.');})().catch(e=>{console.error(e);process.exitCode=1;});
