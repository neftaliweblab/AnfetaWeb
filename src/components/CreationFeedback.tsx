"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

type CreationResult = { success: boolean; title: string; detail?: string };
const resultEvent = "anfeta_creation_result";

export function showCreationResult(success: boolean, title: string, detail?: string) {
  window.dispatchEvent(new CustomEvent<CreationResult>(resultEvent, {
    detail: { success, title, detail },
  }));
}

export function CreationFeedback() {
  const [result, setResult] = useState<CreationResult | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const receive = (event: Event) => {
      const next = (event as CustomEvent<CreationResult>).detail;
      window.clearTimeout(timer);
      setResult(next);
      timer = window.setTimeout(() => setResult(null), next.success ? 2200 : 3500);
    };
    window.addEventListener(resultEvent, receive);
    return () => {
      window.removeEventListener(resultEvent, receive);
      window.clearTimeout(timer);
    };
  }, []);

  if (!result) return null;
  const Icon = result.success ? Check : X;
  const color = result.success ? "border-emerald-600 text-emerald-300" : "border-rose-600 text-rose-300";
  return (
    <div className="pointer-events-none fixed inset-0 z-[1000] grid place-items-center p-4">
      <div role={result.success ? "status" : "alert"} className={`w-full max-w-sm rounded-2xl border bg-slate-950 px-6 py-5 text-center shadow-2xl ${color}`}>
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border border-current bg-white/5">
          <Icon size={32} aria-hidden="true" />
        </span>
        <p className="text-base font-semibold">{result.title}</p>
        {result.detail && <p className="mt-2 text-sm text-slate-200">{result.detail}</p>}
      </div>
    </div>
  );
}
