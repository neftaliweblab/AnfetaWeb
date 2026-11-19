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

const WRITABLE_MENTION_KEYS = ['user', 'date', 'page', 'database', 'template_mention', 'custom_emoji'] as const;

function splitLongTextRuns(content: string, basePayload: any = {}, annotations?: any): any[] {
  const safeContent = String(content ?? '');
  if (safeContent.length <= 2000) {
    return [{
      type: 'text',
      text: { ...structuredClone(basePayload), content: safeContent },
      ...(annotations ? { annotations: structuredClone(annotations) } : {})
    }];
  }
  const chunks: any[] = [];
  for (let i = 0; i < safeContent.length; i += 2000) {
    chunks.push({
      type: 'text',
      text: {
        ...structuredClone(basePayload),
        content: safeContent.slice(i, i + 2000)
      },
      ...(annotations ? { annotations: structuredClone(annotations) } : {})
    });
  }
  return chunks;
}

function normalizeReadableUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000) return undefined;
  try {
    const parsed = new URL(trimmed);
    return /^https?:$/i.test(parsed.protocol) ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function convertMentionFallbackToText(part: any, payload: any): any[] {
  const rawHref =
    payload?.link_mention?.href ??
    payload?.link_preview?.url ??
    part?.href ??
    payload?.href ??
    payload?.url;
  const linkUrl = normalizeReadableUrl(rawHref);
  const titleCandidate =
    typeof part?.plain_text === 'string' && part.plain_text.trim()
      ? part.plain_text
      : typeof payload?.link_mention?.title === 'string' && payload.link_mention.title.trim()
      ? payload.link_mention.title
      : linkUrl || '';
  if (!titleCandidate) return [];
  const textPayload: any = linkUrl ? { link: { url: linkUrl } } : {};
  return splitLongTextRuns(titleCandidate, textPayload, part?.annotations);
}

function rich(value: any[], tolerant = false): any[] {
  return (value || []).flatMap(part => {
    if (!part || typeof part !== 'object') {
      if (tolerant) return [];
      throw new Error('La plantilla contiene texto no compatible.');
    }
    const type = part.type || 'text';
    if (!['text', 'mention', 'equation'].includes(type)) {
      if (tolerant) {
        if (typeof part.plain_text === 'string' && part.plain_text) {
          const linkUrl = normalizeReadableUrl(part.href);
          return splitLongTextRuns(part.plain_text, linkUrl ? { link: { url: linkUrl } } : {}, part.annotations);
        }
        return [];
      }
      throw new Error('La plantilla contiene texto no compatible.');
    }
    if (type === 'mention') {
      const payload = part.mention;
      if (!payload || typeof payload !== 'object') {
        const fallback = convertMentionFallbackToText(part, {});
        if (fallback.length || tolerant) return fallback;
        throw Error('La plantilla contiene un fragmento de mention sin contenido válido.');
      }
      const mType = typeof payload.type === 'string' ? payload.type : '';
      const validKey = (WRITABLE_MENTION_KEYS as readonly string[]).includes(mType) && payload[mType] && typeof payload[mType] === 'object'
        ? mType
        : WRITABLE_MENTION_KEYS.find(k => payload[k] && typeof payload[k] === 'object');
      if (validKey) {
        return [{
          type: 'mention',
          mention: {
            ...(mType ? { type: validKey } : {}),
            [validKey]: structuredClone(payload[validKey])
          },
          ...(part.annotations ? { annotations: structuredClone(part.annotations) } : {})
        }];
      }
      // Notion read-only mentions (link_mention, link_preview, etc.) lack writable subfields on write.
      const fallback = convertMentionFallbackToText(part, payload);
      if (fallback.length || tolerant) return fallback;
      throw Error('La plantilla contiene un fragmento de mention sin contenido válido.');
    }
    const payload = part[type] || (type === 'text' && typeof part.plain_text === 'string' ? {content: part.plain_text} : null);
    if (!payload || typeof payload !== 'object') {
      if (tolerant) return [];
      throw Error('La plantilla contiene un fragmento de ' + type + ' sin contenido válido.');
    }
    if (type === 'text') {
      return splitLongTextRuns(payload.content ?? part.plain_text ?? '', payload, part.annotations);
    }
    return [{
      type,
      [type]: structuredClone(payload),
      ...(part.annotations ? {annotations: structuredClone(part.annotations)} : {})
    }];
  });
}

export function writableNotionRichText(parts:any[]){return rich(parts,false);}

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

function describeBlockLabel(type: string, rawText?: string): string {
  const cleaned = (rawText || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return type;
  return cleaned.length > 42 ? cleaned.slice(0, 42) + '...' : cleaned;
}

function isAbortLike(settings: CalendarSettings, error: unknown): boolean {
  return Boolean(settings.notionSignal?.aborted || (error instanceof Error && error.name === 'AbortError'));
}

function isFatalNotionError(settings: CalendarSettings, error: unknown): boolean {
  if (isAbortLike(settings, error)) return true;
  const status = (error as { status?: number })?.status;
  if (status === 401) return true;
  const msg = error instanceof Error ? error.message : String(error || '');
  return /unauthorized|api token is invalid/i.test(msg);
}

async function planTemplateBody(settings: CalendarSettings, pageId: string, tolerant = false) {
  let count = 0;
  const seen = new Set<string>();
  const conversions:{blockId:string;type:string;detail:string}[]=[];
  const warnings: string[] = [];
  const droppedNodes = new WeakSet<Node>();
  const transfers:Array<()=>Promise<void>>=[];
  const queueTransfer=(source:any,run:()=>Promise<void>,onTolerantFail?:(reason:string)=>void)=>transfers.push(async()=>{
    try{await run();}catch(error){
      if (isAbortLike(settings, error)) throw error;
      const reason = error instanceof Error ? error.message : 'No se pudo transferir.';
      if (tolerant && onTolerantFail) {
        onTolerantFail(reason);
        return;
      }
      throw Error('Archivo del bloque '+source.id+' ('+source.type+'): '+reason);
    }
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
    if (depth > 30) {
      if (tolerant) { warnings.push('Se omitió un elemento anidado que supera 30 niveles.'); return []; }
      throw new Error('La plantilla supera 30 niveles de anidación.');
    }
    if (seen.has(key)) {
      if (tolerant) { warnings.push('Se omitió un bloque sincronizado con referencia circular.'); return []; }
      throw new Error('La plantilla contiene una referencia circular entre bloques.');
    }
    seen.add(key);
    try {
    const nodes: Node[] = [];
    let sources:any[];
    try {sources=await readSource(id);}
    catch(error){
      if (isAbortLike(settings, error)) throw error;
      // Retry the local synced copy only when reading its origin fails, never
      // when processing its content fails (limits, cycles or unsupported blocks).
      if(!fallbackId||sourceKey(fallbackId)===key){
        if (tolerant && depth > 0) {
          warnings.push('No se pudo leer un contenido anidado (' + (error instanceof Error ? error.message : 'sin acceso') + ') y se omitió.');
          return [];
        }
        throw error;
      }
      try {
        sources=await readSource(fallbackId);
        if(!sources.length)throw Error('La copia local no devolvió contenido.');
      }catch{
        if (tolerant) {
          warnings.push('Un bloque sincronizado no se pudo leer y se omitió.');
          return [];
        }
        throw Error('No se pudo leer el origen del bloque sincronizado ni su copia local. Origen: '+id+'. Copia local: '+fallbackId+'. No se creó una actividad incompleta. Comparte la página original con la integración o, desde Notion, convierte el bloque en contenido independiente conservando ambas secciones y todos sus checks. Detalle: '+(error instanceof Error?error.message:''));
      }
    }
    for (const source of sources) {
      let currentLabel = source?.type || 'bloque';
      try {
      let type = source.type;
      let content = source[type] || {};
      const text = (content.rich_text || []).map((x: any) => x.plain_text || x.text?.content || '').join('');
      currentLabel = describeBlockLabel(type, text);

      if (/^(?:\[ANFETA_[A-Z0-9_]+\]|Datos internos de ANFETA$)/i.test(text.trim())) continue;
      if (++count > 5000) {
        if (tolerant) {
          warnings.push('La plantilla supera 5000 bloques; se omitieron elementos adicionales.');
          break;
        }
        throw new Error('La plantilla supera el límite de seguridad de ANFETA de 5000 bloques. No se creó la actividad.');
      }
      const policy=templateBlockPolicy(type);
      if(policy.mode==='restricted'||policy.mode==='unknown'){
        if (tolerant) {
          warnings.push('El elemento "' + currentLabel + '" (' + type + ') no es compatible para duplicación y se omitió.');
          continue;
        }
        throw Error('La plantilla contiene un bloque que aún no se puede copiar: '+type+(content.block_type?' ('+content.block_type+')':'')+'. '+policy.detail+' No se creó una página incompleta.');
      }
      if(policy.mode==='convert')conversions.push({blockId:source.id,type,detail:policy.detail});
      if (type === 'heading_4') {
        type = 'heading_3';
      }
      if(type==='template')type='toggle';
      if(type==='child_page'){type='toggle';content={rich_text:[{type:'text',text:{content:content.title||'Subpágina'}}]};}
      if(type==='tab'){type='toggle';content={rich_text:[{type:'text',text:{content:'Pestañas'}}]};}
      if(insideTab&&type==='paragraph'&&content.icon)type='callout';
      if(type==='link_to_page'){const target=content[content.type];if(!['page_id','database_id','data_source_id'].includes(content.type)||typeof target!=='string'||!/^[a-f0-9-]{32,36}$/i.test(target)){if(tolerant){warnings.push('Un enlace de Notion ("'+currentLabel+'") no tenía destino válido y se omitió.');continue;}throw Error('Enlace de Notion sin destino válido.');}type='bookmark';content={url:'https://www.notion.so/'+target.replace(/-/g,'')};}
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
        if(!source.synced_block){
          if(tolerant){warnings.push('Un bloque sincronizado no devolvió contenido y se omitió.');continue;}
          throw Error('El synced_block no devolvió su contenido; revisa los permisos de lectura.');
        }
        const original=content.synced_from?.block_id||source.id;
        if(!original){
          if(tolerant){warnings.push('Un bloque sincronizado no tenía origen válido y se omitió.');continue;}
          throw Error('El synced_block de la plantilla no tiene un origen válido.');
        }
        nodes.push(...await read(original,depth+1,source.id));
        continue;
      }
      if (!fields[type]) {
        if (tolerant) {
          warnings.push('El elemento "' + currentLabel + '" (' + type + ') no se pudo duplicar y se omitió.');
          continue;
        }
        throw new Error('La plantilla contiene un bloque que aún no se puede copiar: ' + type + (content.block_type?' ('+content.block_type+')':'') + '. No se creó una página incompleta.');
      }

      const body: any = {};
      for (const key of fields[type]) {
        if (content[key] !== undefined) {
          body[key] = key === 'rich_text' || key === 'caption'
            ? rich(content[key], tolerant)
            : key === 'cells'
            ? content.cells.map((cell: any[]) => rich(cell, tolerant))
            : structuredClone(content[key]);
        }
      }

      const pendingNode: Node = {
        block: {object: 'block', type, [type]: body},
        children: []
      };

      if(type==='embed'){
        if(content.type==='file_upload'&&content.file_upload?.id){delete body.url;body.type='file_upload';body.file_upload={id:content.file_upload.id};}
        else {const url=content.file?.url||content.url;let html=false;try{const parsed=new URL(url);html=/\.html?$/i.test(parsed.pathname)&&/\.(amazonaws\.com|notion\.so|notion-static\.com|notion\.com)$/i.test(parsed.hostname);}catch{}
          if(content.type==='file'||html){validateNotionInternalUrl(url);delete body.url;body.type='file_upload';body.file_upload={id:'pending'};queueTransfer(source,async()=>{body.file_upload={id:await transfer(url,'file','embed.html')};},(reason)=>{droppedNodes.add(pendingNode);warnings.push('El elemento "'+currentLabel+'" ('+type+') no se pudo transferir ('+reason+') y se omitió.');});}
        }
      }
      if(body.icon?.type==='file'&&body.icon.file?.url){const url=body.icon.file.url;validateNotionInternalUrl(url);queueTransfer(source,async()=>{body.icon={type:'file_upload',file_upload:{id:await transfer(url,'image')}};},(reason)=>{delete body.icon;warnings.push('El ícono interno de "'+currentLabel+'" no se pudo copiar ('+reason+').');});}
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
          queueTransfer(source,async()=>{body.file_upload={id:await transfer(content.file.url,type,content.name)};},(reason)=>{droppedNodes.add(pendingNode);warnings.push('El archivo "'+currentLabel+'" ('+type+') no se pudo transferir ('+reason+') y se omitió.');});
          if (type === 'file' && typeof content.name === 'string') body.name = content.name;
        } else {
          if (tolerant) {
            warnings.push('El elemento "' + currentLabel + '" (' + type + ') no tiene URL o archivo válido y se omitió.');
            continue;
          }
          throw new Error('El archivo de la plantilla requiere transferencia o URL válida: ' + type);
        }
      }

      let children = (source.type !== 'child_database' && (source.has_children||source.type==='child_page'||source.type==='tab')) ? await read(source.id, depth + 1,undefined,source.type==='tab') : [];

      if(/^heading_[1-3]$/.test(type)&&children.length)body.is_toggleable=true;

      if (type === 'column_list') {
        const validCols = children.filter(n => n.block.type === 'column');
        if (tolerant && (validCols.length < 2 || validCols.length > 100 || validCols.length !== children.length)) {
          if (validCols.length > 0 && validCols.length <= 100) {
            warnings.push('Un bloque de columnas incompatibles se adaptó para conservar su contenido.');
            nodes.push(...validCols.flatMap(col => col.children));
          } else {
            warnings.push('Un bloque de columnas ("' + currentLabel + '") no se pudo duplicar y se omitió.');
          }
          continue;
        }
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
        const validRows = children.filter(n => n.block.type === 'table_row');
        if (tolerant && validRows.length !== children.length) {
          warnings.push('Se omitieron filas incompatibles dentro de una tabla.');
          children = validRows;
        }
        if (!children.length || children.some(n => n.block.type !== 'table_row')) {
          if (tolerant) {
            warnings.push('Una tabla vacía o incompatible ("' + currentLabel + '") se omitió.');
            continue;
          }
          throw new Error('La tabla de la plantilla no es compatible.');
        }
        // Notion requires an initial row. Append the remaining rows in batches
        // rather than putting the entire table into a single request.
        body.children = [children[0].block];
      }

      pendingNode.children = type === 'table' ? children.slice(1) : children;
      nodes.push(pendingNode);
      }catch(error){
        if (isAbortLike(settings, error)) throw error;
        const msg = error instanceof Error ? error.message : 'No se pudo preparar su contenido.';
        if (tolerant) {
          warnings.push('El elemento "' + currentLabel + '" no se pudo duplicar y se omitió: ' + msg);
          continue;
        }
        throw Error('Bloque '+source.id+' ('+source.type+'): '+msg);
      }
    }

    return nodes;
    } finally {seen.delete(key);}
  }

  const pruneDropped = (list: Node[]): Node[] => {
    const out: Node[] = [];
    for (const node of list) {
      if (droppedNodes.has(node)) continue;
      node.children = pruneDropped(node.children);
      if (node.block.type === 'column_list') {
        const validCols = node.children.filter(c => c.block.type === 'column');
        if (validCols.length < 2) {
          warnings.push('Una sección de columnas con archivos omitidos se adaptó para conservar los elementos restantes.');
          out.push(...validCols.flatMap(c => c.children));
          continue;
        }
        node.block.column_list.children = validCols.map(c => ({
          ...c.block,
          column: {
            ...c.block.column,
            children: [{object: 'block', type: 'paragraph', paragraph: {rich_text: []}}]
          }
        }));
      }
      out.push(node);
    }
    return out;
  };

  const nodes=await read(pageId, 0);
  if (!tolerant) {
    validateTemplateBody(nodes);
  }
  return {nodes,transfers,conversions,warnings,pruneDropped};
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
  const {nodes,transfers}=await planTemplateBody(settings,pageId,false);
  for(const run of transfers)await run();
  validateTemplateBody(nodes);
  return nodes;
}

