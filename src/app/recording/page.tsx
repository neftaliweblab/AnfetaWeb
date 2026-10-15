"use client";
import {useEffect,useState} from 'react';
type Item={id:string;title:string;url?:string;filename?:string};
export default function RecordingPage(){
 const [data,setData]=useState<{pageId:string;pageUrl:string;items:Item[]}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[unauthorized,setUnauthorized]=useState(false),[failed,setFailed]=useState(false);

 const isEmbed = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('embed') === '1' || new URLSearchParams(window.location.search).get('embed') === 'true');

 useEffect(()=>{
   const abort=new AbortController();
   setLoading(true);
   setError('');
   setFailed(false);
   setUnauthorized(false);
   const params=new URLSearchParams(window.location.search);
   fetch('/api/recording?'+params.toString(),{signal:abort.signal,cache:'no-store'}).then(async response=>{
     const body=await response.json();
     if(response.status===401)setUnauthorized(true);
     if(!response.ok)throw Error(body.error);
     setData(body);
   }).catch(e=>{
     if(!abort.signal.aborted)setError(e.message);
   }).finally(()=>{
     if(!abort.signal.aborted)setLoading(false);
   });
   return()=>abort.abort();
 },[retry]);

 const item=data?.items.find(i=>i.url);

 if (isEmbed) {
   if (loading) {
     return (
       <div className="h-screen w-screen bg-[#080E16] flex items-center justify-center p-3 text-cyan-400 text-xs font-mono">
         <span className="animate-pulse">Cargando video…</span>
       </div>
     );
   }
   if (error || !item) {
     return (
       <div className="h-screen w-screen bg-[#080E16] flex flex-col items-center justify-center p-4 text-center text-xs text-amber-200 space-y-2">
         <p>{error || 'No se encontró el video de esta grabación.'}</p>
         <a href={data?.pageUrl || '/'} target="_blank" rel="noreferrer" className="text-cyan-400 underline font-medium">
           Abrir actividad en Notion ↗
         </a>
       </div>
     );
   }
   return (
     <div className="relative h-screen w-screen bg-black flex items-center justify-center overflow-hidden group select-none">
       <video
         key={item.url}
         src={item.url}
         controls
         playsInline
         preload="metadata"
         onError={()=>setFailed(true)}
         className="h-full w-full object-contain bg-black"
       />
       {failed && (
         <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 text-center text-xs text-amber-200 space-y-2">
           <p>El formato WebM no se pudo reproducir en este visor.</p>
           <a href={item.url} target="_blank" rel="noreferrer" className="rounded bg-cyan-700 px-3 py-1.5 text-white font-medium hover:bg-cyan-600">
             Abrir video original ↗
           </a>
         </div>
       )}
     </div>
   );
 }

 return <main className="h-dvh overflow-y-auto bg-[#080e16] px-4 py-8 text-slate-200"><div className="mx-auto max-w-5xl space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-cyan-400">ANFETA · GRABACIONES</p><h1 className="mt-2 text-xl font-semibold text-white">{item?.title||'Grabaciones de la actividad'}</h1></div><a href={data?.pageUrl||'/'} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">{data?'Abrir actividad en Notion':'Abrir ANFETA'}</a></header>
 {loading?<p role="status" className="rounded-xl border border-slate-800 p-8">Preparando grabación…</p>:error?<section role="alert" className="rounded-xl border border-amber-900 bg-amber-950/20 p-5 space-y-4"><p>{error}</p>{unauthorized&&<a href="/" target="_blank" rel="noreferrer" className="inline-block text-cyan-300 underline">Entrar a ANFETA en otra pestaña</a>}<button onClick={()=>setRetry(n=>n+1)} className="ml-3 rounded bg-cyan-800 px-4 py-2">Volver a cargar</button></section>:item?<section className="space-y-4 rounded-2xl border border-slate-800 bg-[#101a27] p-3 sm:p-5"><video key={item.url} src={item.url} controls playsInline preload="metadata" onError={()=>setFailed(true)} className="max-h-[72dvh] w-full rounded-xl bg-black"/>{failed&&<p role="alert" className="text-sm text-amber-200">Este navegador no pudo reproducir el archivo. Prueba abrir el original o recargar para renovar su dirección.</p>}<div className="flex flex-wrap items-center gap-3 text-sm"><a href={item.url} target="_blank" rel="noreferrer" className="rounded-lg bg-cyan-700 px-4 py-2">Abrir video original</a><button onClick={()=>setRetry(n=>n+1)} className="rounded-lg border border-slate-700 px-4 py-2">Renovar reproducción</button><span className="min-w-0 break-all text-xs text-slate-400">{item.filename}</span></div></section>:<section className="grid gap-3">{data?.items.map(i=><a key={i.id} href={'/recording?page='+encodeURIComponent(data.pageId)+'&upload='+encodeURIComponent(i.id)} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#101a27] p-5 hover:border-cyan-600"><span className="text-cyan-300">▶</span><span className="min-w-0 break-words">{i.title}</span></a>)}</section>}
 <p className="text-xs text-slate-500">Acceso con tu sesión de ANFETA. El enlace de esta página se conserva; la dirección temporal del archivo se renueva al cargar.</p></div></main>;
}
