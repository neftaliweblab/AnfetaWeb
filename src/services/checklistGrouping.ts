import {createHash} from 'node:crypto';
import {notionRequest} from './notionMutations';
import {assertChecklistAccess,readBlocks,invalidateChecklist,checklistCodeFormatted} from './notionCalendar';
import {getChecklistItemPlans,remapLocalChecklistPlans} from './checklistPlanning';
import {parseChecklistBlockDate,applyChecklistDateToRuns} from '@/lib/checklistBlockDates';
import {supabaseAdmin,supabaseConfigured} from './supabaseServer';
import {notionSourceKey} from './notionSnapshotCache';
import {withActivityLease,operationKey} from './reliableOperations';
import {writableNotionRichText,transferNotionInternalFile} from './notionTemplateBody';

const clean=(s:string)=>String(s||'').replace(/-/g,'').toLowerCase();
const hash=(v:any)=>createHash('sha256').update(JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value)).digest('hex');
const text=(b:any)=>(b[b.type]?.rich_text||[]).map((r:any)=>r.plain_text||r.text?.content||'').join('');
const title=(day:string)=>'📅 '+day;
const protectedBlock=(b:any)=>b.archived||b.in_trash||['synced_block','template','child_page','child_database'].includes(b.type)||/\[ANFETA_|Datos internos de ANFETA/i.test(text(b));
type Tree={block:any;children:Tree[]};
type Move={oldId:string;parentId:string;date:string|null;label:string;version:string;tree:Tree;record?:any};
const fields:Record<string,string[]>={to_do:['rich_text','checked','color'],paragraph:['rich_text','color'],heading_1:['rich_text','color','is_toggleable'],heading_2:['rich_text','color','is_toggleable'],heading_3:['rich_text','color','is_toggleable'],bulleted_list_item:['rich_text','color'],numbered_list_item:['rich_text','color'],quote:['rich_text','color'],callout:['rich_text','color','icon'],code:['rich_text','caption','language'],toggle:['rich_text','color'],divider:[],equation:['expression'],bookmark:['url','caption'],embed:['url','caption']};
const media=['image','file','video','audio','pdf'];
function compatible(tree:Tree,depth=0):string|undefined{
 const b=tree.block;
 if(protectedBlock(b)||(!fields[b.type]&&!media.includes(b.type)))return 'Bloque no compatible o protegido: '+b.type;
 if(b.type==='callout'&&b.callout?.icon?.type==='file')return 'Contiene un icono interno que no se puede trasladar sin alterar el bloque.';
 if(depth>1)return 'Contiene más de un nivel de hijos; se conserva sin mover.';
 try{if(b[b.type]?.rich_text)writableNotionRichText(b[b.type].rich_text);}catch{return 'Tiene menciones no compatibles.';}
 if(tree.children.length>90)return 'Tiene demasiados bloques hijos para una copia verificable.';
 for(const child of tree.children){const error=compatible(child,depth+1);if(error)return error;}
 return undefined;
}
async function result(query:any){const r=await query;if(r.error)throw Error('No se pudo confirmar el registro de agrupación. Aplica la migración 202611180001 y revisa Supabase.');return r.data;}
function repo(source:string,page:string){const db=supabaseAdmin();return {
 groups:()=>result(db.from('checklist_date_groups').select('*').eq('source_key',source).eq('page_id',page)),
 addMove:(m:Move,target:string,body:any,actor:string)=>result(db.from('checklist_group_moves').insert({source_key:source,page_id:page,old_block_id:m.oldId,target_id:target,planned_date:m.date,actor,source_version:m.version,backup:{tree:m.tree,body},state:'prepared'}).select().single()),
 update:(id:string,data:any)=>result(db.from('checklist_group_moves').update({...data,updated_at:new Date().toISOString()}).eq('id',id).select().single()),
 migrate:(id:string)=>result(db.rpc('migrate_grouped_checklist',{p_move:id})),
 finish:(id:string)=>result(db.rpc('finish_checklist_group_move',{p_move:id})),
 pending:()=>result(db.from('checklist_group_moves').select('*').eq('source_key',source).eq('page_id',page).neq('state','done')),
 addGroup:(day:string,data:any)=>result(db.from('checklist_date_groups').upsert({source_key:source,page_id:page,planned_date:day,...data},{onConflict:'source_key,page_id,planned_date'}).select().single()),
 };}
function versionTree(tree:Tree):string{
 const walk=(t:Tree):any=>{const b=t.block,body=structuredClone(b[b.type]||{});if(body.file?.url){try{body.file.url=new URL(body.file.url).origin+new URL(body.file.url).pathname;delete body.file.expiry_time;}catch{}}
 return {id:clean(b.id),type:b.type,parent:b.parent,edited:b.last_edited_time,archived:!!b.archived,trash:!!b.in_trash,body,children:t.children.map(walk)};};return hash(walk(tree));
}
async function build(settings:any,actor:string,pageId:string){
 if(!/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(pageId||''))throw Error('Página inválida.');
 await assertChecklistAccess(settings,actor,pageId);
 if(!supabaseConfigured())throw Error('Configura Supabase para conservar el historial antes de trasladar checks.');
 const page=clean(pageId),source=notionSourceKey(settings),store=repo(source,page);
 const [savedGroups,records,plans]=await Promise.all([store.groups(),store.pending(),getChecklistItemPlans(settings,pageId)]);
 const groups:any[]=savedGroups||[],pending:any[]=records||[],moves:Move[]=[],blocked:Array<{blockId:string;label:string;reason:string}>=[],seen=new Set<string>();
 invalidateChecklist(settings,pageId);
 let total=0;
 async function treeOf(block:any,depth=0):Promise<Tree>{
  if(++total>500||depth>20)throw Error('La página supera el límite de esta agrupación. Divide el contenido antes de continuar.');
  const id=clean(block.id);if(seen.has(id))throw Error('La página contiene una rama repetida.');seen.add(id);
  const children:Tree[]=[];
  if(block.has_children&&!protectedBlock(block))for(const child of await readBlocks(settings,block.id))children.push(await treeOf(child,depth+1));
  return {block,children};
 }
 const roots:Tree[]=[];for(const b of await readBlocks(settings,pageId))roots.push(await treeOf(b));
 const named=new Map<string,Tree[]>();for(const root of roots){const m=text(root.block).match(/^📅 (\d{4}-\d{2}-\d{2})$/);if(root.block.type==='toggle'&&m)named.set(m[1],[...(named.get(m[1])||[]),root]);}
 for(const [date,items] of named){if(items.length>1)throw Error('Hay desplegables duplicados para '+date+'. Revísalos en Notion.');if(!groups.some(g=>g.planned_date===date))groups.push({planned_date:date,toggle_id:clean(items[0].block.id),state:'ready',unregistered:true});}
 const handled=new Set<string>();
 const undated:Array<{blockId:string;label:string}>=[];let alreadyGrouped=0;
 function collect(tree:Tree,parentId:string,insideCheck=false){
  const b=tree.block,id=clean(b.id);
  if(protectedBlock(b))return;
  const date=parseChecklistBlockDate(text(b)).plannedDate||plans[id]?.plannedDate||null;
  const oldGroup=groups.find(g=>g.state==='ready'&&clean(g.toggle_id)===clean(parentId));
  if(b.type==='to_do'&&!checklistCodeFormatted(b)){
   const record=pending.find(r=>r.old_block_id===id);if(record)handled.add(record.id);
   const target= date?groups.find(g=>g.planned_date===date&&g.state==='ready')?.toggle_id:page;
   const needsMove=!!record||((date||oldGroup)&&clean(target)!==clean(parentId));
   if(!date&&!oldGroup&&!insideCheck)undated.push({blockId:id,label:text(b).slice(0,180)});
   if(date&&oldGroup&&!needsMove)alreadyGrouped++;
   if(needsMove){
    const mixedDates=tree.children.some(c=>c.block.type==='to_do'&&(parseChecklistBlockDate(text(c.block)).plannedDate||plans[clean(c.block.id)]?.plannedDate)&& (parseChecklistBlockDate(text(c.block)).plannedDate||plans[clean(c.block.id)]?.plannedDate)!==date);
    const reason=insideCheck?'Es un check anidado dentro de otro check; se conserva su estructura.':mixedDates?'Sus checks hijos tienen otra fecha; se conserva la estructura.':compatible(tree);
    const uncertain=record?.state==='creating'?'La copia quedó sin confirmar. Revisa Notion; no se repetirá automáticamente.':undefined;
    if(reason||uncertain)blocked.push({blockId:id,label:text(b).slice(0,180),reason:reason||uncertain!});
    else moves.push({oldId:id,parentId:clean(parentId),date,label:parseChecklistBlockDate(text(b)).cleanText.slice(0,180),version:versionTree(tree),tree,record});
    // Descendant checks travel with this root; don't move them a second time.
    return;
   }
  }
  for(const child of tree.children)collect(child,id,insideCheck||b.type==='to_do');
 }
 for(const root of roots)collect(root,page);
 for(const record of pending.filter(r=>!handled.has(r.id))){
  if(record.state==='creating'){blocked.push({blockId:record.old_block_id,label:'Operación sin confirmar',reason:'Revisa la copia en Notion antes de repetir.'});continue;}
  if(['copied','verified','migrated'].includes(record.state)&&record.backup?.tree)moves.push({oldId:record.old_block_id,parentId:page,date:record.planned_date,label:text(record.backup.tree.block).slice(0,180),version:record.source_version,tree:record.backup.tree,record});
 }
 const fingerprint=hash({moves:moves.map(m=>[m.oldId,m.parentId,m.date,m.version,m.record?.state||null]),blocked});
 return {page,source,store,groups,roots,moves,blocked,fingerprint,undated,alreadyGrouped};
}
function publicPlan(p:Awaited<ReturnType<typeof build>>){return {fingerprint:p.fingerprint,undated:p.undated,alreadyGrouped:p.alreadyGrouped,moves:p.moves.map(m=>({blockId:m.oldId,label:m.label,date:m.date,resuming:!!m.record})),blocked:p.blocked,warning:'Cambiarán los IDs de los checks trasladados. Los comentarios y enlaces a bloques antiguos no se copian; los originales se archivan después de verificar copia e historial.'};}
export async function previewChecklistGrouping(settings:any,actor:string,pageId:string){return publicPlan(await build(settings,actor,pageId));}
async function targetGroup(settings:any,p:Awaited<ReturnType<typeof build>>,date:string|null){
 if(!date)return p.page;
 const group=p.groups.find((g:any)=>g.planned_date===date);
 if(group?.state==='ready'){
  const live=await notionRequest(settings,'blocks/'+group.toggle_id);
  if(live.archived||live.in_trash||live.type!=='toggle'||clean(live.parent?.page_id)!==p.page)throw Error('El desplegable cambió. Revisa su ubicación antes de agrupar.');
  if(group.unregistered)await p.store.addGroup(date,{state:'ready',toggle_id:clean(live.id)});
  return clean(live.id);
 }
 const existing=p.roots.filter(n=>n.block.type==='toggle'&&text(n.block)===title(date));
 if(existing.length>1)throw Error('Hay dos desplegables para '+date+'. Resuelve el duplicado en Notion.');
 let id=existing[0]?.block.id;
 if(!id){
  if(group?.state==='creating')throw Error('No se confirmó la creación del desplegable '+date+'. Revisa Notion antes de repetir.');
  await p.store.addGroup(date,{state:'creating',toggle_id:null});
  const r=await notionRequest(settings,'blocks/'+p.page+'/children','PATCH',{children:[{object:'block',type:'toggle',toggle:{rich_text:[{type:'text',text:{content:title(date)}}]}}]});
  id=r.results?.[0]?.id;if(!id)throw Error('Notion no confirmó el desplegable.');
 }
 const row=await p.store.addGroup(date,{state:'ready',toggle_id:clean(id)});p.groups.splice(0,p.groups.length,...p.groups.filter(g=>g.planned_date!==date),row);return clean(id);
}
async function copyBody(settings:any,tree:Tree,date?:string|null){
 const b=tree.block,body:any={};
 if(media.includes(b.type)){
  const file=b[b.type];body.caption=writableNotionRichText(file.caption||[]);
  if(file.type==='external'&&file.external?.url){body.type='external';body.external={url:file.external.url};}
  else if(file.file?.url){body.type='file_upload';body.file_upload={id:await transferNotionInternalFile(settings,file.file.url,b.type,file.name)};}
  else throw Error('El archivo no tiene una copia compatible.');
  if(b.type==='file'&&file.name)body.name=file.name;
 }else for(const key of fields[b.type])if(b[b.type]?.[key]!==undefined)body[key]=['rich_text','caption'].includes(key)?writableNotionRichText(b[b.type][key]):structuredClone(b[b.type][key]);
 if(b.type==='to_do'&&date!==undefined)body.rich_text=applyChecklistDateToRuns(body.rich_text||[],date);
 if(tree.children.length)body.children=await Promise.all(tree.children.map(c=>copyBody(settings,c)));
 return {object:'block',type:b.type,[b.type]:body};
}
function richKey(runs:any[]){return (runs||[]).map(r=>[r.type||'text',r.text?{content:r.text.content,link:r.text.link?.url||null}:r.mention||r.equation,{bold:!!r.annotations?.bold,italic:!!r.annotations?.italic,strikethrough:!!r.annotations?.strikethrough,underline:!!r.annotations?.underline,code:!!r.annotations?.code,color:r.annotations?.color||'default'}]);}
function verify(body:any,actual:any){
 if(actual.archived||actual.in_trash||actual.type!==body.type)throw Error('La copia no conserva el tipo de bloque.');
 const e=body[body.type],a=actual[actual.type];
 for(const key of Object.keys(e)){if(key==='children')continue;
  if(['rich_text','caption'].includes(key)){if(hash(richKey(e[key]))!==hash(richKey(a[key])))throw Error('La copia no conserva el texto completo.');}
  else if(key==='file_upload'){if(a.type!=='file'||!a.file?.url)throw Error('No se confirmó el archivo copiado.');}
  else if(key==='type'&&e.type==='file_upload')continue;
  else if(hash(e[key])!==hash(a[key]))throw Error('La copia cambió '+key+'.');
 }
}
async function verifyCopy(settings:any,record:any){
 const tree:Tree=record.backup.tree,body=record.backup.body,root=await notionRequest(settings,'blocks/'+record.new_ids[0].newId);
 verify(body,root);const children=root.has_children?await readBlocks(settings,root.id):[];
 if(children.length!==tree.children.length)throw Error('No se copiaron todos los bloques hijos. El original sigue intacto.');
 const mappings=[{oldId:clean(tree.block.id),newId:clean(root.id),kind:root.type,checked:!!root.to_do?.checked,plannedDate:record.planned_date}];
 for(let i=0;i<children.length;i++){verify(body[body.type].children[i],children[i]);mappings.push({oldId:clean(tree.children[i].block.id),newId:clean(children[i].id),kind:children[i].type,checked:!!children[i].to_do?.checked,plannedDate:parseChecklistBlockDate(text(children[i])).plannedDate||null});}
 return mappings;
}
export async function applyChecklistGrouping(settings:any,actor:string,pageId:string,fingerprint:string){
 return withActivityLease(operationKey(settings.notionToken,clean(pageId)),async()=>{
  const p=await build(settings,actor,pageId);
  if(!fingerprint||fingerprint!==p.fingerprint)throw Error('La actividad cambió. Vuelve a generar la vista previa antes de agrupar.');
  const moved:string[]=[],errors:string[]=[];
  for(const m of p.moves.slice(0,5))try{
   let record=m.record;
   if(!record){const target=await targetGroup(settings,p,m.date);const body=await copyBody(settings,m.tree,m.date);record=await p.store.addMove(m,target,body,actor);}
   if(record.state==='prepared'){
    if(record.source_version!==m.version)record=await p.store.update(record.id,{source_version:m.version,backup:{tree:m.tree,body:await copyBody(settings,m.tree,m.date)}});
    const current=await notionRequest(settings,'blocks/'+m.oldId);
    if(current.archived||current.in_trash||versionTree({...m.tree,block:current})!==record.source_version)throw Error('El check cambió; el original no se modificó.');
    record=await p.store.update(record.id,{state:'creating'});
    const response=await notionRequest(settings,'blocks/'+record.target_id+'/children','PATCH',{children:[record.backup.body]});
    const id=response.results?.[0]?.id;if(!id)throw Error('Notion no confirmó la copia; no se repetirá automáticamente.');
    record=await p.store.update(record.id,{state:'copied',new_ids:[{oldId:m.oldId,newId:clean(id),kind:'to_do'}]});
   }
   if(record.state==='copied')record=await p.store.update(record.id,{state:'verified',new_ids:await verifyCopy(settings,record)});
   if(record.state==='verified'){
    const original=await notionRequest(settings,'blocks/'+m.oldId);invalidateChecklist(settings,p.page);
    const children=original.has_children?await readBlocks(settings,original.id):[];
    if(original.archived||original.in_trash||versionTree({block:original,children:children.map(block=>({block,children:[]}))})!==record.source_version)throw Error('El original cambió. No se migró su historial ni se archivó.');
    await verifyCopy(settings,record);if(!await p.store.migrate(record.id))throw Error('No se confirmó la migración del historial.');record=await p.store.update(record.id,{state:'migrated'});
   }
   if(record.state==='migrated'){
    const original=await notionRequest(settings,'blocks/'+m.oldId);
    if(!original.archived&&!original.in_trash){
     invalidateChecklist(settings,p.page);const children=original.has_children?await readBlocks(settings,original.id):[];
     if(versionTree({block:original,children:children.map(block=>({block,children:[]}))})!==record.source_version)throw Error('El original cambió durante la copia. No se archivó.');
     await verifyCopy(settings,record);
     const removed=await notionRequest(settings,'blocks/'+m.oldId,'DELETE');
     if(!removed.archived&&!removed.in_trash)throw Error('No se confirmó el archivo del original.');
    }
    await p.store.finish(record.id);remapLocalChecklistPlans(settings,p.page,record.new_ids);moved.push(m.oldId);
   }
  }catch(error){errors.push(error instanceof Error?error.message:'No se confirmó la agrupación.');break;}
  invalidateChecklist(settings,p.page);
  return {moved:moved.length,errors,preview:publicPlan(await build(settings,actor,pageId))};
 });
}
