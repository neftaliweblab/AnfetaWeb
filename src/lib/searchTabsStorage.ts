import {ACTIVITY_TAGS,type ActivityPerson} from '../services/activityTags';
import {normalizePerson} from '../services/identityNormalizer';
export function parseSearchTabs(raw:string|null):{tabs:{id:string;query:string;canClose:boolean}[];activeTabId:string}|null{
  if(!raw)return null;
  try{const data=JSON.parse(raw),seen=new Set<string>();
    if(!Array.isArray(data.tabs)||!data.tabs.length||data.tabs.length>31)return null;
    const tabs=data.tabs.map((tab:any,index:number)=>{if(typeof tab.id!=='string'||!tab.id||seen.has(tab.id)||typeof tab.query!=='string'||tab.query.length>4000)throw Error('Invalid tab');seen.add(tab.id);return {id:tab.id,query:tab.query,canClose:index!==0};});
    return {tabs,activeTabId:seen.has(data.activeTabId)?data.activeTabId:tabs[0].id};
  }catch{return null;}
}

/** Prepend once without rewriting saved queries, tab IDs or other searches. */
export function personalFirstSearch(saved:NonNullable<ReturnType<typeof parseSearchTabs>>,owner:string){
 const person=normalizePerson(owner),entry=ACTIVITY_TAGS[person as ActivityPerson];
 if(!entry)return saved;
 const id='personal:'+person;
 const existing=saved.tabs.find(t=>t.id===id);
 const personal=existing||{id,query:['00','11','22','33'].map(p=>entry.active+p).join(' OR '),canClose:false};
 const tabs=[{...personal,canClose:false},...saved.tabs.filter(t=>t.id!==id).map(t=>({...t,canClose:true}))];
 return {tabs,activeTabId:id};
}
