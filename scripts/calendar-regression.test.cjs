const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..').replace(/\\/g,'/');
process.env.NOTION_TOKEN='TEST_ONLY';
process.chdir(root);
const ts=require(path.join(root,'node_modules/typescript'));
const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(root,'src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx']) Module._extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const pid='11111111-1111-1111-1111-111111111111', other='22222222-2222-2222-2222-222222222222';
const settings={notionToken:'TEST_ONLY',currentUser:'nneft'};
const load=Module._load;
Module._load=function(name,parent,...rest){
  if(name==='@/services/serverAuth' && parent?.filename.replace(/\\/g,'/').endsWith('/src/app/api/data/route.ts'))return {requireActor:req=>req.headers.get('x-test-user') || 'nneft',assertSameOrigin:()=>{}};
  if((name==='fs'||name==='node:fs') && ['/src/app/api/data/route.ts','/src/services/serverSettings.ts'].some(s=>parent?.filename.replace(/\\/g,'/').endsWith(s))) return {...fs,
    existsSync:p=>String(p).replace(/\\/g,'/')===root+'/settings.json',
    readFileSync:p=>{if(String(p).replace(/\\/g,'/')===root+'/settings.json')return JSON.stringify(settings);throw Error('Unexpected filesystem read in API test');},
    mkdirSync:()=>{},writeFileSync:()=>{},
  };
  return load.call(this,name,parent,...rest);
};
const presentation=require(root+'/src/services/calendarPresentation.ts');
const identity=require(root+'/src/services/identityNormalizer.ts');
const permissions=require(root+'/src/services/activityPermissions.ts');
const mutations=require(root+'/src/services/notionMutations.ts');
const calendar=require(root+'/src/services/notionCalendar.ts');
const layout=require(root+'/src/utils/calendarLayout.ts');
const route=require(root+'/src/app/api/data/route.ts');
let state;
function fixture(){return {id:pid,url:'https://notion.so/'+pid,parent:{data_source_id:'source'},last_edited_time:'2026-10-06T00:00:00Z',properties:{Name:{type:'title',title:[{plain_text:'prtuzREVISION sseo 26-[10OCT] nneft anfeta.com Optimización SEO',text:{content:'prtuzREVISION sseo 26-[10OCT] nneft anfeta.com Optimización SEO'}}]},'Assignee/Ejecutor Principal':{type:'people',people:[{id:'neft-id',name:'Neftalí',person:{email:'nnetf@practicante.com'}}]},'Fecha POR Hacer':{type:'date',date:{start:'2026-10-05T14:00:00Z',end:'2026-10-05T15:00:00Z'}},Estado:{type:'status',status:{name:'Por hacer'}},Locked:{type:'checkbox',checkbox:false}}};}
function reset(options={}){settings.notionToken='TEST_ONLY_' + Math.random().toString(36).slice(2); process.env.NOTION_TOKEN=settings.notionToken;
state={page:fixture(),calls:[],flow:undefined,failMetadata:false,failChecklist:false,usersMissing:false,...options};delete process.env.NOTION_PERSON_IDS;}
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}
global.fetch=async(url,options={})=>{
  assert.ok(String(url).startsWith('https://api.notion.com/v1/'),'Tests must not call an external service');
  const target=String(url).split('/v1/')[1].replace(pid.replace(/-/g,''),pid).replace(other.replace(/-/g,''),other),method=options.method || 'GET',body=options.body?JSON.parse(options.body):undefined;
  state.calls.push({target,method,body});
  if(target==='pages' && method==='POST') {
    if(state.failAlert || state.failCreate)return response({message:'Creation rejected'},403);
    const properties={};for(const [name,prop] of Object.entries(body.properties)) {assert.ok(!Array.isArray(prop),'Notion properties must be objects');const type=Object.keys(prop)[0];properties[name]={type,...prop};if(type==='people')properties[name].people=prop.people.map(u=>({...u,name:u.id==='neft-id'?'Neftali':'John'}));}
    state.createdPage={id:other,url:'https://notion.so/'+other,parent:body.parent,properties};return response(state.createdPage);
  }
  if(target==='pages/'+other && method==='GET')return response(state.createdPage ? {...state.createdPage,archived:!!state.archivedAlert} : {id:other,url:'https://notion.so/'+other,archived:!!state.archivedAlert,properties:{Name:{type:'title',title:[]}}});
  if(target==='pages/'+other && method==='PATCH')return response({id:other});
  if(target.startsWith('blocks/'+other+'/children') && method==='GET')return response({results:[],has_more:false});
  if((target==='blocks/'+other+'/children'||target.startsWith('blocks/copied-')) && method==='PATCH')return response({results:body.children.map((b,i)=>({...b,id:'copied-'+i}))});
  if(target==='pages/'+pid && method==='GET')return response(state.page);
  if(target.startsWith('data_sources/') && method==='GET' && state.realSchema) return response({properties:{Name:{type:'title'},'Assignee/Ejecutor Principal':{type:'people'},'Fecha POR Hacer':{type:'date'},'(bien) Estado opcion multiple revisiones':{type:'status',status:{options:[{name:'PRTUZ POR HACER'},{name:'REVISAR REVISIONES rrevi'},{name:'TERMINADO REV COBRO/DOCUMENTACION'}]}}}});
  if(target.startsWith('data_sources/') && method==='GET') return response({properties:{Name:{type:'title'},'Assignee/Ejecutor Principal':{type:'people'},'Fecha POR Hacer':{type:'date'},Estado:{type:'status',status:{options:[{name:'Por hacer'},{name:'En revisión'},{name:'Terminada'}]}}}});
  if(target.endsWith('/query') && state.guestReviewer) return response({results:[{...fixture(),properties:{...fixture().properties,'Assignee/Ejecutor Principal':{type:'people',people:[{id:'guest-isaias',name:'iisai@pprin.com'}]}}}],has_more:false});
  if(target.endsWith('/query')) return response(body.start_cursor ? {results:[{...fixture(),id:other}],has_more:false} : {results:[state.queryCurrent ? state.page : fixture()],has_more:true,next_cursor:'page-two'});
  if(target.startsWith('users?'))return response({results:state.usersMissing?[]:[{id:'john-id',type:'person',name:'John',person:{email:'jjohn@pprin.com'}},{id:'genaro-id',type:'person',name:'Genaro',person:{email:'ggena@pprin.com'}}],has_more:false});
  if(target==='pages/'+pid && method==='PATCH'){
    if(state.failPage)return response({message:'PATCH rejected'},403);
    for(const [name,p] of Object.entries(body.properties)) {
      const property={type:Object.keys(p)[0],...p};
      if (property.type === 'people') property.people = property.people.map(user => ({...user,name:({'john-id':'John','genaro-id':'Genaro','guest-isaias':'Isaias','neft-id':'Neftali'})[user.id] || user.name}));
      state.page.properties[name]=property;
    }
    return response(state.page);
  }
  if(target==='blocks/'+pid+'/children' && method==='PATCH'){
    if(state.failMetadata)return response({message:'Metadata rejected'},403);
    const text=body.children[0].toggle.children[0].paragraph.rich_text[0].text.content;
    if(text.startsWith(calendar.REVIEW_PREFIX))state.flow=JSON.parse(Buffer.from(text.slice(calendar.REVIEW_PREFIX.length),'base64').toString());
    return response({results:body.children});
  }
  if(target.startsWith('blocks/'+pid+'/children')){
    if(state.blockFailure)return response({message:'Cannot read blocks'},403);
    if(state.customBlocks)return response({results:state.customBlocks,has_more:false});
    const flow=state.flow?[{id:'flow-toggle',type:'toggle',has_children:true}]:[];
    if(target.includes('start_cursor='))return response({results:[{id:'todo-second',type:'to_do',to_do:{checked:true,rich_text:[{plain_text:'Segunda tarea'}]}}],has_more:false});
    return response({results:[...flow,{id:'todo-first',type:'to_do',to_do:{checked:false,rich_text:[{plain_text:'Primera tarea'}]}},{id:'nested',type:'toggle',has_children:true}],has_more:!!state.paginatedBlocks,next_cursor:state.paginatedBlocks?'blocks-two':null});
  }
  if(target.startsWith('blocks/flow-toggle/children'))return response({results:[{type:'paragraph',paragraph:{rich_text:[{plain_text:calendar.REVIEW_PREFIX+Buffer.from(JSON.stringify(state.flow)).toString('base64')}]}}],has_more:false});
  if(target.startsWith('blocks/nested/children'))return response({results:[{id:'todo-nested',type:'to_do',to_do:{checked:false,rich_text:[{plain_text:'Tarea anidada real'}]}}],has_more:false});
  if(target==='blocks/todo-first' && method==='PATCH')return state.failChecklist?response({message:'Notion rejected checklist'},403):response({id:'todo-first',to_do:{checked:body.to_do.checked}});
  throw Error('Unexpected mock request '+method+' '+target);
};
let passed=0;const lines=[];
async function test(name,fn){if(process.env.ANFETA_TEST_FILTER&&!new RegExp(process.env.ANFETA_TEST_FILTER,'i').test(name))return;reset();await fn();passed++;lines.push('OK '+name);console.log('OK '+name);}
const request=(action,payload)=>new Request('http://localhost/api/data',{method:'POST',headers:{'Content-Type':'application/json','x-test-user':payload?.currentUser || 'nneft'},body:JSON.stringify({action,payload})});
(async()=>{
  await test('Editor calendario conserva nomenclatura al renombrar sin mover horario',async()=>{const expected=state.page.properties.Name.title[0].text.content;const page=await mutations.mutateActivity(settings,'nneft',pid,{titleDescription:'Nueva descripción manual',expectedTitle:expected});assert.equal(page.properties.Name.title[0].text.content,'prtuzREVISION sseo 26-[10OCT] anfeta.com Nueva descripción manual nneft');assert.equal(state.calls.some(c=>c.method==='PATCH'&&c.body.properties?.['Fecha POR Hacer']),false);});
  await test('Editor calendario rechaza nombre y fin editados por otra sesión',async()=>{await assert.rejects(()=>mutations.mutateActivity(settings,'nneft',pid,{titleDescription:'Nuevo',expectedTitle:'Viejo'}),/nombre cambió/);assert.equal(state.calls.some(c=>c.method==='PATCH'),false);await assert.rejects(()=>mutations.mutateActivity(settings,'nneft',pid,{start:'2026-10-07T10:00:00-06:00',end:'2026-10-07T11:00:00-06:00',expectedStart:state.page.properties['Fecha POR Hacer'].date.start,expectedEnd:'2026-10-05T16:00:00Z'}),/horario cambió/);assert.equal(state.calls.some(c=>c.method==='PATCH'),false);});
  await test('Editor calendario guarda nombre fecha y horario en una sola actualización',async()=>{const oldTitle=state.page.properties.Name.title[0].text.content,oldDate=state.page.properties['Fecha POR Hacer'].date;const response=await route.POST(request('update-activity-details',{id:pid,currentUser:'nneft',titleDescription:'Trabajo reprogramado',expectedTitle:oldTitle,expectedStart:oldDate.start,expectedEnd:oldDate.end,start:'2026-10-07T10:00:00-06:00',end:'2026-10-07T11:00:00-06:00'}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.success,true);assert.match(data.activity.title,/Trabajo reprogramado/);assert.equal(data.activity.start,'2026-10-07T10:00:00-06:00');const patch=state.calls.find(c=>c.target==='pages/'+pid&&c.method==='PATCH');assert.ok(patch.body.properties.Name);assert.equal(patch.body.properties['Fecha POR Hacer'].date.end,'2026-10-07T11:00:00-06:00');});
  await test('Editor calendario permite renombrar terminada sin modificar fecha histórica',async()=>{state.page.properties.Name.title=[{text:{content:'zREVISION sseo anfeta.com Texto neft gena'}}];const page=await mutations.mutateActivity(settings,'jjohn',pid,{titleDescription:'Nombre corregido'});assert.equal(page.properties.Name.title[0].text.content,'zREVISION sseo anfeta.com Nombre corregido neft gena');});
  await test('Fecha y hora de México, incluso después de medianoche UTC',()=>{assert.equal(presentation.mexicoDate('2026-10-06T00:39:00Z'),'2026-10-05');assert.equal(presentation.calendarTime('2026-10-05T14:00:00Z'),'08:00');});
  await test('Los ocho códigos oficiales muestran el tipo correcto',()=>{for(const [code,label] of [['aads','ADS'],['sseo','SEO'],['wwebs','WEBS'],['mmaps','MAPS'],['ddise','DISEÑO'],['aapli','APLICACIÓN'],['pprog','PROGRAMAS'],['rrede','REDES']])assert.equal(presentation.calendarType(code+' anfeta.com Trabajo'),label);});
  await test('Título sin dominio repetido ni metadatos, conserva descripción',()=>{assert.equal(presentation.calendarDisplayTitle('prtuzREVISION sseo 26-[10OCT] nneft anfeta.com Optimización SEO anfeta.com','anfeta.com'),'Optimización SEO');});
  await test('Horas, años y números no se convierten en urgencias',()=>{for(const title of ['Cita 08:00','Reporte 2000','1000 visitas'])assert.equal(presentation.calendarUrgent(title),false);assert.equal(presentation.calendarUrgent('jjohn0000 Revisar'),true);assert.equal(presentation.calendarUrgent('Revisar 00'),true);});
  await test('Identidades completas y correos; iniciales desconocidas sin privilegios',()=>{assert.equal(identity.normalizePerson('nnetf@practicante.com'),'Neftali');assert.equal(identity.normalizePerson('g'),'g');assert.equal(permissions.canEditActivity('g',{person:'Karla'}),false);assert.equal(permissions.canEditActivity('nnetf@practicante.com',{person:'Neftali'}),true);});
  await test('Respeta roles de John, Isaías y Genaro; bloqueos y espejos protegidos',()=>{for(const actor of ['jjohn','iisai','ggena']){assert.equal(permissions.canEditActivity(actor,{person:'Karla'}),true);assert.equal(permissions.canEditActivity(actor,{person:'Karla',isLocked:true}),false);assert.equal(permissions.canEditActivity(actor,{person:'Karla',isReviewMirror:true}),false);}});
  await test('Empalmes calculados en la misma zona horaria',()=>{const a={start:'2026-10-05T14:00:00Z',end:'2026-10-05T15:00:00Z'},b={start:'2026-10-05T08:30:00-06:00',end:'2026-10-05T09:30:00-06:00'};assert.deepEqual(layout.computeActivityOverlaps([a,b],'2026-10-05').map(p=>p.overlapTotal),[2,2]);});
  await test('Calendario pagina la fuente real con filtro de fecha local',async()=>{const pages=await calendar.queryCalendarPages(settings,'2026-10-05','2026-10-06');assert.equal(pages.length,2);const calls=state.calls.filter(c=>c.target.endsWith('/query'));assert.equal(calls[1].body.start_cursor,'page-two');assert.equal(calls[0].body.filter.and[0].date.on_or_after,'2026-10-05T00:00:00-06:00');});
  await test('Checklist incluye todos los lotes y tareas anidadas reales',async()=>{state.paginatedBlocks=true;const items=await calendar.readChecklist(settings,pid);assert.deepEqual(items.map(i=>i.text),['Primera tarea','Tarea anidada real','Segunda tarea']);});
  await test('Revisión cambia People y título y guarda metadatos compatibles con escritorio',async()=>{const page=await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION',leaveVisualCopy:true});assert.equal(page.properties['Assignee/Ejecutor Principal'].people[0].id,'john-id');assert.match(page.properties.Name.title[0].text.content,/^rtuzREVISION.*jjohn/);assert.equal(state.flow.OriginalPerson,'Neftali');assert.equal(state.flow.ReviewAssignee,'John');assert.equal(state.flow.OriginalAssigneeUserId,'neft-id');assert.equal(state.flow.LeaveVisualCopy,true);});
  await test('Revisión solo admite a los tres revisores oficiales',async()=>{await assert.rejects(mutations.mutateActivity(settings,'nneft',pid,{reviewer:'Karla',status:'rtuzREVISION'}),/John/);assert.equal(state.calls.filter(c=>c.method==='PATCH').length,0);});
  await test('Cuenta de revisor no resuelta impide éxito falso',async()=>{state.usersMissing=true;await assert.rejects(mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'}),/cuenta real/);assert.equal(state.calls.filter(c=>c.method==='PATCH').length,0);});
  await test('Si falla el metadato se restaura la actividad anterior',async()=>{state.failMetadata=true;await assert.rejects(mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'}),/restauró/);assert.equal(state.page.properties['Assignee/Ejecutor Principal'].people[0].id,'neft-id');assert.match(state.page.properties.Name.title[0].text.content,/^prtuzREVISION/);});
  await test('Terminar revisión conserva zREVISION y devuelve al responsable original',async()=>{await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'});const page=await mutations.mutateActivity(settings,'jjohn',pid,{status:'zREVISION'});assert.equal(page.properties['Assignee/Ejecutor Principal'].people[0].id,'neft-id');assert.match(page.properties.Name.title[0].text.content,/^zREVISION.*\bneft\b.*\bjohn\b/);assert.equal(state.flow.State,'approved');});
  await test('Revisión con urgencia no pierde prefijo ni revisor',async()=>{const page=await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION',isUrgent:true});assert.match(page.properties.Name.title[0].text.content,/^rtuzREVISION.*jjohn.* 00$/);});
  await test('API de checklist propaga el rechazo de Notion',async()=>{state.failChecklist=true;const res=await route.POST(request('toggle-checklist',{pageId:pid,blockId:'todo-first',checked:true,currentUser:'nneft'}));assert.equal(res.status,400);assert.match((await res.json()).error,/rejected/);});
  await test('API impide editar una tarea de otra actividad',async()=>{const res=await route.POST(request('toggle-checklist',{pageId:pid,blockId:'foreign-block',checked:true,currentUser:'nneft'}));assert.equal(res.status,400);assert.equal(state.calls.filter(c=>c.method==='PATCH').length,0);});
  await test('API de checklist respeta actividad bloqueada',async()=>{state.page.properties.Locked.checkbox=true;const res=await route.POST(request('toggle-checklist',{pageId:pid,blockId:'todo-first',checked:true,currentUser:'ggena'}));assert.equal(res.status,400);});
  await test('API de tareas devuelve error de lectura sin fabricar items',async()=>{state.blockFailure=true;const res=await route.POST(request('get-checklist',{pageId:pid}));assert.equal(res.status,400);assert.equal((await res.json()).items,undefined);});
  await test('API confirma el estado efectivamente guardado del checklist',async()=>{const res=await route.POST(request('toggle-checklist',{pageId:pid,blockId:'todo-first',checked:true,currentUser:'nneft'}));assert.equal(res.status,200);assert.equal((await res.json()).checked,true);});
  await test('API entrega páginas separadas y semántica de semana lunes a domingo',async()=>{const res=await route.GET(new Request('http://localhost/api/data?type=calendar-week&date=2026-10-08'));assert.equal(res.status,200);const data=await res.json();assert.equal(data.dates[0],'2026-10-05');assert.equal(data.dates[6],'2026-10-11');assert.equal(data.count,2);});
  await test('Estado de revisión oficial tiene prioridad sobre entrega y cobro', async () => {
    state.realSchema=true;
    state.page.properties['Estado de entrega']={type:'select',select:{name:'Entregado'}};
    state.page.properties['(bien) Estado opcion multiple revisiones']={type:'status',status:{name:'PRTUZ POR HACER'}};
    const page=await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'});
    assert.equal(page.properties['(bien) Estado opcion multiple revisiones'].status.name,'REVISAR REVISIONES rrevi');
    assert.equal(page.properties['Estado de entrega'].select.name,'Entregado');
    const finished=await mutations.mutateActivity(settings,'jjohn',pid,{status:'zREVISION'});
    assert.equal(finished.properties['(bien) Estado opcion multiple revisiones'].status.name,'TERMINADO REV COBRO/DOCUMENTACION');
  });
  await test('Revisor invitado se resuelve desde People aunque no salga en /users', async () => {
    state.guestReviewer=true; state.usersMissing=true;
    const page=await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'Isaias',status:'rtuzREVISION'});
    assert.equal(page.properties['Assignee/Ejecutor Principal'].people[0].id,'guest-isaias');
  });
  await test('No se envía a revisión por un cambio de estado sin elegir revisor', async () => {
    await assert.rejects(mutations.mutateActivity(settings,'nneft',pid,{status:'rtuzREVISION'}),/modal/);
    assert.equal(state.calls.filter(c=>c.method==='PATCH').length,0);
  });
  await test('Permite horarios de tarde sin rechazar el cambio de día UTC', () => {
    assert.doesNotThrow(()=>mutations.validateSchedule('2026-10-05T19:00:00-06:00','2026-10-05T20:00:00-06:00'));
  });
  await test('Dominio no muestra fórmulas con el título completo ni textos de relleno', () => {
    assert.equal(presentation.calendarDomain('aads ads.anfeta.com Trabajo','Sin programas o proyectos relacionados'),'anfeta.com');
    assert.equal(presentation.calendarDomain('Trabajo sin dominio','No content'),'general');
    assert.equal(presentation.calendarDisplayTitle('Trabajo otraanfeta.com','anfeta.com'),'Trabajo otraanfeta.com');
  });
  await test('Meses antiguos y canales técnicos se limpian como en escritorio', () => {
    assert.equal(presentation.calendarDisplayTitle('cchat (2608AGOS) anfeta.com Descripción','anfeta.com'),'Descripción');
  });
  await test('La copia de revisión reaparece al refrescar y queda protegida', async () => {
    state.queryCurrent=true;
    await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION',leaveVisualCopy:true});
    const response=await route.GET(new Request('http://localhost/api/data?type=calendar&date=2026-10-05'));
    assert.equal(response.status,200); const data=await response.json();
    assert.equal(data.count,2);
    const mirror=data.activities.find(a=>a.isReviewMirror);
    assert.ok(mirror); assert.equal(mirror.person,'Neftali'); assert.equal(permissions.canEditActivity('jjohn',mirror),false);
    assert.equal(data.activities.find(a=>a.pageId===pid).person,'John');
  });
  await test('Se respeta la decisión de no dejar copia visual', async () => {
    state.queryCurrent=true;
    await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION',leaveVisualCopy:false});
    const response=await route.GET(new Request('http://localhost/api/data?type=calendar&date=2026-10-05'));
    assert.equal((await response.json()).activities.some(a=>a.isReviewMirror),false);
  });
  await test('Las copias visuales no duplican las métricas del día', () => {
    const {computeDailyKPIs}=require(root+'/src/services/progressKpis.ts');
    const {normalizeActivity}=require(root+'/src/services/dataNormalizers.ts');
    const original=normalizeActivity({pageId:pid,title:'Revisar',person:'Neftali',status:'rtuzREVISION',start:'2026-10-05T10:00:00-06:00',end:'2026-10-05T11:00:00-06:00'},0);
    const result=computeDailyKPIs([original,{...original,pageId:'review-mirror-' + pid,isReviewMirror:true}],'2026-10-05');
    assert.equal(result.totalActivities,1); assert.equal(result.reviewCount,1); assert.equal(result.scheduledMinutes,60);
  });
  await test('Al cambiar revisor se reemplaza al responsable real, no a otro mencionado', async () => {
    state.page.properties.Name.title=[{text:{content:'prtuzREVISION aads jjohn Comentario nneft Descripción'}}];
    const page=await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'Genaro',status:'rtuzREVISION'});
    assert.match(page.properties.Name.title[0].text.content,/^rtuzREVISION aads jjohn Comentario Descripción neft ggena$/);
  });
  await test('Asignación vacía no se sustituye por creador o etiquetas del título', () => {
    const page=fixture(); page.properties['Assignee/Ejecutor Principal'].people=[];
    assert.equal(calendar.assignedPerson(page,'nneft'),'Sin asignar');
  });
  await test('Una revisión de actividad sin asignar puede terminar y restaurar People vacío', async () => {
    state.page.properties['Assignee/Ejecutor Principal'].people=[];
    await mutations.mutateActivity(settings,'jjohn',pid,{reviewer:'John',status:'rtuzREVISION'});
    const page=await mutations.mutateActivity(settings,'jjohn',pid,{status:'zREVISION'});
    assert.deepEqual(page.properties['Assignee/Ejecutor Principal'].people,[]);
    assert.match(page.properties.Name.title[0].text.content,/^zREVISION/);
  });
  await test('Al enviar revisión crea un aviso dirigido al revisor y vincula el hilo', async () => {
    const page=await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'Genaro',status:'rtuzREVISION'});
    assert.equal(page.__notificationWarning,undefined);assert.equal(page.__reviewFlow.AlertPageId,other);
    const alert=state.calls.find(c=>c.target==='pages' && c.method==='POST');
    assert.match(alert.body.properties.Name.title[0].text.content,/ggena de:neftali \[RESPUESTA\]/);
    assert.equal(alert.body.parent.data_source_id,'2eeabd7d-91b7-8193-a131-000b08cd54e2');
  });
  await test('Reenvío reutiliza hilo y la aprobación avisa al responsable original',async()=>{
    await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'});
    await mutations.mutateActivity(settings,'jjohn',pid,{reviewer:'Genaro',status:'rtuzREVISION'});
    const page=await mutations.mutateActivity(settings,'ggena',pid,{status:'zREVISION'});
    assert.equal(page.__notificationWarning,undefined);
    assert.equal(state.calls.filter(c=>c.target==='pages' && c.method==='POST').length,1);
    const titles=state.calls.filter(c=>c.target==='pages/'+other && c.method==='PATCH');
    assert.match(titles.at(-1).body.properties.Name.title[0].text.content,/nneft de:genaro.*Revisión aprobada/);
  });
  await test('Error de aviso es visible sin fingir que falló la actividad guardada',async()=>{
    state.failAlert=true;const page=await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'});
    assert.match(page.__notificationWarning,/Creation rejected/);assert.equal(page.__reviewFlow.State,'pending');
  });
  await test('Solo el revisor asignado aprueba o devuelve una revisión pendiente',async()=>{
    await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'});
    await assert.rejects(mutations.mutateActivity(settings,'ggena',pid,{status:'zREVISION'}),/revisor asignado/);
    await assert.rejects(mutations.mutateActivity(settings,'ggena',pid,{reviewAction:'return',note:'Corregir'}),/revisor asignado/);
  });
  await test('Devolver revisión restaura People, prefijo pendiente y comentarios',async()=>{
    await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'});
    const page=await mutations.mutateActivity(settings,'jjohn',pid,{reviewAction:'return',note:'Corregir encabezado'});
    assert.equal(page.__reviewFlow.State,'returned');assert.equal(page.__reviewFlow.Note,'Corregir encabezado');
    assert.equal(page.properties['Assignee/Ejecutor Principal'].people[0].id,'neft-id');assert.match(page.properties.Name.title[0].text.content,/^prtuzREVISION/);
    assert.match(state.calls.filter(c=>c.target==='pages/'+other&&c.method==='PATCH').at(-1).body.properties.Name.title[0].text.content,/nneft de:john.*Correcciones solicitadas/);
  });
  await test('Devolver sin comentarios no modifica Notion',async()=>{
    await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'});
    const before=state.calls.filter(c=>c.method==='PATCH').length;
    await assert.rejects(mutations.mutateActivity(settings,'jjohn',pid,{reviewAction:'return',note:''}),/Describe/);
    assert.equal(state.calls.filter(c=>c.method==='PATCH').length,before);
  });
  await test('El progreso del día no usa el total acumulado ni inventa checks',async()=>{
    const normalizer=require(root+'/src/services/dataNormalizers.ts');
    assert.equal(normalizer.normalizeActivity({ChecklistCompleted:9},0).todayChecklistCompleted,0);
    assert.deepEqual(normalizer.normalizeActivity({ChecklistCompleted:9},0).completedChecks,[]);
  });
  await test('Creación rápida usa la fuente de calendario y resuelve el People invitado',async()=>{
    const result=await mutations.createActivity(settings,'nneft',{title:'anfeta.com Diseño',domain:'anfeta.com',person:'Neftali',start:'2026-10-05T09:00:00-06:00',end:'2026-10-05T10:00:00-06:00'});
    const call=state.calls.find(c=>c.target==='pages'&&c.method==='POST');
    assert.equal(call.body.parent.data_source_id,'2eeabd7d-91b7-8193-a131-000b08cd54e2');assert.equal(call.body.properties['Assignee/Ejecutor Principal'].people[0].id,'neft-id');
    assert.equal((result.activity.title.match(/anfeta.com/g)||[]).length,1);
  });
  await test('Plantillas fallidas no crean actividades ficticias ni confirman éxito',async()=>{
    state.failCreate=true;
    const res=await route.POST(request('create-from-template',{currentUser:'nneft',date:'2026-10-05',requests:[{sourcePageId:pid,title:'prtuzREVISION nneft anfeta.com Diseño',person:'Neftali',start:'2026-10-05T09:00:00-06:00',end:'2026-10-05T10:00:00-06:00'}]}));
    const data=await res.json();assert.equal(data.success,false);assert.equal(data.createdActivities.length,0);assert.equal(data.results[0].success,false);
  });
  await test('Plantilla guarda People seleccionado con propiedades válidas de Notion',async()=>{
    const res=await route.POST(request('create-from-template',{currentUser:'jjohn',date:'2026-10-05',requests:[{sourcePageId:pid,title:'prtuzREVISION jjohn anfeta.com Diseño',person:'John',start:'2026-10-05T09:00:00-06:00',end:'2026-10-05T10:00:00-06:00'}]}));
    const data=await res.json();assert.equal(data.success,true,data.error);assert.equal(data.createdActivities[0].person,'John');
    assert.equal(state.calls.find(c=>c.target==='pages'&&c.method==='POST').body.properties['Assignee/Ejecutor Principal'].people[0].id,'john-id');
  });
  await test('Planificador respeta horarios fijos y no excede la jornada',async()=>{
    const planner=require(root+'/src/services/calendarPlanner.ts');
    const activities=[{pageId:pid,person:'Neftali',title:'prtuzREVISION Pendiente',status:'POR HACER',start:'2026-10-05T08:00:00-06:00',end:'2026-10-05T09:00:00-06:00'},{pageId:other,person:'Neftali',title:'rtuzREVISION Revisión',status:'EN REVISIÓN',start:'2026-10-05T08:00:00-06:00',end:'2026-10-05T09:00:00-06:00'}];
    const changes=planner.planOneClick(activities,'2026-10-05','Neftali');assert.equal(changes.length,1);assert.match(changes[0].start,/T09:00/);
    assert.throws(()=>planner.planOneClick(activities,'2026-10-05','Neftali',1305),/jornada/);
  });
  await test('Robot consulta 14 días, propone movimientos reales y no escribe durante la vista previa',async()=>{
    const robot=require(root+'/src/services/calendarAutomation.ts');const report=await robot.planDailyAutomation(settings,'nneft','2026-10-06',new Date('2026-10-06T12:00:00Z'));
    assert.equal(report.movements.length,2);assert.equal(report.moved,0);assert.equal(state.calls.filter(c=>c.method==='PATCH').length,0);
    assert.equal(state.calls.find(c=>c.target.endsWith('/query')).body.filter.and[0].date.on_or_after,'2026-09-22T00:00:00-06:00');assert.match(report.movements[0].start,/^2026-10-06T08:00/);
  });
  await test('Robot excluye revisiones y rechaza corrida antes de las 05:00',async()=>{
    const robot=require(root+'/src/services/calendarAutomation.ts');state.queryCurrent=true;state.page.properties.Estado.status.name='En revisión';
    const report=await robot.planDailyAutomation(settings,'jjohn','2026-10-06',new Date('2026-10-06T12:00:00Z'));assert.equal(report.skippedReview,1);assert.equal(report.movements.length,1);
    await assert.rejects(robot.planDailyAutomation(settings,'jjohn','2026-10-06',new Date('2026-10-06T10:00:00Z')),/05:00/);
  });
  await test('Hilo de revisión no permite responder desde una cuenta ajena',async()=>{
    const notifications=require(root+'/src/services/reviewNotifications.ts');await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'});
    await assert.rejects(notifications.replyNotification(settings,'ggena',other,'Respuesta'),/tu cuenta/);
    const entry=await notifications.replyNotification(settings,'jjohn',other,'Revisaré el encabezado');assert.equal(entry.Kind,'Message');assert.equal(entry.AuthorName,'John');
  });
  await test('Sesión de trabajo guarda metadatos reales y rechaza duración inválida',async()=>{
    let res=await route.POST(request('calendar-work-session',{pageId:pid,currentUser:'nneft',session:{id:'session-test',startedAt:'2026-10-05T15:00:00Z',endedAt:'2026-10-05T15:10:00Z',seconds:600}}));assert.equal(res.status,200);assert.equal((await res.json()).success,true);
    res=await route.POST(request('calendar-work-session',{pageId:pid,currentUser:'nneft',session:{id:'invalid',seconds:-1}}));assert.equal(res.status,400);
  });
  await test('Un bloque sin acceso no oculta las actividades ni inventa checklist',async()=>{
    state.blockFailure=true;
    const res=await route.GET(new Request('http://localhost/api/data?type=calendar&date=2026-10-05'));
    assert.equal(res.status,200);const data=await res.json();assert.equal(data.count,2);assert.match(data.warning,/checklists/);
    const activity=data.activities.find(a=>a.pageId.replace(/-/g,'')===pid.replace(/-/g,''));assert.equal(activity.checklistScanned,false);assert.equal(activity.todayChecklistCompleted,0);
  });
  await test('Agenda ligera no solicita bloques antes de mostrar actividades',async()=>{
    state.blockFailure=true;const res=await route.GET(new Request('http://localhost/api/data?type=calendar&basic=1&date=2026-10-05'));
    const data=await res.json();assert.equal(res.status,200);assert.equal(data.count,2);assert.equal(state.calls.filter(c=>c.target.startsWith('blocks/')).length,0);
  });
  await test('Cobros/Pagos provienen de su fuente y fecha sin filtrar personas',async()=>{
    const {financeRowsForDay}=require(root+'/src/services/calendarFinance.ts');
    const rows=[{id:'c',source:'Notion',sourceName:'Cobrar y Pagar',name:'prtuzcobrar dominio.com',scheduledDate:'2026-10-06'},{id:'p',source:'Notion',sourceName:'Cobrar y Pagar',name:'zpagar Proveedor',scheduledDate:'2026-10-06T10:00:00-06:00'},{id:'wrong-source',source:'Notion',sourceName:'Revisiones',name:'cobrar',scheduledDate:'2026-10-06'},{id:'tomorrow',source:'Notion',sourceName:'Cobrar y Pagar',name:'cobrar',scheduledDate:'2026-10-07'}];
    const items=financeRowsForDay(rows,'2026-10-06');assert.deepEqual(items.map(i=>i.kind),['cobro','pago']);assert.equal(items[0].start,'2026-10-06T14:00:00.000Z');assert.equal(items[0].end,'2026-10-06T15:00:00.000Z');
  });
  await test('Respuesta no JSON produce error comprensible',async()=>{
    const {readApiJson}=require(root+'/src/lib/readApiJson.ts');await assert.rejects(readApiJson(new Response('An error occurred',{status:504})),/HTTP 504/);
  });
  await test('Checklist excluye sincronizados, plantillas, Código y metadata sin leer sus hijos',async()=>{
    const todo=(id,text,annotations={})=>({id,type:'to_do',to_do:{checked:true,rich_text:[{plain_text:text,annotations}]}});
    state.customBlocks=[todo('normal','Trabajo real'),todo('tachado','Tachado',{strikethrough:true}),todo('codigo','Código',{code:true}),{id:'synced',type:'synced_block',has_children:true,synced_block:{synced_from:{block_id:'inaccessible'}}},{id:'template',type:'template',has_children:true,template:{}},{id:'metadata',type:'toggle',has_children:true,toggle:{rich_text:[{plain_text:'DATOS INTERNOS DE ANFETA'}]}},{id:'code-toggle',type:'toggle',has_children:true,toggle:{rich_text:[{plain_text:'Notas',annotations:{code:true}}]}},{id:'child-page',type:'child_page',has_children:true}];
    const items=await calendar.readChecklist(settings,pid);assert.deepEqual(items.map(i=>i.id),['normal','tachado']);assert.equal(state.calls.filter(c=>c.target.startsWith('blocks/')).length,1);
  });
  await test('Código usa umbral 80 por ciento y no excluye un fragmento pequeño',async()=>{
    const block=(a,b)=>({type:'to_do',to_do:{rich_text:[{plain_text:a,annotations:{code:true}},{plain_text:b}]}});
    assert.equal(calendar.checklistCodeFormatted(block('12345678','90')),true);assert.equal(calendar.checklistCodeFormatted(block('1234567','890')),false);
  });
  await test('El prefijo de fuente no convierte un pago en cobro',async()=>{
    const {financeRowsForDay}=require(root+'/src/services/calendarFinance.ts');const items=financeRowsForDay([{id:'p',source:'Notion',sourceName:'Cobrar y pagar',name:'[Cobrar y pagar] zPAGAR Proveedor',scheduledDate:'2026-10-06'}],'2026-10-06');assert.equal(items[0].kind,'pago');
  });
  await test('Finanzas resuelve fuente real y pagina Notion en lugar de depender del índice',async()=>{
    state.page.parent={data_source_id:'finance-source'};state.page.properties.Name.title=[{text:{content:'zPAGAR Proveedor'}}];state.queryCurrent=true;
    const {loadLiveFinance}=require(root+'/src/services/notionFinance.ts');const items=await loadLiveFinance(settings,[{id:pid,externalId:pid,source:'Notion',sourceName:'Cobrar y pagar'}],'2026-10-05');assert.equal(items.length,1);assert.equal(items[0].kind,'pago');assert.equal(state.calls.filter(c=>c.target==='data_sources/finance-source/query').length,2);
  });
  await test('zREVISION conserva horario histórico incluso para dirección',async()=>{
    state.page.properties.Name.title=[{text:{content:'zREVISION anfeta.com nneft Entregada'}}];
    await assert.rejects(()=>mutations.mutateActivity(settings,'jjohn',pid,{start:'2026-10-07T10:00:00-06:00',end:'2026-10-07T11:00:00-06:00'}),/histórica/);
    assert.equal(state.calls.some(c=>c.method==='PATCH'),false);
  });
  await test('KPIs separan día y acumulado y excluyen FTF suspendidas y fuera de ventana',async()=>{
    const k=require(root+'/src/services/progressKpis.ts');const base={title:'Trabajo',person:'Neftali',status:'Por hacer',start:'2026-10-06T10:00:00-06:00',end:'2026-10-06T11:00:00-06:00',checklistScanned:true,checklistTotal:10,checklistCompleted:8,todayChecklistCompleted:2};
    const result=k.computeDailyKPIs([base,{...base,title:'FFTF Calendario'},{...base,status:'Suspendida'},{...base,start:'2026-10-06T08:00:00-06:00',end:'2026-10-06T09:00:00-06:00'}],'2026-10-06');
    assert.equal(result.totalActivities,1);assert.equal(result.coveragePercentage,20);assert.equal(result.currentProgressPercentage,80);assert.equal(k.isFtfActivity('miFFTFproyecto'),false);
    assert.equal(k.currentActivityRatio({...base,checklistScanned:false,estimatedWorkMinutes:60,workedMinutes:30}),0.5);
  });
  console.log(passed + ' regression tests passed; all Notion requests mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});

