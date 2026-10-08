import {mexicoDate,mexicoMinutes} from '@/services/calendarPresentation';

// Desktop finance lanes keep cards full width and stack coincident times.
export function financeCardLayout<T extends {start:string;end:string}>(items:T[],date:string,pixelsPerHour:number) {
  let nextTop=0;
  return [...items].sort((a,b)=>a.start.localeCompare(b.start)).map(item=>{
    const start=Math.max(480,mexicoDate(item.start)<date?480:mexicoMinutes(item.start));
    const end=mexicoDate(item.end)>date?1320:mexicoMinutes(item.end);
    const height=Math.min(70,Math.max(48,(end-start)/60*pixelsPerHour-6));
    const top=Math.max((start-480)/60*pixelsPerHour,nextTop);
    nextTop=top+height+4;
    return {item,start,top,height};
  });
}
