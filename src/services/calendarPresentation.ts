
const TYPES: [RegExp, string][] = [
  [/\b(?:aads|ads|google\s*ads|campañas?)\b/i, 'ADS'],
  [/\b(?:sseo|seo|posicionamiento|keywords)\b/i, 'SEO'],
  [/\b(?:wwebs|webs?|wordpress|landing|elementor|hosting)\b/i, 'WEBS'],
  [/\b(?:mmaps|maps|gmb|google\s*maps)\b/i, 'MAPS'],
  [/\b(?:ddise|diseño|diseno|branding|flyer|logo)\b/i, 'DISEÑO'],
  [/\b(?:aapli|aplicaci[oó]n|apps?)\b/i, 'APLICACIÓN'],
  [/\b(?:pprog|programas?|software)\b/i, 'PROGRAMAS'],
  [/\b(?:rrede|redes|social)\b/i, 'REDES'],
  [/\b(?:cobranza|cobros?|pagos?|factura)\b/i, 'COBRO'],
  [/\b(?:soporte|ticket|mantenimiento)\b/i, 'SOPORTE'],
];
export function calendarDomain(title: string, project = '') {
  const match = (project + ' ' + title).match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|vip|app|edu|gob|co|ai|dev|info|biz|us|es|online|site)(?=[\s/\](),:;]|$)/i);
  if (!match) return 'general';
  return match[0].replace(/^https?:\/\//i,'').replace(/^(?:(?:www|webs|web|ads|seo|maps|cotizacion|biblioteca|aplicacion|software|proyecto)\.)+/i,'').toLowerCase();
}
export function calendarType(title: string, project = '') {
  // Official tokens take priority over words in the description.
  const official = title.match(/\b(aads|sseo|wwebs|mmaps|ddise|aapli|pprog|rrede)\b/i)?.[0];
  return TYPES.find(([pattern]) => pattern.test(official || title + ' ' + (/^(sin|no content|general)/i.test(project) ? '' : project)))?.[1] || null;
}
export function calendarUrgent(title: string) {
  return /(?:^|\s)00(?:\s|$)|\b(?:jjohn|john|nneft|nnetf|iisai|ggena|kkarl|aandr|bbria|ssote|aacal|eemma)0{2,4}\b/i.test(title);
}
export function calendarDisplayTitle(title: string, domain = '') {
  let text = title.replace(/\[COPIA REVISIÓN\]\s*/gi, '')
    .replace(/\b(?:sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION|TERMINAD[OA]|PENDIENTE|Bloqueada_ANFETA)\b/gi, '')
    .replace(/\b(?:jjohn|nneft|nnetf|kkarl|bbria|iisai|iisaia|aandr|ggena|ssote|aacal|eemma)(?:0{2,4}|00[1-3])?\b/gi, '')
    .replace(/\b(?:aads|sseo|wwebs|mmaps|ddise|aapli|pprog|rrede|cchat|rrapi|mmapi|bblib|ccoti|coti)\b/gi, '')
    .replace(/(?:\b\d{2}-)?\[\d{2,4}[A-ZÁÉÍÓÚ]+\]/gi, '')
    .replace(/\(?\b\d{2,4}(?:-)?(?:0[1-9]|1[0-2])?(?:ENER|FEBR|MARZ|ABRI|MAYO|JUNI|JULI|AGOS|SEPT|OCTU|NOVI|DICI|ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\b\)?/gi, '')
    .replace(/(?:^|\s)00(?=\s|$)/g, ' ');
  if (domain && !/^(general|DOMINIO)$/i.test(domain)) {
    const escaped = domain.replace(/[.*+?^{}$()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp('(?<![a-z0-9.-])(?:\\b(?:www|webs|web|seo|ads|maps|cotizacion|biblioteca|proyecto)\\.)*' + escaped + '(?![a-z0-9.-])', 'gi'), ' ');
  }
  text = text.replace(/\s+\b(?:en|de|del|la|el|los|las|por|para|con)\s*$/i, '').replace(/^\s*\d+(?:\.\d+)?(?:\s*[-–]\s*|\s+)/, '').replace(/\s+/g, ' ').replace(/^[\s·|—–-]+|[\s·|—–-]+$/g,'').trim();
  return text || 'Actividad';
}
export function mexicoDate(value: string | Date = new Date()) {
  const date = typeof value === 'string' ? new Date(value.length === 10 ? value + 'T12:00:00-06:00' : /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + '-06:00') : value;
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return part('year') + '-' + part('month') + '-' + part('day');
}
export function mexicoMinutes(value: string) {
  if (!value) return 480;
  const date = new Date(value.length === 10 ? value + 'T08:00:00-06:00' : /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + '-06:00');
  if (!Number.isFinite(date.getTime())) return 480;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone:'America/Mexico_City', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(date);
  return Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value);
}
export function calendarTime(value: string) {
  const minutes = mexicoMinutes(value);
  return String(Math.floor(minutes / 60)).padStart(2,'0') + ':' + String(minutes % 60).padStart(2,'0');
}
export function calendarInterval(start: string, end: string, day = mexicoDate(start)) {
  const dayStart = Date.parse(day + 'T00:00:00-06:00');
  const parse = (v: string) => Date.parse(v.length === 10 ? v + 'T08:00:00-06:00' : /(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? v : v + '-06:00');
  const a = parse(start), b = parse(end);
  const s = Number.isFinite(a) ? (a-dayStart)/60000 : 480;
  const e = Number.isFinite(b) && b > a ? (b-dayStart)/60000 : s + 60;
  return { start: Math.max(480, Math.min(1320, s)), end: Math.max(480, Math.min(1320, e)) };
}
