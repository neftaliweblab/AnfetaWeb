import {readBlocks,clearReadBlocksCache,assertChecklistAccess} from './notionCalendar';
import {notionRequest} from './notionMutations';
import {isDirection} from './activityPermissions';
import {withActivityLease,operationKey} from './reliableOperations';
const text=(block:any)=>(block.paragraph?.rich_text||[]).map((t:any)=>t.plain_text||t.text?.content||'').join('');
export async function consolidateInternalMetadata(settings:any,actor:string,pageId:string){
 if(!isDirection(actor))throw Error('Solo Dirección puede organizar los datos internos.');
 await assertChecklistAccess(settings,actor,pageId);
 return withActivityLease(operationKey(settings.notionToken,pageId.replace(/-/g,'')),async()=>{
  clearReadBlocksCache(settings);
  const containers=(await readBlocks(settings,pageId)).filter(b=>b.type==='toggle'&&(b.toggle?.rich_text||[]).map((t:any)=>t.plain_text||t.text?.content||'').join('').trim()==='Datos internos de ANFETA');
  if(containers.length<2)return {archived:0,preserved:containers.length,skipped:0};
  const target=containers[0],known=new Set((await readBlocks(settings,target.id)).map(text));let archived=0,skipped=0;
  for(const source of containers.slice(1)){
   const original=await readBlocks(settings,source.id);
   if(!original.length||original.some(b=>b.type!=='paragraph'||b.has_children||!/^\[ANFETA_[A-Z0-9_]+\]/.test(text(b)))){skipped++;continue;}
   const missing=original.filter(b=>!known.has(text(b)));
   for(let offset=0;offset<missing.length;offset+=100){const batch=missing.slice(offset,offset+100);const response=await notionRequest(settings,'blocks/'+target.id+'/children','PATCH',{children:batch.map(b=>({object:'block',type:'paragraph',paragraph:{rich_text:(b.paragraph.rich_text||[]).map((t:any)=>({type:'text',text:{content:t.plain_text||t.text?.content||''}}))}}))});if(response.results?.length!==batch.length)throw Error('No se confirmó la copia interna; no se archivó su origen.');}
   clearReadBlocksCache(settings);const saved=new Set((await readBlocks(settings,target.id)).map(text));
   if(!original.every(b=>saved.has(text(b))))throw Error('No se confirmó todo el historial; sus contenedores se conservaron.');
   const fresh=await readBlocks(settings,source.id);
   if(JSON.stringify(fresh.map(b=>[b.id,b.type,b.has_children,text(b)]))!==JSON.stringify(original.map(b=>[b.id,b.type,b.has_children,text(b)]))){skipped++;continue;}
   await notionRequest(settings,'blocks/'+source.id,'DELETE');archived++;for(const value of saved)known.add(value);
  }
  return {archived,skipped,preserved:containers.length-archived};
 });
}
