import {templateBlockPolicy} from './templateBlockPolicy';
import {readBlocks} from './notionCalendar';
import {notionRequest} from './notionMutations';
import type {CalendarSettings} from './notionCalendar';

type Node = {block: any; children: Node[]};
const MAX_FILE_BYTES=20*1024*1024;

/** Preflight the entire materialized tree before creating a destination page. */
export function validateTemplateBody(nodes:Node[]) {
  let totalBytes=0;
  const walk=(list:Node[],parent?:any)=>{
    for(const node of list){
      const block=node.block,body=block[block.type];
      if(!body)throw Error('Bloque de plantilla sin contenido: '+block.type);
      if(node.children.length&&!['paragraph','heading_1','heading_2','heading_3','bulleted_list_item','numbered_list_item','to_do','toggle','quote','callout','column','column_list','table'].includes(block.type))throw Error('El bloque '+block.type+' no admite contenido anidado.');
      if(block.type==='column'&&parent?.type!=='column_list')throw Error('La plantilla contiene una columna fuera de su grupo.');
      if(['bookmark','embed'].includes(block.type)&&!(block.type==='embed'&&body.type==='file_upload'&&body.file_upload?.id)){
        try{const url=new URL(body.url);if(!/^https?:$/.test(url.protocol)||body.url.length>2000)throw Error();}
        catch{throw Error('El bloque '+block.type+' no tiene una URL web válida.');}
      }
      const bytes=Buffer.byteLength(JSON.stringify(block));totalBytes+=bytes;
      if(bytes>450000)throw Error('Un bloque de la plantilla es demasiado grande: '+block.type+'.');
      if(totalBytes>20*1024*1024)throw Error('El contenido de la plantilla supera el límite de seguridad de 20 MB.');
      for(const key of ['rich_text','caption']){
        if(Array.isArray(body[key])){
          if(body[key].length>100)throw Error('El bloque '+block.type+' supera 100 fragmentos de texto en '+key+'.');
          for(const item of body[key]){
            if(item.type==='text'&&item.text?.content&&item.text.content.length>2000){
              throw Error('El bloque '+block.type+' contiene un fragmento de texto mayor a 2000 caracteres.');
            }
          }
        }
      }
      if(block.type==='table_row'){
        if(!parent||parent.type!=='table')throw Error('La plantilla contiene una fila fuera de una tabla.');
        if(body.cells.length!==parent.table.table_width)throw Error('Una fila no coincide con el número de columnas de la tabla.');
        for(const cell of body.cells||[]){
          if(Array.isArray(cell)&&cell.length>100)throw Error('Una celda de la tabla supera 100 fragmentos de texto.');
          for(const item of (Array.isArray(cell)?cell:[])){
            if(item.type==='text'&&item.text?.content&&item.text.content.length>2000){
              throw Error('Una celda de la tabla contiene un fragmento de texto mayor a 2000 caracteres.');
            }
          }
        }
      }
      if(block.type==='table'){
        if(!Number.isInteger(body.table_width)||body.table_width<1)throw Error('La tabla no tiene un ancho válido.');
        for(const row of body.children||[])if(row.table_row?.cells?.length!==body.table_width)throw Error('Una fila no coincide con el número de columnas de la tabla.');
      }
      walk(node.children,block);
    }
  };
  walk(nodes);
}

const fields: Record<string, string[]> = {
  paragraph: ['rich_text', 'color'],
  heading_1: ['rich_text', 'color', 'is_toggleable'],
  heading_2: ['rich_text', 'color', 'is_toggleable'],
  heading_3: ['rich_text', 'color', 'is_toggleable'],
  bulleted_list_item: ['rich_text', 'color'],
  numbered_list_item: ['rich_text', 'color'],
  to_do: ['rich_text', 'color', 'checked'],
  toggle: ['rich_text', 'color'],
  quote: ['rich_text', 'color'],
  callout: ['rich_text', 'color', 'icon'],
  code: ['rich_text', 'caption', 'language'],
  divider: [],
  equation: ['expression'],
  bookmark: ['url', 'caption'],
  embed: ['url', 'caption'],
  table: ['table_width', 'has_column_header', 'has_row_header'],
  table_row: ['cells'],
  table_of_contents: ['color'],
  breadcrumb: [],
  image: ['caption'],
  video: ['caption'],
  audio: ['caption'],
  pdf: ['caption'],
  file: ['caption'],
  column_list: [],
  column: ['width_ratio']
};

