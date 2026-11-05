"use client";
import React,{useState} from 'react';
import {createPortal} from 'react-dom';
import {Image as ImageIcon,ZoomIn,CheckSquare,Square as CheckboxIcon} from 'lucide-react';
import {mediaUrl} from '@/lib/mediaUrl';
import {playCopyChime} from '@/services/windowsIntegration';
import {ImageLightbox,LightboxImage} from './ImageLightbox';
export interface PreviewBlock {
  id: string;
  kind: string;
  text: string;
  isChecked?: boolean;
  isStrikethrough?: boolean;
  language?: string;
  url?: string;
  caption?: string;
  lastEditedTime?: string;
  cells?: string[];
}
function NotionImageBlock({
  block,
  pageTitle,
  onOpenLightbox,
}: {
  block: PreviewBlock;
  pageTitle: string;
  onOpenLightbox: (img: { src: string; caption?: string }) => void;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [triedProxy, setTriedProxy] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(block.url || "");
  const [loading, setLoading] = useState(true);

  const handleError = () => {
    if (!triedProxy && (block.id || block.url)) {
      setTriedProxy(true);
      setCurrentSrc(`/api/data?type=image-proxy&blockId=${encodeURIComponent(block.id || "")}&url=${encodeURIComponent(block.url || "")}`);
    } else {
      setLoadFailed(true);
      setLoading(false);
    }
  };

  const caption = block.caption || block.text || "";

  if (loadFailed) {
    return (
      <div className="my-2 p-3 rounded-lg border border-[#1E2836] bg-[#0A0F16] flex flex-col items-center justify-center text-center gap-2 text-xs text-[#94A3B8]">
        <ImageIcon className="w-8 h-8 text-[#38BDF8]/40" />
        <span className="font-medium text-[#CBD5E1] truncate max-w-full">
          {caption || "Imagen no disponible en Notion"}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <button
            type="button"
            onClick={() => {
              setLoadFailed(false);
              setTriedProxy(false);
              setCurrentSrc(block.url || "");
              setLoading(true);
            }}
            className="px-2.5 py-1 rounded bg-[#162235] hover:bg-[#1E2E48] text-[#38BDF8] border border-[#234268] text-[10.5px] cursor-pointer transition-colors"
          >
            ↻ Reintentar
          </button>
          {block.url && (
            <a
              href={block.url}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded bg-[#131A22] hover:bg-[#18212B] text-slate-400 border border-slate-700 text-[10.5px] transition-colors"
            >
              Abrir enlace ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="my-2 rounded border border-[#1E2836] overflow-hidden bg-[#0A0F16] group/img relative cursor-zoom-in"
      onClick={() => onOpenLightbox({ src: currentSrc, caption: caption || pageTitle })}
      title="Clic para ver en pantalla completa y ampliar"
    >
      {loading && (
        <div className="h-44 w-full flex items-center justify-center bg-[#080D14] animate-pulse text-[#475569] text-[10px]">
          <span className="flex items-center gap-1.5 text-cyan-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            Cargando imagen…
          </span>
        </div>
      )}
      <img
        src={currentSrc}
        alt={caption || "Imagen"}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className={`max-h-60 w-full object-contain transition-transform duration-200 group-hover/img:scale-[1.02] ${loading ? "hidden" : "block"}`}
        onLoad={() => setLoading(false)}
        onError={handleError}
      />
      <div className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white/90 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1 text-[9px] pointer-events-none">
        <ZoomIn className="w-3 h-3 text-[#38BDF8]" />
        <span>Ampliar</span>
      </div>
      {caption && (
        <p className="p-1 text-[9px] text-[#64748B] text-center bg-[#0D131C] border-t border-[#1E2836] truncate">
          {caption}
        </p>
      )}
    </div>
  );
}

/** Shared with Details: one renderer for tables, media, checklists and image zoom. */
export function NotionPreviewBlock({block,index,pageTitle,onOverlayChange}:{block:PreviewBlock;index:number;pageTitle:string;onOverlayChange?:(open:boolean)=>void}){
  const [lightboxImages,setLightboxImages]=useState<LightboxImage[]>([]);
  const [lightboxIndex,setLightboxIndex]=useState<number|null>(null);
  const renderBlock = (block: PreviewBlock, index: number) => {
    const k = block.kind?.toLowerCase();
    if (!block.text?.trim() && !block.cells?.length && !block.url && k !== "divider") {
      return null;
    }

    if(k === "table_row" && block.cells?.length) return <div key={block.id||index} role="table" aria-label="Fila de tabla de Notion" className="my-1 overflow-x-auto rounded border border-slate-700"><div role="row" className="grid min-w-max" style={{gridTemplateColumns:`repeat(${block.cells.length}, minmax(110px, 1fr))`}}>{block.cells.map((cell,i)=><div role="cell" key={i} className="max-w-80 whitespace-pre-wrap break-words border-r border-slate-700 bg-slate-900/60 p-2 text-xs last:border-r-0">{cell || "\u00a0"}</div>)}</div></div>;
    const media=mediaUrl(block.url);
    if(['audio','video','pdf','file','bookmark','embed','link_preview'].includes(k)&&media){const directVideo=k==='video'&&/\.(?:mp4|webm|ogg)(?:[?#]|$)/i.test(media);return <div key={block.id||index} className="my-2 rounded border border-slate-700 bg-slate-950 p-2 space-y-2">{k==='audio'&&<audio controls preload="none" src={media} className="w-full"/>}{directVideo&&<video controls preload="none" src={media} className="max-h-64 w-full"/>}<a href={media} target="_blank" rel="noopener noreferrer" className="block break-words text-xs text-cyan-300 underline">{block.text||block.caption||(k==='pdf'?'Abrir PDF':k==='video'?'Abrir video':k==='audio'?'Abrir audio':k==='file'?'Abrir archivo':'Abrir enlace')}</a>{block.caption&&block.caption!==block.text&&<p className="text-xs text-slate-400">{block.caption}</p>}</div>;}
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

    if (k === "image" && (block.url || block.id)) {
      return (
        <NotionImageBlock
          key={block.id || index}
          block={block}
          pageTitle={pageTitle}
          onOpenLightbox={(img) => {
            setLightboxImages([img]);
            setLightboxIndex(0);onOverlayChange?.(true);
          }}
        />
      );
    }

    return (
      <p key={block.id || index} className="text-[10.5px] text-[#CBD5E1] leading-relaxed">
        {block.text}
      </p>
    );
  };

  return <>{renderBlock(block,index)}{lightboxIndex!==null&&typeof document!=='undefined'&&createPortal(<div style={{position:'relative',zIndex:10020}}><ImageLightbox images={lightboxImages} index={lightboxIndex} onClose={()=>{setLightboxIndex(null);onOverlayChange?.(false);}} onIndexChange={setLightboxIndex}/></div>,document.body)}</>;
}
