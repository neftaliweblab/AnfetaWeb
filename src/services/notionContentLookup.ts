import {createHash} from 'node:crypto';
import {BoundedCache} from '../lib/boundedCache';
import {ANFETA_BASES} from '../lib/notionBaseCatalog';
import {isNotionContentProperty} from '../lib/notionContentProperty';
import {notionRequest} from './notionMutations';
import type {CalendarSettings} from './notionCalendar';

type ContentField = {id: string; type: 'rich_text' | 'formula'};
type ContentSchema = {fields: ContentField[]; propertyIds: string[]};
type LookupResult = {pages: any[]; partial: boolean};

const fieldsCache = new BoundedCache<Promise<ContentSchema>>(64, 64, 600000, () => 1);
const lookups = new BoundedCache<Promise<LookupResult>>(24, 24, 15000, () => 1);
const accent: Record<string, string[]> = {a:['á'], e:['é'], i:['í'], o:['ó'], u:['ú','ü'], n:['ñ']};

function variants(term: string) {
  const original = term.normalize('NFC').toLowerCase();
  const folded = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const values = new Set([original, folded]);
  for (const [index, letter] of [...folded].entries()) {
    for (const next of accent[letter] ?? []) values.add(folded.slice(0, index) + next + folded.slice(index + 1));
  }
  return [...values].slice(0, 20);
}

function getFields(settings: CalendarSettings, key: string, id: string) {
  const existing = fieldsCache.get(key);
  if (existing) return existing;
  const request = notionRequest(settings, 'data_sources/' + id).then(schema => {
    const entries = Object.entries(schema.properties ?? {}) as [string, {id: string; type: string}][];
    const fields = entries.flatMap(([name, field]): ContentField[] =>
      isNotionContentProperty(name) && field?.id && ['rich_text', 'formula'].includes(field.type)
        ? [{id: field.id, type: field.type as ContentField['type']}]
        : [],
    ).slice(0, 4);
    const propertyIds = [...new Set([
      ...fields.map(field => field.id),
      ...entries.filter(([name, field]) => field?.id &&
        (['title', 'people', 'status'].includes(field.type) ||
          /fecha|status|estado|responsable|asignad|assignee|dominio|domain|ftf/i.test(name)),
      ).map(([, field]) => field.id),
    ])];
    return {fields, propertyIds};
  }).catch(error => {fieldsCache.delete(key);throw error;});
  fieldsCache.set(key, request);
  return request;
}

export function lookupNotionContent(settings: CalendarSettings, term: string): Promise<LookupResult> {
  const scope = createHash('sha256').update(settings.notionToken.trim()).digest('hex') + ':' + (process.env.NOTION_CALENDAR_DATA_SOURCE_ID || settings.notionDataSourceId || '');
  const key = scope + ':' + term.toLowerCase();
  const existing = lookups.get(key);
  if (existing) return existing;
  const request = (async () => {
    const querySettings = {...settings, notionSignal: AbortSignal.timeout(10000)};
    const sources = await Promise.allSettled(ANFETA_BASES.map(async ([name, defaultId]) => {
      const id = name === 'Revisiones' ? process.env.NOTION_CALENDAR_DATA_SOURCE_ID || settings.notionDataSourceId || defaultId : defaultId;
      const {fields, propertyIds} = await getFields(querySettings, scope + ':' + id, id);
      if (!fields.length) return {pages: [], partial: false};
      const filters = fields.flatMap(field => variants(term).map(contains =>
        field.type === 'formula'
          ? {property: field.id, formula: {string: {contains}}}
          : {property: field.id, rich_text: {contains}},
      ));
      const params = new URLSearchParams(propertyIds.map(property => ['filter_properties', property]));
      const result = await notionRequest(querySettings, 'data_sources/' + id + '/query?' + params, 'POST', {
        page_size: 25,
        filter: filters.length === 1 ? filters[0] : {or: filters},
        sorts: [{timestamp: 'last_edited_time', direction: 'descending'}],
      });
      return {
        pages: (result.results ?? []).filter((page: any) => !page.archived && !page.is_archived && !page.in_trash).map((page: any) => ({...page, _anfetaBase: name})),
        partial: Boolean(result.has_more || result.request_status?.type === 'incomplete'),
      };
    }));
    const available = sources.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    if (!available.length) throw new Error('No se pudo consultar la propiedad de contenido en Notion.');
    return {pages: available.flatMap(result => result.pages), partial: available.length < sources.length || available.some(result => result.partial)};
  })().catch(error => {lookups.delete(key);throw error;});
  lookups.set(key, request);
  return request;
}
