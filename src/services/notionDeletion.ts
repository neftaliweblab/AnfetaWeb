/** Never treat a missing/inaccessible page as a confirmed deletion. */
export async function archiveNotionPage(token:string,id:string,request:typeof fetch=fetch){
 const call=async(method:string,body?:any)=>{
  const response=await request('https://api.notion.com/v1/pages/'+id,{method,headers:{Authorization:'Bearer '+token.trim(),'Notion-Version':'2022-06-28','Content-Type':'application/json'},signal:AbortSignal.timeout(15000),...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(response.status===404?'No se puede verificar esta página: puede no existir o faltar acceso a la integración. Actualiza o revisa los permisos.':data.message||'Notion respondió '+response.status);
  return data;
 };
 const page=await call('GET');if(page.archived||page.in_trash)return {alreadyArchived:true};
 try{const result=await call('PATCH',{archived:true});if(!result.archived&&!result.in_trash){const confirmed=await call('GET');if(!confirmed.archived&&!confirmed.in_trash)throw Error('Notion no confirmó que la página esté archivada.');}return {alreadyArchived:false};}
 catch(error){try{const current=await call('GET');if(current.archived||current.in_trash)return {alreadyArchived:true};}catch{}throw error;}
}
