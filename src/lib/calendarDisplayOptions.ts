/** Display only: these settings never participate in schedule mutations. */
export const CALENDAR_GRID_INTERVALS=[5,10,15,20,30,60] as const;
export const CALENDAR_HEIGHT_MIN=48;
export const CALENDAR_HEIGHT_MAX=576;
export const CALENDAR_WIDTH_MIN=180;
export const CALENDAR_WIDTH_MAX=800;
export const CALENDAR_DISPLAY_PRESETS=[
 {id:'compact',label:'Compacta',height:48,width:200},
 {id:'normal',label:'Normal',height:72,width:260},
 {id:'wide',label:'Amplia',height:144,width:320},
 {id:'tall',label:'Extraalta',height:288,width:400},
] as const;
export function calendarGridInterval(value:number){return (CALENDAR_GRID_INTERVALS as readonly number[]).includes(value)?value:30;}
export function calendarHourDivisions(interval:number){const step=calendarGridInterval(interval);return Array.from({length:60/step-1},(_,i)=>(i+1)*step);}
export function calendarLabelDivisions(interval:number,height:number){
 const all=calendarHourDivisions(interval);
 // Keep fine grid lines but omit overlapping labels at compact scales.
 if(height*calendarGridInterval(interval)/60>=12)return all;
 return all.filter(minute=>minute%15===0);
}
export function calendarDisplayHeight(value:number){return Number.isFinite(value)?Math.min(CALENDAR_HEIGHT_MAX,Math.max(CALENDAR_HEIGHT_MIN,value)):72;}
export function calendarDisplayWidth(value:number){return Number.isFinite(value)?Math.min(CALENDAR_WIDTH_MAX,Math.max(CALENDAR_WIDTH_MIN,value)):260;}
