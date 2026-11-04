function parseDateCandidate(raw: any): number {
  if (!raw) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const str = String(raw).trim();
  if (!str) return 0;
  const direct = Date.parse(str);
  if (Number.isFinite(direct)) return direct;
  const isoMatch = str.match(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[+-]\d{2}:?\d{2}|Z)?)?/);
  if (isoMatch) {
    const t = Date.parse(isoMatch[0].replace(' ', 'T'));
    if (Number.isFinite(t)) return t;
  }
  const dmyMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const t = Date.parse(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

export function getPathOrderRank(row: any): number {
  if (!row) return 99;
  const isDropbox = row.Source === 1 || row.source === 'Dropbox' || (row.ExternalSourceName || row.sourceName || '') === 'Dropbox';
  if (isDropbox) return 6;

  const sourceName = String(row.ExternalSourceName || row.sourceName || '').toLowerCase();
  const name = String(row.Name || row.name || '').toLowerCase();

  // 0: Revisiones (MÁXIMA PRIORIDAD ESTILO ANFETA)
  if (
    sourceName.includes('revision') ||
    name.startsWith('[revisiones]') ||
    name.includes('zrevision') ||
    name.includes('rtuzrevision') ||
    name.includes('prtuzrevision')
  ) {
    return 0;
  }

  // 1: Clientes (zCLIENTES)
  if (sourceName.includes('cliente') || name.startsWith('[clientes]') || name.includes('zclientes')) {
    return 1;
  }

  // 2: Dominios (zDOMINIOS)
  if (sourceName.includes('dominio') || name.startsWith('[dominios]') || name.includes('zdominios')) {
    return 2;
  }

  // 3: Proyectos / Programas (zPROYECTOS)
  if (sourceName.includes('programa') || sourceName.includes('proyecto') || name.startsWith('[programas') || name.startsWith('[proyectos')) {
    return 3;
  }

  // 4: Correos Contraseñas (zCORREOS)
  if (sourceName.includes('correo') || name.startsWith('[correos]')) {
    return 4;
  }

  // 5: Cobrar y pagar (zPAGAR - zCOBRAR)
  if (
    sourceName.includes('cobrar') ||
    sourceName.includes('pagar') ||
    name.startsWith('[cobrar') ||
    name.startsWith('[pagar') ||
    name.includes('zpagar') ||
    name.includes('zcobrar') ||
    name.includes('aprtuzcobrar') ||
    name.includes('aprtuzpagar')
  ) {
    return 5;
  }

  return 6;
}

export function getOrderNumericRank(row: any): number {
  const order = row.orderChip || row.OrderChip;
  if (order) {
    const num = parseFloat(order);
    if (Number.isFinite(num)) return num;
  }
  const name = String(row.Name || row.name || '');
  // Detección de estructura canónica moderna: 📅? MM.c.OO.SS -> Orden numérico OO.SS
  const structMatch = name.match(/(?:📅\s*)?\d{1,2}\.[a-z]\.(\d{1,2})\.(\d{2})/i);
  if (structMatch) {
    const num = parseFloat(`${parseInt(structMatch[1], 10)}.${structMatch[2]}`);
    if (Number.isFinite(num)) return num;
  }
  const m = name.match(/(?<![a-zA-Z0-9_])(\d{1,3}\.\d{1,2})(?![a-zA-Z0-9_])/);
  if (m && m.index !== undefined && m.index < 80) {
    const num = parseFloat(m[1]);
    if (Number.isFinite(num)) return num;
  }
  return Number.MAX_VALUE;
}

export function cleanSearchTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^\[[^\]]{1,40}\]\s*/i, '')
    .replace(/[💻📅🌐🛠🔄👥✅ℹ️🔍]/gu, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Calcula la relevancia de búsqueda según los 4 niveles solicitados:
 * 1. Coincidencia exacta del título completo con el texto buscado (100)
 * 2. Coincidencia de la frase completa dentro del título (80)
 * 3. Coincidencia con todos los términos buscados en el título (60)
 * 4. Coincidencias en otros campos (40) o parciales (20)
 */
export function calculateSearchRelevance(row: any, query: string): number {
  if (!row || !query) return 0;
  const rawQ = query.trim();
  if (!rawQ) return 0;
  const cleanQ = cleanSearchTitle(rawQ);
  if (!cleanQ) return 0;

  const rawTitle = String(row.Name || row.name || row.title || '').trim();
  const cleanTitle = cleanSearchTitle(rawTitle);

  // 1. Coincidencia exacta del título completo
  if (cleanTitle === cleanQ || rawTitle.toLowerCase() === rawQ.toLowerCase()) {
    return 100;
  }

  // 2. Coincidencia de la frase completa dentro del título
  if (cleanTitle.includes(cleanQ) || rawTitle.toLowerCase().includes(rawQ.toLowerCase())) {
    return 80;
  }

  // 3. Coincidencia con todos los términos buscados en el título
  const terms = cleanQ.split(/\s+/).filter(t => t.length > 0);
  if (terms.length > 0 && terms.every(term => cleanTitle.includes(term))) {
    return 60;
  }

  // 4. Coincidencias con todos los términos en otros campos del item
  const otherFields = [
    row.path,
    row.description,
    row.searchText,
    row.SearchText,
    row.folder,
    row.Folder,
  ].filter(Boolean).join(' ').toLowerCase();

  const combined = cleanTitle + ' ' + otherFields;
  if (terms.length > 0 && terms.every(term => combined.includes(term))) {
    return 40;
  }

  // 5. Coincidencias parciales
  if (terms.some(term => cleanTitle.includes(term))) {
    return 20;
  }

  return 0;
}

export function getRecencyTime(row: any): number {
  if (!row) return 0;
  let best = 0;
  // Límite de horizonte futuro: 30 días a partir de hoy.
  const maxFuture = Date.now() + 30 * 86400000;

  const candidates = [
    row.ServerModified,
    row.serverModified,
    row.NotionEditedUtc,
    row.notionEditedUtc,
    row.ModifiedLocalDate,
    row.modifiedLocalDate,
    row.dateStart,
    row.date,
    row.lastEdited,
    row.Start
  ];

  const sched = row.ScheduledDate || row.scheduledDate;
  if (sched) {
    const st = parseDateCandidate(sched);
    if (st > 0 && st <= maxFuture) {
      candidates.push(sched);
    }
  }

  for (const val of candidates) {
    const t = parseDateCandidate(val);
    if (t > best && t <= maxFuture) best = t;
  }
  return best;
}

export function newestFirst(a: any, b: any) {
  // 1. Prioridad estricta estilo ANFETA: Revisiones (0) > Clientes (1) > Dominios (2) > Proyectos (3) > Correos (4) > Cobrar/Pagar (5) > Dropbox/Local (6)
  const rankA = getPathOrderRank(a);
  const rankB = getPathOrderRank(b);
  if (rankA !== rankB) return rankA - rankB;

  // 2. Lógica de los más recientes: fechas más recientes primero
  const timeA = getRecencyTime(a);
  const timeB = getRecencyTime(b);
  if (timeB !== timeA) return timeB - timeA;

  // 3. Orden numérico (ej. 01.00 antes de 02.00 antes de 10.00)
  const numA = getOrderNumericRank(a);
  const numB = getOrderNumericRank(b);
  if (numA !== numB) return numA - numB;

  // 4. Alfabético por nombre
  return (a.Name || a.name || '').localeCompare(b.Name || b.name || '');
}
