import {rememberDeletedPages,restoreConfirmedPages,deletedPages,pageIdentity,setUnverifiedPage,clearUnverifiedPage,PAGE_SYNC_CHANNEL} from './deletedPages';
type Subscriber={rows:()=>any[];onStates:(states:any[])=>boolean|void;calendar:boolean;pending:Map<string,any>};
const hubs=new Map<string,PageWatchHub>();
/** One incremental connection per account/window, shared by visible panels. */
class PageWatchHub{
  contentVersions=new Map<string,string>();
  subscribers=new Set<Subscriber>();controller=new AbortController();cursor:string|null=null;
  token='';busy=false;probeBusy=false;queued=false;stopped=false;nextProbe=0;probeCursor=0;restoreCursor=0;
  backoff=new Map<string,{failures:number;until:number}>();timer:ReturnType<typeof setInterval>|undefined;
  channel:BroadcastChannel|null=null;
  constructor(readonly owner:string){
    try{this.channel=new BroadcastChannel(PAGE_SYNC_CHANNEL);this.channel.onmessage=e=>{if(e.data?.owner===owner&&Array.isArray(e.data.states))this.deliver(e.data.states);};}catch{}
    window.addEventListener('online',this.wake);window.addEventListener('focus',this.wake);
    window.addEventListener('anfeta_activity_saved',this.saved);document.addEventListener('visibilitychange',this.wake);
  }
  wake=()=>{if(!document.hidden)void this.check();};
  saved=()=>{if(this.busy)this.queued=true;else this.wake();};
  schedule(){if(this.timer)clearInterval(this.timer);this.timer=setInterval(this.wake,[...this.subscribers].some(s=>s.calendar)?2000:10000);}
  deliver(states:any[]){
    const removed=states.filter(s=>s.deleted).map(s=>s.id),restored=states.filter(s=>s.deleted===false&&!s.unverified).map(s=>s.id);
    if(removed.length)rememberDeletedPages(this.owner,removed);if(restored.length)restoreConfirmedPages(this.owner,restored);
    for(const state of states){if(state.unverified)setUnverifiedPage(state.id,state.reason);else clearUnverifiedPage(state.id);}
    for(const state of states)if(state.contentChanged&&state.serverModified&&this.contentVersions.get(state.id)!==state.serverModified){this.contentVersions.set(state.id,state.serverModified);if(this.contentVersions.size>512)this.contentVersions.delete(this.contentVersions.keys().next().value!);window.dispatchEvent(new CustomEvent('anfeta_page_content_changed',{detail:{pageId:state.id}}));}
    for(const subscriber of this.subscribers){for(const state of states){const id=pageIdentity(state.id),old=subscriber.pending.get(id);if(old&&((!old.unverified&&state.unverified)||Date.parse(old.serverModified||'')>Date.parse(state.serverModified||'')))continue;subscriber.pending.set(id,state);}this.flush(subscriber);}
  }
  flush(subscriber:Subscriber){if(!subscriber.pending.size)return;try{if(subscriber.onStates([...subscriber.pending.values()])!==false)subscriber.pending.clear();}catch{/* Keep unapplied events. */}}
  async check(){
    if(this.stopped||this.busy||document.hidden)return;
    this.busy=true;for(const subscriber of this.subscribers)this.flush(subscriber);
    let token='';try{token=JSON.parse(localStorage.getItem('anfeta_settings')||'{}').notionToken||'';}catch{}
    if(this.token!==token){this.token=token;this.cursor=null;this.nextProbe=0;this.contentVersions.clear();for(const s of this.subscribers)s.pending.clear();}
    const headers={'Content-Type':'application/json',...(token?{'x-notion-token':token}:{})};
    try{
      const sync=await fetch('/api/data',{method:'POST',headers,signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(8000)]),body:JSON.stringify({action:'sync-page-events',payload:{since:this.cursor,limit:100}})});
      if(sync.ok&&!this.stopped){const data=await sync.json();if(Array.isArray(data.events)){
        const states=data.events.map((e:any)=>({id:pageIdentity(e.pageId),deleted:e.state==='deleted'?true:e.state==='active'?false:undefined,unverified:e.state==='unverified',reason:e.unverifiedReason,name:e.properties?.name,assignedPerson:e.properties?.assignedPerson,updateStatus:e.properties?.updateStatus,scheduledDate:e.properties?.scheduledDate,scheduledEnd:e.properties?.scheduledEnd,ftfVerified:e.properties?.ftfVerified,ftfAvailable:e.properties?.ftfAvailable,calendarActivity:e.properties?.calendarActivity,checklistUpdate:e.properties?.checklistUpdate,contentChanged:e.eventType==='page.content_updated',serverModified:e.serverModified}));
        if(states.length)this.deliver(states);if(data.timestamp)this.cursor=data.timestamp;if(data.hasMore)this.queued=true;
      }}
    }catch{/* Keep data and cursor on failure. */}
    this.busy=false;
    void this.probe(headers);
    if(this.queued&&!this.stopped){this.queued=false;queueMicrotask(()=>void this.check());}
  }
  async probe(headers:Record<string,string>){
    if(this.probeBusy)return;
    try{
      if(!this.stopped&&!this.probeBusy&&Date.now()>=this.nextProbe){
        this.probeBusy=true;
        this.nextProbe=Date.now()+60000;
        const candidates=[...new Set([...this.subscribers].sort((a,b)=>Number(b.calendar)-Number(a.calendar)).flatMap(s=>s.rows()).filter(row=>row.source==='Notion'||row.pageId).map(pageIdentity))].filter(id=>/^[a-f0-9]{32}$/.test(id)&&(this.backoff.get(id)?.until||0)<=Date.now());
        const removed=[...deletedPages(this.owner)],ids:string[]=[],count=Math.min(removed.length?3:4,candidates.length);
        for(let i=0;i<count;i++)ids.push(candidates[(this.probeCursor+i)%candidates.length]);
        if(count)this.probeCursor=(this.probeCursor+count)%candidates.length;if(removed.length)ids.push(removed[this.restoreCursor++%removed.length]);
        if(ids.length){
          const res=await fetch('/api/data',{method:'POST',headers,signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(30000)]),body:JSON.stringify({action:'notion-page-states',payload:{ids}})}),data=await res.json();
          if(res.ok&&!this.stopped&&Array.isArray(data.states)){
            for(const state of data.states){if(state.unverified){const failures=(this.backoff.get(state.id)?.failures||0)+1;this.backoff.set(state.id,{failures,until:failures>=3?Date.now()+60000:0});}else this.backoff.delete(state.id);}
            this.deliver(data.states);
          }
        }
      }
    }catch{/* An unavailable page is never assumed deleted. */}
    finally{this.probeBusy=false;}
  }

  stop(){this.stopped=true;this.controller.abort();if(this.timer)clearInterval(this.timer);this.channel?.close();window.removeEventListener('online',this.wake);window.removeEventListener('focus',this.wake);window.removeEventListener('anfeta_activity_saved',this.saved);document.removeEventListener('visibilitychange',this.wake);}
}
export function subscribeNotionPages(owner:string,options:{rows:()=>any[];onStates:(states:any[])=>boolean|void;calendar?:boolean}){
  let hub=hubs.get(owner);if(!hub){hub=new PageWatchHub(owner);hubs.set(owner,hub);}
  const subscriber:Subscriber={...options,calendar:!!options.calendar,pending:new Map()};hub.subscribers.add(subscriber);hub.schedule();void hub.check();
  return ()=>{hub!.subscribers.delete(subscriber);if(!hub!.subscribers.size){hub!.stop();hubs.delete(owner);}else hub!.schedule();};
}
