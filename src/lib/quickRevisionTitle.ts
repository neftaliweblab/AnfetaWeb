import {revisionPhaseTitle} from '../services/progressiveWorkflow';
import catalog from '../../data/notion_template_phase1_catalog_v2.json';
import {getCalendarPersonTag} from './templateCatalog';
import {activityPerson,scanActivityTags} from '../services/activityTags';
import {normalizePerson} from '@/services/identityNormalizer';
import {monthToken} from './drxUploadPlan';
export function quickRevisionTitle(input:{type?:string;title:string;person:string;domain:string;description?:string;month?:string}){
  const tag=getCalendarPersonTag(normalizePerson(input.person));
  if(!tag)throw Error('Selecciona un responsable válido para la actividad rápida.');
  const clean=(value:string)=>String(value||'').replace(/[\[\]\r\n]/g,' ').replace(/\s+/g,' ').trim();
  const title=clean(input.title),domain=clean(input.domain),type=clean(input.type||'')||'Actividad rápida';
  if(!title||!domain)throw Error('Completa el título y dominio de la actividad rápida.');
  const month=input.month||monthToken();if(!/^\d{2}-\[(01ENE|02FEB|03MAR|04ABR|05MAY|06JUN|07JUL|08AGO|09SEP|10OCT|11NOV|12DIC)\]$/.test(month))throw Error('El mes de la actividad rápida no es válido.');
  const person=activityPerson(input.person)!;
  const candidates=catalog.Items.filter(row=>/\[ttipo-actividad(?:-rrapi rapido)?\]/i.test(row.Title));
  const specific=candidates.find(row=>scanActivityTags(row.Title).some(t=>t.person===person));
  const template=specific||candidates.find(row=>!scanActivityTags(row.Title).length)||candidates[0];
  if(!template)throw Error('No se encontró la plantilla rápida del responsable.');
  let source=template.Title;
  if(specific){for(const token of scanActivityTags(source).filter(t=>t.person===person).reverse())source=source.slice(0,token.index)+tag+source.slice(token.index+token.token.length);}
  const result=source.replace(/\[ttipo-actividad(?:-rrapi rapido)?\]/i,()=>`[${type}]`).replace(/\d{2}-\[\d{2}[A-Z]+\]/,()=>month).replace('[TITULO ACTIVIDAD]',()=>title+(specific?'':' '+tag)).replace(/\[((?:[pd]\.)?)dominio\.com([^\]]*)\]/i,(_,prefix,suffix)=>`[${prefix}${domain.replace(/^[pd]\./i,'')}${suffix}]`).replace('[AGREGAR DESCRIPCION ACTIVIDAD]',()=>clean(input.description||''));
  if(result.length>1900)throw Error('Reduce el título o descripción de la actividad rápida.');
  return revisionPhaseTitle(result,'pending').replace(/\s+/g,' ').trim();
}
