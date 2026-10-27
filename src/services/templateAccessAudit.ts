import {templateBlockPolicy} from './templateBlockPolicy';
import {inspectTemplateBody} from './notionTemplateBody';
import {readBlocks} from './notionCalendar';
import {notionRequest} from './notionMutations';
import type {CalendarSettings} from './notionCalendar';
export async function auditTemplateAccess(settings:CalendarSettings,pageId:string){
 const issues:{blockId:string;originId?:string;message:string}[]=[],path=new Set<string>();
 const stats={blocks:0,checklists:0,columns:0,synced:0,localFallbacks:0,toggles:0,toggleHeadings:0,types:{} as Record<string,number>};
 const cache=new Map<string,Promise<any[]>>();
 const key=(id:string)=>id.replace(/-/g,'').toLowerCase();
 const children=(id:string)=>{settings.notionSignal?.throwIfAborted();const clean=key(id);let result=cache.get(clean);if(!result){result=readBlocks(settings,id);cache.set(clean,result);}return result;};
 let propertyCount=0;
 try{const page=await notionRequest(settings,'pages/'+pageId);if(page.archived||page.in_trash)throw Error('La plantilla está archivada o eliminada.');propertyCount=Object.keys(page.properties||{}).length;}
 catch(error){return {pageId,readable:false,propertyCount,stats,issues:[{blockId:pageId,message:'No se pudo leer la página plantilla: '+(error instanceof Error?error.message:'Sin acceso.')} ]};}
 const walk=async(id:string,depth:number,fallback?:string)=>{
  const clean=key(id);if(depth>30||path.has(clean)){issues.push({blockId:fallback||id,originId:id,message:'Referencia circular o más de 30 niveles de anidación.'});return;}
  if(stats.blocks>=5000)throw Error('La auditoría alcanzó 5000 bloques.');
  path.add(clean);
  try{
   let list:any[];
   try{list=await children(id);}catch(error){
    if(fallback&&key(fallback)!==clean){try{list=await children(fallback);if(!list.length)throw Error('Copia local vacía.');stats.localFallbacks++;}
     catch{issues.push({blockId:fallback,originId:id,message:'La página plantilla sí se pudo leer, pero el origen sincronizado y su copia local no. Notion no distingue entre un bloque eliminado y falta de permisos. Comparte la página original con la integración o desvincula el bloque en Notion conservando todo su contenido.'});return;}}
    else {issues.push({blockId:id,message:error instanceof Error?error.message:'No se pudieron leer los bloques.'});return;}
   }
   for(const block of list){
    if(++stats.blocks>5000)throw Error('La auditoría alcanzó 5000 bloques.');
    stats.types[block.type]=(stats.types[block.type]||0)+1;
    if(block.type==='toggle')stats.toggles++;
    if(/^heading_[1-4]$/.test(block.type)&&block[block.type]?.is_toggleable)stats.toggleHeadings++;
    const policy=templateBlockPolicy(block.type);
    if(policy.mode==='restricted'||policy.mode==='unknown'){issues.push({blockId:block.id,message:block.type+': '+policy.detail});continue;}
    if(block.type==='to_do')stats.checklists++;
    if(block.type==='column')stats.columns++;
    if(block.type==='synced_block'){stats.synced++;await walk(block.synced_block?.synced_from?.block_id||block.id,depth+1,block.id);}
    else if(block.has_children||block.type==='child_page'||block.type==='tab')await walk(block.id,depth+1);
   }
  }finally{path.delete(clean);}
 };
 try{await walk(pageId,0);}catch(error){issues.push({blockId:pageId,message:error instanceof Error?error.message:'No se completó la auditoría.'});}
 let copyPreview:Awaited<ReturnType<typeof inspectTemplateBody>>|undefined;
 if(!issues.length)try{copyPreview=await inspectTemplateBody(settings,pageId);}catch(error){issues.push({blockId:pageId,message:'No se pudo preparar la copia independiente: '+(error instanceof Error?error.message:'Contenido incompatible.')});}
 return {pageId,readable:issues.length===0,propertyCount,stats,copyPreview,issues};
}
