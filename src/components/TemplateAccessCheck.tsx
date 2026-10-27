"use client";
import {useEffect,useRef,useState} from 'react';
export function TemplateAccessCheck({pageIds}:{pageIds:string[]}){
 const [reports,setReports]=useState<any[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null);const identity=pageIds.join(',');
 useEffect(()=>{setReports([]);setError('');setBusy(false);return()=>controller.current?.abort();},[identity]);
 const check=async()=>{
  if(busy)return;const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setReports([]);
  try{for(const pageId of [...new Set(pageIds)]){
   const response=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'audit-template-access',payload:{pageId}}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(70000)])});
   const data=await response.json();if(!response.ok||!data.report)throw Error(data.error||'No se pudo verificar la plantilla.');
   if(!abort.signal.aborted)setReports(previous=>[...previous,data.report]);
  }}catch(error){if(!abort.signal.aborted)setError(error instanceof Error?error.message:'No se pudo completar la verificación.');}
  finally{if(!abort.signal.aborted)setBusy(false);}
 };
 return <div className="rounded-lg border border-slate-700 p-3 text-xs text-slate-300"><button type="button" disabled={busy||!pageIds.length} onClick={()=>void check()} className="rounded border border-cyan-700 px-3 py-2 text-cyan-200 disabled:opacity-50">{busy?'Verificando permisos y bloques…':'Verificar acceso y bloques de las plantillas'}</button><p className="mt-2 text-slate-400">Prueba de lectura: revisa todas las secciones y prepara la estructura de la copia sin crear páginas ni transferir archivos. La copia real también valida antes de crear cada actividad.</p>
 {error&&<p role="alert" className="mt-2 text-rose-300">{error}</p>}
 {reports.map(report=><div key={report.pageId} className="mt-3 border-t border-slate-700 pt-2"><a className="text-cyan-300 underline" href={'https://www.notion.so/'+report.pageId.replace(/-/g,'')} target="_blank" rel="noreferrer">Abrir plantilla en Notion</a><p className={report.readable?'text-emerald-300':'text-amber-300'}>{report.readable?'Copia independiente preparada sin errores':'Requiere corregir acceso, origen o contenido'} · {report.stats.columns} columnas · {report.stats.checklists} checks · {report.stats.synced} bloques sincronizados · {report.propertyCount} propiedades</p>{!!report.copyPreview?.pendingFileTransfers&&<p className="text-slate-400">{report.copyPreview.pendingFileTransfers} archivos pendientes de transferir al crear la actividad; sus transferencias aún no se han probado.</p>}{report.issues.map((issue:any,index:number)=><p key={index} className="mt-2 break-words text-amber-200">{issue.message} <a className="underline" href={'https://www.notion.so/'+report.pageId.replace(/-/g,'')+'#'+issue.blockId.replace(/-/g,'')} target="_blank" rel="noreferrer">Ver bloque {issue.blockId}</a></p>)}</div>)}
 </div>;
}
