"use client";
import {uploadBrowserFiles,uploadMetadata} from '@/lib/browserDropboxUpload';
import {readUploadDraft,saveUploadDraft,clearUploadDraft,UploadDraft,getUploadDraftStatus,summarizeDraftProgress} from '@/lib/uploadDraft';
import React,{useState,useEffect,useRef,useCallback} from 'react';
import {X,Upload,Loader2,Folder,ChevronRight,AlertTriangle,CheckCircle,Link2,Search} from 'lucide-react';
import {detectUpload,drxFolder,monthToken,projectCategories,softwareCategories,replaceUploadPrefix,uploadFilename} from '@/lib/drxUploadPlan';
import type {SearchResultRow} from '@/types/anfeta';

export interface GlobalPasteImagePayload {
  contentType?: string;
  dataUrl: string;
  base64: string;
  filename: string;
  sizeBytes: number;
  blob?: Blob;
  cloudCursor?: string;
  cloudOffset?: number;
  cloudReceipt?: string;
}

interface Props {
  currentUser: string;
  initialFiles?: GlobalPasteImagePayload[];
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  initialImage?: GlobalPasteImagePayload | null;
  onSuccess: (item: any) => void;
  initialDestination?: 'both' | 'dropbox' | 'notion';
  initialDomain?: string;
  suggestedTarget?: SearchResultRow | null;
}

const EMPTY: GlobalPasteImagePayload[] = [];
const reviewers = [
  { name: '(Sin asignar)', tag: '', person: '' },
  { name: '🚨 John 0000 (Urgente)', tag: 'john0000', person: 'jjohn00' },
  { name: '👤 Neftalí', tag: 'nneft', person: 'nneft' },
  { name: '👤 Andrade', tag: 'aandr', person: 'aandr' },
  { name: '👤 Genaro', tag: 'ggena', person: 'ggena' },
  { name: '👤 Karla', tag: 'kkarl', person: 'kkarl' }
];

