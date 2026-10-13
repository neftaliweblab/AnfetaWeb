function traceFailure(response:Response){
 let endpoint='API',type:string|undefined,offset:string|undefined;
 try{const url=new URL(response.url);if(['/api/data','/api/auth','/auth','/api/messages','/api/reminders','/api/workspace','/api/presence','/api/push'].includes(url.pathname))endpoint=url.pathname;const kind=url.searchParams.get('type');if(['search-index','calendar','calendar-dates','notion-diagnostics','page-preview'].includes(kind||''))type=kind!;const value=url.searchParams.get('offset');if(value&&/^\d{1,8}$/.test(value))offset=value;}catch{}
 console.warn('[ANFETA API client]',{endpoint,type,offset,status:response.status});
}
export async function readApiJson(response:Response) {
  const text=await response.text();let data:any;
  try {data=JSON.parse(text);}catch{traceFailure(response);throw new Error('El servidor no pudo completar la consulta (HTTP '+response.status+'). Intenta de nuevo en unos segundos.');}
  if(!response.ok&&response.status>=500)traceFailure(response);
  if(!response.ok)throw new Error(data.error || 'No se pudo completar la consulta (HTTP '+response.status+').');
  return data;
}
