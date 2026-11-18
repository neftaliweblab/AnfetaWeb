export type ContentClassification = 'all' | 'project' | 'documentation' | 'unclassified';

/**
 * Clasifica como Proyecto ('project') o Documentación ('documentation')
 * si el dominio tiene el prefijo p./1. (proyecto activo) o d./0. (documentación/software).
 * Nunca interpreta versiones (1.00), órdenes o direcciones IP como clasificación de dominio.
 */
export function contentClassification(titleOrDomain: string, domain?: string): Exclude<ContentClassification, 'all' | 'unclassified'> | '' {
  const text = (domain ? domain + ' ' : '') + String(titleOrDomain || '');
  const match = text.match(/(?:^|[\s[(\|])([01pd])\.(?=[a-z0-9-]*[a-z][a-z0-9-]*\.)(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|app|dev|info|biz|co|gob|edu|online|site|vip|us|es|ai)\b/i);
  if (!match) return '';
  const token = match[1].toLowerCase();
  return token === 'p' || token === '1' ? 'project' : token === 'd' || token === '0' ? 'documentation' : '';
}

export function matchesContentClassification(title: string, selected: string, domain?: string) {
  const kind = contentClassification(title, domain);
  return selected === 'all' || !selected || (selected === 'unclassified' && !kind) || kind === selected;
}

export function classifiedDomain(value: string) {
  return value.replace(/^[01pd]\.(?=[a-z0-9-]*[a-z][a-z0-9-]*\.)/i, '');
}
