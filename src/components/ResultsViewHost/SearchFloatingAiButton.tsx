"use client";

import React from "react";
import { Sparkles } from "lucide-react";

interface SearchFloatingAiButtonProps {
  onClick?: () => void;
}

export function SearchFloatingAiButton({ onClick }: SearchFloatingAiButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-12 right-6 z-40 w-11 h-11 rounded-full bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] shadow-[0_0_15px_rgba(56,189,248,0.5)] border border-[#7DD3FC]/50 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
      title="Asistente Ejecutivo ANFETA IA"
    >
      <Sparkles className="w-5 h-5 drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
    </button>
  );
}
