export const FTF_CHECKBOX='Check FTF Pasos Verificados Hoy';
export function ftfField(page:any):[string,any]|undefined{
 const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
 return Object.entries(page.properties||{}).find(([name,p]:any)=>normalize(name)===normalize(FTF_CHECKBOX)&&p.type==='checkbox') as [string,any]|undefined;
}
export function ftfState(page:any){const field=ftfField(page);return {ftfVerified:field?.[1].checkbox===true,ftfAvailable:!!field};}