export async function prepareTemplateBodyWithWarnings(settings:CalendarSettings,pageId:string):Promise<{nodes:Node[];warnings:string[]}>{
  const {nodes,transfers,warnings,pruneDropped}=await planTemplateBody(settings,pageId,true);
  for(const run of transfers)await run();
  const pruned = pruneDropped(nodes);
  const validNodes: Node[] = [];
  for (const node of pruned) {
    try {
      validateTemplateBody([node]);
      validNodes.push(node);
    } catch (error) {
      warnings.push('El elemento ' + summarizeNodeForWarning(node) + ' superó la validación previa y se omitió: ' + (error instanceof Error ? error.message : 'no compatible'));
    }
  }
  return {nodes: validNodes, warnings};
}

function sanitizeColumnListForAppend(block: any): any {
  if (block.type === 'column_list' && Array.isArray(block.column_list?.children)) {
    return {
      ...block,
      column_list: {
        ...block.column_list,
        children: block.column_list.children.map((col: any) => {
          if (col.type === 'column' && col.column) {
            const { width_ratio, ...restCol } = col.column;
            return { ...col, column: restCol };
          }
          return col;
        })
      }
    };
  }
  return block;
}

function summarizeNodeForWarning(node: Node): string {
  const type = String(node?.block?.type || 'bloque');
  const body = node?.block?.[type] || {};
  const text = Array.isArray(body.rich_text)
    ? body.rich_text.map((r: any) => r?.text?.content || r?.plain_text || '').join('')
    : '';
  const label = describeBlockLabel(type, text);
  return label === type ? type : '"' + label + '" (' + type + ')';
}

