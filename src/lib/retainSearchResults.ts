// Only a completed, healthy index can remove existing results.
export function retainSearchResults(previous:any[],data:any){
 if(!Array.isArray(data.items))return previous;
 if(!data.warning&&!data.cacheMeta?.lastError&&!data.cacheMeta?.syncing)return data.items;
 const key=(item:any)=>String(item.source||'')+':'+String(item.externalId||item.id);
 const merged=new Map(previous.map(item=>[key(item),item]));
 for(const item of data.items)merged.set(key(item),item);
 return [...merged.values()];
}
