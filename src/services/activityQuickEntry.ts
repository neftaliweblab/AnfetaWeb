import {notionRequest} from './notionMutations';
import {assertChecklistAccess,invalidateChecklist} from './notionCalendar';
import {setChecklistItemPlans} from './checklistPlanning';
export async function activityQuickEntry(settings:any,actor:string,input:any,comment:boolean){
 if(typeof input.pageId!=='string'||!/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(input.pageId))throw Error('Página de actividad inválida.');
 const raw=String(input.text||'').trim(),highlight=input.isHighlighted===true;
 const plannedDate=!comment&&typeof input.plannedDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input.plannedDate.trim())?input.plannedDate.trim():undefined;
 const baseText=(highlight?'⚡ ':'')+raw;
 const text=plannedDate?`${baseText} [${plannedDate}]`:baseText;
 if(!raw||text.length>2000)throw Error('Escribe entre 1 y 2,000 caracteres incluyendo el prefijo.');
 await assertChecklistAccess(settings,actor,input.pageId);
 const rich_text=[{type:'text',text:{content:text},annotations:{bold:highlight,color:highlight?'orange':'default'}}];
 try{
  const response=comment?await notionRequest(settings,'comments','POST',{parent:{page_id:input.pageId},rich_text}):await notionRequest({...settings,notionApiVersion:'2026-03-11'},'blocks/'+input.pageId+'/children','PATCH',{position:{type:'start'},children:[{object:'block',type:'to_do',to_do:{rich_text,checked:false}}]});
  const saved=comment?response:response.results?.[0];
  if(!saved?.id)throw Error('Notion no confirmó el nuevo elemento.');
  invalidateChecklist(settings,input.pageId);
  if(!comment&&plannedDate){await setChecklistItemPlans(settings,input.pageId,[{blockId:saved.id,plannedDate}],actor);}
  return {id:saved.id,blockId:comment?undefined:saved.id,text:baseText,isChecked:false,...(plannedDate?{plannedDate}:{})};
 }catch(error){
  invalidateChecklist(settings,input.pageId);
  throw Error('No se confirmó el guardado. Revisa la página antes de repetir. '+(error instanceof Error?error.message:''));
 }
}
