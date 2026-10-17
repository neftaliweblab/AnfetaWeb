const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const {normalizedWhatsappGroups,whatsappGroupId,whatsappAccessUrl,whatsappMatchScore}=require(root+'/src/lib/whatsappGroups.ts');
const {createWahaClient}=require(root+'/src/services/wahaClient.ts');
const {PGlite}=require('@electric-sql/pglite');
const answer=(data,status=200)=>new Response(data===undefined?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function main(){
 assert.deepEqual(normalizedWhatsappGroups([{id:{_serialized:'123-456@g.us'},name:' Cliente '},{id:'123-456@g.us',groupMetadata:{subject:'Cliente nuevo'}}]),[{id:'123-456@g.us',name:'Cliente nuevo'}]);
 for(const id of ['123@c.us','../../sessions','x@g.us',null])assert.throws(()=>whatsappGroupId(id));
 assert.throws(()=>normalizedWhatsappGroups({groups:[]}));assert.throws(()=>normalizedWhatsappGroups([{id:'123@g.us'}]));
 const invite='https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv';
 assert.equal(whatsappAccessUrl(invite+'?mode=test#fragment'),invite);assert.equal(whatsappAccessUrl(''),null);
 for(const url of ['javascript:alert(1)','https://chat.whatsapp.com.evil.test/AbCdEfGhIj','https://user:pass@chat.whatsapp.com/AbCdEfGhIj','https://wa.me/123','https://chat.whatsapp.com/'])assert.throws(()=>whatsappAccessUrl(url));
 assert.ok(whatsappMatchScore('anfeta.com desarrollo','prtuzREVISION anfeta.com Mejoras')>=100);
 assert.equal(whatsappMatchScore('otro.com desarrollo','anfeta.com desarrollo'),0);
 assert.equal(whatsappMatchScore('Grupo revisión John','prtuzREVISION revisión John'),0);
 assert.ok(whatsappMatchScore('Cliente Jardines Monterrey','Jardines Monterrey correcciones')>0);
 process.env.WAHA_BASE_URL='http://localhost:3001';process.env.WAHA_API_KEY='test-only-secret';process.env.WAHA_SESSION='default';
 const calls=[];let state='ABSENT';
 const transport=async(url,init)=>{
  calls.push({url,method:init.method,body:init.body});assert.equal(init.headers['X-Api-Key'],'test-only-secret');assert.equal(init.redirect,'error');
  const p=new URL(url).pathname,method=init.method;
  if(p==='/api/sessions/default'&&method==='GET')return state==='ABSENT'?answer({},404):answer({status:state,engine:{engine:'WEBJS'}});
  if(p==='/api/sessions'&&method==='POST'){assert.deepEqual(JSON.parse(init.body).config.webhooks,[]);state='SCAN_QR_CODE';return answer({});}
  if(p.endsWith('/auth/qr'))return answer({mimetype:'image/png',data:'aGVsbG8='});
  if(p.endsWith('/me'))return answer({id:'521234567890:2@c.us'});
  if(p.endsWith('/groups/count'))return answer({count:52});
  if(p.endsWith('/groups')){const offset=Number(new URL(url).searchParams.get('offset'));assert.equal(new URL(url).searchParams.get('exclude'),'participants');return answer(Array.from({length:offset===0?50:2},(_,i)=>({id:{_serialized:(1000+offset+i)+'@g.us'},name:'Grupo '+(offset+i),lastMessage:{body:'never persisted'},participants:['never persisted']})));}
  if(p.endsWith('/invite-code'))return answer('AbCdEfGhIjKlMnOpQrStUv');
  if(p.endsWith('/logout')){state='STOPPED';return answer({});}
  if(p==='/api/sessions/default'&&method==='DELETE'){state='ABSENT';return answer(undefined,204);}
  throw Error('Unexpected endpoint '+p);
 };
 const client=createWahaClient(transport);assert.equal((await client.start()).status,'SCAN_QR_CODE');assert.match(await client.qr(),/^data:image\/png;base64,/);
 await assert.rejects(client.groups(0),/Vincula/);state='WORKING';
 const first=await client.groups(0),last=await client.groups(50);assert.equal(first.done,false);assert.equal(last.done,true);assert.equal(last.nextOffset,52);assert.equal(first.account,'521234567890@c.us');assert.deepEqual(Object.keys(first.groups[0]),['id','name']);
 assert.equal(await client.invite('1000@g.us'),invite);assert.deepEqual(await client.disconnect(),{disconnected:true});assert.deepEqual(await client.disconnect(),{disconnected:true});
 assert.ok(calls.findIndex(c=>c.url.endsWith('/logout'))<calls.findIndex(c=>c.method==='DELETE'));assert.ok(!calls.some(c=>/send|messages|participants|revoke|join\b/.test(new URL(c.url).pathname)));
 state='WORKING';const logoutFails=createWahaClient(async(url,init)=>url.endsWith('/logout')?answer({},500):transport(url,init));const priorDeletes=calls.filter(c=>c.method==='DELETE').length;
 await assert.rejects(logoutFails.disconnect(),/no confirmó/);assert.equal(calls.filter(c=>c.method==='DELETE').length,priorDeletes);
 await assert.rejects(createWahaClient(async()=>answer({status:'WORKING',engine:{engine:'NOWEB'}})).status(),/WEBJS/);
 await assert.rejects(createWahaClient(async()=>{throw Error('secret remote error');}).status(),e=>!e.message.includes('secret'));
 process.env.WAHA_BASE_URL='http://example.com';assert.throws(()=>createWahaClient(),/HTTPS/);process.env.WAHA_BASE_URL='http://localhost:3001';
 const db=new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role;');
 await db.exec(fs.readFileSync(root+'/supabase/migrations/202610160019_whatsapp_directory.sql','utf8'));
 const importBatch=(key,groups)=>db.query('select public.import_anfeta_whatsapp_groups($1,$2::jsonb)',[key,JSON.stringify(groups)]);
 const account='a'.repeat(64);await importBatch(account,first.groups);await importBatch(account,last.groups);
 assert.equal((await db.query('select count(*)::int as n from whatsapp_groups')).rows[0].n,52);
 await db.query("update whatsapp_groups set access_url=$1 where group_id='1000@g.us'",[invite]);
 await db.query("insert into whatsapp_activity_links(owner,group_id,page_id,activity_title) values('John','1000@g.us','abc','Proyecto')");
 await importBatch(account,[{id:'1000@g.us',name:'Renamed'}]);const saved=(await db.query("select name,access_url from whatsapp_groups where group_id='1000@g.us'")).rows[0];assert.equal(saved.name,'Renamed');assert.equal(saved.access_url,invite);assert.equal((await db.query('select count(*)::int as n from whatsapp_activity_links')).rows[0].n,1);
 await assert.rejects(importBatch('b'.repeat(64),[{id:'9999@g.us',name:'Wrong account'}]),/different_whatsapp_account/);
 assert.equal((await db.query("select count(*)::int as n from whatsapp_groups where group_id='9999@g.us'")).rows[0].n,0);
 await assert.rejects(importBatch(account,[{id:'8888@g.us',name:'Valid'},{id:'invalid',name:'Invalid'}]));
 assert.equal((await db.query("select count(*)::int as n from whatsapp_groups where group_id='8888@g.us'")).rows[0].n,0);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from whatsapp_groups'),/permission denied/);await assert.rejects(importBatch(account,[]),/permission denied/);await db.exec('reset role');await db.close();
 // Exercise the route boundary: a hidden button is not authorization.
 let actor='Neftali',storageCalls=0,originChecks=0;
 const load=Module._load;
 Module._load=function(id,...args){
  if(id==='@/services/serverAuth')return {requireActor:async()=>actor,assertSameOrigin:req=>{originChecks++;if(req.headers.get('origin')!==new URL(req.url).origin)throw Error('Origen de solicitud no permitido.');}};
  if(id==='@/services/supabaseServer')return {supabaseAdmin:()=>{storageCalls++;throw Error('Storage must not be reached');}};
  if(id==='@/services/wahaClient')return {...require(root+'/src/services/wahaClient.ts'),wahaConfigured:()=>false};
  return load.call(this,id,...args);
 };
 const route=require(root+'/src/app/api/whatsapp/route.ts');
 let response=await route.GET(new Request('https://anfeta.test/api/whatsapp'));assert.equal(response.status,403);assert.equal(storageCalls,0);
 response=await route.POST(new Request('https://anfeta.test/api/whatsapp',{method:'POST',body:JSON.stringify({action:'disconnect'})}));assert.equal(response.status,403);assert.equal(originChecks,0);
 actor='John';response=await route.GET(new Request('https://anfeta.test/api/whatsapp?action=status'));assert.equal(response.status,200);assert.deepEqual(await response.json(),{configured:false,status:'NOT_CONFIGURED'});assert.match(response.headers.get('Cache-Control'),/no-store/);
 response=await route.POST(new Request('https://anfeta.test/api/whatsapp',{method:'POST',headers:{origin:'https://evil.test'},body:JSON.stringify({action:'import',offset:0})}));assert.notEqual(response.status,200);assert.equal(originChecks,1);assert.equal(storageCalls,0);
 response=await route.POST(new Request('https://anfeta.test/api/whatsapp',{method:'POST',headers:{origin:'https://anfeta.test'},body:JSON.stringify({action:'sendMessage'})}));assert.equal(response.status,400);assert.equal(storageCalls,0);
 response=await route.POST(new Request('https://anfeta.test/api/whatsapp',{method:'POST',headers:{origin:'https://anfeta.test'},body:JSON.stringify({action:'import',offset:1})}));assert.equal(response.status,400);assert.equal(storageCalls,0);
 Module._load=load;
 console.log('OK: QR, WEBJS, paginación, datos mínimos, enlaces, coincidencias, logout antes de borrar, fallos, importación atómica, renombres, otra cuenta, permisos privados, autorización de John y rechazo de origen externo/envío.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
