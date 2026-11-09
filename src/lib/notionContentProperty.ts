export function isNotionContentProperty(name: string) {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ');
  return normalized.includes('contenido') && (
    normalized.includes('busqueda') || normalized.includes('palabras') || /contenido pagina|\bia\b/.test(normalized)
  );
}

export function readNotionContentProperty(properties: Record<string, any> | undefined): string | undefined {
  const values: string[] = [];
  for (const [name, property] of Object.entries(properties ?? {})) {
    if (!property || !isNotionContentProperty(name)) continue;
    if (Array.isArray(property.rich_text)) {
      values.push(property.rich_text.map((part: any) => part.plain_text ?? part.text?.content ?? '').join('').trim());
    } else if (property.type === 'formula' && property.formula?.type === 'string') {
      values.push(property.formula.string?.trim() ?? '');
    } else if (Array.isArray(property[property.type])) {
      values.push(property[property.type].map((part: any) => part.plain_text ?? part.text?.content ?? part.name ?? '').join(' ').trim());
    } else if (typeof property[property.type] === 'string' || typeof property[property.type]?.name === 'string') {
      values.push(String(property[property.type]?.name ?? property[property.type]).trim());
    }
  }
  return values.length ? [...new Set(values.filter(Boolean))].join(' ') : undefined;
}

export function notionContentLookupTerm(query: string) {
  const text = query.trim();
  if (text.length > 120 || !/^[\p{L}\p{M}\p{N} ]+$/u.test(text) || /\b(?:and|or|not)\b/i.test(text)) return '';
  return text.split(/ +/).filter(word => word.length >= 3 && /\p{L}/u.test(word)).sort((a, b) => b.length - a.length)[0] ?? '';
}

export function replaceNotionContentProperty(row: Record<string, any>, value: string) {
  const previous = typeof row.aiContent === 'string' ? row.aiContent.trim() : '';
  const updated: Record<string, unknown> = {aiContent: value, 'busqueda palabras por contenido pagina IA': value, contentPropertyObserved: true};
  for (const key of Object.keys(row)) {
    if (key === 'AiContent' || isNotionContentProperty(key)) updated[key] = value;
  }
  if (previous && previous !== value) {
    // Older indexes appended the property into body and search text, sometimes more than once.
    for (const key of row.pageContentFromBlocks ? ['searchText'] : ['pageContent', 'searchText']) {
      const original = typeof row[key] === 'string' ? row[key].trim() : '';
      let text = original;
      while (text === previous || text.endsWith(' ' + previous)) {
        text = text.slice(0, -previous.length).trimEnd();
      }
      if (text !== original) updated[key] = text;
    }
    if (!row.pageContentFromBlocks && (row.contentSnippet === previous || row.contentSnippet === previous.slice(0, 300))) {
      updated.contentSnippet = value.slice(0, 300);
    }
  }
  return updated;
}
