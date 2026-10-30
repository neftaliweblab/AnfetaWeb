import {readBlocks} from './notionCalendar';

function parseDatabaseRow(page: any) {
  const props = page?.properties || {};
  let title = '';
  let isChecked = false;
  let amount = '';
  let status = '';
  let tags: string[] = [];
  let date = '';

  for (const [propName, propVal] of Object.entries(props) as [string, any][]) {
    if (!propVal) continue;
    const pType = propVal.type;
    if (pType === 'title') {
      title = (propVal.title || []).map((t: any) => t.plain_text || t.text?.content || '').join('');
    } else if (pType === 'checkbox') {
      if (propVal.checkbox) isChecked = true;
    } else if (pType === 'number' && Number.isFinite(propVal.number)) {
      amount = propVal.number.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';
    } else if (pType === 'formula') {
      if (propVal.formula?.type === 'number' && Number.isFinite(propVal.formula.number)) {
        amount = propVal.formula.number.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';
      } else if (propVal.formula?.type === 'string' && propVal.formula.string) {
        amount = propVal.formula.string;
      }
    } else if (pType === 'select' && propVal.select?.name) {
      if (/estado|status/i.test(propName)) status = propVal.select.name;
      else tags.push(propVal.select.name);
    } else if (pType === 'status' && propVal.status?.name) {
      status = propVal.status.name;
    } else if (pType === 'multi_select' && Array.isArray(propVal.multi_select)) {
      tags.push(...propVal.multi_select.map((m: any) => m.name));
    } else if (pType === 'date' && propVal.date?.start) {
      const s = propVal.date.start;
      const e = propVal.date.end;
      date = s.length > 10 ? s.slice(0, 16).replace('T', ' ') : s;
      if (e) date += ' → ' + (e.length > 10 ? e.slice(11, 16) : e);
    }
  }

  return {
    id: page.id,
    url: page.url,
    title: title || 'Sin título',
    isChecked,
    amount,
    status,
    tags,
    date,
  };
}

async function queryChildDatabase(token: string, dbId: string, signal?: AbortSignal) {
  if (!token || !token.trim()) return [];
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ page_size: 25 }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).filter((p: any) => !p.archived && !p.in_trash).map(parseDatabaseRow);
  } catch {
    return [];
  }
}

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

   if(kind==='child_database'){
    const dbId=block.id;const dbTitle=label||body.title||'Base de datos enlazada';
    const rows=await queryChildDatabase(token,dbId,settings.notionSignal);
    output.push({
      id:block.id,
      kind:'child_database',
      text:dbTitle,
      depth,
      readOnly:true,
      databaseId:block.id,
      rows,
      rowCount:rows.length,
      notionUrl:`https://notion.so/${block.id.replace(/-/g,'')}`
    });
    continue;
   }

   if(kind==='callout'){
    output.push({
      id:block.id,
      kind:'callout',
      text:label,
      depth,
      readOnly,
      isToggleable:!!body.is_toggleable,
      hasChildren:!!block.has_children,
      icon:body.icon?.emoji||body.icon?.external?.url||'📌',
      color:body.color||'default',
      lastEditedTime:block.last_edited_time
    });
    if(block.has_children){
      if(depth<maxDepth)await walk(block.id,depth+1,readOnly);
      else warnings.add('Hay secciones anidadas sin cargar. Usa Cargar contenido completo.');
    }
    continue;
   }

   if(kind==='quote'){
    output.push({
      id:block.id,
      kind:'quote',
      text:label,
      depth,
      readOnly,
      isToggleable:!!body.is_toggleable,
      hasChildren:!!block.has_children,
      lastEditedTime:block.last_edited_time
    });
    if(block.has_children){
      if(depth<maxDepth)await walk(block.id,depth+1,readOnly);
      else warnings.add('Hay secciones anidadas sin cargar. Usa Cargar contenido completo.');
    }
    continue;
   }

   if(['unsupported','meeting_notes','transcription'].includes(kind)){warnings.add('El bloque '+kind+' requiere abrirse en Notion o un endpoint específico; no se recibió una copia editable completa.');continue;}
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
