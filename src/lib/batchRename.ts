export type RenameEntry = {item:any;newName:string};
export type RenameFailure = RenameEntry & {error:string};
/** Keep partial successes, and never infer success from an empty/non-JSON 200. */
export async function runBatchRename(entries:RenameEntry[], onSaved:(entry:RenameEntry,data:any)=>void, request:typeof fetch=fetch){
 const saved:RenameEntry[]=[],failed:RenameFailure[]=[],warnings:string[]=[];
 for(const entry of entries){
  if(entry.newName===entry.item.name)continue;
  try{
   if(!entry.newName.trim())throw Error('El título no puede quedar vacío.');
   const response=await request('/api/data',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'rename-item',payload:{id:entry.item.externalId||entry.item.id,source:entry.item.source,oldName:entry.item.name,newName:entry.newName,path:entry.item.target||entry.item.path}})});
   const data=await response.json().catch(()=>null);
   if(!response.ok||data?.success!==true)throw Error(data?.error||'No se confirmó el renombrado (HTTP '+response.status+'). Actualiza antes de reintentar.');
   saved.push(entry);
   try{onSaved(entry,data);}catch{warnings.push('El nombre se guardó, pero falta actualizar la vista.');}
  }catch(error){failed.push({...entry,error:error instanceof Error?error.message:'No se confirmó el renombrado.'});}
 }
 return {saved,failed,warnings};
}
