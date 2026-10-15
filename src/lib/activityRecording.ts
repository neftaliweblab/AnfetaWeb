export type RecordingTarget={id:string;title:string;typeLabel:string;type:string};
export const RECORD_ACTIVITY_EVENT='anfeta_record_activity';
export function recordingTarget(value:any):RecordingTarget|null{
  if(!value||typeof value.id!=='string'||!/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value.id)||typeof value.title!=='string'||!value.title.trim())return null;
  return {id:value.id,title:value.title,type:'actividad',typeLabel:'Actividad'};
}
export function requestActivityRecording(target:RecordingTarget){return !window.dispatchEvent(new CustomEvent(RECORD_ACTIVITY_EVENT,{detail:target,cancelable:true}));}
