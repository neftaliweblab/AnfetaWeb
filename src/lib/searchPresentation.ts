import {newestFirst} from './searchResultOrder';

export const SEARCH_SORTS = [
  ['default', 'Orden habitual'],
  ['name-asc', 'Título · A–Z'],
  ['name-desc', 'Título · Z–A'],
  ['scheduled-asc', 'Fecha por hacer · antigua primero'],
  ['scheduled-desc', 'Fecha por hacer · reciente primero'],
  ['modified-asc', 'Fecha modificada · antigua primero'],
  ['modified-desc', 'Fecha modificada · reciente primero'],
] as const;

export function parseSearchDate(raw: any): number | null {
  if (!raw) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const str = String(raw).trim();
  if (!str || str === '—' || str === '-') return null;

  // Si es un rango de fechas con hora tipo "2026-10-29T11:00:00 - 2026-10-29T12:00:00" o "2026-10-29 a 2026-10-30"
  const firstPart = str.split(/\s+(?:-|a)\s+/)[0].trim();

  // Intento directo Date.parse
  let t = Date.parse(firstPart);
  if (Number.isFinite(t)) return t;

  // Formato ISO: YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss...
  const isoMatch = firstPart.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[+-]\d{2}:?\d{2}|Z)?)?/);
  if (isoMatch) {
    t = Date.parse(isoMatch[0].replace(' ', 'T'));
    if (Number.isFinite(t)) return t;
  }

  // Formato latino: DD/MM/YYYY
  const dmyMatch = firstPart.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmyMatch) {
    t = Date.parse(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
    if (Number.isFinite(t)) return t;
  }

  return null;
}

export function searchRowDate(r: any, field: 'scheduled' | 'modified'): number | null {
  if (!r) return null;
  if (field === 'scheduled') {
    return parseSearchDate(r.scheduledDate || r.ScheduledDate || r.dateStart || r.start || r.Start || r.currentScheduledDate);
  }
  return parseSearchDate(r.serverModified || r.ServerModified || r.modifiedLocalDate || r.ModifiedLocalDate || r.lastEdited || r.last_edited_time);
}

export function compareSearchRows(a: any, b: any, sort: string) {
  if (sort === 'default') return newestFirst(a, b);
  const direction = sort.endsWith('-desc') ? -1 : 1;

  if (sort.startsWith('name-')) {
    return direction * String(a.name || a.Name || '').localeCompare(String(b.name || b.Name || ''), 'es', { numeric: true, sensitivity: 'base' });
  }

  const isScheduled = sort.startsWith('scheduled-');
  const left = searchRowDate(a, isScheduled ? 'scheduled' : 'modified');
  const right = searchRowDate(b, isScheduled ? 'scheduled' : 'modified');

  // Elementos sin fecha siempre al final en cualquier dirección
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  const diff = direction * (left - right);
  if (diff !== 0) return diff;

  // Desempate alfabético por nombre para garantizar estabilidad
  return String(a.name || a.Name || '').localeCompare(String(b.name || b.Name || ''), 'es', { numeric: true, sensitivity: 'base' });
}

export function lastSearchTerm(query: string) {
  const tokens = query.match(/"[^"]+"|\S+/g) || [];
  let last = '', negate = false;
  for (const token of tokens) {
    if (/^(NOT|!)$/i.test(token)) {
      negate = true;
      continue;
    }
    if (/^(AND|OR|&&|\|\||[()])$/i.test(token)) continue;
    if (!negate && !/^[-!]|^[a-z]+:/i.test(token)) last = token.replace(/^["(]+|[)"]+$/g, '');
    negate = false;
  }
  return last;
}
