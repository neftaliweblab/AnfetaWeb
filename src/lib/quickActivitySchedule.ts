import {mexicoDate,calendarTime} from '@/services/calendarPresentation';
export function quickActivitySchedule(activity:{start:string;end:string},offset:number,duration:number|null){
  if(!Number.isInteger(offset)||offset< -1||offset>5)throw Error('Selecciona ayer o entre 1 y 5 días.');
  const day=mexicoDate(activity.start),target=new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
  const startTime=calendarTime(activity.start),startMinute=Number(startTime.slice(0,2))*60+Number(startTime.slice(3,5));
  const minutes=duration??(Date.parse(activity.end)-Date.parse(activity.start))/60000;
  if(!Number.isFinite(minutes)||minutes<=0||minutes%15||startMinute<480||startMinute+minutes>1320)throw Error('El horario debe estar entre 08:00 y 22:00 y usar bloques de 15 minutos.');
  const time=(value:number)=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
  return {start:target+'T'+time(startMinute)+':00-06:00',end:target+'T'+time(startMinute+minutes)+':00-06:00'};
}
