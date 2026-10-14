export function parseSearchTabs(raw:string|null):{tabs:{id:string;query:string;canClose:boolean}[];activeTabId:string}|null{
  if(!raw)return null;
  try{const data=JSON.parse(raw),seen=new Set<string>();
    if(!Array.isArray(data.tabs)||!data.tabs.length||data.tabs.length>30)return null;
    const tabs=data.tabs.map((tab:any,index:number)=>{if(typeof tab.id!=='string'||!tab.id||seen.has(tab.id)||typeof tab.query!=='string'||tab.query.length>4000)throw Error('Invalid tab');seen.add(tab.id);return {id:tab.id,query:tab.query,canClose:index!==0};});
    return {tabs,activeTabId:seen.has(data.activeTabId)?data.activeTabId:tabs[0].id};
  }catch{return null;}
}
