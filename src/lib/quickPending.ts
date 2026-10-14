export function parseQuickPending(value:string,now=new Date()){
 let title=value.trim();let person='',priority=4,date='';
 title=title.replace(/(?:^|\s)#([\p{L}\w-]+)/gu,(_,name)=>{person=name;return ' ';}).replace(/\bp([1-4])\b/gi,(_,n)=>{priority=Number(n);return '';});
 const words=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
 title=title.replace(/\b(hoy|mañana|domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/gi,word=>{const day=word.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');const target=new Date(now);if(day==='mañana'.normalize('NFD').replace(/\p{Diacritic}/gu,''))target.setDate(target.getDate()+1);else if(day!=='hoy'){const index=words.findIndex(w=>w.normalize('NFD').replace(/\p{Diacritic}/gu,'')===day);target.setDate(target.getDate()+((index-target.getDay()+7)%7||7));}date=[target.getFullYear(),String(target.getMonth()+1).padStart(2,'0'),String(target.getDate()).padStart(2,'0')].join('-');return '';});
 return {title:title.replace(/\s+/g,' ').trim(),scheduledDate:date,query:person?'#'+person:'',person,priority,isCompleted:false};
}
