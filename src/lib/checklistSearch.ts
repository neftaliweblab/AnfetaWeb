export function normalizeChecklistSearchText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function shortDateFromIso(isoDate?: string): string {
  const clean = String(isoDate || '').slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}`;
}

export function matchesChecklistQuery(
  item: { text?: unknown; plannedDate?: unknown; caption?: unknown },
  query: string
): boolean {
  const normalizedQuery = normalizeChecklistSearchText(query);
  if (!normalizedQuery) return true;
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const planned = typeof item.plannedDate === 'string' ? item.plannedDate.slice(0, 10) : '';
  const haystack = normalizeChecklistSearchText(
    [item.text, item.caption, planned, shortDateFromIso(planned)].filter(Boolean).join(' ')
  );
  return tokens.every((token) => haystack.includes(token));
}

export function filterChecklistItems<T extends { text?: unknown; plannedDate?: unknown; caption?: unknown }>(
  items: T[],
  query: string
): T[] {
  if (!String(query || '').trim()) return items;
  return items.filter((item) => matchesChecklistQuery(item, query));
}
