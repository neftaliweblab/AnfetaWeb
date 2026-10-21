export const UPLOAD_ACTIVITY_TYPES=['Actividad rápida','Documentar correo','Documentar contraseña','Asignar actividad','Otro'] as const;
export function documentationKind(type:string){const text=String(type||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();return text==='documentar correo'?'email':text==='documentar contrasena'?'password':'';}
export function assertDocumentationMode(input:any){if(documentationKind(input.quickType)&&input.mode!=='notion')throw Error('Los correos y contraseñas se documentan solo en Notion. Selecciona Solo Notion.');}
export function domainSuggestions(rows:any[],query:string){
 const text=query.trim().toLowerCase();if(text.length<3)return [];
 const domains=new Set<string>();
 for(const row of rows)for(const value of [row.domain,row.domainChip,row.name,row.Name])for(const match of String(value||'').matchAll(/(?<![@\w])(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com\.mx|org\.mx|com|mx|org|net|io|co|app|dev))(?![\w])/gi))domains.add(match[1].toLowerCase().replace(/^(?:webs|seo|ads|app|cotizacion)\./,''));
 return [...domains].filter(domain=>domain.includes(text)).sort((a,b)=>Number(!a.startsWith(text))-Number(!b.startsWith(text))||a.localeCompare(b)).slice(0,8);
}
