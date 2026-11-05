"use client";
import {loadNotionPreview,invalidateNotionPreview} from '@/lib/notionPreviewResource';
import {NotionPreviewBlock,type PreviewBlock} from './NotionPreviewBlock';
import {NotionNewBlock} from './NotionNewBlock';
import {NotionBlockTextEditor} from './NotionBlockTextEditor';
import {EDITABLE_NOTION_TEXT_TYPES} from '@/lib/notionBlockText';
import {mediaUrl} from '@/lib/mediaUrl';
import {readApiJson} from '@/lib/readApiJson';
import {getUnverifiedPageReason} from '@/lib/deletedPages';

import React, { useState, useEffect, useRef, useCallback } from "react";
import { parseVisualParts } from "@/lib/visualTitleParser";
import {
  Copy,
  Play,
  Square as StopIcon,
  ExternalLink,
  Check,
  Info,
  Edit2,
  Trash2,
  Upload,
  Image as ImageIcon,
  Loader2,
  CheckSquare,
  Square as CheckboxIcon,
  Maximize2,
  Minimize2,
  ZoomIn,
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
} from "lucide-react";
import { playCopyChime } from "@/services/windowsIntegration";
import { ImageLightbox, LightboxImage } from "./ImageLightbox";

interface DetailsPaneProps {
  emptyContent?:React.ReactNode;
  onSelectFirst?:()=>void;
  item: any | null;
  isPinned?: boolean;
  onTogglePin?:()=>void;
  onOpen: (item: any) => void;
  onOpenLocation: (item: any) => void;
  onOpenDetailModal?: (item: any) => void;
  onSearchDomain?: (domain: string) => void;
  onOpenUploadDropbox?: (targetDir?: string) => void;
  onOpenGlobalPaste?: () => void;
  onRename?: (item: any) => void;
  onDelete?: (item: any) => void;
  textScale?: string;
  searchQuery?: string;
}

import { highlightMultiSearch } from "@/lib/multiSearchHighlight";



import { formatSmartDate } from "@/lib/dateUtils";

function formatDisplayDate(raw?: string): string {
  return formatSmartDate(raw);
}

function isImageFile(pathOrName: string): boolean {
  if (!pathOrName) return false;
  const ext = pathOrName.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
}