export function GlobalPasteModal({
  isOpen,
  currentUser,
  initialFiles = EMPTY,
  initialText = '',
  initialImage = null,
  onClose,
  onSuccess,
  initialDestination,
  initialDomain,
  suggestedTarget
}: Props) {
  const [files, setFiles] = useState<GlobalPasteImagePayload[]>([]);
  const [mode, setMode] = useState<'both' | 'dropbox' | 'notion'>('both');
  const [actionType, setActionType] = useState<'create' | 'attach'>('create');
  const [selectedCard, setSelectedCard] = useState<{ id: string; title: string; typeLabel: string; type: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingCards, setSearchingCards] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);

  const [domain, setDomain] = useState('');
  const [root, setRoot] = useState('proyecto');
  const [category, setCategory] = useState('proyecto');
  const [month, setMonth] = useState(monthToken);
  const [person, setPerson] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [separate, setSeparate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [locked, setLocked] = useState(false);

  const [confirmedDropbox, setConfirmedDropbox] = useState<string[]>([]);
  const [confirmedNotion, setConfirmedNotion] = useState<string[]>([]);

  // Dropbox folder selection via API
  const [customFolder, setCustomFolder] = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [cloudFolders, setCloudFolders] = useState<{ name: string; path: string }[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [pickerError, setPickerError] = useState('');

  // Draft recovery & conflict handling
  const prefixRef = useRef('');
  const recovery = useRef<UploadDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<UploadDraft | null>(null);
  const [stashedFiles, setStashedFiles] = useState<GlobalPasteImagePayload[]>([]);

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

  const searchCards = useCallback(async (q: string) => {
    setSearchingCards(true);
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search-cards', payload: { query: q } })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.cards)) {
        setSearchResults(data.cards);
      }
    } catch {
      // Ignorar errores de búsqueda en segundo plano
    } finally {
      setSearchingCards(false);
    }
  }, []);

  const initFormFromFiles = useCallback((filesToUse: GlobalPasteImagePayload[]) => {
    const detected = detectUpload([initialDomain, initialText, ...filesToUse.map(f => f.filename)].join(' '));
    const d = initialDomain || detected.domain;
    const m = monthToken();
    let saved: any = 'both';
    try { saved = localStorage.getItem('anfeta_upload_destination') || 'both'; } catch {}
    setMode(initialDestination || (['both', 'dropbox', 'notion'].includes(saved) ? saved : 'both'));
    setFiles(filesToUse);
    setDomain(d || '');
    setRoot(detected.root);
    setCategory(detected.category);
    setMonth(m);
    setPerson('');
    setBody(initialText || '');
    setSeparate(false);
    setError('');
    setStatus('');
    setLocked(false);
    setBusy(false);
    const prefix = [d, detected.root, m].filter(Boolean).join(' ');
    prefixRef.current = prefix;
    let desc = filesToUse.length === 1 ? filesToUse[0].filename.replace(/\.[a-z0-9]{1,12}$/i, '') : '';
    if (/^(Captura_ANFETA|image|clipboard|tmp|codex-clipboard)/i.test(desc)) desc = '';
    if (d) desc = desc.split(d).join('').trim();
    setTitle([prefix, desc].filter(Boolean).join(' '));
  }, [initialDomain, initialText, initialDestination]);

  const applyDraft = useCallback((draft: UploadDraft) => {
    recovery.current = draft;
    const p = draft.plan;
    setMode(p.mode || 'both');
    setFiles(p.files || []);
    setDomain(p.domain || '');
    setRoot(p.root || 'proyecto');
    setCategory(p.category || 'proyecto');
    setMonth(p.month || monthToken());
    setPerson(p.personTag || '');
    setTitle(p.title || '');
    setBody(p.body || '');
    setSeparate(!!p.separatePages);
    setCustomFolder(p.customFolder || '');
    prefixRef.current = [p.domain, p.root, p.month, p.personTag].filter(Boolean).join(' ');
    setStarted(draft.started);
    const summary = summarizeDraftProgress(draft);
    const confirmedDbx = (draft.receipts || []).filter(r => r.kind === 'dropbox').map(r => r.path);
    setConfirmedDropbox(confirmedDbx);
    setStatus(`Lote recuperado: ${draft.receipts.length} pasos confirmados (${summary.uploadedFiles}/${summary.totalFiles} archivos en Dropbox). Se retomarán los pendientes.`);
    setPendingConflict(null);
    setDraftReady(true);
  }, []);

  const handleDiscardDraft = async () => {
    try {
      await clearUploadDraft(currentUser);
      setPendingConflict(null);
      recovery.current = {
        id: crypto.randomUUID(),
        owner: currentUser,
        plan: {},
        receipts: [],
        started: false,
        updatedAt: Date.now()
      };
      setStarted(false);
      setConfirmedDropbox([]);
      setConfirmedNotion([]);
      initFormFromFiles(stashedFiles);
      setDraftReady(true);
    } catch (e: any) {
      setError(e.message || 'No se pudo descartar el borrador anterior.');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setPendingConflict(null);
      setDraftReady(false);
      setStarted(false);
      return;
    }

    let stopped = false;
    const batch = initialFiles.length ? initialFiles : (initialImage ? [initialImage] : []);

    // Sugerir tarjeta si había un elemento seleccionado
    if (suggestedTarget) {
      const rawId = suggestedTarget.externalId || suggestedTarget.id;
      const clean = String(rawId || '').replace(/-/g, '');
      if (/^[a-f0-9]{32}$/i.test(clean)) {
        let type = 'pagina';
        let typeLabel = '📄 Página';
        const nameLower = (suggestedTarget.name || '').toLowerCase();
        if (/error|fallo|bug/i.test(nameLower)) { type = 'error'; typeLabel = '⚠️ Error'; }
        else if (/sugerencia|propuesta|idea/i.test(nameLower)) { type = 'sugerencia'; typeLabel = '💡 Sugerencia'; }
        else if (suggestedTarget.scheduledDate || /actividad/i.test(nameLower)) { type = 'actividad'; typeLabel = '📅 Actividad'; }

        setSelectedCard({
          id: rawId,
          title: suggestedTarget.name,
          type,
          typeLabel
        });
        setActionType('attach');
      }
    }

    readUploadDraft(currentUser).then(draft => {
      if (stopped) return;
      const draftStatus = getUploadDraftStatus(draft);
      if (draft && (draftStatus === 'unconfirmed_started' || draftStatus === 'partial')) {
        if (batch.length > 0) {
          setPendingConflict(draft);
          setStashedFiles(batch);
          setDraftReady(true);
          return;
        } else {
          applyDraft(draft);
          return;
        }
      }

      if (draft && draftStatus === 'completed') {
        void clearUploadDraft(currentUser);
      }
      recovery.current = {
        id: crypto.randomUUID(),
        owner: currentUser,
        plan: {},
        receipts: [],
        started: false,
        updatedAt: Date.now()
      };
      setStarted(false);
      initFormFromFiles(batch);
      setDraftReady(true);
    }).catch(e => {
      if (!stopped) setError(e.message);
    });

    return () => { stopped = true; };
  }, [isOpen, currentUser, suggestedTarget, initFormFromFiles, applyDraft]);

  // Autoguardado debounced únicamente cuando no hay conflicto pendiente
  useEffect(() => {
    if (!isOpen || !draftReady || !recovery.current || started || pendingConflict) return;
    const draft: UploadDraft = {
      ...recovery.current,
      plan: {
        mode,
        domain,
        root,
        category,
        month,
        personTag: person,
        title,
        body,
        files,
        separatePages: separate,
        customFolder
      },
      updatedAt: Date.now()
    };
    recovery.current = draft;
    const timer = setTimeout(() => {
      saveUploadDraft(draft).catch(e => setError(e.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, draftReady, started, pendingConflict, mode, domain, root, category, month, person, title, body, files, separate, customFolder]);

  useEffect(() => {
    if (!isOpen) return;
    const prefix = [domain, root, month, person].filter(Boolean).join(' ');
    if (prefix === prefixRef.current) return;
    const previous = prefixRef.current;
    setTitle(old => replaceUploadPrefix(old, previous, prefix));
    prefixRef.current = prefix;
  }, [domain, root, month, person, isOpen]);

  if (!isOpen) return null;
  let folder = '';
  try { folder = drxFolder(domain, root, category); } catch {}
  const count = files.length;
  const chosen = reviewers.find(p => p.tag === person);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || locked || !draftReady || pendingConflict) return;
    setError('');
    if (files.length > 20) { setError('Selecciona hasta 20 archivos por lote.'); return; }
    if (mode !== 'notion' && !folder && !customFolder) {
      setError('Escribe el dominio para construir la ruta DRX o elige una carpeta.');
      return;
    }
    if (!files.length && !body.trim()) {
      setError('Agrega contenido o archivos.');
      return;
    }
    if (actionType === 'attach' && mode !== 'dropbox' && !selectedCard) {
      setError('Selecciona o busca una tarjeta existente para vincular la grabación.');
      return;
    }
    if (mode === 'notion' && files.reduce((n, f) => n + f.sizeBytes, 0) > 2500000) {
      setError('Este envío supera 2.5 MB. Reduce el lote para enviarlo por la web.');
      return;
    }
    setBusy(true);
    try {
      if (!recovery.current) throw Error('No se preparó la recuperación del lote.');
      const frozen = recovery.current.started ? recovery.current.plan : {
        mode,
        domain,
        root,
        category,
        month,
        personTag: person,
        title: title.trim(),
        body,
        files,
        separatePages: separate,
        customFolder
      };
      recovery.current = { ...recovery.current, plan: frozen, started: true, updatedAt: Date.now() };
      await saveUploadDraft(recovery.current);
      setStarted(true);

      if (frozen.files?.length) await uploadBrowserFiles(recovery.current, setStatus);

      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(110000),
        body: JSON.stringify({
          action: 'unified-upload',
          payload: {
            ...uploadMetadata(frozen),
            month: undefined,
            personTag: undefined,
            uploadId: recovery.current.id,
            person: reviewers.find(p => p.tag === frozen.personTag)?.person || '',
            targetPageId: actionType === 'attach' && selectedCard ? selectedCard.id : undefined,
            currentUser
          }
        })
      });

      const raw = await response.text();
      let data: any;
      try { data = JSON.parse(raw); } catch { throw new Error('El servidor no pudo completar la subida (HTTP ' + response.status + ').'); }

      const allReceipts = data.receipts || recovery.current.receipts || [];
      recovery.current = { ...recovery.current, receipts: allReceipts, updatedAt: Date.now() };
      await saveUploadDraft(recovery.current);

      const dbxPaths = allReceipts.filter((r: any) => r.kind === 'dropbox').map((r: any) => r.path);
      setConfirmedDropbox(dbxPaths);

      const notionTitles = allReceipts.filter((r: any) => r.kind === 'notion' || r.kind === 'notion_attachment').map((r: any) => r.title || r.pageId);
      setConfirmedNotion(notionTitles);

      for (const [index, item] of allReceipts.entries()) {
        if (item.kind === 'event') continue;
        onSuccess(item.kind === 'notion' || item.kind === 'notion_attachment' ? {
          id: item.pageId,
          externalId: item.pageId,
          name: item.title || item.activity?.title || title,
          path: item.pageUrl,
          externalUrl: item.pageUrl,
          source: 'Notion',
          type: 'PAGE'
        } : {
          id: 'dropbox-' + Date.now() + '-' + index,
          name: item.filename,
          path: item.path,
          target: item.path,
          folder: item.targetDir,
          source: 'Dropbox',
          type: 'FILE',
          sizeBytes: item.sizeBytes
        });
      }

      if (!response.ok || !data.success) {
        if (dbxPaths.length) {
          setStatus(`Archivo guardado en Dropbox (${dbxPaths.join(', ')}). Falló la vinculación con Notion: ${data.error || 'error'}. Puedes corregir y reintentar únicamente Notion.`);
        }
        throw new Error(data.error || 'La subida no se completó.');
      }

      const warnings = [...(data.warnings || []), data.warning].filter(Boolean);
      setLocked(true);
      setStatus('Guardado correctamente.' + (warnings.length ? ' Advertencias: ' + warnings.join(' ') : ''));
      try {
        localStorage.setItem('anfeta_upload_destination', mode);
        await clearUploadDraft(currentUser);
      } catch {}

      if (!warnings.length) {
        setTimeout(() => onClose(), 1200);
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'No se pudo subir.');
    } finally {
      setBusy(false);
    }
  }

  const style = 'min-w-0 w-full bg-[#131E2E] border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-sky-400';

  return (
    <div role="dialog" aria-modal="true" aria-label="Subir archivo" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
      <form onSubmit={submit} className="w-full max-w-4xl max-h-[94dvh] overflow-auto rounded-2xl border border-cyan-600/50 bg-[#0C131D] shadow-2xl p-4 space-y-3 text-slate-200">
        <header className="flex items-center gap-2">
          <Upload className="text-sky-400" size={22} />
          <h2 className="text-lg font-semibold">Subir archivo o grabación</h2>
          {count > 0 && <span title={files.map(f => f.filename).join('\n')} className="text-xs text-cyan-300">📦 {count} archivos</span>}
          <button type="button" disabled={busy} aria-label="Cerrar" onClick={onClose} className="ml-auto cursor-pointer p-1 text-slate-400 hover:text-white"><X size={20} /></button>
        </header>

        {/* Banner de Resolución de Lote Pendiente */}
        {pendingConflict && (
          <div className="rounded-xl border border-amber-600/70 bg-amber-950/60 p-4 space-y-3 text-amber-100">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle size={20} className="shrink-0" />
              <span>Hay un lote anterior incompleto en seguimiento</span>
            </div>
            <p className="text-xs">
              Existe una subida pendiente del {new Date(pendingConflict.updatedAt).toLocaleString('es-MX')} ({pendingConflict.plan?.title || 'Sin título'}).
              {(() => {
                const s = summarizeDraftProgress(pendingConflict);
                return ` ${s.uploadedFiles} de ${s.totalFiles} archivos subidos a Dropbox. ${s.confirmedReceipts} operaciones confirmadas.`;
              })()}
            </p>
            {pendingConflict.receipts?.length > 0 && (
              <div className="text-xs bg-black/40 rounded p-2 max-h-24 overflow-y-auto space-y-1">
                <span className="font-semibold text-amber-200">Operaciones confirmadas previamente:</span>
                {pendingConflict.receipts.map((r, i) => (
                  <div key={i} className="text-emerald-300 truncate font-mono">✓ {r.kind === 'dropbox' ? `Dropbox: ${r.path}` : `Notion: ${r.pageId || r.pageUrl}`}</div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => applyDraft(pendingConflict)}
                className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-semibold cursor-pointer"
              >
                Retomar pendiente
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700 font-semibold cursor-pointer"
              >
                Descartar borrador anterior
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <fieldset disabled={busy || started || !draftReady || Boolean(pendingConflict)} className="space-y-3">
          {/* Selector de Destino */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1">
            {([{ id: 'both', label: '🌐 Notion + Dropbox' }, { id: 'dropbox', label: '📦 Solo Dropbox' }, { id: 'notion', label: '📝 Solo Notion' }] as const).map(x =>
              <label key={x.id} className={'cursor-pointer rounded-lg p-2 text-center text-xs ' + (mode === x.id ? 'bg-sky-900 text-cyan-200 ring-1 ring-cyan-600' : 'text-slate-400')}>
                <input type="radio" name="destination" checked={mode === x.id} onChange={() => setMode(x.id)} className="sr-only" />{x.label}
              </label>
            )}
          </div>

          {/* Selector Crear Nuevo vs Adjuntar a Existente */}
          {mode !== 'dropbox' && (
            <div className="flex items-center gap-3 rounded-lg bg-slate-900/80 border border-slate-800 p-2.5 text-xs">
              <span className="text-slate-400 font-medium">Destino en Notion:</span>
              <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setActionType('create')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${actionType === 'create' ? 'bg-sky-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  📄 Crear nuevo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionType('attach');
                    if (!searchResults.length) searchCards('');
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${actionType === 'attach' ? 'bg-sky-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  📎 Adjuntar a existente
                </button>
              </div>
            </div>
          )}

          {/* Panel de Selección y Búsqueda de Tarjeta Existente */}
          {mode !== 'dropbox' && actionType === 'attach' && (
            <div className="rounded-xl border border-cyan-800/60 bg-cyan-950/20 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-cyan-200 flex items-center gap-1.5">
                  <Link2 size={15} />
                  <span>Tarjeta seleccionada:</span>
                </span>
                {selectedCard && (
                  <button
                    type="button"
                    onClick={() => { setShowCardPicker(true); searchCards(searchQuery); }}
                    className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                  >
                    Buscar otra tarjeta
                  </button>
                )}
              </div>

              {selectedCard ? (
                <div className="flex items-center justify-between rounded-lg bg-slate-900 border border-cyan-600/50 p-2.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-200 text-[11px] font-semibold">{selectedCard.typeLabel}</span>
                      <span className="font-medium text-slate-100 truncate">{selectedCard.title}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">ID: {selectedCard.id}</p>
                  </div>
                </div>
              ) : (
                <div className="text-amber-300 bg-amber-950/40 border border-amber-800/50 p-2 rounded text-xs">
                  Selecciona una actividad, error o sugerencia para adjuntar este archivo.
                </div>
              )}

              {(!selectedCard || showCardPicker) && (
                <div className="space-y-2 pt-1 border-t border-cyan-900/40">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          searchCards(e.target.value);
                        }}
                        placeholder="Buscar por título o pegar ID de Notion..."
                        className="w-full bg-[#131E2E] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    {searchingCards && <Loader2 size={16} className="animate-spin text-cyan-400 shrink-0" />}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg bg-[#080E16] border border-slate-800 p-1.5 scrollbar-thin">
                      {searchResults.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => {
                            setSelectedCard(card);
                            setShowCardPicker(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded hover:bg-[#131E2C] text-left transition-colors border border-transparent hover:border-cyan-800/50 cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">{card.typeLabel}</span>
                              <span className="text-xs text-slate-200 font-medium truncate">{card.title}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{card.id}</p>
                          </div>
                          <span className="text-[10px] text-sky-400 shrink-0 font-medium">Elegir</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Configuración de Dominio y DRX */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <label className="text-xs">Dominio<input aria-label="Dominio" value={domain} onChange={e => setDomain(e.target.value.toLowerCase())} className={style} placeholder="dominio.com" /></label>
            {mode !== 'notion' && <>
              <label className="text-xs">Tipo<select value={root} onChange={e => { setRoot(e.target.value); setCategory(e.target.value); }} className={style}><option value="proyecto">Proyecto</option><option value="software">Software</option></select></label>
              <label className="text-xs">Categoría<select value={category} onChange={e => setCategory(e.target.value)} className={style}>{(root === 'software' ? softwareCategories : projectCategories).map(c => <option key={c}>{c}</option>)}</select></label>
            </>}
            <label className="text-xs">Mes<input value={month} onChange={e => setMonth(e.target.value)} className={style} /></label>
            <label className="text-xs">Persona / Revisor<select value={person} onChange={e => setPerson(e.target.value)} className={style}>{reviewers.map(p => <option key={p.tag} value={p.tag}>{p.name}</option>)}</select></label>
          </div>

          <label className="block text-xs">Título / Nombre<input aria-label="Título / Nombre" autoFocus value={title} onChange={e => setTitle(e.target.value)} className={style} placeholder="Descripción del archivo" /></label>
          {count > 1 && mode !== 'dropbox' && actionType === 'create' && (
            <select aria-label="Organización de páginas" value={separate ? 'separate' : 'single'} onChange={e => setSeparate(e.target.value === 'separate')} className={style}>
              <option value="single">Una sola página para todos</option>
              <option value="separate">Páginas separadas</option>
            </select>
          )}

          {/* Barra de Destino en Dropbox con opción de elegir carpeta desde la API */}
          {mode !== 'notion' && (
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
                    className="text-[10px] text-slate-400 hover:text-white underline ml-2 cursor-pointer"
                  >
                    Restablecer a DRX automática
                  </button>
                </div>
              ) : (
                <div title={folder} className="rounded-lg bg-cyan-900/15 border border-cyan-800/40 px-3 py-2 text-xs text-cyan-300 truncate font-mono">
                  📁 {folder ? folder.split('/').filter(Boolean).join(' → ') : 'Completa el dominio o elige carpeta'} → {uploadFilename(title, files[0]?.filename || 'Contenido.txt', 0, count || 1)}
                </div>
              )}

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
                      {pickerError}
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

          <details open={!count && Boolean(initialText)}>
            <summary className="cursor-pointer text-xs text-slate-400">Contenido y adjuntos</summary>
            <textarea aria-label="Contenido" value={body} onChange={e => setBody(e.target.value)} rows={3} className={style} />
            <input
              type="file"
              multiple
              disabled={busy}
              aria-label="Adjuntar archivos"
              onChange={async e => {
                const selected = Array.from(e.target.files || []);
                try {
                  const batch: GlobalPasteImagePayload[] = selected.map(file => ({
                    filename: file.name,
                    base64: '',
                    dataUrl: '',
                    sizeBytes: file.size,
                    contentType: file.type,
                    blob: file
                  }));
                  setFiles(batch);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'No se pudieron leer los archivos.');
                }
              }}
              className="text-xs mt-2"
            />
          </details>
        </fieldset>

        {/* Reporte separado de confirmaciones */}
        {confirmedDropbox.length > 0 && (
          <div className="rounded-lg bg-emerald-950/40 border border-emerald-600/50 p-2.5 text-xs text-emerald-300 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-emerald-200">
              <CheckCircle size={14} /> Archivo guardado en Dropbox:
            </span>
            {confirmedDropbox.map((p, i) => (
              <div key={i} className="truncate font-mono pl-4">✓ {p}</div>
            ))}
          </div>
        )}

        {confirmedNotion.length > 0 && (
          <div className="rounded-lg bg-cyan-950/40 border border-cyan-600/50 p-2.5 text-xs text-cyan-300 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-cyan-200">
              <CheckCircle size={14} /> Vinculación confirmada en Notion:
            </span>
            {confirmedNotion.map((p, i) => (
              <div key={i} className="truncate pl-4">✓ {p}</div>
            ))}
          </div>
        )}

        {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</p>}
        {status && <p role="status" className="text-sm text-cyan-200">{status}</p>}
        {started && <p className="text-xs text-slate-400">El lote conserva archivos, destinos y recibos. Si un resultado quedó pendiente, puedes corregirlo y reintentar.</p>}

        <footer className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 cursor-pointer">
            {locked ? 'Cerrar' : 'Cancelar'}
          </button>
          <button
            disabled={busy || locked || !draftReady || Boolean(pendingConflict)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-700 to-sky-500 hover:from-sky-600 hover:to-sky-400 px-4 py-2 font-bold text-white text-sm disabled:opacity-50 cursor-pointer"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? 'Subiendo…' : started ? 'Retomar lote' : 'Continuar y subir'}
          </button>
        </footer>
      </form>
    </div>
  );
}
