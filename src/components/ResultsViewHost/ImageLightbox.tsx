"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, ExternalLink, Download } from "lucide-react";

export interface LightboxImage {
  src: string;
  caption?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

/**
 * Visor de imágenes a pantalla completa para el panel de Detalles.
 * - Rueda del mouse / botones: zoom (0.25x – 8x)
 * - Arrastrar: mover la imagen cuando hay zoom
 * - Doble clic: alternar 1x / 2.5x
 * - ← / →: imagen anterior / siguiente · Esc: cerrar · 0: reiniciar
 */
export function ImageLightbox({ images, index, onClose, onIndexChange }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const isOpen = index !== null && index >= 0 && index < images.length;
  const current = isOpen ? images[index as number] : null;

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    reset();
  }, [index, reset]);

  const go = useCallback(
    (delta: number) => {
      if (!isOpen || images.length < 2) return;
      const next = ((index as number) + delta + images.length) % images.length;
      onIndexChange(next);
    },
    [isOpen, images.length, index, onIndexChange]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(8, z * 1.25));
      else if (e.key === "-") setZoom((z) => Math.max(0.25, z / 1.25));
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, go, reset]);

  if (!isOpen || !current) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom((z) => {
      const nz = Math.min(8, Math.max(0.25, z * factor));
      if (nz <= 1) setOffset({ x: 0, y: 0 });
      return nz;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.x),
      y: dragRef.current.oy + (e.clientY - dragRef.current.y),
    });
  };

  const stopDrag = () => {
    dragRef.current = null;
  };

  const btn =
    "w-8 h-8 rounded-lg bg-[#111822]/90 border border-[#26354A] text-[#CBD5E1] hover:text-white hover:border-[#38BDF8] flex items-center justify-center transition-colors cursor-pointer";

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col select-none"
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      {/* Barra superior */}
      <div className="h-12 shrink-0 px-4 flex items-center justify-between gap-3 border-b border-[#1E2836] bg-[#0A0F16]/80">
        <div className="min-w-0 flex items-center gap-2 text-[11px] text-[#94A3B8]">
          {images.length > 1 && (
            <span className="px-2 py-0.5 rounded bg-[#161F2C] border border-[#26354A] font-mono text-[#CBD5E1]">
              {(index as number) + 1} / {images.length}
            </span>
          )}
          <span className="truncate">{current.caption || "Imagen"}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" className={btn} title="Alejar (-)" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}>
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="w-12 text-center text-[11px] font-mono text-[#CBD5E1]">{Math.round(zoom * 100)}%</span>
          <button type="button" className={btn} title="Acercar (+)" onClick={() => setZoom((z) => Math.min(8, z * 1.25))}>
            <ZoomIn className="w-4 h-4" />
          </button>
          <button type="button" className={btn} title="Tamaño original (0)" onClick={reset}>
            <RotateCcw className="w-4 h-4" />
          </button>
          <a href={current.src} target="_blank" rel="noreferrer" className={btn} title="Abrir en pestaña nueva">
            <ExternalLink className="w-4 h-4" />
          </a>
          <a href={current.src} download className={btn} title="Descargar">
            <Download className="w-4 h-4" />
          </a>
          <button type="button" className={`${btn} hover:border-[#EF4444] hover:text-[#FCA5A5]`} title="Cerrar (Esc)" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lienzo */}
      <div
        className={`flex-1 relative overflow-hidden flex items-center justify-center ${
          zoom > 1 ? (dragRef.current ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDoubleClick={() => (zoom > 1 ? reset() : setZoom(2.5))}
        onClick={(e) => {
          if (e.target === e.currentTarget && zoom <= 1) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.src}
          alt={current.caption || "Imagen"}
          draggable={false}
          className="max-w-[92vw] max-h-[calc(100vh-7rem)] object-contain shadow-2xl rounded transition-transform duration-75"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#111822]/90 border border-[#26354A] text-white hover:border-[#38BDF8] flex items-center justify-center cursor-pointer"
              title="Anterior (←)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#111822]/90 border border-[#26354A] text-white hover:border-[#38BDF8] flex items-center justify-center cursor-pointer"
              title="Siguiente (→)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      <div className="h-7 shrink-0 flex items-center justify-center text-[10px] text-[#64748B] border-t border-[#1E2836] bg-[#0A0F16]/80">
        Rueda: zoom · Arrastrar: mover · Doble clic: 1x/2.5x · ←/→: navegar · Esc: cerrar
      </div>
    </div>
  );
}
