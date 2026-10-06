export async function readApiJson(response:Response) {
  const text=await response.text();let data:any;
  try {data=JSON.parse(text);}catch{throw new Error('El servidor no pudo completar la consulta (HTTP '+response.status+'). Intenta de nuevo en unos segundos.');}
  if(!response.ok)throw new Error(data.error || 'No se pudo completar la consulta (HTTP '+response.status+').');
  return data;
}
