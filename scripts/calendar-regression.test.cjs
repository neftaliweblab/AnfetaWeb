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
  if(name==='fs' && parent?.filename.replace(/\\/g,'/').endsWith('/src/app/api/data/route.ts')) return {...fs,
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
  const target=String(url).split('/v1/')[1],method=options.method || 'GET',body=options.body?JSON.parse(options.body):undefined;
  state.calls.push({target,method,body});
  if(target==='pages/'+pid && method==='GET')return response(state.page);
  if(target.startsWith('data_sources/') && method==='GET' && state.realSchema) return response({properties:{'Fecha POR Hacer':{type:'date'},'(bien) Estado opcion multiple revisiones':{type:'status',status:{options:[{name:'PRTUZ POR HACER'},{name:'REVISAR REVISIONES rrevi'},{name:'TERMINADO REV COBRO/DOCUMENTACION'}]}}}});
  if(target.startsWith('data_sources/') && method==='GET') return response({properties:{'Fecha POR Hacer':{type:'date'},Estado:{type:'status',status:{options:[{name:'Por hacer'},{name:'En revisión'},{name:'Terminada'}]}}}});
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
    state.flow=JSON.parse(Buffer.from(text.slice(calendar.REVIEW_PREFIX.length),'base64').toString());
    return response({results:body.children});
  }
  if(target.startsWith('blocks/'+pid+'/children')){
    if(state.blockFailure)return response({message:'Cannot read blocks'},403);
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
async function test(name,fn){reset();await fn();passed++;lines.push('OK '+name);console.log('OK '+name);}
const request=(action,payload)=>new Request('http://localhost/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
(async()=>{
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
  await test('Terminar revisión conserva zREVISION y devuelve al responsable original',async()=>{await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'John',status:'rtuzREVISION'});const page=await mutations.mutateActivity(settings,'jjohn',pid,{status:'zREVISION'});assert.equal(page.properties['Assignee/Ejecutor Principal'].people[0].id,'neft-id');assert.match(page.properties.Name.title[0].text.content,/^zREVISION.*nneft/);assert.equal(state.flow.State,'approved');});
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
    const original=normalizeActivity({pageId:pid,title:'Revisar',status:'rtuzREVISION',start:'2026-10-05T08:00:00-06:00',end:'2026-10-05T09:00:00-06:00'},0);
    const result=computeDailyKPIs([original,{...original,pageId:'review-mirror-' + pid,isReviewMirror:true}],'2026-10-05');
    assert.equal(result.totalActivities,1); assert.equal(result.reviewCount,1); assert.equal(result.scheduledMinutes,60);
  });
  await test('Al cambiar revisor se reemplaza al responsable real, no a otro mencionado', async () => {
    state.page.properties.Name.title=[{text:{content:'prtuzREVISION aads jjohn Comentario nneft Descripción'}}];
    const page=await mutations.mutateActivity(settings,'nneft',pid,{reviewer:'Genaro',status:'rtuzREVISION'});
    assert.match(page.properties.Name.title[0].text.content,/jjohn Comentario ggena Descripción/);
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
  console.log(passed + ' regression tests passed; all Notion requests mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});

