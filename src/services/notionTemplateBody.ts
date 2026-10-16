import {readBlocks} from './notionCalendar';
import {notionRequest} from './notionMutations';
import type {CalendarSettings} from './notionCalendar';

type Node = {block: any; children: Node[]};

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
  embed: ['url'],
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
  return (value || []).map(part => {
    const type = part.type || 'text';
    if (!['text', 'mention', 'equation'].includes(type)) {
      throw new Error('La plantilla contiene texto no compatible.');
    }
    return {
      type,
      [type]: structuredClone(part[type]),
      ...(part.annotations ? {annotations: part.annotations} : {})
    };
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
  const arrayBuf = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  if (buffer.byteLength > 20 * 1024 * 1024) {
    throw new Error(`El archivo interno «${type}» supera el límite permitido de 20 MB.`);
  }
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

  return upload.id;
}

export async function prepareTemplateBody(settings: CalendarSettings, pageId: string): Promise<Node[]> {
  let count = 0;
  const seen = new Set<string>();
  // One consistent snapshot per source for this duplication. A shared origin
  // can appear in several columns; reuse its read, not the destination blocks.
  const sourcesById=new Map<string,Promise<any[]>>();
  const sourceKey=(id:string)=>id.replace(/-/g,'').toLowerCase();
  const readSource=(id:string)=>{
    const key=sourceKey(id);
    let pending=sourcesById.get(key);
    if(!pending){
      pending=readBlocks(settings,id).catch(error=>{sourcesById.delete(key);throw error;});
      sourcesById.set(key,pending);
    }
    return pending;
  };

  async function read(id: string, depth: number, fallbackId?:string): Promise<Node[]> {
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
        throw Error('No se pudo leer el origen del bloque sincronizado ni su copia local. Revisa el acceso de la integración a la página original. Detalle: '+(error instanceof Error?error.message:''));
      }
    }
    for (const source of sources) {
      let type = source.type;
      const content = source[type] || {};
      const text = (content.rich_text || []).map((x: any) => x.plain_text || x.text?.content || '').join('');

      if (/\[ANFETA_|Datos internos de ANFETA/i.test(text)) continue;
      if (++count > 5000) throw new Error('La plantilla supera el límite de seguridad de ANFETA de 5000 bloques. No se creó la actividad.');
      if (type === 'heading_4') {
        type = 'heading_3';
      }
      if(type==='synced_block'){
        if(!source.synced_block)throw Error('El synced_block no devolvió su contenido; revisa los permisos de lectura.');
        const original=content.synced_from?.block_id||source.id;
        if(!original)throw Error('El synced_block de la plantilla no tiene un origen válido.');
        nodes.push(...await read(original,depth+1,source.id));
        continue;
      }
      if (!fields[type]) {
        throw new Error('La plantilla contiene un bloque que aún no se puede copiar: ' + type + '. No se creó una página incompleta.');
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

      if(body.icon?.type==='file'&&body.icon.file?.url){const iconId=await transferNotionInternalFile(settings,body.icon.file.url,'image');body.icon={type:'file_upload',file_upload:{id:iconId}};}
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
          const uploadId = await transferNotionInternalFile(settings, content.file.url, type, content.name);
          body.type = 'file_upload';
          body.file_upload = {id: uploadId};
          if (type === 'file' && typeof content.name === 'string') body.name = content.name;
        } else {
          throw new Error('El archivo de la plantilla requiere transferencia o URL válida: ' + type);
        }
      }

      const children = source.has_children ? await read(source.id, depth + 1) : [];

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
    }

    return nodes;
    } finally {seen.delete(key);}
  }

  return read(pageId, 0);
}

export async function appendTemplateBody(settings: CalendarSettings, pageId: string, nodes: Node[]) {
  const blockCount=(block:any):number=>1+(block[block.type]?.children||[]).reduce((total:number,child:any)=>total+blockCount(child),0);
  for (let offset = 0; offset < nodes.length; ) {
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

    if (response.results?.length !== batch.length) {
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
