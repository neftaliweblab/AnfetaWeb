/** Join live edits to the disk snapshot in one pass, preserving day/order and metadata. */
export function composeCalendarSnapshot(
  snapshot:Record<string,any[]>, lives:Iterable<any>, updates:Iterable<[string,any]>,
  cleanId:(value:string)=>string, normalize:(value:any,index:number)=>any,
):Record<string,any[]> {
  const liveById=new Map<string,any>();
  for(const live of lives)if(live.dateStart)liveById.set(cleanId(live.id),live);
  const updateById=new Map(updates);
  const existingById=new Map<string,any>();
  const result:Record<string,any[]>={};
  for(const [day,activities] of Object.entries(snapshot)) {
    const seen=new Set<string>();
    result[day]=activities.filter(activity=>{
      const id=cleanId(activity.PageId||activity.pageId);
      if(liveById.has(id)&&!seen.has(id)){existingById.set(id,activity);seen.add(id);}
      return !liveById.has(id)&&!updateById.has(id);
    });
  }
  for(const [id,live] of liveById) {
    if(updateById.has(id))continue;
    const previous=existingById.get(id),existing=previous?normalize(previous,0):undefined;
    const activity=normalize({...existing,pageId:live.id,pageUrl:live.url,title:live.title,
      person:live.person||existing?.person,domain:live.domain||existing?.domain,status:live.status||existing?.status,
      isLocked:live.isLocked||existing?.isLocked,start:live.dateStart,end:live.dateEnd||existing?.end||live.dateStart},0);
    const day=live.dateStart.slice(0,10);
    (result[day]??=[]).push(activity);
  }
  for(const updated of updateById.values()) {
    const day=updated.start?.slice(0,10);
    if(day)(result[day]??=[]).push(updated);
  }
  return result;
}
