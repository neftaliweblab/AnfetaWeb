export const DELETED_PAGES_EVENT='anfeta_deleted_pages';
export const pageIdentity=(value:any)=>String(value?.externalId||value?.originalPageId||value?.pageId||value?.id||value||'').replace(/^review-mirror-/,'').replace(/-/g,'').toLowerCase();
export function deletedPages(owner:string):Set<string>{if(typeof window==='undefined')return new Set();try{return new Set(JSON.parse(localStorage.getItem('anfeta-deleted-pages:'+owner)||'[]'));}catch{return new Set();}}
export function filterDeletedPages<T>(rows:T[],owner:string){const ids=deletedPages(owner);return rows.filter(row=>!ids.has(pageIdentity(row)));}
export function restoreConfirmedPages(owner:string,values:string[]){const ids=deletedPages(owner),before=ids.size;for(const value of values)ids.delete(pageIdentity(value));if(ids.size===before)return;try{localStorage.setItem('anfeta-deleted-pages:'+owner,JSON.stringify([...ids]));}catch{}window.dispatchEvent(new CustomEvent(DELETED_PAGES_EVENT,{detail:{owner,ids:[...ids]}}));}
export function rememberDeletedPages(owner:string,values:string[]){
 const ids=deletedPages(owner),before=ids.size;for(const id of values){const clean=pageIdentity(id);if(/^[a-f0-9]{32}$/.test(clean))ids.add(clean);}if(ids.size===before)return;
 try{localStorage.setItem('anfeta-deleted-pages:'+owner,JSON.stringify([...ids]));}catch{}
 window.dispatchEvent(new CustomEvent(DELETED_PAGES_EVENT,{detail:{owner,ids:[...ids]}}));
}
