import { notionRequest } from './notionMutations';
import { canEditActivity } from './activityPermissions';
import { normalizePerson, PERSON_ALIASES } from './identityNormalizer';

export type CalendarSettings = { notionToken: string; currentUser: string; notionDataSourceId?: string };
export const REVIEW_PREFIX = '[ANFETA_REVIEW_FLOW_V1]';
export const ASSIGNEE = /assignee|asignee|ejecutor|equipo weblab|persona|responsable|asignad/i;
export function calendarStatusField(page: any): [string, any] | undefined {
  const names = ['bien estado opcion multiple revisiones','estado opcion multiple revisiones','estado de trabajo','seguimiento estado proyecto','estado','status'];
  const canonical = (name: string) => name.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
  return Object.entries(page.properties || {}).filter(([name,p]: any) => ['status','select'].includes(p.type) && names.includes(canonical(name)))
    .sort(([a],[b]) => names.indexOf(canonical(a)) - names.indexOf(canonical(b)))[0] as [string,any] | undefined;
}
export function assignedField(page: any): [string, any] | undefined {
  return Object.entries(page.properties || {}).filter(([name, prop]: any) => ASSIGNEE.test(name) && ['people','select','rich_text'].includes(prop.type))
    .sort(([a], [b]) => Number(!/assignee|asignee|ejecutor/i.test(a)) - Number(!/assignee|asignee|ejecutor/i.test(b)))[0] as [string, any] | undefined;
}
export function assignedPerson(page: any, fallback = '') {
  const prop = assignedField(page)?.[1];
  if (!prop) return normalizePerson(fallback);
  const value = prop.type === 'people' ? (prop.people || []).map((p: any) => p.person?.email || p.name || '').join(', ') : prop.type === 'select' ? prop.select?.name : (prop.rich_text || []).map((t: any) => t.plain_text || t.text?.content || '').join('');
  return normalizePerson(value);
}
const flowCache = new Map<string, { edited: string; expires: number; flow: any }>();
export async function cachedReviewFlow(settings: CalendarSettings, page: any) {
  const key = settings.notionToken + ':' + page.id;
  const cached = flowCache.get(key);
  if (cached && cached.edited === page.last_edited_time && cached.expires > Date.now()) return cached.flow;
  const flow = await readReviewFlow(settings, page.id);
  if (flowCache.size >= 512) flowCache.delete(flowCache.keys().next().value!);
  flowCache.set(key,{edited:page.last_edited_time,expires:Date.now()+30000,flow});
  return flow;
}
const teamIds = new Map<string, Map<string, Set<string>>>();
function rememberPeople(settings: CalendarSettings, pages: any[]) {
  let directory = teamIds.get(settings.notionToken);
  if (!directory) { directory = new Map(); teamIds.set(settings.notionToken,directory); }
  for (const page of pages) for (const user of assignedField(page)?.[1]?.people || []) {
    const candidates = [normalizePerson(user.name),normalizePerson(user.person?.email)];
    const name = candidates.find(person => PERSON_ALIASES[person]);
    if (!name || !user.id) continue;
    const ids = directory.get(name) || new Set<string>(); ids.add(user.id); directory.set(name,ids);
  }
}
export async function resolveTeamPersonId(settings: CalendarSettings, person: string) {
  let ids = teamIds.get(settings.notionToken)?.get(person);
  if (!ids?.size) {
    // Workspace /users excludes guests. Resolve the actual People ids used by Revisiones.
    const source = process.env.NOTION_CALENDAR_DATA_SOURCE_ID || settings.notionDataSourceId || '2eeabd7d-91b7-8193-a131-000b08cd54e2';
    let cursor: string | undefined;
    do {
      const data = await notionRequest(settings,'data_sources/' + source + '/query','POST',{page_size:100,...(cursor ? {start_cursor:cursor} : {})});
      rememberPeople(settings, data.results || []);
      if (data.has_more && (!data.next_cursor || data.next_cursor === cursor)) throw new Error('No se pudo completar el directorio de asignación.');
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
    ids = teamIds.get(settings.notionToken)?.get(person);
  }
  if (ids && ids.size > 1) throw new Error('Hay varias cuentas de Notion para ' + person + '; configura NOTION_PERSON_IDS para elegir la correcta.');
  return ids?.values().next().value;
}
export async function queryCalendarPages(settings: CalendarSettings, start: string, end: string) {
  const source = process.env.NOTION_CALENDAR_DATA_SOURCE_ID || settings.notionDataSourceId || '2eeabd7d-91b7-8193-a131-000b08cd54e2';
  const schema = await notionRequest(settings, `data_sources/${source}`);
  const date = Object.entries(schema.properties || {}).find(([name,p]: any) => /^fecha por hacer$/i.test(name.trim()) && p.type === 'date');
  if (!date) throw new Error('La fuente de Revisiones no contiene la fecha editable «Fecha POR Hacer».');
  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const data = await notionRequest(settings, `data_sources/${source}/query`, 'POST', {
      page_size: 100, ...(cursor ? { start_cursor: cursor } : {}),
      filter: { and: [ { property: date[0], date: { on_or_after: start + 'T00:00:00-06:00' } }, { property: date[0], date: { before: end + 'T00:00:00-06:00' } } ] },
    });
    pages.push(...(data.results || []).filter((p: any) => !p.archived && !p.in_trash));
    if (data.has_more && (!data.next_cursor || data.next_cursor === cursor)) throw new Error('Notion devolvió una paginación incompleta.');
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  rememberPeople(settings,pages);
  return pages;
}
export async function readBlocks(settings: CalendarSettings, id: string) {
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const data = await notionRequest(settings, `blocks/${id}/children?page_size=100${cursor ? '&start_cursor=' + encodeURIComponent(cursor) : ''}`);
    blocks.push(...(data.results || []).filter((b: any) => !b.archived && !b.in_trash));
    if (data.has_more && (!data.next_cursor || data.next_cursor === cursor)) throw new Error('No se pudieron cargar todos los bloques de Notion.');
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}
export async function readChecklist(settings: CalendarSettings, pageId: string) {
  const items: { id: string; blockId: string; text: string; isChecked: boolean }[] = [];
  const visited = new Set<string>();
  async function walk(id: string, depth: number) {
    if (depth > 20) throw new Error('El checklist tiene demasiados niveles de anidación.');
    if (visited.has(id)) return;
    visited.add(id);
    for (const block of await readBlocks(settings, id)) {
      if (block.type === 'to_do') items.push({ id: block.id, blockId: block.id, text: (block.to_do.rich_text || []).map((t: any) => t.plain_text || t.text?.content || '').join('') || 'Tarea sin texto', isChecked: !!block.to_do.checked });
      const synced = block.synced_block?.synced_from?.block_id;
      if (synced || block.has_children) await walk(synced || block.id, depth + 1);
    }
  }
  await walk(pageId, 0);
  return items;
}
export async function readReviewFlow(settings: CalendarSettings, pageId: string) {
  let latest: any;
  for (const block of await readBlocks(settings, pageId)) {
    const children = block.type === 'toggle' && block.has_children ? await readBlocks(settings, block.id) : [block];
    for (const child of children) {
      const text = (child.paragraph?.rich_text || []).map((t: any) => t.plain_text || t.text?.content || '').join('');
      if (!text.startsWith(REVIEW_PREFIX)) continue;
      try {
        const flow = JSON.parse(Buffer.from(text.slice(REVIEW_PREFIX.length), 'base64').toString('utf8'));
        if (flow.OriginalPerson && flow.State && (!latest || Date.parse(flow.UpdatedAt) >= Date.parse(latest.UpdatedAt))) latest = flow;
      } catch { /* Ignore unrelated or damaged metadata; do not manufacture a flow. */ }
    }
  }
  return latest;
}
export async function saveReviewFlow(settings: CalendarSettings, pageId: string, flow: any) {
  const text = REVIEW_PREFIX + Buffer.from(JSON.stringify(flow)).toString('base64');
  const rich_text = [{ type: 'text', text: { content: text } }];
  await notionRequest(settings, `blocks/${pageId}/children`, 'PATCH', { children: [{ object:'block', type:'toggle', toggle: { rich_text:[{type:'text',text:{content:'Datos internos de ANFETA'}}], children:[{object:'block',type:'paragraph',paragraph:{rich_text}}] } }] });
}
export async function assertChecklistAccess(settings: CalendarSettings, actor: string, pageId: string) {
  if (!/^[a-f0-9-]{32,36}$/i.test(pageId || '')) throw new Error('Página de Notion inválida.');
  const page = await notionRequest(settings, `pages/${pageId}`);
  const title = Object.values(page.properties || {}).filter((p: any) => p.type === 'title').flatMap((p: any) => p.title || []).map((t: any) => t.plain_text || t.text?.content || '').join('');
  const inferred = title.match(/\b(jjohn|nneft|nnetf|kkarl|bbria|iisai|iisaia|aandr|ggena|ssote|aacal|eemma)(?:0{2,4}|00[1-3])?\b/i)?.[1];
  const locked = page.archived || page.in_trash || Object.entries(page.properties || {}).some(([name,p]: any) => /lock|bloquead/i.test(name) && p.type === 'checkbox' && p.checkbox);
  if (!canEditActivity(actor, { title, person: assignedPerson(page, inferred), isLocked: !!locked })) throw new Error('No puedes modificar esta actividad o está bloqueada.');
}
