import {notionRequest} from './notionMutations';
import {assertChecklistAccess,invalidateChecklist} from './notionCalendar';
export async function activityQuickEntry(settings:any,actor:string,input:any,comment:boolean){
 if(typeof input.pageId!=='string'||!/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(input.pageId))throw Error('Página de actividad inválida.');
 const raw=String(input.text||'').trim(),highlight=input.isHighlighted===true;const text=(highlight?'⚡ ':'')+raw;if(!raw||text.length>2000)throw Error('Escribe entre 1 y 2,000 caracteres incluyendo el prefijo.');
 await assertChecklistAccess(settings,actor,input.pageId);
 const rich_text=[{type:'text',text:{content:text},annotations:{bold:highlight,color:highlight?'orange':'default'}}];
 try{const response=comment?await notionRequest(settings,'comments','POST',{parent:{page_id:input.pageId},rich_text}):await notionRequest(settings,'blocks/'+input.pageId+'/children','PATCH',{children:[{object:'block',type:'to_do',to_do:{rich_text,checked:false}}]});const saved=comment?response:response.results?.[0];if(!saved?.id)throw Error('Notion no confirmó el nuevo elemento.');invalidateChecklist(settings,input.pageId);return {id:saved.id,blockId:comment?undefined:saved.id,text,isChecked:false};}catch(error){invalidateChecklist(settings,input.pageId);throw Error('No se confirmó el guardado. Revisa la página antes de repetir. '+(error instanceof Error?error.message:''));}
}
