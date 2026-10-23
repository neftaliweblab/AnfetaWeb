/** Notion modification time orders confirmed data; unversioned reads cannot replace known versions. */
export function revisionTime(value:any){const n=Date.parse(value?.serverModified||'');return Number.isFinite(n)?n:null;}
export function staleActivity(incoming:any,previous:any){
 if(!previous)return false;
 const next=revisionTime(incoming),old=revisionTime(previous);
 if(next!==null&&old!==null)return next<old;
 const core=['title','name','person','assignedPerson','status','updateStatus','start','end','scheduledDate','scheduledEnd','ftfVerified','calendarActivity'].some(key=>incoming?.[key]!==undefined);
 return core&&old!==null&&next===null&&!incoming?.deleted&&!(Number(incoming?.localConfirmedAt)>Number(previous?.localConfirmedAt||0));
}
/** Retain distinct sparse fields while a particular page is being edited. */
export function mergePageDelta(previous:any,incoming:any,allowUnverified=false){
 if(!previous)return incoming;
 if((!allowUnverified&&!previous.unverified&&incoming.unverified)||staleActivity(incoming,previous))return previous;
 const nextStamp=revisionTime(incoming),oldStamp=revisionTime(previous);
 if(previous.deleted&&!incoming.deleted&&(nextStamp===null||(oldStamp!==null&&nextStamp<=oldStamp)))return previous;
 if(incoming.deleted)return {...incoming,calendarActivity:undefined,checklistUpdate:undefined};
 const card=incoming.calendarActivity;
 const fromCard=card?Object.fromEntries(Object.entries({name:card.title,assignedPerson:card.person,updateStatus:card.status,scheduledDate:card.start,scheduledEnd:card.end,serverModified:card.serverModified}).filter(([,v])=>v!==undefined)):{};
 const defined={...fromCard,...Object.fromEntries(Object.entries(incoming).filter(([,v])=>v!==undefined))};
 const result={...previous,...defined};
 if(incoming.deleted===false)result.deleted=false;
 if(incoming.calendarActivity)result.calendarActivity={...previous.calendarActivity,...Object.fromEntries(Object.entries(incoming.calendarActivity).filter(([,v])=>v!==undefined))};
 if(result.calendarActivity){
  const fields:any={title:(defined as any).name,person:(defined as any).assignedPerson,status:(defined as any).updateStatus,start:(defined as any).scheduledDate,end:(defined as any).scheduledEnd,ftfVerified:(defined as any).ftfVerified,ftfAvailable:(defined as any).ftfAvailable,serverModified:(defined as any).serverModified};
  result.calendarActivity={...result.calendarActivity,...Object.fromEntries(Object.entries(fields).filter(([,v])=>v!==undefined))};
 }
 return result;
}