const blockCount=(block:any):number=>1+(block[block.type]?.children||[]).reduce((total:number,child:any)=>total+blockCount(child),0);

async function appendValidatedBatch(settings: CalendarSettings, pageId: string, batch: Node[], warnings?: string[]): Promise<void> {
  const sanitizedChildren = batch.map(n => sanitizeColumnListForAppend(n.block));
  const response = await notionRequest(settings, 'blocks/' + pageId + '/children', 'PATCH', {
    children: sanitizedChildren
  });

  if (response.results?.length !== batch.length || response.results.some((block:any)=>!block.id) || new Set(response.results.map((block:any)=>block.id)).size!==batch.length) {
    throw new Error('Notion no confirmó todos los bloques copiados.');
  }

  for (let i = 0; i < batch.length; i++) {
    const node = batch[i];
    const createdId = response.results[i].id;
    try {
      if (node.block.type === 'column_list') {
        const columns = await readBlocks(settings, createdId);
        if (columns.length !== node.children.length || columns.some((column: any) => column.type !== 'column')) {
          if (warnings) {
            warnings.push('Una columna no se confirmó al duplicar y pudo quedar incompleta.');
            continue;
          }
          throw new Error('Notion no confirmó todas las columnas copiadas.');
        }
        for (let c = 0; c < columns.length; c++) {
          const placeholders = await readBlocks(settings, columns[c].id);
          if (placeholders.length !== 1 || placeholders[0].type !== 'paragraph' || (placeholders[0].paragraph?.rich_text || []).length) {
            if (warnings) {
              warnings.push('No se pudo confirmar la estructura inicial de una columna y se conservó el resto.');
              continue;
            }
            throw new Error('No se pudo confirmar la estructura inicial de la columna.');
          }
          if (warnings) {
            const nested = await appendTemplateBodyWithWarnings(settings, columns[c].id, node.children[c].children);
            warnings.push(...nested.warnings);
            if (nested.appendedCount > 0) {
              await notionRequest(settings, 'blocks/' + placeholders[0].id, 'DELETE').catch(() => {});
            }
          } else {
            await appendTemplateBody(settings, columns[c].id, node.children[c].children);
            if (node.children[c].children.length) {
              await notionRequest(settings, 'blocks/' + placeholders[0].id, 'DELETE');
            }
          }
        }
      } else if (node.children.length) {
        if (warnings) {
          const nested = await appendTemplateBodyWithWarnings(settings, createdId, node.children);
          warnings.push(...nested.warnings);
        } else {
          await appendTemplateBody(settings, createdId, node.children);
        }
      }
    } catch (nestedError) {
      if (!warnings || isFatalNotionError(settings, nestedError)) throw nestedError;
      const reason = nestedError instanceof Error ? nestedError.message : 'No se pudo copiar contenido anidado.';
      warnings.push('Algunos elementos dentro de ' + summarizeNodeForWarning(node) + ' no se pudieron duplicar: ' + reason);
    }
  }
}

