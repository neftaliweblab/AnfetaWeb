"use client";

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
} from "lucide-react";
import { playCopyChime } from "@/services/windowsIntegration";
import { ImageLightbox, LightboxImage } from "./ImageLightbox";

interface DetailsPaneProps {
  item: any | null;
  isPinned?: boolean;
  onTogglePin?:()=>void;
  onOpen: (item: any) => void;
  onOpenLocation: (item: any) => void;
  onSearchDomain?: (domain: string) => void;
  onOpenUploadDropbox?: (targetDir?: string) => void;
  onOpenGlobalPaste?: () => void;
  onDelete?: (item: any) => void;
  textScale?: string;
}

interface PreviewBlock {
  id: string;
  kind: string;
  text: string;
  isChecked?: boolean;
  isStrikethrough?: boolean;
  language?: string;
  url?: string;
  caption?: string;
  lastEditedTime?: string;
}

import { formatSmartDate } from "@/lib/dateUtils";

function formatDisplayDate(raw?: string): string {
  return formatSmartDate(raw);
}

function isImageFile(pathOrName: string): boolean {
  if (!pathOrName) return false;
  const ext = pathOrName.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
}

export function DetailsPane({
  item,
  isPinned=false,
  onTogglePin,
  onOpen,
  onOpenLocation,
  onSearchDomain,
  onOpenUploadDropbox,
  onOpenGlobalPaste,
  onDelete,
  textScale = "100%",
}: DetailsPaneProps) {
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
  const [previewContent, setPreviewContent] = useState("");
  const [previewStatus, setPreviewStatus] = useState("");
  const activePageIdRef = useRef<string>("");

  useEffect(() => {
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

    if (!isLocalFile && (!targetId || targetId.startsWith("idx-") || targetId.startsWith("Item-"))) {
      const match = (item.target || item.externalUrl || "").match(/[a-f0-9]{32}/i);
      if (match) {
        targetId = match[0];
      }
    }

    const fetchUrl = isLocalFile
      ? `/api/data?type=page-preview&filePath=${encodeURIComponent(targetPath)}`
      : targetId && !targetId.startsWith("idx-") && !targetId.startsWith("Item-")
      ? `/api/data?type=page-preview&pageId=${encodeURIComponent(targetId)}`
      : null;

    if (!fetchUrl) {
      setPreviewBlocks([]);
      setPreviewContent(item.contentSnippet || item.description || "");
      setPreviewStatus("Vista previa de información indexada.");
      return;
    }

    const currentKey = isLocalFile ? targetPath : targetId;
    activePageIdRef.current = currentKey;
    setIsLoadingPreview(true);
    setPreviewStatus(isLocalFile ? "Cargando archivo de texto..." : "Cargando contenido de Notion...");

    fetch(fetchUrl)
      .then((res) => res.json())
      .then((data) => {
        if (activePageIdRef.current !== currentKey) return;

        const validBlocks = (data.blocks || []).filter(
          (b: any) => (b.text && b.text.trim()) || b.url || b.kind === "divider"
        );

        if (validBlocks.length > 0) {
          setPreviewBlocks(validBlocks);
          setPreviewContent(data.content || "");
          setPreviewStatus(`${validBlocks.length} bloque(s) cargados · desplázate para ver el contenido.`);
        } else if (data.content && data.content.trim()) {
          setPreviewBlocks([]);
          setPreviewContent(data.content);
          setPreviewStatus("Contenido cargado.");
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
      .catch(() => {
        if (activePageIdRef.current === currentKey) {
          if (item.contentSnippet || item.description) {
            setPreviewBlocks([]);
            setPreviewContent(item.contentSnippet || item.description);
            setPreviewStatus("Vista previa de información indexada (offline).");
          } else {
            setPreviewStatus("No se pudo cargar el contenido completo.");
          }
        }
      })
      .finally(() => {
        if (activePageIdRef.current === currentKey) {
          setIsLoadingPreview(false);
        }
      });
  }, [item?.externalId, item?.id, item?.target, item?.path]);

  if (!item) {
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
        <span className="text-[10px] text-[#475569]">Para visualizar detalles y contenido</span>
      </div>
    );
  }

  const updateStatus = item.updateStatus || item.statusLabel;
  const contentSnippet = previewContent || item.contentSnippet || item.pageContent || item.description;
  const parsed = parseVisualParts(item.name, updateStatus, contentSnippet);
  const targetPath = item.target || item.path || "";
  const isNotion = item.source === "Notion" || item.type === "NOTION_PAGE" || !targetPath.includes(":\\");
  const displayLocation = item.displayLocation || (targetPath ? targetPath.replace(/\\/g, "/") : "Notion");
  const isImage = isImageFile(targetPath) || isImageFile(item.name);

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

  const renderBlock = (block: PreviewBlock, index: number) => {
    const k = block.kind?.toLowerCase();
    if (!block.text?.trim() && !block.url && k !== "divider") {
      return null;
    }

    if (k === "heading_1" || k === "h1") {
      return (
        <div
          key={block.id || index}
          className="my-2 p-2 rounded bg-[#00A8FF]/15 border-l-[3px] border-[#00A8FF] text-[12.5px] font-bold text-white flex items-start gap-1.5"
        >
          <span className="text-xs">📌</span>
          <span className="leading-snug">{block.text}</span>
        </div>
      );
    }

    if (k === "heading_2" || k === "h2") {
      return (
        <div
          key={block.id || index}
          className="my-1.5 p-1.5 rounded bg-[#00C8FF]/10 border-l-[2.5px] border-[#00C8FF] text-[11.5px] font-semibold text-white flex items-start gap-1.5"
        >
          <span className="text-xs">🔹</span>
          <span className="leading-snug">{block.text}</span>
        </div>
      );
    }

    if (
      k === "heading_3" ||
      k === "h3" ||
      k === "heading_4" ||
      k === "h4" ||
      k === "heading_5" ||
      k === "h5" ||
      k === "heading_6" ||
      k === "h6"
    ) {
      return (
        <div
          key={block.id || index}
          className="my-1.5 p-1.5 rounded bg-[#A855F7]/15 border-l-[2.5px] border-[#A855F7] text-[11px] font-semibold text-[#E2E8F0] flex items-start gap-1.5"
        >
          <span className="text-[10px]">▪</span>
          <span className="leading-snug">{block.text}</span>
        </div>
      );
    }

    if (k === "to_do") {
      if (block.isChecked) {
        return (
          <div
            key={block.id || index}
            className="my-1 p-1.5 rounded bg-[#00E676]/12 border border-[#00E676]/30 flex items-center justify-between text-[10.5px] text-[#94A3B8]"
          >
            <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
              <CheckSquare className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
              <span className="line-through break-words leading-snug">{block.text}</span>
            </div>
            <span className="shrink-0 px-1.5 py-0.2 rounded text-[8px] font-bold bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40">
              ✓ Hecho
            </span>
          </div>
        );
      }
      return (
        <div
          key={block.id || index}
          className="my-1 p-1.5 rounded bg-[#161F2C] border border-[#26354A] flex items-start gap-2 text-[10.5px] text-[#F1F5F9]"
        >
          <CheckboxIcon className="w-3.5 h-3.5 text-[#64748B] shrink-0 mt-0.5" />
          <span className="leading-snug break-words">{block.text}</span>
        </div>
      );
    }

    if (k === "callout") {
      return (
        <div
          key={block.id || index}
          className="my-1.5 p-2 rounded bg-[#FFB020]/15 border border-[#FFB020]/35 text-[10.5px] text-[#FDE68A] flex items-start gap-2"
        >
          <span className="text-xs">💡</span>
          <span className="leading-relaxed">{block.text}</span>
        </div>
      );
    }

    if (k === "quote") {
      return (
        <div
          key={block.id || index}
          className="my-1.5 pl-2.5 py-1 border-l-[3px] border-[#00C8FF] bg-white/[0.03] text-[10.5px] italic text-[#CBD5E1] rounded-r leading-relaxed"
        >
          {block.text}
        </div>
      );
    }

    if (k === "code") {
      return (
        <div
          key={block.id || index}
          className="my-2 p-2 rounded bg-[#0D1117] border border-[#30363D] space-y-1 font-mono text-[9.5px]"
        >
          <div className="flex justify-between items-center text-[#8B949E] text-[8.5px] border-b border-[#21262D] pb-1">
            <span>{block.language ? block.language.toUpperCase() : "CODE"}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(block.text);
                playCopyChime();
              }}
              className="hover:text-white cursor-pointer px-1.5 py-0.5 rounded bg-[#161B22]"
            >
              Copiar
            </button>
          </div>
          <pre className="text-[#58A6FF] whitespace-pre-wrap">{block.text}</pre>
        </div>
      );
    }

    if (k === "bulleted_list_item") {
      return (
        <div key={block.id || index} className="pl-2 flex items-start gap-1.5 text-[10.5px] text-[#CBD5E1]">
          <span className="text-[#38BDF8] shrink-0">•</span>
          <span className="leading-relaxed">{block.text}</span>
        </div>
      );
    }

    if (k === "numbered_list_item") {
      return (
        <div key={block.id || index} className="pl-2 flex items-start gap-1.5 text-[10.5px] text-[#CBD5E1]">
          <span className="text-[#94A3B8] font-mono text-[9.5px] shrink-0">{index + 1}.</span>
          <span className="leading-relaxed">{block.text}</span>
        </div>
      );
    }

    if (k === "divider") {
      return <hr key={block.id || index} className="border-[#1E2836] my-2" />;
    }

    if (k === "image" && block.url) {
      return (
        <div
          key={block.id || index}
          className="my-2 rounded border border-[#1E2836] overflow-hidden bg-[#0A0F16] group/img relative cursor-zoom-in"
          onClick={() => {
            setLightboxImages([{ src: block.url!, caption: block.caption || parsed.title }]);
            setLightboxIndex(0);
          }}
          title="Clic para ver en pantalla completa y ampliar"
        >
          <img
            src={block.url}
            alt={block.caption || "Imagen"}
            className="max-h-56 w-full object-contain transition-transform duration-200 group-hover/img:scale-[1.02]"
          />
          <div className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white/90 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1 text-[9px] pointer-events-none">
            <ZoomIn className="w-3 h-3 text-[#38BDF8]" />
            <span>Ampliar</span>
          </div>
          {block.caption && (
            <p className="p-1 text-[9px] text-[#64748B] text-center bg-[#0D131C] border-t border-[#1E2836]">
              {block.caption}
            </p>
          )}
        </div>
      );
    }

    return (
      <p key={block.id || index} className="text-[10.5px] text-[#CBD5E1] leading-relaxed">
        {block.text}
      </p>
    );
  };

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
        {/* Título y Ruta (DetailsTitle y DetailsDisplayPath) */}
        <div className="space-y-1">
          <h2 className="text-[12px] font-semibold text-[#F1F5F9] leading-snug break-words">
            {parsed.title}
          </h2>
          <p className="text-[10.5px] text-[#94A3B8] opacity-75 break-all font-mono">
            {displayLocation}
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
                    const imgSrc = targetPath.startsWith("http")
                      ? targetPath
                      : `/api/data?type=file-preview&path=${encodeURIComponent(targetPath)}`;
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
            <div
              className="h-48 bg-[#0A0F16] border border-[#1E293B] rounded flex items-center justify-center overflow-hidden cursor-zoom-in group/cardimg relative"
              onClick={() => {
                const imgSrc = targetPath.startsWith("http")
                  ? targetPath
                  : `/api/data?type=file-preview&path=${encodeURIComponent(targetPath)}`;
                setLightboxImages([{ src: imgSrc, caption: item.name }]);
                setLightboxIndex(0);
              }}
              title="Clic para ver en pantalla completa y ampliar"
            >
              <img
                src={
                  targetPath.startsWith("http")
                    ? targetPath
                    : `/api/data?type=file-preview&path=${encodeURIComponent(targetPath)}`
                }
                alt={item.name}
                className="max-h-full max-w-full object-contain transition-transform group-hover/cardimg:scale-[1.02]"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cardimg:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="px-2 py-1 rounded bg-[#0F172A]/90 border border-[#38BDF8]/50 text-[#38BDF8] text-[10px] font-semibold flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" /> Ver en grande
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tarjeta VISTA PREVIA DE CONTENIDO / NOTION */}
        <div className="bg-[#141B26] border border-[#1E2836] rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#64748B]">VISTA PREVIA</span>
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
            className="bg-[#0A0F16] p-2.5 rounded border border-[#1E293B] max-h-[320px] overflow-y-auto space-y-1.5 select-text font-sans scrollbar-thin"
          >
            {previewBlocks.length > 0 ? (
              <>
                <div
                  style={{ fontSize: `${(9.5 * scale).toFixed(1)}px` }}
                  className="font-bold text-[#64C8FF] tracking-wider mb-2"
                >
                  CONTENIDO DE LA PÁGINA
                </div>
                {previewBlocks.map((b, idx) => renderBlock(b, idx))}
              </>
            ) : previewContent ? (
              <div
                style={{ fontSize: `${(10.5 * scale).toFixed(1)}px` }}
                className="whitespace-pre-wrap leading-relaxed text-[#CBD5E1]"
              >
                {previewContent}
              </div>
            ) : (
              <div className="text-center py-6 text-[#64748B] space-y-1">
                <p className="text-[11px]">No hay bloques cargados.</p>
                <p className="text-[9.5px] text-[#475569]">
                  {previewStatus || "Configura el token de Notion en Configuración para descargar los bloques en tiempo real."}
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
                    const newName = prompt("Nuevo nombre para el elemento:", item.name);
                    if (newName && newName !== item.name) {
                      alert(`Renombrando a "${newName}"...`);
                    }
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
