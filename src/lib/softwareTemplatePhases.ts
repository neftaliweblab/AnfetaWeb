export function softwareTemplatePhase(template:any):number|null{
 const title=String(template.Title||template.title||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 const fields=title.split('|').map(field=>field.trim());
 if(fields.length>=4&&/\b(?:ssoft|pprog)$/.test(fields[1])){
  const order=fields[2].match(/\b\d{2}\.[sp]\.0([1-4])\.00\s/);
  return order ? Number(order[1]) : null;
 }
 if(!/\bpprog\b/.test(title))return null;
 if(/\b1\.00?\b/.test(title)&&/definicion.*instalacion/.test(title))return 1;
 if(/\b2\.00?\b/.test(title)&&/tutoriales.*(?:cursos|web)/.test(title))return 2;
 if(/\b3\.00?\b/.test(title)&&/como.*utilizamos.*weblab/.test(title))return 3;
 if(/\b4\.00?\b/.test(title)&&/tutoriales.*cliente/.test(title))return 4;
 return null;
}
