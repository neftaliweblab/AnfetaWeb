import {revisionPhaseTitle} from '../services/progressiveWorkflow';
import {getCalendarPersonTag} from './templateCatalog';
import {activityPerson} from '../services/activityTags';
import {normalizePerson} from '@/services/identityNormalizer';
import {monthToken} from './drxUploadPlan';

export function typeWithEmoji(type: string): string {
  const t = (type || '').trim();
  if (!t) return '🌐 Actividad rápida';
  if (/^[\p{Emoji}\u200d]+/u.test(t)) return t;
  const lower = t.toLowerCase();
  if (/app|apli|aapli/i.test(lower)) return `💻 ${t}`;
  if (/web|webs|wwebs/i.test(lower)) return `🌐 ${t}`;
  if (/seo|sseo/i.test(lower)) return `🔍 ${t}`;
  if (/ads|aads/i.test(lower)) return `📢 ${t}`;
  if (/maps|mmaps/i.test(lower)) return `📍 ${t}`;
  if (/disen|diseñ|ddise/i.test(lower)) return `🎨 ${t}`;
  if (/prog|software|pprog/i.test(lower)) return `⚙️ ${t}`;
  if (/redes|rrede/i.test(lower)) return `📱 ${t}`;
  if (/coti|cotiz|ccoti/i.test(lower)) return `💼 ${t}`;
  if (/bibl|bblib/i.test(lower)) return `📚 ${t}`;
  if (/rapi|rrapi/i.test(lower)) return `⚡ ${t}`;
  if (/chat|cchat/i.test(lower)) return `💬 ${t}`;
  return `🌐 ${t}`;
}

export function quickRevisionTitle(input:{type?:string;title:string;person:string;domain:string;description?:string;month?:string}){
  const tag=getCalendarPersonTag(normalizePerson(input.person));
  if(!tag)throw Error('Selecciona un responsable válido para la actividad rápida.');
  const clean=(value:string)=>String(value||'').replace(/[\[\]\r\n|]/g,' ').replace(/\s+/g,' ').trim();
  const title=clean(input.title);
  const rawDomain=clean(input.domain).replace(/^[#\s]+/, '');
  const type=clean(input.type||'')||'Actividad rápida';
  if(!title||!rawDomain)throw Error('Completa el título y dominio de la actividad rápida.');
  
  // Normalizar dominio con prefijo d. si no trae p. o d.
  const domain = /^[pd]\./i.test(rawDomain) ? rawDomain : `d.${rawDomain}`;

  let rawMonth = String(input.month || monthToken()).trim();
  if (/^(0[1-9]|1[0-2])$/.test(rawMonth)) {
    const map: Record<string, string> = { '01':'01ENE','02':'02FEB','03':'03MAR','04':'04ABR','05':'05MAY','06':'06JUN','07':'07JUL','08':'08AGO','09':'09SEP','10':'10OCT','11':'11NOV','12':'12DIC' };
    rawMonth = `26-[${map[rawMonth] || '11NOV'}]`;
  } else if (/^(0[1-9]|1[0-2])[A-Z]{3}$/i.test(rawMonth)) {
    rawMonth = `26-[${rawMonth.toUpperCase()}]`;
  }
  if (!/^\d{2}-\[(01ENE|02FEB|03MAR|04ABR|05MAY|06JUN|07JUL|08AGO|09SEP|10OCT|11NOV|12DIC)\]$/i.test(rawMonth)) {
    throw Error('El mes de la actividad rápida no es válido.');
  }
  const month = rawMonth;
  const emojiType = typeWithEmoji(type);
  const formattedDomain = `🌐 #${domain}`;
  
  const titleHasMonthOrCode = /^\d{1,2}\.[a-z0-9.]+/i.test(title) || /^\d{2}-\[\d{2}[A-Z]+\]/i.test(title);
  const monthTitleSegment = titleHasMonthOrCode ? `📅 ${title}` : `📅 ${month} ${title}`;

  const segments: string[] = [
    emojiType,
    monthTitleSegment,
    formattedDomain,
  ];

  const cleanDesc = clean(input.description || '');
  if (cleanDesc) {
    segments.push(`🛠️ ${cleanDesc}`);
  }
  segments.push(`👤 ${tag}`);
  segments.push(`✅`);

  const structuredBody = `| ${segments.join(' | ')}`;
  const finalTitle = revisionPhaseTitle(structuredBody, 'pending').replace(/\s{2,}/g, ' ').trim();
  if(finalTitle.length>1900)throw Error('Reduce el título o descripción de la actividad rápida.');
  return finalTitle;
}
