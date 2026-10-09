"use client";
import React,{useState,useEffect,useRef} from 'react';
import {X,Upload,Loader2,Folder,ChevronRight,FolderPlus} from 'lucide-react';
import {detectUpload,drxFolder,monthToken,projectCategories,softwareCategories,replaceUploadPrefix,uploadFilename} from '@/lib/drxUploadPlan';
export interface GlobalPasteImagePayload {contentType?:string;dataUrl:string;base64:string;filename:string;sizeBytes:number;}
interface Props {currentUser:string;initialFiles?:GlobalPasteImagePayload[];isOpen:boolean;onClose:()=>void;initialText?:string;initialImage?:GlobalPasteImagePayload|null;onSuccess:(item:any)=>void;initialDestination?:'both'|'dropbox'|'notion';initialDomain?:string;}
const EMPTY:GlobalPasteImagePayload[]=[];
const reviewers=[{name:'(Sin asignar)',tag:'',person:''},{name:'🚨 John 0000 (Urgente)',tag:'john0000',person:'jjohn00'},{name:'👤 Neftalí',tag:'nneft',person:'nneft'},{name:'👤 Andrade',tag:'aandr',person:'aandr'},{name:'👤 Genaro',tag:'ggena',person:'ggena'},{name:'👤 Karla',tag:'kkarl',person:'kkarl'}];
export function GlobalPasteModal({isOpen,currentUser,initialFiles=EMPTY,initialText='',initialImage=null,onClose,onSuccess,initialDestination,initialDomain}:Props){
  const [files,setFiles]=useState<GlobalPasteImagePayload[]>([]),
        [mode,setMode]=useState<'both'|'dropbox'|'notion'>('both'),
        [domain,setDomain]=useState(''),
        [root,setRoot]=useState('proyecto'),
        [category,setCategory]=useState('proyecto'),
        [month,setMonth]=useState(monthToken),
        [person,setPerson]=useState(''),
        [title,setTitle]=useState(''),
        [body,setBody]=useState(''),
        [separate,setSeparate]=useState(false),
        [busy,setBusy]=useState(false),
        [error,setError]=useState(''),
        [status,setStatus]=useState(''),
        [locked,setLocked]=useState(false);

  // Selector de carpeta de Dropbox mediante la API
  const [customFolder, setCustomFolder] = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [cloudFolders, setCloudFolders] = useState<{name:string;path:string}[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [pickerError, setPickerError] = useState('');

  const loadFolders = async (path = '') => {
    setLoadingFolders(true);
    setPickerError('');
    try {
      const res = await fetch(`/api/data?type=dropbox-folders&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error cargando carpetas');
      setCloudFolders(data.folders || []);
      setBrowsePath(path);
    } catch (e: any) {
      setPickerError(e.message || 'No se pudieron cargar las carpetas.');
    } finally {
      setLoadingFolders(false);
    }
  };

  useEffect(() => {
    if (showFolderPicker && cloudFolders.length === 0 && !loadingFolders) {
      loadFolders('');
    }
  }, [showFolderPicker]);

  const prefixRef=useRef('');
useEffect(()=>{if(!isOpen)return;const batch=initialFiles.length?initialFiles:initialImage?[initialImage]:[];const detected=detectUpload([initialDomain,initialText,...batch.map(f=>f.filename)].join(' '));const d=initialDomain||detected.domain,m=monthToken();let saved:any='both';let savedDraft:any=null;try{saved=localStorage.getItem('anfeta_upload_destination')||'both';const rawDraft=localStorage.getItem('anfeta_upload_draft');if(rawDraft)savedDraft=JSON.parse(rawDraft);}catch{}setMode(initialDestination||(['both','dropbox','notion'].includes(saved)?saved:'both'));setFiles(batch);setDomain(d||savedDraft?.domain||'');setRoot(detected.root);setCategory(detected.category);setMonth(m);setPerson(savedDraft?.person||'');setBody(initialText||savedDraft?.body||'');setSeparate(false);setError('');setStatus('');setLocked(false);setBusy(false);const prefix=[d||savedDraft?.domain,detected.root,m].filter(Boolean).join(' ');prefixRef.current=prefix;let description=batch.length===1?batch[0].filename.replace(/\.[a-z0-9]{1,12}$/i,''):savedDraft?.title||'';if(/^(Captura_ANFETA|image|clipboard|tmp|codex-clipboard)/i.test(description))description='';if(d)description=description.split(d).join('').trim();setTitle([prefix,description].filter(Boolean).join(' '));},[isOpen,initialFiles,initialImage,initialText,initialDestination,initialDomain]);
useEffect(()=>{if(!isOpen||!domain)return;try{localStorage.setItem('anfeta_upload_draft',JSON.stringify({domain,title,body,person,updatedAt:Date.now()}));}catch{}},[domain,title,body,person,isOpen]);
useEffect(()=>{if(!isOpen)return;const prefix=[domain,root,month,person].filter(Boolean).join(' ');if(prefix===prefixRef.current)return;const previous=prefixRef.current;setTitle(old=>replaceUploadPrefix(old,previous,prefix));prefixRef.current=prefix;},[domain,root,month,person,isOpen]);
if(!isOpen)return null;let folder='';try{folder=drxFolder(domain,root,category);}catch{}const count=files.length,chosen=reviewers.find(p=>p.tag===person);
async function submit(e:React.FormEvent){
  e.preventDefault();
  if(busy||locked)return;
  setError('');
  if(mode!=='notion'&&!folder&&!customFolder){
    setError('Escribe el dominio para construir la ruta DRX o elige una carpeta.');
    return;
  }
  if(!files.length&&!body.trim()){
    setError('Agrega contenido o archivos.');
    return;
  }
  if(files.reduce((n,f)=>n+f.sizeBytes,0)>2500000){
    setError('Este envío supera 2.5 MB. Reduce el lote para enviarlo por la web.');
    return;
  }
  setBusy(true);
  try{
    const response=await fetch('/api/data',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        action:'unified-upload',
        payload:{
          mode,
          domain,
          root,
          category,
          customFolder: customFolder || undefined,
          person:chosen?.person||'',
          title:title.trim(),
          body,
          files,
          separatePages:separate,
          currentUser
        }
      })
    });
    const raw=await response.text();
    let data:any;
    try{data=JSON.parse(raw);}catch{throw new Error('El servidor no pudo completar la subida (HTTP '+response.status+').');}
    for(const [index,item] of (data.receipts||[]).entries()){
      if(item.kind==='event')continue;
      onSuccess(item.kind==='notion'?{id:item.pageId,externalId:item.pageId,name:item.activity?.title||title,path:item.pageUrl,externalUrl:item.pageUrl,source:'Notion',type:'PAGE'}:{id:'dropbox-'+Date.now()+'-'+index,name:item.filename,path:item.path,target:item.path,folder:item.targetDir,source:'Dropbox',type:'FILE',sizeBytes:item.sizeBytes});
    }
    if(!response.ok||!data.success){
      if(data.receipts?.length){
        setLocked(true);
        setStatus(data.receipts.length+' operaciones ya guardadas. Revisa el error antes de iniciar otro envío.');
      }
      throw new Error(data.error||'La subida no se completó.');
    }
    const warnings=[...(data.warnings||[]),data.warning].filter(Boolean);
    setLocked(true);
    setStatus('Guardado correctamente.'+(warnings.length?' '+warnings.join(' '):''));
    try{
      localStorage.setItem('anfeta_upload_destination',mode);
      localStorage.removeItem('anfeta_upload_draft');
    }catch{}
    if(!warnings.length)onClose();
  }catch(e){
    setError(e instanceof Error?e.message:'No se pudo subir.');
  }finally{
    setBusy(false);
  }
}
const style='min-w-0 w-full bg-[#131E2E] border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-sky-400';
return <div role="dialog" aria-modal="true" aria-label="Subir archivo" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
  <form onSubmit={submit} className="w-full max-w-4xl max-h-[94dvh] overflow-auto rounded-2xl border border-cyan-600/50 bg-[#0C131D] shadow-2xl p-4 space-y-3 text-slate-200">
    <header className="flex items-center gap-2">
      <Upload className="text-sky-400" size={22}/>
      <h2 className="text-lg font-semibold">Subir archivo</h2>
      {count>0&&<span title={files.map(f=>f.filename).join('\n')} className="text-xs text-cyan-300">📦 {count} archivos</span>}
      <button type="button" disabled={busy} aria-label="Cerrar" onClick={onClose} className="ml-auto cursor-pointer"><X size={20}/></button>
    </header>
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1">
      {([{id:'both',label:'🌐 Notion + Dropbox'},{id:'dropbox',label:'📦 Solo Dropbox'},{id:'notion',label:'📝 Solo Notion'}] as const).map(x=>
        <label key={x.id} className={'cursor-pointer rounded-lg p-2 text-center text-xs '+(mode===x.id?'bg-sky-900 text-cyan-200 ring-1 ring-cyan-600':'text-slate-400')}>
          <input type="radio" name="destination" checked={mode===x.id} onChange={()=>setMode(x.id)} className="sr-only"/>{x.label}
        </label>
      )}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      <label className="text-xs">Dominio<input aria-label="Dominio" value={domain} onChange={e=>setDomain(e.target.value.toLowerCase())} className={style} placeholder="dominio.com"/></label>
      {mode!=='notion'&&<>
        <label className="text-xs">Tipo<select value={root} onChange={e=>{setRoot(e.target.value);setCategory(e.target.value);}} className={style}><option value="proyecto">Proyecto</option><option value="software">Software</option></select></label>
        <label className="text-xs">Categoría<select value={category} onChange={e=>setCategory(e.target.value)} className={style}>{(root==='software'?softwareCategories:projectCategories).map(c=><option key={c}>{c}</option>)}</select></label>
      </>}
      <label className="text-xs">Mes<input value={month} onChange={e=>setMonth(e.target.value)} className={style}/></label>
      <label className="text-xs">Persona / Revisor<select value={person} onChange={e=>setPerson(e.target.value)} className={style}>{reviewers.map(p=><option key={p.tag} value={p.tag}>{p.name}</option>)}</select></label>
    </div>
    <label className="block text-xs">Título / Nombre<input aria-label="Título / Nombre" autoFocus value={title} onChange={e=>setTitle(e.target.value)} className={style} placeholder="Descripción del archivo"/></label>
    {count>1&&mode!=='dropbox'&&<select aria-label="Organización de páginas" value={separate?'separate':'single'} onChange={e=>setSeparate(e.target.value==='separate')} className={style}><option value="single">Una sola página para todos</option><option value="separate">Páginas separadas</option></select>}

    {/* Barra de Destino en Dropbox con opción de elegir carpeta desde la API */}
    {mode!=='notion'&&(
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-sky-400" />
            <span>Carpeta de destino en Dropbox:</span>
          </span>
          <button
            type="button"
            onClick={() => setShowFolderPicker(!showFolderPicker)}
            className="text-[11px] text-cyan-400 hover:text-cyan-200 underline font-medium cursor-pointer"
          >
            {showFolderPicker ? 'Ocultar explorador' : '📁 Elegir carpeta en Dropbox (API)...'}
          </button>
        </div>

        {customFolder ? (
          <div className="flex items-center justify-between rounded-lg bg-emerald-950/40 border border-emerald-600/50 px-3 py-2 text-xs text-emerald-300">
            <span className="truncate">✓ Carpeta personalizada: {customFolder}</span>
            <button
              type="button"
              onClick={() => setCustomFolder('')}
              className="text-[10px] text-slate-400 hover:text-white underline ml-2"
            >
              Restablecer a DRX automática
            </button>
          </div>
        ) : (
          <div title={folder} className="rounded-lg bg-cyan-900/15 border border-cyan-800/40 px-3 py-2 text-xs text-cyan-300 truncate">
            📁 {folder?folder.split('/').filter(Boolean).join(' → '):'Completa el dominio o elige carpeta'} → {uploadFilename(title,files[0]?.filename||'Contenido.txt',0,count||1)}
          </div>
        )}

        {/* Explorador interactivo de carpetas con Dropbox API */}
        {showFolderPicker && (
          <div className="rounded-xl border border-[#203348] bg-[#0A1018] p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-[#1A2838] pb-2">
              <div className="flex items-center gap-1 text-[11px] text-slate-300 overflow-x-auto scrollbar-none font-mono">
                <button
                  type="button"
                  onClick={() => loadFolders('')}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Dropbox /
                </button>
                {browsePath.split('/').filter(Boolean).map((part, idx, arr) => {
                  const subPath = '/' + arr.slice(0, idx + 1).join('/');
                  return (
                    <React.Fragment key={subPath}>
                      <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                      <button
                        type="button"
                        onClick={() => loadFolders(subPath)}
                        className="text-cyan-300 hover:underline shrink-0 cursor-pointer"
                      >
                        {part}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {browsePath && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomFolder(browsePath);
                    setShowFolderPicker(false);
                  }}
                  className="px-2.5 py-1 rounded bg-[#0284C7] hover:bg-[#0369A1] text-white text-[11px] font-semibold cursor-pointer shrink-0"
                >
                  Seleccionar esta carpeta
                </button>
              )}
            </div>

            {pickerError && (
              <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/60 p-2 rounded">
                {pickerError} (Revisa que tu token de Dropbox en Vercel esté activo)
              </div>
            )}

            {loadingFolders ? (
              <div className="flex items-center gap-2 py-4 text-xs text-slate-400 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Cargando carpetas desde Dropbox API...</span>
              </div>
            ) : cloudFolders.length === 0 ? (
              <div className="py-3 text-center text-slate-400 text-[11px]">
                No hay más subcarpetas aquí.
                {browsePath && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFolder(browsePath);
                      setShowFolderPicker(false);
                    }}
                    className="block mx-auto mt-1 text-cyan-400 underline font-semibold cursor-pointer"
                  >
                    Usar &quot;{browsePath}&quot; como destino
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {cloudFolders.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-[#131E2C] transition-colors border border-transparent hover:border-[#1E2E42]"
                  >
                    <button
                      type="button"
                      onClick={() => loadFolders(f.path)}
                      className="flex items-center gap-2 text-slate-200 hover:text-cyan-300 text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomFolder(f.path);
                        setShowFolderPicker(false);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#16273A] hover:bg-[#1E3752] text-cyan-300 border border-[#234568] shrink-0 ml-2 cursor-pointer"
                    >
                      Elegir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )}

    <details open={!count&&Boolean(initialText)}><summary className="cursor-pointer text-xs text-slate-400">Contenido y adjuntos</summary><textarea aria-label="Contenido" value={body} onChange={e=>setBody(e.target.value)} rows={3} className={style}/><input type="file" multiple disabled={busy} aria-label="Adjuntar archivos" onChange={async e=>{const selected=Array.from(e.target.files||[]);try{const batch=await Promise.all(selected.map(file=>new Promise<GlobalPasteImagePayload>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const dataUrl=String(reader.result);resolve({filename:file.name,base64:dataUrl.split(',')[1],dataUrl,sizeBytes:file.size,contentType:file.type});};reader.onerror=()=>reject(Error('No se pudo leer '+file.name));reader.readAsDataURL(file);})));setFiles(batch);}catch(err){setError(err instanceof Error?err.message:'No se pudieron leer los archivos.');}}} className="text-xs mt-2"/></details>
{error&&<p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</p>}{status&&<p role="status" className="text-sm text-cyan-200">{status}</p>}<footer className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">{locked?'Cerrar':'Cancelar'}</button><button disabled={busy||locked} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-700 to-sky-500 px-4 py-2 font-bold text-white text-sm disabled:opacity-50">{busy&&<Loader2 size={16} className="animate-spin"/>}{busy?'Subiendo…':'Continuar y subir'}</button></footer></form></div>;}
