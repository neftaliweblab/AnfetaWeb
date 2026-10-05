export interface VisualParts {
  title: string;        // Título limpio para la tabla
  rawTitle: string;     // Título original completo sin tocar
  workflow: string;     // PENDIENTE, EN REVISIÓN, SUSPENDIDA, POR HACER, TERMINADA
  workflowColor: string;
  area: string;         // ADS, WEB, SEO, DIS, CONT, APP, PROG, MAPS, BIBLIA, etc.
  monthCode: string;    // ej: 08AGO, 09SEP, 10OCT
  orderCode: string;    // ej: 01.00, 04.00, 90.00, 15
  domain: string;       // ej: novakid.com, clinicaalfa.mx
  contentSnippet?: string;
}

export function parseVisualParts(rawName: string, status?: string, contentSnippet?: string): VisualParts {
  let display = (rawName || '').trim();
  const rawTitle = display;
  if (!display) {
    return {
      title: 'Sin título',
      rawTitle: '',
      workflow: '',
      workflowColor: '#94A3B8',
      area: '',
      monthCode: '',
      orderCode: '',
      domain: '',
      contentSnippet,
    };
  }

  // 1. Quitar prefijo de origen Notion tipo [Actividades], [Clientes]
  display = display.replace(/^\[[^\]]{1,40}\]\s*/i, '').trim();

  // 2. Extraer Workflow token (sprtuzREVISION, aprtuzREVISION, prtuzREVISION, rtuzREVISION, zREVISION)
  let workflow = '';
  const wfMatch = display.match(/(?<![\w_])(sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)(?![\w_])/i);
  if (wfMatch) {
    const val = wfMatch[1].toUpperCase();
    if (val === 'PRTUZREVISION') workflow = 'PENDIENTE';
    else if (val === 'RTUZREVISION') workflow = 'EN REVISIÓN';
    else if (val === 'ZREVISION') workflow = 'TERMINADA';
    else if (val === 'SPRTUZREVISION') workflow = 'SUSPENDIDA';
    else if (val === 'APRTUZREVISION') workflow = 'POR HACER';
    display = display.replace(wfMatch[0], '');
  } else if (status) {
    const s = status.toLowerCase();
    if (s.includes('cobrado terminado') || s.includes('pendiente cobrar')) workflow = 'TERMINADA';
    else if (s.includes('revisar revisiones') || s.includes('terminado rev cobro')) workflow = 'EN REVISIÓN';
    else if (s.includes('suspex')) workflow = 'SUSPENDIDA';
    else if (s.includes('arrancar asignar')) workflow = 'POR HACER';
    else if (s.includes('prtuz por hacer')) workflow = 'PENDIENTE';
  }

  let workflowColor = '#94A3B8';
  if (workflow === 'PENDIENTE') workflowColor = '#FBBF24';
  else if (workflow === 'EN REVISIÓN') workflowColor = '#F87171';
  else if (workflow === 'TERMINADA') workflowColor = '#38BDF8';
  else if (workflow === 'SUSPENDIDA') workflowColor = '#FACC15';
  else if (workflow === 'POR HACER') workflowColor = '#C084FC';

  // 3. Extraer Mes (ej. 26-[08AGO], [08AGO], (2609SEPT), 08AGO)
  let monthCode = '';
  const monthMatch = display.match(/(?<![\w_])(?:\d{2}-)?\[?\(?(\d{1,2}[A-Za-z]{3,4})\)?\]?(?:\s*-\s*|\s+)?/i);
  if (monthMatch && monthMatch.index! < 50) {
    monthCode = monthMatch[1].toUpperCase();
    display = display.replace(monthMatch[0], '');
  }

  // 4. Extraer Área codificada (aads, wwebs, sseo, ddise, rrede, mmaps, etc.)
  let area = '';
  const areaMatch = display.match(/(?<![\w_])(sseo|seo|wwebs|webs|web|aads|ads|ad|aapli|apli|apps?|aplicaci[oó]n|pprog|prog|software|ddise|dise[nñ]o|rrede|redes|mmaps|maps|bbibl|biblia|ccoti|coti|cchat|chat|rrapi|api)(?![\w_])/i);
  if (areaMatch) {
    const rawA = areaMatch[1].toLowerCase();
    if (rawA.includes('seo')) area = 'SEO';
    else if (rawA.includes('web')) area = 'WEB';
    else if (rawA.includes('ad')) area = 'ADS';
    else if (rawA.includes('apli') || rawA.includes('app')) area = 'APP';
    else if (rawA.includes('prog') || rawA.includes('soft')) area = 'PROG';
    else if (rawA.includes('dise')) area = 'DISEÑO';
    else if (rawA.includes('rede')) area = 'REDES';
    else if (rawA.includes('map')) area = 'MAPS';
    else if (rawA.includes('bibl')) area = 'BIBLIA';
    else if (rawA.includes('coti')) area = 'COTIZACIÓN';
    else area = rawA.toUpperCase();
    display = display.replace(areaMatch[0], '');
  }

  // 5. Extraer Dominio (ej. [novakid.com], fortelite.com)
  let domain = '';
  const domainMatch = display.match(/(?:\[|\()?\s*(?<![\w.-])(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com\.mx|org\.mx|gob\.mx|com|mx|org|net|io|co|app|dev))\s*(?:\]|\))?/i);
  if (domainMatch) {
    const candidate = domainMatch[1].toLowerCase();
    if (!['dominio.com', 'ejemplo.com', 'example.com'].includes(candidate)) {
      domain = candidate;
      display = display.replace(domainMatch[0], '');
    }
  }

  // 6. Extraer Orden / Código (ej. 01.00, 04.00, mes 1.00, 15)
  let orderCode = '';
  const orderMatch = display.match(/(?<![\w_])(?:mes|orden|ord|num|no|act|m|#)?\s*(\d{1,3}(?:\.\d{1,2})?)(?!\d)(?:\s*-\s*|\s+)?/i);
  if (orderMatch && orderMatch.index! < 50) {
    orderCode = orderMatch[1];
    display = display.replace(orderMatch[0], '');
  }

  // 7. Limpieza de prefijos técnicos residuales
  display = display.replace(/^\s*(?:bbibl|rrapi|wwebs|sseo|aads|aapli|pprog|ddise|rrede|mmaps|ccon|pproy|mes)\s+/i, '');
  display = display.replace(/\[\s*\]|\(\s*\)/g, '');
  display = display.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, '').trim();

  return {
    title: display || rawTitle,
    rawTitle,
    workflow,
    workflowColor,
    area,
    monthCode,
    orderCode,
    domain,
    contentSnippet,
  };
}
