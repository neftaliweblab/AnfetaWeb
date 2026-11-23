import {stripActivityTags} from '../services/activityTags';
import {stripTitlePlaceholders} from './titlePlaceholders';
import {calendarDomain, normalizeFtfDomain} from '../services/calendarPresentation';
import {workflowPresentation} from '../services/activityWorkflow';
import {stripProgressiveStage,progressiveStage,PROGRESSIVE_WORKFLOW_PRIMARY} from '../services/progressiveWorkflow';

/** Resuelve el dominio visible/de agrupación, normalizando FTFs (<persona>.com o vacío) a anfeta.com. */
export function resolveItemDomain(item: any, parsedDomain?: string): string {
  const title = String(item?.name || item?.title || item?.Name || '');
  const raw = String(parsedDomain || item?.domainChip || item?.domain || '').trim();
  return normalizeFtfDomain(title, raw);
}

export interface VisualParts {
  title: string;        // Título limpio para la tabla
  rawTitle: string;     // Título original completo sin tocar
  workflow: string;     // PENDIENTE, EN REVISIÓN, SUSPENDIDA, POR HACER, TERMINADA
  workflowColor: string;
  area: string;         // ADS, WEB, SEO, DIS, CONT, APP, PROG, MAPS, BIBLIA, etc.
  monthCode: string;    // ej: 11, 08AGO, 09SEP, 10OCT
  orderCode: string;    // ej: 01.00, 04.00, f41.01, 15
  domain: string;       // ej: novakid.com, clinicaalfa.mx
  contentSnippet?: string;
}

const AREA_DISPLAY_LABELS: Record<string, string> = {
  WEB: 'webs',
  WEBS: 'webs',
  WWEB: 'webs',
  WWEBS: 'webs',
  WEBSITE: 'webs',
  APP: 'Aplicación',
  AAPLI: 'Aplicación',
  APLICACION: 'Aplicación',
  APLICACIÓN: 'Aplicación',
  PRO: 'Software',
  PROG: 'Software',
  PPROG: 'Software',
  SOFT: 'Software',
  SSOFT: 'Software',
  SOFTWARE: 'Software',
  PROGRAMAS: 'Software',
};

export interface DisplayOrderParts {
  full: string;
  major: string;
  minor: string;
}

/**
 * Formatea visualmente la fase/orden sin modificar el título original en Notion:
 * retira la 'f' inicial y elimina un cero a la izquierda en números de 2+ dígitos antes del punto
 * (ej. f01.01 -> 1.01, f12.01 -> 12.01, f0.51 -> 0.51, 01.00 -> 1.00).
 */
export function formatDisplayOrderParts(rawOrderCode: string): DisplayOrderParts | null {
  const clean = String(rawOrderCode || '').trim();
  if (!clean) return null;
  const withoutF = clean.replace(/^f(?=\d)/i, '');
  const dotIdx = withoutF.indexOf('.');
  if (dotIdx >= 0) {
    const major = withoutF.slice(0, dotIdx).replace(/^0(?=\d)/, '');
    const minor = withoutF.slice(dotIdx);
    return { full: `${major}${minor}`, major, minor };
  }
  const major = withoutF.replace(/^0(?=\d)/, '');
  return { full: major, major, minor: '' };
}

/** Etiqueta visible de área para tabla/badges sin romper códigos internos (`APP`/`PROG`). */
export function formatAreaLabel(area: string): string {
  const clean = String(area || '').trim();
  if (!clean) return '';
  return AREA_DISPLAY_LABELS[clean.toUpperCase()] || clean;
}

const CANONICAL_MONTH_LABELS = [
  '01ENE',
  '02FEB',
  '03MAR',
  '04ABR',
  '05MAY',
  '06JUN',
  '07JUL',
  '08AGO',
  '09SEP',
  '10OCT',
  '11NOV',
  '12DIC',
] as const;

