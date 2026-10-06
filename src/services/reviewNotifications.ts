import { notionRequest } from './notionMutations';
import { CalendarSettings } from './notionCalendar';
import { normalizePerson, PERSON_ALIASES } from './identityNormalizer';
const sourceId = (s: CalendarSettings) => process.env.NOTION_CALENDAR_DATA_SOURCE_ID || s.notionDataSourceId || '2eeabd7d-91b7-8193-a131-000b08cd54e2';
const rich = (content: string) => (content.match(/[\s\S]{1,2000}/g) || ['']).map(part => ({type:'text',text:{content:part}}));
const paragraph = (content: string) => ({object:'block',type:'paragraph',paragraph:{rich_text:rich(content)}});
const hidden = (prefix: string, value: any) => ({object:'block',type:'toggle',toggle:{rich_text:rich('Datos internos de ANFETA'),children:[paragraph(prefix + Buffer.from(JSON.stringify(value)).toString('base64'))]}});
export async function sendReviewNotification(settings: CalendarSettings, page: any, flow: any, actor: string, approved = false) {
  const recipient = normalizePerson(approved ? flow.OriginalPerson : flow.ReviewAssignee);
  const tag = recipient === 'Sotelo' ? 'eedua' : PERSON_ALIASES[recipient]?.[0];
  if (!tag) throw new Error('No se pudo identificar al destinatario de la notificación.');
  const author = normalizePerson(approved ? actor : flow.OriginalPerson);
  const authorTag = PERSON_ALIASES[author]?.[0] || 'anfeta';
  const title = Object.values(page.properties || {}).filter((p:any) => p.type === 'title').flatMap((p:any) => p.title || []).map((t:any) => t.plain_text || t.text?.content || '').join('');
  const message = (approved ? 'Revisión aprobada' : 'Actividad lista para revisión') + ' · ' + title;
  const stamp = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  const senderTitle = author.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  const alertTitle = stamp + ' ' + tag + ' de:' + senderTitle + ' [RESPUESTA] ' + message;
  const entry = {Kind:'System',AuthorTag:authorTag,AuthorName:author,RecipientTag:tag,RecipientName:recipient,CreatedAt:new Date().toISOString(),ReferenceEntryId:'',Text:message,Attachments:[]};
  const children = [paragraph(message),hidden('[ANFETA_THREAD_V1]',entry)];
  if (flow.AlertPageId) {
    const existing = await notionRequest(settings,'pages/' + flow.AlertPageId);
    if (!existing.archived && !existing.in_trash) {
      const name = Object.entries(existing.properties || {}).find(([,p]:any) => p.type === 'title')?.[0];
      if (!name) throw new Error('El hilo de revisión no tiene título editable.');
      await notionRequest(settings,'pages/' + existing.id,'PATCH',{properties:{[name]:{title:rich(alertTitle.slice(0,2000))}}});
      await notionRequest(settings,'blocks/' + existing.id + '/children','PATCH',{children});
      return {PageId:existing.id,PageUrl:existing.url || flow.AlertPageUrl};
    }
  }
  const source = sourceId(settings), schema = await notionRequest(settings,'data_sources/' + source);
  const name = Object.entries(schema.properties || {}).find(([,p]:any) => p.type === 'title')?.[0];
  if (!name) throw new Error('No se encontró el título editable para crear la notificación.');
  const created = await notionRequest(settings,'pages','POST',{
    parent:{type:'data_source_id',data_source_id:source},properties:{[name]:{title:rich(alertTitle)}},
    children:[hidden('[ANFETA_REVIEW_SOURCE_V1]',{PageId:page.id,PageUrl:page.url || '',Title:title}),...children],
  });
  return {PageId:created.id,PageUrl:created.url};
}
export async function listReviewNotifications(settings: CalendarSettings, person: string) {
  const recipient = normalizePerson(person), tag = recipient === 'Sotelo' ? 'eedua' : PERSON_ALIASES[recipient]?.[0];
  if (!tag) return [];
  const source = sourceId(settings), schema = await notionRequest(settings,'data_sources/' + source);
  const name = Object.entries(schema.properties || {}).find(([,p]:any) => p.type === 'title')?.[0];
  if (!name) throw new Error('No se encontró la fuente de notificaciones.');
  const items:any[] = []; let cursor:string | undefined;
  do {
    const batch = await notionRequest(settings,'data_sources/' + source + '/query','POST',{page_size:100,...(cursor ? {start_cursor:cursor}:{}),filter:{and:[{property:name,title:{contains:'[RESPUESTA]'}},{property:name,title:{contains:tag + ' de:'}}]},sorts:[{timestamp:'last_edited_time',direction:'descending'}]});
    for (const p of batch.results || []) {
      const title = (p.properties?.[name]?.title || []).map((t:any) => t.plain_text || t.text?.content || '').join('');
      if (!p.archived && !p.in_trash && title.includes(tag + ' de:') && /Actividad lista para revisión|Revisión aprobada/i.test(title)) items.push({id:p.id,url:p.url,title:title.split('[RESPUESTA]')[1]?.trim() || title,updated:p.last_edited_time});
    }
    const next = batch.has_more ? batch.next_cursor : undefined;
    if (batch.has_more && (!next || next === cursor)) throw new Error('No se pudo completar la carga de notificaciones.');
    cursor = next;
  } while(cursor);
  return items;
}
