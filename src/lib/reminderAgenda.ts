export function validAgendaDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function agendaRange(date:string,view:string){if(!validAgendaDate(date))throw new Error('Fecha inválida.');const d=new Date(date+'T00:00:00Z'),iso=(v:Date)=>v.toISOString().slice(0,10);if(view==='week'){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const end=new Date(d);end.setUTCDate(end.getUTCDate()+6);return {start:iso(d),end:iso(end)};}if(view==='month'){const start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));return {start:iso(start),end:iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)))};}return {start:date,end:date};}
export function validAgendaRange(start:string,end:string){return validAgendaDate(start)&&validAgendaDate(end)&&end>=start&&(Date.parse(end)-Date.parse(start))/86400000<=30;}
export function filterAgenda<T extends {title:string;assignee_id:string}>(items:T[],person:string,text:string){const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return items.filter(v=>(!person||v.assignee_id===person)&&fold(v.title).includes(fold(text.trim())));}
export function remindersCsv(items:any[],people:{id:string;name:string}[]){const cell=(v:unknown)=>{let s=String(v??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return '\uFEFF'+[['Fecha','Hora','Recordatorio','Persona','Prioridad','Estado'],...items.map(i=>[i.due_date,i.due_time.slice(0,5),i.title,people.find(p=>p.id===i.assignee_id)?.name||'Persona asignada',({low:'Baja',medium:'Normal',high:'Alta',urgent:'Urgente'} as any)[i.priority]||i.priority,i.completed?'Completado':'Pendiente'])].map(row=>row.map(cell).join(',')).join('\r\n');}
export function shiftAgendaDate(date:string,view:string,direction:number){
 if(!validAgendaDate(date)||![1,-1].includes(direction))throw new Error('Fecha o dirección inválida.');
 const d=new Date(date+'T00:00:00Z');
 if(view==='month'){const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+direction);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}
 else d.setUTCDate(d.getUTCDate()+direction*(view==='week'?7:1));
 return d.toISOString().slice(0,10);
}
