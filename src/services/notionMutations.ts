import {editActivityDescription} from './activityTitleEdit';
import {reviewTitle} from './reviewTitle';
import { sendReviewNotification } from './reviewNotifications';
import { resolveTeamPersonId, clearReadBlocksCache, calendarStatusField, assignedField, assignedPerson, readReviewFlow, saveReviewFlow, cacheReviewFlowMemory } from './notionCalendar';
import { canEditActivity, isActivityLocked, isDirection, isReviewer } from './activityPermissions';
import { normalizePerson, PERSON_ALIASES } from './identityNormalizer';
import { normalizeActivity } from './dataNormalizers';
import { mexicoDate } from './calendarPresentation';
import { workflowState } from './activityWorkflow';

type Settings = { notionToken: string; currentUser: string; notionApiVersion?: string; notionDatabaseId?: string; notionDataSourceId?: string };
type Property = { type: string; [key: string]: any };
export function validateSchedule(start: string, end: string) {
  const format = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):00-06:00$/;
  const a = format.exec(start || ''), b = format.exec(end || '');
  if (!a || !b || start.slice(0,10) !== end.slice(0,10) || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || mexicoDate(start) !== start.slice(0,10) || Date.parse(end) <= Date.parse(start)) throw new Error('Fecha u horario inválidos.');
  const am = Number(a[1])*60+Number(a[2]), bm = Number(b[1])*60+Number(b[2]);
  if (am < 480 || bm > 1320 || am % 15 || bm % 15) throw new Error('El horario debe usar bloques de 15 minutos entre 08:00 y 22:00.');
}
const requestPace = new Map<string, Promise<void>>();
const nextRequestAt = new Map<string, number>();
async function paceNotion(token:string) {
  const prior=requestPace.get(token) || Promise.resolve();
  const turn=prior.then(async()=>{const wait=Math.max(0,(nextRequestAt.get(token)||0)-Date.now());if(wait)await new Promise(resolve=>setTimeout(resolve,wait));nextRequestAt.set(token,Date.now()+350);});
  requestPace.set(token,turn);await turn;if(requestPace.get(token)===turn)requestPace.delete(token);
  if(nextRequestAt.size>128)nextRequestAt.delete(nextRequestAt.keys().next().value!);
}
export async function notionRequest(settings: Settings, endpoint: string, method = 'GET', body?: any, attempt = 0): Promise<any> {
  if (!settings.notionToken.trim()) throw new Error('Configura el token de Notion para guardar cambios.');
  await paceNotion(settings.notionToken);
  const res = await fetch(`https://api.notion.com/v1/${endpoint}`, { method, headers: { Authorization: `Bearer ${settings.notionToken.trim()}`, 'Notion-Version': settings.notionApiVersion || ((endpoint.startsWith('data_sources/') || body?.parent?.data_source_id) ? '2026-03-11' : '2022-06-28'), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  if (res.status === 429 && attempt < 3) {
    const wait = Math.min(10, Math.max(1, Number(res.headers.get('retry-after')) || 1));
    nextRequestAt.set(settings.notionToken,Date.now()+wait*1000);
    await new Promise(resolve => setTimeout(resolve, wait * 1000));
    return notionRequest(settings, endpoint, method, body, attempt + 1);
  }
  const text = await res.text(); let data:any; try {data=JSON.parse(text);} catch {throw new Error('Notion devolvió una respuesta no válida (HTTP ' + res.status + '). Intenta de nuevo en unos segundos.');} if (!res.ok) throw new Error(data.message || `Notion respondió ${res.status}`); if(method === 'PATCH' || method === 'DELETE' || (method === 'POST' && endpoint === 'pages')) clearReadBlocksCache(settings); return data;
}
function titleOf(page: any) { return Object.values(page.properties || {}).filter((p: any) => p.type === 'title').flatMap((p: any) => p.title || []).map((t: any) => t.plain_text || t.text?.content || '').join(''); }
const mutationLocks = new Set<string>();
export async function mutateActivity(settings: Settings, actor: string, id: string, updates: any, cached?: any) {
  const key = settings.notionToken + ':' + id;
  if (mutationLocks.has(key)) throw new Error('La actividad se está guardando; espera antes de reenviarla.');
  mutationLocks.add(key);
  try { return await mutateActivityUnlocked(settings, actor, id, updates, cached); }
  finally {mutationLocks.delete(key);}
}
async function mutateActivityUnlocked(settings: Settings, actor: string, id: string, updates: any, cached?: any) {
  if (!id || !/^[a-f0-9-]{32,36}$/i.test(id)) throw new Error('Identificador de Notion inválido.');
  const page = await notionRequest(settings, `pages/${id}`);
  const title = titleOf(page);
  const locks = Object.entries(page.properties || {}).some(([name, prop]: any) => /lock|bloquead/i.test(name) && prop.type === 'checkbox' && prop.checkbox);
  const inferred = title.match(/\b(jjohn|nneft|nnetf|kkarl|bbria|iisai|iisaia|aandr|ggena|ssote|aacal|eemma)(?:0{2,4}|00[1-3])?\b/i)?.[1] || '';
  const activity = { ...cached, title, person: assignedPerson(page, inferred || cached?.person || ''), isLocked: locks || isActivityLocked(cached || {}) };
  if (!canEditActivity(actor, activity)) throw new Error('Solo el responsable asignado puede modificar esta actividad; las actividades bloqueadas no admiten cambios.');
  if ((updates.start || updates.end) && /(?<![\p{L}\p{Nd}_])zREVISION(?![\p{L}\p{Nd}_])/iu.test(title+' '+(calendarStatusField(page)?.[1]?.[calendarStatusField(page)?.[1]?.type]?.name || ''))) throw new Error('La fecha de zREVISION es histórica. Reasigna primero la actividad a una fase activa antes de cambiar su horario.');
  const returned = updates.reviewAction === 'return';
  const reassigned = updates.reviewAction === 'reassign';
  if (returned) updates = {...updates,status:'prtuzREVISION'};
  if (reassigned) updates = {...updates,status:'prtuzREVISION'};
  if (updates.status && workflowState(updates.status) === 'review' && !updates.reviewer) throw new Error('Selecciona a quién enviar la actividad en el modal de revisión.');
  const completed = updates.status && workflowState(updates.status) === 'completed';
  if (completed && !isReviewer(actor)) throw new Error('Solo John, Isaías o Genaro pueden terminar una revisión.');
  const previousFlow = updates.reviewer || completed || returned || reassigned ? await readReviewFlow(settings, id) : undefined;
  if ((returned || completed) && previousFlow?.State === 'pending' && normalizePerson(actor) !== normalizePerson(previousFlow.ReviewAssignee)) throw new Error('Solo el revisor asignado puede aprobar o devolver esta revisión.');
  if (returned && (!previousFlow || previousFlow.State !== 'pending')) throw new Error('La actividad no tiene una revisión pendiente.');
  if (returned && !String(updates.note || '').trim()) throw new Error('Describe las correcciones solicitadas.');
  if (reassigned && (previousFlow?.State !== 'approved' || !isReviewer(actor))) throw new Error('Solo un revisor puede reasignar una actividad aprobada.');
  if ((completed || returned) && previousFlow?.OriginalPerson) updates = { ...updates, person: previousFlow.OriginalPerson };
  let reviewFlow: any;
  if(updates.expectedTitle!==undefined&&updates.expectedTitle!==title)throw new Error('El nombre cambió desde que abriste el editor. Actualiza la actividad antes de guardar.');
  if(updates.titleDescription!==undefined)updates={...updates,title:editActivityDescription(title,String(updates.titleDescription))};
  let nextTitle = title;
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
    if (updates.reviewer && !['John','Isaias','Genaro'].includes(person)) throw new Error('Selecciona a John, Isaías o Genaro como revisor.');
    const clearing = (completed || returned) && person === 'Sin asignar';
    const restoring = (completed || returned) && previousFlow?.OriginalAssigneeUserId;
    if (!PERSON_ALIASES[person] && !clearing && !restoring) throw new Error('Selecciona un responsable válido del equipo.');
    const personField = assignedField(page);
    if (!personField) throw new Error('No se encontró la propiedad editable de persona asignada en Notion.');
    if (personField) {
      const [name, prop] = personField;
      if (prop.type === 'people' && clearing) properties[name] = {people:[]};
      else if (prop.type === 'people') {
        const ids = JSON.parse(process.env.NOTION_PERSON_IDS || '{}');
        let userId = (completed || returned) && previousFlow?.OriginalAssigneeUserId || ids[PERSON_ALIASES[person]?.[0] || person] || ids[person];
        if (!userId) userId = await resolveTeamPersonId(settings, person);
        if (!userId) {
          let cursor: string | undefined;
          do {
            const users = await notionRequest(settings, 'users?page_size=100' + (cursor ? '&start_cursor=' + encodeURIComponent(cursor) : ''));
            const matches = (users.results || []).filter((u: any) => u.type === 'person' && (normalizePerson(u.name) === person || normalizePerson(u.person?.email) === person));
            if (matches.length > 1) throw new Error('Hay varias personas de Notion con ese nombre; configura NOTION_PERSON_IDS.');
            userId = matches[0]?.id;
            cursor = users.has_more ? users.next_cursor : undefined;
          } while (!userId && cursor);
        }
        if (!userId) throw new Error('No se pudo resolver la cuenta real de Notion para ' + person + '. Configura NOTION_PERSON_IDS.');
        properties[name] = { people: [{ id: userId }] };
      } else properties[name] = prop.type === 'select' ? { select: clearing ? null : { name:person } } : {rich_text:clearing ? [] : [{text:{content:person}}]};
    }
    const titleField = fields.find(([,p]) => p.type === 'title');
    if (titleField) {
      const ownerCodes = (PERSON_ALIASES[normalizePerson(activity.person)] || []).filter(alias => /^(.)\1/.test(alias));
      const ownerToken = ownerCodes.length ? new RegExp('\\b(?:' + ownerCodes.join('|') + ')(?:0{2,4}|00[1-3])?\\b','i') : null;
      const tag = PERSON_ALIASES[person]?.[0] || '';
      const baseTitle = isSendingToReview || completed || returned || reassigned ? title.replace(/^(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\s*/i, '') : title;
      nextTitle = ownerToken?.test(baseTitle) ? baseTitle.replace(ownerToken, () => tag) : tag ? tag + ' ' + baseTitle : baseTitle;
      if (isSendingToReview) {
        // En ANFETA original: prefijo rtuzREVISION al enviar a revisión
        nextTitle = nextTitle.replace(/^(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\s*/i, '');
        nextTitle = `rtuzREVISION ${nextTitle.trim()}`;
      }
      properties[titleField[0]] = { title: [{ text: { content: nextTitle } }] };
    }
  }
  if (updates.title !== undefined) {
    if (!String(updates.title).trim() || String(updates.title).length > 1800) throw new Error('El título debe tener entre 1 y 1800 caracteres.');
    const field = fields.find(([,p])=>p.type === 'title');
    if (!field) throw new Error('No se encontró el título editable.');
    properties[field[0]] = {title:[{text:{content:String(updates.title).trim()}}]};
  }
  if (updates.start) {
    validateSchedule(updates.start, updates.end);
    const date = fields.find(([name,p]) => p.type === 'date' && /^fecha por hacer$/i.test(name.trim()));
    if (!date) throw new Error('La página no tiene una propiedad de fecha editable.');
    if((updates.expectedStart && date[1].date?.start !== updates.expectedStart)||(updates.expectedEnd && date[1].date?.end !== updates.expectedEnd)) throw new Error('El horario cambió desde que se preparó la propuesta; actualiza antes de moverla.');
    properties[date[0]] = { date: { start: updates.start, end: updates.end } };
  }
  if (updates.status) {
    const status = calendarStatusField(page);
    if (!status) throw new Error('No se encontró la propiedad Estado de Notion.');
    let desired = updates.status;
    if (page.parent?.data_source_id || page.parent?.database_id) {
      const schema = await notionRequest(settings, page.parent?.data_source_id ? `data_sources/${page.parent.data_source_id}` : `databases/${page.parent.database_id}`);
      const options: { name: string }[] = schema.properties?.[status[0]]?.[status[1].type]?.options || [];
      const exact = options.find(option => option.name.toLowerCase() === desired.toLowerCase());
      const state = workflowState(desired);
      const equivalent = state !== 'unknown' ? options.find(option => workflowState(option.name) === state) : undefined;
      if (exact || equivalent) desired = (exact || equivalent)!.name;
      else if (options.length) throw new Error('Ese estado no está disponible en la base de Notion.');
    }
    properties[status[0]] = { [status[1].type]: { name: desired } };

    // Compose the phase after reassignment, preserving the remaining description.
    const titleField = fields.find(([,p]) => p.type === 'title');
    if (titleField) {
      const currentTitle = (properties[titleField[0]]?.title || []).map((t: any) => t.text?.content || "").join("") || title;
      if (desired === 'rtuzREVISION' || updates.status === 'rtuzREVISION') {
        const clean = currentTitle.replace(/^(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\s*/i, '');
        properties[titleField[0]] = { title: [{ text: { content: `rtuzREVISION ${clean.trim()}` } }] };
      } else if (['pending','suspended'].includes(workflowState(desired))) {
        const clean = currentTitle.replace(/^(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\s*/i, '');
        properties[titleField[0]] = {title:[{text:{content:(workflowState(desired) === 'suspended' ? 'sprtuzREVISION ' : 'prtuzREVISION ') + clean.trim()}}]};
      } else if (desired === 'zREVISION' || updates.status === 'zREVISION' || workflowState(desired) === 'completed') {
        const clean = currentTitle.replace(/^(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\s*/i, '');
        properties[titleField[0]] = { title: [{ text: { content: `zREVISION ${clean.trim()}` } }] };
      }
    }
  }
  if (updates.reviewer || ((completed || returned) && previousFlow)) {
    const field=fields.find(([,p])=>p.type==='title');
    if(field){
      // Compose from the original title: generic reassignment must not remove author/suffix tags.
      const source=updates.title!==undefined?String(updates.title):title;
      properties[field[0]]={title:[{text:{content:reviewTitle(source,previousFlow?.OriginalPerson||activity.person,updates.reviewer||previousFlow.ReviewAssignee,returned?'returned':completed?'approved':'pending')}}]};
    }
  }
  if (updates.isUrgent !== undefined) {
    const titleProp = fields.find(([,p]) => p.type === 'title');
    if (!titleProp) throw new Error('No se encontró el título de Notion.');
    nextTitle = (properties[titleProp[0]]?.title || []).map((t: any) => t.text?.content || '').join('') || nextTitle;
    nextTitle = updates.isUrgent ? `${nextTitle.replace(/\s+00$/, '')} 00` : nextTitle.replace(/\s+00$/, '');
    properties[titleProp[0]] = { title: [{ text: { content: nextTitle } }] };
  }
  if (!Object.keys(properties).length) throw new Error('No hay cambios válidos para guardar.');
  if (updates.reviewer || ((completed || returned || reassigned) && previousFlow)) {
    const field = assignedField(page);
    reviewFlow = { ...previousFlow,
      OriginalPerson: reassigned ? normalizePerson(updates.person) : previousFlow?.OriginalPerson || activity.person,
      ReviewAssignee: updates.reviewer ? normalizePerson(updates.reviewer) : previousFlow.ReviewAssignee,
      OriginalAssigneeUserId: reassigned && field ? properties[field[0]]?.people?.[0]?.id || '' : previousFlow?.OriginalAssigneeUserId || (field?.[1].type === 'people' ? field[1].people?.[0]?.id : '') || '',
      ReviewAssigneeUserId: updates.reviewer && field ? properties[field[0]]?.people?.[0]?.id || '' : previousFlow?.ReviewAssigneeUserId || '',
      State: returned ? 'returned' : reassigned ? 'reassigned' : completed ? 'approved' : 'pending', SubmittedAt: previousFlow?.SubmittedAt || new Date().toISOString(),
      UpdatedAt: new Date().toISOString(), UpdatedBy: actor, Note: returned ? String(updates.note).trim() : reassigned ? 'Reasignada para continuar trabajo.' : completed ? 'Revisión terminada desde ANFETA web.' : 'Enviada a revisión desde ANFETA web.',
      LeaveVisualCopy: updates.reviewer ? updates.leaveVisualCopy !== false : previousFlow?.LeaveVisualCopy,
      AlertPageId: previousFlow?.AlertPageId || '', AlertPageUrl: previousFlow?.AlertPageUrl || '',
    };
  }
  const updated = await notionRequest(settings, 'pages/' + id, 'PATCH', { properties });
  if (updates.start) {
    const old:any = fields.find(([name,p])=>p.type === 'date' && /^fecha por hacer$/i.test(name.trim()))?.[1]?.date;
    if(old?.start !== updates.start || old?.end !== updates.end) {
      try {
        const text='[ANFETA_WEB_MOVE_V1]'+Buffer.from(JSON.stringify({fromStart:old?.start,fromEnd:old?.end,toStart:updates.start,toEnd:updates.end,updatedAt:new Date().toISOString(),updatedBy:actor})).toString('base64');
        await notionRequest(settings,'blocks/'+id+'/children','PATCH',{children:[{object:'block',type:'toggle',toggle:{rich_text:[{text:{content:'Datos internos de ANFETA'}}],children:[{object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:text}}]}}]}}]});
      } catch(error) {updated.__historyWarning='El horario se guardó, pero no se pudo guardar su historial. '+(error instanceof Error?error.message:'');}
    }
  }
  if (reviewFlow) {
    cacheReviewFlowMemory(settings, id, reviewFlow, page.last_edited_time);
    try { await saveReviewFlow(settings, id, reviewFlow); }
    catch (error) {
      // Notion has no transaction across a page and its blocks. Restore the page if metadata fails.
      const restore: Record<string, any> = {};
      for (const name of Object.keys(properties)) {
        const p: any = page.properties[name];
        if (p.type === 'title' || p.type === 'rich_text') restore[name] = { [p.type]: (p[p.type] || []).map((t: any) => ({ type:'text', text:{content:t.plain_text || t.text?.content || ''} })) };
        else if (p.type === 'people') restore[name] = { people: (p.people || []).map((u: any) => ({id:u.id})) };
        else restore[name] = { [p.type]: p[p.type] };
      }
      try { await notionRequest(settings, 'pages/' + id, 'PATCH', { properties:restore }); }
      catch { throw new Error('Notion guardó parte del cambio, pero no el flujo de revisión. Actualiza el calendario y revisa la actividad antes de volver a enviarla.'); }
      throw new Error('No se guardó el flujo de revisión; se restauró la actividad. ' + (error instanceof Error ? error.message : ''));
    }
    if (updates.reviewer || ((completed || returned) && previousFlow?.State === 'pending')) {
      try {
        const alert = await sendReviewNotification(settings, updated, reviewFlow, actor, !!completed || returned);
        reviewFlow = {...reviewFlow, AlertPageId:alert.PageId, AlertPageUrl:alert.PageUrl};
        cacheReviewFlowMemory(settings, id, reviewFlow);
        void saveReviewFlow(settings, id, reviewFlow).catch(() => {});
      } catch (error) {
        updated.__notificationWarning = 'La actividad se guardó, pero no se confirmó el aviso de revisión. ' + (error instanceof Error ? error.message : '');
      }
    }
    updated.__reviewFlow = reviewFlow;
  }
  return updated;
}
export async function createActivity(settings: Settings, actor: string, payload: any) {
  const { start, end, domain, person, title } = payload;
  if (start) validateSchedule(start, end);
  if (!title?.trim()) throw new Error('Escribe un título.');
  if (person && !isDirection(actor) && !isReviewer(actor) && normalizePerson(actor) !== normalizePerson(person)) throw new Error('Solo puedes crear actividades asignadas a ti.');
  let databaseId = process.env.NOTION_DATABASE_ID || settings.notionDatabaseId;
  const referencedId = String(payload.body || '').match(/https?:\/\/(?:www\.)?notion\.(?:so|site)\/[^\s]*?([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?:[?\s/#]|$)/i)?.[1];
  if (!databaseId && referencedId) {
    try { const source = await notionRequest(settings, `pages/${referencedId}`); databaseId = source.parent?.database_id; }
    catch { const source = await notionRequest(settings, `databases/${referencedId}`); databaseId = source.id; }
  }
  const sourceId = start ? process.env.NOTION_CALENDAR_DATA_SOURCE_ID || settings.notionDataSourceId || '2eeabd7d-91b7-8193-a131-000b08cd54e2' : undefined;
  if (!sourceId && !databaseId) throw new Error('Configura la base de Notion para crear páginas.');
  const database = await notionRequest(settings, sourceId ? 'data_sources/' + sourceId : 'databases/' + databaseId);
  const fields = Object.entries(database.properties || {}) as [string, Property][];
  const titleField = fields.find(([,p]) => p.type === 'title');
  if (!titleField) throw new Error('La base no tiene propiedad de título.');
  const canonicalPerson = normalizePerson(person || actor);
  const description = title.trim().split(/\s+/).filter((word:string)=>word.toLowerCase() !== String(domain || '').toLowerCase()).join(' ');
  const composed = start ? ['prtuzREVISION', domain, PERSON_ALIASES[canonicalPerson]?.[0], description].filter(Boolean).join(' ') : [domain, person, title.trim()].filter(Boolean).join(' ');
  const properties: Record<string, any> = { [titleField[0]]: { title: [{ text: { content: composed } }] } };
  if (start) {
    const dateField = fields.find(([n,p]) => p.type === 'date' && /^fecha por hacer$/i.test(n.trim()));
    if (!dateField) throw new Error('La base no tiene fecha programada.');
    properties[dateField[0]] = { date: { start, end } };
  }
  const personField = assignedField(database);
  if (person && !personField) throw new Error('La fuente no tiene persona asignada editable.');
  if (person && personField) {
    const [name, prop] = personField;
    if (prop.type === 'people') {
      const mapping = JSON.parse(process.env.NOTION_PERSON_IDS || '{}');
      const userId = mapping[person] || mapping[canonicalPerson] || mapping[PERSON_ALIASES[canonicalPerson]?.[0]] || await resolveTeamPersonId(settings,canonicalPerson);
      if (!userId) throw new Error('No se pudo resolver la persona asignada en Notion.');
      properties[name] = { people: [{ id:userId }] };
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
  const page = await notionRequest(settings, 'pages', 'POST', { parent: sourceId ? {data_source_id:sourceId} : { database_id: databaseId }, properties, children });
  return { page, activity: normalizeActivity({ pageId: page.id, pageUrl: page.url, title: composed, person: normalizePerson(person || actor), domain, start, end }, 0) };
}
