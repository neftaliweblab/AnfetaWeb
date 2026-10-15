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
    response = await fetch(fileUrl, {signal: AbortSignal.timeout(35000)});
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
    signal: AbortSignal.timeout(60000)
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

  async function read(id: string, depth: number): Promise<Node[]> {
    if (depth > 10 || seen.has(id)) {
      throw new Error('La plantilla supera la profundidad permitida o contiene referencias circulares.');
    }
    seen.add(id);
    const nodes: Node[] = [];

    for (const source of await readBlocks(settings, id)) {
      if (++count > 300) throw new Error('La plantilla supera 300 bloques; divídela antes de copiar.');
      const type = source.type;
      const content = source[type] || {};
      const text = (content.rich_text || []).map((x: any) => x.plain_text || x.text?.content || '').join('');

      if (/\[ANFETA_|Datos internos de ANFETA/i.test(text)) continue;
      if(type==='synced_block'){
        if(!source.synced_block)throw Error('El synced_block no devolvió su contenido; revisa los permisos de lectura.');
        const original=content.synced_from?.block_id||source.id;
        if(!original)throw Error('El synced_block de la plantilla no tiene un origen válido.');
        try{nodes.push(...await read(original,depth+1));}catch(error){throw Error('No se pudo copiar el synced_block; revisa el acceso al bloque original. '+(error instanceof Error?error.message:''));}
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
        if (!children.length || children.length > 100 || children.some(n => n.block.type !== 'table_row')) {
          throw new Error('La tabla de la plantilla no es compatible.');
        }
        body.children = children.map(n => n.block);
      }

      nodes.push({
        block: {object: 'block', type, [type]: body},
        children: type === 'table' ? [] : children
      });
    }

    seen.delete(id);
    return nodes;
  }

  return read(pageId, 0);
}

export async function appendTemplateBody(settings: CalendarSettings, pageId: string, nodes: Node[]) {
  for (let offset = 0; offset < nodes.length; ) {
    let end = offset;
    let bytes = 0;
    while (end < nodes.length && end - offset < 100) {
      const size = Buffer.byteLength(JSON.stringify(nodes[end].block));
      if (bytes + size > 450000) break;
      bytes += size;
      end++;
    }
    if (end === offset) throw new Error('Un bloque de la plantilla es demasiado grande.');

    const batch = nodes.slice(offset, end);
    const response = await notionRequest(settings, 'blocks/' + pageId + '/children', 'PATCH', {
      children: batch.map(n => n.block)
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
