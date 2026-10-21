import {newestFirst} from './searchResultOrder';
export const SEARCH_SORTS=[['default','Orden habitual'],['name-asc','Título · A–Z'],['name-desc','Título · Z–A'],['scheduled-asc','Fecha por hacer · antigua primero'],['scheduled-desc','Fecha por hacer · reciente primero'],['modified-asc','Fecha modificada · antigua primero'],['modified-desc','Fecha modificada · reciente primero']] as const;
export function compareSearchRows(a:any,b:any,sort:string){
 if(sort==='default')return newestFirst(a,b);
 const direction=sort.endsWith('-desc')?-1:1;
 if(sort.startsWith('name-'))return direction*String(a.name||'').localeCompare(String(b.name||''),'es',{numeric:true,sensitivity:'base'});
 const field=sort.startsWith('scheduled-')?'scheduledDate':'serverModified';
 const date=(r:any)=>{const value=Date.parse(r[field]||(field==='serverModified'?r.modifiedLocalDate:'')||'');return Number.isFinite(value)?value:null;};
 const left=date(a),right=date(b);if(left===null)return right===null?0:1;if(right===null)return -1;return direction*(left-right);
}
export function lastSearchTerm(query:string){
 const tokens=query.match(/"[^"]+"|\S+/g)||[];let last='',negate=false;
 for(const token of tokens){if(/^(NOT|!)$/i.test(token)){negate=true;continue;}if(/^(AND|OR|&&|\|\||[()])$/i.test(token))continue;if(!negate&&!/^[-!]|^[a-z]+:/i.test(token))last=token.replace(/^["(]+|[)"]+$/g,'');negate=false;}
 return last;
}
