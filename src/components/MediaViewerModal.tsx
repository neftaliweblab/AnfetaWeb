"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Download, FileText, Film, Music, Image as ImageIcon, AlertTriangle } from "lucide-react";

export type MediaKind = "image" | "video" | "audio" | "pdf" | "file";

export interface MediaViewerProps {
  url: string;
  title?: string;
  kind?: MediaKind;
  onClose: () => void;
  onRefreshUrl?: () => Promise<string | void> | void;
}

export function detectMediaKind(url: string, declaredKind?: string): MediaKind {
  if (declaredKind === "image" || declaredKind === "video" || declaredKind === "audio" || declaredKind === "pdf") {
    return declaredKind as MediaKind;
  }
  const cleanUrl = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(cleanUrl)) return "image";
  if (/\.(mp4|webm|mov|mkv|ogg)$/i.test(cleanUrl)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(cleanUrl)) return "audio";
  if (/\.pdf$/i.test(cleanUrl)) return "pdf";
  return "file";
}

export function MediaViewerModal({ url, title, kind: declaredKind, onClose, onRefreshUrl }: MediaViewerProps) {
  const kind = detectMediaKind(url, declaredKind);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (kind === "image") {
        if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 4));
        else if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.5));
        else if (e.key === "0") {
          setScale(1);
          setPosition({ x: 0, y: 0 });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose, kind]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleRefresh = async () => {
    if (!onRefreshUrl || refreshing) return;
    setRefreshing(true);
    try {
      await onRefreshUrl();
      setError(false);
    } catch {
      // Keep error state
    } finally {
      setRefreshing(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visor multimedia de ANFETA"
      className="fixed inset-0 z-[500] flex flex-col bg-black/90 p-2 sm:p-4 backdrop-blur-md select-none text-slate-100"
      onClick={onClose}
    >
      {/* Barra superior con controles */}
      <div
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2.5 shadow-lg backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            {kind === "image" && <ImageIcon size={18} />}
            {kind === "video" && <Film size={18} />}
            {kind === "audio" && <Music size={18} />}
            {kind === "pdf" && <FileText size={18} />}
            {kind === "file" && <ExternalLink size={18} />}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-100">{title || "Archivo multimedia"}</h3>
            <span className="inline-block rounded bg-cyan-950/60 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-800/40 uppercase">
              {kind}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {kind === "image" && (
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-1.5 py-1 text-xs">
              <button
                type="button"
                aria-label="Reducir zoom"
                onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
                className="rounded p-1 hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <ZoomOut size={16} />
              </button>
              <span className="min-w-[40px] text-center font-mono text-[11px] text-cyan-300">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                aria-label="Aumentar zoom"
                onClick={() => setScale((s) => Math.min(s + 0.25, 4))}
                className="rounded p-1 hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                aria-label="Restablecer tamaño"
                onClick={() => {
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
                }}
                className="rounded p-1 hover:bg-slate-800 text-slate-400 hover:text-white"
                title="Restablecer escala"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          )}

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink size={14} />
            <span className="hidden md:inline">Abrir</span>
          </a>

          <a
            href={url}
            download
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Descargar archivo"
          >
            <Download size={14} />
            <span className="hidden md:inline">Descargar</span>
          </a>

          <button
            type="button"
            aria-label="Cerrar visor"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-rose-950/40 p-1.5 text-rose-300 hover:bg-rose-900 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Área principal de visualización */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden p-2 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {error ? (
          <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-amber-800/60 bg-slate-950/90 p-6 text-center shadow-2xl">
            <AlertTriangle className="text-amber-400" size={36} />
            <h4 className="text-base font-semibold text-slate-100">No se pudo cargar el archivo</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Las URLs firmadas de Notion tienen una vigencia temporal (60 minutos) o requieren permisos de acceso a la página original.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {onRefreshUrl && (
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => void handleRefresh()}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {refreshing ? "Actualizando enlace…" : "🔄 Actualizar enlace de Notion"}
                </button>
              )}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Intentar abrir en pestaña externa
              </a>
            </div>
          </div>
        ) : (
          <>
            {kind === "image" && (
              <div
                className="relative max-h-full max-w-full cursor-grab active:cursor-grabbing transition-transform duration-75 ease-out"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                }}
              >
                <img
                  src={url}
                  alt={title || "Imagen"}
                  onError={() => setError(true)}
                  className="max-h-[82dvh] max-w-[94vw] rounded-xl object-contain shadow-2xl pointer-events-none"
                />
              </div>
            )}

            {kind === "video" && (
              <div className="flex max-h-[85dvh] max-w-4xl w-full flex-col items-center justify-center">
                <video
                  src={url}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setError(true)}
                  className="max-h-[80dvh] w-full rounded-2xl border border-slate-800 bg-black shadow-2xl"
                >
                  Tu navegador no soporta la reproducción de video HTML5.
                </video>
              </div>
            )}

            {kind === "audio" && (
              <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-cyan-800/50 bg-slate-950/90 p-6 shadow-2xl">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <Music size={32} />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-semibold text-white truncate max-w-xs">{title || "Audio de la actividad"}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Reproductor de audio integrado</p>
                </div>
                <audio
                  src={url}
                  controls
                  preload="metadata"
                  onError={() => setError(true)}
                  className="w-full mt-2 accent-cyan-400"
                >
                  Tu navegador no soporta la reproducción de audio HTML5.
                </audio>
              </div>
            )}

            {kind === "pdf" && (
              <div className="h-[84dvh] w-[min(1200px,96vw)] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
                <iframe
                  src={url}
                  title={title || "Vista previa de PDF"}
                  onError={() => setError(true)}
                  className="h-full w-full rounded-b-2xl border-0 bg-white"
                />
              </div>
            )}

            {kind === "file" && (
              <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-6 text-center shadow-2xl">
                <FileText className="text-cyan-400" size={36} />
                <h4 className="text-sm font-semibold text-white">{title || "Archivo adjunto"}</h4>
                <p className="text-xs text-slate-400">
                  Este formato no cuenta con visor integrado en línea. Puedes descargarlo o abrirlo en tu navegador.
                </p>
                <div className="flex gap-2 mt-2">
                  <a
                    href={url}
                    download
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                  >
                    <Download size={14} />
                    Descargar
                  </a>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <ExternalLink size={14} />
                    Abrir en pestaña nueva
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
