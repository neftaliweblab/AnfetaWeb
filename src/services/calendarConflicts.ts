import {normalizePerson} from './identityNormalizer';
export type CalendarSlot={pageId:string;person:string;title:string;start:string;end:string;isReviewMirror?:boolean};
const id=(value:string)=>value.replace(/-/g,'');
export function calendarConflict(slots:CalendarSlot[],moving:CalendarSlot){
  return slots.find(a=>!a.isReviewMirror&&id(a.pageId)!==id(moving.pageId)&&normalizePerson(a.person)===normalizePerson(moving.person)&&Date.parse(moving.start)<Date.parse(a.end)&&Date.parse(moving.end)>Date.parse(a.start));
}
export function nextFreeCalendarSlot(slots:CalendarSlot[],moving:CalendarSlot){
  const duration=Date.parse(moving.end)-Date.parse(moving.start),day=moving.start.slice(0,10);
  if(!Number.isFinite(duration)||duration<=0)return null;
  const limit=Date.parse(day+'T22:00:00-06:00');
  for(let at=Date.parse(moving.start);at+duration<=limit;at+=900000){
    const local=(ms:number)=>new Date(ms-21600000).toISOString().slice(0,19)+'-06:00';
    const candidate={...moving,start:local(at),end:local(at+duration)};
    if(!calendarConflict(slots,candidate))return {start:candidate.start,end:candidate.end};
  }
  return null;
}
export function nearbyFreeCalendarSlots(slots:CalendarSlot[],moving:CalendarSlot){
  const wanted=Date.parse(moving.start),duration=Date.parse(moving.end)-wanted;
  if(!Number.isFinite(wanted)||!Number.isFinite(duration)||duration<=0)return [];
  const day=new Date(wanted-21600000).toISOString().slice(0,10),first=Date.parse(day+'T08:00:00-06:00'),last=Date.parse(day+'T22:00:00-06:00');
  const local=(ms:number)=>new Date(ms-21600000).toISOString().slice(0,19)+'-06:00';
  const free:{start:string;end:string}[]=[];
  for(let at=first;at+duration<=last;at+=900000){const candidate={...moving,start:local(at),end:local(at+duration)};if(!calendarConflict(slots,candidate))free.push({start:candidate.start,end:candidate.end});}
  const before=free.filter(a=>Date.parse(a.start)<wanted).pop(),after=free.find(a=>Date.parse(a.start)>=wanted);
  return [before,after].filter((a):a is {start:string;end:string}=>!!a).sort((a,b)=>Math.abs(Date.parse(a.start)-wanted)-Math.abs(Date.parse(b.start)-wanted));
}
