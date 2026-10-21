// Only a completed, healthy index can remove existing results.
export function retainSearchResults(previous:any[],data:any){
 if(!Array.isArray(data.items))return previous;
 const key=(item:any)=>String(item.source||'')+':'+String(item.externalId||item.id);
 const prior=new Map(previous.map(item=>[key(item),item]));
 const latest=(item:any)=>{const old=prior.get(key(item));return old&&Date.parse(old.serverModified||'')>Date.parse(item.serverModified||'1970-01-01')?old:item;};
 const deleted=new Set((data.deletedPageIds||[]).map((id:string)=>id.replace(/-/g,'').toLowerCase()));
 const keep=(item:any)=>!deleted.has(String(item.externalId||item.id||'').replace(/-/g,'').toLowerCase());
 if(!data.warning&&!data.loadingIndex&&!data.cacheMeta?.lastError&&!data.cacheMeta?.syncing)return data.items.map(latest).filter(keep);
 const merged=new Map(previous.map(item=>[key(item),item]));
 for(const item of data.items)merged.set(key(item),latest(item));
 return [...merged.values()].filter(keep);
}
