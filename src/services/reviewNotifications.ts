import {sendPwaPush} from './pwaPush';
import { notionRequest } from './notionMutations';
import { CalendarSettings, readBlocks } from './notionCalendar';
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
  const targetUrl = page.url || ('https://www.notion.so/' + String(page.id || '').replace(/-/g, ''));
  const originalLinkBlock = {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '🔗 ' } },
        { type: 'text', text: { content: 'Actividad original en Notion: ' }, annotations: { bold: true } },
        { type: 'text', text: { content: title || 'Abrir actividad', link: { url: targetUrl } }, annotations: { bold: true, color: 'blue', underline: true } }
      ]
    }
  };
  const message = (flow.State === 'returned' ? 'Correcciones solicitadas: ' + flow.Note : approved ? 'Revisión aprobada' : 'Actividad lista para revisión') + ' · ' + title;
  const stamp = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  const senderTitle = author.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  const alertTitle = stamp + ' ' + tag + ' de:' + senderTitle + ' [RESPUESTA] ' + message;
  const entry = {Kind:'System',AuthorTag:authorTag,AuthorName:author,RecipientTag:tag,RecipientName:recipient,CreatedAt:new Date().toISOString(),ReferenceEntryId:'',Text:message,Attachments:[]};
  const children = [originalLinkBlock, paragraph(message), hidden('[ANFETA_THREAD_V1]', entry)];
  if (flow.AlertPageId) {
    const existing = await notionRequest(settings,'pages/' + flow.AlertPageId);
    if (!existing.archived && !existing.in_trash) {
      const name = Object.entries(existing.properties || {}).find(([,p]:any) => p.type === 'title')?.[0];
      if (!name) throw new Error('El hilo de revisión no tiene título editable.');
      const existingUrlPropName = Object.entries(existing.properties || {}).find(([, p]: any) => p.type === 'url')?.[0];
      const patchProps: Record<string, any> = { [name]: { title: rich(alertTitle.slice(0, 2000)) } };
      if (existingUrlPropName) patchProps[existingUrlPropName] = { url: targetUrl };
      await notionRequest(settings, 'pages/' + existing.id, 'PATCH', { properties: patchProps });
      await notionRequest(settings, 'blocks/' + existing.id + '/children', 'PATCH', { children });
      await sendPwaPush(settings,recipient,{title:'ANFETA · Revisión',body:message,tag:'review:'+page.id}).catch(()=>console.warn('Aviso PWA no entregado; el aviso permanece en Notion.'));
      return {PageId:existing.id,PageUrl:existing.url || flow.AlertPageUrl};
    }
  }
  const source = sourceId(settings), schema = await notionRequest(settings,'data_sources/' + source);
  const sender = recipient.toLowerCase();
  const name = Object.entries(schema.properties || {}).find(([,p]:any) => p.type === 'title')?.[0];
  if (!name) throw new Error('No se encontró el título editable para crear la notificación.');
  const urlPropName = Object.entries(schema.properties || {}).find(([, p]: any) => p.type === 'url')?.[0];
  const createProps: Record<string, any> = { [name]: { title: rich(alertTitle) } };
  if (urlPropName) createProps[urlPropName] = { url: targetUrl };
  const created = await notionRequest(settings, 'pages', 'POST', {
    parent: { type: 'data_source_id', data_source_id: source },
    properties: createProps,
    children: [
      originalLinkBlock,
      hidden('[ANFETA_REVIEW_SOURCE_V1]', { PageId: page.id, PageUrl: targetUrl, Title: title }),
      paragraph(message),
      hidden('[ANFETA_THREAD_V1]', entry)
    ],
  });
  await sendPwaPush(settings,recipient,{title:'ANFETA · Revisión',body:message,tag:'review:'+page.id}).catch(()=>console.warn('Aviso PWA no entregado; el aviso permanece en Notion.'));
  return {PageId:created.id,PageUrl:created.url};
}
export async function listReviewNotifications(settings: CalendarSettings, person: string) {
  const recipient = normalizePerson(person), tag = recipient === 'Sotelo' ? 'eedua' : PERSON_ALIASES[recipient]?.[0];
  if (!tag) return [];
  const sender = recipient.toLowerCase();
  const source = sourceId(settings), schema = await notionRequest(settings,'data_sources/' + source);
  const name = Object.entries(schema.properties || {}).find(([,p]:any) => p.type === 'title')?.[0];
  if (!name) throw new Error('No se encontró la fuente de notificaciones.');
  const items:any[] = []; let cursor:string | undefined;
  do {
    const batch = await notionRequest(settings,'data_sources/' + source + '/query','POST',{page_size:100,...(cursor ? {start_cursor:cursor}:{}),filter:{and:[{property:name,title:{contains:'[RESPUESTA]'}},{or:[{property:name,title:{contains:tag + ' de:'}},{property:name,title:{contains:'de:' + sender + ' '}}]}]},sorts:[{timestamp:'last_edited_time',direction:'descending'}]});
    for (const p of batch.results || []) {
      const title = (p.properties?.[name]?.title || []).map((t:any) => t.plain_text || t.text?.content || '').join('');
      if (!p.archived && !p.in_trash && (title.includes(tag + ' de:') || title.includes('de:' + sender + ' ')) && /Actividad lista para revisión|Revisión aprobada|Correcciones solicitadas/i.test(title)) {
        const fullMessage = title.split('[RESPUESTA]')[1]?.trim() || title;
        const parts = fullMessage.split(' · ');
        const activityTitle = parts.length > 1 ? parts.slice(1).join(' · ').trim() : fullMessage;
        const actionLabel = parts.length > 1 ? parts[0].trim() : '';
        const urlProp = (Object.values(p.properties || {}).find((prop: any) => prop?.type === 'url' && prop?.url) as any)?.url;
        items.push({
          id: p.id,
          url: p.url,
          title: fullMessage,
          actionLabel,
          activityTitle,
          activityUrl: urlProp || '',
          updated: p.last_edited_time
        });
      }
    }
    const next = batch.has_more ? batch.next_cursor : undefined;
    if (batch.has_more && (!next || next === cursor)) throw new Error('No se pudo completar la carga de notificaciones.');
    cursor = next;
  } while(cursor);
  return items;
}