export async function appendTemplateBody(settings: CalendarSettings, pageId: string, nodes: Node[]) {
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

    await appendValidatedBatch(settings, pageId, nodes.slice(offset, end));
    offset = end;
  }
}

export async function appendTemplateBodyWithWarnings(
  settings: CalendarSettings,
  pageId: string,
  nodes: Node[]
): Promise<{ warnings: string[]; appendedCount: number }> {
  const warnings: string[] = [];
  let appendedCount = 0;

  for (let offset = 0; offset < nodes.length; ) {
    settings.notionSignal?.throwIfAborted();
    let end = offset;
    let bytes = 16, blocks = 0;
    while (end < nodes.length && end - offset < 100) {
      const size = Buffer.byteLength(JSON.stringify(nodes[end].block));
      const nested = blockCount(nodes[end].block);
      if (bytes + size + 1 > 450000 || blocks + nested > 1000) break;
      bytes += size + 1;
      blocks += nested;
      end++;
    }
    if (end === offset) {
      warnings.push('El elemento ' + summarizeNodeForWarning(nodes[offset]) + ' es demasiado grande y se omitió.');
      offset++;
      continue;
    }

    const batch = nodes.slice(offset, end);
    try {
      await appendValidatedBatch(settings, pageId, batch, warnings);
      appendedCount += batch.length;
    } catch (batchError) {
      if (isFatalNotionError(settings, batchError)) throw batchError;
      if (batch.length === 1) {
        const reason = batchError instanceof Error ? batchError.message : 'Error de Notion al copiar bloque.';
        warnings.push('El elemento ' + summarizeNodeForWarning(batch[0]) + ' no se pudo duplicar y se omitió: ' + reason);
      } else {
        for (const node of batch) {
          settings.notionSignal?.throwIfAborted();
          try {
            await appendValidatedBatch(settings, pageId, [node], warnings);
            appendedCount++;
          } catch (singleError) {
            if (isFatalNotionError(settings, singleError)) throw singleError;
            const reason = singleError instanceof Error ? singleError.message : 'No compatible con Notion.';
            warnings.push('El elemento ' + summarizeNodeForWarning(node) + ' no se pudo duplicar y se omitió: ' + reason);
          }
        }
      }
    }
    offset = end;
  }

  return { warnings, appendedCount };
}
