import {ACTIVITY_TAGS,activityPerson,scanActivityTags} from '../services/activityTags';
const MONTHS=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
export function isWebTemplateTitle(projectToken:string,source:string){return /^(?:wwebs|webs?|sitio)$/i.test(projectToken.trim())||/💻\s*(?:wwebs|webs)\b/i.test(source)||(!projectToken&&/\bwwebs\b/i.test(source));}
function cleanDomain(value:string){return value.trim().replace(/^https?:\/\//i,'').replace(/[#[\]()]/g,'').split(/[\s/?]/)[0].replace(/^www\./i,'');}
function clientDomain(value:string){return cleanDomain(value).replace(/^(?:[01pd]|webs?)\./i,'').replace(/\.(?:webs?|seo|ads|aplicacion|software|proyecto|maps|cotizacion|redes)(?:\..*)?$/i,'');}
function originalDomains(source:string,domain:string){
  const tails=[...source.matchAll(/\(([^()]+)\)/g)].map(m=>m[1].trim()).filter(x=>/\.[a-z]{2}/i.test(x));
  const fields=source.split('|').filter(x=>x.includes('🌐'));
  const selected=[...fields,...tails,...(source.match(/\[[^\]]*dominio\.com[^\]]*\]/gi)||[])];
  const found=selected.flatMap(field=>[...field.matchAll(/(?:[a-z0-9_-]*\.)+[a-z][a-z0-9_-]{1,}/gi)].map(m=>m[0]));
  const mapped=found.flatMap(value=>{
    if(/(?:midominio|dominio|ejemplo)\.(?:com\.mx|com|mx)/i.test(value)){
      return domain?[value.replace(/(?:midominio|dominio|ejemplo)\.(?:com\.mx|com|mx)/i,domain)]:[];
    }
    return [value];
  });
  const unique=[...new Set(mapped)];
  return unique.filter(value=>!unique.some(other=>other!==value&&clientDomain(other)===clientDomain(value)&&other.length>value.length));
}
function keywordTags(source:string,description:string){
  const field=source.split('|').find(x=>x.includes('🛠'))||'';
  const explicit=field.replace(/🛠️?/gu,'').replace(/[[\]#]/g,'').split(/[\s-]+/).filter(x=>/^[a-záéíóúñ]{3,12}$/i.test(x)&&!/^descripcion$|^ffase/i.test(x));
  const stop=new Set(['a','al','de','del','el','en','la','las','lo','los','para','por','con','sin','un','una','y','o','que']);
  const words=description.normalize('NFD').replace(/\p{M}/gu,'').match(/[a-z]{3,}/gi)||[];
  return [...new Set((explicit.length?explicit:words.filter(x=>!stop.has(x.toLowerCase())).map(x=>x[0]+x.slice(0,4))).map(x=>x.toUpperCase()))].slice(0,10).join('-');
}
export function canonicalWebTemplateTitle(params:{selectedDate:Date;description:string;domain?:string;orderToken?:string;personName?:string;reviewerName?:string;reviewerNames?:string[];templateOriginalTitle?:string;state?:string;useSelectedMonth?:boolean}){
  const source=params.templateOriginalTitle||'',description=params.description.replace(/#/g,'').replace(/\s+/g,' ').trim();
  const explicitDomain=clientDomain(params.domain||'');
  const templateGlobe=(source.split('|').find(x=>x.includes('🌐'))||'').replace(/^.*🌐\s*#?/u,'').trim();
  const templateDomain=clientDomain(templateGlobe);
  const resolvedTemplateDomain=templateDomain&&!/^(?:dominio|midominio|ejemplo|example)\./i.test(templateDomain)?templateDomain:'';
  const domain=explicitDomain||resolvedTemplateDomain;
  const globeField=domain?'🌐 1.'+domain:'🌐';
  const teamFields=source.split('|').filter(field=>/👥|👤/u.test(field));
  const teamText=teamFields.length?teamFields.join(' '):source.split('✅')[0];
  const team=scanActivityTags(teamText).filter(tag=>!tag.token.replace(/-/g,'').endsWith('000')&&(teamFields.length||tag.token.includes('-')||/\d$/.test(tag.token)));
  const owner=params.personName===undefined?team.find(tag=>tag.role==='active')?.person:activityPerson(params.personName||'');
  const priorities=new Map(team.map(tag=>[tag.person,tag.priority||'11']));
  const people:string[]=[];
  if(owner)people.push(ACTIVITY_TAGS[owner].active+(priorities.get(owner)||'11'));
  for(const [person,priority] of priorities)if(person!==owner)people.push(ACTIVITY_TAGS[person].active+'-'+priority);
  const reviewerText=source.split('|').filter(field=>field.includes('✅')).join(' ');
  const existingReviewers=scanActivityTags(reviewerText).filter(tag=>/000$/.test(tag.token.replace(/-/g,''))).map(tag=>tag.person);
  const reviewers=[...new Set([...existingReviewers,...[params.reviewerName||'',...(params.reviewerNames||[])].map(activityPerson).filter((p):p is keyof typeof ACTIVITY_TAGS=>!!p)])].map(p=>ACTIVITY_TAGS[p].active+'-000');
  const explicitOrder=(params.orderToken||'').trim().match(/^f?(\d{1,2})\.(\d{2})$/i);
  const sourceCode=source.match(/(?:📅\s*)?(0?[1-9]|1[0-2])(?:[A-Z]{3,4})?\.[a-z]\.f?(\d{1,2})\.(\d{2})\b/i);
  const sourceMonth=sourceCode?.[1]||source.match(/(?:📅\s*)?(0?[1-9]|1[0-2])(?:[A-Z]{3,4})?\.[a-z]\./i)?.[1];
  const number=params.useSelectedMonth||!sourceMonth?params.selectedDate.getMonth()+1:Number(sourceMonth);
  const month=String(number).padStart(2,'0')+MONTHS[number-1];
  const phase=(explicitOrder?.[1]||sourceCode?.[2]||'01').padStart(2,'0'),version=explicitOrder?.[2]||sourceCode?.[3]||'00';
  const sourceState=source.trim().match(/^(aaprtuzR|aprtuzR|pprtuzR|prtuzR|rtuzR|tuzR|uzR|zR)\b/i)?.[1];
  const state=(params.state||sourceState||'prtuzR').toLowerCase().replace(/r$/,'R');
  const tags=keywordTags(source,description),originals=originalDomains(source,domain);
  return [state,'💻 WWEBS',globeField,'📅 '+month+'.W.f'+phase+'.'+version+' '+description,tags?'🛠 '+tags:'',people.length?'👥 '+people.join(' '):'',reviewers.length?'✅ '+reviewers.join(' '):'',originals.map(d=>'('+d+')').join(' ')].filter(Boolean).join(' | ');
}