export async function readNotificationThread(settings:CalendarSettings,actor:string,id:string) {
  if(!/^[a-f0-9-]{32,36}$/i.test(id))throw new Error('Hilo inválido.');
  const page=await notionRequest(settings,'pages/'+id);
  const title=Object.values(page.properties || {}).filter((p:any)=>p.type==='title').flatMap((p:any)=>p.title || []).map((t:any)=>t.plain_text || t.text?.content || '').join('');
  const person=normalizePerson(actor),tag=person==='Sotelo'?'eedua':PERSON_ALIASES[person]?.[0], sender=person.toLowerCase();
  if(!tag || !title.includes('[RESPUESTA]') || (!title.includes(tag+' de:')&&!title.includes('de:'+sender+' ')))throw new Error('Este hilo no está dirigido a tu cuenta.');
  const entries:any[]=[];
  let sourceActivity: { PageId?: string; PageUrl?: string; Title?: string } | null = null;
  for(const block of await readBlocks(settings,id)) {
    const children=block.type==='toggle'&&block.has_children?await readBlocks(settings,block.id):[block];
    for(const child of children) {
      const text=(child.paragraph?.rich_text || []).map((t:any)=>t.plain_text || t.text?.content || '').join('');
      if(text.startsWith('[ANFETA_REVIEW_SOURCE_V1]')) {
        try { sourceActivity = JSON.parse(Buffer.from(text.slice('[ANFETA_REVIEW_SOURCE_V1]'.length),'base64').toString()); } catch {}
      }
      if(text.startsWith('[ANFETA_THREAD_V1]'))try{entries.push({...JSON.parse(Buffer.from(text.slice('[ANFETA_THREAD_V1]'.length),'base64').toString()),id:child.id});}catch{}
    }
  }
  if (!sourceActivity) {
    const fullMessage = title.split('[RESPUESTA]')[1]?.trim() || title;
    const parts = fullMessage.split(' · ');
    const actTitle = parts.length > 1 ? parts.slice(1).join(' · ').trim() : fullMessage;
    const urlProp = (Object.values(page.properties || {}).find((prop: any) => prop?.type === 'url' && prop?.url) as any)?.url;
    sourceActivity = { Title: actTitle, PageUrl: urlProp || '' };
  }
  return {page,title,sourceActivity,entries:entries.sort((a,b)=>Date.parse(a.CreatedAt)-Date.parse(b.CreatedAt))};
}
export async function replyNotification(settings:CalendarSettings,actor:string,id:string,text:string) {
  const thread=await readNotificationThread(settings,actor,id);
  if(!text?.trim() || text.length>1800)throw new Error('Escribe una respuesta de hasta 1800 caracteres.');
  if(thread.page.archived||thread.page.in_trash)throw new Error('El hilo ya está archivado.');
  const name=normalizePerson(actor),tag=PERSON_ALIASES[name]?.[0] || name;
  const last=thread.entries.filter(entry=>normalizePerson(entry.AuthorName)!==name).at(-1);
  const entry={Kind:'Message',AuthorTag:tag,AuthorName:name,RecipientTag:last?.AuthorTag || '',RecipientName:last?.AuthorName || '',CreatedAt:new Date().toISOString(),Text:text.trim(),ReferenceEntryId:last?.id || '',Attachments:[]};
  await notionRequest(settings,'blocks/'+id+'/children','PATCH',{children:[paragraph(name+': '+text.trim()),hidden('[ANFETA_THREAD_V1]',entry)]});
  return entry;
}
