"use client";
export type ScheduleConflict={code:string;error:string;conflictTitle?:string;suggestedSlot?:{start:string;end:string}};
export function chooseScheduleConflict(conflict:ScheduleConflict):Promise<'overlap'|'nearest'|null>{
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Resolver empalme de horario');dialog.className='m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-amber-600 bg-slate-950 p-5 text-slate-100 shadow-2xl backdrop:bg-black/70';
  const heading=document.createElement('h2');heading.textContent='Elige cómo guardar el horario';heading.className='mb-3 font-semibold text-amber-200';
  const message=document.createElement('p');message.className='mb-4 text-sm text-slate-300';message.textContent=conflict.conflictTitle?'Coincide con «'+conflict.conflictTitle+'». Tu texto y archivos se conservan.':conflict.error;
  let done=false;const finish=(choice:'overlap'|'nearest'|null)=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(choice);};
  const button=(label:string,choice:'overlap'|'nearest'|null,tone:string)=>{const el=document.createElement('button');el.type='button';el.textContent=label;el.className='mt-2 block w-full rounded-lg border px-3 py-2 text-sm '+tone;el.onclick=()=>finish(choice);dialog.append(el);};
  dialog.append(heading,message);button('Guardar permitiendo empalme','overlap','border-amber-600 bg-amber-950 text-amber-100');
  if(conflict.suggestedSlot)button('Usar horario libre más cercano · '+conflict.suggestedSlot.start.slice(11,16)+'–'+conflict.suggestedSlot.end.slice(11,16),'nearest','border-cyan-700 bg-cyan-950 text-cyan-100');
  else{const note=document.createElement('p');note.textContent='No se encontró un espacio libre en esa jornada. Puedes empalmar o cancelar para elegir otra fecha.';note.className='mt-3 text-xs text-slate-400';dialog.append(note);}
  button('Cancelar; conservar mis datos',null,'border-slate-700');dialog.oncancel=e=>{e.preventDefault();finish(null);};dialog.onclose=()=>finish(null);document.body.append(dialog);dialog.showModal();
 });
}
/** Only explicit pre-write conflicts can be retried. Network/ambiguous failures are returned untouched. */
export async function fetchWithScheduleChoice(url:string,init:RequestInit,choose=chooseScheduleConflict):Promise<Response>{
 let body=typeof init.body==='string'?JSON.parse(init.body):null;
 for(let count=0;count<4;count++){
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(115000),body:body?JSON.stringify(body):init.body});
  const data=await response.clone().json().catch(()=>null);
  if(data?.code!=='SCHEDULE_CONFLICT')return response;
  const choice=await choose(data);if(!choice)throw Error('Guardado cancelado. Tu texto y archivos se conservan.');
  if(!body?.payload)throw Error('No se pudo recuperar la propuesta de horario.');
  body={...body,payload:{...body.payload,...(choice==='overlap'?{allowOverlap:true}:{start:data.suggestedSlot.start,end:data.suggestedSlot.end,allowOverlap:false})}};
 }
 throw Error('El horario cambió varias veces. Conservamos tus datos; actualiza y vuelve a elegir.');
}
