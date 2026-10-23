/** Temporary replies and recording references may share a time slot with actual work. */
export function calendarEntryAllowsOverlap(title:string=''){
 return /\[RESPUESTA\]|\[GRABACI[OÓ]N\]/iu.test(title)||/(?<![\p{L}\p{N}_])grabaci[oó]n\s+\d{4}-\d{2}-\d{2}\b/iu.test(title);
}
export function recordingCreation(payload:any){
 return payload?.calendarEntryKind==='recording'&&Array.isArray(payload.files)&&payload.files.some((file:any)=>typeof file?.base64==='string'&&file.base64.length>0&&/^video\/(?:webm|mp4|quicktime)(?:;|$)/i.test(String(file.contentType||'')));
}
export function recordingCalendarTitle(payload:any){const title=String(payload.title||'');return recordingCreation(payload)&&! /\[GRABACI[OÓ]N\]/iu.test(title)?title+' [GRABACIÓN]':title;}
