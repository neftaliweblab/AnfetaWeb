import {inferActivityPerson,activePersonTag,setTaskUrgent,scanActivityTags} from './activityTags';
import {DOCUMENTATION_SOURCE_ID} from '../lib/notionBaseCatalog';
import {withActivityLease,operationKey} from './reliableOperations';
import {ftfField,FTF_CHECKBOX} from './ftfVerification';
import {activeTeam} from './teamDirectory';
import {handoffTitle} from './handoffTitle';
import {prepareHandoff,confirmHandoff} from './activityHandoffs';
import {readChecklist} from './notionCalendar';
import {editActivityDescription} from './activityTitleEdit';
import {reviewTitle} from './reviewTitle';
import { sendReviewNotification } from './reviewNotifications';
import { resolveTeamPersonId, clearReadBlocksCache, calendarStatusField, assignedField, assignedPerson, readReviewFlow, saveReviewFlow, cacheReviewFlowMemory, clearReviewFlowMemory } from './notionCalendar';
import { canEditActivity, isActivityLocked, isDirection, isReviewer } from './activityPermissions';
import { normalizePerson, PERSON_ALIASES } from './identityNormalizer';
import {quickRevisionTitle} from '@/lib/quickRevisionTitle';
import { normalizeActivity } from './dataNormalizers';
import { mexicoDate,calendarDomain } from './calendarPresentation';
import { workflowState } from './activityWorkflow';
import {queryCalendarPages} from './notionCalendar';
import {calendarConflict,nearbyFreeCalendarSlots, type CalendarSlot} from './calendarConflicts';

