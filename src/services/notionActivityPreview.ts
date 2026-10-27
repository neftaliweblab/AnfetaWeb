import {readBlocks} from './notionCalendar';
export async function readActivityPreview(token:string,pageId:string,maxDepth=3){
 const output:any[]=[],warnings=new Set<string>(),seen=new Set<string>(),limit=maxDepth>3?1500:250;
 const settings={notionToken:token,currentUser:'',notionSignal:AbortSignal.timeout(maxDepth>3?75000:35000)};
 const walk=async(id:string,depth:number,readOnly=false,fallbackId?:string)=>{
  const clean=id.replace(/-/g,'');if(seen.has(clean)){warnings.add('Se detectó una referencia circular; no se repitió su contenido.');return;}
  if(output.length>=limit){warnings.add('Se alcanzó el límite de '+limit+' bloques; el contenido recibido se conserva.');return;}
  seen.add(clean);
  try{let blocks:any[];try{blocks=await readBlocks(settings,id);}catch(error){if(!fallbackId||fallbackId===id)throw error;blocks=await readBlocks(settings,fallbackId);if(!blocks.length)throw Error('La copia sincronizada no devolvió contenido.');}
   for(const block of blocks){
   if(output.length>=limit){warnings.add('Se alcanzó el límite de '+limit+' bloques.');break;}
   const kind=block.type,body=block[kind]||{},text=(body.rich_text||body.title||[]);const label=Array.isArray(text)?text.map((t:any)=>t.plain_text||t.text?.content||'').join(''):String(text||'');
   if(/^\s*(?:\[ANFETA_|Datos internos de ANFETA)/i.test(label))continue;
   if(['unsupported','child_database','meeting_notes','transcription'].includes(kind)){warnings.add('El bloque '+kind+' requiere abrirse en Notion o un endpoint específico; no se recibió una copia editable completa.');continue;}
   if(kind==='synced_block'){
    if(depth>=maxDepth){warnings.add('Hay secciones anidadas sin cargar. Usa Cargar contenido completo.');continue;}
    const origin=body.synced_from?.block_id||block.id;try{await walk(origin,depth+1,true,block.id);}catch{warnings.add('No se pudo leer un bloque sincronizado. Revisa el origen en Notion.');}continue;
   }
   const url=body.file?.url||body.external?.url||body.url||'';
   const structural=['column','column_list','table'].includes(kind);
   if(!structural&&(label||url||kind==='divider'||kind==='equation'||kind==='table_row'))output.push({id:block.id,kind,text:kind==='equation'?body.expression||'':label,isChecked:!!body.checked,depth,readOnly,isToggleable:!!body.is_toggleable,hasChildren:!!block.has_children||kind==='child_page',caption:(body.caption||[]).map((t:any)=>t.plain_text||t.text?.content||'').join(''),url,lastEditedTime:block.last_edited_time,cells:kind==='table_row'?(body.cells||[]).map((cell:any[])=>cell.map(t=>t.plain_text||t.text?.content||'').join('')):undefined});
   if(block.has_children||kind==='child_page'){if(depth<maxDepth)await walk(block.id,depth+1,readOnly);else warnings.add('Hay secciones anidadas sin cargar. Usa Cargar contenido completo.');}
  }}catch(error){warnings.add('No se pudo completar una sección: '+(error instanceof Error?error.message:'Notion no respondió.'));}finally{seen.delete(clean);}
 };
 await walk(pageId,0);
 if(warnings.size)output.push({id:'preview-warning',kind:'warning',text:[...warnings].join(' '),depth:0,readOnly:true});
 return output;
}
