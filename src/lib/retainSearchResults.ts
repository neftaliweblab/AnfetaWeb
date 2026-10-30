import {pageIdentity} from './deletedPages';

// Only a completed, healthy index can remove existing results.
export function retainSearchResults(previous:any[],data:any){
 if(!Array.isArray(data.items))return previous;
 const key=(item:any)=>{
  const pid=pageIdentity(item);
  if(pid&&(item.source==='Notion'||/^[a-f0-9]{32}$/.test(pid)))return 'notion:'+pid;
  return String(item.source||'')+':'+String(item.path||item.externalId||item.id);
 };
 const prior=new Map(previous.map(item=>[key(item),item]));
 const latest=(item:any)=>{
  const old=prior.get(key(item));
  if(!old)return item;
  if(item.isReviewMirror&&!old.isReviewMirror)return old;
  if(old.isReviewMirror&&!item.isReviewMirror)return item;
  return Date.parse(old.serverModified||'')>Date.parse(item.serverModified||'1970-01-01')?old:item;
 };
 const deleted=new Set((data.deletedPageIds||[]).map((id:string)=>id.replace(/-/g,'').toLowerCase()));
 const keep=(item:any)=>!deleted.has(pageIdentity(item))&&!item.isReviewMirror&&!item.IsReviewMirror;
 if(!data.warning&&!data.loadingIndex&&!data.cacheMeta?.lastError&&!data.cacheMeta?.syncing){
  const out=new Map<string,any>();
  for(const item of data.items){
   if(!keep(item))continue;
   out.set(key(item),latest(item));
  }
  return [...out.values()];
 }
 const merged=new Map(previous.map(item=>[key(item),item]));
 for(const item of data.items){
  if(!keep(item))continue;
  merged.set(key(item),latest(item));
 }
 return [...merged.values()].filter(keep);
}