type Settings = { notionToken: string; currentUser: string; notionApiVersion?: string; notionDatabaseId?: string; notionDataSourceId?: string; notionSignal?: AbortSignal };
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
  settings.notionSignal?.throwIfAborted();
  await paceNotion(settings.notionToken);
  settings.notionSignal?.throwIfAborted();
  try {
  const res = await fetch(`https://api.notion.com/v1/${endpoint}`, { method, headers: { Authorization: `Bearer ${settings.notionToken.trim()}`, 'Notion-Version': settings.notionApiVersion || ((endpoint.startsWith('data_sources/') || body?.parent?.data_source_id) ? '2026-03-11' : '2022-06-28'), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: settings.notionSignal?AbortSignal.any([settings.notionSignal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000) });
  if(res.status===401)throw new Error('La credencial de Notion no es válida o fue revocada. Revisa la integración configurada en ANFETA.');
  if (res.status === 429 && attempt < 3) {
    const wait = Math.min(10, Math.max(1, Number(res.headers.get('retry-after')) || 1));
    nextRequestAt.set(settings.notionToken,Date.now()+wait*1000);
    await new Promise(resolve => setTimeout(resolve, wait * 1000));
    return notionRequest(settings, endpoint, method, body, attempt + 1);
  }
  const text = await res.text(); let data:any; try {data=JSON.parse(text);} catch {throw new Error('Notion devolvió una respuesta no válida (HTTP ' + res.status + '). Intenta de nuevo en unos segundos.');} if (!res.ok) throw new Error(data.message || `Notion respondió ${res.status}`); if(method === 'PATCH' || method === 'DELETE' || (method === 'POST' && endpoint === 'pages')) clearReadBlocksCache(settings); return data;
  } catch(error) {
    if(error instanceof Error && (error.name==='TimeoutError'||error.name==='AbortError'))throw new Error(method==='GET'||endpoint.endsWith('/query')?'Notion tardó demasiado en responder. Las actividades visibles se conservan; intenta actualizar.':'Notion no confirmó el guardado a tiempo. Actualiza la actividad antes de repetir para comprobar si el cambio se guardó.');
    throw error;
  }
}
function titleOf(page: any) { return Object.values(page.properties || {}).filter((p: any) => p.type === 'title').flatMap((p: any) => p.title || []).map((t: any) => t.plain_text || t.text?.content || '').join(''); }
const mutationLocks = new Set<string>();
const scheduleLocks=new Set<string>();
async function withCalendarSchedule<T>(settings:Settings,run:()=>Promise<T>):Promise<T>{
  const key=operationKey(settings.notionToken,'calendar-schedule');
  if(scheduleLocks.has(key))throw new Error('Se está guardando otro horario. Espera y vuelve a intentar.');
  scheduleLocks.add(key);
  try{return await withActivityLease(key,run);}finally{scheduleLocks.delete(key);}
}
export async function calendarScheduleAvailability(settings:Settings,moving:CalendarSlot){
  if(!Number.isFinite(Date.parse(moving.start))||!Number.isFinite(Date.parse(moving.end))||Date.parse(moving.end)<=Date.parse(moving.start))throw new Error('No se pudo verificar el horario de la actividad.');
  const day=mexicoDate(moving.start),next=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  // Incluir el día anterior para detectar actividades que atraviesan medianoche.
  const previous=new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  const pages=await queryCalendarPages(settings,previous,next,true);
  const slots:CalendarSlot[]=pages.flatMap(page=>{
    const date:any=Object.entries(page.properties||{}).find(([n,p]:any)=>/^fecha por hacer$/i.test(n.trim())&&p.type==='date')?.[1];
    if(!date?.date?.start)return [];
    const title=titleOf(page),fallback=inferActivityPerson(title);
    const start=date.date.start.length===10?date.date.start+'T08:00:00-06:00':date.date.start;
    return [{pageId:page.id,title,person:assignedPerson(page,fallback),start,end:date.date.end||new Date(Date.parse(start)+3600000).toISOString()}];
  });
  const conflict=calendarConflict(slots,moving);
  return {conflict:conflict?{title:conflict.title}:null,suggestions:conflict?nearbyFreeCalendarSlots(slots,moving):[]};
}
async function assertFreeCalendarSchedule(settings:Settings,moving:CalendarSlot){
  const {conflict,suggestions}=await calendarScheduleAvailability(settings,moving),free=suggestions[0];
  if(conflict)throw new Error('El horario se empalma con «'+conflict.title+'» de '+moving.person+'. '+(free?'Horario libre sugerido: '+free.start.slice(11,16)+'–'+free.end.slice(11,16)+'.':'No hay espacio disponible entre las 08:00 y las 22:00.')+' No se guardaron cambios.');
}
export async function mutateActivity(settings: Settings, actor: string, id: string, updates: any, cached?: any) {
  const key = settings.notionToken + ':' + id;
  if (mutationLocks.has(key)) throw new Error('La actividad se está guardando; espera antes de reenviarla.');
  mutationLocks.add(key);
  try {const bounded={...settings,notionSignal:settings.notionSignal?AbortSignal.any([settings.notionSignal,AbortSignal.timeout(110000)]):AbortSignal.timeout(110000)};const run=()=>withActivityLease(operationKey(settings.notionToken,id.replace(/-/g,'')),()=>mutateActivityUnlocked(bounded, actor, id, updates, cached));return await (updates.start||updates.person||updates.reviewer?withCalendarSchedule(bounded,run):run()); }
  finally {mutationLocks.delete(key);}
}
async function mutateActivityUnlocked(settings: Settings, actor: string, id: string, updates: any, cached?: any) {
  const checkSchedule=!!updates.start||!!updates.person&&!updates.reviewAction&&!updates.status&&!updates.reviewer;
  if (!id || !/^[a-f0-9-]{32,36}$/i.test(id)) throw new Error('Identificador de Notion inválido.');
  const page = await notionRequest(settings, `pages/${id}`);
  if(page.archived||page.in_trash)throw Error('La actividad está archivada o en la papelera.');
  const title = titleOf(page);
  if(updates.automationMove){const state=workflowState(calendarStatusField(page)?.[1]?.[calendarStatusField(page)![1].type]?.name||'',title);if(!['pending','suspended'].includes(state)||/\b(?:zREVISION|FTF|ccale)\b/i.test(title)||Object.entries(page.properties||{}).some(([n,p]:any)=>/fij[oa]|fixed/i.test(n)&&p.checkbox))throw Error('La actividad ya no es un pendiente reprogramable. Actualiza su estado.');}
  if(updates.expectedEditedAt && page.last_edited_time!==updates.expectedEditedAt)throw new Error('La actividad cambió en otro dispositivo. Actualiza antes de guardar.');
  if(updates.expectedStatus!==undefined && (calendarStatusField(page)?.[1]?.[calendarStatusField(page)![1].type]?.name||'')!==updates.expectedStatus)throw new Error('El estado cambió en otro dispositivo. Actualiza antes de guardar.');
  const locks = Object.entries(page.properties || {}).some(([name, prop]: any) => /lock|bloquead/i.test(name) && prop.type === 'checkbox' && prop.checkbox);
  const inferred = inferActivityPerson(title);
  const activity = { ...cached, title, person: assignedPerson(page, inferred || cached?.person || ''), isLocked: locks || isActivityLocked(cached || {}) };
  if(updates.expectedPerson!==undefined&&normalizePerson(updates.expectedPerson)!==normalizePerson(activity.person))throw new Error('El responsable cambió en otro dispositivo. Actualiza antes de guardar.');
  if (!canEditActivity(actor, activity)) throw new Error('Solo el responsable, Dirección o un revisor puede modificar esta actividad; las actividades bloqueadas no admiten cambios.');
  if ((updates.start || updates.end) && (workflowState(calendarStatusField(page)?.[1]?.[calendarStatusField(page)?.[1]?.type]?.name||'',title)==='completed'||/(?<![\p{L}\p{Nd}_])zREVISION(?![\p{L}\p{Nd}_])/iu.test(title+' '+(calendarStatusField(page)?.[1]?.[calendarStatusField(page)?.[1]?.type]?.name || '')))) throw new Error('La fecha de zREVISION es histórica. Reasigna primero la actividad a una fase activa antes de cambiar su horario.');
  const returned = updates.reviewAction === 'return';
  const reassigned = updates.reviewAction === 'reassign';
  const handoff=updates.handoff===true;
  let handoffId:string|undefined;
  if(handoff){
    if(updates.reviewer||updates.reviewAction||updates.status||updates.start||updates.title)throw Error('Reasigna por separado de otros cambios.');
    const state=workflowState(calendarStatusField(page)?.[1]?.[calendarStatusField(page)![1].type]?.name||'',title);
    if(!['pending','suspended'].includes(state))throw Error('Solo se pueden pasar actividades activas. Resuelve la revisión o reactívala primero.');
    if(!isDirection(actor)&&normalizePerson(actor)!==normalizePerson(activity.person))throw Error('Solo el responsable o Dirección puede pasar esta actividad.');
    const target=normalizePerson(updates.person);
    if(target===normalizePerson(activity.person))throw Error('Selecciona a otro compañero.');
    if(!(await activeTeam()).some(p=>p.name===target))throw Error('El nuevo responsable no tiene un perfil activo.');
    if(typeof updates.note!=='string'||updates.note.length>1200)throw Error('La indicación debe tener como máximo 1200 caracteres.');
  }
  if (returned) updates = {...updates,status:'prtuzREVISION'};
  if (reassigned) updates = {...updates,status:'prtuzREVISION'};
  if (updates.status && workflowState(updates.status) === 'review' && !updates.reviewer) throw new Error('Selecciona a quién enviar la actividad en el modal de revisión.');
  const completed = updates.status && workflowState(updates.status) === 'completed';

  if(handoff)clearReadBlocksCache(settings);
  const previousFlow = updates.reviewer || completed || returned || reassigned || handoff ? await readReviewFlow(settings, id) : undefined;
  if(completed&&!isReviewer(actor)&&!(previousFlow?.State==='pending'&&normalizePerson(actor)===normalizePerson(previousFlow.ReviewAssignee)&&PERSON_ALIASES[normalizePerson(actor)]))throw Error('Solo el revisor asignado puede terminar esta revisión.');
  if(handoff&&previousFlow?.State==='pending')throw Error('La actividad tiene una revisión pendiente. Resuélvela antes de reasignar.');
  if(updates.expectedReviewUpdatedAt!==undefined&&(previousFlow?.UpdatedAt||null)!==updates.expectedReviewUpdatedAt)throw new Error('El flujo de revisión cambió en otro dispositivo. Actualiza antes de guardar.');
  if(updates.reviewer&&previousFlow?.State==='pending'&&normalizePerson(previousFlow.ReviewAssignee)===normalizePerson(updates.reviewer))throw new Error('La actividad ya está en revisión con este compañero. Actualiza antes de reenviarla.');
  if ((returned || completed) && previousFlow?.State === 'pending' && normalizePerson(actor) !== normalizePerson(previousFlow.ReviewAssignee)) throw new Error('Solo el revisor asignado puede aprobar o devolver esta revisión.');
  if (returned && (!previousFlow || previousFlow.State !== 'pending')) throw new Error('La actividad no tiene una revisión pendiente.');
  if (returned && !String(updates.note || '').trim()) throw new Error('Describe las correcciones solicitadas.');
  if (reassigned && (previousFlow?.State !== 'approved' || !isReviewer(actor))) throw new Error('Solo un revisor puede reasignar una actividad aprobada.');
  if ((completed || returned) && previousFlow?.OriginalPerson) updates = { ...updates, person: previousFlow.OriginalPerson };
  let reviewFlow: any;
  // La lectura del calendario recorta los bordes del título; comparar con la misma regla.
  if(updates.expectedTitle!==undefined&&String(updates.expectedTitle).trim()!==title.trim())throw new Error('El nombre cambió desde que abriste el editor. Actualiza la actividad antes de guardar.');
  if(updates.titleDescription!==undefined)updates={...updates,title:editActivityDescription(title,String(updates.titleDescription))};
  let nextTitle = title;
  const properties: Record<string, any> = {};
  if(updates.ftfVerified!==undefined){
    const field=ftfField(page);
    if(!field)throw Error('No se encontró la casilla de Notion “'+FTF_CHECKBOX+'”.');
    if(typeof updates.ftfVerified!=='boolean'||typeof updates.expectedFtfVerified!=='boolean')throw Error('Actualiza la actividad antes de marcar su verificación FTF.');
    if(field[1].checkbox!==updates.expectedFtfVerified)throw Error('La verificación FTF cambió en otra sesión. Actualiza antes de guardarla.');
    properties[field[0]]={checkbox:updates.ftfVerified};
  }
  const fields = Object.entries(page.properties || {}) as [string, Property][];

  // Reasignación o Envío a Revisión
  if (updates.person || updates.reviewer) {
    const target = updates.reviewer || updates.person;
    const isSendingToReview = !!updates.reviewer || updates.status === 'rtuzREVISION' || updates.status === 'EN REVISIÓN';
    const restoringAssignedReview=(completed||returned)&&previousFlow?.State==='pending'&&normalizePerson(actor)===normalizePerson(previousFlow.ReviewAssignee);
    if (!handoff && !restoringAssignedReview && !isDirection(actor) && !isReviewer(actor) && !isSendingToReview) {
      throw new Error('Solo Dirección o el responsable al enviar a revisión puede reasignar actividades.');
    }
    const person = normalizePerson(target);
    if(updates.reviewer&&!(await activeTeam()).some(p=>p.name===person))throw Error('Selecciona un integrante activo del equipo como revisor.');
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
      nextTitle = isSendingToReview || completed || returned ? title : handoffTitle(title,activity.person,person);
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
      let source=updates.title!==undefined?String(updates.title):title;
      if(updates.reviewer&&updates.isUrgent!==undefined)source=setTaskUrgent(source,previousFlow?.OriginalPerson||activity.person,updates.isUrgent);
      properties[field[0]]={title:[{text:{content:reviewTitle(source,previousFlow?.OriginalPerson||activity.person,updates.reviewer||previousFlow.ReviewAssignee,returned?'returned':completed?'approved':'pending',previousFlow?.State==='pending'?previousFlow.ReviewAssignee:'')}}]};
    }
  }
  if (updates.isUrgent !== undefined && !updates.reviewer) {
    const titleProp = fields.find(([,p]) => p.type === 'title');
    if (!titleProp) throw new Error('No se encontró el título de Notion.');
    nextTitle = (properties[titleProp[0]]?.title || []).map((t: any) => t.text?.content || '').join('') || nextTitle;
    nextTitle = setTaskUrgent(nextTitle,activity.person,updates.isUrgent);
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
      State: returned ? 'returned' : reassigned ? 'reassigned' : completed ? 'approved' : 'pending', SubmittedAt: updates.reviewer ? new Date().toISOString() : previousFlow?.SubmittedAt || new Date().toISOString(),
      Round: updates.reviewer ? (Number(previousFlow?.Round)||0)+1 : previousFlow?.Round||1,
      UpdatedAt: new Date().toISOString(), UpdatedBy: actor, Note: returned ? String(updates.note).trim() : reassigned ? 'Reasignada para continuar trabajo.' : completed ? 'Revisión terminada desde ANFETA web.' : 'Enviada a revisión desde ANFETA web.',
      LeaveVisualCopy: updates.reviewer ? updates.leaveVisualCopy !== false : previousFlow?.LeaveVisualCopy,
      AlertPageId: previousFlow?.AlertPageId || '', AlertPageUrl: previousFlow?.AlertPageUrl || '',
    };
  }
  if(checkSchedule){
    const schedule:any=fields.find(([n,p])=>p.type==='date'&&/^fecha por hacer$/i.test(n.trim()))?.[1]?.date;
    if(schedule?.start){const start=updates.start||(schedule.start.length===10?schedule.start+'T08:00:00-06:00':schedule.start);await assertFreeCalendarSchedule(settings,{pageId:id,title:nextTitle,person:normalizePerson(updates.reviewer||updates.person||activity.person),start,end:updates.end||schedule.end||new Date(Date.parse(start)+3600000).toISOString()});}
  }
  if(handoff){
    const date:any=fields.find(([name,p])=>p.type==='date'&&/^fecha por hacer$/i.test(name.trim()))?.[1]?.date;
    const snapshotStart=date?.start?.length===10?date.start+'T08:00:00-06:00':date?.start;
    if(!snapshotStart||!Number.isFinite(Date.parse(snapshotStart)))throw Error('La actividad necesita un horario válido para conservar su historial.');
    const checklistItems=await readChecklist(settings,id);
    const snapshot=normalizeActivity({...cached,pageId:id,title,domain:calendarDomain(title,cached?.domain),person:activity.person,start:snapshotStart,end:date?.end||cached?.end||new Date(Date.parse(snapshotStart)+3600000).toISOString(),pageUrl:page.url,checklistScanned:true,checklistItems,checklistTotal:checklistItems.length,checklistCompleted:checklistItems.filter(c=>c.isChecked).length},0);
    if(!snapshot.start||!snapshot.end)throw Error('La actividad necesita un horario válido para conservar su historial.');
    handoffId=await prepareHandoff(settings,{pageId:id,from:normalizePerson(activity.person),to:normalizePerson(updates.person),actor,note:updates.note.trim(),copy:updates.leaveVisualCopy!==false,snapshot});
    reviewFlow={OriginalPerson:normalizePerson(updates.person),ReviewAssignee:'',State:'handoff',UpdatedAt:new Date().toISOString(),UpdatedBy:actor,Note:updates.note.trim(),HandoffId:handoffId,FromPerson:activity.person};
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

    try { await saveReviewFlow(settings, id, reviewFlow); }
    catch (error) {
      clearReviewFlowMemory(settings,id);
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
    cacheReviewFlowMemory(settings,id,reviewFlow,updated.last_edited_time);
    if (updates.reviewer || ((completed || returned) && previousFlow?.State === 'pending')) {
      try {
        const alert = await sendReviewNotification(settings, updated, reviewFlow, actor, !!completed || returned);
        reviewFlow = {...reviewFlow, AlertPageId:alert.PageId, AlertPageUrl:alert.PageUrl};
        cacheReviewFlowMemory(settings, id, reviewFlow, updated.last_edited_time);
        await saveReviewFlow(settings, id, reviewFlow).catch(() => {});
      } catch (error) {
        updated.__notificationWarning = 'La actividad se guardó, pero no se confirmó el aviso de revisión. ' + (error instanceof Error ? error.message : '');
      }
    }
    updated.__reviewFlow = reviewFlow;
  }
  if(handoffId){try{await confirmHandoff(settings,handoffId);}catch{updated.__notificationWarning='El responsable se guardó en Notion, pero no se confirmó la copia histórica. Actualiza y verifica antes de repetir la reasignación.';}}
  return updated;
}
export async function createActivity(settings: Settings, actor: string, payload: any) {
  const bounded={...settings,notionSignal:settings.notionSignal?AbortSignal.any([settings.notionSignal,AbortSignal.timeout(110000)]):AbortSignal.timeout(110000)};
  return payload.start?withCalendarSchedule(bounded,()=>createActivityUnlocked(bounded,actor,payload)):createActivityUnlocked(bounded,actor,payload);
}
export async function validateNotionCreationTarget(settings:Settings,payload:any={}){
  if (!settings?.notionToken?.trim()) throw new Error('Falta configurar el token de Notion en el servidor.');
  const start=payload.start;
  let databaseId = payload?.databaseId || process.env.NOTION_DATABASE_ID || settings.notionDatabaseId;
  let sourceId = payload?.dataSourceId;
  if(payload.documentationKind){databaseId=payload.databaseId;sourceId=payload.dataSourceId||(!databaseId?(process.env.NOTION_DOCUMENTATION_DATA_SOURCE_ID||DOCUMENTATION_SOURCE_ID):undefined);}
  const referencedId = String(payload.body || '').match(/https?:\/\/(?:www\.)?notion\.(?:so|site)\/[^\s]*?([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?:[?\s/#]|$)/i)?.[1];

  if (start || payload.useCalendarSource===true) {
    sourceId = sourceId || process.env.NOTION_CALENDAR_DATA_SOURCE_ID || settings.notionDataSourceId || '2eeabd7d-91b7-8193-a131-000b08cd54e2';
  } else {
    if (!databaseId && !sourceId && referencedId) {
      try {
        const source = await notionRequest(settings, `pages/${referencedId}`);
        databaseId = source.parent?.database_id;
        sourceId = source.parent?.data_source_id;
      } catch {
        try {
          const source = await notionRequest(settings, `databases/${referencedId}`);
          databaseId = source.id;
        } catch {}
      }
    }
    if (!sourceId && !databaseId) throw new Error('Falta elegir la base para páginas nuevas. Selecciona «Usar base del calendario» o indica una base en este formulario.');
  }
  const normalizeId=(value:string)=>{const input=String(value).trim();let id=input;if(/^https?:\/\//i.test(input)){const url=new URL(input);if(!/(^|\.)notion\.(so|site|com)$/i.test(url.hostname))throw new Error('El enlace de la base debe pertenecer a Notion.');id=url.pathname.match(/([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?$/i)?.[1]||'';}if(!/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(id))throw new Error('El identificador de base de Notion tiene un formato inválido.');return id;};
  if(sourceId)sourceId=normalizeId(sourceId);else if(databaseId)databaseId=normalizeId(databaseId);
  let database: any;
  try {
    database = await notionRequest(settings, sourceId ? 'data_sources/' + sourceId : 'databases/' + databaseId);
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (/401|unauthorized|invalid.*token/i.test(msg)) throw new Error('Token de Notion inválido o expirado. Revisa la integración en Ajustes.');
    if (/404|403|restricted|could not find|not found/i.test(msg)) throw new Error('No se tiene acceso a la base de Notion (' + (sourceId ? 'data source ' + sourceId : 'base ' + databaseId) + '). Asegúrate de compartirla con la integración.');
    if (/validation_error|invalid.*uuid/i.test(msg)) throw new Error('El identificador de base de Notion (' + (sourceId || databaseId) + ') tiene un formato inválido.');
    throw err;
  }
  if(!Object.values(database.properties||{}).some((p:any)=>p.type==='title'))throw new Error('La base de destino no tiene propiedad de título.');
  if(payload.quickRevision){const status=calendarStatusField(database);const options=status?.[1]?.[status[1].type]?.options||[];if(!options.some((option:any)=>option.name==='prtuzREVISION'||workflowState(option.name)==='pending'))throw new Error('La base de Revisiones requiere un estado POR HACER para las actividades rápidas.');}
  return {database,databaseId,sourceId};
}
async function createActivityUnlocked(settings: Settings, actor: string, payload: any) {
  const { start, end, domain, title } = payload;
  const person=payload.quickRevision?payload.person||actor:payload.person;
  if (!settings?.notionToken?.trim()) throw new Error('Falta configurar el token de Notion (NOTION_TOKEN en el servidor o en Ajustes).');
  if (start) validateSchedule(start, end);
  if (!title?.trim()) throw new Error('Escribe un título.');
  if (person && !PERSON_ALIASES[normalizePerson(person)] && normalizePerson(person) !== 'Sin asignar') throw new Error('Selecciona un responsable válido del equipo.');
  if (start) await assertFreeCalendarSchedule(settings,{pageId:'',title,person:normalizePerson(person||actor),start,end});
  const {database,databaseId,sourceId}=await validateNotionCreationTarget(settings,payload.quickRevision?{...payload,useCalendarSource:true}:payload);
  const fields = Object.entries(database.properties || {}) as [string, Property][];
  const titleField = fields.find(([,p]) => p.type === 'title');
  if (!titleField) throw new Error('La base no tiene propiedad de título.');
  const canonicalPerson = normalizePerson(person || actor);
  const description = title.trim().split(/\s+/).filter((word:string)=>word.toLowerCase() !== String(domain || '').toLowerCase()).join(' ');
  const personTag=scanActivityTags(description).some(tag=>tag.person===canonicalPerson&&tag.role==='active')?'':activePersonTag(canonicalPerson);
  const composed = payload.quickRevision?quickRevisionTitle({type:payload.quickType,title:payload.quickTitle||title,person:canonicalPerson,domain,description:payload.quickDescription,month:payload.quickMonth}):start ? ['prtuzREVISION', domain, personTag, description].filter(Boolean).join(' ') : [domain, person, title.trim()].filter(Boolean).join(' ');
  const properties: Record<string, any> = { [titleField[0]]: { title: [{ text: { content: composed } }] } };
  if (start) {
    const dateField = fields.find(([n,p]) => p.type === 'date' && /^fecha por hacer$/i.test(n.trim()));
    if (!dateField) throw new Error('La base no tiene fecha programada.');
    properties[dateField[0]] = { date: { start, end } };
  }
  if(start||payload.quickRevision){const status=calendarStatusField(database);if(!status)throw new Error('La base no tiene Estado editable para crear actividades.');const options=status[1][status[1].type]?.options||[];const pending=options.find((option:any)=>option.name==='prtuzREVISION')||options.find((option:any)=>workflowState(option.name)==='pending');if(!pending)throw new Error('Configura un estado POR HACER en la base antes de crear actividades.');properties[status[0]]={[status[1].type]:{name:pending.name}};}
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
  const fullBody=String(payload.body||'');
  const chunks=Array.from(fullBody).reduce<string[]>((parts,char)=>{if(!parts.length||parts[parts.length-1].length+char.length>1900)parts.push('');parts[parts.length-1]+=char;return parts;},[]);
  if(chunks.length>80)throw new Error('El texto excede el límite de esta creación. Divide el contenido en varias páginas.');
  for(const content of chunks)children.push({object:'block',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content}}]}});
  children.push(...await notionFileBlocks(settings,payload.files||[]));
  if(children.length>100)throw new Error('El contenido y adjuntos exceden 100 bloques. Divide la creación.');
  const page = await notionRequest(settings, 'pages', 'POST', { parent: sourceId ? {data_source_id:sourceId} : { database_id: databaseId }, properties, children });
  return { page, activity: normalizeActivity({ pageId: page.id, pageUrl: page.url, title: composed, person: normalizePerson(person || actor), domain, start, end }, 0) };
}

export async function notionFileBlocks(settings:Settings,files:any[]){
  const children:any[]=[];
  for (const file of files) {
    if (!file.filename || !file.base64) throw new Error('Cada adjunto de Notion debe tener nombre y contenido.');
    let cleanBase64 = String(file.base64 || '');
    const marker = ';base64,';
    const markerIdx = cleanBase64.indexOf(marker);
    if (markerIdx !== -1) cleanBase64 = cleanBase64.slice(markerIdx + marker.length);
    else {
      const commaIdx = cleanBase64.indexOf(',');
      if (commaIdx !== -1 && cleanBase64.startsWith('data:')) cleanBase64 = cleanBase64.slice(commaIdx + 1);
    }
    const fileBytes = Buffer.from(cleanBase64, 'base64');
    if (fileBytes.length === 0 || fileBytes.length > 20 * 1024 * 1024) throw new Error('Cada adjunto de Notion debe tener contenido válido y pesar como máximo 20 MB.');
    const contentType=String(file.contentType || /^data:([^;]+);/.exec(file.dataUrl || '')?.[1] || 'application/octet-stream').split(';')[0].trim();
    if (contentType.startsWith('video/') && (cleanBase64 === 'opus;base64' || cleanBase64 === 'video/webm' || cleanBase64.includes(';base64') || cleanBase64.startsWith('codecs='))) throw new Error('El archivo de video contiene una cabecera inválida o datos dañados.');
    const upload = await notionRequest(settings, 'file_uploads', 'POST', { mode: 'single_part', filename: file.filename, content_type: contentType });
    const form = new FormData(); form.append('file', new Blob([fileBytes], { type: contentType }), file.filename);
    const res = await fetch(`https://api.notion.com/v1/file_uploads/${upload.id}/send`, { method: 'POST', headers: { Authorization: `Bearer ${settings.notionToken.trim()}`, 'Notion-Version': '2022-06-28' }, body: form, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error('Notion rechazó el archivo adjunto.');
    // WebM screen recordings can upload successfully while Notion cannot play them.
    // Preserve the original as a downloadable file rather than a broken video player.
    const webm=contentType==='video/webm'||/\.webm$/i.test(file.filename);
    const type=contentType.startsWith('video/')&&!webm?'video':'file';
    children.push({ object: 'block', type, [type]: { type: 'file_upload', file_upload: { id: upload.id } } });
  }
  return children;
}
