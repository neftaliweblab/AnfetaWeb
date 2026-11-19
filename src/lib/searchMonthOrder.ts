const MONTHS=['01ENE','02FEB','03MAR','04ABR','05MAY','06JUN','07JUL','08AGO','09SEP','10OCT','11NOV','12DIC'];
export function resultMonth(item:any){
  const title=String(item?.name||item?.title||item?.Name||'');
  const dated=title.match(/(?<!\d)(\d{4}|\d{2})-\[(0[1-9]|1[0-2])([A-Z]{3,4})\]/i);
  if(dated)return {year:dated[1].length===2?2000+Number(dated[1]):Number(dated[1]),month:Number(dated[2])};
  const struct=title.match(/(?:📅\s*)?(0?[1-9]|1[0-2])(?:[A-Za-z]{3,4})?\.[a-z]\.(?:f\d{1,3}|\d{1,2})\.\d{2}(?!\d)/i);
  if(struct)return {year:0,month:Number(struct[1])};
  const code=String(item?.monthChip||'')||title.match(/(?:^|[^a-z0-9])((?:0[1-9]|1[0-2])(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEPT?|OCT|NOVI?|DIC))(?=$|[^a-z0-9])/i)?.[1]||'';
  const upper=code.toUpperCase();
  const normalized=upper.replace(/^(\d{2})([A-Z]{3})[A-Z]*$/,'$1$2');
  const month=MONTHS.findIndex(value=>value===normalized||value.slice(2)===normalized)+1;
  return month?{year:0,month}:{year:0,month:0};
}
export function itemMatchesMonthFilter(item:any,selectedMonth:string){
  const target=String(selectedMonth||'').trim().toUpperCase();
  if(!target||target==='TODOS')return true;
  const {month}=resultMonth(item);
  if(month && MONTHS[month-1]===target)return true;
  return String(item?.name||item?.title||'').toUpperCase().includes(target);
}
export function resultMonthKey(item:any){const {year,month}=resultMonth(item);return month?'📅 Mes: '+(year?year+' · ':'')+MONTHS[month-1]+(year?'':' (sin año)'):'📅 Sin mes';}
export function sortMonthGroups<T extends {items:any[]}>(groups:T[],now=new Date()):T[]{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Mexico_City',year:'numeric',month:'numeric'}).formatToParts(now);
  const year=Number(parts.find(p=>p.type==='year')?.value),month=Number(parts.find(p=>p.type==='month')?.value);
  const rank=(group:T)=>{const value=resultMonth(group.items[0]);return !value.month?4:value.year===year&&value.month===month?0:!value.year&&value.month===month?1:value.year?2:3;};
  return [...groups].sort((a,b)=>rank(a)-rank(b)||(resultMonth(b.items[0]).year*12+resultMonth(b.items[0]).month)-(resultMonth(a.items[0]).year*12+resultMonth(a.items[0]).month));
}
