const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const {reviewNoticePresentation:present}=require('../src/lib/reviewNoticePresentation.ts');
const {ACTIVITY_TAGS}=require('../src/services/activityTags.ts');
for(const person of Object.keys(ACTIVITY_TAGS)){
 const item={kind:'ftf',id:'ftf:2026-11-04:'+person,person,date:'2026-11-04',activityTitle:person+' completó su revisión FTF de hoy',updated:'2026-11-04T15:41:00Z'};
 const notice=present(item);
 assert.ok(notice.title.startsWith(person+' completó'));
 assert.ok(notice.title.includes('04/11/2026'));
 assert.equal(notice.people,person);
 assert.match(notice.detail,/detección/);
 assert.equal(present({...item,person:undefined,activityTitle:'completó su revisión FTF de hoy'}).people,person,'Old records recover identity from ID');
 const confirmed=present({...item,timeKind:'confirmed',completedAt:'2026-11-04T14:00:00Z'});
 assert.equal(confirmed.timestamp,'2026-11-04T14:00:00Z');assert.match(confirmed.detail,/confirmada/);
}
assert.equal(present({kind:'ftf',activityTitle:'Edwin completó su revisión FTF de hoy'}).people,'Edwin');
assert.equal(present({kind:'ftf'}).people,'Usuario no identificado');
const review=present({authorName:'ggena',recipientName:'nneft',activityTitle:'prtuzR Reporte ADS nne11'});
assert.equal(review.people,'De: Genaro · Para: Neftali');assert.ok(!review.title.includes('nne11'));
assert.equal(present({activityTitle:'Reporte ADS'}).people,'');
console.log('OK avisos: identidad de los 10 usuarios, registros antiguos, acción, fecha, hora confirmada/detectada y título limpio de actividad.');

// The API must identify the real recipient even while listing the sender's own notices.
const vm=require('node:vm');
const identity=require('../src/services/identityNormalizer.ts');
const exported={};
const calls=[];
const page=title=>({id:'notice',url:'https://notion.so/notice',last_edited_time:'2026-11-04T15:00:00Z',properties:{Name:{title:[{plain_text:title}]}}});
const fixtures=[page('2026-11-04 09:00 nneft de:genaro [RESPUESTA] Actividad lista para revisión · prtuzR Reporte nne11'),page('2026-11-04 10:00 ggena de:neftali [RESPUESTA] Revisión aprobada · tuzR Reporte ge11')];
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/services/reviewNotifications.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports:exported,process:{env:{}},require:name=>name==='./identityNormalizer'?identity:name==='./notionMutations'?{notionRequest:async(_settings,path,method)=>{calls.push({path,method});return path.endsWith('/query')?{results:fixtures,has_more:false}:{properties:{Name:{type:'title'}}};}}:{},
});
(async()=>{
 const rows=await exported.listReviewNotifications({},'Genaro');
 assert.equal(rows.length,2);
 assert.equal(rows[0].authorName,'Genaro');assert.equal(rows[0].recipientName,'Neftali');
 assert.equal(rows[1].authorName,'Neftali');assert.equal(rows[1].recipientName,'Genaro');
 assert.equal(calls.length,2);assert.ok(calls.every(call=>!call.method||call.method==='POST'),'Only schema and existing query; no PATCH or extra block requests');
 console.log('OK API: remitente y destinatario reales tanto en avisos enviados como recibidos; sin escrituras ni consultas adicionales.');
})().catch(error=>{console.error(error);process.exitCode=1;});
