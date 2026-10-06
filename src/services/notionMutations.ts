import { canEditActivity, isActivityLocked, isDirection, isReviewer } from './activityPermissions';
import { normalizePerson, PERSON_ALIASES } from './identityNormalizer';
import { normalizeActivity } from './dataNormalizers';
import { workflowState } from './activityWorkflow';

type Settings = { notionToken: string; currentUser: string; notionDatabaseId?: string };
type Property = { type: string; [key: string]: any };
export function validateSchedule(start: string, end: string) {
  const format = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):00-06:00$/;
  const a = format.exec(start || ''), b = format.exec(end || '');
  if (!a || !b || start.slice(0,10) !== end.slice(0,10) || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || new Date(start).toISOString().slice(0,10) !== start.slice(0,10) || Date.parse(end) <= Date.parse(start)) throw new Error('Fecha u horario inválidos.');
  const am = Number(a[1])*60+Number(a[2]), bm = Number(b[1])*60+Number(b[2]);
  if (am < 480 || bm > 1320 || am % 15 || bm % 15) throw new Error('El horario debe usar bloques de 15 minutos entre 08:00 y 22:00.');
}
export async function notionRequest(settings: Settings, endpoint: string, method = 'GET', body?: any) {
  if (!settings.notionToken.trim()) throw new Error('Configura el token de Notion para guardar cambios.');
  const res = await fetch(`https://api.notion.com/v1/${endpoint}`, { method, headers: { Authorization: `Bearer ${settings.notionToken.trim()}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const data = await res.json(); if (!res.ok) throw new Error(data.message || `Notion respondió ${res.status}`); return data;
}
function titleOf(page: any) { return Object.values(page.properties || {}).filter((p: any) => p.type === 'title').flatMap((p: any) => p.title || []).map((t: any) => t.plain_text || t.text?.content || '').join(''); }
function personOf(page: any, fallback: string) {
  const fields = Object.entries(page.properties || {}) as [string, Property][];
  const assigned = fields.find(([name, prop]) => /persona|responsable|asignad/i.test(name) && ['people','select','rich_text'].includes(prop.type));
  if (!assigned) return fallback;
  const prop = assigned[1];
  if (prop.type === 'people') return (prop.people || []).map((p: any) => p.name || '').join(', ');
  if (prop.type === 'select') return prop.select?.name || '';
  return (prop.rich_text || []).map((t: any) => t.plain_text || t.text?.content || '').join('');
}
export async function mutateActivity(settings: Settings, actor: string, id: string, updates: any, cached?: any) {
  if (!id || !/^[a-f0-9-]{32,36}$/i.test(id)) throw new Error('Identificador de Notion inválido.');
  const page = await notionRequest(settings, `pages/${id}`);
  const title = titleOf(page);
  const locks = Object.entries(page.properties || {}).some(([name, prop]: any) => /lock|bloquead/i.test(name) && prop.type === 'checkbox' && prop.checkbox);
  const inferred = title.match(/\b(jjohn|nneft|nnetf|kkarl|bbria|iisai|iisaia|aandr|ggena|ssote|aacal|eemma)(?:0{2,4}|00[1-3])?\b/i)?.[1] || '';
  const activity = { ...cached, title, person: personOf(page, inferred || cached?.person || ''), isLocked: locks || isActivityLocked(cached || {}) };
  if (!canEditActivity(actor, activity)) throw new Error('Solo el responsable asignado puede modificar esta actividad; las actividades bloqueadas no admiten cambios.');
  const properties: Record<string, any> = {};
  const fields = Object.entries(page.properties || {}) as [string, Property][];

  // Reasignación o Envío a Revisión
  if (updates.person || updates.reviewer) {
    const target = updates.reviewer || updates.person;
    const isSendingToReview = !!updates.reviewer || updates.status === 'rtuzREVISION' || updates.status === 'EN REVISIÓN';
    if (!isDirection(actor) && !isReviewer(actor) && !isSendingToReview) {
      throw new Error('Solo Dirección o el responsable al enviar a revisión puede reasignar actividades.');
    }
    const person = normalizePerson(target);
    if (!PERSON_ALIASES[person]) throw new Error('Selecciona un responsable válido del equipo.');
    const personField = fields.find(([name,p]) => /persona|responsable|asignad/i.test(name) && ['people','select','rich_text'].includes(p.type));
    if (personField) {
      const [name, prop] = personField;
      if (prop.type === 'people') {
        const ids = JSON.parse(process.env.NOTION_PERSON_IDS || '{}'); const id = ids[PERSON_ALIASES[person][0]] || ids[person];
        if (id) properties[name] = { people: [{ id }] };
      } else properties[name] = prop.type === 'select' ? { select: { name: person } } : { rich_text: [{ text: { content: person } }] };
    }
    const titleField = fields.find(([,p]) => p.type === 'title');
    if (titleField) {
      const ownerToken = /\b(?:jjohn|nneft|nnetf|kkarl|bbria|iisai|iisaia|aandr|ggena|ssote|aacal|eemma)(?:0{2,4}|00[1-3])?\b/i;
      const tag = PERSON_ALIASES[person][0];
      let nextTitle = ownerToken.test(title) ? title.replace(ownerToken, tag) : `${tag} ${title}`;
      if (isSendingToReview) {
        // En ANFETA original: prefijo rtuzREVISION al enviar a revisión
        nextTitle = nextTitle.replace(/^(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\s*/i, '');
        nextTitle = `rtuzREVISION ${nextTitle.trim()}`;
      }
      properties[titleField[0]] = { title: [{ text: { content: nextTitle } }] };
    }
  }
  if (updates.start) {
    validateSchedule(updates.start, updates.end);
    const date = fields.find(([name, p]) => p.type === 'date' && /fecha.*hacer|program|schedule/i.test(name)) || fields.find(([,p]) => p.type === 'date');
    if (!date) throw new Error('La página no tiene una propiedad de fecha editable.');
    properties[date[0]] = { date: { start: updates.start, end: updates.end } };
  }
  if (updates.status) {
    const status = fields.find(([name,p]) => /estado|status/i.test(name) && ['status','select'].includes(p.type));
    if (!status) throw new Error('No se encontró la propiedad Estado de Notion.');
    let desired = updates.status;
    if (page.parent?.database_id) {
      const schema = await notionRequest(settings, `databases/${page.parent.database_id}`);
      const options: { name: string }[] = schema.properties?.[status[0]]?.[status[1].type]?.options || [];
      const exact = options.find(option => option.name.toLowerCase() === desired.toLowerCase());
      const state = workflowState(desired);
      const equivalent = state !== 'unknown' ? options.find(option => workflowState(option.name) === state) : undefined;
      if (exact || equivalent) desired = (exact || equivalent)!.name;
      else if (status[1].type === 'status' && options.length) throw new Error('Ese estado no está disponible en la base de Notion.');
    }
    properties[status[0]] = { [status[1].type]: { name: desired } };

    // En ANFETA original: actualizar el prefijo del título (rtuzREVISION o zREVISION)
    const titleField = fields.find(([,p]) => p.type === 'title');
    if (titleField && !properties[titleField[0]]) {
      if (desired === 'rtuzREVISION' || updates.status === 'rtuzREVISION') {
        const clean = title.replace(/^(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\s*/i, '');
        properties[titleField[0]] = { title: [{ text: { content: `rtuzREVISION ${clean.trim()}` } }] };
      } else if (desired === 'zREVISION' || updates.status === 'zREVISION' || workflowState(desired) === 'completed') {
        const clean = title.replace(/^(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\s*/i, '');
        properties[titleField[0]] = { title: [{ text: { content: `zREVISION ${clean.trim()}` } }] };
      }
    }
  }
  if (updates.isUrgent !== undefined) {
    const titleProp = fields.find(([,p]) => p.type === 'title');
    if (!titleProp) throw new Error('No se encontró el título de Notion.');
    const nextTitle = updates.isUrgent ? `${title.replace(/\s+00$/, '')} 00` : title.replace(/\s+00$/, '');
    properties[titleProp[0]] = { title: [{ text: { content: nextTitle } }] };
  }
  if (!Object.keys(properties).length) throw new Error('No hay cambios válidos para guardar.');
  return notionRequest(settings, `pages/${id}`, 'PATCH', { properties });
}
export async function createActivity(settings: Settings, actor: string, payload: any) {
  const { start, end, domain, person, title } = payload;
  if (start) validateSchedule(start, end);
  if (!title?.trim()) throw new Error('Escribe un título.');
  if (person && !isDirection(actor) && normalizePerson(actor) !== normalizePerson(person)) throw new Error('Solo puedes crear actividades asignadas a ti.');
  let databaseId = process.env.NOTION_DATABASE_ID || settings.notionDatabaseId;
  const referencedId = String(payload.body || '').match(/https?:\/\/(?:www\.)?notion\.(?:so|site)\/[^\s]*?([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?:[?\s/#]|$)/i)?.[1];
  if (!databaseId && referencedId) {
    try { const source = await notionRequest(settings, `pages/${referencedId}`); databaseId = source.parent?.database_id; }
    catch { const source = await notionRequest(settings, `databases/${referencedId}`); databaseId = source.id; }
  }
  if (!databaseId) throw new Error('Configura NOTION_DATABASE_ID o notionDatabaseId para crear páginas en Notion.');
  const database = await notionRequest(settings, `databases/${databaseId}`);
  const fields = Object.entries(database.properties || {}) as [string, Property][];
  const titleField = fields.find(([,p]) => p.type === 'title');
  if (!titleField) throw new Error('La base no tiene propiedad de título.');
  const composed = [domain, person, title.trim()].filter(Boolean).join(' ');
  const properties: Record<string, any> = { [titleField[0]]: { title: [{ text: { content: composed } }] } };
  if (start) {
    const dateField = fields.find(([n,p]) => p.type === 'date' && /hacer|program|schedule/i.test(n)) || fields.find(([,p]) => p.type === 'date');
    if (!dateField) throw new Error('La base no tiene fecha programada.');
    properties[dateField[0]] = { date: { start, end } };
  }
  const personField = fields.find(([n,p]) => /persona|responsable|asignad/i.test(n) && ['select','rich_text','people'].includes(p.type));
  if (person && personField) {
    const [name, prop] = personField;
    if (prop.type === 'people') {
      const mapping = JSON.parse(process.env.NOTION_PERSON_IDS || '{}');
      if (!mapping[person]) throw new Error(`Configura NOTION_PERSON_IDS para el responsable ${person}.`);
      properties[name] = { people: [{ id: mapping[person] }] };
    } else properties[name] = prop.type === 'select' ? { select: { name: normalizePerson(person) } } : { rich_text: [{ text: { content: person } }] };
  }
  const domainField = fields.find(([n,p]) => /dominio|domain/i.test(n) && ['select','rich_text'].includes(p.type));
  if (domain && domainField) properties[domainField[0]] = domainField[1].type === 'select' ? { select: { name: domain } } : { rich_text: [{ text: { content: domain } }] };
  const children: any[] = [];
  if (payload.body) children.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: payload.body.slice(0,2000) } }] } });
  for (const file of payload.files || []) {
    if (!file.filename || !file.base64 || Buffer.byteLength(file.base64, 'base64') > 20 * 1024 * 1024) throw new Error('Cada adjunto de Notion debe tener nombre y pesar como máximo 20 MB.');
    const upload = await notionRequest(settings, 'file_uploads', 'POST', { mode: 'single_part', filename: file.filename, content_type: file.contentType || /^data:([^;]+);/.exec(file.dataUrl || '')?.[1] || 'application/octet-stream' });
    const form = new FormData(); form.append('file', new Blob([Buffer.from(file.base64, 'base64')], { type: file.contentType || 'application/octet-stream' }), file.filename);
    const res = await fetch(`https://api.notion.com/v1/file_uploads/${upload.id}/send`, { method: 'POST', headers: { Authorization: `Bearer ${settings.notionToken.trim()}`, 'Notion-Version': '2022-06-28' }, body: form, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error('Notion rechazó el archivo adjunto.');
    children.push({ object: 'block', type: 'file', file: { type: 'file_upload', file_upload: { id: upload.id } } });
  }
  const page = await notionRequest(settings, 'pages', 'POST', { parent: { database_id: databaseId }, properties, children });
  return { page, activity: normalizeActivity({ pageId: page.id, pageUrl: page.url, title: composed, person: normalizePerson(person || actor), domain, start, end }, 0) };
}
