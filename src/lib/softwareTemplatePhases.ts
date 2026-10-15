export const SOFTWARE_PHASES=[{id:1,label:'1.0 · Definición / instalación'},{id:2,label:'2.0 · Tutoriales'},{id:3,label:'3.0 · Uso en Weblab'},{id:4,label:'4.0 · Uso del cliente'}];
export function softwareTemplatePhase(template:any):number|null{
 const title=String(template.Title||template.title||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 if(!/\bpprog\b/.test(title))return null;
 if(/\b1\.00?\b/.test(title)&&/definicion.*instalacion/.test(title))return 1;
 if(/\b2\.00?\b/.test(title)&&/tutoriales.*(?:cursos|web)/.test(title))return 2;
 if(/\b3\.00?\b/.test(title)&&/como.*utilizamos.*weblab/.test(title))return 3;
 if(/\b4\.00?\b/.test(title)&&/tutoriales.*cliente/.test(title))return 4;
 return null;
}