function DetailsPaneComponent({
  emptyContent,
  onSelectFirst,
  item,
  isPinned=false,
  onTogglePin,
  onOpen,
  onOpenLocation,
  onOpenDetailModal,
  onSearchDomain,
  onOpenUploadDropbox,
  onOpenGlobalPaste,
  onRename,
  onDelete,
  textScale = "100%",
  searchQuery = "",
}: DetailsPaneProps) {
  const [addingBlock,setAddingBlock]=useState(false);
  const [editingBlock,setEditingBlock]=useState<string|null>(null);
  const [copiedContent, setCopiedContent] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Ancho dinámico del panel redimensionable
  const [paneWidth, setPaneWidth] = useState<number>(340);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(340);

  // Estado para el visor de imágenes a pantalla completa (Lightbox)
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Cargar ancho guardado en localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("anfeta_details_pane_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 900) {
          setPaneWidth(parsed);
        }
      }
    } catch {}
  }, []);

  // Manejo de arrastre para redimensionar el panel
  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = paneWidth;
  }, [paneWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartXRef.current - e.clientX; // Arrastrar a la izquierda agranda el panel
      const newWidth = Math.min(Math.max(260, resizeStartWidthRef.current + delta), Math.round(window.innerWidth * 0.75));
      setPaneWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem("anfeta_details_pane_width", String(paneWidth));
      } catch {}
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, paneWidth]);

  // Alternar rápidamente ancho estándar vs ancho expandido
  const handleToggleExpand = () => {
    setPaneWidth((prev) => {
      let next: number;
      if (prev < 420) {
        next = 560; // Modo amplio para leer y ver imágenes cómodamente
      } else if (prev < 650) {
        next = 760; // Modo ultra-amplio
      } else {
        next = 340; // Volver al estándar
      }
      try {
        localStorage.setItem("anfeta_details_pane_width", String(next));
      } catch {}
      return next;
    });
  };

  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  // Estados de vista previa de bloques y contenido
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewBlocks, setPreviewBlocks] = useState<PreviewBlock[]>([]);
  const [previewRevision,setPreviewRevision]=useState(0);
  const queuedContent=useRef(false);
  const [previewContent, setPreviewContent] = useState("");
  const [previewStatus, setPreviewStatus] = useState("");
  const activePageIdRef = useRef<string>("");
  useEffect(()=>{const changed=(event:Event)=>{const id=String((event as CustomEvent).detail?.pageId||'').replace(/-/g,'');if(!id||id!==activePageIdRef.current.replace(/-/g,''))return;invalidateNotionPreview(id);if(editingBlock||addingBlock){queuedContent.current=true;return;}setPreviewRevision(n=>n+1);};window.addEventListener('anfeta_page_content_changed',changed);return()=>window.removeEventListener('anfeta_page_content_changed',changed);},[editingBlock,addingBlock]);
  useEffect(()=>{if(!editingBlock&&!addingBlock&&queuedContent.current){queuedContent.current=false;setPreviewRevision(n=>n+1);}},[editingBlock,addingBlock]);


  useEffect(() => {
    setEditingBlock(null);
    setAddingBlock(false);
    if (!item) {
      setPreviewBlocks([]);
      setPreviewContent("");
      setPreviewStatus("");
      activePageIdRef.current = "";
      return;
    }

    let targetId = (item.externalId || item.id || "").trim();
    const targetPath = (item.target || item.path || item.fullPath || "").trim();
    const isLocalFile = Boolean(targetPath && targetPath.includes(":\\") && !targetPath.startsWith("http"));
    const isDropboxFile = Boolean(
      (item.source === "Dropbox" || item.sourceName === "Dropbox" || item.externalSourceName === "Dropbox" || item.type === "FILE" || targetPath.startsWith("/")) &&
      !targetPath.startsWith("http")
    );

    if(isDropboxFile&&(item.type==='FOLDER'||!/\.(txt|md|log|json|csv|js|ts|jsx|tsx|py|html|css|php|sql|sh|bat|ps1|xml|yaml|yml)$/i.test(targetPath))){
      activePageIdRef.current=targetPath;setIsLoadingPreview(false);setPreviewBlocks([]);setPreviewContent('');
      setPreviewStatus(item.type==='FOLDER'?'Abre la carpeta para consultar sus archivos.':'Abre la vista previa para consultar el archivo. Si falla la conexión, vuelve a conectar Dropbox; el índice puede seguir mostrando archivos de una sesión anterior.');
      return;
    }
    let clientToken = "";
    if (typeof window !== "undefined") {
      try {
        const savedSettings = localStorage.getItem("anfeta_settings");
        if (savedSettings) clientToken = JSON.parse(savedSettings).dropboxToken || "";
      } catch {}
    }
    const tokenQuery = clientToken ? `&token=${encodeURIComponent(clientToken)}` : "";

    if (!isLocalFile && !isDropboxFile && (!targetId || targetId.startsWith("idx-") || targetId.startsWith("Item-"))) {
      const match = (item.target || item.externalUrl || "").match(/[a-f0-9]{32}/i);
      if (match) {
        targetId = match[0];
      }
    }

    const fetchUrl = (isLocalFile || isDropboxFile) && targetPath
      ? `/api/data?type=page-preview&filePath=${encodeURIComponent(targetPath)}${tokenQuery}`
      : targetId && !targetId.startsWith("idx-") && !targetId.startsWith("Item-")
      ? `/api/data?type=page-preview&pageId=${encodeURIComponent(targetId)}`
      : null;

    if (!fetchUrl) {
      activePageIdRef.current = "";
      setIsLoadingPreview(false);
      setPreviewBlocks([]);
      setPreviewContent(item.contentSnippet || item.description || "");
      setPreviewStatus("Vista previa de información indexada.");
      return;
    }

    const currentKey = (isLocalFile || isDropboxFile) ? targetPath : targetId;
    activePageIdRef.current = currentKey;
    setPreviewBlocks([]);
    setPreviewContent("");
    setIsLoadingPreview(true);
    setPreviewStatus((isLocalFile || isDropboxFile) ? "Cargando archivo..." : "Cargando contenido de Notion...");

    const controller=new AbortController();
    const request=(isLocalFile||isDropboxFile)?fetch(fetchUrl,{signal:controller.signal}).then(readApiJson):loadNotionPreview(targetId,controller.signal);
    request
      .then((data) => {
        if (activePageIdRef.current !== currentKey) return;

        const validBlocks = (data.blocks || []).filter(
          (b: any) => (b.text && b.text.trim()) || b.cells?.length || b.url || b.kind === "divider"
        );

        if (validBlocks.length > 0) {
          setPreviewBlocks(validBlocks);
          setPreviewContent(data.content || "");
          setPreviewStatus(`${validBlocks.length} bloque(s) cargados · desplázate para ver el contenido.`);
          const loadedText = (data.content || validBlocks.map((b: any) => b.text).filter(Boolean).join("\n")).trim();
          if (loadedText && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent('anfeta_page_content_loaded', { detail: { pageId: currentKey, content: loadedText, blocks: validBlocks } }));
          }
        } else if (data.content && data.content.trim()) {
          setPreviewBlocks([]);
          setPreviewContent(data.content);
          setPreviewStatus("Contenido cargado.");
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent('anfeta_page_content_loaded', { detail: { pageId: currentKey, content: data.content.trim(), blocks: [] } }));
          }
        } else if (item.contentSnippet || item.description) {
          setPreviewBlocks([]);
          setPreviewContent(item.contentSnippet || item.description);
          setPreviewStatus("Vista previa de información indexada.");
        } else {
          setPreviewBlocks([]);
          setPreviewContent("");
          setPreviewStatus(data.message || "No hay contenido disponible para previsualizar.");
        }
      })
      .catch((error) => {
        if (activePageIdRef.current === currentKey) {
          if (item.contentSnippet || item.description) {
            setPreviewBlocks([]);
            setPreviewContent(item.contentSnippet || item.description);
            setPreviewStatus((error instanceof Error ? error.message : "No se pudo cargar el contenido completo.")+" Mostrando información indexada.");
          } else {
            setPreviewStatus(error instanceof Error ? error.message : "No se pudo cargar el contenido completo.");
          }
        }
      })
      .finally(() => {
        if (activePageIdRef.current === currentKey) {
          setIsLoadingPreview(false);
        }
      });
    return ()=>{controller.abort();activePageIdRef.current="";};
  }, [item?.externalId, item?.id, item?.target, item?.path,previewRevision]);

  if (!item) {
    if(emptyContent)return <>{emptyContent}</>;
    return (
      <div
        style={{ width: `${paneWidth}px` }}
        className="shrink-0 h-full bg-[#0F141C] border-l border-[#1E2836] p-4 flex flex-col items-center justify-center text-[#64748B] select-none relative"
      >
        <div
          onMouseDown={handleMouseDownResize}
          className={`absolute left-0 top-0 bottom-0 w-2.5 -ml-1 cursor-col-resize z-30 group flex items-center justify-center hover:bg-[#38BDF8]/15 transition-colors ${
            isResizing ? "bg-[#38BDF8]/20 select-none" : ""
          }`}
          title="Arrastra para redimensionar el ancho del panel de detalles"
        >
          <div
            className={`w-[2px] h-12 rounded-full transition-colors ${
              isResizing ? "bg-[#38BDF8] h-full" : "bg-transparent group-hover:bg-[#38BDF8]/70"
            }`}
          />
        </div>
        <span className="text-xs font-semibold">Selecciona un elemento</span>
        {onSelectFirst&&<button type="button" onClick={onSelectFirst} className="mt-3 rounded border border-cyan-800 bg-cyan-950 px-3 py-2 text-cyan-300">Seleccionar primer elemento visible</button>}
        <span className="text-[10px] text-[#475569]">Para visualizar detalles y contenido</span>
      </div>
    );
  }

  const updateStatus = item.updateStatus || item.statusLabel;
  const contentSnippet = previewContent || item.contentSnippet || item.pageContent || item.description;
  const parsed = parseVisualParts(item.name, updateStatus, contentSnippet);
  const targetPath = item.target || item.path || "";
  const isDropbox =
    item.source === "Dropbox" ||
    item.sourceName === "Dropbox" ||
    item.externalSourceName === "Dropbox" ||
    item.type === "FILE" ||
    item.type === "FOLDER" ||
    (targetPath && (targetPath.startsWith("/") || targetPath.includes(":\\")));
  const isNotion = !isDropbox || item.source === "Notion" || item.type === "PAGE";
  const displayLocation = item.displayLocation || (targetPath ? targetPath.replace(/\\/g, "/") : "Notion");
  const isImage = isImageFile(targetPath) || isImageFile(item.name);
  const isPdf = /\.pdf$/i.test(targetPath) || /\.pdf$/i.test(item.name);
  const isDoc = /\.(docx?|odt|rtf)$/i.test(targetPath) || /\.(docx?|odt|rtf)$/i.test(item.name);
  const isSheet = /\.(xlsx?|ods|csv)$/i.test(targetPath) || /\.(xlsx?|ods|csv)$/i.test(item.name);
  const isVideo = /\.(mp4|webm|mov|m4v|ogv)$/i.test(targetPath||item.name);
  const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(targetPath||item.name);
  const isText = /\.(txt|md|log|json|xml|yaml|yml|js|ts|py|html|css|sql|sh|bat)$/i.test(targetPath) || /\.(txt|md|log|json)$/i.test(item.name);

  const getFilePreviewSrc = (filePath: string) => {
    if (filePath.startsWith("http")) return filePath;
    let clientToken = "";
    if (typeof window !== "undefined") {
      try {
        const savedSettings = localStorage.getItem("anfeta_settings");
        if (savedSettings) clientToken = JSON.parse(savedSettings).dropboxToken || "";
      } catch {}
    }
    const tokenQuery = clientToken ? `&token=${encodeURIComponent(clientToken)}` : "";
    return `/api/data?type=file-preview&path=${encodeURIComponent(filePath)}${tokenQuery}`;
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(contentSnippet || item.name);
    playCopyChime();
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const handleSpeak = () => {
    const text = contentSnippet || parsed.title;
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-MX";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeak = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const renderBlock = (block: PreviewBlock,index:number) => <NotionPreviewBlock block={block} index={index} pageTitle={parsed.title}/>;

  return (
    <div
      style={{ width: `${paneWidth}px` }}
      className="shrink-0 h-full bg-[#0F141C] border-l border-[#1E2836] flex flex-col text-[11.5px] text-[#CBD5E1] select-none relative transition-[width] duration-75"
    >
      {/* Divisor arrastrable (Splitter) en el borde izquierdo */}
      <div
        onMouseDown={handleMouseDownResize}
        className={`absolute left-0 top-0 bottom-0 w-2.5 -ml-1 cursor-col-resize z-30 group flex items-center justify-center hover:bg-[#38BDF8]/15 transition-colors ${
          isResizing ? "bg-[#38BDF8]/20 select-none" : ""
        }`}
        title="Arrastra para redimensionar el ancho del panel de detalles"
      >
        <div
          className={`w-[2px] h-12 rounded-full transition-colors ${
            isResizing ? "bg-[#38BDF8] h-full" : "bg-transparent group-hover:bg-[#38BDF8]/70"
          }`}
        />
      </div>

      {/* 1. Cabecera DETALLES (Fila 0, altura 32px) */}
      <div className="h-8 px-3 bg-[#121822] border-b border-[#1E2836] flex items-center justify-between text-[10.5px] font-semibold text-[#64748B] shrink-0">
        <div className="flex items-center gap-2">
          <span className="tracking-wider">DETALLES</span>
          <span className="text-[9px] font-mono text-[#475569]">{paneWidth}px</span>
        </div>

        <div className="flex items-center gap-1.5">
          {onTogglePin&&<button type="button" aria-pressed={isPinned} onClick={onTogglePin} title={isPinned?'Seguir la selección de la tabla':'Mantener este detalle mientras seleccionas otras filas'} className="rounded border border-slate-700 px-1.5 py-0.5 text-[9.5px] text-cyan-300">{isPinned?'Desfijar':'Fijar'}</button>}
          {/* Botón de alternar ancho / expandir */}
          <button
            type="button"
            onClick={handleToggleExpand}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] bg-[#161F2C] border border-[#26354A] text-[#94A3B8] hover:text-[#38BDF8] hover:border-[#38BDF8] transition-colors cursor-pointer"
            title={paneWidth >= 560 ? "Restaurar ancho estándar (340px)" : "Expandir panel a tamaño ancho (560px / 760px)"}
          >
            {paneWidth >= 560 ? (
              <>
                <Minimize2 className="w-2.5 h-2.5" />
                <span>Normal</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-2.5 h-2.5" />
                <span>Ampliar</span>
              </>
            )}
          </button>

          {/* Botón de ventana flotante independiente (Multi-Monitor) */}
          <button
            type="button"
            onClick={() => {
              const popup = window.open(
                "",
                "_blank",
                "width=650,height=800,menubar=no,toolbar=no,location=no,status=no"
              );
              if (popup) {
                popup.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>${parsed.title || "Detalle"} - ANFETA</title>
                      <meta charset="utf-8" />
                      <meta name="viewport" content="width=device-width, initial-scale=1" />
                      <style>
                        body { background: #080B0F; color: #E2E8F0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; line-height: 1.5; }
                        h1 { font-size: 16px; color: #38BDF8; margin-top: 0; }
                        .path { font-family: monospace; font-size: 11px; color: #64748B; margin-bottom: 16px; word-break: break-all; }
                        .meta { background: #111822; border: 1px solid #1E2836; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 12px; }
                        .meta div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #1E2836; }
                        .meta div:last-child { border-bottom: none; }
                        .content { background: #0C1118; border: 1px solid #1E2836; border-radius: 8px; padding: 16px; font-size: 13px; white-space: pre-wrap; word-break: break-word; }
                        .btn { display: inline-block; background: #0284C7; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: bold; margin-bottom: 16px; }
                      </style>
                    </head>
                    <body>
                      <h1>${parsed.title}</h1>
                      <div class="path">${displayLocation}</div>
                      ${item.pageUrl || item.externalUrl ? `<a class="btn" href="${item.pageUrl || item.externalUrl}" target="_blank">Abrir en Notion ↗</a>` : ""}
                      <div class="meta">
                        <div><span style="color:#64748B">Tipo:</span><span>${item.source || item.type || "Notion"}</span></div>
                        <div><span style="color:#64748B">Base:</span><span>${item.sourceName || item.externalSourceName || "Notion"}</span></div>
                        <div><span style="color:#64748B">Responsable:</span><span>${item.assignedPerson || "(Sin asignar)"}</span></div>
                        <div><span style="color:#64748B">Estado:</span><span>${updateStatus || "(Sin estado)"}</span></div>
                      </div>
                      <div class="content">${contentSnippet || "Sin contenido adicional."}</div>
                    </body>
                  </html>
                `);
                popup.document.close();
              }
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] bg-[#161F2C] border border-[#26354A] text-[#94A3B8] hover:text-[#38BDF8] hover:border-[#38BDF8] transition-colors cursor-pointer"
            title="Abrir este detalle en una ventana independiente flotante (Multi-monitor)"
          >
            <span>⧉ Flotante</span>
          </button>

          {isNotion && (
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex items-center gap-1 text-[10px] text-[#38BDF8] hover:text-[#7DD3FC] cursor-pointer ml-1"
            >
              <span>Notion</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Cuerpo desplazable (Fila 1, auto scroll) */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin">
        {item?.id && getUnverifiedPageReason(item.id) && (
          <div className="p-2.5 bg-amber-950/40 border border-amber-500/50 rounded-lg text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
            <span className="shrink-0 text-sm">⚠️</span>
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold block text-amber-200">Verificación pendiente con Notion</span>
              {getUnverifiedPageReason(item.id)}
            </div>
          </div>
        )}
        {/* Título y Ruta (DetailsTitle y DetailsDisplayPath) */}
        <div className="space-y-1">
          <h2 className="text-[12px] font-semibold text-[#F1F5F9] leading-snug break-words">
            {highlightMultiSearch(parsed.title, searchQuery)}
          </h2>
          <p className="text-[10.5px] text-[#94A3B8] opacity-75 break-all font-mono">
            {highlightMultiSearch(displayLocation, searchQuery)}
          </p>
        </div>

        {/* Tarjeta METADATA (Paridad 1:1 con DetailsMeta en ANFETA) */}
        <div className="bg-[#141B26] border border-[#1E2836] rounded-lg p-2.5 space-y-1.5 text-[11px]">
          <span className="text-[10px] font-semibold text-[#64748B] block mb-1">
            Metadata
          </span>
          <div className="flex justify-between py-0.5 border-b border-[#1E2836]/60">
            <span className="text-[#64748B]">Tipo:</span>
            <span className="text-[#CBD5E1]">{item.source || item.type || "Notion"}</span>
          </div>
          {isNotion ? (
            <>
              <div className="flex justify-between py-0.5 border-b border-[#1E2836]/60">
                <span className="text-[#64748B]">Base:</span>
                <span className="text-[#CBD5E1]">
                  {item.sourceName || item.externalSourceName || "Notion"}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#1E2836]/60">
                <span className="text-[#64748B]">Por hacer:</span>
                <span className="text-[#CBD5E1]">{formatDisplayDate(item.scheduledDate)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between py-0.5 border-b border-[#1E2836]/60">
              <span className="text-[#64748B]">Tamaño:</span>
              <span className="text-[#CBD5E1]">
                {item.size ? `${(item.size / 1024).toFixed(0)} KB` : "—"}
              </span>
            </div>
          )}
          <div className="flex justify-between py-0.5 border-b border-[#1E2836]/60">
            <span className="text-[#64748B]">Modificado:</span>
            <span className="text-[#CBD5E1]">
              {formatDisplayDate(item.serverModified || item.modifiedLocalDate)}
            </span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-[#64748B]">Asignado:</span>
            <span className="text-[#38BDF8] font-medium">{item.assignedPerson || "—"}</span>
          </div>
        </div>

        {/* Tarjeta VISTA PREVIA DE IMAGEN (Si es archivo de imagen) */}
        {isImage && (
          <div className="bg-[#141B26] border border-[#1E2836] rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#64748B] flex items-center gap-1">
                <ImageIcon className="w-3 h-3 text-[#38BDF8]" />
                <span>VISTA PREVIA DE IMAGEN</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9.5px] text-[#64748B]">
                  {item.size ? `${(item.size / 1024).toFixed(0)} KB` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    let clientToken = "";
                    if (typeof window !== "undefined") {
                      try {
                        const savedSettings = localStorage.getItem("anfeta_settings");
                        if (savedSettings) clientToken = JSON.parse(savedSettings).dropboxToken || "";
                      } catch {}
                    }
                    const tokenQuery = clientToken ? `&token=${encodeURIComponent(clientToken)}` : "";
                    const activePath = (targetPath || item.path || item.name || "").trim();
                    const imgSrc = activePath.startsWith("http")
                      ? activePath
                      : `/api/data?type=file-preview&path=${encodeURIComponent(activePath)}${tokenQuery}`;
                    setLightboxImages([{ src: imgSrc, caption: item.name }]);
                    setLightboxIndex(0);
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-[#161F2C] border border-[#26354A] text-[#38BDF8] hover:border-[#38BDF8] cursor-pointer"
                  title="Ver en pantalla completa con zoom"
                >
                  <ZoomIn className="w-2.5 h-2.5" />
                  <span>Ampliar</span>
                </button>
              </div>
            </div>
            {(() => {
              const activePath = (targetPath || item.path || item.name || "").trim();
              const previewSrc = getFilePreviewSrc(activePath);
              return (
                <div
                  className="h-48 bg-[#0A0F16] border border-[#1E293B] rounded flex items-center justify-center overflow-hidden cursor-zoom-in group/cardimg relative"
                  onClick={() => {
                    setLightboxImages([{ src: previewSrc, caption: item.name }]);
                    setLightboxIndex(0);
                  }}
                  title="Clic para ver en pantalla completa y ampliar"
                >
                  <img
                    src={previewSrc}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain transition-transform group-hover/cardimg:scale-[1.02]"
                    onError={(e) => {
                      const imgEl = e.currentTarget as HTMLElement;
                      imgEl.style.display = "none";
                      const fallback = imgEl.parentElement?.querySelector(".img-fallback") as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <div className="img-fallback hidden flex-col items-center justify-center p-3 text-center text-[#64748B] w-full h-full">
                    <ImageIcon className="w-10 h-10 text-[#38BDF8]/40 mb-1.5 animate-pulse" />
                    <span className="text-[11px] text-[#94A3B8] font-medium truncate max-w-[90%]">{item.name}</span>
                    <span className="text-[9px] text-[#475569] mt-0.5">Vista previa no disponible</span>
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cardimg:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="px-2 py-1 rounded bg-[#0F172A]/90 border border-[#38BDF8]/50 text-[#38BDF8] text-[10px] font-semibold flex items-center gap-1">
                      <ZoomIn className="w-3 h-3" /> Ver en grande
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {(isVideo||isAudio)&&targetPath&&<div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-2.5"><span className="text-xs text-cyan-300">{isVideo?'Video':'Audio'} · {item.name}</span>{isVideo?<video key={targetPath} className="w-full rounded" controls preload="none" src={getFilePreviewSrc(targetPath)}>Tu navegador no reproduce este video.</video>:<audio key={targetPath} className="w-full" controls preload="none" src={getFilePreviewSrc(targetPath)}/> }<p className="text-[10px] text-slate-400">Si el formato no es compatible, abre o descarga el archivo.</p><button type="button" onClick={()=>onOpen(item)} className="text-xs text-cyan-300">Abrir archivo ↗</button></div>}
        {/* 2.3 Visor de Documento PDF */}
        {isPdf && targetPath && (
          <div className="bg-[#141B26] border border-[#1E2836] rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#FCA5A5] uppercase tracking-wide">
                  PDF
                </span>
                <span className="text-[10px] font-semibold text-[#94A3B8] truncate max-w-[170px]" title={item.name}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={getFilePreviewSrc(targetPath)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-0.5 rounded text-[9.5px] bg-[#161F2C] border border-[#26354A] hover:border-[#38BDF8] text-[#38BDF8] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Abrir PDF en pestaña completa"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> Ampliar
                </a>
                <a
                  href={getFilePreviewSrc(targetPath)}
                  download={item.name || "documento.pdf"}
                  className="px-2 py-0.5 rounded text-[9.5px] bg-[#161F2C] border border-[#26354A] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  title="Descargar PDF"
                >
                  <Download className="w-2.5 h-2.5" /> Descargar
                </a>
              </div>
            </div>
            <div className="w-full h-72 rounded-md overflow-hidden bg-[#0A0F16] border border-[#1E293B] relative flex flex-col items-center justify-center">
              <iframe
                src={`${getFilePreviewSrc(targetPath)}#toolbar=0&navpanes=0`}
                title={item.name || "Vista previa PDF"}
                className="w-full h-full border-0 rounded-md"
              />
            </div>
          </div>
        )}

        {/* 2.4 Documento Office (Word / Excel / Hoja de Cálculo) */}
        {(isDoc || isSheet) && targetPath && (
          <div className="bg-[#141B26] border border-[#1E2836] rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide ${
                    isDoc
                      ? "bg-[#2563EB]/20 border-[#2563EB]/40 text-[#93C5FD]"
                      : "bg-[#16A34A]/20 border-[#16A34A]/40 text-[#86EFAC]"
                  }`}
                >
                  {isDoc ? "Word DOCX" : "Excel XLSX"}
                </span>
                <span className="text-[10px] font-semibold text-[#94A3B8] truncate max-w-[170px]" title={item.name}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={getFilePreviewSrc(targetPath)}
                  download={item.name}
                  className="px-2 py-0.5 rounded text-[9.5px] bg-[#161F2C] border border-[#26354A] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  title="Descargar documento"
                >
                  <Download className="w-2.5 h-2.5" /> Descargar
                </a>
              </div>
            </div>
            <div className="p-3 bg-[#0A0F16] border border-[#1E293B] rounded-md flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
                  isDoc ? "bg-[#2563EB]/15 text-[#60A5FA]" : "bg-[#16A34A]/15 text-[#4ADE80]"
                }`}
              >
                {isDoc ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[#E2E8F0] truncate">{item.name}</p>
                <p className="text-[9.5px] text-[#64748B] truncate mt-0.5">{displayLocation}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="px-2.5 py-1 rounded bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] hover:border-[#38BDF8] text-[#38BDF8] text-[10px] font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" /> Abrir
              </button>
            </div>
          </div>
        )}

        {addingBlock&&<NotionNewBlock pageId={activePageIdRef.current} onClose={()=>setAddingBlock(false)} onSaved={saved=>{const next=[...previewBlocks,saved];setPreviewBlocks(next);setPreviewContent(next.map(block=>block.text).filter(Boolean).join("\n"));setPreviewStatus("Bloque agregado al final de la página en Notion.");}}/>}
        {editingBlock&&<NotionBlockTextEditor key={editingBlock} pageId={activePageIdRef.current} blockId={editingBlock} onClose={()=>setEditingBlock(null)} onSaved={saved=>{const next=previewBlocks.map(block=>block.id===saved.id?{...block,text:saved.text,lastEditedTime:saved.lastEditedTime}:block);setPreviewBlocks(next);setPreviewContent(next.map(block=>block.text).filter(Boolean).join("\n"));setPreviewStatus("Texto guardado en Notion.");}}/>}
        {/* Tarjeta VISTA PREVIA DE CONTENIDO / NOTION / TEXTO */}
        <div className="bg-[#141B26] border border-[#1E2836] rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#64748B]">
              {isText
                ? "VISTA PREVIA DE TEXTO"
                : isDoc
                ? "CONTENIDO DEL DOCUMENTO"
                : isSheet
                ? "CONTENIDO DE HOJA DE CÁLCULO"
                : isPdf
                ? "DETALLES DEL DOCUMENTO PDF"
                : isNotion
                ? "VISTA PREVIA DE NOTION"
                : "VISTA PREVIA"}
            </span>{isNotion&&!isLoadingPreview&&/^[a-f0-9-]{32,36}$/i.test(activePageIdRef.current)&&<button type="button" onClick={()=>setAddingBlock(true)} className="rounded border border-slate-700 px-2 py-0.5 text-[9px] text-cyan-200">+ Bloque</button>}
            <div className="flex items-center gap-1">
              {isSpeaking ? (
                <button
                  type="button"
                  onClick={handleStopSpeak}
                  className="px-2 py-0.5 rounded text-[9.5px] bg-[#EF4444]/20 border border-[#EF4444]/50 text-[#FCA5A5] flex items-center gap-1 cursor-pointer"
                >
                  <StopIcon className="w-2.5 h-2.5" /> Detener
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSpeak}
                  className="px-2 py-0.5 rounded text-[9.5px] bg-[#161F2C] border border-[#26354A] text-[#38BDF8] hover:border-[#38BDF8] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Play className="w-2.5 h-2.5" /> Leer
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyContent}
                className="px-2 py-0.5 rounded text-[9.5px] bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedContent ? (
                  <Check className="w-2.5 h-2.5 text-[#22C55E]" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
                Copiar
              </button>
            </div>
          </div>

          {/* Estado de carga / sincronización */}
          <div className="flex items-center gap-1.5 text-[9.5px] text-[#64748B]">
            {isLoadingPreview && <Loader2 className="w-3 h-3 animate-spin text-[#38BDF8]" />}
            <span>{previewStatus}</span>
          </div>

          {/* Contenedor de Bloques / Texto */}
          <div
            style={{ fontSize: `${(10.5 * scale).toFixed(1)}px` }}
            className={`bg-[#0A0F16] p-2.5 rounded border border-[#1E293B] max-h-[320px] overflow-y-auto space-y-1.5 select-text scrollbar-thin ${
              isText ? "font-mono text-[#E2E8F0] leading-5" : "font-sans"
            }`}
          >
            {previewBlocks.length > 0 ? (
              <>
                <div
                  style={{ fontSize: `${(9.5 * scale).toFixed(1)}px` }}
                  className="font-bold text-[#64C8FF] tracking-wider mb-2"
                >
                  {isText ? "CONTENIDO DEL ARCHIVO" : "CONTENIDO DE LA PÁGINA"}
                </div>
                {isText ? (
                  <div className="font-mono text-[11px] leading-relaxed text-[#CBD5E1] whitespace-pre-wrap select-text">
                    {previewBlocks.map((b) => b.text).join("\n")}
                  </div>
                ) : (
                  previewBlocks.map((b, idx) => (
                    <div key={b.id || idx}>
                      {renderBlock(b, idx)}
                      {isNotion && EDITABLE_NOTION_TEXT_TYPES.includes(b.kind) && /^[a-f0-9-]{32,36}$/i.test(b.id) && (
                        <button
                          type="button"
                          onClick={() => setEditingBlock(b.id)}
                          className="mb-1 rounded border border-slate-700 px-2 py-0.5 text-[9px] text-slate-400 hover:text-cyan-200"
                          aria-label={"Editar texto del bloque " + (idx + 1)}
                        >
                          Editar texto
                        </button>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : previewContent ? (
              <div
                style={{ fontSize: `${(10.5 * scale).toFixed(1)}px` }}
                className={`whitespace-pre-wrap leading-relaxed text-[#CBD5E1] ${
                  isText ? "font-mono text-[11px]" : ""
                }`}
              >
                {previewContent}
              </div>
            ) : (
              <div className="text-center py-6 text-[#64748B] space-y-1">
                <p className="text-[11px]">
                  {isPdf
                    ? "Documento PDF listo."
                    : isDoc || isSheet
                    ? "Documento de Microsoft Office listo."
                    : "No hay bloques cargados."}
                </p>
                <p className="text-[9.5px] text-[#475569]">
                  {previewStatus ||
                    (isPdf
                      ? "Puedes visualizar el documento arriba, ampliarlo o descargarlo."
                      : isDoc || isSheet
                      ? "Usa los botones superiores para descargar o abrir el archivo."
                      : "Configura el token de Notion en Configuración para descargar los bloques en tiempo real.")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Acciones inferiores (Fila 2, altura fija 38px, paridad total con ANFETA Row 2) */}
      <div className="h-[38px] px-2.5 bg-[#121822] border-t border-[#1E2836] flex items-center gap-1.5 shrink-0 relative">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="flex-1 h-[26px] bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white text-[11px] font-medium rounded transition-colors flex items-center justify-center cursor-pointer"
        >
          Abrir
        </button>
        <button
          type="button"
          onClick={() => onOpenLocation(item)}
          className="flex-1 h-[26px] bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white text-[11px] font-medium rounded transition-colors flex items-center justify-center truncate px-1 cursor-pointer"
          title={isNotion ? "Abrir en Notion" : "Abrir ubicación en Explorador"}
        >
          {isNotion ? "Abrir Notion" : "Ubicación"}
        </button>
        {isNotion && onOpenDetailModal && (
          <button
            type="button"
            onClick={() => onOpenDetailModal(item)}
            className="flex-1 h-[26px] bg-purple-600 hover:bg-purple-500 border border-purple-400 text-white font-medium text-[11px] rounded transition-colors flex items-center justify-center gap-1 shadow-sm px-1.5 cursor-pointer"
            title="Abrir detalle interactivo de la actividad en modal flotante"
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Abrir detalle</span>
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className="w-7 h-[26px] bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white text-[13px] font-bold rounded transition-colors flex items-center justify-center cursor-pointer"
            title="Más opciones"
          >
            ⋯
          </button>
          {/* Menú Flyout (Paridad exacta con ANFETA DetailsMoreFlyout) */}
          {isMoreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMoreMenuOpen(false)}
              />
              <div className="absolute right-0 bottom-full mb-1 w-52 bg-[#0D1522] border border-[#00C8FF]/40 rounded-xl shadow-2xl p-1 z-50 text-[11px] text-[#CBD5E1] backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    alert(
                      `Información del elemento:\nNombre: ${item.name}\nOrigen: ${
                        item.source || "Notion"
                      }\nRuta: ${targetPath || "Notion"}`
                    );
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#162232] hover:text-[#38BDF8] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Info</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onRename?.(item);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#162232] hover:text-[#A78BFA] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Renombrar...</span>
                </button>
                <div className="h-[1px] bg-[#1E2836] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    navigator.clipboard.writeText(item.name);
                    playCopyChime();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#162232] hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span>Copiar nombre</span>
                </button>
                {parsed.domain && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      navigator.clipboard.writeText(`${parsed.domain} - ${item.source || "NOTION"}`);
                      playCopyChime();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#162232] hover:text-[#22C55E] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>Copiar dominio y tipo</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    handleCopyContent();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#162232] hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-[#CBD5E1]" />
                  <span>Copiar contenido</span>
                </button>
                <div className="h-[1px] bg-[#1E2836] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenUploadDropbox?.(targetPath);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#162232] hover:text-[#60A5FA] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-[#60A5FA]" />
                  <span>Subir archivo a Dropbox...</span>
                </button>
                {onDelete && (
                  <>
                    <div className="h-[1px] bg-[#1E2836] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onDelete(item);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#2A1515] text-[#F87171] hover:text-[#EF4444] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#F87171]" />
                      <span>Eliminar</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Visor de imágenes a pantalla completa con zoom/pan */}
      <ImageLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
export const DetailsPane = React.memo(DetailsPaneComponent);
