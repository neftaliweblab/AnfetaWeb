const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
Module._extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,p);
const states=new Map(),writes=[];
const load=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.endsWith('ftfNotifications.ts')&&name==='./userState')return {
  readUserState:async(_,person)=>structuredClone(states.get(person)||{revision:0,values:{receipts:{unrelated:'keep'}}}),
  updateUserState:async(_,person,patch,revision)=>{const old=states.get(person)||{revision:0,values:{}};assert.equal(revision,old.revision);const next={revision:revision+1,values:{...old.values,...patch}};states.set(person,next);writes.push(person);return next;}
 };
 return load.call(this,name,parent,...rest);
};
const {completedFtfPeople,notificationPageId}=require(root+'/src/services/ftfCompletion.ts');
const {recordFtfCompletions}=require(root+'/src/services/ftfNotifications.ts');
const before=new Date('2026-10-16T17:59:00-06:00'),after=new Date('2026-10-16T18:00:00-06:00');
const a={pageId:'one',person:'nneft',start:'2026-10-16T10:00:00-06:00',ftfAvailable:true,ftfVerified:true,checklistTotal:6,checklistCompleted:0};
(async()=>{
 assert.deepEqual(completedFtfPeople([],before),[]);
 assert.deepEqual(completedFtfPeople([a],before),['Neftali']);
 assert.deepEqual(completedFtfPeople([a],after),['Neftali']);
 assert.deepEqual(completedFtfPeople([a,{...a,pageId:'two',ftfVerified:false}],before),[]);
 assert.deepEqual(completedFtfPeople([{...a,ftfAvailable:false}],before),[]);
 assert.deepEqual(completedFtfPeople([{...a,isReviewMirror:true},{...a,isHandoffMirror:true}],before),[]);
 assert.deepEqual(completedFtfPeople([{...a,start:'2026-10-15T10:00:00-06:00'}],before),[]);
 assert.deepEqual(completedFtfPeople([a,{...a,pageId:'late',ftfVerified:false,start:'2026-10-16T18:00:00-06:00'}],before),['Neftali']);
 assert.deepEqual(completedFtfPeople([a,{...a,person:'John',pageId:'john',ftfVerified:false}],before),['Neftali']);
 assert.equal(notificationPageId('https://www.notion.so/title-123456781234123412341234567890ab?pvs=4'),'123456781234123412341234567890ab');
 assert.equal(notificationPageId('12345678-1234-1234-1234-1234567890ab'),'123456781234123412341234567890ab');
 assert.equal(notificationPageId('dominio.com'), '');
 await recordFtfCompletions({},[a],before);
 assert.deepEqual(writes,['John','Neftali']);
 for(const person of writes){const receipts=states.get(person).values.receipts;assert.equal(receipts.unrelated,'keep');assert.equal(Object.keys(receipts.ftfCompletions).length,1);}
 await recordFtfCompletions({},[a],before);assert.equal(writes.length,2);
 await recordFtfCompletions({},[a],after);assert.equal(writes.length,2);
 const id='ftf:2026-10-16:Neftali',record=states.get('John').values.receipts.ftfCompletions[id];
 assert.equal(record.updated,before.toISOString());
 assert.equal(record.person,'Neftali');
 // A deletion/read receipt must survive subsequent checks and never recreate the event.
 states.get('John').values.receipts.dismissedReviewNotifications={[id]:record.updated};
 states.get('John').values.receipts.reviewNotifications={[id]:record.updated};
 await recordFtfCompletions({},[a],before);assert.equal(writes.length,2);
 assert.equal(states.get('John').values.receipts.dismissedReviewNotifications[id],record.updated);
 await recordFtfCompletions({},[{...a,start:'2026-10-17T10:00:00-06:00'}],new Date('2026-10-17T12:00:00-06:00'));
 assert.equal(Object.keys(states.get('John').values.receipts.ftfCompletions).length,2);
 assert.equal(states.get('John').values.receipts.dismissedReviewNotifications[id],record.updated);
 await recordFtfCompletions({},[{...a,person:'John'}],new Date('2026-10-16T18:30:00-06:00'),'confirmed');const late=states.get('John').values.receipts.ftfCompletions['ftf:2026-10-16:John'];assert.equal(late.late,true);assert.equal(late.timeKind,'confirmed');assert.equal(late.completedAt,'2026-10-17T00:30:00.000Z');
 console.log('OK: FTF por persona/día, corte 18:00 México, sin copias, checklist independiente, destinatarios, persistencia, deduplicación y recibos conservados. Servicios simulados.');
})().catch(e=>{console.error(e);process.exitCode=1;});