/**
 * Convierte un código de mes numérico o abreviado a su etiqueta oficial visible (`11` -> `11NOV`).
 * Solo afecta visualización; no modifica títulos fuente en Notion.
 */
export function formatMonthBadgeLabel(rawMonthCode: string): string {
  const clean = String(rawMonthCode || '').trim().toUpperCase();
  if (!clean) return '';
  const numOnly = clean.match(/^0?([1-9]|1[0-2])$/);
  if (numOnly) {
    return CANONICAL_MONTH_LABELS[parseInt(numOnly[1], 10) - 1] || clean;
  }
  const numWithLetters = clean.match(/^0?([1-9]|1[0-2])([A-Z]{3,4})$/);
  if (numWithLetters) {
    return CANONICAL_MONTH_LABELS[parseInt(numWithLetters[1], 10) - 1] || clean;
  }
  return clean;
}

const visualPartsGlobalCache = new Map<string, VisualParts>();
const MAX_PARTS_CACHE = 4000;

export function parseVisualParts(rawName: string, status?: string, contentSnippet?: string): VisualParts {
  const cacheKey = (rawName || '') + '::' + (status || '') + '::' + (contentSnippet || '');
  const cachedResult = visualPartsGlobalCache.get(cacheKey);
  if (cachedResult) return cachedResult;

  let display = (rawName || '').trim();
  const rawTitle = display;
  display = stripTitlePlaceholders(display);
  if (!display) {
    return {
      title: 'Sin título',
      rawTitle,
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
  let workflow = '', areaFromStage = '';
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
    if (s.includes('cobrado terminado') || s.includes('pendiente cobrar') || s.includes('terminada') || s.includes('terminado')) workflow = 'TERMINADA';
    else if (s.includes('revisar revisiones') || s.includes('terminado rev cobro') || s.includes('revisión') || s.includes('revision')) workflow = 'EN REVISIÓN';
    else if (s.includes('suspex') || s.includes('suspe')) workflow = 'SUSPENDIDA';
    else if (s.includes('arrancar asignar') || s.includes('arrancar') || s.includes('por hacer')) workflow = 'POR HACER';
    else if (s.includes('prtuz por hacer') || s.includes('prtuz') || s.includes('pendiente')) workflow = 'PENDIENTE';
  }

  // Detección de doble "A" para suspendidas / borradores (aaprtuz, aaprtuzS, aartuz, aapr, AA)
  // Sin colisionar con dominios o tags de persona (aads, aacce, aapli, aacal, aan11)
  const doubleAMatch = display.match(/(?<![\w_])(aaprtuz[rsS]?|aartuz[rsS]?|aapr[rsS]?|AA\b)(?![\w_])/i);
  if (doubleAMatch && !/^(?:aacce|aads|aapli|aacal|aan11)/i.test(doubleAMatch[1])) {
    if (!workflow || workflow === 'PENDIENTE') {
      workflow = 'SUSPENDIDA';
    }
    display = display.replace(doubleAMatch[0], ' ');
  }

  let workflowColor = '#94A3B8';
  if (workflow === 'PENDIENTE') workflowColor = '#FBBF24';
  else if (workflow === 'EN REVISIÓN') workflowColor = '#F87171';
  else if (workflow === 'TERMINADA') workflowColor = '#38BDF8';
  else if (workflow === 'SUSPENDIDA') workflowColor = '#FACC15';
  else if (workflow === 'POR HACER') workflowColor = '#C084FC';

  const presentation = workflowPresentation(status || '', stripTitlePlaceholders(rawTitle));
  if (presentation.state !== 'unknown') {
    workflow = presentation.label.toUpperCase();
    workflowColor = { pending: '#FBBF24', review: '#F87171', completed: '#38BDF8', suspended: '#FACC15', unknown: '#94A3B8' }[presentation.state];
  }
  if (PROGRESSIVE_WORKFLOW_PRIMARY) {
    const stage = progressiveStage(stripTitlePlaceholders(rawTitle));
    display = stripProgressiveStage(display);
    if (stage?.category === 'software') areaFromStage = 'PROG';
    if (stage?.category === 'cobro') areaFromStage = 'COBRO';
    if (stage?.category === 'pago') areaFromStage = 'PAGO';
  }

  let monthCode = '';
  let orderCode = '';
  let area = areaFromStage;

  // 3a. Estructura moderna de títulos: 📅? MM[MES]?.c.fNN.OO o MM[MES]?.c.OO.SS (ej. 11.a.f41.01, 11NOV.a.f43.00, 11.s.01.00)
  const structPhaseMatch = display.match(/(?:📅\s*)?(0?[1-9]|1[0-2])(?:[A-Za-z]{3,4})?\.([a-z])\.(f\d{1,3})\.(\d{2})(?!\d)/i);
  const structMatch = structPhaseMatch || display.match(/(?:📅\s*)?(0?[1-9]|1[0-2])(?:[A-Za-z]{3,4})?\.([a-z])\.(\d{1,2})\.(\d{2})(?!\d)/i);
  if (structMatch) {
    monthCode = String(parseInt(structMatch[1], 10)).padStart(2, '0');
    orderCode = structPhaseMatch
      ? `${structPhaseMatch[3].toLowerCase()}.${structPhaseMatch[4]}`
      : `${structMatch[3].padStart(2, '0')}.${structMatch[4]}`;
    const strand = structMatch[2].toLowerCase();
    if (!area) {
      if (strand === 's') {
        const hasSoftwareSignal =
          /\b(?:ssoft|pprog|software|instalador|tutoriales)\b/i.test(display) ||
          /\.(?:com|mx|net|org|io|app|dev)(?:\.[a-z0-9-]+)*\.0[1-4](?:wl|_weblab)?\b/i.test(display);
        const looksSeo = /\b(?:sseo|seo)\b|\.seo\b/i.test(display);
        area = looksSeo && !hasSoftwareSignal ? 'SEO' : 'PROG';
      } else if (strand === 'p') area = 'PROG';
      else if (strand === 'a') area = 'APP';
      else if (strand === 'w') area = 'WEB';
      else if (strand === 'd') area = 'DISEÑO';
      else if (strand === 'm') area = 'MAPS';
      else if (strand === 'r') area = 'REDES';
      else if (strand === 'c') area = 'COTIZACIÓN';
    }
    display = display.replace(structMatch[0], ' ');
  }

  // 3b. Extraer Mes heredado si no vino de la estructura moderna (ej. 26-[08AGO], [08AGO], (2609SEPT), 08AGO)
  if (!monthCode) {
    const monthMatch = display.match(/(?<![\w_])(?:\d{2}-)?\[?\(?((?:0?[1-9]|1[0-2])(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEPT?|OCT|NOVI?|DIC)[A-Z]*)\)?\]?(?:\s*-\s*|\s+)?/i);
    if (monthMatch && monthMatch.index! < 120) {
      monthCode = formatMonthBadgeLabel(monthMatch[1]);
      display = display.replace(monthMatch[0], ' ');
    }
  }

  // 4. Extraer Dominio (soporta #?1./0./p./d., sufijos .aplicacion/.01-.04/.03wl, sin mutilar IPs)
  let domain = '';
  const classifiedToken = display.match(/(?:\[|\(|#)?([01pd]\.(?=[a-z0-9-]*[a-z][a-z0-9-]*\.)(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|vip|app|edu|gob|co|ai|dev|info|biz|us|es|online|site)(?:\.(?:webs?|ads|seo|maps|cotizacion|biblioteca|aplicacion|software|proyecto|app|prog|redes|correos|instalador|tutoriales|weblab|cliente|0[1-4](?:wl|_weblab)?))*)(?:\]|\))?(?=\s|$|\||,|;)/i);
  if (classifiedToken) {
    const candidateDom = calendarDomain(classifiedToken[1]);
    domain =
      candidateDom && !['general', 'dominio.com', 'ejemplo.com', 'example.com'].includes(candidateDom)
        ? candidateDom
        : '';
    display = display.replace(classifiedToken[0], ' ');
  }

  if (!domain) {
    const domainRegex = /(?:\[|\()?\s*(?:@|https?:\/\/|www\.)?((?:(?:webs?|wwebs|sseo|seo|aads|ads|pprog|prog|aapp|app|ddise|dise)\.)?([a-zA-Z0-9\-]+\.(?:com\.mx|org\.mx|gob\.mx|net\.mx|com|mx|net|org|io|dev|app|co|vip|edu|gob|ai|info|biz|us|es|online|site))(?:\.(?:webs?|ads|seo|maps|cotizacion|biblioteca|aplicacion|software|proyecto|app|prog|redes|0[1-4](?:wl|_weblab)?))*)\b\s*(?:\]|\))?/i;
    const domainMatch = display.match(domainRegex);
    if (domainMatch) {
      const rawMatch = domainMatch[0];
      const fullMatched = domainMatch[1];
      const candidate = domainMatch[2].toLowerCase();
      if (!['dominio.com', 'ejemplo.com', 'example.com'].includes(candidate)) {
        domain = candidate;
        const prefix = fullMatched.split('.')[0].toLowerCase();
        if (['web', 'webs', 'wwebs'].includes(prefix) && !area) area = 'WEB';
        else if (['seo', 'sseo'].includes(prefix) && !area) area = 'SEO';
        else if (['ads', 'aads'].includes(prefix) && !area) area = 'ADS';
        else if (['prog', 'pprog'].includes(prefix) && !area) area = 'PROG';
        else if (['app', 'aapp'].includes(prefix) && !area) area = 'APP';
        else if (['dise', 'ddise'].includes(prefix) && !area) area = 'DISEÑO';
        display = display.replace(rawMatch, ' ');
      }
    }
  }

  // 5. Extraer Área codificada adicional y limpiar prefijos técnicos aunque area ya exista
  const areaTokenRe = /(?<![\w_])(sseo|wwebs|aads|aapli|pprog|ssoft|ddise|rrede|mmaps|bbibl|ccoti|cchat|rrapi|soft|prog|aplicaci[oó]n|dise[nñ]o|biblia|seo|webs?|ads|apli|apps?|software|redes|maps|coti|chat|api)(?![.\w_])/i;
  const areaMatch = display.match(areaTokenRe);
  if (areaMatch) {
    const rawA = areaMatch[1].toLowerCase();
    if (!area) {
      if (rawA.includes('seo')) area = 'SEO';
      else if (rawA.includes('web')) area = 'WEB';
      else if (rawA === 'aads' || rawA === 'ads') area = 'ADS';
      else if (rawA.includes('apli') || rawA.includes('app')) area = 'APP';
      else if (rawA.includes('prog') || rawA.includes('soft')) area = 'PROG';
      else if (rawA.includes('dise')) area = 'DISEÑO';
      else if (rawA.includes('rede')) area = 'REDES';
      else if (rawA.includes('map')) area = 'MAPS';
      else if (rawA.includes('bibl')) area = 'BIBLIA';
      else if (rawA.includes('coti')) area = 'COTIZACIÓN';
      else area = rawA.toUpperCase();
    }
    if (/^(?:sseo|wwebs|aads|aapli|pprog|ssoft|ddise|rrede|mmaps|bbibl|ccoti|cchat|rrapi)$/i.test(areaMatch[1])) {
      display = display.replace(areaMatch[0], ' ');
    }
  }
  // Retirar códigos técnicos oficiales duplicados restantes (SSEO, AAPLI, WWEBS, etc.) sin tocar "SEO" en descripción útil
  display = display.replace(/(?<![\w_.])(?:sseo|wwebs|aads|aapli|pprog|ssoft|ddise|rrede|mmaps|bbibl|ccoti|cchat|rrapi)(?![\w_.])/gi, ' ');

  // 6. Extraer fase/orden (fNN / ffaseNN / 01.00) sin confundir años (2026), versiones (v2.0) ni 0./1. sueltos
  const trailingFaseMatch = display.match(/(?<![\w_.])(?:ffase|fase)(\d{1,3}(?:\.\d{1,2})?)(?![\w.])/i);
  if (!orderCode && trailingFaseMatch) {
    orderCode = `f${trailingFaseMatch[1]}`;
    display = display.replace(trailingFaseMatch[0], ' ');
  } else if (trailingFaseMatch) {
    display = display.replace(trailingFaseMatch[0], ' ');
  }
  if (!orderCode) {
    const faseMatch = display.match(/(?<![\w_.])f(\d{1,3}(?:\.\d{1,2})?)(?![\w.])/i);
    if (faseMatch && faseMatch.index! < 60) {
      orderCode = `f${faseMatch[1]}`;
      display = display.replace(faseMatch[0], ' ');
    }
  }
  if (!orderCode) {
    const orderMatch = display.match(/(?<![\w_vV./-])(?:mes|orden|ord|num|no|act|m|#)?\s*(\d{1,2}\.\d{2}|\d{1,3}(?!\.\d)(?=\s*[-–]\s*|\s+))(?!\d|[./]\d)(?:\s*[-–]\s*|\s+)?/i);
    if (orderMatch && orderMatch.index! < 50 && Number(orderMatch[1]) < 1900) {
      orderCode = orderMatch[1];
      display = display.replace(orderMatch[0], '');
    }
  }

  display = stripActivityTags(display).replace(/(?<![\w.])ssoft(?![\w.])/gi, ' ');
  // 7. Limpieza de prefijos técnicos residuales, bloques [CCORR AANFE ...], tags canónicos 🛠 y dominios finales entre paréntesis
  display = display
    .replace(/(?:🛠\uFE0F?)\s*[A-Z0-9]{3,}(?:-[A-Z0-9]{3,})*/gu, ' ')
    .replace(/\(\s*(?:(?:[01pd]\.)?(?:[a-z0-9-]+\.)+[a-z0-9-]+|\.[a-z0-9._-]+)\s*\)/gi, ' ')
    .replace(/\[\s*[A-Z]{4,}(?:\s+[A-Z]{4,})*\s*\]/g, ' ')
    .replace(/^\s*(?:bbibl|rrapi|wwebs|sseo|aads|aapli|pprog|ddise|rrede|mmaps|ccon|pproy|mes)\s+/i, '')
    .replace(/\bmes\s+seo\s+seo\b/gi, 'SEO')
    .replace(/\bseo\s+seo\b/gi, 'SEO')
    .replace(/(?:^|\s)--+(?=\s|$)/g, ' ');
  display = display.replace(/\[\s*\]|\(\s*\)/g, '');
  // Limpiar delimitadores pipe | y emojis visuales de Notion
  display = display.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ');
  display = display.replace(/\|/g, ' ');
  display = display.replace(/(?:^|\s)[01pd]\.(?=\s|$)/gi, ' ');
  display = display.replace(/(?:^|\s)#(?=\s|$)/g, ' ');
  display = display.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, '').trim();

  const finalParsed: VisualParts = {
    title: display || 'Sin título',
    rawTitle,
    workflow,
    workflowColor,
    area,
    monthCode,
    orderCode,
    domain: domain ? normalizeFtfDomain(rawName, domain) : '',
    contentSnippet,
  };
  if (visualPartsGlobalCache.size >= MAX_PARTS_CACHE) {
    const oldestKey = visualPartsGlobalCache.keys().next().value;
    if (oldestKey) visualPartsGlobalCache.delete(oldestKey);
  }
  visualPartsGlobalCache.set(cacheKey, finalParsed);
  return finalParsed;
}