function rich(value: any[]): any[] {
  return (value || []).flatMap(part => {
    const type = part.type || 'text';
    if (!['text', 'mention', 'equation'].includes(type)) {
      throw new Error('La plantilla contiene texto no compatible.');
    }
    const payload = part[type] || (type === 'text' && typeof part.plain_text === 'string' ? {content: part.plain_text} : null);
    if (!payload || typeof payload !== 'object') throw Error('La plantilla contiene un fragmento de ' + type + ' sin contenido válido.');
    if (type === 'text' && typeof payload.content === 'string' && payload.content.length > 2000) {
      const chunks: any[] = [];
      const str = payload.content;
      for (let i = 0; i < str.length; i += 2000) {
        chunks.push({
          type: 'text',
          text: {
            ...structuredClone(payload),
            content: str.slice(i, i + 2000)
          },
          ...(part.annotations ? {annotations: structuredClone(part.annotations)} : {})
        });
      }
      return chunks;
    }
    return [{
      type,
      [type]: structuredClone(payload),
      ...(part.annotations ? {annotations: structuredClone(part.annotations)} : {})
    }];
  });
}

export function validateNotionInternalUrl(urlStr: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error('URL de archivo interno inválida para transferencia en la plantilla.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Solo se admiten transferencias HTTPS seguras de archivos internos.');
  }
  const host = parsed.hostname.toLowerCase();
  const isAllowed =
    host.endsWith('.amazonaws.com') ||
    host.endsWith('.notion.so') ||
    host.endsWith('.notion-static.com') ||
    host.endsWith('.notion.com');
  if (!isAllowed) {
    throw new Error(`Dominio no autorizado para transferencia interna de medios: ${host}`);
  }
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)/.test(host)) {
    throw new Error('Destino prohibido para transferencia de medios.');
  }
  return parsed;
}

