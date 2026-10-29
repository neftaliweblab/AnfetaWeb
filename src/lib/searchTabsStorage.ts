import {ACTIVITY_TAGS,type ActivityPerson} from '../services/activityTags';
import {normalizePerson} from '../services/identityNormalizer';
export interface StoredSearchTab {id:string;query:string;canClose:boolean;unseen?:boolean;pending?:boolean;remindAt?:number}
export function findSearchTab(tabs:StoredSearchTab[],query:string){return tabs.find(tab=>tab.query.trim()===query.trim());}
export function parseSearchTabs(raw:string|null):{tabs:StoredSearchTab[];activeTabId:string}|null{
  if(!raw)return null;
  try{const data=JSON.parse(raw),seen=new Set<string>();
    if(!Array.isArray(data.tabs)||!data.tabs.length)return null;
    const tabs=data.tabs.map((tab:any,index:number)=>{if(typeof tab.id!=='string'||!tab.id||seen.has(tab.id)||typeof tab.query!=='string'||tab.query.length>4000)throw Error('Invalid tab');seen.add(tab.id);return {id:tab.id,query:tab.query,canClose:index!==0,unseen:tab.unseen===true,pending:tab.pending===true,...(typeof tab.remindAt==='number'&&Number.isFinite(tab.remindAt)&&tab.remindAt>0?{remindAt:tab.remindAt}:{})};});
    return {tabs,activeTabId:seen.has(data.activeTabId)?data.activeTabId:tabs[0].id};
  }catch{return null;}
}

/** Restore personal work on startup while retaining edited searches in another tab. */
export function personalFirstSearch(saved:NonNullable<ReturnType<typeof parseSearchTabs>>,owner:string){
 const person=normalizePerson(owner),entry=ACTIVITY_TAGS[person as ActivityPerson];
 if(!entry)return saved;
 const id='personal:'+person;
 const query=[...['00','11','22','33'].map(p=>entry.active+p),entry.active+'000',entry.review].join(' OR ');
 const existing=saved.tabs.find(t=>t.id===id);
 const others=saved.tabs.filter(t=>t.id!==id).map(t=>({...t,canClose:true}));
 if(existing?.query.trim()&&existing.query!==query&&!others.some(t=>t.query===existing.query)){
  let recovered=id+':saved';while(others.some(t=>t.id===recovered))recovered+=':copy';
  others.push({...existing,id:recovered,canClose:true});
 }
 return {tabs:[{...existing,id,query,canClose:false},...others],activeTabId:id};
}

/** Initial props and owner changes must not overwrite restored personal searches. */
export function isExternalSearchChange(previous:{owner:string;value:string|undefined},owner:string,value:string|undefined){
 return previous.owner===owner&&previous.value!==value&&value!==undefined;
}

/** Recover legacy tabs by merging; never replace current searches. */
export function recoverSearchTabs(current:StoredSearchTab[],legacy:NonNullable<ReturnType<typeof parseSearchTabs>>){
 const next=[...current],ids=new Set(next.map(t=>t.id));
 for(const tab of legacy.tabs){if(next.some(t=>t.query===tab.query))continue;let id='recovered:'+tab.id;while(ids.has(id))id+=':copy';ids.add(id);next.push({...tab,id,canClose:true});}
 return next;
}
