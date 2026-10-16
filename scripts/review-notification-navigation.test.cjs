const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const alertId='11111111-1111-4111-8111-111111111111',sourceId='22222222-2222-4222-8222-222222222222';
let metadata={PageId:sourceId,PageUrl:'https://notion.so/'+sourceId.replace(/-/g,''),Title:'Mismo dominio, actividad exacta'},archived=false,requests=[];
const load=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.endsWith('reviewNotifications.ts')){
  if(name==='./pwaPush')return {sendPwaPush:async()=>{throw Error('No debe enviar avisos al navegar');}};
  if(name==='./notionMutations')return {notionRequest:async(_,route,method)=>{assert.equal(method,undefined);requests.push(route);if(route==='pages/'+alertId)return {properties:{Name:{type:'title',title:[{plain_text:'nneft de:john [RESPUESTA] Actividad lista para revisión · dominio.com'}]}}};assert.equal(route,'pages/'+sourceId.replace(/-/g,''));return {id:sourceId,archived};}};
  if(name==='./notionCalendar')return {readBlocks:async()=>metadata?[{type:'paragraph',paragraph:{rich_text:[{plain_text:'[ANFETA_REVIEW_SOURCE_V1]'+Buffer.from(JSON.stringify(metadata)).toString('base64')}]}}]:[]};
 }
 return load.call(this,name,parent,...rest);
};
const {reviewNotificationActivity}=require(root+'/src/services/reviewNotifications.ts');
(async()=>{
 assert.equal((await reviewNotificationActivity({},'Neftali',alertId)).id,sourceId);
 assert.deepEqual(requests,['pages/'+alertId,'pages/'+sourceId.replace(/-/g,'')]);
 requests=[];await assert.rejects(()=>reviewNotificationActivity({},'Karla',alertId),/tu cuenta/);assert.deepEqual(requests,['pages/'+alertId]);
 archived=true;await assert.rejects(()=>reviewNotificationActivity({},'Neftali',alertId),/eliminada o archivada/);
 archived=false;metadata=null;await assert.rejects(()=>reviewNotificationActivity({},'Neftali',alertId),/identificable/);
 await assert.rejects(()=>reviewNotificationActivity({},'Neftali','bad-id'),/inválido/);
 console.log('OK: apertura por ID original, sin coincidencias por dominio, autorización del hilo, archivadas y aviso sin origen. Notion simulado.');
})().catch(e=>{console.error(e);process.exitCode=1;});
