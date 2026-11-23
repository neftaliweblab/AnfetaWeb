import {scheduleAtDrop} from '../services/activityPermissions';
import type {NotionCalendarActivity} from '@/types/anfeta';
export function calendarDropSchedule(activity:NotionCalendarActivity,date:string,input:{clientY:number;canvasTop:number;offsetY:number;pixelsPerHour:number}){
  if(!Number.isFinite(input.pixelsPerHour)||input.pixelsPerHour<=0||![input.clientY,input.canvasTop,input.offsetY].every(Number.isFinite))throw Error('No se pudo calcular el horario del movimiento.');
  const y=Math.max(0,input.clientY-input.canvasTop-Math.max(0,input.offsetY));
  return scheduleAtDrop(activity,date,y/input.pixelsPerHour*60);
}
export function calendarSaveError(data:any){
  return Object.assign(new Error(data?.error||'Notion no confirmó el guardado.'),{
    code:data?.code,conflictTitle:data?.conflictTitle,suggestedSlot:data?.suggestedSlot,
  });
}
