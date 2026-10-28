export type ContentClassification='all'|'project'|'documentation'|'unclassified';
export function contentClassification(title:string):Exclude<ContentClassification,'all'|'unclassified'>|''{const token=String(title||'').match(/(?:^|[\s[(])([pd])\.(?=\s|[a-z0-9-]+\.)/i)?.[1]?.toLowerCase();return token==='p'?'project':token==='d'?'documentation':'';}
export function matchesContentClassification(title:string,selected:string){const kind=contentClassification(title);return selected==='all'||!selected||selected==='unclassified'&&!kind||kind===selected;}
export function classifiedDomain(value:string){return value.replace(/^[pd]\.(?=[a-z0-9-]+\.)/i,'');}