export async function transferNotionInternalFile(
  settings: CalendarSettings,
  fileUrl: string,
  type: string,
  originalName?: string
): Promise<string> {
  settings.notionSignal?.throwIfAborted();
  validateNotionInternalUrl(fileUrl);
  let response: Response;
  try {
    response = await fetch(fileUrl, {signal: settings.notionSignal?AbortSignal.any([settings.notionSignal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000)});
  } catch (err: any) {
    throw new Error(`Fallo de red en la transferencia del archivo interno «${type}»: ${err?.message || ''}`);
  }
  if (!response.ok) {
    throw new Error(`Error descargando medio interno «${type}» para transferencia (${response.status}).`);
  }
  if(Number(response.headers.get('content-length'))>MAX_FILE_BYTES){await response.body?.cancel();throw Error(`El archivo interno «${type}» supera el límite permitido de 20 MB.`);}
  const chunks:Uint8Array[]=[];let size=0;
  const reader=response.body?.getReader();
  if(!reader)throw Error('El archivo interno no devolvió contenido.');
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_FILE_BYTES){await reader.cancel();throw Error(`El archivo interno «${type}» supera el límite permitido de 20 MB.`);}chunks.push(value);}}
  finally{reader.releaseLock();}
  if(!size)throw Error('El archivo interno está vacío.');
  const buffer=Buffer.concat(chunks);
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  let filename = originalName;
  if (!filename) {
    const pathname = new URL(fileUrl).pathname;
    const extracted = pathname.split('/').pop()?.split('?')[0];
    filename = extracted || `archivo_${Date.now()}.${type === 'image' ? 'png' : type === 'pdf' ? 'pdf' : 'bin'}`;
  }

  const upload = await notionRequest(settings, 'file_uploads', 'POST', {
    mode: 'single_part',
    filename,
    content_type: contentType
  });

  if (!upload?.id) {
    throw new Error(`Notion no entregó identificador de carga para la transferencia de «${filename}».`);
  }

  const form = new FormData();
  form.append('file', new Blob([buffer], {type: contentType}), filename);
  const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${upload.id}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${(settings.notionToken || '').trim()}`,
      'Notion-Version': '2022-06-28'
    },
    body: form,
    signal: settings.notionSignal?AbortSignal.any([settings.notionSignal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text().catch(() => '');
    throw new Error(`Notion rechazó la transferencia de «${filename}» (${sendRes.status}): ${errText}`);
  }
  const sent=await sendRes.json();
  if(sent.status!=='uploaded')throw Error('Notion no confirmó la carga completa de «'+filename+'».');

  return upload.id;
}

async function planTemplateBody(settings: CalendarSettings, pageId: string) {
  let count = 0;
  const seen = new Set<string>();
  const conversions:{blockId:string;type:string;detail:string}[]=[];
  const transfers:Array<()=>Promise<void>>=[];
  const queueTransfer=(source:any,run:()=>Promise<void>)=>transfers.push(async()=>{
    try{await run();}catch(error){throw Error('Archivo del bloque '+source.id+' ('+source.type+'): '+(error instanceof Error?error.message:'No se pudo transferir.'));}
  });
  const media=new Map<string,Promise<string>>();
  const transfer=(url:string,type:string,name?:string)=>{
    const key=JSON.stringify([url,type,name||'']);let pending=media.get(key);
    if(!pending){pending=transferNotionInternalFile(settings,url,type,name);media.set(key,pending);}
    return pending;
  };
  // One consistent snapshot per source for this duplication. A shared origin
  // can appear in several columns; reuse its read, not the destination blocks.
  const sourcesById=new Map<string,Promise<any[]>>();
  const sourceKey=(id:string)=>id.replace(/-/g,'').toLowerCase();
  const readSource=(id:string)=>{
    settings.notionSignal?.throwIfAborted();
    const key=sourceKey(id);
    let pending=sourcesById.get(key);
    if(!pending){
      pending=readBlocks(settings,id).catch(error=>{sourcesById.delete(key);throw error;});
      sourcesById.set(key,pending);
    }
    return pending;
  };

  async function read(id: string, depth: number, fallbackId?:string,insideTab=false): Promise<Node[]> {
    const key=sourceKey(id);
    if (depth > 30) throw new Error('La plantilla supera 30 niveles de anidación.');
    if (seen.has(key)) throw new Error('La plantilla contiene una referencia circular entre bloques.');
    seen.add(key);
    try {
    const nodes: Node[] = [];
    let sources:any[];
    try {sources=await readSource(id);}
    catch(error){
      // Retry the local synced copy only when reading its origin fails, never
      // when processing its content fails (limits, cycles or unsupported blocks).
      if(!fallbackId||sourceKey(fallbackId)===key)throw error;
      try {
        sources=await readSource(fallbackId);
        if(!sources.length)throw Error('La copia local no devolvió contenido.');
      }catch{
        throw Error('No se pudo leer el origen del bloque sincronizado ni su copia local. Origen: '+id+'. Copia local: '+fallbackId+'. No se creó una actividad incompleta. Comparte la página original con la integración o, desde Notion, convierte el bloque en contenido independiente conservando ambas secciones y todos sus checks. Detalle: '+(error instanceof Error?error.message:''));
      }
    }
    for (const source of sources) {
      try {
      let type = source.type;
      let content = source[type] || {};
      const text = (content.rich_text || []).map((x: any) => x.plain_text || x.text?.content || '').join('');

      if (/^(?:\[ANFETA_[A-Z0-9_]+\]|Datos internos de ANFETA$)/i.test(text.trim())) continue;
      if (++count > 5000) throw new Error('La plantilla supera el límite de seguridad de ANFETA de 5000 bloques. No se creó la actividad.');
      const policy=templateBlockPolicy(type);
      if(policy.mode==='restricted'||policy.mode==='unknown')throw Error('La plantilla contiene un bloque que aún no se puede copiar: '+type+(content.block_type?' ('+content.block_type+')':'')+'. '+policy.detail+' No se creó una página incompleta.');
      if(policy.mode==='convert')conversions.push({blockId:source.id,type,detail:policy.detail});
      if (type === 'heading_4') {
        type = 'heading_3';
      }
      if(type==='template')type='toggle';
      if(type==='child_page'){type='toggle';content={rich_text:[{type:'text',text:{content:content.title||'Subpágina'}}]};}
      if(type==='tab'){type='toggle';content={rich_text:[{type:'text',text:{content:'Pestañas'}}]};}
      if(insideTab&&type==='paragraph'&&content.icon)type='callout';
      if(type==='link_to_page'){const target=content[content.type];if(!['page_id','database_id','data_source_id'].includes(content.type)||typeof target!=='string'||!/^[a-f0-9-]{32,36}$/i.test(target))throw Error('Enlace de Notion sin destino válido.');type='bookmark';content={url:'https://www.notion.so/'+target.replace(/-/g,'')};}
      if(type==='link_preview'){type='bookmark';content={url:source.link_preview?.url};}
      if(type==='child_database'){
        let titleStr = '';
        if (typeof content.title === 'string') {
          titleStr = content.title;
        } else if (Array.isArray(content.title)) {
          titleStr = content.title.map((x: any) => x.plain_text || x.text?.content || '').join('');
        }
        const dbTitle = titleStr.trim() || 'Base de datos';
        const cleanId = String(source.id || '').replace(/-/g, '');
        const url = cleanId ? 'https://www.notion.so/' + cleanId : 'https://www.notion.so';
        type = 'callout';
        content = {
          icon: { type: 'emoji', emoji: '📊' },
          color: 'gray_background',
          rich_text: [
            { type: 'text', text: { content: dbTitle + ': ', link: null }, annotations: { bold: true } },
            { type: 'text', text: { content: 'Abrir base de datos original en Notion ↗', link: { url } }, annotations: { underline: true } }
          ]
        };
      }
      if(type==='synced_block'){
        if(!source.synced_block)throw Error('El synced_block no devolvió su contenido; revisa los permisos de lectura.');
        const original=content.synced_from?.block_id||source.id;
        if(!original)throw Error('El synced_block de la plantilla no tiene un origen válido.');
        nodes.push(...await read(original,depth+1,source.id));
        continue;
      }
      if (!fields[type]) {
        throw new Error('La plantilla contiene un bloque que aún no se puede copiar: ' + type + (content.block_type?' ('+content.block_type+')':'') + '. No se creó una página incompleta.');
      }

      const body: any = {};
      for (const key of fields[type]) {
        if (content[key] !== undefined) {
          body[key] = key === 'rich_text' || key === 'caption'
            ? rich(content[key])
            : key === 'cells'
            ? content.cells.map(rich)
            : structuredClone(content[key]);
        }
      }

      if(type==='embed'){
        if(content.type==='file_upload'&&content.file_upload?.id){delete body.url;body.type='file_upload';body.file_upload={id:content.file_upload.id};}
        else {const url=content.file?.url||content.url;let html=false;try{const parsed=new URL(url);html=/\.html?$/i.test(parsed.pathname)&&/\.(amazonaws\.com|notion\.so|notion-static\.com|notion\.com)$/i.test(parsed.hostname);}catch{}
          if(content.type==='file'||html){validateNotionInternalUrl(url);delete body.url;body.type='file_upload';body.file_upload={id:'pending'};queueTransfer(source,async()=>{body.file_upload={id:await transfer(url,'file','embed.html')};});}
        }
      }
      if(body.icon?.type==='file'&&body.icon.file?.url){const url=body.icon.file.url;validateNotionInternalUrl(url);queueTransfer(source,async()=>{body.icon={type:'file_upload',file_upload:{id:await transfer(url,'image')}};});}
      if (['image', 'video', 'audio', 'pdf', 'file'].includes(type)) {
        if (content.type === 'file_upload' && content.file_upload?.id) {
          body.type = 'file_upload';
          body.file_upload = {id: content.file_upload.id};
          if (type === 'file' && typeof content.name === 'string') body.name = content.name;
        } else if (content.type === 'external' && typeof content.external?.url === 'string' && /^https?:\/\//i.test(content.external.url)) {
          body.type = 'external';
          body.external = {url: content.external.url};
          if (type === 'file' && typeof content.name === 'string') body.name = content.name;
        } else if (content.type === 'file' && typeof content.file?.url === 'string') {
          validateNotionInternalUrl(content.file.url);
          body.type = 'file_upload';
          body.file_upload = {id:'pending'};
          queueTransfer(source,async()=>{body.file_upload={id:await transfer(content.file.url,type,content.name)};});
          if (type === 'file' && typeof content.name === 'string') body.name = content.name;
        } else {
          throw new Error('El archivo de la plantilla requiere transferencia o URL válida: ' + type);
        }
      }

      const children = (source.type !== 'child_database' && (source.has_children||source.type==='child_page'||source.type==='tab')) ? await read(source.id, depth + 1,undefined,source.type==='tab') : [];

      if(/^heading_[1-3]$/.test(type)&&children.length)body.is_toggleable=true;

      if (type === 'column_list') {
        if (children.length < 2 || children.length > 100 || children.some(n => n.block.type !== 'column')) {
          throw new Error('La plantilla requiere entre 2 y 100 columnas válidas.');
        }
        body.children = children.map(n => ({
          ...n.block,
          column: {
            ...n.block.column,
            children: [{object: 'block', type: 'paragraph', paragraph: {rich_text: []}}]
          }
        }));
      }

      if (type === 'table') {
        if (!children.length || children.some(n => n.block.type !== 'table_row')) {
          throw new Error('La tabla de la plantilla no es compatible.');
        }
        // Notion requires an initial row. Append the remaining rows in batches
        // rather than putting the entire table into a single request.
        body.children = [children[0].block];
      }

      nodes.push({
        block: {object: 'block', type, [type]: body},
        children: type === 'table' ? children.slice(1) : children
      });
      }catch(error){throw Error('Bloque '+source.id+' ('+source.type+'): '+(error instanceof Error?error.message:'No se pudo preparar su contenido.'));}
    }

    return nodes;
    } finally {seen.delete(key);}
  }

  const nodes=await read(pageId, 0);
  validateTemplateBody(nodes);
  return {nodes,transfers,conversions};
}

/** Exercise the exact copy preparation without uploading files or creating pages. */
export async function inspectTemplateBody(settings:CalendarSettings,pageId:string){
  const {nodes,transfers,conversions}=await planTemplateBody(settings,pageId);
  let blocks=0,checklists=0,columns=0;
  const walk=(list:Node[])=>{for(const node of list){blocks++;if(node.block.type==='to_do')checklists++;if(node.block.type==='column')columns++;walk(node.children);}};
  walk(nodes);
  return {compatible:true,blocks,checklists,columns,pendingFileTransfers:transfers.length,conversions};
}

export async function prepareTemplateBody(settings:CalendarSettings,pageId:string):Promise<Node[]>{
  const {nodes,transfers}=await planTemplateBody(settings,pageId);
  for(const run of transfers)await run();
  validateTemplateBody(nodes);
  return nodes;
}

export async function appendTemplateBody(settings: CalendarSettings, pageId: string, nodes: Node[]) {
  const blockCount=(block:any):number=>1+(block[block.type]?.children||[]).reduce((total:number,child:any)=>total+blockCount(child),0);
  for (let offset = 0; offset < nodes.length; ) {
    settings.notionSignal?.throwIfAborted();
    let end = offset;
    let bytes = 16, blocks=0;
    while (end < nodes.length && end - offset < 100) {
      const size = Buffer.byteLength(JSON.stringify(nodes[end].block));
      const nested=blockCount(nodes[end].block);
      if (bytes + size + 1 > 450000 || blocks+nested>1000) break;
      bytes += size+1;blocks+=nested;
      end++;
    }
    if (end === offset) throw new Error('Un bloque de la plantilla es demasiado grande.');

    const batch = nodes.slice(offset, end);
    const sanitizedChildren = batch.map(n => {
      if (n.block.type === 'column_list' && Array.isArray(n.block.column_list?.children)) {
        return {
          ...n.block,
          column_list: {
            ...n.block.column_list,
            children: n.block.column_list.children.map((col: any) => {
              if (col.type === 'column' && col.column) {
                const { width_ratio, ...restCol } = col.column;
                return { ...col, column: restCol };
              }
              return col;
            })
          }
        };
      }
      return n.block;
    });
    const response = await notionRequest(settings, 'blocks/' + pageId + '/children', 'PATCH', {
      children: sanitizedChildren
    });

    if (response.results?.length !== batch.length || response.results.some((block:any)=>!block.id) || new Set(response.results.map((block:any)=>block.id)).size!==batch.length) {
      throw new Error('Notion no confirmó todos los bloques copiados.');
    }

    for (let i = 0; i < batch.length; i++) {
      const node = batch[i];
      const createdId = response.results[i].id;
      if (node.block.type === 'column_list') {
        const columns = await readBlocks(settings, createdId);
        if (columns.length !== node.children.length || columns.some((column: any) => column.type !== 'column')) {
          throw new Error('Notion no confirmó todas las columnas copiadas.');
        }
        for (let c = 0; c < columns.length; c++) {
          const placeholders = await readBlocks(settings, columns[c].id);
          if (placeholders.length !== 1 || placeholders[0].type !== 'paragraph' || (placeholders[0].paragraph?.rich_text || []).length) {
            throw new Error('No se pudo confirmar la estructura inicial de la columna.');
          }
          await appendTemplateBody(settings, columns[c].id, node.children[c].children);
          if (node.children[c].children.length) {
            await notionRequest(settings, 'blocks/' + placeholders[0].id, 'DELETE');
          }
        }
      } else if (node.children.length) {
        await appendTemplateBody(settings, createdId, node.children);
      }
    }
    offset = end;
  }
}
