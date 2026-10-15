import catalog from '../../data/notion_template_phase1_catalog_v2.json';
import {getCalendarPersonTag} from './templateCatalog';
import {normalizePerson} from '@/services/identityNormalizer';
import {monthToken} from './drxUploadPlan';
export function quickRevisionTitle(input:{type?:string;title:string;person:string;domain:string;description?:string;month?:string}){
  const tag=getCalendarPersonTag(normalizePerson(input.person));
  if(!tag)throw Error('Selecciona un responsable válido para la actividad rápida.');
  const clean=(value:string)=>String(value||'').replace(/[\[\]\r\n]/g,' ').replace(/\s+/g,' ').trim();
  const title=clean(input.title),domain=clean(input.domain),type=clean(input.type||'')||'Actividad rápida';
  if(!title||!domain)throw Error('Completa el título y dominio de la actividad rápida.');
  const month=input.month||monthToken();if(!/^\d{2}-\[(01ENE|02FEB|03MAR|04ABR|05MAY|06JUN|07JUL|08AGO|09SEP|10OCT|11NOV|12DIC)\]$/.test(month))throw Error('El mes de la actividad rápida no es válido.');
  const specific=catalog.Items.find(row=>/\[ttipo-actividad(?:-rrapi rapido)?\]/i.test(row.Title)&&row.Title.includes(' '+tag+' '));
  const template=specific||catalog.Items.find(row=>/\[ttipo-actividad\]/i.test(row.Title)&&/\[TITULO ACTIVIDAD\]\s+\[dominio.com\]/.test(row.Title));
  if(!template)throw Error('No se encontró la plantilla rápida del responsable.');
  const result=template.Title.replace(/\[ttipo-actividad(?:-rrapi rapido)?\]/i,()=>`[${type}]`).replace(/\d{2}-\[\d{2}[A-Z]+\]/,()=>month).replace('[TITULO ACTIVIDAD]',()=>title+(specific?'':' '+tag)).replace('[dominio.com]',()=>`[${domain}]`).replace('[AGREGAR DESCRIPCION ACTIVIDAD]',()=>clean(input.description||''));
  if(result.length>1900)throw Error('Reduce el título o descripción de la actividad rápida.');
  return result.replace(/\s+/g,' ').trim();
}
