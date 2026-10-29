export type ContentClassification = 'all' | 'project' | 'documentation' | 'unclassified';

/**
 * Solo clasifica como Proyecto ('project') o Documentación ('documentation')
 * si el dominio tiene el prefijo d. o p. (ej. d.anfeta.com, p.anfeta.com, d.anfeta.com.aplicacion.web).
 * No aplica a títulos generales, fechas ni tareas sin ese prefijo de dominio.
 */
export function contentClassification(titleOrDomain: string, domain?: string): Exclude<ContentClassification, 'all' | 'unclassified'> | '' {
  const text = (domain ? domain + ' ' : '') + String(titleOrDomain || '');
  const match = text.match(/(?:^|[\s[(])([pd])\.([a-z0-9-]+\.)+(?:com|mx|net|org|io|app|dev|info|biz|co|gob|edu|online|site|vip|us|es)\b/i);
  if (!match) return '';
  const token = match[1].toLowerCase();
  return token === 'p' ? 'project' : token === 'd' ? 'documentation' : '';
}

export function matchesContentClassification(title: string, selected: string, domain?: string) {
  const kind = contentClassification(title, domain);
  return selected === 'all' || !selected || (selected === 'unclassified' && !kind) || kind === selected;
}

export function classifiedDomain(value: string) {
  return value.replace(/^[pd]\.(?=[a-z0-9-]+\.)/i, '');
}
