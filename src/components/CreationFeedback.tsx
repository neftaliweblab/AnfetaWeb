"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, X } from "lucide-react";

export type CreationResult = {
  success: boolean;
  title: string;
  detail?: string;
  pageUrl?: string;
  pageId?: string;
  loading?: boolean;
};

const resultEvent = "anfeta_creation_result";

export function showCreationResult(
  success: boolean,
  title: string,
  detail?: string,
  pageUrl?: string,
  pageId?: string,
  loading?: boolean
) {
  const url = pageUrl || (pageId && !pageId.includes('/') ? `https://www.notion.so/${pageId.replace(/-/g, '')}` : undefined);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CreationResult>(resultEvent, {
      detail: { success, title, detail, pageUrl: url, pageId, loading },
    }));
  }
}

export function CreationFeedback() {
  const [result, setResult] = useState<CreationResult | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const receive = (event: Event) => {
      const next = (event as CustomEvent<CreationResult>).detail;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setResult(next);

      // Auto cerrar: 5s para éxito, 7.5s si trae enlace o error, no auto-cerrar si está cargando
      if (!next.loading) {
        const timeout = next.pageUrl ? 7500 : next.success ? 4500 : 6500;
        timerRef.current = window.setTimeout(() => setResult(null), timeout);
      }
    };

    window.addEventListener(resultEvent, receive);
    return () => {
      window.removeEventListener(resultEvent, receive);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!result) return null;

  const isSuccess = result.success && !result.loading;
  const isError = !result.success && !result.loading;
  const isLoading = Boolean(result.loading);

  const containerStyle = isLoading
    ? "border-cyan-500/50 bg-[#091522]/95 text-cyan-200 shadow-[0_10px_25px_rgba(0,0,0,0.5),0_0_15px_rgba(6,182,212,0.15)]"
    : isSuccess
    ? "border-emerald-500/50 bg-[#071912]/95 text-emerald-200 shadow-[0_10px_25px_rgba(0,0,0,0.5),0_0_15px_rgba(16,185,129,0.18)]"
    : "border-rose-500/60 bg-[#1A0A10]/95 text-rose-200 shadow-[0_10px_25px_rgba(0,0,0,0.5),0_0_15px_rgba(244,63,94,0.18)]";

  return (
    <aside
      aria-live="polite"
      role="status"
      className="fixed bottom-5 right-5 z-[9999] pointer-events-auto max-w-[420px] w-full p-2"
    >
      <div
        className={`w-full rounded-xl border p-3.5 backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-4 flex flex-col gap-1.5 ${containerStyle}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="text-xs font-bold tracking-tight text-white">
              {result.title}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar notificación"
          >
            <X size={14} />
          </button>
        </div>

        {result.detail && (
          <p className="text-[11px] text-slate-300 font-mono leading-relaxed line-clamp-2 pl-6">
            {result.detail}
          </p>
        )}

        {result.pageUrl && (
          <div className="pt-1 pl-6 flex items-center gap-2">
            <a
              href={result.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-all cursor-pointer shadow-sm active:scale-95 hover:shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            >
              <ExternalLink size={12} />
              <span>Abrir en Notion ↗</span>
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
