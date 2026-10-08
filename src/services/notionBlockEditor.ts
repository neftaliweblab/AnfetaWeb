import {createHash} from 'node:crypto';
import {notionRequest} from './notionMutations';
import {assertChecklistAccess,invalidateChecklist} from './notionCalendar';
import {blockTextRuns,blockTextUpdate,textRunValue,newTextBlock} from '@/lib/notionBlockText';

const clean=(id:string)=>id.replace(/-/g,'').toLowerCase();
const valid=(id:unknown):id is string=>typeof id==='string'&&/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(id);
function version(block:any){return createHash('sha256').update(JSON.stringify([block.id,block.type,block.last_edited_time,block[block.type]])).digest('hex');}
function protectedBlock(block:any){const text=(block[block.type]?.rich_text||[]).map(textRunValue).join('');return block.archived||block.in_trash||block.type==='synced_block'||/\[anfeta_|datos internos de anfeta/i.test(text);}
async function authorizedBlock(settings:any,actor:string,pageId:string,blockId:string){
 if(!valid(pageId)||!valid(blockId))throw new Error('Página o bloque de Notion inválido.');
 await assertChecklistAccess(settings,actor,pageId);
 const block=await notionRequest(settings,'blocks/'+blockId);
 let cursor=block;const seen=new Set<string>();
 for(let depth=0;depth<64;depth++){
  if(!cursor?.id||seen.has(clean(cursor.id)))throw new Error('No se pudo comprobar la ubicación del bloque.');
  seen.add(clean(cursor.id));
  if(protectedBlock(cursor))throw new Error('Los bloques sincronizados, archivados y datos internos de ANFETA están protegidos.');
  if(cursor.parent?.type==='page_id'){
   if(clean(cursor.parent.page_id)!==clean(pageId))throw new Error('El bloque no pertenece a esta actividad.');
   blockTextRuns(block);return block;
  }
  if(cursor.parent?.type!=='block_id'||!valid(cursor.parent.block_id))throw new Error('El bloque no pertenece a esta actividad.');
  cursor=await notionRequest(settings,'blocks/'+cursor.parent.block_id);
 }
 throw new Error('La rama del bloque es demasiado profunda.');
}
export async function readEditableBlock(settings:any,actor:string,pageId:string,blockId:string){
 const block=await authorizedBlock(settings,actor,pageId,blockId);
 return {id:block.id,type:block.type,version:version(block),runs:blockTextRuns(block).map((run:any)=>({text:textRunValue(run),editable:run.type==='text',annotations:run.annotations||{},linked:!!run.text?.link}))};
}
const writes=new Set<string>();
export async function appendEditableBlock(settings:any,actor:string,input:any){
 if(!valid(input.pageId))throw new Error('Página de Notion inválida.');
 const body=newTextBlock(input),key=settings.notionToken+':append:'+input.pageId;
 if(writes.has(key))throw new Error('Se está agregando otro bloque a esta página. Espera antes de continuar.');
 writes.add(key);
 try{
  await assertChecklistAccess(settings,actor,input.pageId);
  let response:any;
  try{response=await notionRequest(settings,'blocks/'+input.pageId+'/children','PATCH',{children:[body]});}
  catch(error){invalidateChecklist(settings,input.pageId);throw new Error('No se confirmó la creación. Revisa la página en Notion antes de volver a agregar el bloque. '+(error instanceof Error?error.message:''));}
  const saved=response.results?.[0];
  invalidateChecklist(settings,input.pageId);
  if(!saved?.id||saved.type!==input.type||(saved[saved.type]?.rich_text||[]).map(textRunValue).join('')!==input.text)throw new Error('Notion no confirmó el bloque completo. Revisa la página antes de volver a agregarlo.');
  return {id:saved.id,kind:saved.type,text:input.text,isChecked:!!saved[saved.type]?.checked,language:saved[saved.type]?.language,lastEditedTime:saved.last_edited_time};
 }finally{writes.delete(key);}
}
export async function saveEditableBlock(settings:any,actor:string,input:any){
 const key=settings.notionToken+':'+input.blockId;
 if(writes.has(key))throw new Error('El bloque se está guardando. Espera antes de reenviar.');
 writes.add(key);
 try{
  const block=await authorizedBlock(settings,actor,input.pageId,input.blockId);
  if(typeof input.version!=='string'||input.version!==version(block))throw new Error('El bloque cambió en otro dispositivo. Cierra y vuelve a abrir el editor; tu texto no se guardó.');
  const body=blockTextUpdate(block,input.texts);
  const saved=await notionRequest(settings,'blocks/'+block.id,'PATCH',body);
  if((saved[saved.type]?.rich_text||[]).map(textRunValue).join('')!==input.texts.join(''))throw new Error('Notion no confirmó el texto. Revisa el bloque antes de reenviar.');
  invalidateChecklist(settings,input.pageId);
  return {id:saved.id,text:(saved[saved.type]?.rich_text||[]).map(textRunValue).join(''),lastEditedTime:saved.last_edited_time};
 }finally{writes.delete(key);}
}
